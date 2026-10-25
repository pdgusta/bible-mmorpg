import { describe, expect, it } from 'vitest';
import { afastarDePaineis, type Caixa, distribuirSussurros, type Ret, tetoSussurros } from './AreaLivre';

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

describe('distribuirSussurros', () => {
  const s = (id: number, cx: number, cy: number, naTela = false) => ({ id, cx, cy, larg: 200, alt: 40, naTela });

  it('não passa do teto pela altura da tela; os mais perto do centro entram primeiro', () => {
    expect(tetoSussurros(360)).toBe(3);
    expect(tetoSussurros(540)).toBe(3);
    expect(tetoSussurros(720)).toBe(4);
    expect(tetoSussurros(1080)).toBe(6);
    const itens = [s(1, 100, 180), s(2, 320, 180), s(3, 540, 180), s(4, 320, 250), s(5, 320, 150)];
    const l = distribuirSussurros(itens, [], 640, 360);
    expect([...l.values()].filter(Boolean).length).toBe(3);
    expect(l.get(2)).not.toBeNull(); // o do centro
    expect(l.get(1)).toBeNull(); // o mais longe espera
  });

  it('quem já está na tela fica com a vaga diante de um novo à mesma distância; o que vai acertar antes toma a vaga', () => {
    const naTela = [s(1, 120, 120, true), s(2, 520, 120, true), s(3, 320, 300, true)];
    // à mesma distância do centro que os da tela: espera
    expect(distribuirSussurros([...naTela, s(4, 120, 240)], [], 640, 360).get(4)).toBeNull();
    // bem mais perto do centro: aparece, e o mais longe da tela vai esperar
    const l = distribuirSussurros([...naTela, s(4, 330, 185)], [], 640, 360);
    expect(l.get(4)).not.toBeNull();
    expect([...l.values()].filter(Boolean).length).toBe(3);
  });

  it('sem lugar livre, o único à vista cobre um passageiro (a frase do centro), não um painel fixo', () => {
    // fora a frase (no meio, a tela toda de largura), só sobram frestas
    const frase: Ret = { esq: 0, topo: 95, dir: 640, base: 292, passageiro: true };
    const hora: Ret = { esq: 440, topo: 0, dir: 640, base: 95 };
    const memorias: Ret = { esq: 400, topo: 292, dir: 640, base: 360 };
    const l = distribuirSussurros([s(1, 320, 60)], [...PAINEIS, hora, memorias, frase], 640, 360);
    const p = l.get(1)!;
    const c = { ...p, larg: 200, alt: 40 };
    expect(livre(c) && !cruza(c, hora) && !cruza(c, memorias)).toBe(true);
    expect(cruza(c, frase)).toBe(true);
  });

  it('sem nenhum lugar livre, o mais urgente aparece mesmo assim', () => {
    const tudo: Ret = { esq: 0, topo: 0, dir: 640, base: 360 };
    const l = distribuirSussurros([s(1, 100, 100), s(2, 320, 170)], [tudo], 640, 360);
    expect(l.get(2)).not.toBeNull();
    expect(l.get(1)).toBeNull();
  });

  it('os postos não se cobrem nem cobrem painéis; sem lugar livre, espera', () => {
    const itens = Array.from({ length: 12 }, (_, i) => s(i + 1, 300 + (i % 3) * 10, 180 + i * 3));
    const l = distribuirSussurros(itens, PAINEIS, 640, 360);
    const postos = itens.filter((i) => l.get(i.id)).map((i) => ({ ...l.get(i.id)!, larg: i.larg, alt: i.alt }));
    expect(postos.length).toBeGreaterThan(0);
    expect(postos.length).toBeLessThanOrEqual(3);
    for (const [k, a] of postos.entries()) {
      expect(livre(a)).toBe(true);
      for (const b of postos.slice(k + 1)) expect(cruza(a, { esq: b.x, topo: b.y, dir: b.x + b.larg, base: b.y + b.alt })).toBe(false);
    }
  });
});
