import * as THREE from 'three';
import type { CorpoBase } from './CorpoBase';

/** Nomes amigáveis → clipes da Universal Animation Library. */
export const CLIPES = {
  parado: 'Idle_Loop',
  andar: 'Walk_Loop',
  trotar: 'Jog_Fwd_Loop',
  correr: 'Sprint_Loop',
  pularInicio: 'Jump_Start',
  pularAr: 'Jump_Loop',
  pularFim: 'Jump_Land',
  agachado: 'Crouch_Idle_Loop',
  agachadoAndar: 'Crouch_Fwd_Loop',
  interagir: 'Interact',
  pegar: 'PickUp_Table',
  empurrar: 'Push_Loop',
  consertar: 'Fixing_Kneeling',
  sentar: 'Sitting_Enter',
  sentado: 'Sitting_Idle_Loop',
  levantar: 'Sitting_Exit',
  sentadoFalar: 'Sitting_Talking_Loop',
  falar: 'Idle_Talking_Loop',
  tocha: 'Idle_Torch_Loop',
  espada: 'Sword_Idle',
  atacar: 'Sword_Attack',
  golpe: 'Sword_Regular_A',
  atingido: 'Hit_Chest',
  derrubado: 'Hit_Knockback',
  rolar: 'Roll',
  andarSolene: 'Walk_Formal_Loop',
  alegria: 'Dance_Loop',
  estenderMao: 'Spell_Simple_Idle_Loop',
  estenderMaoInicio: 'Spell_Simple_Enter',
  gesto: 'Spell_Simple_Shoot',
  nadar: 'Swim_Fwd_Loop',
  nadarParado: 'Swim_Idle_Loop',
  carregar: 'Walk_Carry_Loop',
  cortar: 'TreeChopping_Loop',
  colher: 'Farm_Harvest',
  plantar: 'Farm_PlantSeed',
  regar: 'Farm_Watering',
  escalar: 'ClimbUp_1m_RM',
  comer: 'Consume',
  abrir: 'Chest_Open',
  bracosCruzados: 'Idle_FoldArms_Loop',
  lanterna: 'Idle_Lantern_Loop',
  escudo: 'Idle_Shield_Loop',
  bloquear: 'Sword_Block',
  escudoGolpe: 'Shield_OneShot',
  arremessar: 'OverhandThrow',
  sim: 'Yes',
  nao: 'Idle_No_Loop',
  levantarDoChao: 'LayToIdle',
  segurar: 'Idle_Rail_Loop',
  chamar: 'Idle_Rail_Call',
} as const;
export type NomeClipe = keyof typeof CLIPES;

const VEL_NATURAL: Partial<Record<NomeClipe, number>> = { andar: 1.45, trotar: 3.4, correr: 5.8, agachadoAndar: 1.4, nadar: 1.5, andarSolene: 1.3 };
const UMA_VEZ = new Set<NomeClipe>(['pularInicio', 'pularFim', 'interagir', 'pegar', 'sentar', 'levantar', 'atacar', 'golpe', 'atingido', 'derrubado', 'rolar', 'gesto', 'estenderMaoInicio', 'colher', 'plantar', 'regar', 'escalar', 'comer', 'abrir', 'bloquear', 'escudoGolpe', 'arremessar', 'sim', 'levantarDoChao', 'chamar']);

interface Pedido {
  inf: NomeClipe;
  sup: NomeClipe;
  velInf: number;
  velSup: number;
}

/**
 * Controla o AnimationMixer em duas camadas (pernas e tronco) para combinar locomoção com
 * atividades: andar carregando, andar com tocha, etc. Faz transições suaves entre estados.
 */
export class Animador {
  readonly mixer: THREE.AnimationMixer;
  private base: CorpoBase;
  private inf = new Map<NomeClipe, THREE.AnimationAction>();
  private sup = new Map<NomeClipe, THREE.AnimationAction>();
  private atualInf: NomeClipe | null = null;
  private atualSup: NomeClipe | null = null;
  /** Atividade de corpo inteiro em laço (cortar, consertar, segurar...). */
  atividade: NomeClipe | null = null;
  /** Só o tronco (carregar, tocha, lanterna...), as pernas seguem a locomoção. */
  superior: NomeClipe | null = null;
  private umaVez: { clipe: NomeClipe; corpo: 'todo' | 'superior'; fim: number; resolver: () => void; vel: number } | null = null;
  velocidade = 0;
  noChao = true;
  agachado = false;
  nadando = false;
  private tempo = 0;
  private transicao = 0.22;

  constructor(raiz: THREE.Object3D, base: CorpoBase) {
    this.mixer = new THREE.AnimationMixer(raiz);
    this.base = base;
  }

  private acao(mapa: Map<NomeClipe, THREE.AnimationAction>, nome: NomeClipe, parte: 'inf' | 'sup') {
    let a = mapa.get(nome);
    if (!a) {
      const fonte = parte === 'inf' ? this.base.clipsInferiores : this.base.clipsSuperiores;
      const clip = fonte.get(CLIPES[nome]);
      if (!clip) throw new Error(`Clipe ausente: ${CLIPES[nome]}`);
      a = this.mixer.clipAction(clip);
      if (UMA_VEZ.has(nome)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      mapa.set(nome, a);
    }
    return a;
  }

  /** Toca um clipe uma vez (corpo todo ou só o tronco). Resolve ao terminar. */
  tocar(nome: NomeClipe, corpo: 'todo' | 'superior' = 'todo', vel = 1): Promise<void> {
    this.umaVez?.resolver();
    const clip = this.base.clipsCompletos.get(CLIPES[nome]);
    const dur = (clip?.duration ?? 1) / vel;
    return new Promise((resolve) => {
      this.umaVez = { clipe: nome, corpo, fim: this.tempo + dur * 0.97, resolver: resolve, vel };
      const a = this.acao(this.sup, nome, 'sup');
      a.reset();
      if (corpo === 'todo') this.acao(this.inf, nome, 'inf').reset();
    });
  }

  cancelarUmaVez() {
    if (this.umaVez) {
      const r = this.umaVez.resolver;
      this.umaVez = null;
      r();
    }
  }

  get ocupado() {
    return !!this.umaVez;
  }

  private locomocao(): { clipe: NomeClipe; vel: number } {
    const v = this.velocidade;
    if (this.nadando) return v > 0.3 ? { clipe: 'nadar', vel: v / VEL_NATURAL.nadar! } : { clipe: 'nadarParado', vel: 1 };
    if (!this.noChao) return { clipe: 'pularAr', vel: 1 };
    if (this.agachado) return v > 0.25 ? { clipe: 'agachadoAndar', vel: v / VEL_NATURAL.agachadoAndar! } : { clipe: 'agachado', vel: 1 };
    if (v < 0.2) return { clipe: 'parado', vel: 1 };
    if (v < 2.2) return { clipe: 'andar', vel: Math.max(0.5, v / VEL_NATURAL.andar!) };
    if (v < 4.6) return { clipe: 'trotar', vel: v / VEL_NATURAL.trotar! };
    return { clipe: 'correr', vel: v / VEL_NATURAL.correr! };
  }

  atualizar(dt: number) {
    this.tempo += dt;
    if (this.umaVez && this.tempo >= this.umaVez.fim) {
      const r = this.umaVez.resolver;
      this.umaVez = null;
      r();
    }
    const loc = this.locomocao();
    const p: Pedido = { inf: loc.clipe, sup: loc.clipe, velInf: loc.vel, velSup: loc.vel };
    if (this.atividade) {
      p.inf = p.sup = this.atividade;
      p.velInf = p.velSup = 1;
    }
    if (this.superior && !this.atividade) {
      p.sup = this.superior;
      p.velSup = 1;
    }
    if (this.umaVez) {
      p.sup = this.umaVez.clipe;
      p.velSup = this.umaVez.vel;
      if (this.umaVez.corpo === 'todo') {
        p.inf = this.umaVez.clipe;
        p.velInf = this.umaVez.vel;
      }
    }
    this.aplicar(p);
    this.mixer.update(dt);
  }

  private aplicar(p: Pedido) {
    if (p.inf !== this.atualInf) {
      const nova = this.acao(this.inf, p.inf, 'inf');
      const velha = this.atualInf ? this.inf.get(this.atualInf) : null;
      if (!UMA_VEZ.has(p.inf) || nova.time === 0 || !nova.isRunning()) nova.reset();
      nova.play();
      if (velha) velha.crossFadeTo(nova, this.transicao, false);
      this.atualInf = p.inf;
    }
    if (p.sup !== this.atualSup) {
      const nova = this.acao(this.sup, p.sup, 'sup');
      const velha = this.atualSup ? this.sup.get(this.atualSup) : null;
      if (!UMA_VEZ.has(p.sup) || nova.time === 0 || !nova.isRunning()) nova.reset();
      nova.play();
      if (velha) velha.crossFadeTo(nova, this.transicao, false);
      this.atualSup = p.sup;
    }
    const ai = this.inf.get(p.inf);
    const as = this.sup.get(p.sup);
    if (ai) ai.timeScale = p.velInf;
    if (as) as.timeScale = p.velSup;
    // mantém pernas e tronco da mesma locomoção em fase
    if (ai && as && p.inf === p.sup && Math.abs(ai.time - as.time) > 0.05 && !UMA_VEZ.has(p.inf)) as.time = ai.time;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
