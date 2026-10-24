import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Eventos } from '../src/core/Eventos';
import { carregarBiblia } from '../src/jogo/Biblia';
import type { DefProva, ResultadoProva } from '../src/jogo/contratos';
import { RegistroMemorias } from '../src/jogo/Memorias';
import { Progresso } from '../src/jogo/Progresso';
import { Provas, textoCurto } from '../src/jogo/Provas';
import { aleatorioFixo, ciclo, EntradaFalsa, personagemFalso, UIFalsa } from './falsos';

function montar(atributos = {}) {
  const eventos = new Eventos();
  const log: { nome: string; dados: any }[] = [];
  eventos.on('*', (e: { nome: string; dados: any }) => log.push(e));
  const ui = new UIFalsa();
  const entrada = new EntradaFalsa();
  const noe = personagemFalso('noe', 0, 0, atributos);
  const sem = personagemFalso('sem', 2, 0);
  const pers: Record<string, ReturnType<typeof personagemFalso>> = { noe, sem };
  const memorias = new RegistroMemorias();
  memorias.registrar([
    { id: 'graca', titulo: 'Achou graça', ref: 'Gn 6:8', era: 'noe', descricao: '', forca: 1 },
    { id: 'pacto', titulo: 'O pacto', ref: 'Gn 6:18', era: 'noe', descricao: '', forca: 2 },
    { id: 'arcoIris', titulo: 'O sinal da aliança', ref: 'Gn 9:13', era: 'noe', descricao: '', forca: 3, frase: 'Deus cumpriu a aliança.' },
    { id: 'estrelas', titulo: 'Conta as estrelas', ref: 'Gn 15:5', era: 'abraao', descricao: '', forca: 0 },
  ]);
  const progresso = new Progresso({ eventos, ficha: (id) => pers[id]?.ficha ?? null, grupo: () => ['noe'], ativo: () => 'noe', memorias });
  const provas = new Provas({
    ui,
    entrada,
    eventos,
    progresso,
    memorias,
    personagem: (id) => (id ? pers[id] ?? null : noe),
    aleatorio: aleatorioFixo(7),
  });
  /** Um quadro: a prova lê a entrada e depois os toques "pressionados" acabam. */
  const quadro = (dt = 0.1) => {
    provas.atualizar(dt);
    entrada.fimDoQuadro();
  };
  const avancar = (seg: number, dt = 0.1, antes?: () => void) => {
    for (let i = 0; i < Math.round(seg / dt); i++) {
      antes?.();
      quadro(dt);
    }
  };
  return { eventos, log, ui, entrada, progresso, provas, quadro, avancar, noe, sem };
}

const tentacao: DefProva = {
  id: 'tentacaoTorre', tipo: 'tentacao', titulo: 'Sussurros', instrucao: 'Q — Está escrito',
  mentiras: ['Desista.', 'Fique na cidade.', 'Deus te esqueceu.', 'Para que tanto trabalho?'],
  respostas: ['Gn 6:18', 'Gn 6:22'], alvo: 4,
};

/** Acompanha o estado de uma promessa. */
function acompanhar<T>(p: Promise<T>) {
  const s: { valor?: T; erro?: unknown; pronto: boolean } = { pronto: false };
  p.then((v) => { s.valor = v; s.pronto = true; }, (e) => { s.erro = e; s.pronto = true; });
  return s;
}

describe('Provas', () => {
  beforeAll(async () => {
    await carregarBiblia();
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // avisos de roteiro esperados nos testes
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('textoCurto corta em fronteira de palavra', () => {
    expect(textoCurto('curto', 10)).toBe('curto');
    const t = textoCurto('uma frase bem comprida para cortar aqui', 20);
    expect(t.endsWith('…')).toBe(true);
    expect(t.length).toBeLessThanOrEqual(20);
  });

  it('tentação: sem reagir, os dardos ferem o domínio e a luta recomeça', async () => {
    const { provas, avancar, ui, log } = montar();
    const r = acompanhar(provas.iniciar(tentacao));
    expect(provas.emProva).toBe(true);
    expect(log.find((e) => e.nome === 'prova:inicio')?.dados).toEqual({ id: 'tentacaoTorre', tipo: 'tentacao', livre: false });
    let viuDardo = false;
    for (let i = 0; i < 60; i++) {
      avancar(0.1);
      viuDardo ||= ui.ultimoEstadoProva!.dardos.length > 0;
    }
    const est = ui.ultimoEstadoProva!;
    expect(viuDardo).toBe(true);
    expect(est.firmeza).toBeLessThan(1);
    // sem Espada não há palavra para responder
    expect(est.palavra).toBeNull();
    let perdeu = false;
    for (let i = 0; i < 1200 && !perdeu; i++) {
      avancar(0.1);
      perdeu = !!ui.ultimoEstadoProva?.mensagem?.startsWith('A luta continua');
    }
    expect(perdeu).toBe(true);
    avancar(3);
    expect(ui.ultimoEstadoProva!.firmeza).toBe(1);
    expect(ui.ultimoEstadoProva!.progresso).toBe(0);
    await ciclo();
    expect(r.pronto).toBe(false);
    provas.resolverAutomaticamente();
    await ciclo();
    expect((r.valor as ResultadoProva).tentativas).toBe(2);
  });

  it('tentação: "Está escrito" exige a Espada e um versículo recebido, desfaz dardos e vence', async () => {
    const { provas, avancar, entrada, ui, progresso, log } = montar();
    progresso.receberVersiculo('Gn 6:22');
    const r = acompanhar(provas.iniciar(tentacao));
    avancar(4);
    entrada.apertar('habilidade');
    avancar(0.1);
    expect(ui.ultimoEstadoProva!.mensagem).toMatch(/Espada do Espírito/);
    expect(ui.ultimoEstadoProva!.progresso).toBe(0);
    expect(ui.ultimoEstadoProva!.palavra).toBeNull();
    progresso.receberArmadura('espada');
    avancar(0.1);
    // só a resposta recebida (Gn 6:22) serve; Gn 6:18 não foi recebido
    expect(ui.ultimoEstadoProva!.palavra?.ref).toBe('Gn 6:22');
    expect(ui.ultimoEstadoProva!.palavra?.texto.length).toBeGreaterThan(10);
    // clique na UI ("Está escrito") vale o mesmo que Q
    for (let i = 0; i < 60 && ui.ultimoEstadoProva!.progresso === 0; i++) {
      provas.responder();
      avancar(0.1);
    }
    expect(ui.ultimoEstadoProva!.progresso).toBeCloseTo(1 / tentacao.alvo, 5);
    // responde sempre que houver dardo e a palavra estiver pronta
    for (let i = 0; i < 600 && !r.pronto; i++) {
      const e = ui.ultimoEstadoProva;
      if (e && e.palavra?.pronta && e.dardos.some((d) => !d.bloqueado)) entrada.apertar('habilidade');
      avancar(0.1);
      await ciclo();
    }
    expect(r.pronto).toBe(true);
    expect((r.valor as ResultadoProva).venceu).toBe(true);
    expect((r.valor as ResultadoProva).tentativas).toBe(1);
    expect(ui.ultimoEstadoProva).toBeNull();
    expect(provas.emProva).toBe(false);
    expect(log.find((e) => e.nome === 'prova:fim')?.dados.resultado.venceu).toBe(true);
  });

  it('tentação: sem respostas não há palavra; respostas nunca recebidas são recebidas para não travar', () => {
    const { provas, avancar, entrada, ui, progresso } = montar();
    progresso.receberArmadura('espada');
    void provas.iniciar({ ...tentacao, respostas: [] }).catch(() => {});
    avancar(4);
    entrada.apertar('habilidade');
    avancar(0.1);
    expect(ui.ultimoEstadoProva!.mensagem).toMatch(/Nenhuma palavra/);
    provas.cancelar();
    void provas.iniciar(tentacao).catch(() => {});
    expect(progresso.versiculos).toEqual(['Gn 6:18']);
    provas.cancelar();
  });

  it('o Escudo da fé (botão direito) bloqueia os dardos', () => {
    const { provas, avancar, entrada, ui, progresso } = montar();
    progresso.receberArmadura('escudo');
    void provas.iniciar(tentacao);
    entrada.segurar('escudo');
    avancar(20);
    expect(ui.ultimoEstadoProva!.firmeza).toBe(1);
    expect(ui.ultimoEstadoProva!.escudo).toBe(true);
    expect(progresso.estatisticas.dardosBloqueados).toBeGreaterThan(0);
  });

  it('ira: E proclama, a ira alta trava a mensagem, R acalma e pausa', async () => {
    const { provas, avancar, entrada, ui } = montar({ dominio: 3 });
    const def: DefProva = { id: 'pregarPraca', tipo: 'ira', titulo: 'Zombarias', instrucao: '', mentiras: ['Velho louco!', 'Chuva? Nunca!'], alvo: 10, intensidade: 1 };
    const r = acompanhar(provas.iniciar(def));
    entrada.segurar('interagir');
    avancar(3);
    const p1 = ui.ultimoEstadoProva!.progresso;
    expect(p1).toBeGreaterThan(0);
    // orando: não avança, mas acalma
    entrada.segurar('orar');
    const firmeza = ui.ultimoEstadoProva!.firmeza;
    avancar(2);
    expect(ui.ultimoEstadoProva!.progresso).toBeCloseTo(p1, 5);
    expect(ui.ultimoEstadoProva!.firmeza).toBeGreaterThanOrEqual(Math.min(1, firmeza));
    // estratégia: proclama com calma; ora quando a ira sobe
    for (let i = 0; i < 1000 && !r.pronto; i++) {
      const f = ui.ultimoEstadoProva?.firmeza ?? 1;
      entrada.segurar('orar', f < 0.5);
      avancar(0.1);
      await ciclo();
    }
    expect(r.pronto).toBe(true);
    expect((r.valor as ResultadoProva).tentativas).toBe(1);
  });

  it('ira: com a ira no limite, segurar E não avança', () => {
    const { provas, avancar, entrada, ui } = montar({ dominio: 1, perseveranca: 1 });
    const def: DefProva = { id: 'ira', tipo: 'ira', titulo: '', instrucao: '', mentiras: ['zombaria'], alvo: 100, intensidade: 1 };
    void provas.iniciar(def);
    entrada.segurar('interagir');
    let travou = false;
    for (let i = 0; i < 3000 && !travou; i++) {
      avancar(0.1);
      travou = !!ui.ultimoEstadoProva?.mensagem?.includes('trava');
    }
    expect(travou).toBe(true);
    const p = ui.ultimoEstadoProva!.progresso;
    avancar(0.3);
    expect(ui.ultimoEstadoProva!.progresso).toBeCloseTo(p, 5);
  });

  it('medo: a calma cai; R, encorajar e o Capacete ajudam; vence após segundos firmes', async () => {
    const def: DefProva = { id: 'medoArca', tipo: 'medo', titulo: 'A tempestade', instrucao: '', mentiras: ['Vocês vão afundar!'], alvo: 8 };
    const queda = (capacete: boolean) => {
      const m = montar();
      if (capacete) m.progresso.receberArmadura('capacete');
      void m.provas.iniciar(def);
      m.avancar(1);
      const a = m.ui.ultimoEstadoProva!.firmeza;
      m.avancar(2);
      return a - m.ui.ultimoEstadoProva!.firmeza;
    };
    expect(queda(true)).toBeLessThan(queda(false));

    const { provas, avancar, entrada, ui, eventos, log, noe } = montar();
    const r = acompanhar(provas.iniciar(def));
    expect(log.find((e) => e.nome === 'prova:inicio')?.dados.livre).toBe(true);
    avancar(2);
    expect(noe.modVelocidade).toBeLessThan(1);
    const antes = ui.ultimoEstadoProva!.firmeza;
    eventos.emit('interacao', { id: 'encorajar_sem', personagem: noe });
    avancar(0.1);
    expect(ui.ultimoEstadoProva!.firmeza).toBeGreaterThan(antes);
    entrada.segurar('orar');
    for (let i = 0; i < 400 && !r.pronto; i++) {
      avancar(0.1);
      await ciclo();
    }
    expect(r.pronto).toBe(true);
    expect(noe.modVelocidade).toBe(1);
  });

  it('medo: um aliado por perto faz a calma cair mais devagar', () => {
    const def = (aliado?: string): DefProva => ({ id: 'medoMoria', tipo: 'medo', titulo: '', instrucao: '', mentiras: [], alvo: 30, aliado });
    const queda = (aliado?: string, longe = false) => {
      const m = montar();
      if (longe) m.sem.posicao.set(50, 0, 0);
      void m.provas.iniciar(def(aliado));
      m.avancar(2);
      return 0.75 - m.ui.ultimoEstadoProva!.firmeza;
    };
    expect(queda('sem')).toBeLessThan(queda());
    expect(queda('sem', true)).toBeCloseTo(queda(), 5);
  });

  it('dúvida: lembrar memórias acende estrelas pela força; a frase especial aparece', async () => {
    const { provas, avancar, entrada, ui, progresso } = montar({ fe: 5 });
    for (const m of ['graca', 'pacto', 'arcoIris', 'estrelas']) progresso.memoria(m);
    const def: DefProva = { id: 'duvida', tipo: 'duvida', titulo: 'Conta as estrelas', instrucao: '', mentiras: ['Você é velho demais.'], alvo: 9 };
    const r = acompanhar(provas.iniciar(def));
    avancar(0.1);
    const mems = ui.ultimoEstadoProva!.memorias!;
    // a de força 0 não aparece
    expect(mems.map((m) => m.id)).toEqual(['graca', 'pacto', 'arcoIris']);
    expect(mems.map((m) => m.tecla)).toEqual([1, 2, 3]);
    entrada.apertar('troca3');
    avancar(0.1);
    const e = ui.ultimoEstadoProva!;
    expect(e.mensagem).toBe('Deus cumpriu a aliança.');
    expect(e.progresso).toBeCloseTo((3 * (1.2 + 5 * 0.06)) / 9, 1);
    expect(e.memorias!.find((m) => m.id === 'arcoIris')!.usada).toBe(true);
    expect(e.memorias!.find((m) => m.id === 'graca')!.tecla).toBe(1);
    expect(provas.lembrar('arcoIris')).toBe(false);
    expect(provas.lembrar('pacto')).toBe(true);
    entrada.apertar('troca1');
    avancar(0.1);
    for (let i = 0; i < 300 && !r.pronto; i++) {
      entrada.apertar('troca1');
      avancar(0.1);
      await ciclo();
    }
    expect(r.pronto).toBe(true);
  });

  it('dúvida sem nenhuma memória ainda se vence orando (sem travar)', async () => {
    const { provas, avancar, entrada } = montar();
    const r = acompanhar(provas.iniciar({ id: 'd', tipo: 'duvida', titulo: '', instrucao: '', mentiras: [], alvo: 3 }));
    entrada.segurar('orar');
    for (let i = 0; i < 200 && !r.pronto; i++) {
      avancar(0.1);
      await ciclo();
    }
    expect(r.pronto).toBe(true);
  });

  it('resolverAutomaticamente vence na hora; cancelar rejeita com AbortError e libera', async () => {
    const { provas, ui, log } = montar();
    const r1 = provas.iniciar(tentacao);
    await expect(provas.iniciar(tentacao)).rejects.toThrow(/andamento/);
    expect(provas.resolverAutomaticamente()).toBe(true);
    await expect(r1).resolves.toMatchObject({ venceu: true, tentativas: 1 });
    expect(ui.ultimoEstadoProva).toBeNull();
    expect(provas.resolverAutomaticamente()).toBe(false);

    const r2 = provas.iniciar({ ...tentacao, id: 'outra' });
    provas.cancelar();
    await expect(r2).rejects.toMatchObject({ name: 'AbortError' });
    expect(provas.emProva).toBe(false);
    expect(log.filter((e) => e.nome === 'prova:fim').map((e) => e.dados)).toEqual([
      { id: 'tentacaoTorre', resultado: expect.objectContaining({ venceu: true }) },
      { id: 'outra', resultado: null },
    ]);
  });
});
