// Lugar livre para um cartão que anda pela tela (o sussurro das provas): se a caixa cai sobre um
// painel, ela vai para o lugar livre mais perto, sem sair da tela. Lógica pura, em px; quem mede
// os painéis é o OverlayProva.

export interface Ret {
  esq: number;
  topo: number;
  dir: number;
  base: number;
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

/**
 * Põe a caixa dentro da tela `largTela`×`altTela` e a tira de cima dos painéis (com `margem` px de
 * folga). Se cobre algum, procura entre as posições que encostam nas bordas dos painéis (em x e em
 * y, combinadas) a livre mais perto; sem nenhuma livre, a que cobre menos.
 */
export function afastarDePaineis(c: Caixa, paineis: Ret[], largTela: number, altTela: number, margem = 6): { x: number; y: number } {
  const dentroX = (x: number) => Math.min(Math.max(x, 0), Math.max(0, largTela - c.larg));
  const dentroY = (y: number) => Math.min(Math.max(y, 0), Math.max(0, altTela - c.alt));
  // primeiro para dentro da tela (o centro perto da borda deixa meio cartão fora)
  const x0 = dentroX(c.x);
  const y0 = dentroY(c.y);
  const cobre = (x: number, y: number) => paineis.reduce((s, p) => s + sobreposicao({ ...c, x, y }, p, margem), 0);
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
