// Testes do conteúdo da era de Noé: textos bíblicos, ids, encadeamento das missões e cada
// missão jogada do início ao fim com um CtxMissao falso (que resolve interações, chegadas e
// provas na hora) e, depois, a era inteira guiada só pelos atalhos de depuração.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import biblia from '../src/data/biblia/versiculos.json';
import srcMissoes from '../src/eras/noe/missoes.ts?raw';
import srcMemorias from '../src/eras/noe/memorias.ts?raw';
import srcCristo from '../src/eras/noe/cristo.ts?raw';
import srcPersonagens from '../src/eras/noe/personagens.ts?raw';
import { Interativos, type Interativo } from '../src/jogo/Interacoes';
import { temVerbo, type Verbo } from '../src/jogo/Classes';
import { ORDEM_ATRIBUTOS } from '../src/jogo/Atributos';
import type {
  Alvo, CtxMissao, DefMissao, DefProva, EstadoMissao, Linha, LinhaBiblica, OpcaoEscolha, PecaArmadura, ResultadoProva,
} from '../src/jogo/contratos';
import { ehBiblica } from '../src/jogo/contratos';
import type { DefPersonagem, Personagem } from '../src/jogo/Personagem';
import type { Mundo } from '../src/mundo/Mundo';
import { MAPA_NOE } from '../src/eras/noe/mapa';
import {
  ERA_NOE, MISSOES_NOE, MEMORIAS_NOE, CRISTO_NOE, SEGREDOS_NOE, JOGAVEIS_NOE, NPCS_NOE, INICIO_NOE,
  PROVA_TENTACAO_A3, PROVA_MEDO_A5, ZOMBARIAS_A3, CONVERSAS_RECOMECO, PARES_A4, ESPECIE_PERDIDA, esperarAcalmarGrupo, idAcalmar,
  PONTOS_RESERVA, idsInterativosNoe, pontosUsadosNoe, ligarServicosNoe, registrarSegredosNoe, reconstruirMundoNoe,
  jogarEraNoe, type AnimalNoe, type ServicosNoe, type NomePontoArca, type AmbienteAtalhosNoe,
} from '../src/eras/noe';

// ------------------------------------------------------------------------------ Bíblia

const VERS = (biblia as unknown as { versiculos: Record<string, { bkj: string }> }).versiculos;
const REF_RE = /^(\S+) (\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;

function textoRef(ref: string): string | null {
  const m = REF_RE.exec(ref);
  if (!m) return null;
  const ini = Number(m[3]);
  const fim = m[4] ? Number(m[4]) : ini;
  const partes: string[] = [];
  for (let v = ini; v <= fim; v++) {
    const t = VERS[`${m[1]} ${m[2]}:${v}`];
    if (!t) return null;
    partes.push(t.bkj);
  }
  return partes.join(' ');
}

function conferirRef(ref: string, trecho?: string): string | null {
  const t = textoRef(ref);
  if (t === null) return `referência inexistente: ${ref}`;
  if (trecho !== undefined && !t.includes(trecho)) return `trecho não é substring de ${ref}: "${trecho}"`;
  return null;
}

// ------------------------------------------------------------------------------ mundo falso

const POS_ARCA: Record<string, [number, number, number]> = {
  porta: [20, 0.6, 9.5], saida: [20, 0, 15], conves1: [0, 0.6, 0], conves2: [0, 4.9, 0], conves3: [0, 9.2, 0],
  rampa12: [30, 0.6, 0], rampa23: [-30, 4.9, 0], bomba: [10, 0.6, -4],
  vazamento1: [-40, 0.6, 9], vazamento2: [-10, 0.6, -9], vazamento3: [25, 0.6, 9], vazamento4: [45, 0.6, -9],
  baia1: [-20, 4.9, 6], baia2: [0, 4.9, 6], baia3: [20, 4.9, 6], baia1Animal: [-20, 4.9, 8], baia2Animal: [0, 4.9, 8], baia3Animal: [20, 4.9, 8], corredor2: [0, 4.9, 0], escadaRedes: [5, 4.9, -3],
  rede1: [-15, 8, -3], rede2: [15, 8, -3], familia: [0, 9.2, 0], familia1: [2, 9.2, 2], familia2: [-2, 9.2, 2],
  familia3: [2, 9.2, -2], familia4: [-2, 9.2, -2], escadaJanela: [0, 9.2, 4], janela: [0, 12.4, 4.5], pombaPouso: [0, 13, 6],
};

class PessoaFalsa {
  readonly posicao = new THREE.Vector3();
  yaw = 0;
  carregando: string | null = null;
  posto: { id: string; clipe: string; yaw: number; descricao: string } | null = null;
  aprendidos: Verbo[] = [];
  controlado = false;
  escalada = null;
  modVelocidade = 1;
  disponivel = true;
  humano = { animador: { atividade: null as string | null } };
  ia = { esperar() {}, voltarARotina() {}, seguir() {}, irPara: async () => {} };
  constructor(readonly def: DefPersonagem) {
    this.aprendidos = [...(def.aprendidos ?? [])];
  }
  get id() {
    return this.def.id;
  }
  pode(v: Verbo) {
    return !!this.def.classe && temVerbo(this.def.classe, v, this.aprendidos);
  }
  teleportar(x: number, y: number, z: number, yaw?: number) {
    this.posicao.set(x, y, z);
    if (yaw !== undefined) this.yaw = yaw;
  }
  carregar(item: string | null) {
    this.carregando = item;
  }
  entrarPosto(id: string, clipe: string, yaw: number, descricao: string) {
    this.posto = { id, clipe, yaw, descricao };
  }
  sairPosto() {
    this.posto = null;
  }
  sairEscalada() {}
}

class AnimalFalso implements AnimalNoe {
  readonly posicao = new THREE.Vector3();
  vivo = true;
  agitado = false;
  constructor(readonly especie: string, x: number, z: number, private vivos: Set<AnimalFalso>) {
    this.posicao.set(x, 0, z);
    vivos.add(this);
  }
  vagar() {}
  seguir() {}
  agitar() {
    this.agitado = true;
  }
  acalmar() {
    this.agitado = false;
  }
  fugas = 0;
  fugirDe(de: THREE.Vector3) {
    // corre uns metros para longe e continua como estava (agitado continua agitado)
    this.fugas++;
    const d = this.posicao.clone().sub(de).setY(0);
    if (d.lengthSq() < 1e-6) d.set(1, 0, 0);
    this.posicao.add(d.normalize().multiplyScalar(6));
  }
  async irPara(x: number, z: number) {
    this.posicao.set(x, this.posicao.y, z);
  }
  async voarPara(x: number, y: number, z: number) {
    this.posicao.set(x, y, z);
  }
  async entrar() {
    await this.remover();
  }
  async remover() {
    this.vivo = false;
    this.vivos.delete(this);
  }
}

interface Registro {
  linhas: Linha[];
  versiculos: string[];
  recebidos: string[];
  memorias: string[];
  armadura: PecaArmadura[];
  provas: DefProva[];
  cristo: string[];
  alvos: Alvo[];
  dicas: string[];
  transicoes: string[][];
}

function novoRegistro(): Registro {
  return { linhas: [], versiculos: [], recebidos: [], memorias: [], armadura: [], provas: [], cristo: [], alvos: [], dicas: [], transicoes: [] };
}

/** O vale falso inteiro: mundo, personagens, serviços e barramento. */
class ValeFalso {
  readonly interativos = new Interativos();
  readonly pontos = new Map<string, [number, number]>([...Object.entries(PONTOS_RESERVA), ...Object.entries(MAPA_NOE.pontos)]);
  readonly escaladas = new Map();
  readonly personagens = new Map<string, PessoaFalsa>();
  readonly mundo = {
    interativos: this.interativos, pontos: this.pontos, escaladas: this.escaladas, personagens: this.personagens,
    chao: () => 0,
  } as unknown as Mundo;
  readonly flags: Record<string, unknown> = {};
  readonly reg = novoRegistro();
  readonly memorias = new Set<string>();
  readonly animais = new Set<AnimalFalso>();
  ouvintes: Ouvinte[] = [];
  ativoId = 'noe';
  estado = { arca: 0, vale: 'antes', agua: 0.4, interior: false, altar: [0, false] as [number, boolean], viga: 0 };
  readonly arca = {
    estagio: 0,
    grupo: { position: new THREE.Vector3(-15, 2.6, 5) },
    definirEstagio: (e: number) => {
      this.arca.estagio = e;
    },
    definirPorta() {},
    definirJanela() {},
  };
  readonly servicos: ServicosNoe;

  constructor() {
    for (const d of [...JOGAVEIS_NOE, ...NPCS_NOE]) {
      const p = new PessoaFalsa(d);
      const [x, z] = this.pontos.get(INICIO_NOE[d.id]?.lugar ?? 'casa') ?? [0, 0];
      p.teleportar(x, 0, z);
      this.personagens.set(d.id, p);
    }
    this.personagens.get('noe')!.controlado = true;
    const vale = this;
    this.servicos = {
      vale: {
        arca: this.arca,
        vigaMestra: { get altura() { return vale.estado.viga; }, definirAltura: (t: number) => (this.estado.viga = t) },
        definirEstado: (e) => (this.estado.vale = e),
        animarAgua: async (n) => {
          this.estado.agua = n;
        },
        definirInterior: (a) => (this.estado.interior = a),
        pontoArca: (nome: NomePontoArca) => {
          const l = POS_ARCA[nome];
          if (!l) throw new Error(`ponto da arca desconhecido: ${nome}`);
          return new THREE.Vector3(...l).add(this.arca.grupo.position);
        },
        moverArca: (x, y, z) => this.arca.grupo.position.set(x, y, z),
        repousarArca: () => this.arca.grupo.position.set(-30, 38, -181),
        definirAguaInterna: () => {},
        definirVazamento: () => {},
        definirCaixasSoltas: () => {},
        definirAltar: (p, f) => (this.estado.altar = [p, f]),
        cortarArvore: () => {},
      },
      ceu: { hora: 9, tempestade: 0, arco: 0, gloria: 0, pausado: false },
      audio: { ambiente() {}, musica() {}, efeito() {} },
      animais: { criar: async (e, x, z) => new AnimalFalso(e, x, z, this.animais) },
      progresso: {
        temMemoria: (id) => this.memorias.has(id),
        memoria: (id) => {
          if (this.memorias.has(id)) return false;
          this.memorias.add(id);
          this.reg.memorias.push(id);
          return true;
        },
        ganharXP: () => 0,
      },
      camera: { tremer() {}, balanco() {} },
      cristo: (id) => this.reg.cristo.push(id),
      controlar: (id) => {
        for (const p of this.personagens.values()) p.controlado = p.id === id;
        this.ativoId = id;
      },
      liberarPosto: (idPosto) => {
        for (const p of this.personagens.values()) if (p.posto?.id === idPosto) p.sairPosto();
      },
      removerPersonagem: (id) => {
        this.personagens.delete(id);
      },
      transicaoEra: async (g) => {
        this.reg.transicoes.push(g);
      },
    };
  }

  pessoa(id: string) {
    const p = this.personagens.get(id);
    if (!p) throw new Error(`personagem ausente: ${id}`);
    return p as unknown as Personagem;
  }

  emitir(nome: string, dados: unknown) {
    const atendidos = this.ouvintes.filter((o) => o.nome === nome && (!o.filtro || o.filtro(dados)));
    this.ouvintes = this.ouvintes.filter((o) => !atendidos.includes(o));
    for (const o of atendidos) o.res(dados);
  }

  /** Imita o Controle: entra no posto, chama aoInteragir e emite 'interacao'. */
  async usar(i: Interativo, p: PessoaFalsa) {
    if (i.posto) p.entrarPosto(i.id, i.posto.clipe ?? 'segurar', 0, i.posto.descricao);
    await i.aoInteragir(p as unknown as Personagem);
    this.emitir('interacao', { id: i.id, personagem: p });
  }

  /** Quem pode usar o interativo agora (Noé primeiro; quem carrega algo, se o interativo não exige nada). */
  candidatos(i: Interativo): PessoaFalsa[] {
    if (!Interativos.ativo(i)) return [];
    if (i.posto && [...this.personagens.values()].some((p) => p.posto?.id === i.id)) return [];
    const ordem = ['noe', 'cam', 'sem', 'jafe'];
    const lista = [...this.personagens.values()].filter((p) => {
      if (!p.pode(i.verbo)) return false;
      if (i.carregando === null && p.carregando) return false;
      if (typeof i.carregando === 'string' && p.carregando !== i.carregando) return false;
      if (p.posto) return false;
      return true;
    });
    const rank = (id: string) => (ordem.includes(id) ? ordem.indexOf(id) : 99);
    lista.sort((a, b) => rank(a.id) - rank(b.id));
    if (i.carregando === undefined) lista.sort((a, b) => Number(!!b.carregando) - Number(!!a.carregando));
    return lista;
  }
}

// o ambiente de teste é o Node (sem @types/node)
declare const setImmediate: (f: () => void) => unknown;

const abortado = () => Object.assign(new Error('abortado'), { name: 'AbortError' });
const imediato = () => new Promise<void>((r) => setImmediate(r));

/**
 * CtxMissao falso. No modo 'auto', resolve na hora: as interações esperadas são usadas por
 * quem pode, as chegadas teleportam, as provas são vencidas e, a cada espera de tempo, um
 * interativo ativo é usado (como um jogador que age enquanto o tempo passa).
 * No modo 'eventos', nada se resolve sozinho: só os atalhos fazem a história andar.
 */
class CtxFalso implements CtxMissao {
  readonly sinal: AbortSignal;
  readonly controle = new AbortController();
  passos = 0;
  acoes = 0;
  provaAtual: { def: DefProva; res: (r: ResultadoProva) => void } | null = null;
  limiteAcoes = Infinity;

  constructor(readonly v: ValeFalso, readonly missao: DefMissao, readonly estado: EstadoMissao, readonly modo: 'auto' | 'eventos') {
    this.sinal = this.controle.signal;
    this.sinal.addEventListener('abort', () => {
      const pend = v.ouvintes.filter((o) => o.ctx === this);
      v.ouvintes = v.ouvintes.filter((o) => o.ctx !== this);
      for (const o of pend) o.rej(abortado());
    });
  }
  get mundo() {
    return this.v.mundo;
  }
  get flags() {
    return this.v.flags;
  }
  personagem(id: string) {
    return this.v.pessoa(id);
  }
  ativo() {
    return this.v.pessoa(this.v.ativoId);
  }
  private checar() {
    if (this.sinal.aborted) throw abortado();
    if (++this.passos > 200_000) throw new Error(`laço sem fim em ${this.missao.id} (etapa ${this.estado.etapa})`);
  }
  objetivo(_t: string, alvos?: Alvo[]) {
    if (alvos) this.v.reg.alvos.push(...alvos);
  }
  contador(nome: string, valor?: number) {
    if (valor !== undefined) this.estado.contadores[nome] = valor;
    return this.estado.contadores[nome] ?? 0;
  }
  async esperar(_s: number) {
    this.checar();
    await imediato();
    this.checar();
    if (this.modo === 'auto') await this.jogarAlgo(null);
  }
  async esperarFlag(nome: string) {
    while (!this.v.flags[nome]) await this.esperar(0.1);
  }
  esperarEvento<T>(nome: string, filtro?: (d: T) => boolean): Promise<T> {
    this.checar();
    return new Promise<T>((res, rej) => {
      const o = { nome, filtro: filtro as (d: unknown) => boolean, res: res as (d: unknown) => void, rej, ctx: this };
      this.v.ouvintes.push(o);
      if (this.modo === 'auto' && nome === 'interacao') void this.atender(o);
    });
  }
  /** Modo auto: tenta usar um interativo que satisfaça o ouvinte até conseguir (ou abortar). */
  private async atender(o: Ouvinte) {
    for (let n = 0; n < 50_000; n++) {
      await imediato();
      if (this.sinal.aborted || !this.v.ouvintes.includes(o)) return;
      if (await this.jogarAlgo(o)) return;
    }
  }
  /** Usa um interativo ativo (que o ouvinte aceite, se houver). Devolve se usou. */
  private async jogarAlgo(o: Ouvinte | null): Promise<boolean> {
    if (this.acoes >= this.limiteAcoes) {
      this.controle.abort();
      return false;
    }
    for (const i of [...this.v.interativos.todos()]) {
      for (const p of this.v.candidatos(i)) {
        if (o && o.filtro && !o.filtro({ id: i.id, personagem: p })) continue;
        this.acoes++;
        await this.v.usar(i, p);
        return true;
      }
    }
    return false;
  }
  async chegar(quem: string, alvo: Alvo, raio = 3) {
    this.checar();
    const p = quem === 'ativo' ? this.v.personagens.get(this.v.ativoId)! : this.v.personagens.get(quem)!;
    const v = this.resolver(alvo);
    if (this.modo === 'auto') {
      p.teleportar(v.x, v.y, v.z);
      return;
    }
    while (p.posicao.distanceTo(this.resolver(alvo)) > raio + 1.5) await this.esperar(0.1);
  }
  resolver(alvo: Alvo): THREE.Vector3 {
    if (typeof alvo === 'string') {
      const pt = this.v.pontos.get(alvo);
      if (pt) return new THREE.Vector3(pt[0], 0, pt[1]);
      const i = this.v.interativos.obter(alvo);
      if (i) return i.pos.clone();
      throw new Error(`alvo desconhecido: ${alvo}`);
    }
    if (Array.isArray(alvo)) return new THREE.Vector3(alvo[0], 0, alvo[1]);
    if ('personagem' in alvo) return this.v.personagens.get(alvo.personagem)!.posicao.clone();
    return new THREE.Vector3(alvo.x, alvo.y, alvo.z);
  }
  async interacao(id: string) {
    const d = await this.esperarEvento<{ id: string; personagem: Personagem }>('interacao', (x) => x.id === id);
    return d.personagem;
  }
  async dialogo(linhas: Linha[]) {
    this.checar();
    this.v.reg.linhas.push(...linhas);
  }
  async escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[]) {
    if (pergunta) this.v.reg.linhas.push(pergunta);
    for (const o of opcoes) this.v.reg.linhas.push(...(o.resposta ?? []));
    return 0;
  }
  versiculo(ref: string) {
    this.v.reg.versiculos.push(ref);
    this.receberVersiculo(ref);
  }
  dica(t: string) {
    this.v.reg.dicas.push(t);
  }
  aviso() {}
  async cena<T>(fn: () => Promise<T>) {
    return fn();
  }
  async camera() {}
  async cameraVoltar() {}
  async mover(quem: string, alvo: Alvo) {
    const v = this.resolver(alvo);
    this.v.personagens.get(quem)?.teleportar(v.x, v.y, v.z);
  }
  async animar() {}
  async fade() {}
  async titulo() {}
  xp() {}
  treinar(id: string) {
    expect(this.v.personagens.get(id)?.def.jogavel, `treinar um não jogável: ${id}`).toBe(true);
  }
  memoria(id: string) {
    expect(MEMORIAS_NOE.some((m) => m.id === id), `memória desconhecida ${id}`).toBe(true);
    this.v.servicos.progresso.memoria(id);
  }
  armadura(peca: PecaArmadura) {
    this.v.reg.armadura.push(peca);
  }
  unidade() {}
  receberVersiculo(ref: string) {
    if (!this.v.reg.recebidos.includes(ref)) this.v.reg.recebidos.push(ref);
  }
  definirFlag(nome: string, valor: unknown = true) {
    this.v.flags[nome] = valor;
  }
  disponivel() {}
  prova(def: DefProva): Promise<ResultadoProva> {
    this.checar();
    this.v.reg.provas.push(def);
    for (const r of def.respostas ?? []) expect(this.v.reg.recebidos, `resposta ${r} não recebida antes da prova ${def.id}`).toContain(r);
    if (this.modo === 'auto') return Promise.resolve({ venceu: true, tentativas: 1, tempo: 0 });
    return new Promise((res) => (this.provaAtual = { def, res }));
  }
}
type Ouvinte = { nome: string; filtro?: (d: unknown) => boolean; res: (d: unknown) => void; rej: (e: unknown) => void; ctx?: CtxFalso };

function novoEstado(id: string): EstadoMissao {
  return { id, etapa: 0, status: 'ativa', contadores: {} };
}

async function jogarMissao(v: ValeFalso, m: DefMissao, modo: 'auto' | 'eventos' = 'auto', estado = novoEstado(m.id), aoCtx?: (c: CtxFalso) => void) {
  for (let i = estado.etapa; i < m.etapas.length; i++) {
    estado.etapa = i;
    const c = new CtxFalso(v, m, estado, modo);
    aoCtx?.(c);
    try {
      await m.etapas[i].executar(c);
    } finally {
      c.controle.abort();
    }
    expect(idsDaEtapaRestantes(v), `interativos esquecidos depois de ${m.id}.${m.etapas[i].id}`).toEqual([]);
  }
  estado.status = 'concluida';
}

const SEGREDOS_IDS = new Set(['segredoLameque', 'segredoEnoque', 'segredoEstacoes']);
function idsDaEtapaRestantes(v: ValeFalso) {
  return [...v.interativos.todos()].map((i) => i.id).filter((id) => !SEGREDOS_IDS.has(id));
}

let valeAtual: ValeFalso;
beforeEach(() => {
  valeAtual = new ValeFalso();
  ligarServicosNoe(valeAtual.servicos);
});
afterEach(() => ligarServicosNoe(null));

// ------------------------------------------------------------------------------ testes

describe('era de Noé — dados', () => {
  it('missões encadeadas: ids únicos, toda `proxima` existe, a inicial existe', () => {
    const ids = MISSOES_NOE.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MISSOES_NOE) {
      if (m.proxima) expect(ids, `${m.id}.proxima`).toContain(m.proxima);
      expect(m.era).toBe('noe');
      expect(m.etapas.length).toBeGreaterThan(0);
      const etapas = m.etapas.map((e) => e.id);
      expect(new Set(etapas).size, `etapas repetidas em ${m.id}`).toBe(etapas.length);
    }
    expect(ids).toContain(ERA_NOE.missaoInicial);
    expect(ids).toEqual(['prologo', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('ids de interativos únicos na era (e diferentes das escaladas do motor)', () => {
    const ids = idsInterativosNoe();
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos).toEqual([]);
    for (const e of ['andaime', 'arvoreFruta1', 'arvoreFruta2', 'escadaRedes', 'escadaJanela']) expect(ids).not.toContain(e);
    // os do ROTEIRO
    for (const id of ['orarMonte', 'pilhaBosque', 'entregaTroncos', 'arvoreGofer1', 'quilha', 'guincho', 'ancoraCorda', 'encaixeViga1', 'encaixeViga2',
      'caldeirao', 'betumarCasco3', 'pregarPraca', 'pregarMercado', 'pregarTorre', 'saco4', 'fruta2', 'entregaArca', 'gruta', 'segredoEnoque',
      'segredoLameque', 'bomba', 'vazamento4', 'baia3', 'rede2', 'janela', 'soltarCorvo', 'soltarPomba', 'receberPomba', 'pedraAltar6', 'altarPlato',
      'segredoEstacoes', 'falarSem', 'encorajar_sem', 'acalmar_camelo']) expect(ids).toContain(id);
  });

  it('memórias conforme o ROTEIRO (arcoIris força 3, segredos marcados)', () => {
    const porId = Object.fromEntries(MEMORIAS_NOE.map((m) => [m.id, m]));
    expect(Object.keys(porId).sort()).toEqual(['arcoIris', 'deusLembrou', 'enoque', 'estacoes', 'folhaOliveira', 'graca', 'lameque', 'pacto', 'portaFechada', 'pregador'].sort());
    expect(porId.arcoIris.forca).toBe(3);
    expect(porId.arcoIris.frase).toBeTruthy();
    expect(porId.pacto.forca).toBe(2);
    expect(SEGREDOS_NOE.sort()).toEqual(['enoque', 'estacoes', 'lameque']);
    for (const m of MEMORIAS_NOE) expect(m.era).toBe('noe');
  });

  it('fichas dos jogáveis conforme o ROTEIRO', () => {
    const f = (id: string) => ORDEM_ATRIBUTOS.map((a) => JOGAVEIS_NOE.find((d) => d.id === id)!.atributos![a]);
    expect(f('noe')).toEqual([4, 5, 2, 7, 8, 7, 7, 6, 6, 8, 6, 5]);
    expect(f('sem')).toEqual([4, 5, 4, 6, 6, 5, 5, 7, 5, 5, 5, 4]);
    expect(f('cam')).toEqual([7, 6, 4, 3, 3, 3, 3, 4, 3, 5, 3, 6]);
    expect(f('jafe')).toEqual([4, 5, 7, 4, 4, 4, 4, 5, 4, 4, 5, 6]);
    expect(JOGAVEIS_NOE.map((d) => d.classe)).toEqual(expect.arrayContaining(['construtor', 'sacerdote', 'guerreiro', 'batedor']));
    // as mulheres não têm nome inventado
    for (const d of NPCS_NOE.filter((x) => x.id.startsWith('mulher'))) expect(d.nome).toMatch(/^Mulher de /);
    for (const d of [...JOGAVEIS_NOE, ...NPCS_NOE]) expect(INICIO_NOE[d.id], `início de ${d.id}`).toBeTruthy();
  });

  it('referências estáticas existem e trechos são substrings exatos da BKJ', () => {
    const erros: string[] = [];
    const ver = (ref: string, trecho?: string) => {
      const e = conferirRef(ref, trecho);
      if (e) erros.push(e);
    };
    for (const m of MISSOES_NOE) m.refs.forEach((r) => ver(r));
    for (const m of MEMORIAS_NOE) ver(m.ref);
    for (const c of CRISTO_NOE) c.refs.forEach((r) => ver(r));
    for (const d of [...JOGAVEIS_NOE, ...NPCS_NOE]) if (d.ref) ver(d.ref);
    for (const r of PROVA_TENTACAO_A3.respostas ?? []) ver(r);
    // varre o código-fonte das missões: deus('..', '..'), narrador(..), versiculo(..), receberVersiculo(..)
    for (const src of [srcMissoes, srcMemorias, srcCristo, srcPersonagens]) {
      expect(src.length).toBeGreaterThan(500);
      for (const m of src.matchAll(/(?:deus|narrador)\(\s*'([^']+)'(?:,\s*'([^']*)')?\s*\)/g)) ver(m[1], m[2]);
      for (const m of src.matchAll(/(?:versiculo|receberVersiculo)\(\s*'([^']+)'\s*\)/g)) ver(m[1]);
      for (const m of src.matchAll(/'((?:[1-3])?[A-ZÊÓ][a-zó]{0,2} \d{1,3}:\d{1,3}(?:-\d{1,3})?)'/g)) ver(m[1]);
    }
    expect(erros).toEqual([]);
  });

  it('falas de ficção são curtas e marcadas como ficção (sem ref)', () => {
    for (const linhas of Object.values(CONVERSAS_RECOMECO)) for (const l of linhas) {
      expect(ehBiblica(l)).toBe(false);
      expect((l as { texto: string }).texto.length).toBeLessThan(120);
    }
    for (const z of [...ZOMBARIAS_A3, ...PROVA_TENTACAO_A3.mentiras, ...PROVA_MEDO_A5.mentiras]) expect(z.length).toBeLessThan(80);
  });

  it('pontos usados: todos conhecidos (no mapa do motor ou na reserva)', () => {
    const faltam = pontosUsadosNoe().filter((n) => !MAPA_NOE.pontos[n]);
    // os que faltam no mapa usam a posição de reserva; listados para o relatório
    if (faltam.length) console.info(`[era-noe] pontos ainda fora de MAPA_NOE.pontos: ${faltam.join(', ')}`);
    for (const n of pontosUsadosNoe()) expect(PONTOS_RESERVA[n] ?? MAPA_NOE.pontos[n], n).toBeTruthy();
  });
});

describe('era de Noé — missões jogadas com CtxMissao falso', () => {
  for (const m of MISSOES_NOE) {
    it(`${m.id} roda do início ao fim (mundo novo)`, async () => {
      await jogarMissao(valeAtual, m);
    });
  }

  it('a era inteira em sequência: memórias, armadura, Cristo, textos e estado final', async () => {
    const v = valeAtual;
    registrarSegredosNoe(v.mundo as never, v.servicos, v.flags);
    for (const m of MISSOES_NOE) await jogarMissao(v, m);
    const r = v.reg;
    // memórias da história (os segredos o jogador de teste também acha, pois usa tudo o que vê)
    for (const id of ['graca', 'pacto', 'pregador', 'portaFechada', 'deusLembrou', 'folhaOliveira', 'arcoIris']) expect(r.memorias).toContain(id);
    expect(r.armadura).toEqual(['espada', 'capacete']);
    expect(r.cristo).toEqual(['semente', 'arca', 'tempestade', 'linhagem']);
    expect(r.transicoes).toEqual([ERA_NOE.genealogia]);
    expect(r.provas.map((p) => p.tipo)).toEqual(['ira', 'ira', 'ira', 'tentacao', 'medo']);
    expect(v.flags.a3PrimeiraTentativa).toBe(true);
    expect(v.flags.valeEstado).toBe('depois');
    expect(v.flags.arcaNoPlato).toBe(true);
    expect(v.arca.grupo.position.y).toBe(38);
    expect(v.personagens.get('noe')!.aprendidos).toContain('construirAltar');
    expect([...v.personagens.keys()].some((id) => id.startsWith('zombador'))).toBe(false);
    expect(v.estado.altar).toEqual([6, true]);
    // nenhum animal de cena esquecido (os da procissão ficam no vale)
    expect([...v.animais].map((a) => a.especie).sort()).toEqual(['boi', 'cabra', 'camelo', 'cavalo', 'cervo', 'jumento', 'leao', 'ovelha']);
    // todas as falas bíblicas conferem
    const erros = r.linhas.filter(ehBiblica).map((l: LinhaBiblica) => conferirRef(l.ref, l.trecho)).filter(Boolean);
    expect(erros).toEqual([]);
    for (const ref of [...r.versiculos, ...r.recebidos]) expect(conferirRef(ref), ref).toBeNull();
    // Deus nunca é figura: só fala por referência bíblica (nada de ficção na boca de Deus)
    for (const l of r.linhas) if (l.quem === 'deus') expect(ehBiblica(l)).toBe(true);
    // alvos de objetivo resolvíveis
    for (const a of r.alvos) if (typeof a === 'string') expect(v.pontos.has(a) || idsInterativosNoe().includes(a), `alvo ${a}`).toBe(true);
  });

  it('etapas são idempotentes: abortar no meio e recomeçar a etapa termina a missão', async () => {
    const v = valeAtual;
    for (const m of MISSOES_NOE) {
      const estado = novoEstado(m.id);
      for (let i = 0; i < m.etapas.length; i++) {
        estado.etapa = i;
        // 1ª tentativa: abortada depois de duas ações do "jogador"
        const c1 = new CtxFalso(v, m, estado, 'auto');
        c1.limiteAcoes = 2;
        await m.etapas[i].executar(c1).catch((e) => {
          if ((e as Error).name !== 'AbortError') throw e;
        });
        c1.controle.abort();
        expect(idsDaEtapaRestantes(v), `interativos esquecidos ao abortar ${m.id}.${m.etapas[i].id}`).toEqual([]);
        // como depois de carregar um save: o mundo reconstruído pelas flags e a etapa do início
        reconstruirMundoNoe(v.servicos, v.mundo as never, v.flags);
        const c2 = new CtxFalso(v, m, estado, 'auto');
        await m.etapas[i].executar(c2);
        c2.controle.abort();
      }
    }
    expect(v.flags.valeEstado).toBe('depois');
  });
});

describe('era de Noé — ajustes da revisão (docs/tecnico/revisao.md §8)', () => {
  const missao = (id: string) => MISSOES_NOE.find((m) => m.id === id)!;

  it('Gn 7:2: os animais limpos de A4 (e os cervos da gruta) chegam de sete em sete; os outros, de dois em dois', async () => {
    const v = valeAtual;
    const criados = new Map<string, number>();
    const criar = v.servicos.animais.criar;
    v.servicos.animais.criar = (e, x, z, o) => {
      criados.set(e, (criados.get(e) ?? 0) + 1);
      return criar(e, x, z, o);
    };
    await jogarMissao(v, missao('a4'));
    for (const par of PARES_A4) expect(criados.get(par.especie), par.especie).toBe(['ovelha', 'cabra', 'boi'].includes(par.especie) ? 7 : 2);
    expect(PARES_A4.filter((p) => p.limpo).map((p) => p.especie).sort()).toEqual(['boi', 'cabra', 'ovelha']);
    expect(criados.get(ESPECIE_PERDIDA)).toBe(7);
    expect(v.reg.versiculos).toContain('Gn 7:2');
    expect(v.animais.size).toBe(0);
  });

  it('Gn 8:6: Jafé só solta as amarras; quem abre a janela é Noé, ao soltar o corvo', async () => {
    const v = valeAtual;
    const usos: string[] = [];
    const usar = v.usar.bind(v);
    v.usar = async (i, p) => {
      usos.push(`${i.id}:${p.id}`);
      await usar(i, p);
    };
    let abriuDepoisDe = '';
    v.arca.definirJanela = (aberta?: boolean) => {
      if (aberta) abriuDepoisDe = usos[usos.length - 1];
    };
    await jogarMissao(v, missao('a5'));
    expect(usos).toContain('janela:jafe');
    expect(abriuDepoisDe).toBe('soltarCorvo:noe');
    expect(v.flags.a5Amarras).toBe(true);
    expect(v.flags.janelaAberta).toBe(true);
    const i86 = v.reg.linhas.findIndex((l) => ehBiblica(l) && l.ref === 'Gn 8:6');
    const i87 = v.reg.linhas.findIndex((l) => ehBiblica(l) && l.ref === 'Gn 8:7');
    expect(i86).toBeGreaterThanOrEqual(0);
    expect(i87).toBeGreaterThan(i86);
  });

  it('Ensinamento 9: o segredo das estações só se abre depois do altar (a6Altar)', () => {
    const v = valeAtual;
    registrarSegredosNoe(v.mundo as never, v.servicos, v.flags);
    const ativo = () => Interativos.ativo(v.interativos.obter('segredoEstacoes')!);
    expect(ativo()).toBe(false);
    v.flags.valeEstado = 'depois';
    expect(ativo()).toBe(false);
    v.flags.a6Altar = true;
    expect(ativo()).toBe(true);
  });

  it('Ensinamento 6: forçados por quem não sabe acalmar, os agitados fogem e continuam agitados até Sem', async () => {
    const v = valeAtual;
    const a4 = missao('a4');
    const c = new CtxFalso(v, a4, novoEstado('a4'), 'eventos');
    const macho = new AnimalFalso('camelo', 5, 39, v.animais);
    const femea = new AnimalFalso('camelo', 6, 40, v.animais);
    macho.agitar();
    femea.agitar();
    // Cam (que não sabe acalmar) chega perto do par
    v.servicos.controlar('cam');
    v.personagens.get('cam')!.teleportar(5.5, 0, 38.5);
    let quem: Personagem | null = null;
    const espera = esperarAcalmarGrupo(c, 'camelo', [macho, femea]).then((p) => (quem = p));
    for (let i = 0; i < 5; i++) await imediato();
    expect(macho.fugas).toBeGreaterThan(0);
    expect(femea.fugas).toBeGreaterThan(0);
    expect(macho.agitado && femea.agitado).toBe(true);
    expect(v.reg.dicas.some((d) => d.includes('fogem'))).toBe(true);
    expect(quem).toBeNull();
    // Cam não acalma; Sem sim (o interativo acompanha o animal)
    const i = v.interativos.obter(idAcalmar('camelo'))!;
    expect(i.pos.distanceTo(macho.posicao)).toBe(0);
    expect(v.candidatos(i).map((p) => p.id)).toEqual(['sem']);
    await v.usar(i, v.personagens.get('sem')!);
    await espera;
    expect(quem!.id).toBe('sem');
    c.controle.abort();
    expect(v.interativos.obter(idAcalmar('camelo'))).toBeUndefined();
  });

  it('Sem tem uma fala no planejamento de A2 ("Fale com Sem, Cam e Jafé")', async () => {
    const v = valeAtual;
    const m = missao('a2');
    const estado = novoEstado('a2');
    const c = new CtxFalso(v, m, estado, 'auto');
    await m.etapas[0].executar(c);
    c.controle.abort();
    const falantes = v.reg.linhas.filter((l) => !ehBiblica(l)).map((l) => l.quem);
    expect(falantes).toEqual(expect.arrayContaining(['sem', 'cam', 'jafe']));
  });
});

describe('era de Noé — atalhos de depuração', () => {
  it('jogam a era inteira só pelas APIs do jogo (sem nada se resolver sozinho)', async () => {
    const v = valeAtual;
    let atual: { m: DefMissao; estado: EstadoMissao; ctx: CtxFalso | null } | null = null;
    const amb: AmbienteAtalhosNoe = {
      mundo: v.mundo as never,
      servicos: v.servicos,
      emitir: (n, d) => v.emitir(n, d),
      ativo: () => v.pessoa(v.ativoId),
      emProva: () => !!atual?.ctx?.provaAtual,
      resolverProva: () => {
        const p = atual?.ctx?.provaAtual;
        if (!p) return false;
        atual!.ctx!.provaAtual = null;
        p.res({ venceu: true, tentativas: 1, tempo: 0 });
        return true;
      },
      estado: () => atual?.estado ?? null,
      flags: v.flags,
      esperar: async (seg) => {
        for (let i = 0; i < Math.max(1, Math.round(seg * 10)); i++) await imediato();
      },
      limite: 50_000,
    };
    const etapas: string[] = [];
    const historia = (async () => {
      for (const m of MISSOES_NOE) {
        const estado = novoEstado(m.id);
        atual = { m, estado, ctx: null };
        await jogarMissao(v, m, 'eventos', estado, (c) => (atual!.ctx = c));
      }
    })();
    const atalhos = jogarEraNoe(amb, { aoEtapa: (m, e) => etapas.push(`${m}.${e}`) });
    await Promise.all([historia, atalhos]);
    // todas as etapas em que o jogador age passaram pelos atalhos (as só de cinemática podem
    // terminar antes de o atalho vê-las)
    const comAcao = ['a1.orar', 'a1.madeira', 'a1.troncos', 'a1.quilha', 'a2.planejar', 'a2.erguer', 'a2.betume', 'a3.ir', 'a3.pregar',
      'a3.tentacao', 'a4.animais', 'a4.parPerdido', 'a4.entrar', 'a5.fontes', 'a5.inquietos', 'a5.medo', 'a5.janela', 'a6.altar', 'a6.explorar'];
    for (const e of comAcao) expect(etapas, e).toContain(e);
    expect(atual!.estado).toMatchObject({ id: 'a6', status: 'concluida' });
    expect(v.flags.a6Altar).toBe(true);
    expect(v.reg.memorias).toContain('arcoIris');
  }, 60_000);
});
