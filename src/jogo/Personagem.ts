import * as THREE from 'three';
import { Humano } from '../entidades/humano/Humano';
import type { CorpoBase } from '../entidades/humano/CorpoBase';
import type { Aparencia } from '../entidades/humano/Vestimenta';
import type { NomeClipe } from '../entidades/humano/Animador';
import type { NomeAderecos } from '../entidades/humano/Aderecos';
import { CorpoFisico, type MundoFisico } from '../mundo/Fisica';
import type { Escalada } from '../mundo/Mundo';
import { Ficha, type Atributos } from './Atributos';
import { CLASSES, temVerbo, type NomeClasse, type Verbo } from './Classes';
import { ControladorIA, type EntradaRotina } from './IA';
import { clamp, dampAngle, lerp, smoothstep } from '../core/util';

export interface DefPersonagem {
  id: string;
  nome: string;
  /** Nome que passa a valer quando uma flag é ligada (ex.: Abrão → Abraão, Gn 17:5). */
  nomeAlternativo?: { flag: string; nome: string };
  classe: NomeClasse | null;
  aparencia: Aparencia;
  atributos?: Partial<Atributos>;
  jogavel: boolean;
  protagonista?: boolean;
  /** Quem é, em uma frase (bíblico). */
  descricao?: string;
  /** Arco pessoal no jogo. */
  arco?: string;
  /** Referência bíblica principal do personagem. */
  ref?: string;
  rotina?: EntradaRotina[];
  velocidadeIA?: number;
  aprendidos?: Verbo[];
}

export interface Comando {
  x: number;
  z: number;
  correr: boolean;
  pular: boolean;
  agachar: boolean;
  /** Eixo vertical (W/S) usado enquanto escala: 1 sobe, -1 desce. */
  subir?: number;
}

/** Estado de quem está numa superfície escalável (`mundo.escaladas`). */
export interface EstadoEscalada {
  e: Escalada;
  /** 0 = base, 1 = topo. */
  t: number;
  /** Velocidade vertical atual (m/s, para a animação). */
  vel: number;
}

/** Parte da escalada que é subida vertical; o resto é o passo para cima da plataforma. */
const FRACAO_VERTICAL = 0.86;

/**
 * Uma pessoa no mundo: corpo visível animado + corpo físico + ficha (se jogável) + IA.
 * Quando controlada pelo jogador recebe comandos; senão, a IA decide.
 */
export class Personagem {
  readonly def: DefPersonagem;
  readonly humano: Humano;
  readonly corpo: CorpoFisico;
  readonly ia: ControladorIA;
  ficha: Ficha | null;
  yaw = 0;
  controlado = false;
  disponivel = true;
  /** Controlado por cinemática/script: ignora IA e entrada. */
  emCena = false;
  /** Velocidade horizontal atual. */
  velocidade = 0;
  /** Descrição curta do que está fazendo (mostrada na roda de troca). */
  atividade = '';
  carregando: NomeAderecos | null = null;
  /** Em posto de cooperação (segurando algo): fica parado até ser liberado. */
  posto: { id: string; clipe: NomeClipe; yaw: number; descricao: string } | null = null;
  aprendidos: Verbo[];
  flags: Record<string, boolean> = {};
  private flagsGlobais: () => Record<string, unknown>;
  velocidadeBase = 3.6;
  velocidadeCorrida = 6.0;
  /** Multiplicador de velocidade (medo, carga, água). */
  modVelocidade = 1;
  noAr = false;
  private tempoParado = 0;
  /** Escalando uma superfície (continua pendurado se o jogador trocar de personagem). */
  escalada: EstadoEscalada | null = null;
  /** Fôlego esgotado: não corre até recuperar parte dele. */
  cansado = false;
  /** Pulo pedido há pouco (aceito logo antes de tocar o chão). */
  private bufferPulo = 0;
  /** Velocidade de escalada (m/s). */
  velocidadeEscalada = 1.5;

  constructor(def: DefPersonagem, base: CorpoBase, flagsGlobais: () => Record<string, unknown>) {
    this.def = def;
    this.flagsGlobais = flagsGlobais;
    this.humano = new Humano(base, def.aparencia);
    this.humano.raiz.name = def.id;
    const raio = def.aparencia.altura > 1.75 ? 0.36 : 0.33;
    this.corpo = new CorpoFisico(raio, def.aparencia.altura * 0.95);
    this.ficha = def.jogavel ? new Ficha(def.atributos) : null;
    this.ia = new ControladorIA(def.rotina ?? []);
    this.aprendidos = [...(def.aprendidos ?? [])];
    if (def.velocidadeIA) this.velocidadeBase = def.velocidadeIA;
  }

  get id() {
    return this.def.id;
  }

  get nome(): string {
    const alt = this.def.nomeAlternativo;
    if (alt && this.flagsGlobais()[alt.flag]) return alt.nome;
    return this.def.nome;
  }

  get classe(): NomeClasse | null {
    return this.def.classe;
  }

  get nomeClasse(): string {
    return this.def.classe ? CLASSES[this.def.classe].nome : '';
  }

  pode(v: Verbo): boolean {
    if (!this.def.classe) return false;
    return temVerbo(this.def.classe, v, this.aprendidos);
  }

  get posicao(): THREE.Vector3 {
    return this.corpo.pos;
  }

  teleportar(x: number, y: number, z: number, yaw?: number) {
    this.corpo.teleportar(x, y, z);
    if (yaw !== undefined) this.yaw = yaw;
    this.humano.raiz.position.copy(this.corpo.pos);
    this.humano.raiz.rotation.y = this.yaw;
    this.ia.limparCaminho();
  }

  /** Coloca o objeto carregado (troncos, sacos) nas mãos e muda a animação do tronco. */
  carregar(item: NomeAderecos | null) {
    this.carregando = item;
    this.humano.segurar(item, 'direita');
    this.humano.animador.superior = item ? 'carregar' : null;
  }

  entrarPosto(id: string, clipe: NomeClipe, yaw: number, descricao: string) {
    this.posto = { id, clipe, yaw, descricao };
    this.yaw = yaw;
    this.humano.animador.atividade = clipe;
    this.atividade = descricao;
  }

  sairPosto() {
    if (!this.posto) return;
    this.posto = null;
    this.humano.animador.atividade = null;
    this.atividade = '';
  }

  /** Agarra uma superfície escalável pela base (t = 0) ou pelo topo (t = 1). */
  iniciarEscalada(e: Escalada, peloTopo = false) {
    this.sairPosto();
    this.escalada = { e, t: peloTopo ? 1 : 0, vel: 0 };
    this.corpo.vel.set(0, 0, 0);
    this.corpo.semGravidade = true;
    this.corpo.fantasma = true;
    this.yaw = e.yaw;
    this.humano.escalando = true;
    this.humano.animador.atividade = 'segurar';
    this.atividade = 'escalando';
    this.posicionarEscalada();
  }

  /** Solta a escalada no topo ou na base (ou onde estiver, se 'aqui'). */
  sairEscalada(onde: 'topo' | 'base' | 'aqui' = 'aqui') {
    const s = this.escalada;
    if (!s) return;
    this.escalada = null;
    this.corpo.semGravidade = false;
    this.corpo.fantasma = false;
    this.humano.escalando = false;
    this.humano.animador.atividade = null;
    this.atividade = '';
    if (onde === 'topo') this.teleportar(s.e.topo.x, s.e.topo.y + 0.05, s.e.topo.z);
    else if (onde === 'base') this.teleportar(s.e.base.x, s.e.base.y + 0.05, s.e.base.z);
    this.corpo.noChao = false;
  }

  private posicionarEscalada() {
    const s = this.escalada!;
    const { base, topo } = s.e;
    const tv = clamp(s.t / FRACAO_VERTICAL, 0, 1);
    const th = smoothstep(FRACAO_VERTICAL, 1, s.t);
    this.corpo.pos.set(lerp(base.x, topo.x, th), lerp(base.y, topo.y, tv), lerp(base.z, topo.z, th));
  }

  private atualizarEscalada(dt: number, cmd: Comando | null) {
    const s = this.escalada!;
    const altura = Math.max(0.5, s.e.topo.y - s.e.base.y);
    const eixo = cmd ? clamp(cmd.subir ?? 0, -1, 1) : 0;
    const v = eixo * this.velocidadeEscalada * (eixo < 0 ? 1.3 : 1);
    s.vel = v;
    s.t = clamp(s.t + (v * dt) / altura, 0, 1);
    this.posicionarEscalada();
    this.corpo.vel.set(0, 0, 0);
    this.yaw = dampAngle(this.yaw, s.e.yaw, 10, dt);
    // subir cansa um pouco
    if (this.ficha && v > 0) this.ficha.folego = Math.max(0, this.ficha.folego - dt * 3);
  }

  /**
   * Atualiza movimento e animação. `cmd` vem do jogador (se controlado) ou é null para a IA.
   */
  atualizar(dt: number, m: MundoFisico, cmd: Comando | null, distanciaCamera: number, mundoIA?: unknown) {
    let vx = 0;
    let vz = 0;
    let correr = false;
    let agachar = false;
    if (this.escalada) {
      this.atualizarEscalada(dt, cmd);
      const an = this.humano.animador;
      an.velocidade = Math.abs(this.escalada.vel);
      an.noChao = true;
      an.agachado = false;
      this.velocidade = 0;
      this.tempoParado = Math.abs(this.escalada.vel) < 0.05 ? this.tempoParado + dt : 0;
      this.humano.raiz.position.copy(this.corpo.pos);
      this.humano.raiz.rotation.y = this.yaw;
      if (distanciaCamera < 140) this.humano.atualizar(dt, distanciaCamera);
      this.humano.raiz.visible = distanciaCamera < 160 && this.humano.visivel;
      return;
    }
    if (this.posto) {
      this.yaw = dampAngle(this.yaw, this.posto.yaw, 8, dt);
    } else if (this.emCena) {
      const r = this.ia.calcularCena(dt, this, m);
      vx = r.vx;
      vz = r.vz;
      correr = r.correr;
    } else if (cmd) {
      const movendo = cmd.x !== 0 || cmd.z !== 0;
      const podeCorrer = cmd.correr && this.podeCorrer();
      let vel = (podeCorrer ? this.velocidadeCorrida : this.velocidadeBase) * this.modVelocidade * (cmd.agachar ? 0.4 : 1);
      // sem fôlego: anda mais devagar (sobretudo carregando peso)
      if (this.cansado) vel *= this.carregando ? 0.7 : 0.88;
      vx = cmd.x * vel;
      vz = cmd.z * vel;
      correr = podeCorrer && movendo;
      agachar = cmd.agachar;
      // ao assumir alguém no meio de uma atividade da rotina, ela continua até o jogador se mexer
      if (movendo && this.humano.animador.atividade) this.humano.animador.atividade = null;
      // pulo com tolerância: aceito um pouco antes de tocar o chão e logo depois de sair da borda
      if (cmd.pular) this.bufferPulo = 0.15;
      if (this.bufferPulo > 0 && !this.carregando && !agachar) {
        const borda = !this.corpo.noChao && this.corpo.tempoNoAr < 0.12 && this.corpo.vel.y <= 0;
        if (this.corpo.noChao || borda) {
          this.corpo.vel.y = 7.2;
          this.corpo.noChao = false;
          this.bufferPulo = 0;
          this.humano.animador.tocar('pularInicio', 'todo', 1.4);
        }
      }
    } else {
      const r = this.ia.calcular(dt, this, m, mundoIA);
      vx = r.vx;
      vz = r.vz;
      correr = r.correr;
    }
    if (this.carregando) {
      vx *= 0.75;
      vz *= 0.75;
    }
    this.bufferPulo = Math.max(0, this.bufferPulo - dt);
    this.corpo.mover(m, dt, vx, vz, this.controlado ? 16 : 10);
    const vh = Math.hypot(this.corpo.vel.x, this.corpo.vel.z);
    this.velocidade = vh;
    if (vh > 0.3 && !this.posto) {
      // gira suave: mais rápido parado/devagar, mais largo correndo
      const lambda = this.controlado ? (vh > 5 ? 9 : 14) : 10;
      this.yaw = dampAngle(this.yaw, Math.atan2(this.corpo.vel.x, this.corpo.vel.z), lambda, dt);
    }

    // fôlego
    if (this.ficha) {
      const f = this.ficha;
      if (correr && vh > 4) f.folego = Math.max(0, f.folego - dt * (16 - f.atributos.resistencia));
      else if (this.carregando && vh > 0.5) f.folego = Math.max(0, f.folego - dt * 4);
      else f.folego = Math.min(f.folegoMax, f.folego + dt * (vh < 0.3 ? 14 : 8));
      if (f.folego <= 0.5) this.cansado = true;
      else if (this.cansado && f.folego > f.folegoMax * 0.3) this.cansado = false;
    }

    // animação
    const an = this.humano.animador;
    an.velocidade = vh;
    an.agachado = agachar;
    an.noChao = this.corpo.noChao || this.corpo.tempoNoAr < 0.18;
    if (this.noAr && an.noChao && this.corpo.vel.y <= 0) {
      if (this.controlado) an.tocar('pularFim', 'todo', 1.6);
    }
    this.noAr = !an.noChao;
    this.tempoParado = vh < 0.2 ? this.tempoParado + dt : 0;

    this.humano.raiz.position.copy(this.corpo.pos);
    this.humano.raiz.rotation.y = this.yaw;
    if (distanciaCamera < 140) this.humano.atualizar(dt, distanciaCamera);
    this.humano.raiz.visible = distanciaCamera < 160 && this.humano.visivel;
  }

  podeCorrer(): boolean {
    if (!this.ficha) return !this.carregando;
    return this.ficha.folego > 4 && !this.cansado && !this.carregando;
  }

  get escalando() {
    return !!this.escalada;
  }

  /** Frente do personagem no plano. */
  frente(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  get parado() {
    return this.tempoParado > 0.5;
  }

  dispose() {
    this.humano.dispose();
  }
}

export function clampFolego(f: Ficha) {
  f.folego = clamp(f.folego, 0, f.folegoMax);
}
