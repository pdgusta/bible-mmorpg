import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { carregarBiblia } from '../src/jogo/Biblia';
import type { CtxMissao, DefMissao, DefProva, ResultadoProva } from '../src/jogo/contratos';
import { Dialogo } from '../src/jogo/Dialogo';
import { criarSistemas, definirFlag, Missoes } from '../src/jogo/Missoes';
import { Progresso } from '../src/jogo/Progresso';
import { ArmazenamentoMemoria } from '../src/jogo/Salvamento';
import { registrarMemorias } from '../src/jogo/Memorias';
import { CinematicaFalsa, ciclo, interativoFalso, jogoFalso, personagemFalso, UIFalsa, type JogoFalso } from './falsos';

function montar(opcoes: { provas?: { iniciar(def: DefProva): Promise<ResultadoProva>; cancelar(): void } } = {}) {
  const noe = personagemFalso('noe', 0, 0, { sabedoria: 7 });
  const cam = personagemFalso('cam', 5, 0);
  const jogo = jogoFalso([noe, cam], { estaleiro: [20, 0], bosque: [-30, 10] });
  const ui = new UIFalsa();
  const cine = new CinematicaFalsa();
  const log: { nome: string; dados: any }[] = [];
  jogo.eventos.on('*', (e: { nome: string; dados: any }) => log.push(e));
  const progresso = new Progresso({
    eventos: jogo.eventos,
    ficha: (id) => jogo.pers.get(id)?.ficha ?? null,
    grupo: () => ['noe', 'cam'],
    ativo: () => jogo.ativo?.id ?? null,
  });
  const dialogo = new Dialogo({ ui, eventos: jogo.eventos, progresso, ativo: () => jogo.ativo, definirFlag: (n, v) => definirFlag(jogo, n, v) });
  const provas = opcoes.provas ?? { iniciar: vi.fn(async () => ({ venceu: true as const, tentativas: 1, tempo: 3 })), cancelar: vi.fn() };
  const autosaves: string[] = [];
  const missoes = new Missoes({ jogo, ui, cinematica: cine, progresso, provas, dialogo, autosave: (m) => autosaves.push(m) });
  return { jogo, ui, cine, log, progresso, dialogo, provas, missoes, autosaves, noe, cam };
}

const nomes = (log: { nome: string }[], prefixo: string) => log.filter((e) => e.nome.startsWith(prefixo));

/** Missão de duas etapas guiada por promessas que o teste controla. */
function missaoSimples(id: string, etapas: ((c: CtxMissao) => Promise<void>)[], extra: Partial<DefMissao> = {}): DefMissao {
  return {
    id, era: 'noe', titulo: `Missão ${id}`, tipos: ['tutorial'], resumo: '', refs: ['Gn 6:22'],
    etapas: etapas.map((executar, i) => ({ id: `e${i}`, objetivo: `Objetivo ${i}`, executar })),
    ...extra,
  };
}

describe('Missoes', () => {
  beforeAll(async () => {
    await carregarBiblia();
    registrarMemorias({ id: 'graca', titulo: 'Achou graça', ref: 'Gn 6:8', era: 'noe', descricao: '', forca: 1 });
  });

  it('roda as etapas em ordem, com eventos, autosave nas fronteiras, recompensa e próxima', async () => {
    const { missoes, log, autosaves, ui, progresso, noe, cam } = montar();
    const ordem: string[] = [];
    missoes.registrar([
      missaoSimples('a1', [async () => void ordem.push('a1.0'), async () => void ordem.push('a1.1')], { recompensa: { xp: 100, memoria: 'graca', armadura: 'espada' }, proxima: 'a2' }),
      missaoSimples('a2', [async () => void ordem.push('a2.0')]),
    ]);
    await missoes.iniciar('a1');
    await missoes.rodando;
    await ciclo();
    expect(ordem).toEqual(['a1.0', 'a1.1', 'a2.0']);
    expect(nomes(log, 'missao:').map((e) => e.nome)).toEqual([
      'missao:iniciada', 'missao:etapa', 'missao:etapa', 'missao:concluida',
      'missao:iniciada', 'missao:etapa', 'missao:concluida',
    ]);
    expect(autosaves).toEqual(['a1:e0', 'a1:e1', 'a2:e0', 'fim:a2']);
    // recompensa de XP vai para o grupo (100 < 120 do nível 2)
    expect([noe.ficha!.xp, cam.ficha!.xp]).toEqual([100, 100]);
    expect(progresso.memorias).toEqual(['graca']);
    expect(progresso.armadura).toEqual(['espada']);
    expect(ui.objetivos).toContainEqual(['Missão a1', 'Objetivo 0']);
    expect(ui.objetivos.at(-1)).toEqual([null, null]);
    expect(ui.avisos.some(([t]) => t === 'Missão concluída: Missão a1')).toBe(true);
    expect(missoes.concluida('a1') && missoes.concluida('a2')).toBe(true);
    expect(missoes.missaoAtual).toBeNull();
    expect(missoes.listaDiario().map((m) => [m.id, m.status, m.objetivo])).toEqual([['a1', 'concluida', null], ['a2', 'concluida', null]]);
  });

  it('esperas: tempo, flag, evento, interação e chegar', async () => {
    const { missoes, jogo, noe } = montar();
    interativoFalso(jogo, 'quilha', 20, 0, 2);
    const passos: string[] = [];
    let usou: unknown = null;
    missoes.registrar(missaoSimples('m', [
      async (c) => {
        await c.esperar(1);
        passos.push('esperou');
        await c.esperarFlag('vigaAmarrada');
        passos.push('flag');
        const d = await c.esperarEvento<{ n: number }>('sinal', (x) => x.n === 2);
        passos.push(`evento ${d.n}`);
        usou = await c.interacao('quilha');
        passos.push('interagiu');
        await c.chegar('ativo', 'quilha', 2);
        passos.push('chegou');
        c.contador('troncos', c.contador('troncos') + 1);
      },
    ]));
    const fim = missoes.iniciar('m');
    await ciclo();
    await jogo.avancar(0.5);
    expect(passos).toEqual([]);
    await jogo.avancar(0.6);
    expect(passos).toEqual(['esperou']);
    jogo.flags.vigaAmarrada = true; // flag ligada direto (sem evento) também vale
    await jogo.quadro();
    expect(passos).toEqual(['esperou', 'flag']);
    jogo.eventos.emit('sinal', { n: 1 });
    await ciclo();
    expect(passos.length).toBe(2);
    jogo.eventos.emit('sinal', { n: 2 });
    await ciclo();
    jogo.eventos.emit('interacao', { id: 'outro', personagem: noe });
    jogo.eventos.emit('interacao', { id: 'quilha', personagem: noe });
    await ciclo();
    expect(usou).toBe(noe);
    await jogo.avancar(0.3);
    expect(passos).not.toContain('chegou');
    noe.posicao.set(19, 0, 1);
    await jogo.quadro();
    await fim;
    expect(passos).toEqual(['esperou', 'flag', 'evento 2', 'interagiu', 'chegou']);
    expect(missoes.estado('m')!.contadores.troncos).toBe(1);
  });

  it('abortar rejeita as esperas com AbortError, desfaz a cena e mantém a etapa', async () => {
    const { missoes, jogo, ui, autosaves } = montar();
    let erro: unknown = null;
    missoes.registrar(missaoSimples('m', [
      async () => {},
      async (c) => {
        await c.cena(async () => {
          try {
            await c.esperarFlag('nunca');
          } catch (e) {
            erro = e;
            throw e;
          }
        });
      },
    ]));
    const fim = missoes.iniciar('m');
    await jogo.avancar(0.2);
    expect(jogo.controleLivre).toBe(false);
    expect(ui.cinema).toEqual([true]);
    missoes.abortar();
    await fim;
    expect((erro as Error).name).toBe('AbortError');
    expect(jogo.controleLivre).toBe(true);
    expect(ui.cinema).toEqual([true, false]);
    expect(missoes.estado('m')!.etapa).toBe(1);
    expect(missoes.estado('m')!.status).toBe('ativa');
    expect(missoes.ativa()).toBeNull();
    expect(missoes.missaoAtual).toBe('m');
    // retomar roda a etapa 1 de novo, sem autosave na largada
    autosaves.length = 0;
    jogo.flags.nunca = true;
    await missoes.retomar();
    expect(missoes.concluida('m')).toBe(true);
    expect(autosaves).toEqual(['fim:m']);
  });

  it('cena restaura controle e cinema mesmo com erro; o erro vira "missao:erro"', async () => {
    const { missoes, jogo, ui, log, cine } = montar();
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    missoes.registrar(missaoSimples('m', [
      async (c) => {
        await c.cena(async () => {
          await c.camera([0, 5, 0], new THREE.Vector3(1, 0, 0), 1);
          throw new Error('quebrou');
        });
      },
    ]));
    await missoes.iniciar('m');
    erroConsole.mockRestore();
    expect(jogo.controleLivre).toBe(true);
    expect(ui.cinema).toEqual([true, false]);
    expect(cine.idas).toBe(1);
    expect(cine.voltas).toBe(1);
    expect(log.find((e) => e.nome === 'missao:erro')?.dados).toMatchObject({ id: 'm', etapa: 0, erro: 'quebrou' });
    expect(missoes.concluida('m')).toBe(false);
  });

  it('restaurar + retomar continua da etapa salva, sem "missao:iniciada"', async () => {
    const { missoes, log } = montar();
    const rodou: number[] = [];
    missoes.registrar(missaoSimples('m', [0, 1, 2].map((i) => async () => void rodou.push(i))));
    missoes.restaurar({ m: { id: 'm', etapa: 2, status: 'ativa', contadores: { pares: 3 } } }, 'm');
    await missoes.retomar();
    expect(rodou).toEqual([2]);
    expect(nomes(log, 'missao:iniciada')).toHaveLength(0);
    expect(missoes.serializar()).toEqual({ missoes: { m: { id: 'm', etapa: 3, status: 'concluida', contadores: { pares: 3 } } }, missaoAtual: null });
  });

  it('mover usa a IA de cena; dentro de uma cena o personagem só é liberado no fim', async () => {
    const { missoes, jogo, cam } = montar();
    let emCenaAoChegar: boolean | null = null;
    missoes.registrar(missaoSimples('m', [
      async (c) => {
        await c.mover('cam', [8, 0], 3);
        emCenaAoChegar = cam.emCena;
        await c.cena(async () => {
          await c.mover('cam', 'estaleiro', 10);
          expect(cam.emCena).toBe(true);
        });
        expect(cam.emCena).toBe(false);
        await c.animar('cam', 'sim');
      },
    ]));
    const fim = missoes.iniciar('m');
    await jogo.avancar(5);
    await fim;
    expect(emCenaAoChegar).toBe(false);
    expect(cam.posicao.x).toBeCloseTo(20, 1);
    expect(cam.humano.animador.tocados).toEqual(['sim']);
  });

  it('mover não trava: depois do tempo limite o personagem é reposicionado', async () => {
    const { missoes, jogo, cam } = montar();
    cam.ia.moverCena = () => new Promise(() => {}); // preso
    missoes.registrar(missaoSimples('m', [async (c) => c.mover('cam', [10, 0], 5)]));
    const fim = missoes.iniciar('m');
    await jogo.avancar(10);
    await fim;
    expect(missoes.concluida('m')).toBe(true);
    expect(cam.posicao.x).toBe(10);
  });

  it('versículo, flags, unidade, disponibilidade e escolha com requisito', async () => {
    const { missoes, jogo, ui, progresso, cam } = montar();
    ui.escolher = (opcoes, pode) => opcoes.findIndex((o, i) => i === 1 && pode(o));
    missoes.registrar(missaoSimples('m', [
      async (c) => {
        c.versiculo('Ec 4:9');
        c.definirFlag('vigaAmarrada');
        c.unidade(10);
        c.disponivel('cam', false);
        const i = await c.escolha(null, [
          { texto: 'Ceder', efeitos: { atributos: { humildade: 1 }, unidade: 10, flag: 'cedeu' } },
          { texto: 'Dividir os dias', requer: { atributo: 'sabedoria', minimo: 6 }, efeitos: { atributos: { sabedoria: 1 }, unidade: 6 }, resposta: [{ quem: 'narrador', texto: 'Os pastores concordam.' }] },
          { texto: 'Impor-se', efeitos: { unidade: -10 } },
        ]);
        c.contador('escolha', i);
        await c.dialogo([{ quem: 'deus', ref: 'Gn 6:13' }, { quem: 'noe', texto: 'Eis-me aqui.' }]);
      },
    ]));
    await missoes.iniciar('m');
    expect(ui.banners[0].referenciaExtenso).toBe('Eclesiastes 4:9');
    // banner e falas bíblicas vão para os versículos recebidos
    expect(progresso.versiculos).toEqual(['Ec 4:9', 'Gn 6:13']);
    expect(jogo.flags.vigaAmarrada).toBe(true);
    expect(cam.disponivel).toBe(false);
    expect(missoes.estado('m')!.contadores.escolha).toBe(1);
    expect(jogo.pers.get('noe')!.ficha!.atributos.sabedoria).toBe(8);
    expect(progresso.unidade).toBe(76);
    expect(jogo.flags.cedeu).toBeUndefined();
    expect(ui.falas.map((f) => f.length)).toEqual([1, 2]);
  });

  it('fala bíblica com trecho errado falha antes de chegar à UI', async () => {
    const { missoes, ui } = montar();
    const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    missoes.registrar(missaoSimples('m', [async (c) => c.dialogo([{ quem: 'deus', ref: 'Gn 6:13', trecho: 'isto não está no versículo' }])]));
    await missoes.iniciar('m');
    erroConsole.mockRestore();
    expect(ui.falas).toHaveLength(0);
    expect(missoes.concluida('m')).toBe(false);
  });

  it('prova: tira o controle (menos no medo) e devolve depois', async () => {
    let controleDurante: boolean[] = [];
    const { missoes, jogo } = montar({
      provas: {
        iniciar: async () => {
          controleDurante.push(jogo.controleLivre);
          return { venceu: true, tentativas: 2, tempo: 1 };
        },
        cancelar: () => {},
      },
    });
    let res: ResultadoProva | null = null;
    missoes.registrar(missaoSimples('m', [
      async (c) => {
        res = await c.prova({ id: 'p', tipo: 'ira', titulo: '', instrucao: '', mentiras: [], alvo: 1 });
        await c.prova({ id: 'q', tipo: 'medo', titulo: '', instrucao: '', mentiras: [], alvo: 1 });
      },
    ]));
    await missoes.iniciar('m');
    expect(controleDurante).toEqual([false, true]);
    expect(jogo.controleLivre).toBe(true);
    expect(res!.tentativas).toBe(2);
    controleDurante = [];
  });

  it('abortar durante uma prova cancela a prova', async () => {
    const cancelar = vi.fn();
    const { missoes, jogo } = montar({ provas: { iniciar: () => new Promise(() => {}), cancelar } });
    missoes.registrar(missaoSimples('m', [async (c) => void (await c.prova({ id: 'p', tipo: 'tentacao', titulo: '', instrucao: '', mentiras: ['x'], alvo: 1 }))]));
    const fim = missoes.iniciar('m');
    await jogo.avancar(0.2);
    expect(jogo.controleLivre).toBe(false);
    missoes.abortar();
    await fim;
    expect(cancelar).toHaveBeenCalledOnce();
  });

  it('marcadores e alvos: pontos registrados, mundo, interativos e personagens', async () => {
    const { missoes, jogo } = montar();
    interativoFalso(jogo, 'bomba', 3, 4, 5, 'Bomba');
    missoes.registrarPontos((nome) => (nome === 'vazamento1' ? new THREE.Vector3(1, 6, 1) : null));
    expect(missoes.resolverAlvo('vazamento1')).toMatchObject({ usarY: true });
    expect(missoes.resolverAlvo('estaleiro').pos.x).toBe(20);
    expect(missoes.resolverAlvo('bomba').rotulo).toBe('Bomba');
    expect(missoes.resolverAlvo({ personagem: 'cam' }).pos).toBe(jogo.pers.get('cam')!.posicao);
    expect(() => missoes.resolverAlvo('nada')).toThrow(/desconhecido/);
    missoes.registrar(missaoSimples('m', [async (c) => {
      c.objetivo('Leve os troncos (0/4)', ['estaleiro', { personagem: 'cam' }]);
      await c.esperarFlag('fim');
    }]));
    const fim = missoes.iniciar('m');
    await ciclo();
    const ms = missoes.marcadores();
    expect(ms.map((m) => m.tipo)).toEqual(['objetivo', 'personagem']);
    expect(ms[1].rotulo).toBe('Cam');
    expect(missoes.listaDiario()[0].objetivo).toBe('Leve os troncos (0/4)');
    jogo.flags.fim = true;
    await jogo.quadro();
    await fim;
    expect(missoes.marcadores()).toEqual([]);
  });

  it('criarSistemas liga tudo: autosave grava o estado no armazenamento', async () => {
    const noe = personagemFalso('noe', 1, 2);
    const jogo: JogoFalso = jogoFalso([noe]);
    const ui = new UIFalsa();
    const armazenamento = new ArmazenamentoMemoria();
    const s = criarSistemas(jogo, ui, new CinematicaFalsa(), { armazenamento, era: () => 'noe' });
    s.missoes.registrar(missaoSimples('a1', [async (c) => c.memoria('graca'), async (c) => c.xp('grupo', 'construir')]));
    await s.missoes.iniciar('a1');
    await s.salvamento.aguardar();
    const auto = JSON.parse(armazenamento.dados.get('auto')!);
    expect(auto.missoes.a1.status).toBe('concluida');
    expect(auto.memorias).toEqual(['graca']);
    expect(auto.era).toBe('noe');
    expect(auto.personagens.noe.pos).toEqual([1, 0, 2]);
    expect(ui.avisos.some(([, tipo]) => tipo === 'xp')).toBe(true);
    await jogo.avancar(1);
    expect(s.progresso.tempoJogado).toBeCloseTo(1, 5);

    // carregar: aplicar devolve flags (mesmo objeto), progresso, missões e personagens
    jogo.flags.arca = 2;
    const salvo = await s.salvamento.salvar(1);
    const flagsRef = jogo.flags;
    s.novoJogo();
    expect(jogo.flags).toEqual({});
    expect(s.progresso.memorias).toEqual([]);
    noe.posicao.set(0, 0, 0);
    s.aplicar((await s.salvamento.carregar(1))!);
    expect(jogo.flags).toBe(flagsRef);
    expect(jogo.flags.arca).toBe(2);
    expect(s.progresso.memorias).toEqual(['graca']);
    expect(s.missoes.concluida('a1')).toBe(true);
    expect(noe.posicao.toArray()).toEqual(salvo.personagens.noe.pos);
    expect((await s.salvamento.listar())[0]).toMatchObject({ era: 'Era 1 — Noé', missaoAtual: null, personagem: 'Noe' });
  });
});
