// ?dev&missao=b3: o novo jogo começa pela era que tem a missão (antes, sempre pela de Noé).
import { describe, it, expect } from 'vitest';
import { eraDaMissao, ORDEM_ERAS } from '../src/jogo/eras';

describe('eraDaMissao', () => {
  it('acha a era de cada missão', () => {
    expect(eraDaMissao('a1')).toBe('noe');
    expect(eraDaMissao('a6')).toBe('noe');
    for (const m of ['b1', 'b2', 'b3', 'b4', 'b5']) expect(eraDaMissao(m)).toBe('abraao');
  });

  it('missão desconhecida: null (o novo jogo fica na primeira era)', () => {
    expect(eraDaMissao('z9')).toBeNull();
    expect(ORDEM_ERAS[0]).toBe('noe');
  });
});
