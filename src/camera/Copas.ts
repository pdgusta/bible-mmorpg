import * as THREE from 'three';
import type { Copa } from '../render/Natureza';

/** De onde vêm as copas (a `Natureza` do mundo). */
export interface FonteCopas {
  readonly versao: number;
  copas(): Iterable<Copa>;
}

const CELULA = 8;
/** A caixa da folhagem sobra nos cantos: a copa vira um elipsoide um pouco menor que ela. */
const ENCOLHER = 0.85;

/**
 * Copas das árvores para a câmera de 3ª pessoa, numa grade de 8 m refeita quando a vegetação
 * muda (`versao`). Os colisores das árvores são só os troncos (até o chão + 4 m); sem isto a
 * câmera entra na folhagem e a tela fica verde-escura.
 */
export class CopasCamera {
  private grade = new Map<number, Copa[]>();
  private versao = -1;
  private vistas = new Set<Copa>();

  constructor(private fonte: FonteCopas) {}

  private chave(i: number, j: number) {
    return (i + 4096) * 8192 + (j + 4096);
  }

  private refazer() {
    this.versao = this.fonte.versao;
    this.grade.clear();
    for (const c of this.fonte.copas()) {
      const r = c.raio * ENCOLHER;
      for (let i = Math.floor((c.x - r) / CELULA); i <= Math.floor((c.x + r) / CELULA); i++) {
        for (let j = Math.floor((c.z - r) / CELULA); j <= Math.floor((c.z + r) / CELULA); j++) {
          const k = this.chave(i, j);
          let l = this.grade.get(k);
          if (!l) this.grade.set(k, (l = []));
          l.push(c);
        }
      }
    }
  }

  /**
   * Distância ao longo de `dir` (unitário) até entrar numa copa, ou -1 se não entra antes de
   * `max`. Uma copa que já contém a origem não conta (o personagem debaixo de um arbusto alto).
   */
  raio(o: THREE.Vector3, dir: THREE.Vector3, max: number): number {
    if (this.fonte.versao !== this.versao) this.refazer();
    const fx = o.x + dir.x * max;
    const fz = o.z + dir.z * max;
    let melhor = -1;
    this.vistas.clear();
    for (let i = Math.floor(Math.min(o.x, fx) / CELULA); i <= Math.floor(Math.max(o.x, fx) / CELULA); i++) {
      for (let j = Math.floor(Math.min(o.z, fz) / CELULA); j <= Math.floor(Math.max(o.z, fz) / CELULA); j++) {
        const l = this.grade.get(this.chave(i, j));
        if (!l) continue;
        for (const c of l) {
          if (this.vistas.has(c)) continue;
          this.vistas.add(c);
          const t = entrada(c, o, dir);
          if (t >= 0 && t <= max && (melhor < 0 || t < melhor)) melhor = t;
        }
      }
    }
    return melhor;
  }
}

/** Entrada do raio no elipsoide da copa (-1 se não cruza ou se a origem está dentro). */
function entrada(c: Copa, o: THREE.Vector3, d: THREE.Vector3): number {
  const a = c.raio * ENCOLHER;
  const b = ((c.y1 - c.y0) / 2) * ENCOLHER;
  if (a <= 0 || b <= 0) return -1;
  const px = (o.x - c.x) / a, py = (o.y - (c.y0 + c.y1) / 2) / b, pz = (o.z - c.z) / a;
  const dx = d.x / a, dy = d.y / b, dz = d.z / a;
  const C = px * px + py * py + pz * pz - 1;
  if (C <= 0) return -1;
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (px * dx + py * dy + pz * dz);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return -1;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 ? t : -1;
}
