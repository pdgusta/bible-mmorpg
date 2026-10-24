import type { Aparencia } from '../../entidades/humano/Vestimenta';

/** Aparências da era de Abraão (pastores de Canaã: lã tingida, listras, mantos escuros). */
export const APARENCIAS_ABRAAO: Record<string, Aparencia> = {
  abraao: {
    corpo: 'masc', altura: 1.8, pele: '#c08458',
    cabelo: { estilo: 'curto', cor: '#a49a90' }, barba: { comprimento: 0.18, cor: '#bdb4aa' },
    tunica: { cor: '#efe4cc', cor2: '#7a4a2a' }, manto: { cor: '#3e4f6e', cor2: '#c8a04a' },
    faixa: '#8a3a2a', cabeca: { tipo: 'lenco', cor: '#f2ead8', cor2: '#3a2a20' },
  },
  sara: {
    corpo: 'fem', altura: 1.68, pele: '#c8946c',
    cabelo: { estilo: 'longo', cor: '#4a3426' },
    tunica: { cor: '#b8566a', cor2: '#e8c48a' }, faixa: '#e8c48a',
    cabeca: { tipo: 'veu', cor: '#f0e2c8', cor2: '#b8566a' },
  },
  lo: {
    corpo: 'masc', altura: 1.76, pele: '#c49068',
    cabelo: { estilo: 'curto', cor: '#4a3020' }, barba: { comprimento: 0.1, cor: '#4a3020' },
    tunica: { cor: '#9a7a4a', cor2: '#5a3a20', listras: true }, manto: { cor: '#7a3a2a', comprimento: 'joelho' },
    cabeca: { tipo: 'lenco', cor: '#d8c8a8', cor2: '#7a3a2a' },
  },
  eliezer: {
    corpo: 'masc', altura: 1.83, pele: '#a87048',
    cabelo: { estilo: 'curto', cor: '#22180f' }, barba: { comprimento: 0.07, cor: '#22180f' },
    tunica: { cor: '#4e6a5a', cor2: '#c8a050', comprimento: 'joelho' }, faixa: '#c8a050',
    cabeca: { tipo: 'turbante', cor: '#e8dcc0', cor2: '#4e6a5a' },
  },
  isaque: {
    corpo: 'masc', altura: 1.68, pele: '#c8946c', cabecaEscala: 1.16,
    cabelo: { estilo: 'cacheado', cor: '#3a2618' },
    tunica: { cor: '#e8d8b0', cor2: '#5a7a9a', comprimento: 'joelho' }, faixa: '#5a7a9a',
    cabeca: { tipo: 'faixa', cor: '#5a7a9a' },
  },
  melquisedeque: {
    corpo: 'masc', altura: 1.82, pele: '#b88058',
    cabelo: { estilo: 'longo', cor: '#f0ece4' }, barba: { comprimento: 0.2, cor: '#f4f0e8' },
    tunica: { cor: '#f6f2e8', cor2: '#e8c860' }, manto: { cor: '#7a2a4a', cor2: '#e8c860' },
    cabeca: { tipo: 'turbante', cor: '#f6f2e8', cor2: '#e8c860' },
  },
};
