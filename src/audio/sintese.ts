// Funções puras de síntese (sem Web Audio): ruídos, corda pinçada (Karplus-Strong), resposta de
// impulso para o eco, escalas modais. Testáveis fora do navegador.

/** Gerador pseudoaleatório pequeno (mulberry32) para sons reprodutíveis. */
export function aleatorio(semente = 1): () => number {
  let s = semente >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ruidoBranco(n: number, semente = 1): Float32Array {
  const r = aleatorio(semente);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
}

/** Ruído rosa (filtro de Paul Kellet), normalizado para pico ~1. */
export function ruidoRosa(n: number, semente = 2): Float32Array {
  const r = aleatorio(semente);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return normalizar(out);
}

/** Ruído marrom (passeio aleatório com vazamento): rumor grave para vento, água e fogo. */
export function ruidoMarrom(n: number, semente = 3): Float32Array {
  const r = aleatorio(semente);
  const out = new Float32Array(n);
  let u = 0;
  for (let i = 0; i < n; i++) {
    u = (u + 0.02 * (r() * 2 - 1)) / 1.02;
    out[i] = u;
  }
  return normalizar(out);
}

export function normalizar(a: Float32Array, pico = 0.95): Float32Array {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= pico / m;
  return a;
}

/** Junta o fim ao começo com um cruzamento curto (para buffers em laço sem clique). */
export function emLaco(a: Float32Array, cruz = 2048): Float32Array {
  const n = a.length - cruz;
  const out = new Float32Array(n);
  out.set(a.subarray(0, n));
  for (let i = 0; i < cruz; i++) {
    const t = i / cruz;
    out[i] = a[i] * t + a[n + i] * (1 - t);
  }
  return out;
}

export interface OpcoesCorda {
  /** 0..1: brilho do ataque (filtra o ruído inicial). */
  brilho?: number;
  /** Fator de perda por ciclo (0.99..0.9995): maior = soa mais. */
  sustentacao?: number;
  semente?: number;
}

/**
 * Corda pinçada de Karplus-Strong (a "lira"): um pulso de ruído recircula numa linha de atraso
 * com média de duas amostras (filtro passa-baixa) — o timbre de corda surge sozinho.
 */
export function karplusStrong(freq: number, taxa: number, duracao: number, op: OpcoesCorda = {}): Float32Array {
  const n = Math.floor(taxa * duracao);
  const out = new Float32Array(n);
  const periodo = taxa / freq;
  const N = Math.max(2, Math.floor(periodo));
  const frac = periodo - N; // afinação fina por interpolação (passa-tudo simples)
  const r = aleatorio(op.semente ?? Math.floor(freq * 13));
  const brilho = op.brilho ?? 0.6;
  const s = op.sustentacao ?? 0.996;
  const linha = new Float32Array(N + 1);
  // excitação: ruído suavizado (menos brilho = mais filtrado)
  let ant = 0;
  for (let i = 0; i <= N; i++) {
    const w = r() * 2 - 1;
    ant = ant + (w - ant) * (0.15 + brilho * 0.85);
    linha[i] = ant;
  }
  // remove o nível DC da excitação
  let media = 0;
  for (let i = 0; i <= N; i++) media += linha[i];
  media /= N + 1;
  for (let i = 0; i <= N; i++) linha[i] -= media;
  let idx = 0;
  let apAnt = 0;
  let apSaidaAnt = 0;
  const c = (1 - frac) / (1 + frac);
  for (let i = 0; i < n; i++) {
    const a = linha[idx];
    const b = linha[(idx + 1) % (N + 1)];
    let v = 0.5 * (a + b) * s;
    // passa-tudo de primeira ordem para a fração do período
    const ap = c * v + apAnt - c * apSaidaAnt;
    apAnt = v;
    apSaidaAnt = ap;
    v = ap;
    linha[idx] = v;
    out[i] = a;
    idx = (idx + 1) % (N + 1);
  }
  // ataque suave e cauda sem clique
  const ataque = Math.min(n, Math.floor(taxa * 0.002));
  for (let i = 0; i < ataque; i++) out[i] *= i / ataque;
  const fim = Math.min(n, Math.floor(taxa * 0.08));
  for (let i = 0; i < fim; i++) out[n - 1 - i] *= i / fim;
  return normalizar(out, 0.8);
}

/** Resposta de impulso estéreo sintética (ruído com decaimento exponencial) para o eco. */
export function respostaImpulso(taxa: number, segundos: number, decaimento = 3, semente = 9): [Float32Array, Float32Array] {
  const n = Math.floor(taxa * segundos);
  const r = aleatorio(semente);
  const l = new Float32Array(n);
  const d = new Float32Array(n);
  let fl = 0;
  let fd = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const env = Math.pow(1 - t, decaimento);
    // passa-baixa que fecha com o tempo: a cauda fica mais escura
    const k = 0.9 - t * 0.75;
    fl += ((r() * 2 - 1) - fl) * k;
    fd += ((r() * 2 - 1) - fd) * k;
    l[i] = fl * env;
    d[i] = fd * env;
  }
  // pré-atraso curto e primeiras reflexões
  const pre = Math.floor(taxa * 0.012);
  for (let i = 0; i < pre; i++) l[i] = d[i] = 0;
  return [normalizar(l, 0.5), normalizar(d, 0.5)];
}

// ------------------------------------------------------------------ música -----------

/** Modos (intervalos em semitons a partir da tônica). */
export const MODOS = {
  jonio: [0, 2, 4, 5, 7, 9, 11],
  dorico: [0, 2, 3, 5, 7, 9, 10],
  frigio: [0, 1, 3, 5, 7, 8, 10],
  frigioDominante: [0, 1, 4, 5, 7, 8, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
  mixolidio: [0, 2, 4, 5, 7, 9, 10],
  eolio: [0, 2, 3, 5, 7, 8, 10],
} as const;
export type Modo = keyof typeof MODOS;

export const midiParaHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Nota MIDI do grau (0 = tônica; pode ser negativo ou passar de 7, mudando de oitava). */
export function grau(tonica: number, modo: Modo, g: number): number {
  const esc = MODOS[modo];
  const oit = Math.floor(g / esc.length);
  const i = ((g % esc.length) + esc.length) % esc.length;
  return tonica + oit * 12 + esc[i];
}

/** Acorde de três ou quatro sons sobre um grau da escala (empilhando terças da própria escala). */
export function acorde(tonica: number, modo: Modo, g: number, notas = 3): number[] {
  const out: number[] = [];
  for (let k = 0; k < notas; k++) out.push(grau(tonica, modo, g + k * 2));
  return out;
}
