import * as THREE from 'three';
import { Humano } from '../entidades/humano/Humano';
import type { CorpoBase } from '../entidades/humano/CorpoBase';
import type { Aparencia } from '../entidades/humano/Vestimenta';
import type { NomeClipe } from '../entidades/humano/Animador';
import type { NomeAderecos } from '../entidades/humano/Aderecos';
import { CorpoFisico, type MundoFisico } from '../mundo/Fisica';
import { Ficha, type Atributos } from './Atributos';
import { CLASSES, temVerbo, type NomeClasse, type Verbo } from './Classes';
import { ControladorIA, type EntradaRotina } from './IA';
import { clamp, dampAngle } from '../core/util';

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
}

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

  /**
   * Atualiza movimento e animação. `cmd` vem do jogador (se controlado) ou é null para a IA.
   */
  atualizar(dt: number, m: MundoFisico, cmd: Comando | null, distanciaCamera: number, mundoIA?: unknown) {
    let vx = 0;
    let vz = 0;
    let correr = false;
    let agachar = false;
    if (this.posto) {
      this.yaw = dampAngle(this.yaw, this.posto.yaw, 8, dt);
    } else if (this.emCena) {
      const r = this.ia.calcularCena(dt, this, m);
      vx = r.vx;
      vz = r.vz;
      correr = r.correr;
    } else if (cmd) {
      const vel = (cmd.correr && this.podeCorrer() ? this.velocidadeCorrida : this.velocidadeBase) * this.modVelocidade * (cmd.agachar ? 0.4 : 1);
      vx = cmd.x * vel;
      vz = cmd.z * vel;
      correr = cmd.correr && (cmd.x !== 0 || cmd.z !== 0);
      agachar = cmd.agachar;
      if (cmd.pular && !this.carregando && this.corpo.pular()) this.humano.animador.tocar('pularInicio', 'todo', 1.4);
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
    this.corpo.mover(m, dt, vx, vz, this.controlado ? 16 : 10);
    const vh = Math.hypot(this.corpo.vel.x, this.corpo.vel.z);
    this.velocidade = vh;
    if (vh > 0.3 && !this.posto) this.yaw = dampAngle(this.yaw, Math.atan2(this.corpo.vel.x, this.corpo.vel.z), 12, dt);

    // fôlego
    if (this.ficha) {
      const f = this.ficha;
      if (correr && vh > 4) f.folego = Math.max(0, f.folego - dt * (16 - f.atributos.resistencia));
      else if (this.carregando && vh > 0.5) f.folego = Math.max(0, f.folego - dt * 4);
      else f.folego = Math.min(f.folegoMax, f.folego + dt * (vh < 0.3 ? 14 : 8));
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
    if (!this.ficha) return true;
    return this.ficha.folego > 4 && !this.carregando;
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
