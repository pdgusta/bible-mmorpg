// Depuração: com ?dev&missao=a4 o pularPara já roda os atalhos, e o modo vira 'jogo' antes de ele
// acabar. Um dev.jogar() nessa hora abria um segundo runner que dividia o mesmo `fim` com o
// primeiro: quando o do pularPara chegava em a4, o avancar parava antes de avançar o tempo e a
// etapa ficava presa em a4.chamado.
import { describe, it, expect } from 'vitest';
import { Depuracao } from '../src/jogo/ligacao/depuracao';
import { Partida } from '../src/jogo/Partida';

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

// Sair para o título no meio do dev.jogar deixava o runner pendurado (as missões abortam e os
// atalhos ficam esperando para sempre) e o próximo dev.jogar() era recusado.
describe('Depuracao.encerrar', () => {
  it('libera um novo dev.jogar e devolve a velocidade das falas', () => {
    const { dev, runners } = partida();
    const p = (dev as unknown as { p: { ui: { dialogoC: { velocidade: number } } } }).p;
    dev.jogar('a4');
    expect(p.ui.dialogoC.velocidade).toBe(0);
    dev.encerrar();
    expect(dev.fim).toBe(true);
    expect(dev.jogando).toBeNull();
    expect(p.ui.dialogoC.velocidade).toBe(52);
    dev.jogar();
    expect(runners).toHaveLength(2);
  });

  it('sem runner em curso não mexe nas falas nem no modo manual', () => {
    const { dev } = partida();
    const p = (dev as unknown as { p: { jogo: { manual: boolean }; ui: { dialogoC: { velocidade: number } } } }).p;
    p.jogo.manual = true;
    p.ui.dialogoC.velocidade = 0;
    dev.encerrar();
    expect(p.jogo.manual).toBe(true);
    expect(p.ui.dialogoC.velocidade).toBe(0);
  });

  it('o runner encerrado que acaba depois não mexe no runner novo', async () => {
    const { dev, runners } = partida();
    dev.jogar('a4');
    dev.encerrar();
    dev.jogar();
    runners[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(dev.fim).toBe(false);
    expect(dev.erro).toBeNull();
  });

  it('o runner encerrado para na próxima espera', async () => {
    const ops: Array<{ esperar(seg: number): Promise<void> }> = [];
    const p = {
      jogo: { eventos: { on() {} }, manual: false, tempo: 0, aCadaQuadro: () => () => {} },
      ui: { dialogoC: { velocidade: 52 } },
      era: {
        def: { id: 'noe' },
        atalhos: (op: { esperar(seg: number): Promise<void> }) => {
          ops.push(op);
          return { jogar: () => new Promise<void>(() => {}) };
        },
      },
      s: { missoes: { missaoAtual: null } },
    };
    const dev = new Depuracao(p as unknown as Partida);
    dev.jogar();
    dev.encerrar();
    await expect(ops[0].esperar(1)).rejects.toThrow(/encerrado/);
  });
});

/** Objeto que aceita qualquer acesso e chamada (o resto da Partida que a limpeza toca). */
function qualquer(): any {
  const f = () => qualquer();
  return new Proxy(f, { get: (_, k) => (k === 'then' ? undefined : qualquer()), set: () => true });
}

describe('Partida.sairParaTitulo', () => {
  it('encerra o runner do dev.jogar', () => {
    const { dev, runners } = partida();
    dev.jogar('a4');
    const proto = Partida.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
    const falsa = { dev, jogo: qualquer(), ui: qualquer(), s: qualquer(), audio: qualquer(), limparSessao: proto.limparSessao, entrarTitulo() {} };
    proto.sairParaTitulo.call(falsa);
    expect(dev.fim).toBe(true);
    dev.jogar();
    expect(runners).toHaveLength(2);
  });
});
