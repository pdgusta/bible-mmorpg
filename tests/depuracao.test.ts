// Depuração: com ?dev&missao=a4 o pularPara já roda os atalhos, e o modo vira 'jogo' antes de ele
// acabar. Um dev.jogar() nessa hora abria um segundo runner que dividia o mesmo `fim` com o
// primeiro: quando o do pularPara chegava em a4, o avancar parava antes de avançar o tempo e a
// etapa ficava presa em a4.chamado.
import { describe, it, expect } from 'vitest';
import { Depuracao } from '../src/jogo/ligacao/depuracao';
import type { Partida } from '../src/jogo/Partida';

/** Partida mínima: a era tem atalhos cujo `jogar` só resolve quando o teste mandar. */
function partida() {
  const runners: Array<() => void> = [];
  const p = {
    jogo: { eventos: { on() {} }, manual: false, tempo: 0 },
    ui: { dialogoC: { velocidade: 52 } },
    era: {
      def: { id: 'noe' },
      atalhos: () => ({ jogar: () => new Promise<void>((r) => runners.push(r)) }),
    },
    s: { missoes: { missaoAtual: null } },
  };
  return { dev: new Depuracao(p as unknown as Partida), runners };
}

describe('Depuracao.jogar', () => {
  it('recusa um segundo runner enquanto os atalhos ainda rodam', () => {
    const { dev, runners } = partida();
    dev.jogar('a4');
    expect(() => dev.jogar()).toThrow(/pularPara em andamento/);
    expect(runners).toHaveLength(1);
  });

  it('aceita jogar de novo depois que o runner anterior acabou', async () => {
    const { dev, runners } = partida();
    dev.jogar('a4');
    runners[0]();
    await dev.jogando;
    expect(dev.fim).toBe(true);
    dev.jogar();
    expect(runners).toHaveLength(2);
    expect(dev.fim).toBe(false);
  });
});
