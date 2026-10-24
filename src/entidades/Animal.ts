import * as THREE from 'three';
import { Ativos } from '../render/Ativos';
import { aplicarPatch } from '../render/Shaders';
import { CorpoFisico, type MundoFisico } from '../mundo/Fisica';
import type { Navegacao } from '../mundo/Navegacao';
import { clamp, damp, dampAngle, wrapAngle } from '../core/util';
import { Aleatorio } from '../core/aleatorio';
import { ESPECIES, infoEspecie, type Especie, type InfoEspecie } from './animais/especies';
import { CorpoGLB, CorpoProcedural, carregarMoldeGLB, moldeProcedural, type CorpoAnimal } from './animais/Corpos';
import { PROCEDURAIS, type Sexo } from './animais/procedurais';
import { poseVazia, type PoseAnimal } from './animais/Marcha';
import { Audio } from '../audio/Audio';

export type { Especie, InfoEspecie, Sexo };
export { ESPECIES };

/**
 * ANIMAIS
 * -------
 * `criarAnimal(especie, mundo, x, z, opts)` carrega/monta o animal, coloca-o em `mundo.grupo` e o
 * registra em `mundo.atualizaveis` (use `registrar: false` para fazer isso você mesmo e chamar
 * `animal.atualizar(dt, t)`). `animal.remover()` desfaz tudo.
 *
 * Comportamentos (um de cada vez; um novo comando encerra o anterior e resolve sua promessa):
 * - `vagar(raio)` / `vagar(cx, cz, raio)`: passeia e pasta em volta de um ponto.
 * - `seguir(alvo, dist)`: segue qualquer coisa com `posicao` (Personagem, outro Animal).
 * - `irPara(x, z)` / `entrar(pontos)`: anda até o ponto (ou pelos pontos) — `entrar` some com fade no fim.
 * - `fugirDe(pos)`: corre para longe por alguns segundos e volta ao que fazia.
 * - `agitar()` / `acalmar()`: assustado (dispara, para e treme, berra); acalmar volta ao comportamento anterior.
 * - `voarPara(x, y, z)` / `voarPara(alvo)` / `voarPor(pontos)` (aves): decola, voa e pousa (num ponto,
 *   num objeto ou numa função que devolve a posição — ex.: a mão de Noé).
 * - `prender()` / `soltar()`: preso pelos chifres (debate-se no lugar).
 * - Rebanho: ver `Rebanho` (boids que fogem do pastor).
 * Física: altura do chão pelo MundoFisico (relevo + pisos), paredes por Colisoes.empurrar (CorpoFisico),
 * não entra em água funda; desvia de obstáculos e de outros animais. LOD: longe ou fora da tela não anima.
 */

export interface MundoAnimais {
  fisica: MundoFisico;
  nav?: Navegacao;
  grupo?: THREE.Object3D;
  atualizaveis?: Set<{ atualizar(dt: number, t: number): void }>;
}

export interface OpcoesAnimal {
  ativos?: Ativos;
  sexo?: Sexo;
  /** Altura inicial (ex.: convés da arca); o chão é procurado abaixo dela. */
  y?: number;
  yaw?: number;
  escala?: number;
  /** Cor que multiplica a pelagem (ex.: '#7a6656' para lã escura). */
  tom?: THREE.ColorRepresentation;
  /** Adiciona à cena e aos atualizáveis do mundo (padrão true). */
  registrar?: boolean;
  /** Pai do objeto 3D (padrão mundo.grupo). */
  pai?: THREE.Object3D;
  semente?: number;
  tag?: string;
}

export type EstadoAnimal =
  | 'parado' | 'vagar' | 'seguir' | 'ir' | 'fugir' | 'agitado' | 'rebanho' | 'voar' | 'pousado' | 'preso' | 'sumido' | 'cena';

export type AlvoVoo = THREE.Vector3 | [number, number, number] | (() => THREE.Vector3) | { posicao: THREE.Vector3 } | THREE.Object3D;

export interface OpcoesVoo {
  /** Pousa no último ponto (padrão true). */
  pousar?: boolean;
  /** Altura de cruzeiro acima do alvo/chão (padrão 6 m). */
  altura?: number;
  velocidade?: number;
  /** Some com fade ao chegar ao fim (corvo indo embora). */
  sumir?: boolean;
}

export interface OpcoesIr {
  correr?: boolean;
  /** Ignora a grade de navegação (interiores, rampas). */
  direto?: boolean;
  /** Distância de chegada (padrão 0.4 m). */
  raio?: number;
  velocidade?: number;
}

let ativosPadrao: Ativos | null = null;
let cameraVista: THREE.Camera | null = null;
const materiaisTom = new Map<string, THREE.Material>();
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _p = new THREE.Vector3();

function resolverAlvo(a: AlvoVoo, out: THREE.Vector3): THREE.Vector3 {
  if (Array.isArray(a)) return out.set(a[0], a[1], a[2]);
  if (typeof a === 'function') return out.copy(a());
  if ((a as THREE.Vector3).isVector3) return out.copy(a as THREE.Vector3);
  if ((a as THREE.Object3D).isObject3D) return (a as THREE.Object3D).getWorldPosition(out);
  return out.copy((a as { posicao: THREE.Vector3 }).posicao);
}

export class Animal {
  /** Todos os animais vivos (separação entre eles, consultas). */
  static readonly todos = new Set<Animal>();
  /** Câmera para o LOD. Se não for definida, é capturada do primeiro quadro desenhado. */
  static camera: THREE.Camera | null = null;
  /** Distância (m) além da qual o esqueleto não é animado. */
  static distanciaAnimar = 70;

  readonly especie: Especie;
  readonly info: InfoEspecie;
  readonly sexo: Sexo;
  readonly raiz = new THREE.Group();
  readonly corpo: CorpoAnimal;
  readonly fisico: CorpoFisico;
  readonly mundo: MundoAnimais;
  estado: EstadoAnimal = 'parado';
  yaw: number;
  escala: number;
  tag: string;
  /** Livre para as missões (ex.: dono do rebanho). */
  readonly dados: Record<string, unknown> = {};
  /** Velocidade horizontal desejada (m/s), escrita pelos comportamentos ou pelo Rebanho. */
  readonly desejo = new THREE.Vector3();
  correndo = false;
  /** Rebanho ao qual pertence (o Rebanho escreve `desejo`). */
  rebanho: { atualizar(dt: number): void } | null = null;
  /** Nível de alarme (0..1), usado pelo rebanho e pelo som. */
  alarme = 0;

  private rnd: Aleatorio;
  private pose: PoseAnimal = poseVazia();
  private t = 0;
  private agit = 0;
  private registrado = false;
  private materialBase: THREE.Material;
  private materialFade: THREE.Material | null = null;
  private opacidade = 1;
  private fadeAlvo = 1;
  private fadeVel = 1;
  private aoSumir: (() => void) | null = null;
  private acumulado = 0;
  private vistoEm = 0;
  private pitch = 0;
  private roll = 0;
  private velVoo = new THREE.Vector3();
  private tVoz = 3;
  private pendente: (() => void) | null = null;
  // estado dos comportamentos
  private centro = new THREE.Vector3();
  private raioVagar = 6;
  private destino: THREE.Vector3 | null = null;
  private pausa = 0;
  private pastarT = 0;
  private olharT = 0;
  private alvoSeguir: { posicao: THREE.Vector3 } | null = null;
  private distSeguir = 2.5;
  private caminho: THREE.Vector3[] = [];
  private opIr: OpcoesIr = {};
  private semProgresso = 0;
  private melhorDist = Infinity;
  private anterior: { estado: EstadoAnimal; alvo: { posicao: THREE.Vector3 } | null; dist: number; raio: number; centro: THREE.Vector3 } | null = null;
  private fugirDePos = new THREE.Vector3();
  private fugirT = 0;
  private agitado: { raio: number; fase: 'disparar' | 'tremer'; t: number; ancora: THREE.Vector3 } | null = null;
  private voo: { pontos: AlvoVoo[]; i: number; op: OpcoesVoo; decolar: number } | null = null;
  private poleiro: AlvoVoo | null = null;
  private desvio = 0;
  private tDesvio = 0;
  private olharPos: THREE.Vector3 | null = null;

  constructor(especie: Especie, corpo: CorpoAnimal, mundo: MundoAnimais, x: number, z: number, op: OpcoesAnimal = {}) {
    this.especie = especie;
    this.info = infoEspecie(especie);
    this.sexo = op.sexo ?? 'macho';
    this.corpo = corpo;
    this.mundo = mundo;
    this.tag = op.tag ?? '';
    this.rnd = new Aleatorio(op.semente ?? Math.floor(Math.random() * 1e9));
    this.escala = (op.escala ?? 1) * (this.sexo === 'femea' ? this.info.escalaFemea ?? 1 : 1);
    this.raiz.name = `animal_${especie}`;
    this.raiz.rotation.order = 'YXZ';
    this.raiz.add(corpo.raiz);
    corpo.raiz.scale.setScalar(this.escala);
    this.fisico = new CorpoFisico(this.info.raio * this.escala, Math.max(0.3, this.info.altura * this.escala * 0.8));
    this.fisico.passo = clamp(this.info.altura * 0.35, 0.15, 0.5);
    const y0 = op.y ?? 1e5;
    const chao = mundo.fisica.chao(x, z, y0 + this.fisico.passo, this.fisico.raio).y;
    this.fisico.teleportar(x, chao, z);
    this.fisico.noChao = true;
    this.yaw = op.yaw ?? this.rnd.entre(-Math.PI, Math.PI);
    this.centro.set(x, chao, z);
    // material: compartilhado, ou com tom próprio
    this.materialBase = corpo.malha.material as THREE.Material;
    if (op.tom !== undefined) {
      const cor = new THREE.Color(op.tom);
      const chave = this.materialBase.uuid + cor.getHexString();
      let m = materiaisTom.get(chave);
      if (!m) {
        m = this.materialBase.clone();
        (m as THREE.MeshLambertMaterial).color.multiply(cor);
        aplicarPatch(m, { revelar: true });
        materiaisTom.set(chave, m);
      }
      this.materialBase = m;
      corpo.definirMaterial(m);
    }
    // visibilidade para o LOD (e captura da câmera, se ninguém a definiu)
    corpo.malha.onBeforeRender = (_r, _s, cam) => {
      this.vistoEm = performance.now();
      cameraVista = cam;
    };
    this.posicionar();
    this.pose.t = this.rnd.entre(0, 100);
    this.corpo.atualizar(0.016, this.pose);
    this.raiz.updateMatrixWorld(true);
    corpo.malha.computeBoundingSphere();
    if (corpo.malha.boundingSphere) corpo.malha.boundingSphere.radius *= 1.3;
    Animal.todos.add(this);
  }

  // ------------------------------------------------------------------ consultas ------

  get posicao(): THREE.Vector3 {
    return this.raiz.position;
  }

  /** Alias de `posicao`. */
  get pos(): THREE.Vector3 {
    return this.raiz.position;
  }

  get visivel() {
    return this.raiz.visible && this.estado !== 'sumido';
  }

  /** Posição de um ponto acima da cabeça (marcadores, câmera). */
  topo(out = new THREE.Vector3()) {
    return out.copy(this.raiz.position).setY(this.raiz.position.y + this.info.altura * this.escala + 0.2);
  }

  /** Posição de mundo do osso da cabeça (o carneiro preso, a pomba). */
  posicaoCabeca(out = new THREE.Vector3()) {
    if (this.corpo.cabeca) return this.corpo.cabeca.getWorldPosition(out);
    return this.topo(out);
  }

  // ------------------------------------------------------------------ comandos -------

  private concluir() {
    const r = this.pendente;
    this.pendente = null;
    r?.();
  }

  private mudar(e: EstadoAnimal) {
    this.concluir();
    if (this.estado === 'voar' || this.estado === 'pousado') {
      if (e !== 'voar' && e !== 'pousado') this.aterrar();
    }
    this.estado = e;
    this.destino = null;
    this.pausa = 0;
    this.correndo = false;
  }

  parar() {
    this.mudar('parado');
    this.desejo.set(0, 0, 0);
  }

  /** Controle total por script (cinemáticas): use `teleportar` e `olharPara`. */
  emCena() {
    this.mudar('cena');
    this.desejo.set(0, 0, 0);
  }

  /** `vagar(raio)` em volta de onde está, ou `vagar(cx, cz, raio)`. */
  vagar(a?: number, b?: number, c?: number) {
    this.mudar('vagar');
    if (b === undefined) {
      this.centro.copy(this.raiz.position);
      this.raioVagar = a ?? 6;
    } else {
      this.centro.set(a ?? this.raiz.position.x, this.raiz.position.y, b);
      this.raioVagar = c ?? 6;
    }
    this.pausa = this.rnd.entre(0.2, 2);
  }

  seguir(alvo: { posicao: THREE.Vector3 }, distancia = 2.5) {
    this.mudar('seguir');
    this.alvoSeguir = alvo;
    this.distSeguir = distancia;
  }

  /** Anda até (x, z). Resolve ao chegar (ou se outro comando o interromper). */
  irPara(x: number, z: number, op: OpcoesIr = {}): Promise<void> {
    return this.irPor([[x, z]], op);
  }

  /** Anda por uma sequência de pontos [x, z] (ou Vector3). */
  irPor(pontos: ([number, number] | THREE.Vector3)[], op: OpcoesIr = {}): Promise<void> {
    this.mudar('ir');
    this.opIr = op;
    const pts = pontos.map((p) => (Array.isArray(p) ? new THREE.Vector3(p[0], 0, p[1]) : p.clone()));
    // caminho pela grade de navegação até o primeiro ponto, se houver obstáculos
    if (!op.direto && this.mundo.nav && pts.length) {
      const a = this.raiz.position;
      const nav = this.mundo.nav;
      if (!nav.visada(a.x, a.z, pts[0].x, pts[0].z)) {
        const c = nav.caminho(a.x, a.z, pts[0].x, pts[0].z);
        if (c && c.length > 1) pts.splice(0, 1, ...c.slice(1).map(([x, z]) => new THREE.Vector3(x, 0, z)));
      }
    }
    this.caminho = pts;
    this.semProgresso = 0;
    this.melhorDist = Infinity;
    return new Promise((r) => (this.pendente = r));
  }

  /** Anda pelos pontos (ex.: rampa → porta → interior da arca) e some com fade. */
  async entrar(pontos: ([number, number] | THREE.Vector3)[], op: OpcoesIr = {}): Promise<void> {
    await this.irPor(pontos, { direto: true, ...op });
    await this.sumir();
  }

  fugirDe(pos: THREE.Vector3, segundos = 3) {
    this.guardarAnterior();
    this.mudar('fugir');
    this.fugirDePos.copy(pos);
    this.fugirT = segundos;
  }

  /** Assustado: dispara, para e treme, berra. `raio` limita onde corre (baias: use ~1). */
  agitar(op: { raio?: number } = {}) {
    if (this.estado !== 'agitado') this.guardarAnterior();
    this.mudar('agitado');
    this.agitado = { raio: op.raio ?? 4, fase: 'tremer', t: this.rnd.entre(0.3, 1.2), ancora: this.raiz.position.clone() };
    this.tVoz = this.rnd.entre(0.2, 1.5);
  }

  get estaAgitado() {
    return this.estado === 'agitado';
  }

  /** Volta ao que fazia antes do susto (ou fica parado). */
  acalmar() {
    if (this.estado !== 'agitado' && this.estado !== 'fugir') return;
    const a = this.anterior;
    this.anterior = null;
    this.agitado = null;
    this.alarme = 0;
    if (!a || a.estado === 'agitado' || a.estado === 'fugir') return this.parar();
    if (a.estado === 'vagar') return this.vagar(a.centro.x, a.centro.z, a.raio);
    if (a.estado === 'seguir' && a.alvo) return this.seguir(a.alvo, a.dist);
    if (a.estado === 'rebanho') {
      this.mudar('rebanho');
      return;
    }
    this.parar();
  }

  /** Preso pelos chifres (Gn 22:13): fica no lugar e se debate de tempos em tempos. */
  prender() {
    this.mudar('preso');
  }

  soltar() {
    if (this.estado === 'preso') this.parar();
  }

  /** Vira-se para um ponto (parado ou em cena). */
  olharPara(p: THREE.Vector3 | null) {
    this.olharPos = p ? p.clone() : null;
  }

  teleportar(x: number, z: number, y?: number) {
    const ch = this.mundo.fisica.chao(x, z, (y ?? 1e5) + this.fisico.passo, this.fisico.raio).y;
    this.fisico.teleportar(x, y !== undefined && this.estado === 'pousado' ? y : ch, z);
    this.posicionar();
  }

  /** Voa até um alvo: `voarPara(x, y, z)` ou `voarPara(alvo, opts)`. Resolve ao pousar/chegar. */
  voarPara(a: AlvoVoo | number, b?: number | OpcoesVoo, c?: number, d?: OpcoesVoo): Promise<void> {
    if (typeof a === 'number') return this.voarPor([[a, b as number, c as number]], d ?? {});
    return this.voarPor([a], (b as OpcoesVoo) ?? {});
  }

  /** Voa passando por pontos; pousa no último (a menos que `pousar: false`). */
  voarPor(pontos: AlvoVoo[], op: OpcoesVoo = {}): Promise<void> {
    const ja = this.estado === 'voar';
    this.mudar('voar');
    this.voo = { pontos, i: 0, op, decolar: ja ? 0 : 0.6 };
    this.poleiro = null;
    this.fisico.fantasma = true;
    this.fisico.semGravidade = true;
    if (!ja) {
      this.velVoo.set(Math.sin(this.yaw) * 0.5, 2.4, Math.cos(this.yaw) * 0.5);
      Audio.efeito('asas', { pos: this.raiz.position });
    }
    return new Promise((r) => (this.pendente = r));
  }

  /** Pousa e fica preso a um alvo (ponto fixo, objeto ou função — ex.: a mão de um personagem). */
  pousarEm(alvo: AlvoVoo) {
    this.mudar('pousado');
    this.poleiro = alvo;
    this.fisico.fantasma = true;
    this.fisico.semGravidade = true;
  }

  /** Some com fade (fica invisível, mas continua existindo; `aparecer` traz de volta). */
  sumir(segundos = 1): Promise<void> {
    this.concluir();
    return new Promise((r) => {
      this.fade(0, segundos, () => {
        this.raiz.visible = false;
        this.estado = 'sumido';
        r();
      });
    });
  }

  /** Reaparece com fade (opcionalmente em outro lugar). */
  aparecer(x?: number, z?: number, segundos = 1) {
    if (x !== undefined && z !== undefined) this.teleportar(x, z);
    this.raiz.visible = true;
    if (this.estado === 'sumido') this.estado = 'parado';
    this.opacidade = Math.min(this.opacidade, 0.01);
    this.fade(1, segundos);
  }

  /** Tira o animal do mundo (com fade, por padrão). */
  async remover(suave = true): Promise<void> {
    if (suave && this.raiz.visible) await this.sumir(0.8);
    this.concluir();
    this.raiz.removeFromParent();
    this.mundo.atualizaveis?.delete(this);
    this.registrado = false;
    Animal.todos.delete(this);
    this.corpo.dispose();
  }

  /** Coloca o animal na cena e nos atualizáveis do mundo. */
  registrar(pai?: THREE.Object3D) {
    (pai ?? this.mundo.grupo)?.add(this.raiz);
    if (!this.registrado) this.mundo.atualizaveis?.add(this);
    this.registrado = true;
  }

  /** Emite a voz da espécie (posicional). */
  falar(volume = 1) {
    if (this.info.voz) Audio.efeito(this.info.voz, { pos: this.raiz.position, volume, sexo: this.sexo });
  }

  private guardarAnterior() {
    if (this.estado === 'agitado' || this.estado === 'fugir') return;
    this.anterior = {
      estado: this.estado, alvo: this.alvoSeguir, dist: this.distSeguir, raio: this.raioVagar, centro: this.centro.clone(),
    };
  }

  private fade(alvo: number, segundos: number, fim?: () => void) {
    this.fadeAlvo = alvo;
    this.fadeVel = 1 / Math.max(0.05, segundos);
    this.aoSumir = fim ?? null;
    if (!this.materialFade) {
      const m = this.materialBase.clone();
      m.transparent = true;
      aplicarPatch(m, { revelar: true });
      this.materialFade = m;
    }
    this.corpo.definirMaterial(this.materialFade);
  }

  private aterrar() {
    this.voo = null;
    this.poleiro = null;
    this.fisico.fantasma = false;
    this.fisico.semGravidade = false;
    this.fisico.vel.set(0, 0, 0);
    this.velVoo.set(0, 0, 0);
  }

  // ------------------------------------------------------------------ quadro ---------

  atualizar(dt: number, _t?: number) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.atualizarFade(dt);
    if (this.estado === 'sumido') return;
    const p = this.pose;
    p.pastar = 0;
    p.lutar = 0;
    p.voo = 0;
    p.planar = 0;
    let alvoAgit = 0;

    switch (this.estado) {
      case 'parado': this.compParado(dt); break;
      case 'vagar': this.compVagar(dt); break;
      case 'seguir': this.compSeguir(dt); break;
      case 'ir': this.compIr(dt); break;
      case 'fugir': this.compFugir(dt); break;
      case 'agitado': alvoAgit = 1; this.compAgitado(dt); break;
      case 'rebanho': this.compRebanho(dt); break;
      case 'preso': this.compPreso(); break;
      case 'cena': this.desejo.set(0, 0, 0); break;
      case 'voar': this.compVoar(dt); break;
      case 'pousado': this.compPousado(dt); break;
    }
    this.agit = damp(this.agit, Math.max(alvoAgit, this.alarme * 0.6), 4, dt);
    p.agitacao = this.agit;

    if (this.estado !== 'voar' && this.estado !== 'pousado') this.moverChao(dt);
    this.posicionar();
    this.vozes(dt);
    this.animar(dt);
  }

  private atualizarFade(dt: number) {
    if (!this.materialFade) return;
    this.opacidade = clamp(this.opacidade + Math.sign(this.fadeAlvo - this.opacidade) * this.fadeVel * dt, 0, 1);
    this.materialFade.opacity = this.opacidade;
    if (Math.abs(this.opacidade - this.fadeAlvo) < 1e-3) {
      const fim = this.aoSumir;
      this.aoSumir = null;
      if (this.fadeAlvo >= 1) {
        this.corpo.definirMaterial(this.materialBase);
        this.materialFade.dispose();
        this.materialFade = null;
      }
      fim?.();
    }
  }

  private velAndar() {
    return this.info.velAndar * Math.sqrt(this.escala);
  }

  private velCorrer() {
    return this.info.velCorrer * Math.sqrt(this.escala);
  }

  private ocioso(dt: number) {
    // pastar e olhar em volta de vez em quando
    this.pastarT -= dt;
    this.olharT -= dt;
    if (this.pastarT < -this.rnd.entre(2, 5)) this.pastarT = this.rnd.entre(2, 6);
    if (this.info.pastar && this.pastarT > 0) this.pose.pastar = 1;
    if (this.olharT < 0) {
      this.olharT = this.rnd.entre(1.5, 4);
      this.pose.olhar = this.rnd.chance(0.5) ? 0 : this.rnd.entre(-0.7, 0.7);
    }
  }

  private compParado(dt: number) {
    this.desejo.set(0, 0, 0);
    if (this.olharPos) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.olharPos.x - this.raiz.position.x, this.olharPos.z - this.raiz.position.z), 3, dt);
      this.pose.olhar = 0;
    } else this.ocioso(dt);
  }

  private compVagar(dt: number) {
    if (this.pausa > 0) {
      this.pausa -= dt;
      this.desejo.set(0, 0, 0);
      this.ocioso(dt);
      return;
    }
    if (!this.destino) {
      // escolhe um ponto livre dentro do raio
      for (let k = 0; k < 6; k++) {
        const a = this.rnd.entre(0, Math.PI * 2);
        const r = Math.sqrt(this.rnd.proximo()) * this.raioVagar;
        const x = this.centro.x + Math.cos(a) * r;
        const z = this.centro.z + Math.sin(a) * r;
        if (this.mundo.fisica.profundidade(x, z) > 0.2) continue;
        this.destino = new THREE.Vector3(x, 0, z);
        break;
      }
      this.semProgresso = 0;
      this.melhorDist = Infinity;
      if (!this.destino) {
        this.pausa = 1;
        return;
      }
    }
    const d = this.rumo(this.destino, this.velAndar() * 0.7, 0.5);
    if (d < 0.5 || this.travado(d, dt, 4)) {
      this.destino = null;
      this.pausa = this.rnd.entre(2, 7);
    }
    this.pose.olhar = 0;
  }

  private compSeguir(dt: number) {
    const a = this.alvoSeguir;
    if (!a) return this.desejo.set(0, 0, 0);
    const pos = this.raiz.position;
    const d = Math.hypot(a.posicao.x - pos.x, a.posicao.z - pos.z);
    if (d > this.distSeguir + 0.35) {
      const extra = d - this.distSeguir;
      const v = Math.min(this.velCorrer(), this.velAndar() * (0.8 + extra * 0.45));
      this.correndo = extra > 4;
      this.rumo(a.posicao, v, 0);
    } else {
      this.desejo.set(0, 0, 0);
      this.correndo = false;
      if (d > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(a.posicao.x - pos.x, a.posicao.z - pos.z), 2, dt);
    }
  }

  private compIr(dt: number) {
    const alvo = this.caminho[0];
    if (!alvo) {
      this.desejo.set(0, 0, 0);
      this.estado = 'parado';
      this.concluir();
      return;
    }
    const ultimo = this.caminho.length === 1;
    const raio = ultimo ? this.opIr.raio ?? 0.4 : 0.9;
    const v = this.opIr.velocidade ?? (this.opIr.correr ? this.velCorrer() : this.velAndar());
    this.correndo = !!this.opIr.correr;
    const d = this.rumo(alvo, ultimo ? Math.min(v, Math.max(0.35, d0(this.raiz.position, alvo) * 1.5)) : v, 0);
    if (d < raio) {
      this.caminho.shift();
      this.semProgresso = 0;
      this.melhorDist = Infinity;
      if (!this.caminho.length) {
        this.desejo.set(0, 0, 0);
        this.estado = 'parado';
        this.concluir();
      }
      return;
    }
    // preso atrás de algo: fora da tela, reposiciona; na tela, tenta a navegação
    if (this.travado(d, dt, 5)) {
      const fora = performance.now() - this.vistoEm > 1000;
      if (fora) {
        this.teleportar(alvo.x, alvo.z, this.raiz.position.y);
      } else if (this.mundo.nav && !this.opIr.direto) {
        const c = this.mundo.nav.caminho(this.raiz.position.x, this.raiz.position.z, alvo.x, alvo.z);
        if (c && c.length > 1) this.caminho.splice(0, 1, ...c.slice(1).map(([x, z]) => new THREE.Vector3(x, 0, z)));
      }
      this.semProgresso = 0;
      this.melhorDist = Infinity;
    }
  }

  private compFugir(dt: number) {
    this.fugirT -= dt;
    const pos = this.raiz.position;
    _v.set(pos.x - this.fugirDePos.x, 0, pos.z - this.fugirDePos.z);
    if (_v.lengthSq() < 1e-4) _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    _v.normalize().multiplyScalar(this.velCorrer());
    this.desejo.copy(_v);
    this.correndo = true;
    this.alarme = 1;
    if (this.fugirT <= 0) {
      this.alarme = 0;
      this.acalmar();
    }
  }

  private compAgitado(dt: number) {
    const ag = this.agitado!;
    ag.t -= dt;
    const pos = this.raiz.position;
    if (ag.fase === 'tremer') {
      this.desejo.set(0, 0, 0);
      this.correndo = false;
      // vira a cabeça de um lado para outro, às vezes dá meia-volta
      if (this.rnd.chance(dt * 0.8)) this.yaw += this.rnd.entre(-1.2, 1.2);
      if (ag.t <= 0) {
        ag.fase = 'disparar';
        ag.t = this.rnd.entre(0.6, 1.4) * (ag.raio < 1.5 ? 0.5 : 1);
        const a = this.rnd.entre(0, Math.PI * 2);
        const r = this.rnd.entre(0.4, 1) * ag.raio;
        this.destino = new THREE.Vector3(ag.ancora.x + Math.cos(a) * r, 0, ag.ancora.z + Math.sin(a) * r);
      }
    } else {
      const v = ag.raio < 1.5 ? this.velAndar() * 1.2 : this.velCorrer() * 0.75;
      this.correndo = ag.raio >= 1.5;
      const d = this.destino ? this.rumo(this.destino, v, 0.2) : 0;
      if (ag.t <= 0 || d < 0.3) {
        ag.fase = 'tremer';
        ag.t = this.rnd.entre(1.2, 3);
      }
    }
    // não se afasta demais da âncora
    if (pos.distanceTo(ag.ancora) > ag.raio + 2) this.destino = ag.ancora.clone();
  }

  private compRebanho(dt: number) {
    // o Rebanho escreve `desejo` e `alarme`; aqui só o comportamento ocioso
    const v = this.desejo.length();
    this.correndo = v > this.velAndar() * 1.6;
    if (v < 0.12) this.ocioso(dt);
    else this.pose.olhar = 0;
  }

  private compPreso() {
    this.desejo.set(0, 0, 0);
    const ciclo = (this.t * 0.35) % 1;
    this.pose.lutar = ciclo < 0.35 ? 1 : 0.15;
    this.tVoz = Math.min(this.tVoz, 99);
  }

  /** Vira e anda em direção a um ponto; devolve a distância horizontal. */
  private rumo(alvo: THREE.Vector3, vel: number, frear: number): number {
    const pos = this.raiz.position;
    _v.set(alvo.x - pos.x, 0, alvo.z - pos.z);
    const d = _v.length();
    if (d < 1e-4) {
      this.desejo.set(0, 0, 0);
      return 0;
    }
    const v = frear > 0 ? Math.min(vel, Math.max(0.3, d / frear) * vel) : vel;
    this.desejo.copy(_v.multiplyScalar(v / d));
    return d;
  }

  /** Detecta falta de progresso até o destino por `limite` segundos. */
  private travado(d: number, dt: number, limite: number): boolean {
    if (d < this.melhorDist - 0.2) {
      this.melhorDist = d;
      this.semProgresso = 0;
      return false;
    }
    this.semProgresso += dt;
    return this.semProgresso > limite;
  }

  // ------------------------------------------------------------------ física ---------

  private moverChao(dt: number) {
    const f = this.fisico;
    const m = this.mundo.fisica;
    const pos = f.pos;
    let vx = this.desejo.x;
    let vz = this.desejo.z;
    const vel = Math.hypot(vx, vz);
    // separação dos outros animais
    if (this.estado !== 'cena' && this.estado !== 'preso') {
      for (const o of Animal.todos) {
        if (o === this || o.estado === 'voar' || o.estado === 'pousado' || o.estado === 'sumido' || !o.raiz.visible) continue;
        const dx = pos.x - o.fisico.pos.x;
        const dz = pos.z - o.fisico.pos.z;
        if (Math.abs(dx) > 4 || Math.abs(dz) > 4 || Math.abs(pos.y - o.fisico.pos.y) > 1.5) continue;
        const min = (f.raio + o.fisico.raio) * 1.15;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const k = (min - d) / min;
        vx += (dx / d) * k * 2.2;
        vz += (dz / d) * k * 2.2;
      }
    }
    // desvio de obstáculos e água funda à frente
    if (vel > 0.05) {
      this.tDesvio -= dt;
      if (this.tDesvio <= 0) {
        this.tDesvio = 0.25;
        this.desvio = 0;
        const dir = Math.atan2(vx, vz);
        const alcance = f.raio + 0.6 + vel * 0.3;
        for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
          const x = pos.x + Math.sin(dir + a) * alcance;
          const z = pos.z + Math.cos(dir + a) * alcance;
          if (m.profundidade(x, z) > m.profundidadeMax * 0.6) continue;
          if (!m.livre(x, z, pos.y, f.raio * 0.9, Math.min(1.2, f.altura))) continue;
          this.desvio = a;
          break;
        }
      }
      if (this.desvio !== 0) {
        const c = Math.cos(this.desvio);
        const s = Math.sin(this.desvio);
        const nx = vx * c + vz * s;
        const nz = -vx * s + vz * c;
        vx = nx;
        vz = nz;
      }
    }
    f.mover(m, dt, vx, vz, this.correndo ? 6 : 4);
    const vh = Math.hypot(f.vel.x, f.vel.z);
    this.pose.vel = vh;
    this.pose.correr = damp(this.pose.correr, this.correndo || vh > this.velAndar() * 1.8 ? 1 : 0, 4, dt);
    if (vh > 0.08 && Math.hypot(vx, vz) > 0.05) {
      const alvo = Math.atan2(f.vel.x, f.vel.z);
      this.yaw = dampAngle(this.yaw, alvo, this.info.voa ? 10 : 5, dt);
    }
    // inclinação no relevo (só quadrúpedes grandes)
    if (!this.info.voa) {
      const L = Math.max(0.4, f.raio * 2.4);
      const fx = Math.sin(this.yaw) * L * 0.5;
      const fz = Math.cos(this.yaw) * L * 0.5;
      const yMax = pos.y + f.passo;
      const hF = m.chao(pos.x + fx, pos.z + fz, yMax, 0.05).y;
      const hT = m.chao(pos.x - fx, pos.z - fz, yMax, 0.05).y;
      this.pitch = damp(this.pitch, clamp(-Math.atan2(hF - hT, L), -0.45, 0.45), 6, dt);
    }
    this.roll = damp(this.roll, 0, 4, dt);
  }

  private compVoar(dt: number) {
    const v = this.voo;
    if (!v) return;
    const pos = this.fisico.pos;
    const op = v.op;
    const ultimo = v.i >= v.pontos.length - 1;
    const pousar = (op.pousar ?? true) && ultimo;
    const alvo = resolverAlvo(v.pontos[v.i], _w);
    const dx = alvo.x - pos.x;
    const dz = alvo.z - pos.z;
    const dh = Math.hypot(dx, dz);
    const vmax = op.velocidade ?? this.velCorrer();
    const altura = op.altura ?? 6;
    const chao = this.mundo.fisica.relevo.altura(pos.x, pos.z);
    // ponto de mira: acima do alvo enquanto longe; desce na aproximação
    _p.copy(alvo);
    if (pousar) {
      const subir = clamp((dh - 1.2) * 0.45, 0, altura);
      _p.y = Math.max(alvo.y + subir, Math.min(alvo.y, chao) + (dh > 3 ? 1.5 : 0));
    } else if (!ultimo) {
      _p.y = Math.max(alvo.y, chao + 2);
    }
    if (v.decolar > 0) {
      v.decolar -= dt;
      _p.y = pos.y + 3;
    }
    _v.subVectors(_p, pos);
    const d3 = _v.length();
    let vel = vmax;
    if (pousar) vel = clamp(d3 * 1.6, 0.6, vmax);
    if (d3 > 1e-4) _v.multiplyScalar(vel / d3);
    this.velVoo.x = damp(this.velVoo.x, _v.x, pousar && dh < 2 ? 6 : 2.6, dt);
    this.velVoo.y = damp(this.velVoo.y, _v.y, 3, dt);
    this.velVoo.z = damp(this.velVoo.z, _v.z, pousar && dh < 2 ? 6 : 2.6, dt);
    pos.addScaledVector(this.velVoo, dt);
    if (!(pousar && dh < 1.5)) pos.y = Math.max(pos.y, chao + 0.4);
    // orientação: rumo, arfagem e inclinação na curva
    const vh = Math.hypot(this.velVoo.x, this.velVoo.z);
    if (vh > 0.2) {
      const novo = Math.atan2(this.velVoo.x, this.velVoo.z);
      const giro = wrapAngle(novo - this.yaw);
      this.yaw = dampAngle(this.yaw, novo, 5, dt);
      this.roll = damp(this.roll, clamp(-giro * 1.5, -0.6, 0.6), 4, dt);
    }
    this.pitch = damp(this.pitch, clamp(-Math.atan2(this.velVoo.y, Math.max(0.5, vh)) * 0.6, -0.5, 0.5), 4, dt);
    // asas: bate subindo/devagar, plana descendo rápido
    const plana = this.velVoo.y < -0.6 && vh > 2.5;
    this.pose.voo = plana ? 0.15 : 1;
    this.pose.planar = plana ? 1 : 0;
    this.pose.vel = 0;
    if (pousar && d3 < 0.6) this.pose.planar = 1;
    // chegada
    if (pousar && d3 < 0.08) {
      const alvoFinal = v.pontos[v.i];
      this.voo = null;
      this.pitch = 0;
      this.roll = 0;
      this.poleiro = alvoFinal;
      this.estado = 'pousado';
      if (this.especie === 'pomba') Audio.efeito('pomba', { pos });
      this.concluir();
      return;
    }
    if (!pousar && d3 < 1.2) {
      if (!ultimo) v.i++;
      else if (op.sumir) {
        this.voo = { pontos: [_w.clone().add(_v.set(Math.sin(this.yaw) * 30, 4, Math.cos(this.yaw) * 30))], i: 0, op: { pousar: false }, decolar: 0 };
        this.sumir(1.5).then(() => this.aterrar());
        const r = this.pendente;
        this.pendente = null;
        r?.();
      } else {
        // fica circulando em volta do último ponto
        const c = alvo.clone();
        const a = this.t * 0.5;
        v.pontos = [new THREE.Vector3(c.x + Math.cos(a) * 4, c.y, c.z + Math.sin(a) * 4), c];
        v.i = 0;
        const r = this.pendente;
        this.pendente = null;
        r?.();
      }
    }
  }

  private compPousado(dt: number) {
    this.desejo.set(0, 0, 0);
    if (this.poleiro) resolverAlvo(this.poleiro, this.fisico.pos);
    this.pitch = damp(this.pitch, 0, 6, dt);
    this.roll = damp(this.roll, 0, 6, dt);
    this.pose.vel = 0;
    this.pose.voo = 0;
    this.pose.planar = 0;
    this.ocioso(dt);
    if (this.olharPos) this.yaw = dampAngle(this.yaw, Math.atan2(this.olharPos.x - this.fisico.pos.x, this.olharPos.z - this.fisico.pos.z), 3, dt);
  }

  private posicionar() {
    this.raiz.position.copy(this.fisico.pos);
    this.raiz.rotation.set(this.pitch, this.yaw, this.roll);
  }

  private vozes(dt: number) {
    if (!this.info.voz) return;
    if (this.estado === 'agitado' || this.estado === 'preso' || this.alarme > 0.6) {
      this.tVoz -= dt;
      if (this.tVoz <= 0) {
        this.tVoz = this.rnd.entre(2.5, 6);
        this.falar(this.estado === 'agitado' ? 1 : 0.7);
      }
    }
  }

  private animar(dt: number) {
    this.pose.t = this.t;
    this.acumulado += dt;
    const cam = Animal.camera ?? cameraVista;
    let dist = 0;
    if (cam) dist = cam.position.distanceTo(this.raiz.position);
    const visto = !cam || performance.now() - this.vistoEm < 400;
    const animar = dist < 14 || (visto && dist < Animal.distanciaAnimar);
    if (!animar) {
      this.acumulado = Math.min(this.acumulado, 0.25);
      return;
    }
    const intervalo = dist < 30 ? 0 : dist < 50 ? 1 / 24 : 1 / 12;
    if (this.acumulado < intervalo) return;
    this.corpo.atualizar(this.acumulado, this.pose);
    this.acumulado = 0;
  }
}

function d0(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Cria (carregando o modelo, se preciso) um animal no mundo. */
export async function criarAnimal(especie: Especie, mundo: MundoAnimais, x: number, z: number, op: OpcoesAnimal = {}): Promise<Animal> {
  const info = infoEspecie(especie);
  const sexo = op.sexo ?? 'macho';
  const semente = op.semente ?? Math.floor(Math.random() * 1e6);
  let corpo: CorpoAnimal;
  if (info.glb) {
    const ativos = op.ativos ?? (ativosPadrao ??= new Ativos());
    const molde = await carregarMoldeGLB(ativos.carregar(info.glb.arquivo), info.glb);
    corpo = new CorpoGLB(molde, info.glb, semente);
  } else {
    const nome = info.procedural!;
    const molde = moldeProcedural(`${nome}|${sexo}`, () => PROCEDURAIS[nome](sexo));
    corpo = new CorpoProcedural(molde, semente);
  }
  const a = new Animal(especie, corpo, mundo, x, z, { ...op, sexo, semente });
  if (op.registrar ?? true) a.registrar(op.pai);
  return a;
}

/** Cria um par (macho e fêmea, Gn 7:9) lado a lado; a fêmea segue o macho. */
export async function criarPar(especie: Especie, mundo: MundoAnimais, x: number, z: number, op: OpcoesAnimal = {}): Promise<[Animal, Animal]> {
  const info = infoEspecie(especie);
  const lado = info.raio * 2.6 + 0.3;
  const yaw = op.yaw ?? 0;
  const [macho, femea] = await Promise.all([
    criarAnimal(especie, mundo, x + Math.cos(yaw) * lado * 0.5, z - Math.sin(yaw) * lado * 0.5, { ...op, sexo: 'macho', yaw }),
    criarAnimal(especie, mundo, x - Math.cos(yaw) * lado * 0.5, z + Math.sin(yaw) * lado * 0.5, { ...op, sexo: 'femea', yaw }),
  ]);
  femea.seguir(macho, lado + info.raio);
  return [macho, femea];
}

/** Pré-carrega modelos glTF de algumas espécies (evita engasgo na primeira aparição). */
export async function precarregarAnimais(especies: Especie[], ativos?: Ativos) {
  const at = ativos ?? (ativosPadrao ??= new Ativos());
  await Promise.all(especies.map((e) => {
    const i = ESPECIES[e];
    if (i.glb) return carregarMoldeGLB(at.carregar(i.glb.arquivo), i.glb);
    const n = i.procedural!;
    moldeProcedural(`${n}|macho`, () => PROCEDURAIS[n]('macho'));
    moldeProcedural(`${n}|femea`, () => PROCEDURAIS[n]('femea'));
    return null;
  }));
}
