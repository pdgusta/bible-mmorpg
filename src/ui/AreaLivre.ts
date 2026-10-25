// Lugar livre para os cartões que andam pela tela (os sussurros das provas): se a caixa cai sobre
// um painel, ela vai para o lugar livre mais perto, sem sair da tela. Cabem poucos de cada vez; os
// outros esperam a vez, como os avisos. Lógica pura, em px; quem mede os painéis é o OverlayProva.

export interface Ret {
  esq: number;
  topo: number;
  dir: number;
  base: number;
  /** Passageiro (a frase do centro, a faixa de versículo, a dica, os avisos): sem lugar livre, pode ser coberto. */
  passageiro?: boolean;
}

/** Posição (canto de cima à esquerda) de uma caixa `larg`×`alt` em `x`,`y`. */
export interface Caixa {
  x: number;
  y: number;
  larg: number;
  alt: number;
}

/** Área (px²) em que a caixa cobre o painel, com a folga. */
function sobreposicao(c: Caixa, r: Ret, m: number): number {
  const l = Math.min(c.x + c.larg, r.dir + m) - Math.max(c.x, r.esq - m);
  const a = Math.min(c.y + c.alt, r.base + m) - Math.max(c.y, r.topo - m);
  return l > 0 && a > 0 ? l * a : 0;
}

/** Quanto (px²) a caixa cobre dos painéis, com a folga. */
export function areaCoberta(c: Caixa, paineis: Ret[], margem = 6): number {
  return paineis.reduce((s, p) => s + sobreposicao(c, p, margem), 0);
}

/** Cobrir um painel fixo pesa muito mais que cobrir um passageiro. */
const PESO_FIXO = 1000;
const custo = (c: Caixa, paineis: Ret[], margem: number) =>
  paineis.reduce((s, p) => s + sobreposicao(c, p, margem) * (p.passageiro ? 1 : PESO_FIXO), 0);

/**
 * Põe a caixa dentro da tela `largTela`×`altTela` e a tira de cima dos painéis (com `margem` px de
 * folga). Se cobre algum, procura entre as posições que encostam nas bordas dos painéis (em x e em
 * y, combinadas) a livre mais perto; sem nenhuma livre, a que cobre menos, poupando os fixos.
 */
export function afastarDePaineis(c: Caixa, paineis: Ret[], largTela: number, altTela: number, margem = 6): { x: number; y: number } {
  const dentroX = (x: number) => Math.min(Math.max(x, 0), Math.max(0, largTela - c.larg));
  const dentroY = (y: number) => Math.min(Math.max(y, 0), Math.max(0, altTela - c.alt));
  // primeiro para dentro da tela (o centro perto da borda deixa meio cartão fora)
  const x0 = dentroX(c.x);
  const y0 = dentroY(c.y);
  const cobre = (x: number, y: number) => custo({ ...c, x, y }, paineis, margem);
  if (cobre(x0, y0) === 0) return { x: x0, y: y0 };
  const xs = new Set([x0]);
  const ys = new Set([y0]);
  for (const p of paineis) {
    xs.add(dentroX(p.esq - margem - c.larg)).add(dentroX(p.dir + margem));
    ys.add(dentroY(p.topo - margem - c.alt)).add(dentroY(p.base + margem));
  }
  let melhor = { x: x0, y: y0, cobre: Infinity, d: Infinity };
  for (const x of xs) {
    for (const y of ys) {
      const k = cobre(x, y);
      const d = (x - x0) ** 2 + (y - y0) ** 2;
      if (k < melhor.cobre || (k === melhor.cobre && d < melhor.d)) melhor = { x, y, cobre: k, d };
    }
  }
  return { x: melhor.x, y: melhor.y };
}

/** Quantos sussurros aparecem de uma vez, pela altura da tela (px). */
export function tetoSussurros(altTela: number): number {
  return altTela < 560 ? 3 : altTela < 900 ? 4 : 6;
}

export interface Sussurro {
  id: number;
  /** Centro pedido pelo jogo, em px. */
  cx: number;
  cy: number;
  larg: number;
  alt: number;
  /** Já estava na tela no quadro anterior (fica com a vaga). */
  naTela: boolean;
}

/** Folga de quem já está na tela, na ordem por distância: evita que dois troquem de vaga a cada quadro. */
const FOLGA_NA_TELA = 0.75;

/**
 * Dá lugar aos sussurros, do mais perto do centro (o que vai acertar antes) ao mais longe; quem já
 * está na tela conta como um pouco mais perto. Cada um posto vira obstáculo para os seguintes. Quem
 * não acha lugar livre ou passa do teto fica `null` (espera a vez). Sempre aparece pelo menos um:
 * sem lugar livre, o mais urgente cobre só painéis passageiros, e o menos possível.
 */
export function distribuirSussurros(itens: Sussurro[], paineis: Ret[], largTela: number, altTela: number, margem = 6): Map<number, { x: number; y: number } | null> {
  const perto = (s: Sussurro) => Math.hypot(s.cx - largTela / 2, s.cy - altTela / 2) * (s.naTela ? FOLGA_NA_TELA : 1);
  const ordem = [...itens].sort((a, b) => perto(a) - perto(b));
  const ocupados = [...paineis];
  const teto = tetoSussurros(altTela);
  const lugares = new Map<number, { x: number; y: number } | null>();
  let postos = 0;
  for (const s of ordem) {
    const caixa = { x: s.cx - s.larg / 2, y: s.cy - s.alt / 2, larg: s.larg, alt: s.alt };
    const pos = postos < teto ? afastarDePaineis(caixa, ocupados, largTela, altTela, margem) : null;
    if (!pos || areaCoberta({ ...caixa, ...pos }, ocupados, margem) > 0) {
      lugares.set(s.id, null);
      continue;
    }
    lugares.set(s.id, pos);
    postos++;
    ocupados.push({ esq: pos.x, topo: pos.y, dir: pos.x + s.larg, base: pos.y + s.alt });
  }
  if (!postos && ordem.length) {
    const s = ordem[0];
    lugares.set(s.id, afastarDePaineis({ x: s.cx - s.larg / 2, y: s.cy - s.alt / 2, larg: s.larg, alt: s.alt }, paineis, largTela, altTela, margem));
  }
  return lugares;
}
