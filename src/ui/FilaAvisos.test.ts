import { describe, expect, it } from 'vitest';
import { duracaoAviso, FilaAvisos, type ItemAviso, limiteAvisos } from './FilaAvisos';

const chaves = (l: ItemAviso<unknown>[]) => l.map((i) => i.chave);

/** Fila com os avisos `ks` já entregues, na ordem. */
function filaCom(limite: number, ks: string[], teto?: number) {
  const f = new FilaAvisos<string>(limite, teto);
  const itens = ks.map((k) => f.entrar(k, k.toUpperCase()).item);
  return { f, itens };
}

describe('FilaAvisos', () => {
  it('mostra até o limite e põe o resto na fila', () => {
    const f = new FilaAvisos<string>(2);
    expect(f.entrar('a', 'A').tipo).toBe('mostrar');
    expect(f.entrar('b', 'B').tipo).toBe('mostrar');
    expect(f.entrar('c', 'C').tipo).toBe('esperar');
    expect(chaves(f.visiveis)).toEqual(['a', 'b']);
    expect(chaves(f.espera)).toEqual(['c']);
  });

  it('quem sai abre vaga para o primeiro da fila', () => {
    const { f, itens: [a] } = filaCom(2, ['a', 'b', 'c', 'd']);
    expect(chaves(f.sair(a))).toEqual(['c']);
    expect(chaves(f.visiveis)).toEqual(['b', 'c']);
    expect(chaves(f.espera)).toEqual(['d']);
    expect(f.sair(a)).toEqual([]);
  });

  it('aviso igual agrupa, esteja visível ou na fila', () => {
    const { f } = filaCom(1, ['a', 'b']);
    const r1 = f.entrar('a', 'A');
    const r2 = f.entrar('b', 'B');
    expect(r1.tipo).toBe('agrupar');
    expect(r1.item.n).toBe(2);
    expect(r2.tipo).toBe('agrupar');
    expect(r2.item.n).toBe(2);
    expect(f.visiveis).toHaveLength(1);
    expect(f.espera).toHaveLength(1);
  });

  it('aviso igual a um que está saindo é novo, e quem sai é o antigo', () => {
    const { f, itens: [a] } = filaCom(2, ['a']);
    f.despedir(a);
    const r = f.entrar('a', 'A');
    expect(r.tipo).toBe('mostrar');
    expect(r.item).not.toBe(a);
    f.sair(a);
    expect(f.visiveis).toEqual([r.item]);
  });

  it('a fila tem teto: o mais antigo que espera cai', () => {
    const { f } = filaCom(1, ['k0', 'k1', 'k2', 'k3', 'k4', 'k5'], 3);
    expect(chaves(f.visiveis)).toEqual(['k0']);
    expect(chaves(f.espera)).toEqual(['k3', 'k4', 'k5']);
  });

  it('limite maior promove da fila; limite menor devolve os mais novos à frente da fila', () => {
    const { f, itens: [a] } = filaCom(1, ['a', 'b', 'c', 'd']);
    const maior = f.definirLimite(3);
    expect(chaves(maior.entram)).toEqual(['b', 'c']);
    expect(maior.voltam).toEqual([]);
    const menor = f.definirLimite(1);
    expect(menor.entram).toEqual([]);
    expect(chaves(menor.voltam)).toEqual(['b', 'c']);
    expect(chaves(f.visiveis)).toEqual(['a']);
    expect(chaves(f.espera)).toEqual(['b', 'c', 'd']);
    expect(chaves(f.sair(a))).toEqual(['b']);
  });

  it('limite menor não devolve quem já está saindo', () => {
    const { f, itens: [a, b] } = filaCom(2, ['a', 'b']);
    f.despedir(b);
    expect(chaves(f.definirLimite(1).voltam)).toEqual(['a']);
    expect(f.visiveis).toEqual([b]);
    expect(chaves(f.sair(b))).toEqual(['a']);
    expect(f.sair(a)).toEqual([]);
    expect(f.visiveis).toEqual([]);
  });

  it('sair também tira da fila quem voltou para ela', () => {
    const { f, itens: [, b] } = filaCom(2, ['a', 'b']);
    f.definirLimite(1);
    expect(f.sair(b)).toEqual([]);
    expect(f.espera).toEqual([]);
    expect(chaves(f.visiveis)).toEqual(['a']);
  });
});

describe('limiteAvisos', () => {
  it('cabe menos em tela baixa', () => {
    expect(limiteAvisos(360)).toBe(2);
    expect(limiteAvisos(720)).toBe(3);
    expect(limiteAvisos(1080)).toBe(4);
  });

  it('não passa do espaço livre até a dica, mas mostra ao menos um', () => {
    // 640×360 com fonte de 12px: um aviso ocupa ~50px
    expect(limiteAvisos(360, 113, 12)).toBe(2);
    expect(limiteAvisos(360, 98, 12)).toBe(1);
    expect(limiteAvisos(360, 10, 12)).toBe(1);
    expect(limiteAvisos(1080, 2000, 17)).toBe(4);
  });

  it('conta a altura medida de cada aviso: textos longos ocupam mais de duas linhas', () => {
    // o caso da revisão (640×360): memória de 68px e xp de 55px, mais 5px entre eles, em 113px livres
    expect(limiteAvisos(360, 113, 12, [73.4, 60.8])).toBe(1);
    expect(limiteAvisos(360, 113, 12, [50, 50])).toBe(2);
    // o da fila ainda sem medida conta como um de duas linhas (50,4px a 12px)
    expect(limiteAvisos(360, 113, 12, [73.4])).toBe(1);
    expect(limiteAvisos(360, 130, 12, [73.4])).toBe(2);
    expect(limiteAvisos(720, 200, 12, [40, undefined, 40])).toBe(3);
    expect(limiteAvisos(360, 30, 12, [73.4])).toBe(1);
  });
});

describe('duracaoAviso', () => {
  it('avisos marcantes ficam mais; com fila, todos encurtam', () => {
    expect(duracaoAviso('xp', false)).toBe(4200);
    expect(duracaoAviso('memoria', false)).toBe(5600);
    expect(duracaoAviso('xp', true)).toBeLessThan(4200);
    expect(duracaoAviso('memoria', true)).toBeLessThan(5600);
    expect(duracaoAviso('memoria', true)).toBeGreaterThan(duracaoAviso('xp', true));
  });
});
