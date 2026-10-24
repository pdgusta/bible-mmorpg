import { describe, expect, it } from 'vitest';
import { Eventos } from '../src/core/Eventos';
import { Ficha, XP, xpParaNivel } from '../src/jogo/Atributos';
import { RegistroMemorias } from '../src/jogo/Memorias';
import { Progresso, UNIDADE_INICIAL } from '../src/jogo/Progresso';

function montar() {
  const eventos = new Eventos();
  const log: { nome: string; dados: any }[] = [];
  eventos.on('*', (e: { nome: string; dados: any }) => log.push(e));
  const fichas: Record<string, Ficha> = { noe: new Ficha({ fe: 7 }), cam: new Ficha({ forca: 7 }), sem: new Ficha() };
  const avisos: [string, string][] = [];
  const memorias = new RegistroMemorias();
  memorias.registrar([
    { id: 'graca', titulo: 'Achou graça', ref: 'Gn 6:8', era: 'noe', descricao: '', forca: 1 },
    { id: 'enoque', titulo: 'Enoque caminhava com Deus', ref: 'Gn 5:24', era: 'noe', descricao: '', forca: 1, segredo: true },
    { id: 'poDaTerra', titulo: 'Como o pó da terra', ref: 'Gn 13:16', era: 'abraao', descricao: '', forca: 1, segredo: true },
  ]);
  let ativo = 'noe';
  const p = new Progresso({
    eventos,
    ficha: (id) => fichas[id] ?? null,
    grupo: () => ['noe', 'cam', 'sem'],
    ativo: () => ativo,
    nome: (id) => id.toUpperCase(),
    avisar: (t, tipo) => avisos.push([t, tipo]),
    memorias,
  });
  return { p, log, fichas, avisos, eventos, definirAtivo: (id: string) => (ativo = id) };
}

const eventosDe = (log: { nome: string; dados: any }[], nome: string) => log.filter((e) => e.nome === nome).map((e) => e.dados);

describe('Progresso', () => {
  it('dá XP padrão da fonte a um personagem e emite "xp"', () => {
    const { p, log, fichas, avisos } = montar();
    expect(p.ganharXP('cam', 'missao')).toBe(XP.missao);
    expect(fichas.cam.xp).toBe(XP.missao);
    expect(eventosDe(log, 'xp')).toEqual([{ personagem: 'cam', qtd: XP.missao, fonte: 'missao' }]);
    expect(avisos.at(-1)).toEqual([`+${XP.missao} XP para CAM — Missão concluída`, 'xp']);
  });

  it('sobe de nível e emite "nivel"', () => {
    const { p, log, fichas } = montar();
    p.ganharXP('noe', 'missao', xpParaNivel(1) + 5);
    expect(fichas.noe.nivel).toBe(2);
    expect(eventosDe(log, 'nivel')).toEqual([{ personagem: 'noe', nivel: 2 }]);
  });

  it('XP de grupo e bônus de +20% na cooperação com Unidade alta', () => {
    const { p, log, avisos } = montar();
    expect(p.unidade).toBe(UNIDADE_INICIAL);
    expect(p.ganharXP('grupo', 'cooperacao')).toBe(60);
    expect(eventosDe(log, 'xp')).toHaveLength(3);
    p.alterarUnidade(30);
    expect(p.unidadeAlta).toBe(true);
    expect(p.ganharXP('grupo', 'cooperacao')).toBe(72);
    expect(avisos.at(-1)?.[0]).toContain('Unidade +20%');
    // o bônus é só de cooperação
    expect(p.ganharXP('grupo', 'construir')).toBe(XP.construir);
  });

  it('ignora quem não tem ficha', () => {
    const { p, log } = montar();
    expect(p.ganharXP('mulherDeNoe', 'servir')).toBe(0);
    expect(eventosDe(log, 'xp')).toHaveLength(0);
  });

  it('treina atributos pelo uso e emite "atributo" ao subir', () => {
    const { p, log, fichas } = montar();
    const antes = fichas.cam.atributos.forca;
    let subiu = false;
    for (let i = 0; i < 20 && !subiu; i++) subiu = p.treinar('cam', 'forca', 0.5);
    expect(subiu).toBe(true);
    expect(fichas.cam.atributos.forca).toBe(antes + 1);
    expect(eventosDe(log, 'atributo')).toEqual([{ personagem: 'cam', atributo: 'forca', valor: antes + 1 }]);
  });

  it('soma pontos inteiros de atributo (efeitos de escolha) dentro de 1..10', () => {
    const { p, fichas } = montar();
    expect(p.somarAtributo('sem', 'humildade', 1)).toBe(4);
    expect(p.somarAtributo('sem', 'humildade', 20)).toBe(10);
    expect(p.somarAtributo('sem', 'humildade', -50)).toBe(1);
    expect(fichas.sem.atributos.humildade).toBe(1);
  });

  it('Unidade fica em 0..100, emite "unidade" e o Calçado da paz amortece quedas', () => {
    const { p, log } = montar();
    p.alterarUnidade(-10);
    expect(p.unidade).toBe(50);
    p.alterarUnidade(500);
    expect(p.unidade).toBe(100);
    expect(eventosDe(log, 'unidade').at(-1)).toEqual({ valor: 100, delta: 50 });
    p.receberArmadura('calcado');
    p.alterarUnidade(-10);
    expect(p.unidade).toBe(95);
    p.alterarUnidade(-1000);
    expect(p.unidade).toBe(0);
  });

  it('guarda memórias uma vez; segredos contam por era; a fé do ativo cresce', () => {
    const { p, log, fichas, avisos } = montar();
    const fe = fichas.noe.progresso.fe ?? 0;
    expect(p.memoria('graca')).toBe(true);
    expect(p.memoria('graca')).toBe(false);
    expect(fichas.noe.progresso.fe ?? 0).toBeGreaterThan(fe);
    expect(avisos.some(([t, tipo]) => t === 'Memória guardada: Achou graça' && tipo === 'memoria')).toBe(true);
    p.memoria('enoque');
    p.memoria('poDaTerra');
    expect(p.segredos).toEqual(['enoque', 'poDaTerra']);
    expect(p.segredosDaEra('noe')).toBe(1);
    expect(eventosDe(log, 'memoria')).toEqual([{ id: 'graca' }, { id: 'enoque' }, { id: 'poDaTerra' }]);
  });

  it('armadura e versículos recebidos sem repetição', () => {
    const { p, log } = montar();
    expect(p.receberArmadura('espada')).toBe(true);
    expect(p.receberArmadura('espada')).toBe(false);
    expect(p.temArmadura('espada')).toBe(true);
    expect(p.receberVersiculo('Gn 6:18')).toBe(true);
    expect(p.receberVersiculo('Gn 6:18')).toBe(false);
    expect(p.versiculos).toEqual(['Gn 6:18']);
    expect(eventosDe(log, 'armadura')).toEqual([{ peca: 'espada' }]);
    expect(eventosDe(log, 'versiculo')).toEqual([{ ref: 'Gn 6:18' }]);
  });

  it('meditar: Sabedoria cresce, capítulo lido conta e rende XP de disciplina com intervalo', () => {
    const { p, log, fichas } = montar();
    p.meditar(30, { livro: 'Gn', capitulo: 6 });
    expect(p.lidos).toEqual([]);
    p.meditar(40, { livro: 'Gn', capitulo: 6 });
    expect(p.lidos).toEqual(['Gn 6']);
    expect(eventosDe(log, 'xp')).toEqual([{ personagem: 'noe', qtd: XP.disciplina, fonte: 'disciplina' }]);
    expect(fichas.noe.progresso.sabedoria ?? 0).toBeGreaterThan(0);
    p.meditar(70, { livro: 'Gn', capitulo: 7 });
    expect(p.lidos).toEqual(['Gn 6', 'Gn 7']);
    expect(eventosDe(log, 'xp')).toHaveLength(1); // ainda no intervalo
    p.atualizar(301);
    p.meditar(70, { livro: 'Gn', capitulo: 8 });
    expect(eventosDe(log, 'xp')).toHaveLength(2);
    expect(p.serializar().lidos).toEqual(['Gn 6', 'Gn 7', 'Gn 8']);
  });

  it('serializa e restaura (sem eventos)', () => {
    const { p, log } = montar();
    p.memoria('graca');
    p.receberArmadura('capacete');
    p.receberVersiculo('Gn 6:22');
    p.alterarUnidade(15);
    p.atualizar(12.5);
    p.contar('escolhas', 2);
    const d = p.serializar();
    const { p: outro, log: log2 } = montar();
    outro.restaurar(JSON.parse(JSON.stringify(d)));
    expect(outro.serializar()).toEqual(d);
    expect(log2).toHaveLength(0);
    expect(d.tempoJogado).toBe(12.5);
    expect(log.length).toBeGreaterThan(0);
    outro.reiniciar();
    expect(outro.unidade).toBe(UNIDADE_INICIAL);
    expect(outro.memorias).toEqual([]);
  });
});
