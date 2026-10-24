import * as THREE from 'three';
import { clamp, damp, lerp } from '../../core/util';

/** Estado visual pedido pelo Animal ao corpo a cada quadro. */
export interface PoseAnimal {
  /** Velocidade horizontal (m/s). */
  vel: number;
  /** 0..1: mistura entre andar e correr. */
  correr: number;
  /** 0..1: medo (tremor, cabeça alta, cauda agitada). */
  agitacao: number;
  /** 0..1: batendo as asas (aves) / no ar. */
  voo: number;
  /** 0..1: asas abertas sem bater (planando, pousando). */
  planar: number;
  /** 0..1: cabeça baixa pastando (ou bicando, nas aves). */
  pastar: number;
  /** Giro da cabeça em relação ao corpo (rad). */
  olhar: number;
  /** 0..1: debatendo-se (o carneiro preso pelos chifres). */
  lutar: number;
  /** Tempo corrido (s). */
  t: number;
}

export function poseVazia(): PoseAnimal {
  return { vel: 0, correr: 0, agitacao: 0, voo: 0, planar: 0, pastar: 0, olhar: 0, lutar: 0, t: 0 };
}

export interface PernaMarcha {
  coxa: string;
  canela?: string;
  /** Fase (0..1) no passo de andar e de correr. */
  fase: number;
  faseCorrida: number;
  /** Sinal do joelho (+1 dobra para trás; -1 para frente, ex.: aves). */
  joelho?: number;
}

/** Como um esqueleto anda: pernas, fases, amplitudes e os ossos que balançam. */
export interface DefMarcha {
  pernas: PernaMarcha[];
  /** Metros por ciclo andando / correndo. */
  passada: number;
  passadaCorrida: number;
  /** Amplitude da coxa (rad) andando / correndo. */
  amplitude: number;
  amplitudeCorrida: number;
  /** Dobra do joelho na fase de balanço (rad). */
  joelho: number;
  /** Velocidade de referência para amplitude cheia (m/s). */
  velRef: number;
  corpo: string;
  /** Altura do quique do corpo (m) a cada passo. */
  quique?: number;
  /** Rolagem lateral do corpo (gingado de pato/urso), rad. */
  gingado?: number;
  pescoco?: string[];
  cabeca?: string;
  /** Inclinação total do pescoço ao pastar (rad, positiva = abaixa). */
  pastarAngulo?: number;
  cauda?: string[];
  /** Eixo do balanço da cauda: 'y' (lado a lado) ou 'x' (cima/baixo). */
  caudaEixo?: 'x' | 'y';
  orelhas?: [string, string];
  /** Abanar de orelhas grandes (elefante). */
  orelhasAbanar?: number;
  tromba?: string[];
  /** Asas [esquerda, direita] das aves. */
  asas?: [string, string];
  /** Frequência das batidas (Hz) e amplitude (rad). */
  asaFreq?: number;
  asaAmp?: number;
  /** Ângulo das asas fechadas junto ao corpo (rad, em torno de Y). */
  asaFechada?: number;
  /** Pernas recolhidas no voo (rad). */
  pernasVoo?: number;
}

/**
 * Uma junta controlada pela marcha. Nos esqueletos procedurais o repouso é a identidade e os
 * ângulos são aplicados direto; nos modelos glTF (ovelha, porco, lhama) os ângulos giram em
 * torno dos eixos do MODELO, depois do mixer ter aplicado o clipe Idle.
 */
export interface Articulacao {
  osso: THREE.Object3D;
  aplicar(ax: number, ay: number, az: number): void;
  deslocar?(dx: number, dy: number, dz: number): void;
}

export function articulacaoDireta(osso: THREE.Object3D): Articulacao {
  const base = osso.position.clone();
  return {
    osso,
    aplicar(ax, ay, az) {
      osso.rotation.set(ax, ay, az);
    },
    deslocar(dx, dy, dz) {
      osso.position.set(base.x + dx, base.y + dy, base.z + dz);
    },
  };
}

const _q = new THREE.Quaternion();
const _qx = new THREE.Quaternion();

/**
 * Junta sobre um osso glTF: calcula, na pose de repouso, os eixos X/Y/Z do modelo no espaço
 * local do osso. A rotação é pós-multiplicada à que o mixer acabou de escrever.
 */
export function articulacaoModelo(osso: THREE.Object3D, raizModelo: THREE.Object3D): Articulacao {
  raizModelo.updateMatrixWorld(true);
  const qOsso = osso.getWorldQuaternion(new THREE.Quaternion());
  const qRaiz = raizModelo.getWorldQuaternion(new THREE.Quaternion());
  // rotação do osso relativa à raiz do modelo
  const rel = qRaiz.clone().invert().multiply(qOsso);
  const inv = rel.clone().invert();
  const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(inv);
  const ey = new THREE.Vector3(0, 1, 0).applyQuaternion(inv);
  const ez = new THREE.Vector3(0, 0, 1).applyQuaternion(inv);
  return {
    osso,
    aplicar(ax, ay, az) {
      if (ax === 0 && ay === 0 && az === 0) return;
      _q.identity();
      if (ay) _q.multiply(_qx.setFromAxisAngle(ey, ay));
      if (ax) _q.multiply(_qx.setFromAxisAngle(ex, ax));
      if (az) _q.multiply(_qx.setFromAxisAngle(ez, az));
      osso.quaternion.multiply(_q);
    },
  };
}

const TAU = Math.PI * 2;

/** Ciclo de andar procedural: pernas, quique, cabeça, cauda, orelhas, tromba e asas. */
export class Marcha {
  readonly def: DefMarcha;
  private j: (nome: string | undefined) => Articulacao | null;
  fase = 0;
  private amp = 0;
  private corrida = 0;
  private voo = 0;
  private abrir = 0;
  private pastar = 0;
  private olhar = 0;
  private agit = 0;
  private semente: number;

  constructor(def: DefMarcha, juntas: Map<string, Articulacao>, semente = Math.random() * 100) {
    this.def = def;
    this.j = (n) => (n ? juntas.get(n) ?? null : null);
    this.semente = semente;
  }

  atualizar(dt: number, p: PoseAnimal) {
    const d = this.def;
    const alvoAmp = clamp(p.vel / d.velRef, 0, 1.15);
    this.amp = damp(this.amp, alvoAmp, 8, dt);
    this.corrida = damp(this.corrida, p.correr, 4, dt);
    this.voo = damp(this.voo, p.voo, 6, dt);
    this.abrir = damp(this.abrir, Math.max(p.voo, p.planar, p.agitacao * 0.35 * (d.asas ? 1 : 0)), 7, dt);
    this.pastar = damp(this.pastar, p.pastar, 2.5, dt);
    this.olhar = damp(this.olhar, p.olhar, 3, dt);
    this.agit = damp(this.agit, p.agitacao, 5, dt);
    const passada = lerp(d.passada, d.passadaCorrida, this.corrida);
    // no ar as pernas não andam
    if (this.voo < 0.5) this.fase = (this.fase + (p.vel / passada) * dt) % 1;
    const t = p.t + this.semente;
    const agit = this.agit;
    const amp = this.amp * (1 - this.voo);
    const A = lerp(d.amplitude, d.amplitudeCorrida, this.corrida) * amp;
    const K = d.joelho * (1 + this.corrida * 0.6) * amp;
    const tremor = agit * (Math.sin(t * 47) * 0.6 + Math.sin(t * 31.7) * 0.4);

    // pernas
    for (const perna of d.pernas) {
      const f = TAU * (this.fase + lerp(perna.fase, perna.faseCorrida, this.corrida));
      const s = Math.sin(f);
      const c = Math.cos(f);
      const sinal = perna.joelho ?? 1;
      const recolher = (d.pernasVoo ?? 1.1) * this.voo;
      this.j(perna.coxa)?.aplicar(-A * s + recolher + tremor * 0.03, 0, 0);
      this.j(perna.canela)?.aplicar(sinal * (K * Math.max(0, c) + recolher * 0.7), 0, 0);
    }

    // corpo: quique, gingado e tremor
    const corpo = this.j(d.corpo);
    if (corpo) {
      const q = (d.quique ?? 0.03) * amp * (1 + this.corrida);
      const bob = -q * Math.abs(Math.sin(TAU * this.fase));
      const ging = (d.gingado ?? 0) * amp * Math.sin(TAU * this.fase);
      const respirar = Math.sin(t * 1.6) * 0.004;
      corpo.deslocar?.(tremor * 0.012, bob + respirar + tremor * 0.006, 0);
      const arfar = this.corrida * amp * Math.sin(TAU * this.fase * 2) * 0.04;
      corpo.aplicar(arfar + p.lutar * Math.sin(t * 6) * 0.05, 0, ging + tremor * 0.025 + p.lutar * Math.sin(t * 8.3) * 0.06);
    }

    // pescoço e cabeça: pastar, balanço do passo, alerta no medo, debater-se
    const pesc = d.pescoco ?? [];
    const balanco = Math.sin(TAU * this.fase * 2) * 0.06 * amp;
    const alerta = -0.25 * agit;
    const lutaX = p.lutar * (Math.sin(t * 5.3) * 0.18 - 0.15);
    const lutaY = p.lutar * Math.sin(t * 9.1) * 0.45;
    const totalX = this.pastar * (d.pastarAngulo ?? 0.9) + balanco + alerta + lutaX;
    if (pesc.length) {
      for (const n of pesc) this.j(n)?.aplicar(totalX / pesc.length, (this.olhar * 0.4 + lutaY * 0.5) / pesc.length, 0);
    }
    const cab = this.j(d.cabeca);
    if (cab) {
      const nervoso = agit * Math.sin(t * 2.3) * 0.5;
      const cx = pesc.length ? this.pastar * 0.25 - balanco * 0.5 : totalX;
      cab.aplicar(cx, this.olhar * (pesc.length ? 0.6 : 1) + nervoso + lutaY * 0.5 + tremor * 0.03, p.lutar * Math.sin(t * 7.7) * 0.2);
    }

    // cauda
    const cauda = d.cauda ?? [];
    for (let i = 0; i < cauda.length; i++) {
      const a = Math.sin(t * (2.1 + agit * 9) - i * 0.7) * (0.22 + agit * 0.35 + amp * 0.1);
      const ergue = (d.caudaEixo === 'x' ? 0 : -0.1 * agit);
      if (d.caudaEixo === 'x') this.j(cauda[i])?.aplicar(a * 0.6, 0, 0);
      else this.j(cauda[i])?.aplicar(ergue + Math.sin(TAU * this.fase) * 0.08 * amp, a, 0);
    }

    // orelhas
    if (d.orelhas) {
      const ab = d.orelhasAbanar ?? 0;
      const o = ab ? Math.sin(t * 1.4) * ab + Math.sin(t * 3.1) * ab * 0.2 : Math.max(0, Math.sin(t * 0.7) - 0.92) * 4 * 0.3;
      const medo = agit * 0.4;
      this.j(d.orelhas[0])?.aplicar(0, o + medo, 0);
      this.j(d.orelhas[1])?.aplicar(0, -o - medo, 0);
    }

    // tromba
    if (d.tromba) {
      d.tromba.forEach((n, i) => {
        const a = Math.sin(t * 1.1 - i * 0.6) * 0.1 * (i + 1) + this.pastar * 0.25 - agit * 0.35 * (i === 0 ? 1 : 0.5);
        this.j(n)?.aplicar(a, Math.sin(t * 0.7 - i) * 0.08 * (i + 1), 0);
      });
    }

    // asas
    if (d.asas) {
      const fechada = (d.asaFechada ?? 1.35) * (1 - this.abrir);
      const freq = d.asaFreq ?? 5;
      const ampA = d.asaAmp ?? 0.8;
      const bater = this.voo * Math.sin(t * TAU * freq) * ampA + this.abrir * 0.05
        + agit * (1 - this.voo) * Math.sin(t * TAU * 7) * 0.25;
      this.j(d.asas[0])?.aplicar(0, fechada, bater);
      this.j(d.asas[1])?.aplicar(0, -fechada, -bater);
    }
  }
}
