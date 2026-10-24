// Personagens da era de Abraão (Gn 12–22): os cinco jogáveis, os NPCs que vivem em Canaã
// (Melquisedeque, o rei de Sodoma, os aliados amorreus, pastores e servos) e os NPCs de cena
// criados só durante uma missão (o fugitivo, as sentinelas e os guerreiros do oriente, os
// cativos de Sodoma). Os nomes de Abrão e Sarai mudam pelas flags de Gn 17:5 e 17:15.
import type { DefPersonagem } from '../../jogo/Personagem';
import type { EntradaRotina } from '../../jogo/IA';
import type { Aparencia } from '../../entidades/humano/Vestimenta';
import { ORDEM_ATRIBUTOS, type Atributos } from '../../jogo/Atributos';
import { APARENCIAS_ABRAAO } from './aparencias';

/** Atributos na ordem do ROTEIRO: for, res, agi, fé, com, dom, sab, cmp, hum, per, dis, cor. */
function ficha(v: [number, number, number, number, number, number, number, number, number, number, number, number]): Atributos {
  return Object.fromEntries(ORDEM_ATRIBUTOS.map((a, i) => [a, v[i]])) as Atributos;
}

// Flags que trocam nomes e rotinas ao longo da história (definidas pelas missões).
/** Gn 17:5: Abrão passa a se chamar Abraão. */
export const FLAG_NOME_ABRAAO = 'nomeAbraao';
/** Gn 17:15: Sarai passa a se chamar Sara. */
export const FLAG_NOME_SARA = 'nomeSara';
/** O acampamento foi para os carvalhais de Manre (fim de B2). */
export const FLAG_MANRE = 'emManre';
/** Ló se apartou de Abrão (B2). */
export const FLAG_LO_PARTIU = 'loPartiu';
/** Isaque nasceu (B5). */
export const FLAG_ISAQUE = 'isaqueNasceu';

// ------------------------------------------------------------------------------ jogáveis

const ROTINA_ABRAAO: EntradaRotina[] = [
  { de: 5, ate: 7, lugar: 'tendaAbrao', descricao: 'orando diante da tenda', olhar: 'fogueiraAcampamento' },
  { de: 7, ate: 12, lugar: 'manre', descricao: 'olhando os rebanhos', vagar: 14, se: FLAG_MANRE },
  { de: 7, ate: 12, lugar: 'pasto', descricao: 'olhando os rebanhos', vagar: 14 },
  { de: 12, ate: 14, lugar: 'tendaAbrao', atividade: 'sentado', descricao: 'à sombra da tenda' },
  { de: 14, ate: 19, lugar: 'acampamento', descricao: 'conversando com os servos', vagar: 8 },
  { de: 19, ate: 5, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];

const ROTINA_SARA: EntradaRotina[] = [
  { de: 6, ate: 11, lugar: 'tendaSara', atividade: 'interagir', descricao: 'preparando o pão', vagar: 3 },
  { de: 11, ate: 13, lugar: 'carvalhoManre', segurar: 'jarro', descricao: 'buscando água', vagar: 4, se: FLAG_MANRE },
  { de: 11, ate: 13, lugar: 'poco', segurar: 'jarro', descricao: 'buscando água no poço', vagar: 3 },
  { de: 13, ate: 18, lugar: 'tendaSara', atividade: 'sentado', descricao: 'tecendo junto à tenda' },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];

const ROTINA_LO: EntradaRotina[] = [
  { de: 6, ate: 12, lugar: 'curralLo', segurar: 'cajado', descricao: 'cuidando das suas ovelhas', vagar: 8 },
  { de: 12, ate: 18, lugar: 'pasto', segurar: 'cajado', descricao: 'olhando a planície', vagar: 12 },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];

const ROTINA_ELIEZER: EntradaRotina[] = [
  { de: 6, ate: 12, lugar: 'acampamento', segurar: 'cajado', descricao: 'organizando os servos', vagar: 10 },
  { de: 12, ate: 18, lugar: 'manre', segurar: 'cajado', descricao: 'contando o gado', vagar: 12, se: FLAG_MANRE },
  { de: 12, ate: 18, lugar: 'curralAbrao', segurar: 'cajado', descricao: 'contando o gado', vagar: 8 },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];

const ROTINA_ISAQUE: EntradaRotina[] = [
  { de: 6, ate: 12, lugar: 'acampamento', descricao: 'brincando entre as tendas', vagar: 12 },
  { de: 12, ate: 18, lugar: 'manre', descricao: 'correndo pelos carvalhais', vagar: 16 },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];

export const ABRAAO_JOGAVEL: DefPersonagem = {
  id: 'abraao', nome: 'Abrão', nomeAlternativo: { flag: FLAG_NOME_ABRAAO, nome: 'Abraão' },
  classe: 'profeta', aparencia: APARENCIAS_ABRAAO.abraao, jogavel: true, protagonista: true,
  atributos: ficha([4, 5, 3, 7, 7, 6, 7, 6, 7, 6, 6, 6]),
  descricao: 'Chamado a sair da sua terra para a terra que Deus lhe mostraria.',
  arco: 'A fé que obedece sem saber para onde vai (Hb 11:8). Herda de Noé o altar (construirAltar, aplicado em B1).',
  ref: 'Gn 20:7',
  rotina: ROTINA_ABRAAO,
};

export const SARA_JOGAVEL: DefPersonagem = {
  id: 'sara', nome: 'Sarai', nomeAlternativo: { flag: FLAG_NOME_SARA, nome: 'Sara' },
  classe: 'hospitaleiro', aparencia: APARENCIAS_ABRAAO.sara, jogavel: true,
  atributos: ficha([3, 5, 4, 5, 6, 6, 6, 8, 6, 7, 6, 5]),
  descricao: 'Mulher de Abrão.',
  arco: 'A esperança provada; o riso (Gn 21:6).',
  ref: 'Gn 12:5',
  rotina: ROTINA_SARA,
};

export const LO_JOGAVEL: DefPersonagem = {
  id: 'lo', nome: 'Ló', classe: 'pastor', aparencia: APARENCIAS_ABRAAO.lo, jogavel: true,
  atributos: ficha([5, 6, 6, 4, 3, 4, 4, 5, 3, 4, 3, 5]),
  descricao: 'Sobrinho de Abrão, filho de seu irmão.',
  arco: 'Escolhe pela vista (Gn 13:10-11) e é resgatado (Gn 14:16).',
  ref: 'Gn 12:5',
  rotina: ROTINA_LO,
};

export const ELIEZER_JOGAVEL: DefPersonagem = {
  id: 'eliezer', nome: 'Eliézer', classe: 'guerreiro', aparencia: APARENCIAS_ABRAAO.eliezer, jogavel: true,
  atributos: ficha([6, 7, 5, 5, 5, 6, 6, 5, 6, 6, 5, 7]),
  descricao: 'Eliézer de Damasco, o mordomo da casa de Abrão.',
  arco: 'Fiel administrador; lidera um flanco dos servos treinados.',
  ref: 'Gn 15:2',
  rotina: ROTINA_ELIEZER,
};

export const ISAQUE_JOGAVEL: DefPersonagem = {
  id: 'isaque', nome: 'Isaque', classe: 'batedor', aparencia: APARENCIAS_ABRAAO.isaque, jogavel: true,
  atributos: ficha([4, 5, 7, 6, 5, 6, 4, 6, 7, 6, 4, 6]),
  descricao: 'O filho da promessa.',
  arco: 'A confiança no pai e em Deus (Gn 22:7-8).',
  ref: 'Gn 21:3',
  rotina: ROTINA_ISAQUE,
};

/** Os cinco jogáveis, na ordem da roda de troca (teclas 1–5). */
export const JOGAVEIS_ABRAAO: DefPersonagem[] = [ABRAAO_JOGAVEL, SARA_JOGAVEL, LO_JOGAVEL, ELIEZER_JOGAVEL, ISAQUE_JOGAVEL];
export const IDS_JOGAVEIS_ABRAAO = JOGAVEIS_ABRAAO.map((d) => d.id);

/**
 * Quem pode ser controlado em cada missão (ROTEIRO, tabela da era 2). Ló sai depois de B2
 * (volta como NPC, cativo, em B3); Isaque só existe em B5; em B5 Sara e Eliézer ficam no
 * acampamento.
 */
export const ELENCO_ABRAAO: Record<string, string[]> = {
  b1: ['abraao', 'sara', 'lo', 'eliezer'],
  b2: ['abraao', 'sara', 'lo', 'eliezer'],
  b3: ['abraao', 'eliezer'],
  b4: ['abraao', 'sara', 'eliezer'],
  b5: ['abraao', 'isaque'],
};

// ------------------------------------------------------------------------------ NPCs de Canaã

const APARENCIAS_NPC: Record<string, Aparencia> = {
  reiSodoma: {
    corpo: 'masc', altura: 1.78, pele: '#b07a50', cabelo: { estilo: 'preso', cor: '#1a120c' }, barba: { comprimento: 0.1, cor: '#1a120c' },
    tunica: { cor: '#6a2a5a', cor2: '#e0b040', listras: true }, manto: { cor: '#a0302a', cor2: '#e0b040' }, faixa: '#e0b040',
    cabeca: { tipo: 'turbante', cor: '#e0b040', cor2: '#6a2a5a' },
  },
  aliado: {
    corpo: 'masc', altura: 1.8, pele: '#a87048', cabelo: { estilo: 'cacheado', cor: '#22180f' }, barba: { comprimento: 0.12, cor: '#22180f' },
    tunica: { cor: '#8a5a3a', cor2: '#d8c08a', comprimento: 'joelho' }, manto: { cor: '#4a3a2a', comprimento: 'joelho' }, faixa: '#d8c08a',
    cabeca: { tipo: 'faixa', cor: '#d8c08a' },
  },
  aliado2: {
    corpo: 'masc', altura: 1.76, pele: '#b8845a', cabelo: { estilo: 'curto', cor: '#3a2618' }, barba: { comprimento: 0.15, cor: '#3a2618' },
    tunica: { cor: '#6a6a3a', cor2: '#c8a060', comprimento: 'joelho' }, faixa: '#c8a060',
    cabeca: { tipo: 'lenco', cor: '#e8dcc0', cor2: '#6a6a3a' },
  },
  pastorAbrao: {
    corpo: 'masc', altura: 1.72, pele: '#c08a5e', cabelo: { estilo: 'curto', cor: '#2a1a10' }, barba: { comprimento: 0.08, cor: '#2a1a10' },
    tunica: { cor: '#d8c8a0', cor2: '#8a5a3a', comprimento: 'joelho' }, faixa: '#8a5a3a',
    cabeca: { tipo: 'lenco', cor: '#efe4cc', cor2: '#8a5a3a' },
  },
  pastorLo: {
    corpo: 'masc', altura: 1.74, pele: '#a06a44', cabelo: { estilo: 'cacheado', cor: '#1a120c' }, barba: { comprimento: 0.06, cor: '#1a120c' },
    tunica: { cor: '#7a3a2a', cor2: '#d8a860', comprimento: 'joelho' }, faixa: '#d8a860',
    cabeca: { tipo: 'lenco', cor: '#d8c8a8', cor2: '#7a3a2a' },
  },
  servo: {
    corpo: 'masc', altura: 1.75, pele: '#b88458', cabelo: { estilo: 'curto', cor: '#2a1c12' }, barba: { comprimento: 0.05, cor: '#2a1c12' },
    tunica: { cor: '#c8b890', cor2: '#5a4a3a', comprimento: 'joelho' }, faixa: '#5a4a3a',
  },
  servo2: {
    corpo: 'masc', altura: 1.7, pele: '#946040', cabelo: { estilo: 'preso', cor: '#120c08' },
    tunica: { cor: '#9a8a6a', cor2: '#3e4f6e', comprimento: 'joelho' }, faixa: '#3e4f6e',
    cabeca: { tipo: 'faixa', cor: '#3e4f6e' },
  },
  fugitivo: {
    corpo: 'masc', altura: 1.7, pele: '#c4926a', cabelo: { estilo: 'curto', cor: '#4a2e1c' },
    tunica: { cor: '#a89880', cor2: '#6a5a4a', comprimento: 'joelho' }, faixa: '#6a5a4a',
  },
  guerreiroOriente: {
    corpo: 'masc', altura: 1.84, pele: '#9a6040', cabelo: { estilo: 'preso', cor: '#0e0a06' }, barba: { comprimento: 0.14, cor: '#0e0a06' },
    tunica: { cor: '#3a2a2a', cor2: '#8a2a1a', comprimento: 'joelho' }, manto: { cor: '#5a1a14', comprimento: 'joelho' }, faixa: '#8a2a1a',
    cabeca: { tipo: 'turbante', cor: '#2a2018', cor2: '#8a2a1a' },
  },
  cativo: {
    corpo: 'masc', altura: 1.72, pele: '#b88458', cabelo: { estilo: 'curto', cor: '#3a2618' },
    tunica: { cor: '#b0a080', cor2: '#7a6a4a', comprimento: 'joelho' },
  },
  cativa: {
    corpo: 'fem', altura: 1.62, pele: '#c8946c', cabelo: { estilo: 'longo', cor: '#2a1a10' },
    tunica: { cor: '#9a7a6a', cor2: '#e0d0b0' }, cabeca: { tipo: 'veu', cor: '#d8ccb0', cor2: '#9a7a6a' },
  },
};

function npc(id: string, nome: string, aparencia: Aparencia, rotina: EntradaRotina[], extra: Partial<DefPersonagem> = {}): DefPersonagem {
  return { id, nome, classe: null, aparencia, jogavel: false, rotina, ...extra };
}

export const MELQUISEDEQUE: DefPersonagem = npc('melquisedeque', 'Melquisedeque', APARENCIAS_ABRAAO.melquisedeque, [
  { de: 6, ate: 18, lugar: 'salem', descricao: 'em Salém', vagar: 6 },
  { de: 18, ate: 6, lugar: 'altarSalem', descricao: 'junto ao altar de Salém', olhar: 'salem' },
], { descricao: 'Rei de Salém, sacerdote do Deus Altíssimo.', ref: 'Gn 14:18' });

export const REI_SODOMA: DefPersonagem = npc('reiSodoma', 'Rei de Sodoma', APARENCIAS_NPC.reiSodoma, [
  { de: 0, ate: 24, lugar: 'sodomaLonge', descricao: 'em Sodoma', vagar: 8 },
], { ref: 'Gn 14:17' });

const ROTINA_ALIADO = (vagar: number): EntradaRotina[] => [
  { de: 6, ate: 19, lugar: 'aliadosManre', descricao: 'no acampamento dos amorreus', vagar },
  { de: 19, ate: 6, lugar: 'aliadosManre', atividade: 'sentado', descricao: 'junto ao fogo' },
];

/** Aner, Escol e Manre, os amorreus confederados de Abrão (Gn 14:13, 14:24). */
export const ALIADOS_ABRAAO: DefPersonagem[] = [
  npc('aner', 'Aner', APARENCIAS_NPC.aliado, ROTINA_ALIADO(4), { ref: 'Gn 14:24' }),
  npc('escol', 'Escol', APARENCIAS_NPC.aliado2, ROTINA_ALIADO(5), { ref: 'Gn 14:24' }),
  npc('manreAmorreu', 'Manre', APARENCIAS_NPC.aliado, ROTINA_ALIADO(3), { ref: 'Gn 14:13' }),
];

const ROTINA_PASTOR_ABRAAO = (vagar: number): EntradaRotina[] => [
  { de: 6, ate: 18, lugar: 'manre', segurar: 'cajado', descricao: 'pastoreando', vagar, se: FLAG_MANRE },
  { de: 6, ate: 18, lugar: 'pasto', segurar: 'cajado', descricao: 'pastoreando', vagar },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];
const ROTINA_PASTOR_LO = (vagar: number): EntradaRotina[] => [
  { de: 6, ate: 18, lugar: 'curralLo', segurar: 'cajado', descricao: 'pastoreando', vagar },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];
const ROTINA_SERVO = (manha: string, vagar: number): EntradaRotina[] => [
  { de: 6, ate: 12, lugar: manha, descricao: 'trabalhando no acampamento', vagar, atividade: 'interagir' },
  { de: 12, ate: 18, lugar: 'acampamento', descricao: 'cuidando das tendas', vagar: 10 },
  { de: 18, ate: 6, lugar: 'fogueiraAcampamento', atividade: 'sentado', descricao: 'junto ao fogo' },
];

/** Pastores sem nome (Gn 13:7). */
export const PASTORES_ABRAAO: DefPersonagem[] = [
  npc('pastorAbrao1', 'Pastor de Abrão', APARENCIAS_NPC.pastorAbrao, ROTINA_PASTOR_ABRAAO(12)),
  npc('pastorAbrao2', 'Pastor de Abrão', APARENCIAS_NPC.pastorAbrao, ROTINA_PASTOR_ABRAAO(16)),
  npc('pastorLo1', 'Pastor de Ló', APARENCIAS_NPC.pastorLo, ROTINA_PASTOR_LO(10)),
  npc('pastorLo2', 'Pastor de Ló', APARENCIAS_NPC.pastorLo, ROTINA_PASTOR_LO(14)),
];
export const IDS_PASTORES_LO = ['pastorLo1', 'pastorLo2'];

/**
 * Servos da casa de Abrão. Representam os 318 servos treinados (Gn 14:14); servo1 e servo2
 * são também os dois servos que vão com Abraão ao Moriá (Gn 22:3).
 */
export const SERVOS_ABRAAO: DefPersonagem[] = [
  npc('servo1', 'Servo de Abrão', APARENCIAS_NPC.servo, ROTINA_SERVO('tendaAbrao', 6), { nomeAlternativo: { flag: FLAG_NOME_ABRAAO, nome: 'Servo de Abraão' } }),
  npc('servo2', 'Servo de Abrão', APARENCIAS_NPC.servo2, ROTINA_SERVO('fogueiraAcampamento', 5), { nomeAlternativo: { flag: FLAG_NOME_ABRAAO, nome: 'Servo de Abraão' } }),
  npc('servo3', 'Servo de Abrão', APARENCIAS_NPC.servo, ROTINA_SERVO('tendaSara', 6), { nomeAlternativo: { flag: FLAG_NOME_ABRAAO, nome: 'Servo de Abraão' } }),
  npc('servo4', 'Servo de Abrão', APARENCIAS_NPC.servo2, ROTINA_SERVO('acampamento', 8), { nomeAlternativo: { flag: FLAG_NOME_ABRAAO, nome: 'Servo de Abraão' } }),
];
/** Os grupos de servos treinados que seguem Abrão e Eliézer na noite de Dã (Gn 14:15). */
export const GRUPOS_B3: Record<'abraao' | 'eliezer', string[]> = { abraao: ['servo1', 'servo2'], eliezer: ['servo3', 'servo4'] };
/** Os dois servos de Gn 22:3. */
export const SERVOS_MORIA = ['servo1', 'servo2'];

/** NPCs que vivem em Canaã a era inteira. */
export const NPCS_ABRAAO: DefPersonagem[] = [MELQUISEDEQUE, REI_SODOMA, ...ALIADOS_ABRAAO, ...PASTORES_ABRAAO, ...SERVOS_ABRAAO];
export const IDS_NPCS_ABRAAO = NPCS_ABRAAO.map((d) => d.id);

// ------------------------------------------------------------------------------ NPCs de cena

/** "Um que havia escapado" (Gn 14:13). */
export const FUGITIVO: DefPersonagem = npc('fugitivo', 'Um que havia escapado', APARENCIAS_NPC.fugitivo, [], { ref: 'Gn 14:13', velocidadeIA: 4.8 });

/** Sentinelas do acampamento dos reis do oriente (rondam com tochas) e os que dormem nas tendas. */
export const SENTINELAS_B3 = ['sentinela1', 'sentinela2', 'sentinela3', 'sentinela4'];
export const GUERREIROS_B3 = ['guerreiro1', 'guerreiro2'];
/** Os 6 guerreiros da batalha de B3: as sentinelas acordam os que dormiam. */
export const INIMIGOS_B3 = [...SENTINELAS_B3, ...GUERREIROS_B3];
/** Os cativos de Sodoma (Gn 14:12, 14:16); Ló é o quinto (cativo5), solto por último. */
export const CATIVOS_B3 = ['cativo1', 'cativo2', 'cativo3', 'cativo4'];

export const NPCS_CENA_ABRAAO: Record<string, DefPersonagem> = {
  fugitivo: FUGITIVO,
  ...Object.fromEntries(INIMIGOS_B3.map((id) => [id, npc(id, 'Guerreiro do oriente', APARENCIAS_NPC.guerreiroOriente, [], { velocidadeIA: 3.4 })])),
  ...Object.fromEntries(CATIVOS_B3.map((id, i) => [id, npc(id, 'Cativo de Sodoma', i % 2 ? APARENCIAS_NPC.cativa : APARENCIAS_NPC.cativo, [])])),
};

/**
 * Onde cada personagem começa ao entrar na era (B1: a caravana chega ao carvalho de Moré).
 * Isaque fica fora de cena até B5 (`bastidor`).
 */
export const INICIO_ABRAAO: Record<string, { lugar: string; yaw: number }> = {
  abraao: { lugar: 'chegada', yaw: Math.PI },
  sara: { lugar: 'caravana', yaw: Math.PI },
  lo: { lugar: 'caravana', yaw: Math.PI * 0.8 },
  eliezer: { lugar: 'caravana', yaw: Math.PI * 1.2 },
  isaque: { lugar: 'bastidor', yaw: 0 },
  melquisedeque: { lugar: 'salem', yaw: 0 },
  reiSodoma: { lugar: 'sodomaLonge', yaw: 0 },
  aner: { lugar: 'aliadosManre', yaw: 0 },
  escol: { lugar: 'aliadosManre', yaw: 2 },
  manreAmorreu: { lugar: 'aliadosManre', yaw: 4 },
  pastorAbrao1: { lugar: 'pasto', yaw: 0 },
  pastorAbrao2: { lugar: 'pasto', yaw: 2 },
  pastorLo1: { lugar: 'curralLo', yaw: 0 },
  pastorLo2: { lugar: 'curralLo', yaw: 3 },
  servo1: { lugar: 'acampamentoBetel', yaw: 0 },
  servo2: { lugar: 'acampamentoBetel', yaw: 1.5 },
  servo3: { lugar: 'acampamentoBetel', yaw: 3 },
  servo4: { lugar: 'acampamentoBetel', yaw: 4.5 },
};
