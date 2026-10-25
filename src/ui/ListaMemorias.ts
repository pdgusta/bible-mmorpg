// Lista de memórias da prova de dúvida: o jogo dá as teclas 1–5 às cinco primeiras ainda não
// lembradas; só essas viram botão. As lembradas viram estrelas acesas e o resto espera
// ("+N para depois"): quando uma é lembrada, a próxima ganha a tecla. Lógica pura, sem DOM.
import type { EstadoProvaUI } from '../jogo/contratos';

export type MemoriaProva = NonNullable<EstadoProvaUI['memorias']>[number];

export interface ListaMemorias {
  /** As da vez, com tecla, em ordem de tecla. */
  daVez: (MemoriaProva & { tecla: number })[];
  /** Já lembradas nesta rodada. */
  acesas: MemoriaProva[];
  /** Não lembradas e ainda sem tecla. */
  depois: number;
}

export function dividirMemorias(mems: MemoriaProva[]): ListaMemorias {
  const daVez = mems
    .filter((m): m is MemoriaProva & { tecla: number } => !m.usada && m.tecla !== undefined)
    .sort((a, b) => a.tecla - b.tecla);
  const acesas = mems.filter((m) => m.usada);
  return { daVez, acesas, depois: mems.length - daVez.length - acesas.length };
}
