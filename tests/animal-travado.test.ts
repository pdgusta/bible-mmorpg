// Animal preso na tela: num bolsão em U o leão treme entre dois desvios e o `travado` dispara a
// cada 5 s, mas sem rota nova nada mudava e a missão esperava para sempre.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Colisoes } from '../src/mundo/Colisao';
import { MundoFisico } from '../src/mundo/Fisica';
import { Relevo } from '../src/mundo/Relevo';
import { criarAnimal, type Animal } from '../src/entidades/Animal';

/** Chão plano com um bolsão em U aberto para oeste, de 8 × 8 m, centrado na origem. */
function bolsao() {
  const fisica = new MundoFisico(new Relevo(80, 2, () => 0), new Colisoes());
  for (const c of [{ x: 4, z: 0, hx: 0.3, hz: 4 }, { x: 0, z: 4, hx: 4, hz: 0.3 }, { x: 0, z: -4, hx: 4, hz: 0.3 }])
    fisica.colisoes.adicionar({ ...c, y0: -1, y1: 3 });
  return { fisica, grupo: new THREE.Group(), atualizaveis: new Set<{ atualizar(dt: number, t: number): void }>() };
}

/** Avança o animal como se estivesse na tela (visto a cada quadro). */
function avancar(a: Animal, segundos: number, parar = () => false) {
  const dt = 1 / 30;
  for (let t = 0; t < segundos && !parar(); t += dt) {
    (a as unknown as { vistoEm: number }).vistoEm = performance.now();
    a.atualizar(dt);
  }
}

describe('Animal: travado na tela', () => {
  it('preso no bolsão sem rota, tenta de novo e depois reposiciona no alvo', async () => {
    const leao = await criarAnimal('leao', bolsao(), 0, 0, { semente: 7 });
    let chegou = false;
    leao.irPara(12, 0).then(() => (chegou = true));
    // a primeira vez que trava (~9 s) ainda não reposiciona
    avancar(leao, 11);
    expect(chegou).toBe(false);
    expect(leao.posicao.x).toBeLessThan(4);
    // a segunda vez no mesmo lugar reposiciona e conclui
    avancar(leao, 15, () => chegou);
    await Promise.resolve();
    expect(chegou).toBe(true);
    expect(Math.hypot(leao.posicao.x - 12, leao.posicao.z)).toBeLessThan(1);
    await leao.remover(false);
  }, 60_000);
});
