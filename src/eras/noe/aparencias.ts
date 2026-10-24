import type { Aparencia } from '../../entidades/humano/Vestimenta';

/** Aparências da era de Noé (pele morena quente, linho, lã e tons de terra). */
export const APARENCIAS_NOE: Record<string, Aparencia> = {
  noe: {
    corpo: 'masc', altura: 1.78, pele: '#c98f62',
    cabelo: { estilo: 'calvo', cor: '#ece6dc' }, barba: { comprimento: 0.24, cor: '#efe9df' },
    tunica: { cor: '#dccbaa', cor2: '#8a6a44' }, manto: { cor: '#6d4f3a', cor2: '#c79a52' },
    faixa: '#a8453a', cabeca: { tipo: 'lenco', cor: '#efe6d2', cor2: '#5a4030' },
  },
  sem: {
    corpo: 'masc', altura: 1.8, pele: '#b98058',
    cabelo: { estilo: 'curto', cor: '#3a2a1e' }, barba: { comprimento: 0.09, cor: '#3a2a1e' },
    tunica: { cor: '#e6d8ba', cor2: '#4f6b8a', listras: true }, faixa: '#4f6b8a',
    cabeca: { tipo: 'turbante', cor: '#f0e8d6', cor2: '#4f6b8a' },
  },
  cam: {
    corpo: 'masc', altura: 1.86, pele: '#8a5a3a',
    cabelo: { estilo: 'cacheado', cor: '#1e1612' }, barba: { comprimento: 0.05, cor: '#1e1612' },
    tunica: { cor: '#b5523a', cor2: '#6a2e22', comprimento: 'joelho' }, faixa: '#d8b060',
  },
  jafe: {
    corpo: 'masc', altura: 1.76, pele: '#c8946a',
    cabelo: { estilo: 'preso', cor: '#5a3a22' },
    tunica: { cor: '#6f8a4e', cor2: '#3e5230', comprimento: 'joelho' }, faixa: '#c8a060',
    cabeca: { tipo: 'faixa', cor: '#d86a3a' },
  },
  mulherNoe: {
    corpo: 'fem', altura: 1.66, pele: '#c08860',
    cabelo: { estilo: 'longo', cor: '#cfcac2' },
    tunica: { cor: '#8a5a7a', cor2: '#d8c090' }, faixa: '#d8c090',
    cabeca: { tipo: 'veu', cor: '#e8dcc8', cor2: '#8a5a7a' },
  },
  mulherSem: {
    corpo: 'fem', altura: 1.64, pele: '#c49068',
    cabelo: { estilo: 'longo', cor: '#2e2016' },
    tunica: { cor: '#4f6b8a', cor2: '#e0c890' }, cabeca: { tipo: 'veu', cor: '#d8e0e8', cor2: '#4f6b8a' },
  },
  mulherCam: {
    corpo: 'fem', altura: 1.68, pele: '#8e5e40',
    cabelo: { estilo: 'longo', cor: '#1a120e' },
    tunica: { cor: '#c8803a', cor2: '#6a3a1a' }, cabeca: { tipo: 'veu', cor: '#e8c890', cor2: '#a8452a' },
  },
  mulherJafe: {
    corpo: 'fem', altura: 1.62, pele: '#d09c74',
    cabelo: { estilo: 'longo', cor: '#6a4426' },
    tunica: { cor: '#a8b878', cor2: '#5a6a3a' }, cabeca: { tipo: 'veu', cor: '#f2ecd8', cor2: '#7a8a4a' },
  },
};
