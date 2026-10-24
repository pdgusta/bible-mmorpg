import { describe, expect, it } from 'vitest';
import { acorde, grau, karplusStrong, midiParaHz, respostaImpulso, ruidoMarrom, ruidoRosa } from './sintese';

describe('síntese', () => {
  it('corda de Karplus-Strong soa na frequência pedida e decai', () => {
    const taxa = 44100;
    const f = 220;
    const a = karplusStrong(f, taxa, 1.5);
    expect(a.length).toBe(Math.floor(taxa * 1.5));
    expect(a.every(Number.isFinite)).toBe(true);
    // energia do início maior que a do fim
    const e = (i0: number, i1: number) => a.subarray(i0, i1).reduce((s, v) => s + v * v, 0);
    expect(e(0, 4410)).toBeGreaterThan(e(a.length - 4410, a.length) * 10);
    // período estimado por autocorrelação num trecho estável
    const ini = 4410;
    const n = 4096;
    let melhor = 0;
    let lagMelhor = 0;
    for (let lag = Math.floor(taxa / 600); lag < Math.floor(taxa / 80); lag++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += a[ini + i] * a[ini + i + lag];
      if (s > melhor) {
        melhor = s;
        lagMelhor = lag;
      }
    }
    const fEst = taxa / lagMelhor;
    expect(Math.abs(fEst - f) / f).toBeLessThan(0.02);
  });

  it('ruídos e eco são finitos e normalizados', () => {
    for (const r of [ruidoRosa(10000), ruidoMarrom(10000)]) {
      const pico = r.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(pico).toBeGreaterThan(0.5);
      expect(pico).toBeLessThanOrEqual(1);
    }
    const [l, d] = respostaImpulso(8000, 1);
    expect(l.length).toBe(8000);
    expect(d.every(Number.isFinite)).toBe(true);
  });

  it('modos e acordes', () => {
    expect(midiParaHz(69)).toBeCloseTo(440);
    expect(grau(50, 'dorico', 2)).toBe(53); // ré dórico: fá
    expect(grau(50, 'dorico', 7)).toBe(62);
    expect(grau(50, 'dorico', -1)).toBe(48);
    expect(grau(52, 'frigioDominante', 2)).toBe(56); // mi frígio dominante: sol#
    expect(acorde(50, 'dorico', 0)).toEqual([50, 53, 57]);
  });
});
