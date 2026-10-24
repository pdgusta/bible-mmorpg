// Efeitos sonoros sintetizados (one-shots): passos, interface, sopro da troca, brilho da era,
// sinos de conquista, trovão, sons da obra e da arca, e as vozes dos animais.
import { aleatorio, karplusStrong, midiParaHz } from './sintese';

/** O que um efeito recebe para tocar: contexto, saída seca (já posicionada) e envio para o eco. */
export interface CtxSom {
  ctx: BaseAudioContext;
  saida: AudioNode;
  eco: AudioNode;
  ruido: { branco: AudioBuffer; rosa: AudioBuffer; marrom: AudioBuffer };
  rnd: () => number;
  /** Cache de cordas pinçadas por nota MIDI (compartilhado com a música). */
  corda(midi: number, brilho?: number): AudioBuffer;
}

export interface OpcoesEfeito {
  /** Volume relativo (padrão 1). */
  volume?: number;
  /** Superfície dos passos. */
  superficie?: 'terra' | 'grama' | 'madeira' | 'agua' | 'pedra';
  /** Tipo de conquista. */
  tipo?: 'memoria' | 'armadura' | 'nivel' | 'xp' | 'versiculo';
  /** 0 = perto (estalo forte), 1 = longe (só o rumor). */
  distancia?: number;
  /** Altura relativa da voz (1 = normal). */
  tom?: number;
  sexo?: string;
  duracao?: number;
  /** Quantos sopros/saltos (troca de personagem). */
  saltos?: number;
}

// ------------------------------------------------------------------ utilitários ------

function g(c: CtxSom, destino: AudioNode, valor = 0): GainNode {
  const n = c.ctx.createGain();
  n.gain.value = valor;
  n.connect(destino);
  return n;
}

/** Envelope ataque/decaimento exponencial num AudioParam. */
function env(p: AudioParam, t: number, ataque: number, pico: number, queda: number, fim = 0.0001) {
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(pico, t + ataque);
  p.exponentialRampToValueAtTime(Math.max(fim, 0.0001), t + ataque + queda);
}

function osc(c: CtxSom, tipo: OscillatorType, f: number, t0: number, t1: number, destino: AudioNode): OscillatorNode {
  const o = c.ctx.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(f, t0);
  o.connect(destino);
  o.start(t0);
  o.stop(t1 + 0.05);
  return o;
}

function ruido(c: CtxSom, tipo: 'branco' | 'rosa' | 'marrom', t0: number, dur: number, destino: AudioNode, taxa = 1): AudioBufferSourceNode {
  const s = c.ctx.createBufferSource();
  const b = c.ruido[tipo];
  s.buffer = b;
  s.loop = true;
  s.playbackRate.value = taxa;
  s.connect(destino);
  s.start(t0, c.rnd() * (b.duration - 0.1));
  s.stop(t0 + dur + 0.05);
  return s;
}

function filtro(c: CtxSom, tipo: BiquadFilterType, f: number, q: number, destino: AudioNode): BiquadFilterNode {
  const b = c.ctx.createBiquadFilter();
  b.type = tipo;
  b.frequency.value = f;
  b.Q.value = q;
  b.connect(destino);
  return b;
}

/** Sino aditivo (parciais inarmônicos de Risset). */
export function sino(c: CtxSom, f: number, t: number, dur: number, vol: number, destino: AudioNode, eco = 0.5) {
  const parciais: [number, number, number][] = [
    [0.56, 1, 1], [0.92, 0.67, 0.9], [1.19, 1, 0.65], [1.71, 1.8, 0.55], [2, 2.67, 0.32], [2.74, 1.67, 0.3], [3, 1.46, 0.25], [3.76, 1.33, 0.2], [4.07, 1.33, 0.16],
  ];
  const sai = g(c, destino, 1);
  const molhado = g(c, c.eco, eco);
  sai.connect(molhado);
  for (const [k, a, d] of parciais) {
    const ga = g(c, sai);
    env(ga.gain, t, 0.004, vol * a * 0.12, dur * d);
    osc(c, 'sine', f * k, t, t + dur * d + 0.1, ga);
  }
}

// ------------------------------------------------------------------ vozes ------------

interface ParamVoz {
  /** Pontos de altura (Hz) distribuídos ao longo da duração. */
  alturas: number[];
  dur: number;
  formantes: [number, number][];
  tipo?: OscillatorType;
  /** Mistura de ruído (0..1). */
  ruido?: number;
  /** Tremolo/pulsos: [taxa Hz, profundidade 0..1]. */
  pulsos?: [number, number];
  vibrato?: [number, number];
  vol?: number;
  ataque?: number;
}

function voz(c: CtxSom, t: number, p: ParamVoz, destino: AudioNode) {
  const dur = p.dur;
  const saida = g(c, destino);
  env(saida.gain, t, p.ataque ?? 0.04, p.vol ?? 0.5, dur);
  // pulsos (balido "mé-é-é", ronco)
  let entrada: AudioNode = saida;
  if (p.pulsos) {
    const am = c.ctx.createGain();
    am.gain.value = 1 - p.pulsos[1] * 0.5;
    am.connect(saida);
    osc(c, 'sine', p.pulsos[0], t, t + dur, g(c, am.gain, p.pulsos[1] * 0.5));
    entrada = am;
  }
  const soma = c.ctx.createGain();
  soma.gain.value = 1;
  const filtros = p.formantes.map(([f, q]) => filtro(c, 'bandpass', f, q, entrada));
  for (const fl of filtros) soma.connect(fl);
  const fonte = osc(c, p.tipo ?? 'sawtooth', p.alturas[0], t, t + dur, soma);
  const n = p.alturas.length;
  for (let i = 1; i < n; i++) fonte.frequency.linearRampToValueAtTime(p.alturas[i], t + (dur * i) / (n - 1));
  if (p.vibrato) osc(c, 'sine', p.vibrato[0], t, t + dur, g(c, fonte.frequency, p.vibrato[1]));
  if (p.ruido) ruido(c, 'branco', t, dur, g(c, soma, p.ruido * 0.6));
  // um pouco de corpo direto
  const corpo = g(c, entrada, 0.08);
  soma.connect(corpo);
}

function vozAnimal(nome: string, c: CtxSom, t: number, o: OpcoesEfeito, d: AudioNode) {
  const k = (o.tom ?? 1) * (o.sexo === 'femea' ? 1.12 : 1) * (0.94 + c.rnd() * 0.12);
  switch (nome) {
    case 'balido':
      return voz(c, t, { alturas: [330 * k, 360 * k, 340 * k, 300 * k], dur: 0.85, formantes: [[650, 5], [1500, 6], [2600, 8]], pulsos: [8.5, 0.7], ruido: 0.1, vol: 0.45 }, d);
    case 'mugido':
      return voz(c, t, { alturas: [105 * k, 125 * k, 128 * k, 98 * k], dur: 1.6, formantes: [[320, 4], [650, 5], [1000, 6]], vibrato: [5, 2], vol: 0.6, ataque: 0.15 }, d);
    case 'relincho':
      voz(c, t, { alturas: [1100 * k, 950 * k, 800 * k, 520 * k], dur: 1.1, formantes: [[1100, 4], [2300, 6]], vibrato: [13, 70], ruido: 0.15, vol: 0.32 }, d);
      return ruidoBufo(c, t + 1.15, d);
    case 'zurro':
      for (let i = 0; i < 2; i++) {
        voz(c, t + i * 0.9, { alturas: [560 * k, 620 * k], dur: 0.35, formantes: [[2000, 5], [900, 4]], vol: 0.35, ruido: 0.15 }, d);
        voz(c, t + i * 0.9 + 0.38, { alturas: [260 * k, 220 * k], dur: 0.45, formantes: [[700, 4], [1200, 5]], vol: 0.4, ruido: 0.1 }, d);
      }
      return;
    case 'grunhido':
      return voz(c, t, { alturas: [95 * k, 80 * k], dur: 0.5, formantes: [[450, 3], [900, 4]], pulsos: [28, 0.9], ruido: 0.35, vol: 0.5 }, d);
    case 'rugido':
      return voz(c, t, { alturas: [70 * k, 82 * k, 64 * k], dur: 1.5, formantes: [[300, 2], [650, 3]], pulsos: [24, 0.8], ruido: 0.5, vol: 0.55, ataque: 0.25 }, d);
    case 'barrito':
      return voz(c, t, { alturas: [420 * k, 560 * k, 520 * k], dur: 1.0, formantes: [[900, 3], [1800, 5], [2700, 6]], vibrato: [8, 25], ruido: 0.1, vol: 0.35, ataque: 0.08 }, d);
    case 'latido':
      for (let i = 0; i < 2; i++) voz(c, t + i * 0.28, { alturas: [420 * k, 260 * k], dur: 0.16, formantes: [[900, 3], [1800, 4]], ruido: 0.4, vol: 0.5, ataque: 0.01 }, d);
      return;
    case 'uivo':
      return voz(c, t, { alturas: [330 * k, 560 * k, 580 * k, 440 * k], dur: 2.6, tipo: 'triangle', formantes: [[700, 2], [1400, 3]], vibrato: [5, 8], vol: 0.35, ataque: 0.4 }, d);
    case 'miado':
      return voz(c, t, { alturas: [560 * k, 820 * k, 480 * k], dur: 0.7, formantes: [[900, 4], [2200, 6]], vol: 0.35, ataque: 0.05 }, d);
    case 'pomba':
    case 'arrulho': {
      const notas: [number, number][] = [[0, 0.22], [0.32, 0.28], [0.72, 0.5]];
      for (const [dt, du] of notas) voz(c, t + dt, { alturas: [480 * k, 540 * k, 470 * k], dur: du, tipo: 'sine', formantes: [[500, 1], [1000, 2]], pulsos: [18, 0.4], vol: 0.6, ataque: 0.06 }, d);
      return;
    }
    case 'corvo':
      for (let i = 0; i < 3; i++) voz(c, t + i * 0.42, { alturas: [520 * k, 430 * k], dur: 0.3, formantes: [[1100, 3], [2400, 4]], ruido: 0.45, pulsos: [45, 0.6], vol: 0.45, ataque: 0.01 }, d);
      return;
    case 'grasnado':
      for (let i = 0; i < 2; i++) voz(c, t + i * 0.22, { alturas: [330 * k, 300 * k], dur: 0.17, formantes: [[1500, 9], [2800, 7]], ruido: 0.1, vol: 0.45, ataque: 0.01 }, d);
      return;
    case 'grito':
      return voz(c, t, { alturas: [2300 * k, 2000 * k, 1700 * k], dur: 0.6, tipo: 'triangle', formantes: [[2200, 3]], vibrato: [26, 90], vol: 0.25 }, d);
  }
}

function ruidoBufo(c: CtxSom, t: number, d: AudioNode) {
  const ga = g(c, d);
  env(ga.gain, t, 0.01, 0.3, 0.25);
  ruido(c, 'rosa', t, 0.3, filtro(c, 'bandpass', 700, 1, ga));
}

// ------------------------------------------------------------------ efeitos ----------

export const VOZES = ['balido', 'mugido', 'relincho', 'zurro', 'grunhido', 'rugido', 'barrito', 'latido', 'uivo', 'miado', 'arrulho', 'pomba', 'corvo', 'grasnado', 'grito'];

/** Toca um efeito no instante t. Retorna false se o nome não existir. */
export function tocarEfeito(nome: string, c: CtxSom, t: number, o: OpcoesEfeito): boolean {
  const d = c.saida;
  const r = c.rnd;
  if (VOZES.includes(nome)) {
    vozAnimal(nome, c, t, o, d);
    return true;
  }
  switch (nome) {
    // ---------------------------------------------------------- passos
    case 'passo': {
      const sup = o.superficie ?? 'terra';
      const ga = g(c, d);
      if (sup === 'madeira') {
        env(ga.gain, t, 0.002, 0.5, 0.12);
        osc(c, 'sine', 170 + r() * 30, t, t + 0.15, ga).frequency.exponentialRampToValueAtTime(110, t + 0.1);
        const gb = g(c, d);
        env(gb.gain, t, 0.001, 0.25, 0.05);
        ruido(c, 'branco', t, 0.06, filtro(c, 'bandpass', 1400, 2, gb));
      } else if (sup === 'agua') {
        env(ga.gain, t, 0.01, 0.35, 0.22);
        const f = filtro(c, 'bandpass', 1600, 1.2, ga);
        f.frequency.exponentialRampToValueAtTime(500, t + 0.2);
        ruido(c, 'branco', t, 0.25, f);
        for (let i = 0; i < 3; i++) {
          const gb = g(c, d);
          const tb = t + 0.05 + r() * 0.15;
          env(gb.gain, tb, 0.003, 0.08, 0.05);
          osc(c, 'sine', 500 + r() * 700, tb, tb + 0.06, gb).frequency.exponentialRampToValueAtTime(1300, tb + 0.05);
        }
      } else if (sup === 'pedra') {
        env(ga.gain, t, 0.001, 0.4, 0.06);
        ruido(c, 'branco', t, 0.07, filtro(c, 'bandpass', 2600 + r() * 600, 1.5, ga));
      } else {
        // terra / grama: baque abafado + chiado curto
        env(ga.gain, t, 0.003, 0.45, 0.09);
        ruido(c, 'rosa', t, 0.1, filtro(c, 'lowpass', sup === 'grama' ? 2400 : 900, 0.7, ga));
        const gb = g(c, d);
        env(gb.gain, t, 0.002, 0.2, 0.07);
        osc(c, 'sine', 90, t, t + 0.08, gb).frequency.exponentialRampToValueAtTime(55, t + 0.07);
      }
      return true;
    }
    // ---------------------------------------------------------- interface
    case 'clique': {
      const ga = g(c, d);
      env(ga.gain, t, 0.001, 0.25, 0.05);
      osc(c, 'sine', 1150, t, t + 0.06, ga).frequency.exponentialRampToValueAtTime(820, t + 0.04);
      return true;
    }
    case 'abrir':
    case 'fechar': {
      const sobe = nome === 'abrir';
      for (let i = 0; i < 2; i++) {
        const ga = g(c, d);
        const ti = t + i * 0.07;
        env(ga.gain, ti, 0.005, 0.18, 0.18);
        osc(c, 'triangle', midiParaHz(sobe ? 74 + i * 5 : 79 - i * 5), ti, ti + 0.25, ga);
      }
      return true;
    }
    case 'pegar': {
      const s = c.ctx.createBufferSource();
      s.buffer = c.corda(81, 0.8);
      const ga = g(c, d, 0.35);
      s.connect(ga);
      s.start(t);
      return true;
    }
    // ---------------------------------------------------------- troca e era
    case 'sopro': {
      const dur = o.duracao ?? 1.1;
      const saltos = o.saltos ?? 1;
      for (let i = 0; i < saltos; i++) {
        const ti = t + i * (dur / saltos) * 0.8;
        const di = dur / saltos + 0.3;
        const ga = g(c, d);
        env(ga.gain, ti, di * 0.4, 0.45, di * 0.6);
        const pan = c.ctx.createStereoPanner();
        pan.connect(ga);
        pan.pan.setValueAtTime(-0.6, ti);
        pan.pan.linearRampToValueAtTime(0.6, ti + di);
        const f = filtro(c, 'bandpass', 300, 1.4, pan);
        f.frequency.setValueAtTime(280 + i * 120, ti);
        f.frequency.exponentialRampToValueAtTime(2400 + i * 300, ti + di * 0.45);
        f.frequency.exponentialRampToValueAtTime(450, ti + di);
        ruido(c, 'rosa', ti, di, f);
        ga.connect(g(c, c.eco, 0.4));
      }
      return true;
    }
    case 'brilho': {
      // brilho dourado da transição de era: cintilação de parciais agudos + varredura ascendente
      const notas = [74, 78, 81, 83, 86, 88, 90, 93, 95, 98];
      for (let i = 0; i < 14; i++) {
        const ti = t + r() * 2.6;
        const ga = g(c, d);
        const m = notas[Math.floor(r() * notas.length)];
        env(ga.gain, ti, 0.4 + r() * 0.6, 0.06, 2.5);
        osc(c, 'sine', midiParaHz(m), ti, ti + 3.6, ga);
        ga.connect(g(c, c.eco, 1.2));
      }
      const gr = g(c, d);
      gr.gain.setValueAtTime(0.0001, t);
      gr.gain.exponentialRampToValueAtTime(0.12, t + 2.2);
      gr.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      const f = filtro(c, 'bandpass', 800, 2, gr);
      f.frequency.exponentialRampToValueAtTime(6000, t + 3.5);
      ruido(c, 'rosa', t, 4, f);
      gr.connect(g(c, c.eco, 0.8));
      return true;
    }
    case 'sino':
      sino(c, midiParaHz(81), t, 3, 1, d);
      return true;
    case 'memoria':
    case 'armadura':
    case 'nivel':
    case 'versiculo':
    case 'xp':
      return tocarEfeito('conquista', c, t, { ...o, tipo: nome });
    case 'conquista': {
      const tipo = o.tipo ?? 'memoria';
      if (tipo === 'memoria') {
        sino(c, midiParaHz(74), t, 4, 0.9, d, 0.8);
        sino(c, midiParaHz(81), t + 0.35, 4, 0.7, d, 0.8);
        tocarEfeito('brilho', c, t + 0.1, { volume: 0.4 });
      } else if (tipo === 'armadura') {
        for (const [m, dt] of [[50, 0], [57, 0.12], [62, 0.24], [69, 0.5]] as const) sino(c, midiParaHz(m + 12), t + dt, 5, 0.9, d, 0.9);
        const ga = g(c, d);
        env(ga.gain, t, 0.8, 0.1, 3);
        for (const m of [50, 57, 62]) osc(c, 'sawtooth', midiParaHz(m), t, t + 4, filtro(c, 'lowpass', 900, 0.5, ga));
      } else if (tipo === 'nivel') {
        [74, 78, 81, 86].forEach((m, i) => sino(c, midiParaHz(m), t + i * 0.12, 2.5, 0.7, d, 0.7));
      } else if (tipo === 'versiculo') {
        sino(c, midiParaHz(86), t, 2.5, 0.35, d, 1);
      } else {
        sino(c, midiParaHz(88), t, 1.2, 0.3, d, 0.5);
      }
      return true;
    }
    // ---------------------------------------------------------- natureza
    case 'trovao': {
      const dist = o.distancia ?? r();
      if (dist < 0.4) {
        const gc = g(c, d);
        env(gc.gain, t, 0.002, 0.6 * (1 - dist), 0.35);
        ruido(c, 'branco', t, 0.4, filtro(c, 'highpass', 1800, 0.7, gc));
      }
      const atraso = dist * 1.2;
      const dur = 3 + r() * 3;
      const ga = g(c, d);
      ga.gain.setValueAtTime(0.0001, t + atraso);
      ga.gain.exponentialRampToValueAtTime(0.9 - dist * 0.4, t + atraso + 0.15 + dist * 0.4);
      // ribombos
      for (let i = 0; i < 4; i++) {
        const ti = t + atraso + 0.4 + r() * dur * 0.6;
        ga.gain.setTargetAtTime(0.4 + r() * 0.5, ti, 0.08);
      }
      ga.gain.setTargetAtTime(0.0001, t + atraso + dur * 0.7, dur * 0.25);
      const f = filtro(c, 'lowpass', 1600 - dist * 900, 0.8, ga);
      f.frequency.exponentialRampToValueAtTime(140, t + atraso + dur);
      ruido(c, 'marrom', t + atraso, dur + 1, f, 1.6);
      ga.connect(g(c, c.eco, 0.6));
      return true;
    }
    case 'agua': {
      const ga = g(c, d);
      env(ga.gain, t, 0.01, 0.5, 0.45);
      const f = filtro(c, 'bandpass', 1800, 1, ga);
      f.frequency.exponentialRampToValueAtTime(450, t + 0.4);
      ruido(c, 'branco', t, 0.5, f);
      for (let i = 0; i < 6; i++) {
        const gb = g(c, d);
        const tb = t + 0.08 + r() * 0.5;
        env(gb.gain, tb, 0.003, 0.1, 0.06);
        osc(c, 'sine', 400 + r() * 600, tb, tb + 0.08, gb).frequency.exponentialRampToValueAtTime(1400, tb + 0.06);
      }
      return true;
    }
    case 'fogo': {
      const ga = g(c, d);
      env(ga.gain, t, 0.25, 0.4, 0.9);
      const f = filtro(c, 'lowpass', 300, 0.8, ga);
      f.frequency.exponentialRampToValueAtTime(2500, t + 0.5);
      ruido(c, 'rosa', t, 1.3, f);
      for (let i = 0; i < 14; i++) estalo(c, t + 0.2 + r() * 1.4, 0.15 + r() * 0.2, d);
      return true;
    }
    case 'asas': {
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const ti = t + i * (0.11 + r() * 0.03);
        const ga = g(c, d);
        env(ga.gain, ti, 0.012, 0.3 * (1 - i / (n + 2)), 0.07);
        ruido(c, 'rosa', ti, 0.1, filtro(c, 'bandpass', 500 + r() * 300, 0.9, ga));
      }
      return true;
    }
    // ---------------------------------------------------------- obra e arca
    case 'martelo': {
      const ga = g(c, d);
      env(ga.gain, t, 0.001, 0.6, 0.16);
      osc(c, 'sine', 330 + r() * 40, t, t + 0.2, ga).frequency.exponentialRampToValueAtTime(240, t + 0.12);
      const gb = g(c, d);
      env(gb.gain, t, 0.001, 0.45, 0.03);
      ruido(c, 'branco', t, 0.04, filtro(c, 'bandpass', 2800, 1.2, gb));
      const gr = g(c, d);
      env(gr.gain, t, 0.001, 0.15, 0.25);
      osc(c, 'triangle', 920 + r() * 60, t, t + 0.3, gr);
      ga.connect(g(c, c.eco, 0.3));
      return true;
    }
    case 'machado': {
      const ga = g(c, d);
      env(ga.gain, t, 0.002, 0.6, 0.05);
      ruido(c, 'branco', t, 0.06, filtro(c, 'bandpass', 1300, 1.3, ga));
      const gb = g(c, d);
      env(gb.gain, t, 0.002, 0.55, 0.18);
      osc(c, 'sine', 150, t, t + 0.22, gb).frequency.exponentialRampToValueAtTime(85, t + 0.15);
      if (r() < 0.5) estalo(c, t + 0.05, 0.25, d);
      return true;
    }
    case 'corda': {
      const dur = o.duracao ?? 0.7;
      const ga = g(c, d);
      env(ga.gain, t, 0.08, 0.22, dur);
      const f = filtro(c, 'bandpass', 1300, 7, ga);
      const s = osc(c, 'sawtooth', 170, t, t + dur + 0.1, f);
      s.frequency.linearRampToValueAtTime(230, t + dur * 0.6);
      s.frequency.linearRampToValueAtTime(205, t + dur);
      osc(c, 'square', 31, t, t + dur, g(c, ga.gain, 0.08));
      const gb = g(c, d);
      env(gb.gain, t, 0.02, 0.08, dur);
      ruido(c, 'rosa', t, dur, filtro(c, 'highpass', 2000, 0.6, gb));
      return true;
    }
    case 'portaArca': {
      const ga = g(c, d);
      env(ga.gain, t, 0.005, 1.0, 1.8);
      osc(c, 'sine', 62, t, t + 2, ga).frequency.exponentialRampToValueAtTime(34, t + 1.4);
      const gb = g(c, d);
      env(gb.gain, t, 0.003, 0.7, 0.6);
      ruido(c, 'marrom', t, 0.8, filtro(c, 'lowpass', 400, 0.7, gb), 1.5);
      const gm = g(c, d);
      env(gm.gain, t, 0.002, 0.35, 0.35);
      osc(c, 'triangle', 180, t, t + 0.4, gm).frequency.exponentialRampToValueAtTime(120, t + 0.3);
      ga.connect(g(c, c.eco, 0.9));
      gb.connect(g(c, c.eco, 0.9));
      return true;
    }
    case 'tranco': {
      const ga = g(c, d);
      env(ga.gain, t, 0.01, 0.9, 1.2);
      osc(c, 'sine', 55, t, t + 1.4, ga).frequency.exponentialRampToValueAtTime(28, t + 1);
      const gb = g(c, d);
      env(gb.gain, t, 0.01, 0.6, 1.4);
      ruido(c, 'marrom', t, 1.6, filtro(c, 'lowpass', 260, 0.7, gb), 1.2);
      tocarEfeito('rangido', c, t + 0.3, { volume: 1 });
      return true;
    }
    case 'rangido': {
      // madeira rangendo (casco da arca)
      const dur = 0.8 + r() * 1.2;
      const ga = g(c, d);
      env(ga.gain, t, dur * 0.3, 0.16 * (o.volume ?? 1), dur * 0.7);
      const f = filtro(c, 'bandpass', 500 + r() * 500, 9, ga);
      const s = osc(c, 'sawtooth', 70 + r() * 50, t, t + dur, f);
      s.frequency.linearRampToValueAtTime(90 + r() * 70, t + dur);
      osc(c, 'square', 18 + r() * 14, t, t + dur, g(c, ga.gain, 0.06));
      return true;
    }
    // ---------------------------------------------------------- provas
    case 'sussurro': {
      const dur = o.duracao ?? 1.6;
      const ga = g(c, d);
      env(ga.gain, t, 0.2, 0.3, dur);
      const formantes = [600, 1100, 2400];
      for (const fq of formantes) {
        const f = filtro(c, 'bandpass', fq, 6, ga);
        for (let k = 0; k < 6; k++) f.frequency.setTargetAtTime(fq * (0.7 + r() * 0.7), t + (k * dur) / 6, 0.05);
        ruido(c, 'branco', t, dur, f);
      }
      ga.connect(g(c, c.eco, 0.7));
      return true;
    }
    case 'coracao': {
      for (const [dt, v] of [[0, 0.6], [0.22, 0.4]] as const) {
        const ga = g(c, d);
        env(ga.gain, t + dt, 0.01, v, 0.16);
        osc(c, 'sine', 62, t + dt, t + dt + 0.2, ga).frequency.exponentialRampToValueAtTime(40, t + dt + 0.15);
      }
      return true;
    }
  }
  return false;
}

/** Estalo curto de lenha. */
export function estalo(c: CtxSom, t: number, vol: number, d: AudioNode) {
  const ga = g(c, d);
  env(ga.gain, t, 0.0005, vol, 0.01 + c.rnd() * 0.03);
  ruido(c, 'branco', t, 0.05, filtro(c, 'highpass', 1500 + c.rnd() * 2500, 0.8, ga));
}

/** Cache de cordas pinçadas (Karplus-Strong) por nota. */
export function criarCacheCordas(ctx: BaseAudioContext) {
  const cache = new Map<string, AudioBuffer>();
  return (midi: number, brilho = 0.55): AudioBuffer => {
    const chave = `${midi}|${brilho.toFixed(2)}`;
    let b = cache.get(chave);
    if (!b) {
      const f = midiParaHz(midi);
      const dur = Math.min(3.2, 1.2 + 120 / f);
      const dados = karplusStrong(f, ctx.sampleRate, dur, { brilho, sustentacao: 0.9965 + Math.min(0.003, 30 / f / 100) });
      b = ctx.createBuffer(1, dados.length, ctx.sampleRate);
      b.copyToChannel(dados as Float32Array<ArrayBuffer>, 0);
      cache.set(chave, b);
    }
    return b;
  };
}

export { aleatorio };
