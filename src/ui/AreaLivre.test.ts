import { describe, expect, it } from 'vitest';
import { afastarDePaineis, type Caixa, type Ret } from './AreaLivre';

// 640×360 como na foto do T-016: perfil no alto à esquerda, topo da prova, firmeza embaixo à esquerda
const PERFIL: Ret = { esq: 10, topo: 10, dir: 200, base: 125 };
const TOPO: Ret = { esq: 200, topo: 10, dir: 440, base: 95 };
const FIRMEZA: Ret = { esq: 14, topo: 292, dir: 232, base: 344 };
const ACOES: Ret = { esq: 245, topo: 298, dir: 395, base: 346 };
const PAINEIS = [PERFIL, TOPO, FIRMEZA, ACOES];

const cruza = (c: Caixa, r: Ret) => c.x < r.dir && r.esq < c.x + c.larg && c.y < r.base && r.topo < c.y + c.alt;
const livre = (c: Caixa) => PAINEIS.every((p) => !cruza(c, p));

describe('afastarDePaineis', () => {
  it('caixa já livre fica onde está', () => {
    expect(afastarDePaineis({ x: 250, y: 150, larg: 200, alt: 40 }, PAINEIS, 640, 360)).toEqual({ x: 250, y: 150 });
  });

  it('sobre a firmeza, sobe para o espaço livre acima dela', () => {
    const c = { x: 120, y: 262, larg: 236, alt: 40 };
    const p = afastarDePaineis(c, PAINEIS, 640, 360);
    expect(livre({ ...c, ...p })).toBe(true);
    expect(p.y + c.alt).toBeLessThanOrEqual(FIRMEZA.topo);
    expect(p.x).toBe(120);
  });

  it('sobre o perfil e o topo, desce para baixo deles', () => {
    const c = { x: 170, y: 80, larg: 236, alt: 40 };
    const p = afastarDePaineis(c, PAINEIS, 640, 360);
    expect(livre({ ...c, ...p })).toBe(true);
    expect(p.y).toBeGreaterThanOrEqual(TOPO.base);
  });

  it('não empurra para fora da tela: no canto, sai pelo lado de dentro', () => {
    const c = { x: 0, y: 300, larg: 200, alt: 40 };
    const p = afastarDePaineis(c, PAINEIS, 640, 360);
    expect(livre({ ...c, ...p })).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y + c.alt).toBeLessThanOrEqual(360);
  });

  it('centro perto da borda (meio cartão fora da tela): entra na tela e sai de cima do perfil', () => {
    const c = { x: -70, y: -2, larg: 204, alt: 40 };
    const p = afastarDePaineis(c, PAINEIS, 640, 360);
    expect(livre({ ...c, ...p })).toBe(true);
    expect(p.x >= 0 && p.y >= 0).toBe(true);
  });

  it('espremida entre o topo e uma faixa no meio, acha o lugar livre em outro eixo', () => {
    const FAIXA: Ret = { esq: 200, topo: 114, dir: 615, base: 215 };
    const MEMORIAS: Ret = { esq: 435, topo: 122, dir: 627, base: 346 };
    const todos = [...PAINEIS, FAIXA, MEMORIAS];
    for (const x of [200, 300, 400]) {
      const c = { x, y: 60, larg: 204, alt: 40 };
      const p = afastarDePaineis(c, todos, 640, 360);
      expect(todos.every((r) => !cruza({ ...c, ...p }, r)), `${x} → ${p.x},${p.y}`).toBe(true);
    }
  });

  it('em qualquer ponto, até meio fora da tela, a caixa termina livre e dentro dela', () => {
    for (let x = -100; x <= 540; x += 20) {
      for (let y = -20; y <= 340; y += 20) {
        const c = { x, y, larg: 200, alt: 40 };
        const p = afastarDePaineis(c, PAINEIS, 640, 360);
        expect(livre({ ...c, ...p }), `${x},${y} → ${p.x},${p.y}`).toBe(true);
        expect(p.x >= 0 && p.y >= 0 && p.x + 200 <= 640 && p.y + 40 <= 360).toBe(true);
      }
    }
  });
});
