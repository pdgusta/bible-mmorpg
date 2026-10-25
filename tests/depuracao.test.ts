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

/**
 * Partida para os laços que dirigem os atalhos (pularPara, jogarSozinho, avancar): cada passo de
 * `jogo.avancar` só resolve quando o teste mandar, e cada efeito na UI fica contado.
 */
function partidaDirigida() {
  const passos: Array<() => void> = [];
  const efeitos: string[] = [];
  const p = {
    jogo: {
      eventos: { on() {} }, manual: false, tempo: 0,
      avancar: () => new Promise<void>((r) => passos.push(r)),
    },
    ui: {
      dialogoC: { velocidade: 52 },
      carregamento: (c: unknown) => efeitos.push(c ? 'carregamento' : 'carregamento:fim'),
      aviso: () => efeitos.push('aviso'),
      menusC: { topo: () => (efeitos.push('fala'), null) },
      dialogoAberto: () => false,
    },
    era: {
      def: { id: 'noe', missoes: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }] },
      atalhos: () => ({ jogar: () => new Promise<void>(() => {}) }),
    },
    s: { missoes: { missaoAtual: 'a1', definicao: () => ({ titulo: 'A4' }) } },
  };
  return { dev: new Depuracao(p as unknown as Partida), p, passos, efeitos };
}

describe('Depuracao.encerrar com o laço no meio de um passo', () => {
  /** Encerra, e um dono novo (um e2e) liga o manual, zera as falas e começa outro runner. */
  function trocarDeDono(d: ReturnType<typeof partidaDirigida>) {
    d.dev.encerrar();
    expect(d.p.jogo.manual).toBe(false);
    d.p.jogo.manual = true;
    d.p.ui.dialogoC.velocidade = 0;
    d.dev.jogar();
    d.efeitos.length = 0;
  }

  function semEfeitoNovo(d: ReturnType<typeof partidaDirigida>) {
    expect(d.passos).toHaveLength(1);
    expect(d.efeitos).toEqual([]);
    expect(d.p.jogo.manual).toBe(true);
    expect(d.p.ui.dialogoC.velocidade).toBe(0);
    expect(d.dev.fim).toBe(false);
  }

  it('o pularPara antigo para sem mexer na sessão nova', async () => {
    const d = partidaDirigida();
    const antigo = d.dev.pularPara('a4');
    expect(d.passos).toHaveLength(1);
    expect(d.efeitos.filter((e) => e === 'carregamento')).toHaveLength(1);
    trocarDeDono(d);
    d.passos[0]();
    await antigo;
    semEfeitoNovo(d);
  });

  it('o jogarSozinho antigo para sem mexer na sessão nova', async () => {
    const d = partidaDirigida();
    const antigo = d.dev.jogarSozinho();
    expect(d.passos).toHaveLength(1);
    trocarDeDono(d);
    d.passos[0]();
    await antigo;
    semEfeitoNovo(d);
  });

  it('o avancar em curso volta no fim do passo, sem passar falas nem avançar de novo', async () => {
    const d = partidaDirigida();
    d.dev.jogar();
    const antigo = d.dev.avancar(10);
    expect(d.passos).toHaveLength(1);
    d.dev.encerrar();
    d.dev.jogar();
    d.efeitos.length = 0;
    d.passos[0]();
    expect(await antigo).toEqual({ t: 0, fim: true });
    expect(d.passos).toHaveLength(1);
    expect(d.efeitos).toEqual([]);
  });
});
