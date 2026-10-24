import { beforeAll, describe, expect, it } from 'vitest';
import { EFEITOS } from './Audio';
import { tocarEfeito, type CtxSom } from './Efeitos';
import { ESTADOS_MUSICA, Musica } from './Musica';
import { midiParaHz } from './sintese';

// Web Audio falso, só o bastante para os efeitos e a música montarem o grafo sem erro.
class ParamFalso {
  value = 0;
  setValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  setTargetAtTime() { return this; }
  cancelScheduledValues() { return this; }
}

class NoFalso {
  /** Quantos nós se ligaram a este. */
  recebidas = 0;
  gain = new ParamFalso();
  frequency = new ParamFalso();
  detune = new ParamFalso();
  Q = new ParamFalso();
  pan = new ParamFalso();
  playbackRate = new ParamFalso();
  type = '';
  buffer: unknown = null;
  loop = false;
  connect(d: unknown) { if (d instanceof NoFalso) d.recebidas++; }
  disconnect() {}
  start() {}
  parado = false;
  stop() { this.parado = true; }
}

/** Osciladores criados, em ordem (para conferir o bordão nas trocas de estado). */
const osciladores: NoFalso[] = [];

const buffer = { duration: 4 } as AudioBuffer;
const ctx = {
  currentTime: 0,
  sampleRate: 44100,
  createGain: () => new NoFalso(),
  createOscillator: () => {
    const o = new NoFalso();
    osciladores.push(o);
    return o;
  },
  createBufferSource: () => new NoFalso(),
  createBiquadFilter: () => new NoFalso(),
  createStereoPanner: () => new NoFalso(),
} as unknown as BaseAudioContext;

function ctxSom(): CtxSom {
  const saida = new NoFalso() as unknown as AudioNode;
  return { ctx, saida, eco: new NoFalso() as unknown as AudioNode, ruido: { branco: buffer, rosa: buffer, marrom: buffer }, rnd: () => 0.5, corda: () => buffer };
}

beforeAll(() => {
  (globalThis as { AudioNode?: unknown }).AudioNode ??= NoFalso;
});

describe('nomes de som', () => {
  it('a era 2 tem os efeitos que pede (alarme, aparar, golpe, discernir, pedra)', () => {
    for (const nome of ['alarme', 'aparar', 'golpe', 'discernir', 'pedra']) expect(EFEITOS).toContain(nome);
  });

  it('todo efeito da lista toca e chega à saída', () => {
    for (const nome of EFEITOS) {
      const c = ctxSom();
      expect(tocarEfeito(nome, c, 0, {}), nome).toBe(true);
      expect((c.saida as unknown as NoFalso).recebidas, nome).toBeGreaterThan(0);
    }
    expect(tocarEfeito('naoExiste', ctxSom(), 0, {})).toBe(false);
  });

  it('a música tem o estado batalha e ele agenda notas', () => {
    expect(ESTADOS_MUSICA.batalha).toBeDefined();
    const c = ctxSom();
    const destino = new NoFalso();
    const m = new Musica(c, destino as unknown as AudioNode);
    m.definir('batalha', 0);
    expect(m.estado).toBe('batalha');
    m.agendar(0, 4);
    expect(destino.recebidas).toBe(1);
    expect((c.eco as unknown as NoFalso).recebidas).toBeGreaterThan(0);
  });

  it('a troca entre estados com bordão (prova ↔ batalha) troca o bordão', () => {
    const tem = (os: NoFalso[], midi: number) => os.some((o) => Math.abs(o.frequency.value - midiParaHz(midi)) < 1e-6);
    const m = new Musica(ctxSom(), new NoFalso() as unknown as AudioNode);
    m.definir('prova', 0);
    m.agendar(0, 4);
    const daProva = osciladores.slice();
    expect(tem(daProva, 47)).toBe(true); // bordão de mi: 40 e 47
    const antes = osciladores.length;
    m.definir('batalha', 4);
    m.agendar(4, 8);
    // o bordão de mi foi solto e entrou o de ré (38 e 45)
    expect(daProva.filter((o) => Math.abs(o.frequency.value - midiParaHz(47)) < 1e-6).every((o) => o.parado)).toBe(true);
    expect(tem(osciladores.slice(antes), 45)).toBe(true);
    const antes2 = osciladores.length;
    m.definir('prova', 8);
    m.agendar(8, 12);
    expect(tem(osciladores.slice(antes2), 47)).toBe(true);
  });
});
