import * as THREE from 'three';
import { clamp, smoothstep } from '../core/util';

/** Campo de alturas amostrado numa grade regular, centrado na origem. */
export class Relevo {
  readonly tamanho: number;
  readonly passo: number;
  readonly n: number;
  readonly alturas: Float32Array;
  readonly meio: number;

  constructor(tamanho: number, passo: number, funcao: (x: number, z: number) => number) {
    this.tamanho = tamanho;
    this.passo = passo;
    this.n = Math.round(tamanho / passo) + 1;
    this.meio = tamanho / 2;
    this.alturas = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      const z = j * passo - this.meio;
      for (let i = 0; i < this.n; i++) {
        const x = i * passo - this.meio;
        this.alturas[j * this.n + i] = funcao(x, z);
      }
    }
  }

  private h(i: number, j: number): number {
    i = i < 0 ? 0 : i >= this.n ? this.n - 1 : i;
    j = j < 0 ? 0 : j >= this.n ? this.n - 1 : j;
    return this.alturas[j * this.n + i];
  }

  /** Altura interpolada (bilinear) em coordenadas de mundo. */
  altura(x: number, z: number): number {
    const fx = (x + this.meio) / this.passo;
    const fz = (z + this.meio) / this.passo;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const a = this.h(i, j);
    const b = this.h(i + 1, j);
    const c = this.h(i, j + 1);
    const d = this.h(i + 1, j + 1);
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  normal(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const e = this.passo;
    const hl = this.altura(x - e, z);
    const hr = this.altura(x + e, z);
    const hd = this.altura(x, z - e);
    const hu = this.altura(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  /** 0 = plano, 1 = vertical. */
  inclinacao(x: number, z: number): number {
    return 1 - this.normal(x, z, _n).y;
  }

  dentro(x: number, z: number, margem = 0): boolean {
    const m = this.meio - margem;
    return x > -m && x < m && z > -m && z < m;
  }

  /** Raio contra o terreno (marcha simples). Retorna a distância ou -1. */
  raio(origem: THREE.Vector3, dir: THREE.Vector3, max: number, passo = 0.5): number {
    let t = 0;
    while (t < max) {
      const x = origem.x + dir.x * t;
      const y = origem.y + dir.y * t;
      const z = origem.z + dir.z * t;
      if (y < this.altura(x, z)) return Math.max(0, t - passo * 0.5);
      t += passo;
    }
    return -1;
  }
}

const _n = new THREE.Vector3();

// ---------- formas auxiliares para compor o relevo de cada era ----------

export function distSegmento(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return { d: Math.hypot(px - cx, pz - cz), t };
}

export type Ponto2 = [number, number];

/** Distância até uma polilinha e a posição relativa ao longo dela (0..1 por segmento acumulado). */
export function distPolilinha(px: number, pz: number, pts: Ponto2[]) {
  let melhor = Infinity;
  let idx = 0;
  let tt = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = distSegmento(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (r.d < melhor) {
      melhor = r.d;
      idx = i;
      tt = r.t;
    }
  }
  return { d: melhor, u: (idx + tt) / Math.max(1, pts.length - 1) };
}

/** Mistura h em direção a alvo dentro de um círculo com borda suave. */
export function achatar(h: number, x: number, z: number, cx: number, cz: number, rIn: number, rOut: number, alvo: number) {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= rOut) return h;
  const t = 1 - smoothstep(rIn, rOut, d);
  return h + (alvo - h) * t;
}

/** Fator de borda (0 no centro do mapa, 1 na borda) para erguer montanhas que fecham a região. */
export function fatorBorda(x: number, z: number, meio: number, largura: number) {
  const d = Math.max(Math.abs(x), Math.abs(z));
  return smoothstep(meio - largura, meio, d);
}
