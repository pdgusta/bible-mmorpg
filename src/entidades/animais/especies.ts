import type { ConfigGLB } from './Corpos';
import type { DefMarcha } from './Marcha';
import type { EspecieProcedural } from './procedurais';

/** Todas as espécies disponíveis. 'boi' usa o modelo da vaca com pelagem de boi. */
export type Especie =
  | 'cavalo' | 'vaca' | 'boi' | 'zebra' | 'ovelha' | 'porco' | 'lhama' | 'gato' | 'lobo' | 'cao' | 'aguia'
  | EspecieProcedural;

export interface InfoEspecie {
  nome: string;
  glb?: ConfigGLB;
  procedural?: EspecieProcedural;
  /** Raio do corpo físico (m). */
  raio: number;
  /** Altura aproximada do lombo/cabeça (m), para câmeras e marcadores. */
  altura: number;
  velAndar: number;
  velCorrer: number;
  /** Ave que voa (voarPara, pousar). */
  voa?: boolean;
  /** Pasta/bica quando parado. */
  pastar?: boolean;
  /** Efeito de áudio da voz (Audio.efeito). */
  voz?: string;
  /** Escala da fêmea em relação ao macho. */
  escalaFemea?: number;
}

/** Marcha procedural sobre os ossos do pacote de animais de fazenda (sem clipe de andar). */
function marchaFazenda(passada: number, velRef: number): DefMarcha {
  return {
    pernas: [
      { coxa: 'BackUpLegL', canela: 'BackLowLegL', fase: 0, faseCorrida: 0.5 },
      { coxa: 'FrontUpLegL', canela: 'FrontLowLegL', fase: 0.25, faseCorrida: 0 },
      { coxa: 'BackUpLegR', canela: 'BackLowLegR', fase: 0.5, faseCorrida: 0 },
      { coxa: 'FrontUpLegR', canela: 'FrontLowLegR', fase: 0.75, faseCorrida: 0.5 },
    ],
    passada,
    passadaCorrida: passada * 2,
    amplitude: 0.42,
    amplitudeCorrida: 0.7,
    joelho: 0.6,
    velRef,
    corpo: '',
    pastarAngulo: 0.7,
  };
}

const VIRA_X = -Math.PI / 2;

export const ESPECIES: Record<Especie, InfoEspecie> = {
  // ------------------------------------------------------------ modelos glTF ---------
  cavalo: {
    nome: 'Cavalo', raio: 0.45, altura: 1.6, velAndar: 1.0, velCorrer: 4.2, pastar: true, voz: 'relincho', escalaFemea: 0.94,
    glb: {
      arquivo: 'animais/cavalo.glb', clipes: { parado: 'Idle', andar: 'WalkSlow', correr: 'Run', pulo: 'Jump' },
      velAndarClipe: 0.6, velCorrerClipe: 3.3, cabeca: 'Head', pescoco: ['Neck'],
      paleta: { 'Material.003': '#8e5b3a', 'Material.006': '#3a2a22' },
    },
  },
  vaca: {
    nome: 'Vaca', raio: 0.48, altura: 1.4, velAndar: 0.9, velCorrer: 2.8, pastar: true, voz: 'mugido', escalaFemea: 1,
    glb: {
      arquivo: 'animais/vaca.glb', clipes: { parado: 'Idle', andar: 'WalkSlow', correr: 'Run' },
      velAndarClipe: 0.67, velCorrerClipe: 2.0, cabeca: 'Head', pescoco: ['Neck'],
      paleta: { White: '#f2ece0', Black: '#4a3a32', Pink: '#dca39a' },
    },
  },
  boi: {
    nome: 'Boi', raio: 0.5, altura: 1.45, velAndar: 0.9, velCorrer: 2.8, pastar: true, voz: 'mugido', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/vaca.glb', chave: 'boi', clipes: { parado: 'Idle', andar: 'WalkSlow', correr: 'Run' },
      velAndarClipe: 0.67, velCorrerClipe: 2.0, cabeca: 'Head', pescoco: ['Neck'],
      paleta: { White: '#b9875a', Black: '#5a3d2b', Pink: '#c99a84' },
    },
  },
  zebra: {
    nome: 'Zebra', raio: 0.42, altura: 1.4, velAndar: 1.0, velCorrer: 4.0, pastar: true, voz: 'relincho', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/zebra.glb', clipes: { parado: 'Idle', andar: 'WalkSlow', correr: 'Run' },
      velAndarClipe: 0.5, velCorrerClipe: 2.7, cabeca: 'Head', pescoco: ['Neck'],
      paleta: { White: '#f2ede4', Black: '#352f2c' },
    },
  },
  ovelha: {
    nome: 'Ovelha', raio: 0.32, altura: 0.9, velAndar: 0.75, velCorrer: 2.8, pastar: true, voz: 'balido', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/ovelha.glb', clipes: { parado: 'Idle', pulo: 'Jump' }, cabeca: 'Head', pescoco: ['Neck'],
      marcha: marchaFazenda(0.55, 0.75), paleta: { White: '#f4eee2', Black: '#4d3e35' },
    },
  },
  porco: {
    nome: 'Porco', raio: 0.36, altura: 0.75, velAndar: 0.7, velCorrer: 2.4, pastar: true, voz: 'grunhido', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/porco.glb', clipes: { parado: 'Idle', pulo: 'Jump' }, cabeca: 'Head', pescoco: ['Neck'],
      marcha: marchaFazenda(0.5, 0.7), paleta: { 'Material.003': '#e7a69f', Material: '#5b3a2c' },
    },
  },
  lhama: {
    nome: 'Lhama', raio: 0.36, altura: 1.6, velAndar: 0.9, velCorrer: 3.0, pastar: true, voz: 'balido', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/lhama.glb', clipes: { parado: 'Idle', pulo: 'Jump' }, cabeca: 'Head', pescoco: ['Neck'],
      marcha: marchaFazenda(0.7, 0.9), paleta: { Brown: '#8a5f40', White: '#f1ebdf', Grey: '#5a504a' },
    },
  },
  gato: {
    nome: 'Gato', raio: 0.15, altura: 0.3, velAndar: 0.5, velCorrer: 2.5, voz: 'miado', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/gato.glb', giro: VIRA_X, clipes: { parado: 'Idle', andar: 'Walking' }, velAndarClipe: 0.25,
      cabeca: 'Bone003', paleta: { White: '#d79a5e' },
    },
  },
  lobo: {
    nome: 'Lobo', raio: 0.32, altura: 0.8, velAndar: 0.9, velCorrer: 4.0, voz: 'uivo', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/lobo.glb', giro: VIRA_X, clipes: { parado: 'Idle', andar: 'Walking' }, velAndarClipe: 0.5,
      cabeca: 'Bone003', paleta: { Wolf: '#8f8780' },
    },
  },
  cao: {
    nome: 'Cão', raio: 0.25, altura: 0.6, velAndar: 0.8, velCorrer: 3.5, voz: 'latido', escalaFemea: 0.95,
    glb: {
      arquivo: 'animais/cao.glb', giro: VIRA_X, clipes: { parado: 'Idle', andar: 'Walking' }, velAndarClipe: 0.4,
      cabeca: 'Bone003', paleta: { Dog: '#b88a55' },
    },
  },
  aguia: {
    nome: 'Águia', raio: 0.2, altura: 0.7, velAndar: 0.3, velCorrer: 9, voa: true, voz: 'grito', escalaFemea: 1,
    glb: { arquivo: 'animais/aguia.glb', clipes: { parado: 'Idle', voar: 'Flying' }, paleta: { Wings: '#7a5536' } },
  },
  // ------------------------------------------------------------ procedurais ----------
  camelo: { nome: 'Camelo', procedural: 'camelo', raio: 0.5, altura: 2.0, velAndar: 1.0, velCorrer: 3.5, pastar: true, voz: 'grunhido', escalaFemea: 0.94 },
  leao: { nome: 'Leão', procedural: 'leao', raio: 0.42, altura: 1.1, velAndar: 0.9, velCorrer: 4.5, voz: 'rugido', escalaFemea: 0.92 },
  elefante: { nome: 'Elefante', procedural: 'elefante', raio: 0.9, altura: 2.6, velAndar: 1.0, velCorrer: 2.6, pastar: true, voz: 'barrito', escalaFemea: 0.9 },
  girafa: { nome: 'Girafa', procedural: 'girafa', raio: 0.45, altura: 3.7, velAndar: 1.1, velCorrer: 3.5, pastar: true, escalaFemea: 0.92 },
  cabra: { nome: 'Cabra', procedural: 'cabra', raio: 0.25, altura: 0.85, velAndar: 0.75, velCorrer: 3.0, pastar: true, voz: 'balido', escalaFemea: 0.95 },
  carneiro: { nome: 'Carneiro', procedural: 'carneiro', raio: 0.32, altura: 0.95, velAndar: 0.75, velCorrer: 2.8, pastar: true, voz: 'balido', escalaFemea: 0.93 },
  jumento: { nome: 'Jumento', procedural: 'jumento', raio: 0.36, altura: 1.25, velAndar: 0.9, velCorrer: 3.2, pastar: true, voz: 'zurro', escalaFemea: 0.95 },
  urso: { nome: 'Urso', procedural: 'urso', raio: 0.45, altura: 1.1, velAndar: 0.8, velCorrer: 3.5, voz: 'rugido', escalaFemea: 0.92 },
  cervo: { nome: 'Cervo', procedural: 'cervo', raio: 0.3, altura: 1.25, velAndar: 0.9, velCorrer: 4.5, pastar: true, escalaFemea: 0.92 },
  pomba: { nome: 'Pomba', procedural: 'pomba', raio: 0.08, altura: 0.25, velAndar: 0.3, velCorrer: 6, voa: true, pastar: true, voz: 'arrulho', escalaFemea: 0.97 },
  corvo: { nome: 'Corvo', procedural: 'corvo', raio: 0.12, altura: 0.4, velAndar: 0.4, velCorrer: 7, voa: true, pastar: true, voz: 'corvo', escalaFemea: 0.97 },
  pato: { nome: 'Pato', procedural: 'pato', raio: 0.12, altura: 0.35, velAndar: 0.35, velCorrer: 1.2, pastar: true, voz: 'grasnado', escalaFemea: 0.95 },
  avestruz: { nome: 'Avestruz', procedural: 'avestruz', raio: 0.35, altura: 2.1, velAndar: 1.1, velCorrer: 5.5, pastar: true, escalaFemea: 0.92 },
};

export function infoEspecie(e: Especie): InfoEspecie {
  const i = ESPECIES[e];
  if (!i) throw new Error(`Espécie desconhecida: ${e}`);
  return i;
}
