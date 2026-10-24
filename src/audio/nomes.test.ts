import { beforeAll, describe, expect, it } from 'vitest';
import { EFEITOS } from './Audio';
import { tocarEfeito, type CtxSom } from './Efeitos';
import { ESTADOS_MUSICA, Musica } from './Musica';

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
  stop() {}
}

const buffer = { duration: 4 } as AudioBuffer;
const ctx = {
  currentTime: 0,
  sampleRate: 44100,
  createGain: () => new NoFalso(),
  createOscillator: () => new NoFalso(),
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
});
