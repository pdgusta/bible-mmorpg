// Desvio do Animal com memória do lado: escolher a sonda do zero a cada 0,25 s alternava os
// lados num bolsão e o bicho tremia no lugar até o reposicionamento.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Colisoes } from '../src/mundo/Colisao';
import { MundoFisico } from '../src/mundo/Fisica';
import { Relevo } from '../src/mundo/Relevo';
import { criarAnimal, sondasDesvio, type Animal } from '../src/entidades/Animal';

type Caixa = { x: number; z: number; hx: number; hz: number };

/** Chão plano com as caixas dadas como obstáculos. */
function mundo(caixas: Caixa[]) {
  const fisica = new MundoFisico(new Relevo(80, 2, () => 0), new Colisoes());
  for (const c of caixas) fisica.colisoes.adicionar({ ...c, y0: -1, y1: 3 });
  return { fisica, grupo: new THREE.Group(), atualizaveis: new Set<{ atualizar(dt: number, t: number): void }>() };
}

/** Bolsão em U aberto para oeste, de 8 × 8 m, centrado na origem (o de animal-travado). */
const BOLSAO: Caixa[] = [{ x: 4, z: 0, hx: 0.3, hz: 4 }, { x: 0, z: 4, hx: 4, hz: 0.3 }, { x: 0, z: -4, hx: 4, hz: 0.3 }];

interface Interno {
  vistoEm: number;
  desvio: number;
  travadas: number;
}

/** Avança o animal como se estivesse na tela e conta as trocas de lado do desvio. */
function avancar(a: Animal, segundos: number, parar = () => false) {
  const i = a as unknown as Interno;
  const dt = 1 / 30;
  let lado = 0;
  let trocas = 0;
  for (let t = 0; t < segundos && !parar(); t += dt) {
    i.vistoEm = performance.now();
    a.atualizar(dt);
    const s = Math.sign(i.desvio);
    if (s && lado && s !== lado) trocas++;
    if (s) lado = s;
  }
  return trocas;
}

describe('Animal: desvio com memória do lado', () => {
  it('a ordem das sondas prefere o lado do desvio anterior', () => {
    expect(sondasDesvio(0)).toEqual([0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]);
    expect(sondasDesvio(1)).toEqual([0, 0.6, 1.2, 1.9, -0.6, -1.2, -1.9]);
    expect(sondasDesvio(-1)).toEqual([0, -0.6, -1.2, -1.9, 0.6, 1.2, 1.9]);
  });

  it('no bolsão em U contorna a parede por um lado só, sem tremer', async () => {
    for (const [especie, semente, z] of [['leao', 7, 0], ['leao', 3, 0.5], ['cervo', 2, 0]] as const) {
      const a = await criarAnimal(especie, mundo(BOLSAO), 0, z, { semente });
      void a.irPara(12, 0);
      // antes: 7 ou 8 trocas de lado em 8 s, sacudindo em torno de um ponto da parede leste
      expect(avancar(a, 8), `${especie} ${semente}`).toBeLessThanOrEqual(2);
      await a.remover(false);
    }
  }, 60_000);

  it('contorna um pilar no caminho sem precisar reposicionar', async () => {
    const a = await criarAnimal('leao', mundo([{ x: 4, z: 0.2, hx: 0.8, hz: 0.8 }]), 0, 0, { semente: 7 });
    let chegou = false;
    void a.irPara(9, 0).then(() => (chegou = true));
    avancar(a, 15, () => chegou);
    await Promise.resolve();
    expect(chegou).toBe(true);
    expect((a as unknown as Interno).travadas).toBe(0);
    expect(Math.hypot(a.posicao.x - 9, a.posicao.z)).toBeLessThan(1);
    await a.remover(false);
  }, 60_000);
});
