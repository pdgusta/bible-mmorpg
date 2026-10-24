import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';

// o simplificador (WASM) fica pronto bem antes de o mundo ser montado; se não estiver, usa a malha cheia
let pronto = false;
/** Resolve quando o simplificador está pronto (para quem nasce antes dele, como os humanos do laboratório). */
export const simplificadorPronto = MeshoptSimplifier.ready.then(() => { pronto = true; });

export interface OpcoesSimplificar {
  /** Erro máximo, relativo ao tamanho da malha (padrão 0,02). */
  erro?: number;
  /** Trava as bordas abertas (padrão true). */
  travarBordas?: boolean;
  /**
   * Atributo que escolhe o lado de cada vértice de costura (padrão 'uv'): para o triângulo inteiro,
   * o de menor perímetro nesse atributo, para a textura não esticar nem a cor vazar.
   */
  coerencia?: string;
}

/**
 * Índice simplificado de uma malha indexada, sobre os vértices originais (os atributos ficam
 * intactos), ou null se o simplificador não está pronto ou a malha não é indexada.
 */
export function simplificarIndice(g: THREE.BufferGeometry, fracao: number, op: OpcoesSimplificar = {}): Uint32Array | null {
  const idx = g.index;
  if (!pronto || !idx) return null;
  // solda os vértices por posição: as costuras de UV e de normal duplicam vértices, e para o
  // simplificador cada costura vira uma borda travada (o tronco da oliveira não passava de 7212 → 6540
  // triângulos; soldado, chega a 30% com erro de 0,3%). Malhas com esqueleto só soldam vértices
  // presos aos mesmos ossos com os mesmos pesos: na mesma posição em bind, ossos diferentes se
  // separam ao animar (a barra da túnica, entre as duas pernas)
  const pa = g.attributes.position;
  const ossos = g.getAttribute('skinIndex');
  const pesos = g.getAttribute('skinWeight');
  const influencias = (i: number) => {
    const lista: string[] = [];
    for (let c = 0; c < ossos.itemSize; c++) {
      const w = pesos.getComponent(i, c);
      if (w > 1e-4) lista.push(`${ossos.getComponent(i, c)}:${Math.round(w * 1e3)}`);
    }
    return lista.sort().join(';');
  };
  const chaves = new Map<string, number>();
  const solda = new Uint32Array(pa.count);
  const originais: number[][] = [];
  for (let i = 0; i < pa.count; i++) {
    let k = `${Math.round(pa.getX(i) * 1e4)},${Math.round(pa.getY(i) * 1e4)},${Math.round(pa.getZ(i) * 1e4)}`;
    if (ossos && pesos) k += `|${influencias(i)}`;
    let w = chaves.get(k);
    if (w === undefined) {
      w = originais.length;
      chaves.set(k, w);
      originais.push([]);
    }
    originais[w].push(i);
    solda[i] = w;
  }
  const pos = new Float32Array(originais.length * 3);
  originais.forEach(([i], w) => { pos[w * 3] = pa.getX(i); pos[w * 3 + 1] = pa.getY(i); pos[w * 3 + 2] = pa.getZ(i); });
  const ind = new Uint32Array(idx.count);
  for (let i = 0; i < idx.count; i++) ind[i] = solda[idx.getX(i)];
  const alvo = Math.max(3, Math.floor((idx.count * fracao) / 3) * 3);
  const [novo] = MeshoptSimplifier.simplify(ind, pos, 3, alvo, op.erro ?? 0.02, op.travarBordas ?? true ? ['LockBorder'] : []);
  if (novo.length < 3) return null;
  // volta aos vértices originais, escolhendo o lado de cada costura pelo atributo de coerência
  const at = g.getAttribute(op.coerencia ?? 'uv');
  const dist = (a: number, b: number) => {
    let d = 0;
    for (let c = 0; c < at.itemSize; c++) d += Math.abs(at.getComponent(a, c) - at.getComponent(b, c));
    return d;
  };
  const saida = new Uint32Array(novo.length);
  for (let t = 0; t < novo.length; t += 3) {
    const ca = originais[novo[t]], cb = originais[novo[t + 1]], cc = originais[novo[t + 2]];
    let melhor = [ca[0], cb[0], cc[0]];
    if (at && ca.length + cb.length + cc.length > 3) {
      let menor = Infinity;
      for (const a of ca) for (const b of cb) for (const c of cc) {
        const d = dist(a, b) + dist(b, c) + dist(c, a);
        if (d < menor) { menor = d; melhor = [a, b, c]; }
      }
    }
    saida[t] = melhor[0]; saida[t + 1] = melhor[1]; saida[t + 2] = melhor[2];
  }
  return saida;
}
