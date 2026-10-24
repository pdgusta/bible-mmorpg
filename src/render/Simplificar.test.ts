import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { simplificadorPronto, simplificarIndice } from './Simplificar';

/** Esfera com uma costura de cor: metade de cima vermelha, de baixo azul, com vértices duplicados no equador. */
function esferaCosturada() {
  const cima = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const baixo = new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  for (const [g, c] of [[cima, [1, 0, 0]], [baixo, [0, 0, 1]]] as const) {
    const base = pos.length / 3;
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      cor.push(...c);
    }
    for (let i = 0; i < g.index!.count; i++) idx.push(base + g.index!.getX(i));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  return g;
}

describe('simplificarIndice', () => {
  it('reduz os triângulos sobre os vértices originais', async () => {
    await simplificadorPronto;
    const g = esferaCosturada();
    const ind = simplificarIndice(g, 0.25, { coerencia: 'color', erro: 0.05 })!;
    expect(ind).not.toBeNull();
    expect(ind.length % 3).toBe(0);
    expect(ind.length).toBeLessThanOrEqual(g.index!.count * 0.3);
    expect(Math.max(...ind)).toBeLessThan(g.attributes.position.count);
  });

  it('nos vértices de costura, escolhe o lado que deixa o triângulo de uma cor só', async () => {
    await simplificadorPronto;
    const g = esferaCosturada();
    const ind = simplificarIndice(g, 0.25, { coerencia: 'color', erro: 0.05 })!;
    const p = g.attributes.position;
    const cor = g.attributes.color;
    // cores disponíveis em cada posição (a costura tem as duas)
    const chave = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    const cores = new Map<string, Set<number>>();
    for (let i = 0; i < p.count; i++) {
      if (!cores.has(chave(i))) cores.set(chave(i), new Set());
      cores.get(chave(i))!.add(cor.getX(i));
    }
    let naCostura = 0;
    for (let t = 0; t < ind.length; t += 3) {
      const tri = [ind[t], ind[t + 1], ind[t + 2]];
      const comum = [0, 1].filter((c) => tri.every((i) => cores.get(chave(i))!.has(c)));
      if (comum.length === 0) continue;
      if (tri.some((i) => cores.get(chave(i))!.size > 1)) naCostura++;
      expect(new Set(tri.map((i) => cor.getX(i))).size).toBe(1);
    }
    expect(naCostura).toBeGreaterThan(0);
  });

  it('devolve null para malha sem índice', async () => {
    await simplificadorPronto;
    expect(simplificarIndice(new THREE.SphereGeometry(1, 8, 8).toNonIndexed(), 0.5)).toBeNull();
  });
});
