import { describe, expect, it } from 'vitest';
import { dividirMemorias, type MemoriaProva } from './ListaMemorias';

/** n memórias como o jogo manda: as `usadas` primeiro, e tecla 1..5 para as cinco primeiras livres. */
function memorias(n: number, usadas: number[] = []): MemoriaProva[] {
  let tecla = 1;
  return Array.from({ length: n }, (_, i) => {
    const usada = usadas.includes(i);
    const m: MemoriaProva = { id: `m${i}`, titulo: `Memória ${i}`, usada };
    if (!usada && tecla <= 5) m.tecla = tecla++;
    return m;
  });
}

describe('dividirMemorias', () => {
  it('com 13 memórias, só as cinco com tecla viram botão; as outras esperam', () => {
    const l = dividirMemorias(memorias(13));
    expect(l.daVez.map((m) => m.tecla)).toEqual([1, 2, 3, 4, 5]);
    expect(l.daVez.map((m) => m.id)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
    expect(l.acesas).toEqual([]);
    expect(l.depois).toBe(8);
  });

  it('as lembradas viram estrelas e a próxima livre entra no lugar', () => {
    const l = dividirMemorias(memorias(13, [0, 3]));
    expect(l.acesas.map((m) => m.id)).toEqual(['m0', 'm3']);
    expect(l.daVez.map((m) => m.id)).toEqual(['m1', 'm2', 'm4', 'm5', 'm6']);
    expect(l.depois).toBe(6);
  });

  it('memória sem tecla nunca vira botão (não há número de reserva)', () => {
    const l = dividirMemorias([
      { id: 'a', titulo: 'A', usada: false },
      { id: 'b', titulo: 'B', usada: false, tecla: 1 },
    ]);
    expect(l.daVez.map((m) => m.id)).toEqual(['b']);
    expect(l.depois).toBe(1);
  });

  it('poucas memórias: todas da vez, nada para depois', () => {
    const l = dividirMemorias(memorias(3, [1]));
    expect(l.daVez.map((m) => m.tecla)).toEqual([1, 2]);
    expect(l.acesas.length).toBe(1);
    expect(l.depois).toBe(0);
  });
});
