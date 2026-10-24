// Personagens da era de Noé (Gn 6–9): os quatro jogáveis, a família (as mulheres, cujos nomes
// a Bíblia não registra e o jogo não inventa) e os moradores da cidade, com rotinas por hora.
import type { DefPersonagem } from '../../jogo/Personagem';
import type { EntradaRotina } from '../../jogo/IA';
import type { Aparencia } from '../../entidades/humano/Vestimenta';
import { ORDEM_ATRIBUTOS, type Atributos } from '../../jogo/Atributos';
import { APARENCIAS_NOE } from './aparencias';

/** Atributos na ordem do ROTEIRO: for, res, agi, fé, com, dom, sab, cmp, hum, per, dis, cor. */
function ficha(v: [number, number, number, number, number, number, number, number, number, number, number, number]): Atributos {
  return Object.fromEntries(ORDEM_ATRIBUTOS.map((a, i) => [a, v[i]])) as Atributos;
}

// Flags que trocam as rotinas ao longo da história (definidas pelas missões).
/** A arca está pronta e betumada (fim de A2). */
export const FLAG_ARCA_PRONTA = 'arcaPronta';
/** A família está dentro da arca (de A4 'entrar' até A6 'sair'): as rotinas param. */
export const FLAG_DENTRO_ARCA = 'dentroArca';
/** O vale depois do dilúvio (A6). */
export const FLAG_DEPOIS = 'depoisDiluvio';

const antes = (e: Omit<EntradaRotina, 'senao'>, extra?: string): EntradaRotina => ({ ...e, senao: extra ?? FLAG_ARCA_PRONTA });

// ------------------------------------------------------------------------------ jogáveis

const ROTINA_NOE: EntradaRotina[] = [
  // antes da arca ficar pronta
  antes({ de: 5, ate: 7, lugar: 'orarMonte', descricao: 'orando no monte', olhar: 'centroVale' }),
  antes({ de: 7, ate: 12, lugar: 'quilha', atividade: 'consertar', segurar: 'martelo', descricao: 'trabalhando na arca', vagar: 6 }),
  antes({ de: 12, ate: 13, lugar: 'cavalete', atividade: 'sentado', descricao: 'comendo no estaleiro' }),
  antes({ de: 13, ate: 19, lugar: 'quilha', atividade: 'consertar', segurar: 'martelo', descricao: 'trabalhando na arca', vagar: 8 }),
  antes({ de: 19, ate: 5, lugar: 'casa', descricao: 'descansando em casa', vagar: 3 }),
  // arca pronta (A3–A4)
  { de: 5, ate: 7, lugar: 'orarMonte', descricao: 'orando no monte', se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 7, ate: 19, lugar: 'portaArca', descricao: 'cuidando da arca', vagar: 6, se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 19, ate: 5, lugar: 'casa', descricao: 'descansando em casa', vagar: 3, se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  // depois do dilúvio
  { de: 0, ate: 24, lugar: 'altarPlato', descricao: 'junto do altar', vagar: 5, se: FLAG_DEPOIS },
];

const ROTINA_SEM: EntradaRotina[] = [
  antes({ de: 6, ate: 11, lugar: 'curral', atividade: 'colher', descricao: 'cuidando dos animais', vagar: 5 }),
  antes({ de: 11, ate: 13, lugar: 'cavalete', segurar: 'cesto', descricao: 'levando comida ao estaleiro', olhar: 'quilha' }),
  antes({ de: 13, ate: 19, lugar: 'curral', atividade: 'regar', segurar: 'jarro', descricao: 'dando água aos animais', vagar: 5 }),
  antes({ de: 19, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família' }),
  { de: 6, ate: 19, lugar: 'curral', atividade: 'colher', descricao: 'cuidando dos animais', vagar: 6, se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 19, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família', se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 0, ate: 24, lugar: 'altarPlato', descricao: 'junto do altar', vagar: 4, se: FLAG_DEPOIS },
];

const ROTINA_CAM: EntradaRotina[] = [
  antes({ de: 6, ate: 12, lugar: 'corteLenha', atividade: 'cortar', segurar: 'machado', descricao: 'cortando lenha no bosque' }),
  antes({ de: 12, ate: 18, lugar: 'pilhaTroncos', segurar: 'tronco', descricao: 'carregando troncos', vagar: 6 }),
  antes({ de: 18, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família' }),
  { de: 6, ate: 19, lugar: 'celeiro', descricao: 'arrumando o celeiro', vagar: 5, se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 19, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família', se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 0, ate: 24, lugar: 'descidaPlato', descricao: 'olhando o vale lavado', vagar: 6, se: FLAG_DEPOIS },
];

const ROTINA_JAFE: EntradaRotina[] = [
  antes({ de: 6, ate: 9, lugar: 'bordaBosque', descricao: 'explorando a borda do bosque', vagar: 14 }),
  antes({ de: 9, ate: 12, lugar: 'margemRio', descricao: 'explorando o rio', vagar: 12 }),
  antes({ de: 12, ate: 18, lugar: 'andaimeBase', atividade: 'interagir', descricao: 'trabalhando no andaime', vagar: 4 }),
  antes({ de: 18, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família' }),
  { de: 6, ate: 19, lugar: 'margemRio', descricao: 'olhando o horizonte', vagar: 14, se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 19, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família', se: FLAG_ARCA_PRONTA, senao: FLAG_DENTRO_ARCA },
  { de: 0, ate: 24, lugar: 'descidaPlato', descricao: 'explorando o monte', vagar: 12, se: FLAG_DEPOIS },
];

export const NOE_JOGAVEL: DefPersonagem = {
  id: 'noe', nome: 'Noé', classe: 'construtor', aparencia: APARENCIAS_NOE.noe, jogavel: true, protagonista: true,
  atributos: ficha([4, 5, 2, 7, 8, 7, 7, 6, 6, 8, 6, 5]),
  descricao: 'Homem justo, íntegro na sua geração, que andava com Deus.',
  arco: 'A obediência que persevera sem ver; pregador da justiça (2 Pe 2:5).',
  ref: 'Gn 6:9',
  rotina: ROTINA_NOE,
};

export const SEM_JOGAVEL: DefPersonagem = {
  id: 'sem', nome: 'Sem', classe: 'sacerdote', aparencia: APARENCIAS_NOE.sem, jogavel: true,
  atributos: ficha([4, 5, 4, 6, 6, 5, 5, 7, 5, 5, 5, 4]),
  descricao: 'Filho de Noé. Dele vem a linhagem da promessa (Gn 11:10).',
  arco: 'O filho que aprende a cuidar dos animais e da família.',
  ref: 'Gn 6:10',
  rotina: ROTINA_SEM,
};

export const CAM_JOGAVEL: DefPersonagem = {
  id: 'cam', nome: 'Cam', classe: 'guerreiro', aparencia: APARENCIAS_NOE.cam, jogavel: true,
  atributos: ficha([7, 6, 4, 3, 3, 3, 3, 4, 3, 5, 3, 6]),
  descricao: 'Filho de Noé.',
  arco: 'Forte e impaciente; aprende a usar a força para sustentar os outros.',
  ref: 'Gn 6:10',
  rotina: ROTINA_CAM,
};

export const JAFE_JOGAVEL: DefPersonagem = {
  id: 'jafe', nome: 'Jafé', classe: 'batedor', aparencia: APARENCIAS_NOE.jafe, jogavel: true,
  atributos: ficha([4, 5, 7, 4, 4, 4, 4, 5, 4, 4, 5, 6]),
  descricao: 'Filho de Noé.',
  arco: 'Curioso, com os olhos sempre além do horizonte.',
  ref: 'Gn 6:10',
  rotina: ROTINA_JAFE,
};

/** Os quatro jogáveis, na ordem da roda de troca (teclas 1–4). */
export const JOGAVEIS_NOE: DefPersonagem[] = [NOE_JOGAVEL, SEM_JOGAVEL, CAM_JOGAVEL, JAFE_JOGAVEL];
export const IDS_JOGAVEIS_NOE = JOGAVEIS_NOE.map((d) => d.id);

// ------------------------------------------------------------------------------ família

function rotinaMulher(manha: EntradaRotina, tarde: EntradaRotina): EntradaRotina[] {
  return [
    { ...manha, senao: FLAG_DENTRO_ARCA },
    { ...tarde, senao: FLAG_DENTRO_ARCA },
    { de: 18, ate: 6, lugar: 'fogueiraCasa', atividade: 'sentado', descricao: 'à fogueira com a família', senao: FLAG_DENTRO_ARCA },
    { de: 0, ate: 24, lugar: 'altarPlato', descricao: 'junto do altar', vagar: 6, se: FLAG_DEPOIS },
  ];
}

function mulher(id: string, nome: string, rotina: EntradaRotina[]): DefPersonagem {
  return {
    id, nome, classe: null, aparencia: APARENCIAS_NOE[id], jogavel: false,
    descricao: 'A Bíblia não registra o seu nome; o jogo não o inventa.', ref: 'Gn 7:7', rotina,
  };
}

export const FAMILIA_NOE: DefPersonagem[] = [
  mulher('mulherNoe', 'Mulher de Noé', rotinaMulher(
    { de: 6, ate: 12, lugar: 'casa', atividade: 'interagir', descricao: 'cuidando da casa', vagar: 4 },
    { de: 12, ate: 18, lugar: 'trigal', atividade: 'colher', descricao: 'colhendo no trigal', vagar: 6 },
  )),
  mulher('mulherSem', 'Mulher de Sem', rotinaMulher(
    { de: 6, ate: 12, lugar: 'poco', segurar: 'jarro', descricao: 'buscando água no poço', vagar: 3 },
    { de: 12, ate: 18, lugar: 'casa', atividade: 'interagir', descricao: 'preparando o pão', vagar: 3 },
  )),
  mulher('mulherCam', 'Mulher de Cam', rotinaMulher(
    { de: 6, ate: 12, lugar: 'trigal', atividade: 'colher', descricao: 'colhendo no trigal', vagar: 6 },
    { de: 12, ate: 18, lugar: 'fogueiraCasa', atividade: 'interagir', descricao: 'cuidando do fogo', vagar: 2 },
  )),
  mulher('mulherJafe', 'Mulher de Jafé', rotinaMulher(
    { de: 6, ate: 12, lugar: 'pomar', segurar: 'cesto', descricao: 'colhendo no pomar', vagar: 6 },
    { de: 12, ate: 18, lugar: 'poco', segurar: 'jarro', descricao: 'buscando água no poço', vagar: 3 },
  )),
];
export const IDS_FAMILIA_NOE = FAMILIA_NOE.map((d) => d.id);

// ------------------------------------------------------------------------------ cidade

const APARENCIAS_CIDADE: Record<string, Aparencia> = {
  mercador: {
    corpo: 'masc', altura: 1.74, pele: '#b07a50', cabelo: { estilo: 'curto', cor: '#2a1c12' }, barba: { comprimento: 0.12, cor: '#2a1c12' },
    tunica: { cor: '#7a3a5a', cor2: '#e0b050', listras: true }, manto: { cor: '#3a2a4a', comprimento: 'joelho' }, faixa: '#e0b050',
    cabeca: { tipo: 'turbante', cor: '#d8b878', cor2: '#7a3a5a' },
  },
  mercadora: {
    corpo: 'fem', altura: 1.64, pele: '#b88458', cabelo: { estilo: 'longo', cor: '#1e140e' },
    tunica: { cor: '#c8703a', cor2: '#3a5a7a' }, faixa: '#3a5a7a', cabeca: { tipo: 'veu', cor: '#e8d0a0', cor2: '#c8703a' },
  },
  zombador: {
    corpo: 'masc', altura: 1.8, pele: '#a06a44', cabelo: { estilo: 'cacheado', cor: '#1a120c' }, barba: { comprimento: 0.06, cor: '#1a120c' },
    tunica: { cor: '#8a2a2a', cor2: '#d8a040', comprimento: 'joelho' }, faixa: '#d8a040',
  },
  zombador2: {
    corpo: 'masc', altura: 1.76, pele: '#c08a5e', cabelo: { estilo: 'preso', cor: '#3a2618' },
    tunica: { cor: '#4a4a6a', cor2: '#c8c070', comprimento: 'joelho' }, faixa: '#c8c070', cabeca: { tipo: 'faixa', cor: '#c8c070' },
  },
  guarda: {
    corpo: 'masc', altura: 1.86, pele: '#946040', cabelo: { estilo: 'curto', cor: '#120c08' }, barba: { comprimento: 0.05, cor: '#120c08' },
    tunica: { cor: '#5a4a3a', cor2: '#2a2018', comprimento: 'joelho' }, manto: { cor: '#6a2a1a', comprimento: 'joelho' }, faixa: '#2a2018',
    cabeca: { tipo: 'lenco', cor: '#6a2a1a', cor2: '#2a2018' },
  },
  moradora: {
    corpo: 'fem', altura: 1.62, pele: '#c4926a', cabelo: { estilo: 'longo', cor: '#4a2e1c' },
    tunica: { cor: '#6a8a6a', cor2: '#e0d0a0' }, cabeca: { tipo: 'veu', cor: '#f0e4cc', cor2: '#6a8a6a' },
  },
  crianca: {
    corpo: 'masc', altura: 1.22, pele: '#c08a5e', cabelo: { estilo: 'curto', cor: '#2a1a10' }, cabecaEscala: 1.18,
    tunica: { cor: '#d8c8a0', cor2: '#8a5a3a', comprimento: 'joelho' },
  },
  menina: {
    corpo: 'fem', altura: 1.18, pele: '#b8845a', cabelo: { estilo: 'longo', cor: '#1e140c' }, cabecaEscala: 1.18,
    tunica: { cor: '#c87a8a', cor2: '#f0e0c0', comprimento: 'joelho' },
  },
};

/** Mercado de manhã, praça à tarde, casa à noite (todos somem com o dilúvio). */
function rotinaMorador(casa: number, manha: Partial<EntradaRotina> & { lugar: EntradaRotina['lugar'] }, tarde?: Partial<EntradaRotina> & { lugar: EntradaRotina['lugar'] }): EntradaRotina[] {
  return [
    { de: 6, ate: 12, descricao: 'no mercado', vagar: 4, ...manha },
    { de: 12, ate: 19, descricao: 'na praça', vagar: 6, ...(tarde ?? { lugar: 'praca' }) },
    { de: 19, ate: 6, lugar: `casaCidade${casa}`, descricao: 'em casa', vagar: 2 },
  ];
}

function morador(id: string, nome: string, aparencia: string, rotina: EntradaRotina[], velocidadeIA?: number): DefPersonagem {
  return { id, nome, classe: null, aparencia: APARENCIAS_CIDADE[aparencia], jogavel: false, rotina, velocidadeIA };
}

/** Moradores da cidade além do rio. Ninguém se converte (2 Pe 2:5): a vitória de A3 é a fidelidade. */
export const MORADORES_NOE: DefPersonagem[] = [
  morador('mercador1', 'Mercador', 'mercador', rotinaMorador(1, { lugar: 'mercado', atividade: 'falar', vagar: 2 }, { lugar: 'mercado', atividade: 'bracosCruzados', vagar: 2 })),
  morador('mercador2', 'Mercador', 'mercador', rotinaMorador(2, { lugar: 'mercado', atividade: 'falar', vagar: 5 })),
  morador('mercadora1', 'Mercadora', 'mercadora', rotinaMorador(3, { lugar: 'mercado', atividade: 'interagir', vagar: 3 }, { lugar: 'pocoCidade', segurar: 'jarro', vagar: 3 })),
  morador('zombador1', 'Zombador', 'zombador', rotinaMorador(4, { lugar: 'praca', atividade: 'bracosCruzados', vagar: 3 }, { lugar: 'pregarPraca', atividade: 'bracosCruzados', vagar: 4 })),
  morador('zombador2', 'Zombador', 'zombador2', rotinaMorador(5, { lugar: 'mercado', atividade: 'falar', vagar: 4 }, { lugar: 'pregarPraca', atividade: 'falar', vagar: 5 })),
  morador('zombador3', 'Zombador', 'zombador', rotinaMorador(6, { lugar: 'pregarMercado', atividade: 'bracosCruzados', vagar: 3 }, { lugar: 'pregarMercado', atividade: 'falar', vagar: 4 })),
  morador('guarda1', 'Guarda', 'guarda', [
    { de: 0, ate: 24, lugar: 'pregarTorre', atividade: 'bracosCruzados', descricao: 'vigiando a torre', olhar: 'praca' },
  ]),
  morador('guarda2', 'Guarda', 'guarda', [
    { de: 6, ate: 20, lugar: 'entradaCidade', atividade: 'bracosCruzados', descricao: 'vigiando a entrada', olhar: 'vau' },
    { de: 20, ate: 6, lugar: 'torre', descricao: 'de ronda', vagar: 8 },
  ]),
  morador('moradora1', 'Moradora', 'moradora', rotinaMorador(7, { lugar: 'pocoCidade', segurar: 'jarro', vagar: 3 })),
  morador('moradora2', 'Moradora', 'mercadora', rotinaMorador(8, { lugar: 'mercado', segurar: 'cesto', vagar: 6 })),
  morador('crianca1', 'Criança', 'crianca', rotinaMorador(9, { lugar: 'praca', vagar: 10 }, { lugar: 'pocoCidade', vagar: 10 }), 3.2),
  morador('crianca2', 'Criança', 'menina', rotinaMorador(10, { lugar: 'praca', vagar: 10 }, { lugar: 'praca', vagar: 12 }), 3.0),
];
export const IDS_MORADORES_NOE = MORADORES_NOE.map((d) => d.id);

/** Todos os NPCs da era (família + cidade). */
export const NPCS_NOE: DefPersonagem[] = [...FAMILIA_NOE, ...MORADORES_NOE];

/**
 * Onde cada personagem começa num jogo novo (ponto do mapa + yaw). Os moradores começam na
 * própria rotina (o orquestrador pode criá-los no ponto da entrada atual).
 */
export const INICIO_NOE: Record<string, { lugar: string; yaw: number }> = {
  noe: { lugar: 'inicio', yaw: Math.PI },
  sem: { lugar: 'curral', yaw: 0 },
  cam: { lugar: 'corteLenha', yaw: 0 },
  jafe: { lugar: 'bordaBosque', yaw: 0 },
  mulherNoe: { lugar: 'casa', yaw: 0 },
  mulherSem: { lugar: 'poco', yaw: 0 },
  mulherCam: { lugar: 'trigal', yaw: 0 },
  mulherJafe: { lugar: 'pomar', yaw: 0 },
  mercador1: { lugar: 'mercado', yaw: 0 },
  mercador2: { lugar: 'mercado', yaw: 1 },
  mercadora1: { lugar: 'mercado', yaw: 2 },
  zombador1: { lugar: 'praca', yaw: 0 },
  zombador2: { lugar: 'mercado', yaw: 3 },
  zombador3: { lugar: 'pregarMercado', yaw: 0 },
  guarda1: { lugar: 'pregarTorre', yaw: 0 },
  guarda2: { lugar: 'entradaCidade', yaw: 0 },
  moradora1: { lugar: 'pocoCidade', yaw: 0 },
  moradora2: { lugar: 'mercado', yaw: 4 },
  crianca1: { lugar: 'praca', yaw: 0 },
  crianca2: { lugar: 'praca', yaw: 2 },
};
