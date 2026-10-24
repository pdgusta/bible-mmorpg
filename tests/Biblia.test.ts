import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  bibliaCarregada, capitulosLeitura, carregarBiblia, existe, expandirRef, extenso, nomeLivro, partesRef,
  textoCapitulo, textoLinha, trecho, versiculo,
} from '../src/jogo/Biblia';

describe('Biblia', () => {
  beforeAll(async () => {
    await carregarBiblia();
  });

  it('carrega versiculos.json uma vez', async () => {
    expect(bibliaCarregada()).toBe(true);
    const a = await carregarBiblia();
    const b = await carregarBiblia();
    expect(a).toBe(b);
    expect(Object.keys(a.versiculos).length).toBeGreaterThan(100);
  });

  it('decompõe e expande referências', () => {
    expect(partesRef('Gn 6:14-16')).toEqual({ livro: 'Gn', capitulo: 6, inicio: 14, fim: 16 });
    expect(partesRef('1Pe 3:20')).toEqual({ livro: '1Pe', capitulo: 3, inicio: 20, fim: 20 });
    expect(expandirRef('Ec 4:9-10')).toEqual(['Ec 4:9', 'Ec 4:10']);
    expect(() => partesRef('Gn 6.14')).toThrow(/inválida/);
    expect(() => partesRef('Gn 6:16-14')).toThrow(/invertido/);
  });

  it('escreve a referência por extenso', () => {
    expect(extenso('Gn 6:14')).toBe('Gênesis 6:14');
    expect(extenso('Gn 6:14-16')).toBe('Gênesis 6:14-16');
    expect(extenso('2Pe 2:5')).toBe('2 Pedro 2:5');
    expect(nomeLivro('Ef')).toBe('Efésios');
  });

  it('devolve um versículo com as três traduções', () => {
    const v = versiculo('Gn 6:14');
    expect(v.ref).toBe('Gn 6:14');
    expect(v.referenciaExtenso).toBe('Gênesis 6:14');
    expect(v.bkj.length).toBeGreaterThan(20);
    expect(v.nvt).toBeTypeOf('string');
    expect(v.kjv).toBeTypeOf('string');
  });

  it('junta os versos de um intervalo', () => {
    const v = versiculo('Gn 6:14-16');
    const partes = ['Gn 6:14', 'Gn 6:15', 'Gn 6:16'].map((r) => versiculo(r).bkj);
    expect(v.bkj).toBe(partes.join(' '));
    expect(v.referenciaExtenso).toBe('Gênesis 6:14-16');
  });

  it('lança para versículo ausente e informa existência', () => {
    expect(existe('Gn 6:14')).toBe(true);
    expect(existe('Gn 6:14-16')).toBe(true);
    expect(existe('Gn 99:1')).toBe(false);
    expect(existe('lixo')).toBe(false);
    expect(() => versiculo('Gn 99:1')).toThrow(/ausente/);
  });

  it('valida trechos: substring exata passa, outra coisa lança em DEV', () => {
    const inteiro = versiculo('Gn 6:22').bkj;
    const parte = inteiro.slice(0, Math.floor(inteiro.length / 2));
    expect(trecho('Gn 6:22', parte)).toBe(parte);
    expect(trecho('Gn 6:22')).toBe(inteiro);
    expect(textoLinha({ quem: 'narrador', ref: 'Gn 6:22' })).toBe(inteiro);
    expect(textoLinha({ quem: 'narrador', ref: 'Gn 6:22', trecho: parte })).toBe(parte);
    expect(() => trecho('Gn 6:22', `${parte} [inventado]`)).toThrow(/Trecho não encontrado/);
  });

  it('em produção, trecho inválido mostra o versículo inteiro (nunca texto que não está na fonte)', () => {
    vi.stubEnv('DEV', false);
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const inteiro = versiculo('Gn 6:22').bkj;
      expect(trecho('Gn 6:22', 'isto não está lá')).toBe(inteiro);
      expect(aviso).toHaveBeenCalled();
    } finally {
      aviso.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('lista os capítulos de leitura e o texto de um capítulo', () => {
    const caps = capitulosLeitura();
    expect(caps.length).toBeGreaterThan(0);
    const gn6 = caps.find((c) => c.livro === 'Gn' && c.capitulo === 6);
    expect(gn6?.titulo).toBe('Gênesis 6');
    const versos = textoCapitulo('Gn', 6);
    expect(versos.length).toBe(gn6!.versos);
    expect(versos[13].ref).toBe('Gn 6:14');
    expect(versos[13].numero).toBe(14);
    expect(versos[13].bkj).toBe(versiculo('Gn 6:14').bkj);
  });
});
