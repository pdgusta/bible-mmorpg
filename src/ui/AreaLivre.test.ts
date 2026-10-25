import { describe, expect, it } from 'vitest';
import { afastarDePaineis, type Caixa, distribuirSussurros, type Ret, type Sussurro, tetoSussurros } from './AreaLivre';

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
  // a conta do jogo (Provas.ts): os dardos andam até (0,5; 0,55), em fração da tela, e acertam a 0,07
  const ALVO = { x: 0.5, y: 0.55 };
  const RAIO_ACERTO = 0.07;
  const urg = (cx: number, cy: number, W = 640, H = 360) => Math.hypot(cx / W - ALVO.x, cy / H - ALVO.y);
  const s = (id: number, cx: number, cy: number, naTela = false, urgencia = urg(cx, cy)): Sussurro => ({ id, cx, cy, larg: 200, alt: 40, naTela, urgencia });
  const vistos = (l: Map<number, unknown>) => [...l.values()].filter(Boolean).length;

  it('teto pela altura da tela; entram primeiro os que vão acertar antes', () => {
    expect(tetoSussurros(360)).toBe(3);
    expect(tetoSussurros(540)).toBe(3);
    expect(tetoSussurros(720)).toBe(4);
    expect(tetoSussurros(1080)).toBe(6);
    const longe = Array.from({ length: 5 }, (_, i) => s(i + 1, 60 + i * 120, 40, false, 0.3 + i * 0.02));
    const l = distribuirSussurros(longe, [], 640, 360);
    expect(vistos(l)).toBe(3);
    expect([1, 2, 3].every((id) => l.get(id))).toBe(true);
    expect(l.get(4)).toBeNull();
  });

  it('entre os que ainda estão longe, quem já está na tela fica com a vaga; o iminente toma a vaga', () => {
    const naTela = [s(1, 120, 120, true), s(2, 520, 120, true), s(3, 320, 300, true)];
    // um novo, longe como os da tela: espera
    expect(distribuirSussurros([...naTela, s(4, 120, 240)], [], 640, 360).get(4)).toBeNull();
    // um novo para acertar: aparece primeiro, e um dos da tela vai esperar
    const l = distribuirSussurros([...naTela, s(4, 330, 185)], [], 640, 360);
    expect(l.get(4)).not.toBeNull();
    expect(vistos(l)).toBe(3);
  });

  it('os postos não se cobrem nem cobrem painéis; sem lugar livre, espera', () => {
    const itens = Array.from({ length: 12 }, (_, i) => s(i + 1, 300 + (i % 3) * 10, 180 + i * 3, false, 0.3 + i * 0.01));
    const l = distribuirSussurros(itens, PAINEIS, 640, 360);
    const postos = itens.filter((i) => l.get(i.id)).map((i) => ({ ...l.get(i.id)!, larg: i.larg, alt: i.alt }));
    expect(postos.length).toBeGreaterThan(0);
    expect(postos.length).toBeLessThanOrEqual(3);
    for (const [k, a] of postos.entries()) {
      expect(livre(a)).toBe(true);
      for (const b of postos.slice(k + 1)) expect(cruza(a, { esq: b.x, topo: b.y, dir: b.x + b.larg, base: b.y + b.alt })).toBe(false);
    }
  });

  it('sem lugar livre, o único à vista cobre um passageiro (a frase do centro), não um painel fixo', () => {
    // fora a frase (no meio, a tela toda de largura), só sobram frestas
    const frase: Ret = { esq: 0, topo: 95, dir: 640, base: 292, passageiro: true };
    const hora: Ret = { esq: 440, topo: 0, dir: 640, base: 95 };
    const memorias: Ret = { esq: 400, topo: 292, dir: 640, base: 360 };
    const l = distribuirSussurros([s(1, 320, 60)], [...PAINEIS, hora, memorias, frase], 640, 360);
    const c = { ...l.get(1)!, larg: 200, alt: 40 };
    expect(livre(c) && !cruza(c, hora) && !cruza(c, memorias)).toBe(true);
    expect(cruza(c, frase)).toBe(true);
  });

  it('sem nenhum lugar livre, o mais urgente aparece mesmo assim', () => {
    const tudo: Ret = { esq: 0, topo: 0, dir: 640, base: 360 };
    const l = distribuirSussurros([s(1, 100, 100), s(2, 320, 170)], [tudo], 640, 360);
    expect(l.get(2)).not.toBeNull();
    expect(l.get(1)).toBeNull();
  });

  /** Anda os dardos até o alvo, quadro a quadro, com o naTela de volta; devolve as falhas. */
  function simular(dardos: { id: number; x: number; y: number }[], segundos: number, paineis: Ret[], nascer?: (t: number) => { id: number; x: number; y: number } | null) {
    const W = 640;
    const H = 360;
    const v = 0.15;
    const dt = 1 / 60;
    const naTela = new Set<number>();
    const falhas: string[] = [];
    for (let t = 0; t < segundos; t += dt) {
      const novo = nascer?.(t);
      if (novo) dardos.push(novo);
      const itens = dardos.map((d) => ({ id: d.id, cx: d.x * W, cy: d.y * H, larg: 204, alt: 40, naTela: naTela.has(d.id), urgencia: Math.hypot(d.x - ALVO.x, d.y - ALVO.y) }));
      if (!itens.length) continue;
      const l = distribuirSussurros(itens, paineis, W, H);
      naTela.clear();
      for (const [id, pos] of l) if (pos) naTela.add(id);
      const urgente = itens.reduce((a, b) => (b.urgencia < a.urgencia ? b : a));
      if (!naTela.has(urgente.id)) falhas.push(`t=${t.toFixed(2)}: o mais urgente (${urgente.id}) não aparece`);
      for (const d of [...dardos]) {
        const dist = Math.hypot(d.x - ALVO.x, d.y - ALVO.y);
        if (dist <= RAIO_ACERTO) {
          if (!naTela.has(d.id)) falhas.push(`t=${t.toFixed(2)}: ${d.id} acertou sem aparecer`);
          dardos.splice(dardos.indexOf(d), 1);
          continue;
        }
        d.x += ((ALVO.x - d.x) / dist) * v * dt;
        d.y += ((ALVO.y - d.y) / dist) * v * dt;
      }
    }
    return falhas;
  }

  it('o caso da revisão: dois andando para o alvo, o que acerta antes aparece até acertar', () => {
    expect(simular([{ id: 1, x: 0.62, y: 0.55 }, { id: 2, x: 0.5, y: 0.4 }], 1.5, [])).toEqual([]);
  });

  it('teto cheio de sussurros perto do meio da tela (em px), mas longe do alvo: o que vai acertar aparece até acertar', () => {
    // a 640×360 cabem 3; a tentação tem até 4. O 4º está de lado (x), a 0,10 do alvo; os outros, acima, a ~0,15
    const dardos = [
      { id: 1, x: 0.5, y: 0.4 },
      { id: 2, x: 0.46, y: 0.4 },
      { id: 3, x: 0.54, y: 0.4 },
      { id: 4, x: 0.6, y: 0.55 },
    ];
    expect(simular(dardos, 1.5, [])).toEqual([]);
  });

  it('dardos nascendo e andando como no jogo: nenhum acerta sem aparecer', () => {
    let semente = 7;
    const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
    let id = 0;
    let proximo = 0;
    const dardos: { id: number; x: number; y: number }[] = [];
    const nascer = (t: number) => {
      if (t < proximo || dardos.length >= 4) return null;
      proximo = t + 0.4 + rnd() * 0.8;
      const ang = rnd() * Math.PI * 2;
      return { id: ++id, x: Math.min(0.96, Math.max(0.04, 0.5 + Math.cos(ang) * 0.5)), y: Math.min(0.94, Math.max(0.06, 0.55 + Math.sin(ang) * 0.4)) };
    };
    expect(simular(dardos, 20, PAINEIS, nascer)).toEqual([]);
    expect(id).toBeGreaterThan(15);
  }, 30000);
});
