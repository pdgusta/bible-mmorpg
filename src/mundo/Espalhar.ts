import type { Mundo } from './Mundo';
import { Aleatorio } from '../core/aleatorio';

export interface OpcoesEspalhar {
  /** Densidade 0..1 em (x,z). */
  densidade(x: number, z: number): number;
  /** Distância mínima entre instâncias desta variante (m). */
  espacamento: number;
  escala: [number, number];
  /** Região de busca (padrão: o mapa todo). */
  x0?: number; x1?: number; z0?: number; z1?: number;
  max?: number;
  /** Inclinação máxima do terreno (0..1). */
  inclinacaoMax?: number;
  /** Afunda a base para assentar no chão. */
  afundar?: number;
  semente?: number;
  /** Também evita água (padrão true). */
  evitarAgua?: boolean;
}

/**
 * Distribui instâncias de uma variante de natureza com grade "tremida" + rejeição por
 * distância mínima (aproximação barata de Poisson disk).
 */
export function espalhar(m: Mundo, variante: string, o: OpcoesEspalhar): number {
  const r = new Aleatorio(o.semente ?? hash(variante));
  const meio = m.relevo.meio - 4;
  const x0 = o.x0 ?? -meio, x1 = o.x1 ?? meio, z0 = o.z0 ?? -meio, z1 = o.z1 ?? meio;
  const e = o.espacamento;
  const celula = e / Math.SQRT2;
  const grade = new Map<number, [number, number]>();
  const chave = (i: number, j: number) => i * 100003 + j;
  let n = 0;
  const max = o.max ?? Infinity;
  for (let z = z0; z < z1; z += e * 0.75) {
    for (let x = x0; x < x1; x += e * 0.75) {
      if (n >= max) return n;
      const px = x + r.entre(-0.5, 0.5) * e;
      const pz = z + r.entre(-0.5, 0.5) * e;
      if (!m.relevo.dentro(px, pz, 6)) continue;
      if (r.proximo() > o.densidade(px, pz)) continue;
      if ((o.evitarAgua ?? true) && m.fisica.profundidade(px, pz) > -0.3) continue;
      if (o.inclinacaoMax !== undefined && m.relevo.inclinacao(px, pz) > o.inclinacaoMax) continue;
      const ci = Math.floor(px / celula);
      const cj = Math.floor(pz / celula);
      let perto = false;
      for (let dj = -2; dj <= 2 && !perto; dj++) {
        for (let di = -2; di <= 2; di++) {
          const q = grade.get(chave(ci + di, cj + dj));
          if (q && Math.hypot(q[0] - px, q[1] - pz) < e) { perto = true; break; }
        }
      }
      if (perto) continue;
      grade.set(chave(ci, cj), [px, pz]);
      const y = m.relevo.altura(px, pz) - (o.afundar ?? 0.1);
      m.natureza.adicionar(variante, px, y, pz, r.entre(0, Math.PI * 2), r.entre(o.escala[0], o.escala[1]), r);
      n++;
    }
  }
  return n;
}

function hash(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
