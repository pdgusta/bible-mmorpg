import * as THREE from 'three';

export type TipoColisor = 'caixa' | 'cilindro' | 'rampa';

/**
 * Colisor estático (ou movido por script). Caixas e rampas giram só em Y.
 * Uma rampa tem o topo inclinado ao longo do eixo z local: de `topoDe` (em -hz) a `topoAte` (em +hz).
 */
export interface Colisor {
  id: number;
  tipo: TipoColisor;
  x: number;
  z: number;
  hx: number;
  hz: number;
  r: number;
  yaw: number;
  y0: number;
  y1: number;
  topoDe?: number;
  topoAte?: number;
  solido: boolean;
  piso: boolean;
  ativo: boolean;
  tag?: string;
  cos: number;
  sin: number;
}

export interface OpcoesColisor {
  tipo?: TipoColisor;
  x: number;
  z: number;
  hx?: number;
  hz?: number;
  r?: number;
  yaw?: number;
  y0: number;
  y1: number;
  topoDe?: number;
  topoAte?: number;
  solido?: boolean;
  piso?: boolean;
  tag?: string;
}

const CELULA = 8;

/** Conjunto de colisores com grade espacial para consultas rápidas. */
export class Colisoes {
  private lista: Colisor[] = [];
  private grade = new Map<number, Colisor[]>();
  private proximoId = 1;
  private marca = 0;
  private marcas = new Map<number, number>();

  adicionar(o: OpcoesColisor): Colisor {
    const c: Colisor = {
      id: this.proximoId++,
      tipo: o.tipo ?? 'caixa',
      x: o.x, z: o.z,
      hx: o.hx ?? 0.5, hz: o.hz ?? 0.5, r: o.r ?? 0.5,
      yaw: o.yaw ?? 0,
      y0: o.y0, y1: o.y1,
      topoDe: o.topoDe, topoAte: o.topoAte,
      solido: o.solido ?? true,
      piso: o.piso ?? true,
      ativo: true,
      tag: o.tag,
      cos: Math.cos(o.yaw ?? 0),
      sin: Math.sin(o.yaw ?? 0),
    };
    this.lista.push(c);
    this.inserir(c);
    return c;
  }

  remover(c: Colisor) {
    this.retirar(c);
    this.lista = this.lista.filter((x) => x !== c);
  }

  removerTag(tag: string) {
    for (const c of this.lista.filter((x) => x.tag === tag)) this.remover(c);
  }

  /** Move um colisor (portões, vigas) e atualiza a grade. */
  mover(c: Colisor, x: number, z: number, yaw = c.yaw, y0 = c.y0, y1 = c.y1) {
    this.retirar(c);
    c.x = x; c.z = z; c.yaw = yaw; c.y0 = y0; c.y1 = y1;
    c.cos = Math.cos(yaw); c.sin = Math.sin(yaw);
    this.inserir(c);
  }

  todos(): readonly Colisor[] {
    return this.lista;
  }

  private raioExt(c: Colisor) {
    return c.tipo === 'cilindro' ? c.r : Math.hypot(c.hx, c.hz);
  }

  private chaves(c: Colisor): number[] {
    const r = this.raioExt(c);
    const i0 = Math.floor((c.x - r) / CELULA);
    const i1 = Math.floor((c.x + r) / CELULA);
    const j0 = Math.floor((c.z - r) / CELULA);
    const j1 = Math.floor((c.z + r) / CELULA);
    const out: number[] = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(chave(i, j));
    return out;
  }

  private inserir(c: Colisor) {
    for (const k of this.chaves(c)) {
      let l = this.grade.get(k);
      if (!l) this.grade.set(k, (l = []));
      l.push(c);
    }
  }

  private retirar(c: Colisor) {
    for (const k of this.chaves(c)) {
      const l = this.grade.get(k);
      if (l) {
        const i = l.indexOf(c);
        if (i >= 0) l.splice(i, 1);
      }
    }
  }

  /** Colisores perto de (x,z) dentro de um raio (sem repetição). */
  perto(x: number, z: number, raio: number, out: Colisor[] = []): Colisor[] {
    out.length = 0;
    this.marca++;
    const i0 = Math.floor((x - raio) / CELULA);
    const i1 = Math.floor((x + raio) / CELULA);
    const j0 = Math.floor((z - raio) / CELULA);
    const j1 = Math.floor((z + raio) / CELULA);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const l = this.grade.get(chave(i, j));
        if (!l) continue;
        for (const c of l) {
          if (!c.ativo || this.marcas.get(c.id) === this.marca) continue;
          this.marcas.set(c.id, this.marca);
          out.push(c);
        }
      }
    }
    return out;
  }

  /** Converte (x,z) para o espaço local do colisor. */
  static local(c: Colisor, x: number, z: number): [number, number] {
    const dx = x - c.x;
    const dz = z - c.z;
    return [dx * c.cos - dz * c.sin, dx * c.sin + dz * c.cos];
  }

  /** Altura do topo do colisor no ponto (para rampas, interpolada). */
  static topo(c: Colisor, x: number, z: number): number {
    if (c.tipo !== 'rampa') return c.y1;
    const [, lz] = Colisoes.local(c, x, z);
    const t = Math.min(1, Math.max(0, (lz + c.hz) / (2 * c.hz)));
    return (c.topoDe ?? c.y1) + ((c.topoAte ?? c.y1) - (c.topoDe ?? c.y1)) * t;
  }

  /** O ponto (com margem) está sobre a projeção do colisor? */
  static contem(c: Colisor, x: number, z: number, margem = 0): boolean {
    if (c.tipo === 'cilindro') {
      const dx = x - c.x;
      const dz = z - c.z;
      return dx * dx + dz * dz <= (c.r + margem) * (c.r + margem);
    }
    const [lx, lz] = Colisoes.local(c, x, z);
    return Math.abs(lx) <= c.hx + margem && Math.abs(lz) <= c.hz + margem;
  }

  /**
   * Empurra um círculo (x,z,raio) para fora do colisor no plano XZ.
   * Retorna o deslocamento [dx, dz] ou null se não houver penetração.
   */
  static empurrar(c: Colisor, x: number, z: number, raio: number): [number, number] | null {
    if (c.tipo === 'cilindro') {
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + raio;
      if (d >= min) return null;
      if (d < 1e-5) return [min, 0];
      return [(dx / d) * (min - d), (dz / d) * (min - d)];
    }
    const [lx, lz] = Colisoes.local(c, x, z);
    const px = Math.max(-c.hx, Math.min(c.hx, lx));
    const pz = Math.max(-c.hz, Math.min(c.hz, lz));
    let ex = lx - px;
    let ez = lz - pz;
    let d = Math.hypot(ex, ez);
    let ox: number;
    let oz: number;
    if (d > 1e-5) {
      if (d >= raio) return null;
      ox = (ex / d) * (raio - d);
      oz = (ez / d) * (raio - d);
    } else {
      // centro dentro da caixa: sai pelo lado mais próximo
      const sx = c.hx - Math.abs(lx);
      const sz = c.hz - Math.abs(lz);
      if (sx < sz) { ox = Math.sign(lx || 1) * (sx + raio); oz = 0; }
      else { ox = 0; oz = Math.sign(lz || 1) * (sz + raio); }
    }
    // de volta ao mundo (rotação inversa)
    return [ox * c.cos + oz * c.sin, -ox * c.sin + oz * c.cos];
  }

  /** Interseção de raio (origem, direção normalizada) com colisores sólidos. Retorna distância ou -1. */
  raio(origem: THREE.Vector3, dir: THREE.Vector3, max: number, ignorarTag?: string): number {
    let melhor = -1;
    const passos = Math.ceil(max / CELULA) + 1;
    const vistos = new Set<number>();
    const tmp: Colisor[] = [];
    for (let s = 0; s <= passos; s++) {
      const t = Math.min(max, s * CELULA);
      this.perto(origem.x + dir.x * t, origem.z + dir.z * t, CELULA, tmp);
      for (const c of tmp) {
        if (vistos.has(c.id) || !c.solido || (ignorarTag && c.tag === ignorarTag)) continue;
        vistos.add(c.id);
        const d = raioCaixa(c, origem, dir, max);
        if (d >= 0 && (melhor < 0 || d < melhor)) melhor = d;
      }
    }
    return melhor;
  }
}

function chave(i: number, j: number) {
  return (i + 4096) * 8192 + (j + 4096);
}

function raioCaixa(c: Colisor, o: THREE.Vector3, d: THREE.Vector3, max: number): number {
  const hx = c.tipo === 'cilindro' ? c.r : c.hx;
  const hz = c.tipo === 'cilindro' ? c.r : c.hz;
  const [ox, oz] = Colisoes.local(c, o.x, o.z);
  const dx = d.x * c.cos - d.z * c.sin;
  const dz = d.x * c.sin + d.z * c.cos;
  let tmin = 0;
  let tmax = max;
  const eixos: [number, number, number, number][] = [
    [ox, dx, -hx, hx],
    [o.y, d.y, c.y0, c.tipo === 'rampa' ? Math.max(c.topoDe ?? c.y1, c.topoAte ?? c.y1) : c.y1],
    [oz, dz, -hz, hz],
  ];
  for (const [p, v, a, b] of eixos) {
    if (Math.abs(v) < 1e-8) {
      if (p < a || p > b) return -1;
    } else {
      let t1 = (a - p) / v;
      let t2 = (b - p) / v;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}
