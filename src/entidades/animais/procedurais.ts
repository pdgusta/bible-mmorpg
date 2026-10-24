import * as THREE from 'three';
import { Montador, elipsoide, membro, cone, tubo, curva, octaedro, leque, manchas, ruido3, type Cor, type V3 } from './Montador';
import type { DefMarcha } from './Marcha';

/**
 * Espécies procedurais low-poly (estilo Quaternius: cores chapadas suaves, olhos simples).
 * Cada construtor monta ossos + peças rígidas num Montador e devolve a definição da marcha.
 * Convenção: +Z frente, Y para cima, pés em y = 0, esquerda (E) em +X, direita (D) em -X.
 */

export type Sexo = 'macho' | 'femea';

export interface ModeloProcedural {
  montador: Montador;
  marcha: DefMarcha;
  /** Osso da cabeça (para olhar, prender objetos, o arbusto do carneiro...). */
  cabeca: string;
}

export type ConstrutorProcedural = (sexo: Sexo) => ModeloProcedural;

const espelhar = (p: V3, s: number): V3 => [p[0] * s, p[1], p[2]];

// ------------------------------------------------------------------ peças comuns -----

interface Pernas {
  /** Altura das juntas dianteiras (topo das pernas) e traseiras. */
  ombro: number;
  quadril?: number;
  frente: number;
  tras: number;
  meia: number;
  meiaTras?: number;
  /** Fração da altura onde fica o joelho. */
  joelho?: number;
  r: [number, number, number];
  rTras?: [number, number, number];
  cor: Cor;
  /** Cor da parte de cima da perna (lã, pelagem do corpo). */
  corCoxa?: Cor;
  corBaixo?: Cor;
  corPe: Cor;
  pe: number;
  tipoPe: 'casco' | 'pata' | 'almofada';
  lados?: number;
}

function pernas(m: Montador, P: Pernas) {
  const lados = P.lados ?? 5;
  const lista: [string, number, number, boolean][] = [
    ['FE', P.meia, P.frente, false],
    ['FD', -P.meia, P.frente, false],
    ['TE', P.meiaTras ?? P.meia, P.tras, true],
    ['TD', -(P.meiaTras ?? P.meia), P.tras, true],
  ];
  for (const [s, x, z, tras] of lista) {
    const yTopo = tras ? (P.quadril ?? P.ombro) : P.ombro;
    const yk = yTopo * (P.joelho ?? 0.5);
    const zk = tras ? z - 0.07 * yTopo : z + 0.015 * yTopo;
    const r = tras ? (P.rTras ?? P.r) : P.r;
    m.osso('coxa' + s, 'raiz', x, yTopo, z);
    m.osso('canela' + s, 'coxa' + s, x, yk, zk);
    m.parte('coxa' + s, membro([x, yTopo + r[0] * 1.2, z], [x, yk, zk], r[0], r[1], lados, true), P.corCoxa ?? P.cor);
    m.parte('canela' + s, membro([x, yk + r[1] * 1.2, zk], [x, P.pe, z], r[1] * 1.05, r[2], lados, true), P.corBaixo ?? P.cor);
    if (P.tipoPe === 'casco') {
      m.parte('canela' + s, membro([x, P.pe, z], [x, 0, z + r[2] * 0.15], r[2] * 1.12, r[2] * 1.32, lados), P.corPe);
    } else if (P.tipoPe === 'pata') {
      m.parte('canela' + s, elipsoide([x, P.pe * 0.55, z + r[2] * 0.45], [r[2] * 1.3, P.pe * 0.75, r[2] * 1.7], 0), P.corPe);
    } else {
      m.parte('canela' + s, elipsoide([x, P.pe * 0.5, z + r[2] * 0.2], [r[2] * 1.6, P.pe * 0.7, r[2] * 1.9], 0), P.corPe);
    }
  }
}

function olhos(m: Montador, osso: string, x: number, y: number, z: number, r: number, cor: Cor = '#1f1712') {
  for (const s of [1, -1]) m.parte(osso, octaedro([x * s, y, z], [r * 0.7, r, r]), cor, { sombra: 0 });
}

interface OpMarchaQuad extends Partial<DefMarcha> {
  passada: number;
  velRef: number;
  /** Marcha em "passo de camelo" (pernas do mesmo lado juntas). */
  andadura?: boolean;
}

function marchaQuad(o: OpMarchaQuad): DefMarcha {
  const andadura = o.andadura ?? false;
  return {
    pernas: [
      { coxa: 'coxaTE', canela: 'canelaTE', fase: 0, faseCorrida: 0.5 },
      { coxa: 'coxaFE', canela: 'canelaFE', fase: andadura ? 0.06 : 0.25, faseCorrida: 0 },
      { coxa: 'coxaTD', canela: 'canelaTD', fase: 0.5, faseCorrida: 0 },
      { coxa: 'coxaFD', canela: 'canelaFD', fase: andadura ? 0.56 : 0.75, faseCorrida: 0.5 },
    ],
    passadaCorrida: o.passada * 2.1,
    amplitude: 0.36,
    amplitudeCorrida: 0.68,
    joelho: 0.75,
    corpo: 'corpo',
    quique: 0.02,
    pastarAngulo: 0.9,
    caudaEixo: 'y',
    gingado: andadura ? 0.035 : 0,
    ...o,
  };
}

/** Pontos da linha superior de um elipsoide (para listras dorsais que acompanham o corpo). */
function linhaDorso(c: V3, r: V3, z0: number, z1: number, n: number, sobre = 0.005): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / (n - 1);
    const k = Math.max(0, 1 - ((z - c[2]) / r[2]) ** 2);
    out.push([c[0], c[1] + r[1] * Math.sqrt(k) + sobre, z]);
  }
  return out;
}

// ------------------------------------------------------------------ camelo -----------

export const camelo: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pelo = '#d6a96f';
  const pelo2 = '#c99a5e';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 1.4, 0);
  pernas(m, {
    ombro: 1.16, quadril: 1.12, frente: 0.5, tras: -0.55, meia: 0.19, joelho: 0.52,
    r: [0.13, 0.068, 0.06], rTras: [0.16, 0.072, 0.06], cor: pelo2, corPe: '#a07f5c', pe: 0.06, tipoPe: 'almofada',
  });
  m.parte('corpo', elipsoide([0, 1.42, -0.02], [0.38, 0.36, 0.78], 1), pelo);
  const corcova = sexo === 'macho' ? 1 : 0.82;
  m.parte('corpo', elipsoide([0, 1.68 + 0.08 * corcova, -0.06], [0.28 * corcova, 0.34 * corcova, 0.42], 1), pelo);
  // cauda
  m.osso('cauda', 'corpo', 0, 1.5, -0.72);
  m.parte('cauda', membro([0, 1.52, -0.72], [0, 1.08, -0.8], 0.035, 0.02, 4), pelo2);
  m.parte('cauda', octaedro([0, 1.03, -0.81], [0.04, 0.08, 0.04]), '#7b5a3c');
  // pescoço em "U" (para frente e para baixo, depois para cima)
  m.osso('pescoco', 'corpo', 0, 1.52, 0.56);
  m.osso('pescoco2', 'pescoco', 0, 1.42, 0.98);
  m.osso('cabeca', 'pescoco2', 0, 1.84, 1.2);
  m.parte('pescoco', tubo(curva([[0, 1.6, 0.42], [0, 1.47, 0.78], [0, 1.43, 1.0]], 5), [0.21, 0.17, 0.14, 0.125, 0.115], 6), pelo);
  m.parte('pescoco2', tubo(curva([[0, 1.43, 0.98], [0, 1.58, 1.14], [0, 1.86, 1.22]], 4), [0.11, 0.1, 0.095, 0.09], 6), pelo);
  // cabeça
  m.parte('cabeca', elipsoide([0, 1.95, 1.3], [0.105, 0.105, 0.15], 1), pelo);
  m.parte('cabeca', elipsoide([0, 1.9, 1.47], [0.08, 0.085, 0.13], 0), '#caa071');
  m.parte('cabeca', elipsoide([0, 1.85, 1.53], [0.07, 0.035, 0.08], 0), '#b98c5c');
  for (const s of [1, -1]) m.parte('cabeca', cone([0.075 * s, 2.02, 1.24], [0.1 * s, 2.09, 1.2], 0.025, 4), pelo2);
  olhos(m, 'cabeca', 0.093, 1.98, 1.38, 0.018);
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({
      passada: 1.15, velRef: 1.0, andadura: true, amplitude: 0.32, pescoco: ['pescoco', 'pescoco2'], cabeca: 'cabeca',
      cauda: ['cauda'], pastarAngulo: 0.55,
    }),
  };
};

// ------------------------------------------------------------------ leão -------------

export const leao: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pelo = sexo === 'macho' ? '#d9a35b' : '#ddb06c';
  const claro = '#efd09a';
  const juba = '#9a5626';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.8, 0);
  pernas(m, {
    ombro: 0.6, frente: 0.44, tras: -0.44, meia: 0.15, joelho: 0.5,
    r: [0.1, 0.07, 0.065], rTras: [0.12, 0.072, 0.065], cor: pelo, corPe: '#cf9b58', pe: 0.075, tipoPe: 'pata',
  });
  const magro = sexo === 'macho' ? 1 : 0.9;
  m.parte('corpo', elipsoide([0, 0.83, -0.04], [0.26 * magro, 0.26 * magro, 0.6], 1), pelo);
  m.parte('corpo', elipsoide([0, 0.76, 0.0], [0.21 * magro, 0.2, 0.5], 0), claro);
  m.parte('corpo', elipsoide([0, 0.84, 0.38], [0.25 * magro, 0.29, 0.24], 0), pelo);
  // cauda com tufo
  m.osso('cauda', 'corpo', 0, 0.92, -0.62);
  m.osso('cauda2', 'cauda', 0, 0.62, -0.84);
  m.parte('cauda', membro([0, 0.92, -0.62], [0, 0.62, -0.84], 0.035, 0.028, 4), pelo);
  m.parte('cauda2', membro([0, 0.62, -0.84], [0, 0.52, -1.06], 0.028, 0.022, 4), pelo);
  m.parte('cauda2', elipsoide([0, 0.52, -1.1], [0.05, 0.05, 0.075], 0), '#5e3518');
  m.osso('pescoco', 'corpo', 0, 0.96, 0.52);
  m.osso('cabeca', 'pescoco', 0, 1.04, 0.7);
  m.parte('pescoco', elipsoide([0, 0.98, 0.6], [0.17 * magro, 0.18, 0.17], 0), pelo);
  // cabeça
  m.parte('cabeca', elipsoide([0, 1.07, 0.8], [0.18, 0.17, 0.19], 1), pelo);
  m.parte('cabeca', elipsoide([0, 0.99, 0.96], [0.11, 0.09, 0.1], 0), claro);
  m.parte('cabeca', octaedro([0, 1.03, 1.05], [0.04, 0.025, 0.025]), '#5a3424');
  m.parte('cabeca', elipsoide([0, 0.94, 0.93], [0.07, 0.04, 0.06], 0), claro);
  olhos(m, 'cabeca', 0.085, 1.11, 0.95, 0.02);
  for (const s of [1, -1]) m.parte('cabeca', elipsoide([0.12 * s, 1.21, 0.74], [0.05, 0.05, 0.03], 0), pelo);
  if (sexo === 'macho') {
    // juba: anel desgrenhado em volta da cabeça e no peito
    const desgrenhado = (c: THREE.Vector3) => (ruido3(Math.round(c.x * 30), Math.round(c.y * 30), Math.round(c.z * 30)) > 0.5 ? '#8a4a1f' : juba);
    m.parte('cabeca', elipsoide([0, 1.06, 0.68], [0.33, 0.35, 0.22], 1), juba, { porFace: desgrenhado });
    m.parte('pescoco', elipsoide([0, 0.9, 0.56], [0.26, 0.32, 0.24], 0), '#8e4d20', { porFace: desgrenhado });
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({
      passada: 0.95, velRef: 1.0, pescoco: ['pescoco'], cabeca: 'cabeca', cauda: ['cauda', 'cauda2'], pastarAngulo: 0.25,
      gingado: 0.03, amplitude: 0.4,
    }),
  };
};

// ------------------------------------------------------------------ elefante ---------

export const elefante: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pele = '#a7a19c';
  const pele2 = '#9a948f';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 1.75, 0);
  pernas(m, {
    ombro: 1.25, frente: 0.6, tras: -0.62, meia: 0.4, joelho: 0.5, lados: 6,
    r: [0.25, 0.21, 0.22], cor: pele2, corPe: '#cfc6bb', pe: 0.1, tipoPe: 'casco',
  });
  m.parte('corpo', elipsoide([0, 1.78, -0.02], [0.72, 0.74, 1.1], 1), pele);
  m.osso('cauda', 'corpo', 0, 1.95, -1.08);
  m.parte('cauda', membro([0, 1.95, -1.08], [0, 1.3, -1.2], 0.04, 0.025, 4), pele2);
  m.parte('cauda', octaedro([0, 1.25, -1.21], [0.04, 0.07, 0.04]), '#4a4440');
  m.osso('pescoco', 'corpo', 0, 1.98, 0.85);
  m.osso('cabeca', 'pescoco', 0, 2.08, 1.08);
  m.parte('cabeca', elipsoide([0, 2.15, 1.28], [0.46, 0.5, 0.44], 1), pele);
  olhos(m, 'cabeca', 0.34, 2.2, 1.55, 0.03);
  // orelhas grandes
  for (const [s, n] of [[1, 'orelhaE'], [-1, 'orelhaD']] as const) {
    m.osso(n, 'cabeca', 0.4 * s, 2.25, 1.12);
    m.parte(n, elipsoide([0.6 * s, 2.06, 0.98], [0.06, 0.55, 0.44], 0, [0, 0.45 * s, 0.1 * s]), '#b5aca6');
  }
  // tromba em três segmentos
  m.osso('tromba1', 'cabeca', 0, 2.02, 1.62);
  m.osso('tromba2', 'tromba1', 0, 1.5, 1.8);
  m.osso('tromba3', 'tromba2', 0, 1.0, 1.84);
  m.parte('tromba1', tubo(curva([[0, 2.12, 1.55], [0, 1.82, 1.74], [0, 1.5, 1.8]], 4), [0.18, 0.15, 0.13, 0.12], 6), pele);
  m.parte('tromba2', tubo(curva([[0, 1.5, 1.8], [0, 1.25, 1.83], [0, 1.0, 1.84]], 3), [0.12, 0.1, 0.085], 6), pele);
  m.parte('tromba3', tubo(curva([[0, 1.0, 1.84], [0, 0.75, 1.88], [0, 0.6, 1.98]], 3), [0.085, 0.07, 0.06], 6), pele);
  if (sexo === 'macho') {
    for (const s of [1, -1]) {
      m.parte('cabeca', tubo(curva([[0.2 * s, 1.88, 1.55], [0.25 * s, 1.62, 1.78], [0.23 * s, 1.58, 2.02]], 5), [0.065, 0.055, 0.042, 0.026, 0], 5), '#f2ead8');
    }
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({
      passada: 1.5, velRef: 1.0, amplitude: 0.28, amplitudeCorrida: 0.45, joelho: 0.4, quique: 0.03,
      pescoco: ['pescoco'], cabeca: 'cabeca', cauda: ['cauda'], orelhas: ['orelhaE', 'orelhaD'], orelhasAbanar: 0.16,
      tromba: ['tromba1', 'tromba2', 'tromba3'], pastarAngulo: 0.2,
    }),
  };
};

// ------------------------------------------------------------------ girafa -----------

export const girafa: ConstrutorProcedural = () => {
  const m = new Montador();
  const base = '#ebc070';
  const mancha = '#a9622e';
  const pintas = (c: THREE.Vector3) => (manchas(c, 9) > 0.56 ? mancha : null);
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 1.82, 0);
  pernas(m, {
    ombro: 1.6, quadril: 1.42, frente: 0.46, tras: -0.5, meia: 0.18, joelho: 0.5, lados: 5,
    r: [0.13, 0.065, 0.055], rTras: [0.15, 0.07, 0.055], cor: base, corBaixo: '#f3dfb3', corPe: '#5e4430', pe: 0.08, tipoPe: 'casco',
  });
  m.parte('corpo', elipsoide([0, 1.84, -0.02], [0.37, 0.42, 0.74], 1, [-0.16, 0, 0]), base, { porFace: pintas });
  m.osso('cauda', 'corpo', 0, 1.88, -0.56);
  m.parte('cauda', membro([0, 1.88, -0.56], [0, 1.25, -0.66], 0.025, 0.015, 4), base);
  m.parte('cauda', octaedro([0, 1.2, -0.67], [0.04, 0.08, 0.04]), '#4a3020');
  m.osso('pescoco', 'corpo', 0, 2.02, 0.44);
  m.osso('pescoco2', 'pescoco', 0, 2.78, 0.72);
  m.osso('cabeca', 'pescoco2', 0, 3.46, 0.98);
  m.parte('pescoco', tubo(curva([[0, 1.95, 0.38], [0, 2.4, 0.57], [0, 2.82, 0.72]], 4), [0.24, 0.17, 0.13, 0.115], 6), base, { porFace: pintas });
  m.parte('pescoco2', tubo(curva([[0, 2.78, 0.7], [0, 3.12, 0.84], [0, 3.48, 0.98]], 4), [0.11, 0.1, 0.09, 0.085], 6), base, { porFace: pintas });
  // crina curta ao longo do pescoço
  m.parte('pescoco', tubo(curva([[0, 2.02, 0.26], [0, 2.45, 0.44], [0, 2.86, 0.6]], 3), [0.03, 0.03, 0.025], 4), '#8a5428');
  m.parte('pescoco2', tubo(curva([[0, 2.84, 0.6], [0, 3.2, 0.74], [0, 3.5, 0.86]], 3), [0.025, 0.025, 0.02], 4), '#8a5428');
  m.parte('cabeca', elipsoide([0, 3.53, 1.08], [0.1, 0.11, 0.2], 1), base);
  m.parte('cabeca', elipsoide([0, 3.47, 1.24], [0.075, 0.075, 0.09], 0), '#e9cf9c');
  for (const s of [1, -1]) {
    m.parte('cabeca', membro([0.045 * s, 3.6, 1.0], [0.055 * s, 3.75, 0.97], 0.02, 0.018, 4), base);
    m.parte('cabeca', octaedro([0.055 * s, 3.76, 0.97], [0.028, 0.028, 0.028]), '#4a3020');
    m.parte('cabeca', cone([0.08 * s, 3.6, 1.0], [0.2 * s, 3.63, 0.95], 0.03, 4), base);
  }
  olhos(m, 'cabeca', 0.088, 3.57, 1.14, 0.02);
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({
      passada: 1.7, velRef: 1.0, andadura: true, amplitude: 0.3, pescoco: ['pescoco', 'pescoco2'], cabeca: 'cabeca',
      cauda: ['cauda'], pastarAngulo: 0.3, quique: 0.03,
    }),
  };
};

// ------------------------------------------------------------------ cabra ------------

export const cabra: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pelo = sexo === 'macho' ? '#5f4636' : '#8a6448';
  const claro = '#dcc8a6';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.58, 0);
  pernas(m, {
    ombro: 0.44, frente: 0.24, tras: -0.26, meia: 0.1, joelho: 0.5, lados: 4,
    r: [0.05, 0.03, 0.027], cor: pelo, corBaixo: claro, corPe: '#2f241d', pe: 0.045, tipoPe: 'casco',
  });
  m.parte('corpo', elipsoide([0, 0.6, -0.01], [0.17, 0.19, 0.36], 1), pelo);
  m.osso('cauda', 'corpo', 0, 0.68, -0.35);
  m.parte('cauda', membro([0, 0.68, -0.35], [0, 0.79, -0.41], 0.028, 0.012, 4), pelo);
  m.osso('pescoco', 'corpo', 0, 0.66, 0.28);
  m.osso('cabeca', 'pescoco', 0, 0.84, 0.44);
  m.parte('pescoco', membro([0, 0.62, 0.24], [0, 0.84, 0.44], 0.095, 0.07, 5), pelo);
  m.parte('cabeca', elipsoide([0, 0.88, 0.52], [0.07, 0.08, 0.13], 1, [0.45, 0, 0]), pelo);
  m.parte('cabeca', elipsoide([0, 0.82, 0.6], [0.048, 0.05, 0.06], 0), claro);
  for (const s of [1, -1]) m.parte('cabeca', elipsoide([0.09 * s, 0.87, 0.47], [0.07, 0.02, 0.035], 0, [0, 0, -0.45 * s]), pelo);
  olhos(m, 'cabeca', 0.058, 0.91, 0.54, 0.014, '#2a2010');
  const chifre = '#6c5a46';
  for (const s of [1, -1]) {
    const pts: V3[] = sexo === 'macho'
      ? [[0.035, 0.94, 0.48], [0.05, 1.04, 0.43], [0.07, 1.1, 0.33], [0.09, 1.08, 0.22]]
      : [[0.03, 0.94, 0.48], [0.04, 1.0, 0.44], [0.05, 1.03, 0.39]];
    const n = pts.length + 2;
    m.parte('cabeca', tubo(curva(pts.map((p) => espelhar(p, s)), n), Array.from({ length: n }, (_, i) => 0.024 * (1 - i / (n - 1)) + 0.002), 4), chifre);
  }
  if (sexo === 'macho') m.parte('cabeca', cone([0, 0.79, 0.6], [0, 0.69, 0.58], 0.026, 4), '#3f3026');
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({ passada: 0.55, velRef: 0.8, pescoco: ['pescoco'], cabeca: 'cabeca', cauda: ['cauda'], caudaEixo: 'x', pastarAngulo: 1.0 }),
  };
};

// ------------------------------------------------------------------ carneiro ---------

/**
 * O carneiro de Gênesis 22:13, "preso pelos chifres" num arbusto: lã creme fofa, rosto
 * castanho e chifres espiralados com sulcos. A fêmea (ovelha procedural) não tem chifres.
 */
export const carneiro: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const la = '#f2e9d6';
  const la2 = '#e2d5bb';
  const rosto = '#7a5a44';
  const fofo = (c: THREE.Vector3) => (manchas(c, 13) > 0.6 ? la2 : null);
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.62, 0);
  // pernas curtas: a parte de cima coberta de lã, canela castanha
  pernas(m, {
    ombro: 0.42, frente: 0.25, tras: -0.27, meia: 0.13, joelho: 0.6, lados: 5,
    r: [0.07, 0.034, 0.03], cor: rosto, corCoxa: la, corPe: '#3b2e26', pe: 0.045, tipoPe: 'casco',
  });
  // corpo de lã: volume principal e tufos arredondados que quebram a silhueta
  m.parte('corpo', elipsoide([0, 0.64, -0.02], [0.28, 0.26, 0.42], 1), la, { porFace: fofo });
  const tufos: [V3, V3][] = [
    [[0, 0.84, 0.12], [0.19, 0.12, 0.2]], [[0, 0.84, -0.18], [0.2, 0.12, 0.2]], [[0.17, 0.72, -0.05], [0.13, 0.16, 0.26]],
    [[-0.17, 0.72, -0.05], [0.13, 0.16, 0.26]], [[0, 0.64, 0.3], [0.22, 0.22, 0.16]], [[0, 0.68, -0.36], [0.21, 0.2, 0.14]],
  ];
  for (const [c, r] of tufos) m.parte('corpo', elipsoide(c, r, 0), la, { porFace: fofo });
  m.osso('cauda', 'corpo', 0, 0.72, -0.44);
  m.parte('cauda', elipsoide([0, 0.62, -0.47], [0.07, 0.12, 0.05], 0), la);
  m.osso('pescoco', 'corpo', 0, 0.74, 0.32);
  m.osso('cabeca', 'pescoco', 0, 0.86, 0.44);
  m.parte('pescoco', elipsoide([0, 0.78, 0.38], [0.16, 0.17, 0.15], 0), la, { porFace: fofo });
  // cabeça: rosto castanho, focinho mais claro, topete de lã
  m.parte('cabeca', elipsoide([0, 0.89, 0.5], [0.095, 0.1, 0.12], 1), rosto);
  m.parte('cabeca', elipsoide([0, 0.82, 0.61], [0.068, 0.072, 0.095], 0), '#8f6f56');
  m.parte('cabeca', octaedro([0, 0.82, 0.7], [0.03, 0.02, 0.012]), '#3a2a22');
  m.parte('cabeca', elipsoide([0, 0.97, 0.47], [0.085, 0.06, 0.08], 0), la);
  for (const s of [1, -1]) m.parte('cabeca', elipsoide([0.11 * s, 0.86, 0.47], [0.07, 0.022, 0.035], 0, [0, 0.3 * s, -0.35 * s]), rosto);
  olhos(m, 'cabeca', 0.074, 0.92, 0.56, 0.017);
  if (sexo === 'macho') {
    // chifres em espiral com sulcos: sobem, vão para trás, descem em volta da orelha e voltam à frente
    const sulco = '#b2966a';
    const chifre = '#d6bf92';
    const lados = 5;
    for (const s of [1, -1]) {
      const n = 15;
      const pts: THREE.Vector3[] = [];
      const raios: number[] = [];
      const cz = 0.4;
      const cy = 0.85;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const th = -0.4 + t * 5.3;
        const R = 0.135 - 0.07 * t;
        const x = 0.08 + 0.13 * Math.pow(t, 0.8);
        pts.push(new THREE.Vector3(x * s, cy + Math.cos(th) * R, cz - Math.sin(th) * R));
        raios.push(0.056 * Math.pow(1 - t, 0.75) + 0.007);
      }
      m.parte('cabeca', tubo(pts, raios, lados, 0.75), chifre, {
        sombra: 0.12,
        porFace: (_c, i) => (Math.floor(i / (2 * lados)) % 2 === 1 ? sulco : null),
      });
    }
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({ passada: 0.55, velRef: 0.75, pescoco: ['pescoco'], cabeca: 'cabeca', cauda: ['cauda'], caudaEixo: 'x', pastarAngulo: 1.05 }),
  };
};

// ------------------------------------------------------------------ jumento ----------

export const jumento: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pelo = sexo === 'macho' ? '#92877c' : '#9c9186';
  const claro = '#ddd5c9';
  const escuro = '#4a403a';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.86, 0);
  pernas(m, {
    ombro: 0.62, frente: 0.36, tras: -0.38, meia: 0.13, joelho: 0.5, lados: 5,
    r: [0.065, 0.04, 0.036], cor: pelo, corBaixo: '#a39a90', corPe: '#352d28', pe: 0.06, tipoPe: 'casco',
  });
  const cCorpo: V3 = [0, 0.88, 0];
  const rCorpo: V3 = [0.22, 0.24, 0.5];
  m.parte('corpo', elipsoide(cCorpo, rCorpo, 1), pelo);
  m.parte('corpo', elipsoide([0, 0.8, 0.02], [0.19, 0.17, 0.4], 0), claro);
  // a "cruz" do jumento: listra no dorso e outra sobre os ombros
  m.parte('corpo', tubo(linhaDorso(cCorpo, rCorpo, -0.44, 0.36, 6, 0.002).map((p) => new THREE.Vector3(...p)), [0.02, 0.022, 0.022, 0.022, 0.022, 0.02], 4, 0.5), escuro);
  const cruz: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.21 + (0.42 * i) / 4;
    const k = Math.max(0, 1 - (x / 0.225) ** 2 - (0.24 / 0.5) ** 2);
    cruz.push(new THREE.Vector3(x, 0.88 + 0.245 * Math.sqrt(k) + 0.003, 0.24));
  }
  m.parte('corpo', tubo(cruz, [0.018, 0.02, 0.02, 0.02, 0.018], 4, 0.5), escuro);
  m.osso('cauda', 'corpo', 0, 1.0, -0.48);
  m.parte('cauda', membro([0, 1.0, -0.48], [0, 0.62, -0.56], 0.025, 0.02, 4), pelo);
  m.parte('cauda', octaedro([0, 0.58, -0.57], [0.035, 0.07, 0.035]), escuro);
  m.osso('pescoco', 'corpo', 0, 0.98, 0.4);
  m.osso('cabeca', 'pescoco', 0, 1.22, 0.62);
  m.parte('pescoco', membro([0, 0.94, 0.36], [0, 1.22, 0.62], 0.13, 0.09, 6), pelo);
  m.parte('pescoco', membro([0, 1.08, 0.31], [0, 1.32, 0.56], 0.03, 0.025, 4), escuro);
  m.parte('cabeca', elipsoide([0, 1.2, 0.77], [0.1, 0.11, 0.2], 1, [0.55, 0, 0]), pelo);
  m.parte('cabeca', elipsoide([0, 1.08, 0.9], [0.08, 0.08, 0.09], 0), claro);
  m.parte('cabeca', octaedro([0, 1.06, 0.98], [0.04, 0.025, 0.02]), '#3a3230');
  for (const s of [1, -1]) {
    m.parte('cabeca', elipsoide([0.075 * s, 1.43, 0.64], [0.042, 0.16, 0.03], 0, [-0.25, 0, -0.28 * s]), pelo);
    m.parte('cabeca', octaedro([0.11 * s, 1.57, 0.6], [0.025, 0.04, 0.02]), escuro);
  }
  olhos(m, 'cabeca', 0.083, 1.25, 0.8, 0.018);
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({ passada: 0.75, velRef: 0.9, pescoco: ['pescoco'], cabeca: 'cabeca', cauda: ['cauda'], pastarAngulo: 0.95 }),
  };
};

// ------------------------------------------------------------------ urso -------------

export const urso: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pelo = sexo === 'macho' ? '#74503a' : '#83603f';
  const focinho = '#b08b63';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.86, 0);
  pernas(m, {
    ombro: 0.56, frente: 0.4, tras: -0.42, meia: 0.2, joelho: 0.5, lados: 5,
    r: [0.13, 0.1, 0.095], cor: pelo, corPe: '#5d3f2b', pe: 0.07, tipoPe: 'pata',
  });
  m.parte('corpo', elipsoide([0, 0.86, -0.04], [0.35, 0.35, 0.6], 1), pelo);
  m.parte('corpo', elipsoide([0, 1.0, 0.26], [0.29, 0.27, 0.3], 0), pelo);
  m.osso('cauda', 'corpo', 0, 0.95, -0.62);
  m.parte('cauda', elipsoide([0, 0.95, -0.64], [0.06, 0.06, 0.05], 0), pelo);
  m.osso('pescoco', 'corpo', 0, 0.96, 0.5);
  m.osso('cabeca', 'pescoco', 0, 0.98, 0.7);
  m.parte('pescoco', elipsoide([0, 0.95, 0.58], [0.22, 0.22, 0.18], 0), pelo);
  m.parte('cabeca', elipsoide([0, 0.98, 0.8], [0.19, 0.17, 0.19], 1), pelo);
  m.parte('cabeca', elipsoide([0, 0.92, 0.98], [0.09, 0.08, 0.12], 0), focinho);
  m.parte('cabeca', octaedro([0, 0.95, 1.1], [0.04, 0.03, 0.025]), '#2a1e18');
  for (const s of [1, -1]) m.parte('cabeca', elipsoide([0.13 * s, 1.12, 0.76], [0.06, 0.06, 0.035], 0), pelo);
  olhos(m, 'cabeca', 0.085, 1.03, 0.94, 0.018);
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({ passada: 0.9, velRef: 0.9, pescoco: ['pescoco'], cabeca: 'cabeca', cauda: [], gingado: 0.05, quique: 0.03, pastarAngulo: 0.5 }),
  };
};

// ------------------------------------------------------------------ cervo ------------

export const cervo: ConstrutorProcedural = (sexo) => {
  const m = new Montador();
  const pelo = '#a9744a';
  const claro = '#e8d2b0';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.86, 0);
  pernas(m, {
    ombro: 0.62, quadril: 0.64, frente: 0.33, tras: -0.36, meia: 0.11, joelho: 0.52, lados: 4,
    r: [0.055, 0.03, 0.025], cor: pelo, corPe: '#2e241e', pe: 0.05, tipoPe: 'casco',
  });
  m.parte('corpo', elipsoide([0, 0.88, 0], [0.18, 0.21, 0.45], 1), pelo);
  m.parte('corpo', elipsoide([0, 0.8, 0.02], [0.15, 0.14, 0.36], 0), claro);
  m.parte('corpo', elipsoide([0, 0.91, -0.39], [0.13, 0.13, 0.08], 0), '#f1e7d6');
  m.osso('cauda', 'corpo', 0, 0.97, -0.46);
  m.parte('cauda', elipsoide([0, 0.94, -0.48], [0.035, 0.065, 0.03], 0), '#f4ede2');
  m.osso('pescoco', 'corpo', 0, 0.98, 0.34);
  m.osso('cabeca', 'pescoco', 0, 1.22, 0.52);
  m.parte('pescoco', membro([0, 0.94, 0.3], [0, 1.24, 0.52], 0.09, 0.065, 5), pelo);
  m.parte('cabeca', elipsoide([0, 1.26, 0.6], [0.072, 0.078, 0.15], 1, [0.35, 0, 0]), pelo);
  m.parte('cabeca', elipsoide([0, 1.2, 0.71], [0.042, 0.042, 0.045], 0), '#4e3526');
  for (const s of [1, -1]) m.parte('cabeca', elipsoide([0.09 * s, 1.36, 0.53], [0.04, 0.09, 0.025], 0, [0, 0, -0.65 * s]), pelo);
  olhos(m, 'cabeca', 0.058, 1.3, 0.64, 0.016);
  if (sexo === 'macho') {
    const galhada = '#dccaa6';
    for (const s of [1, -1]) {
      const haste: V3[] = [[0.04, 1.35, 0.55], [0.1, 1.5, 0.5], [0.15, 1.63, 0.44], [0.14, 1.77, 0.39]];
      m.parte('cabeca', tubo(curva(haste.map((p) => espelhar(p, s)), 5), [0.018, 0.016, 0.013, 0.009, 0.002], 4), galhada);
      m.parte('cabeca', tubo(curva([espelhar([0.1, 1.5, 0.5], s), espelhar([0.115, 1.58, 0.58], s), espelhar([0.12, 1.63, 0.64], s)], 3), [0.012, 0.008, 0.001], 4), galhada);
      m.parte('cabeca', tubo(curva([espelhar([0.15, 1.63, 0.44], s), espelhar([0.18, 1.71, 0.5], s), espelhar([0.2, 1.76, 0.53], s)], 3), [0.011, 0.007, 0.001], 4), galhada);
    }
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: marchaQuad({ passada: 0.85, velRef: 1.0, pescoco: ['pescoco'], cabeca: 'cabeca', cauda: ['cauda'], caudaEixo: 'x', pastarAngulo: 1.0 }),
  };
};

// ------------------------------------------------------------------ aves -------------

interface ParamAve {
  escala: number;
  corpo: Cor;
  peito?: Cor;
  cabeca: Cor;
  asa: Cor;
  ponta: Cor;
  bico: Cor;
  pernas: Cor;
  olho?: Cor;
  bicoLongo?: number;
  bicoGrosso?: number;
  caudaLonga?: number;
}

/** Ave pequena genérica (pomba, corvo): corpo, cabeça, bico, asas articuladas, cauda em leque. */
function ave(p: ParamAve): ModeloProcedural {
  const m = new Montador();
  const k = p.escala;
  const s3 = (v: V3): V3 => [v[0] * k, v[1] * k, v[2] * k];
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.15 * k, 0);
  m.parte('corpo', elipsoide(s3([0, 0.15, -0.01]), s3([0.065, 0.068, 0.125]), 1, [-0.2, 0, 0]), p.corpo);
  m.parte('corpo', elipsoide(s3([0, 0.155, 0.05]), s3([0.058, 0.062, 0.065]), 0), p.peito ?? p.corpo);
  // cabeça
  m.osso('cabeca', 'corpo', 0, 0.2 * k, 0.07 * k);
  m.parte('cabeca', elipsoide(s3([0, 0.232, 0.1]), s3([0.04, 0.042, 0.046]), 1), p.cabeca);
  const bl = p.bicoLongo ?? 1;
  const bg = p.bicoGrosso ?? 1;
  m.parte('cabeca', cone(s3([0, 0.226, 0.138]), s3([0, 0.214, 0.138 + 0.04 * bl]), 0.013 * k * bg, 4), p.bico, { sombra: 0.05 });
  for (const s of [1, -1]) m.parte('cabeca', octaedro(s3([0.03 * s, 0.242, 0.118]), [0.006 * k, 0.009 * k, 0.009 * k]), p.olho ?? '#141012', { sombra: 0 });
  // asas: leque no plano XZ, presas no ombro; fechadas giram para trás junto ao corpo
  const asa: [number, number][] = [[0.0, 0.055], [0.11, 0.045], [0.23, 0.0], [0.25, -0.05], [0.17, -0.08], [0.0, -0.05]];
  for (const [s, n] of [[1, 'asaE'], [-1, 'asaD']] as const) {
    m.osso(n, 'corpo', 0.045 * k * s, 0.185 * k, 0.02 * k);
    const contorno = asa.map(([x, z]) => [(0.045 + x) * k * s, (0.02 + z) * k] as [number, number]);
    m.parte(n, leque(s > 0 ? contorno : contorno.slice().reverse(), 0.185 * k, 0.012 * k), p.asa, {
      sombra: 0.1,
      porFace: (c) => (Math.abs(c.x) > 0.19 * k ? p.ponta : null),
    });
  }
  // cauda
  const cl = p.caudaLonga ?? 1;
  m.osso('cauda', 'corpo', 0, 0.15 * k, -0.1 * k);
  m.parte('cauda', leque([[-0.025 * k, -0.08 * k], [-0.05 * k, -(0.08 + 0.12 * cl) * k], [0.05 * k, -(0.08 + 0.12 * cl) * k], [0.025 * k, -0.08 * k]], 0.15 * k, 0.012 * k), p.ponta, { sombra: 0.1 });
  // pernas
  for (const [s, n] of [[1, 'pernaE'], [-1, 'pernaD']] as const) {
    m.osso(n, 'raiz', 0.022 * k * s, 0.095 * k, 0.005 * k);
    m.parte(n, membro(s3([0.022 * s, 0.1, 0.005]), s3([0.022 * s, 0.012, 0.015]), 0.008 * k, 0.006 * k, 3, true), p.pernas);
    m.parte(n, octaedro(s3([0.022 * s, 0.008, 0.025]), [0.012 * k, 0.006 * k, 0.022 * k]), p.pernas);
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: {
      pernas: [
        { coxa: 'pernaE', fase: 0, faseCorrida: 0 },
        { coxa: 'pernaD', fase: 0.5, faseCorrida: 0.5 },
      ],
      passada: 0.12 * k,
      passadaCorrida: 0.2 * k,
      amplitude: 0.5,
      amplitudeCorrida: 0.6,
      joelho: 0,
      velRef: 0.3 * k,
      corpo: 'corpo',
      quique: 0.01 * k,
      gingado: 0.06,
      cabeca: 'cabeca',
      pastarAngulo: 0.9,
      cauda: ['cauda'],
      caudaEixo: 'x',
      asas: ['asaE', 'asaD'],
      asaFreq: 4.2,
      asaAmp: 0.95,
      asaFechada: 1.38,
      pernasVoo: 1.1,
    },
  };
}

/** A pomba branca de Gênesis 8:8-12. */
export const pomba: ConstrutorProcedural = () =>
  ave({ escala: 1.15, corpo: '#f7f4ec', cabeca: '#fbf9f3', asa: '#f1ede4', ponta: '#d9d4ca', bico: '#d39f95', pernas: '#d8857c' });

/** O corvo de Gênesis 8:7, "que saiu, indo e voltando". */
export const corvo: ConstrutorProcedural = () => {
  const r = ave({
    escala: 1.9, corpo: '#2b2c35', peito: '#30313b', cabeca: '#2a2b33', asa: '#262833', ponta: '#353a4d', bico: '#3e3e45',
    pernas: '#3a3a40', olho: '#5a4a3a', bicoLongo: 1.5, bicoGrosso: 1.5, caudaLonga: 1.2,
  });
  r.marcha.asaFreq = 2.6;
  return r;
};

// ------------------------------------------------------------------ pato -------------

export const pato: ConstrutorProcedural = (sexo) => {
  const macho = sexo === 'macho';
  const m = new Montador();
  const corpo = macho ? '#d9d3c6' : '#9b7b58';
  const cab = macho ? '#2f6a46' : '#8c6c4c';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 0.17, 0);
  m.parte('corpo', elipsoide([0, 0.17, -0.01], [0.1, 0.085, 0.17], 1), corpo);
  m.parte('corpo', elipsoide([0, 0.16, 0.08], [0.085, 0.08, 0.08], 0), macho ? '#7c4a33' : corpo);
  m.parte('corpo', cone([0, 0.18, -0.15], [0, 0.22, -0.22], 0.04, 4), macho ? '#2a2a2a' : '#7b5e42');
  m.osso('pescoco', 'corpo', 0, 0.22, 0.1);
  m.osso('cabeca', 'pescoco', 0, 0.3, 0.12);
  m.parte('pescoco', membro([0, 0.2, 0.1], [0, 0.3, 0.13], 0.04, 0.035, 5), cab);
  if (macho) m.parte('pescoco', membro([0, 0.245, 0.112], [0, 0.255, 0.116], 0.04, 0.04, 6), '#f4f1ea');
  m.parte('cabeca', elipsoide([0, 0.32, 0.14], [0.045, 0.045, 0.055], 1), cab);
  m.parte('cabeca', elipsoide([0, 0.305, 0.21], [0.028, 0.012, 0.045], 0), '#e2b23e');
  olhos(m, 'cabeca', 0.035, 0.33, 0.16, 0.009);
  for (const [s, n] of [[1, 'asaE'], [-1, 'asaD']] as const) {
    m.osso(n, 'corpo', 0.08 * s, 0.2, 0.02);
    m.parte(n, elipsoide([0.09 * s, 0.2, -0.04], [0.025, 0.05, 0.12], 0), macho ? '#bdb6a8' : '#86684a', {
      porFace: (c) => (c.z < -0.1 ? (macho ? '#3b4f8a' : '#5a4a3a') : null),
    });
  }
  for (const [s, n] of [[1, 'pernaE'], [-1, 'pernaD']] as const) {
    m.osso(n, 'raiz', 0.04 * s, 0.1, 0.0);
    m.parte(n, membro([0.04 * s, 0.1, 0], [0.04 * s, 0.01, 0.01], 0.01, 0.008, 3, true), '#e98b2f');
    m.parte(n, leque([[0.04 * s - 0.03, 0.0], [0.04 * s + 0.03, 0.0], [0.04 * s + 0.035, 0.06], [0.04 * s - 0.035, 0.06]], 0.006, 0.008), '#e98b2f');
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: {
      pernas: [{ coxa: 'pernaE', fase: 0, faseCorrida: 0 }, { coxa: 'pernaD', fase: 0.5, faseCorrida: 0.5 }],
      passada: 0.16, passadaCorrida: 0.24, amplitude: 0.55, amplitudeCorrida: 0.7, joelho: 0, velRef: 0.35,
      corpo: 'corpo', quique: 0.008, gingado: 0.16, pescoco: ['pescoco'], cabeca: 'cabeca', pastarAngulo: 0.8,
      asas: ['asaE', 'asaD'], asaFreq: 5, asaAmp: 0.9, asaFechada: 0, pernasVoo: 1.0,
    },
  };
};

// ------------------------------------------------------------------ avestruz ---------

export const avestruz: ConstrutorProcedural = (sexo) => {
  const macho = sexo === 'macho';
  const m = new Montador();
  const plumas = macho ? '#2c2725' : '#8a7a66';
  const pele = '#dcb2a0';
  m.osso('raiz', null, 0, 0, 0);
  m.osso('corpo', 'raiz', 0, 1.2, 0);
  m.parte('corpo', elipsoide([0, 1.22, -0.02], [0.3, 0.26, 0.42], 1), plumas);
  m.parte('corpo', elipsoide([0, 1.3, -0.42], [0.18, 0.13, 0.13], 0), '#f2eee6');
  for (const [s, n] of [[1, 'asaE'], [-1, 'asaD']] as const) {
    m.osso(n, 'corpo', 0.25 * s, 1.28, 0.05);
    m.parte(n, elipsoide([0.28 * s, 1.22, -0.08], [0.06, 0.15, 0.26], 0), macho ? '#f2eee6' : '#cfc3b0');
  }
  m.osso('pescoco', 'corpo', 0, 1.36, 0.3);
  m.osso('cabeca', 'pescoco', 0, 2.0, 0.43);
  m.parte('pescoco', tubo(curva([[0, 1.32, 0.26], [0, 1.68, 0.36], [0, 2.02, 0.43]], 4), [0.08, 0.055, 0.045, 0.04], 5), pele);
  m.parte('cabeca', elipsoide([0, 2.05, 0.47], [0.05, 0.045, 0.07], 1), pele);
  m.parte('cabeca', elipsoide([0, 2.02, 0.55], [0.035, 0.014, 0.055], 0), '#d6b392');
  olhos(m, 'cabeca', 0.04, 2.07, 0.5, 0.014);
  for (const [s, sufixo] of [[1, 'E'], [-1, 'D']] as const) {
    const x = 0.12 * s;
    m.osso('coxa' + sufixo, 'raiz', x, 1.05, 0);
    m.osso('canela' + sufixo, 'coxa' + sufixo, x, 0.56, -0.07);
    m.parte('coxa' + sufixo, membro([x, 1.12, 0], [x, 0.56, -0.07], 0.085, 0.045, 5, true), pele);
    m.parte('canela' + sufixo, membro([x, 0.56, -0.07], [x, 0.05, 0.02], 0.04, 0.03, 4, true), pele);
    m.parte('canela' + sufixo, elipsoide([x, 0.03, 0.08], [0.04, 0.03, 0.09], 0), '#c99b88');
  }
  return {
    montador: m,
    cabeca: 'cabeca',
    marcha: {
      pernas: [
        { coxa: 'coxaE', canela: 'canelaE', fase: 0, faseCorrida: 0 },
        { coxa: 'coxaD', canela: 'canelaD', fase: 0.5, faseCorrida: 0.5 },
      ],
      passada: 1.2, passadaCorrida: 2.6, amplitude: 0.45, amplitudeCorrida: 0.7, joelho: 0.9, velRef: 1.1,
      corpo: 'corpo', quique: 0.04, gingado: 0.03, pescoco: ['pescoco'], cabeca: 'cabeca', pastarAngulo: 0.9,
      asas: ['asaE', 'asaD'], asaFechada: 0, asaAmp: 0.5, asaFreq: 2,
    },
  };
};

export const PROCEDURAIS = {
  camelo, leao, elefante, girafa, cabra, carneiro, jumento, urso, cervo, pomba, corvo, pato, avestruz,
} satisfies Record<string, ConstrutorProcedural>;

export type EspecieProcedural = keyof typeof PROCEDURAIS;
