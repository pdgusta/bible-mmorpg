import { describe, expect, it, vi } from 'vitest';
import { Eventos } from '../src/core/Eventos';
import { Ficha } from '../src/jogo/Atributos';
import { VERSAO_SAVE, type DadosSave, type EstadoMissao } from '../src/jogo/contratos';
import { RegistroMemorias } from '../src/jogo/Memorias';
import { Progresso } from '../src/jogo/Progresso';
import {
  aplicarPersonagens, ArmazenamentoComReserva, ArmazenamentoMemoria, criarArmazenamento, ErroSave, lerSave,
  migrarSave, personagensParaSave, restaurarFlags, Salvamento, type AdaptadorArmazenamento,
} from '../src/jogo/Salvamento';
import { personagemFalso } from './falsos';

function montar(armazenamento: AdaptadorArmazenamento = new ArmazenamentoMemoria()) {
  const eventos = new Eventos();
  const salvos: unknown[] = [];
  eventos.on('salvo', (d) => salvos.push(d));
  const noe = personagemFalso('noe', 10, 20, { fe: 7 });
  const mulher = personagemFalso('mulherNoe', 0, 0, {}, false);
  const memorias = new RegistroMemorias();
  memorias.registrar({ id: 'graca', titulo: 'Achou graça', ref: 'Gn 6:8', era: 'noe', descricao: '', forca: 1 });
  const progresso = new Progresso({ eventos, ficha: (id) => (id === 'noe' ? noe.ficha : null), grupo: () => ['noe'], memorias });
  const estados: { missoes: Record<string, EstadoMissao>; missaoAtual: string | null } = {
    missoes: { a1: { id: 'a1', etapa: 2, status: 'ativa', contadores: { troncos: 3 } } },
    missaoAtual: 'a1',
  };
  const flags: Record<string, unknown> = { arcaEstagio: 1 };
  let relogio = 0;
  const s = new Salvamento(armazenamento, {
    progresso,
    missoes: { serializar: () => JSON.parse(JSON.stringify(estados)) },
    flags: () => flags,
    personagens: () => personagensParaSave([noe, mulher]),
    era: () => 'noe',
    hora: () => 6.5,
    ativo: () => 'noe',
    eventos,
    agora: () => new Date(Date.UTC(2026, 0, 1, 0, 0, relogio++)),
    nomeEra: (id) => (id === 'noe' ? 'Era 1 — Noé' : id),
    nomeMissao: (id) => (id === 'a1' ? 'Achou graça' : id),
    nomePersonagem: (id) => (id === 'noe' ? 'Noé' : id),
  });
  return { s, progresso, estados, flags, salvos, noe, armazenamento };
}

describe('Salvamento', () => {
  it('monta o DadosSave a partir do progresso, missões, flags e personagens', () => {
    const { s, progresso } = montar();
    progresso.memoria('graca');
    progresso.receberArmadura('espada');
    progresso.atualizar(42);
    const d = s.montar();
    expect(d.versao).toBe(VERSAO_SAVE);
    expect(d.era).toBe('noe');
    expect(d.hora).toBe(6.5);
    expect(d.missaoAtual).toBe('a1');
    expect(d.missoes.a1.contadores.troncos).toBe(3);
    expect(d.flags).toEqual({ arcaEstagio: 1 });
    expect(Object.keys(d.personagens)).toEqual(['noe']); // só jogáveis
    expect(d.personagens.noe.pos).toEqual([10, 0, 20]);
    expect(d.personagens.noe.ficha!.atributos.fe).toBe(7);
    expect(d.memorias).toEqual(['graca']);
    expect(d.armadura).toEqual(['espada']);
    expect(d.tempoJogado).toBe(42);
    expect(d.criadoEm).toBe('2026-01-01T00:00:00.000Z');
  });

  it('salva e carrega nos 3 espaços e no auto, emitindo "salvo"', async () => {
    const { s, salvos } = montar();
    const d1 = await s.salvar(1);
    await s.salvar(3);
    await s.autosave('teste');
    expect(salvos).toEqual([{ slot: 1 }, { slot: 3 }, { slot: 0 }]);
    const lido = await s.carregar(1);
    expect(lido).toEqual(d1);
    expect(await s.carregar(2)).toBeNull();
    expect((await s.carregar('auto'))!.missaoAtual).toBe('a1');
  });

  it('o autosave tira a foto na hora da chamada', async () => {
    const { s, estados, armazenamento } = montar();
    const p = s.autosave('etapa');
    estados.missoes.a1.etapa = 99;
    await p;
    const d = JSON.parse((armazenamento as ArmazenamentoMemoria).dados.get('auto')!);
    expect(d.missoes.a1.etapa).toBe(2);
  });

  it('lista os espaços (vazio, cheio e corrompido) e apaga', async () => {
    const { s, armazenamento } = montar();
    await s.salvar(2);
    await armazenamento.escrever('slot3', '{ isto não é json');
    const lista = await s.listar();
    expect(lista.map((r) => [r.slot, r.vazio, !!r.erro])).toEqual([[1, true, false], [2, false, false], [3, false, true], ['auto', true, false]]);
    expect(lista[1]).toMatchObject({ era: 'Era 1 — Noé', missao: 'Achou graça', personagem: 'Noé', eraId: 'noe', ativo: 'noe', missaoAtual: 'a1' });
    await s.apagar(2);
    expect(await s.carregar(2)).toBeNull();
  });

  it('exporta e importa JSON (ida e volta), opcionalmente gravando num espaço', async () => {
    const { s } = montar();
    const d = await s.salvar(1);
    const texto = s.exportar(d);
    const outro = montar();
    const importado = await outro.s.importar(texto, 2);
    expect(importado).toEqual(d);
    expect(await outro.s.carregar(2)).toEqual(d);
    expect(await s.exportarSlot(1)).toBe(texto);
    const terceiro = montar();
    await terceiro.s.importarArquivo(new Blob([texto]), 'auto');
    expect(await terceiro.s.carregar('auto')).toEqual(d);
    await expect(outro.s.importar('nada disso')).rejects.toBeInstanceOf(ErroSave);
  });

  it('migra saves antigos (sem versão) e recusa versões futuras ou malformadas', () => {
    const antigo = { era: 'noe', flags: { x: 1 }, memorias: ['graca', 3], personagens: { noe: { pos: [1, 2, 3], ficha: { atributos: { fe: 12 }, xp: 5, nivel: 2 } } } };
    const d = migrarSave(antigo);
    expect(d.versao).toBe(VERSAO_SAVE);
    expect(d.unidade).toBe(60);
    expect(d.memorias).toEqual(['graca']);
    expect(d.missoes).toEqual({});
    expect(d.missaoAtual).toBeNull();
    expect(d.personagens.noe.disponivel).toBe(true);
    expect(d.personagens.noe.ficha!.atributos.fe).toBe(10);
    expect(d.personagens.noe.ficha!.atributos.forca).toBe(3);
    expect(() => migrarSave({ versao: VERSAO_SAVE + 1 })).toThrow(/mais nova/);
    expect(() => migrarSave([])).toThrow(ErroSave);
    expect(() => migrarSave({ versao: 1, personagens: { noe: { pos: [1, 'x', 3] } } })).toThrow(/posição/);
    expect(() => lerSave('[1,2')).toThrow(/não é JSON/);
  });

  it('aplica personagens e flags de um save', () => {
    const noe = personagemFalso('noe', 0, 0);
    const dados: DadosSave['personagens'] = {
      noe: { pos: [5, 1, 6], yaw: 1.5, disponivel: false, ficha: new Ficha({ coragem: 9 }).serializar(), aprendidos: ['construirAltar'] },
      ausente: { pos: [0, 0, 0], yaw: 0, disponivel: true, ficha: null, aprendidos: [] },
    };
    aplicarPersonagens(dados, (id) => (id === 'noe' ? (noe as never) : null));
    expect(noe.posicao.toArray()).toEqual([5, 1, 6]);
    expect(noe.yaw).toBe(1.5);
    expect(noe.disponivel).toBe(false);
    expect(noe.ficha!.atributos.coragem).toBe(9);
    expect(noe.aprendidos).toEqual(['construirAltar']);
    const flags: Record<string, unknown> = { velha: true };
    const ref = flags;
    restaurarFlags(flags, { nova: 1 });
    expect(ref).toEqual({ nova: 1 });
  });

  it('com reserva: se o primário falhar, grava e lê na reserva', async () => {
    const quebrado: AdaptadorArmazenamento = {
      nome: 'quebrado',
      ler: async () => {
        throw new Error('sem acesso');
      },
      escrever: async () => {
        throw new Error('cota');
      },
      apagar: async () => {},
    };
    const reserva = new ArmazenamentoMemoria();
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { s } = montar(new ArmazenamentoComReserva(quebrado, reserva));
    const d = await s.salvar(1);
    expect(reserva.dados.has('slot1')).toBe(true);
    expect(await s.carregar(1)).toEqual(d);
    aviso.mockRestore();
  });

  it('sem IndexedDB nem localStorage (Node), usa memória', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = await criarArmazenamento();
    aviso.mockRestore();
    expect(['memoria', 'localStorage']).toContain(a.nome);
  });

  it('localStorage como armazenamento', async () => {
    const mapa = new Map<string, string>();
    const ls = {
      getItem: (k: string) => mapa.get(k) ?? null,
      setItem: (k: string, v: string) => void mapa.set(k, v),
      removeItem: (k: string) => void mapa.delete(k),
    } as unknown as Storage;
    vi.stubGlobal('localStorage', ls);
    try {
      const a = await criarArmazenamento();
      expect(a.nome).toBe('localStorage');
      const { s } = montar(a);
      await s.salvar('auto');
      expect([...mapa.keys()]).toEqual(['a-semente:auto']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
