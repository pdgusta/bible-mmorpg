// Testes do conteúdo da era de Abraão: textos bíblicos, ids, encadeamento das missões e cada
// missão jogada do início ao fim com um CtxMissao falso (que resolve interações, chegadas,
// provas e as mecânicas em tempo real na hora) e, depois, a era inteira guiada só pelos
// atalhos de depuração.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import biblia from '../src/data/biblia/versiculos.json';
import srcMissoes from '../src/eras/abraao/missoes.ts?raw';
import srcMemorias from '../src/eras/abraao/memorias.ts?raw';
import srcCristo from '../src/eras/abraao/cristo.ts?raw';
import srcPersonagens from '../src/eras/abraao/personagens.ts?raw';
import { Interativos, type Interativo } from '../src/jogo/Interacoes';
import { temVerbo, type Verbo } from '../src/jogo/Classes';
import { ORDEM_ATRIBUTOS, XP, type FonteXP, type NomeAtributo } from '../src/jogo/Atributos';
import type {
  Alvo, CtxMissao, DefMissao, DefProva, EstadoMissao, Linha, LinhaBiblica, OpcaoEscolha, PecaArmadura, ResultadoProva,
} from '../src/jogo/contratos';
import { ehBiblica } from '../src/jogo/contratos';
import type { DefPersonagem, Personagem } from '../src/jogo/Personagem';
import type { Mundo } from '../src/mundo/Mundo';
import { ACAMPAMENTOS, CURRAIS, MAPA_CANAA, TRILHA_BETEL } from '../src/eras/abraao/mapa';
import { CAMINHO_FE, DESPOJOS, avancoNoCaminho, brilhoDespojos, caminhoFe, trechoRevelado } from '../src/eras/abraao/mecanicas';
import type { EstadoAltar, LugarAcampamento, NomeAltar, NomeCurral, NomePorteira, NomeTenda } from '../src/eras/abraao/construir';
import { MEMORIAS_NOE } from '../src/eras/noe/memorias';
import {
  ERA_ABRAAO, MISSOES_ABRAAO, MEMORIAS_ABRAAO, CRISTO_ABRAAO, SEGREDOS_ABRAAO, JOGAVEIS_ABRAAO, NPCS_ABRAAO, NPCS_CENA_ABRAAO,
  INICIO_ABRAAO, ELENCO_ABRAAO, INTERATIVOS_ABRAAO, PONTOS_RESERVA, PONTOS_USADOS_ABRAAO, PROVA_TENTACAO_B3, PROVA_DUVIDA_B4,
  PROVA_MEDO_B5, MENTIRAS_B3, MENTIRAS_B4, MENTIRAS_B5, idsInterativosAbraao, ligarServicosAbraao, registrarSegredosAbraao,
  reconstruirMundoAbraao, limparCenaAbraao, mecanicaAbraao, jogarEraAbraao,
  type AnimalAbraao, type CanaaAbraao, type OpcoesAnimalAbraao, type RebanhoAbraao, type ServicosAbraao, type AmbienteAtalhosAbraao,
} from '../src/eras/abraao';

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

// o ambiente de teste é o Node (sem @types/node)
declare const setImmediate: (f: () => void) => unknown;
const imediato = () => new Promise<void>((r) => setImmediate(r));
const abortado = () => Object.assign(new Error('abortado'), { name: 'AbortError' });

class PessoaFalsa {
  readonly posicao = new THREE.Vector3();
  yaw = 0;
  carregando: string | null = null;
  posto: { id: string; clipe: string; yaw: number; descricao: string } | null = null;
  aprendidos: Verbo[] = [];
  controlado = false;
  escalada = null;
  emCena = false;
  modVelocidade = 1;
  disponivel = true;
  ficha = null;
  segurando: Record<string, string | null> = {};
  readonly humano = {
    visivel: true,
    animador: { atividade: null as string | null, superior: null as string | null, agachado: false, tocar: async () => {} },
    segurar: (item: string | null, mao: string) => {
      this.segurando[mao] = item;
    },
  };
  readonly ia = {
    esperar() {},
    voltarARotina() {},
    seguir() {},
    irPara: async (x: number, z: number) => {
      this.teleportar(x, 0, z);
    },
    moverCena: async (x: number, z: number) => {
      this.teleportar(x, 0, z);
      await imediato();
    },
  };
  constructor(readonly def: DefPersonagem, private flags: Record<string, unknown>) {
    this.aprendidos = [...(def.aprendidos ?? [])];
  }
  get id() {
    return this.def.id;
  }
  get nome() {
    const alt = this.def.nomeAlternativo;
    return alt && this.flags[alt.flag] ? alt.nome : this.def.nome;
  }
  get classe() {
    return this.def.classe;
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

class AnimalFalso implements AnimalAbraao {
  readonly posicao = new THREE.Vector3();
  preso = false;
  constructor(readonly especie: string, x: number, z: number, readonly opts: OpcoesAnimalAbraao, private vivos: Set<AnimalFalso>) {
    this.posicao.set(x, 0, z);
    vivos.add(this);
  }
  vagar() {}
  seguir() {}
  async irPara(x: number, z: number) {
    this.posicao.set(x, this.posicao.y, z);
  }
  teleportar(x: number, z: number, y = 0) {
    this.posicao.set(x, y, z);
  }
  prender() {
    this.preso = true;
  }
  soltar() {
    this.preso = false;
  }
  async remover() {
    this.vivos.delete(this);
  }
}

class RebanhoFalso implements RebanhoAbraao {
  pastor: THREE.Vector3 | null = null;
  constructor(readonly animais: AnimalAbraao[]) {}
  adicionar(a: AnimalAbraao) {
    if (!this.animais.includes(a)) this.animais.push(a);
  }
  remover(a: AnimalAbraao) {
    const i = this.animais.indexOf(a);
    if (i >= 0) this.animais.splice(i, 1);
  }
  juntar() {}
  conduzirPara() {}
  seguirLider() {}
  dentroDe(area: (x: number, z: number) => boolean, filtro?: (a: AnimalAbraao) => boolean) {
    return this.animais.filter((a) => (!filtro || filtro(a)) && area(a.posicao.x, a.posicao.z)).length;
  }
}

/** Canaã falsa: o mesmo contrato de MundoCanaa, sem malhas. */
class CanaaFalsa implements CanaaAbraao {
  acampamento: LugarAcampamento | null = null;
  cordaAmarrada = false;
  aoCairFosso: ((p: Personagem) => void) | null = null;
  inimigoVisivel = false;
  despojosVisiveis = false;
  despojosAcesos = false;
  pedras = 0;
  readonly tendas: Record<NomeTenda, boolean> = { tendaAbrao: true, tendaSara: true };
  readonly porteiras: Record<NomePorteira, boolean> = { porteiraAbrao: false, porteiraLo: false };
  readonly altares: Record<NomeAltar, EstadoAltar> = { altarMore: 'oculto', altarBetel: 'oculto', altarManre: 'oculto', altarMoria: 'oculto' };
  constructor(private pontos: Map<string, [number, number]>) {}
  definirAcampamento(l: LugarAcampamento | null) {
    this.acampamento = l;
    const d = ACAMPAMENTOS[l ?? 'betel'];
    this.pontos.set('acampamento', d.centro);
    this.pontos.set('tendaAbrao', d.tendaAbrao.pos);
    this.pontos.set('tendaSara', d.tendaSara.pos);
    this.pontos.set('fogueiraAcampamento', d.fogueira);
  }
  montarTenda(t: NomeTenda, m: boolean) {
    this.tendas[t] = m;
  }
  abrirPorteira(p: NomePorteira, a: boolean) {
    this.porteiras[p] = a;
  }
  porteiraAberta(p: NomePorteira) {
    return this.porteiras[p];
  }
  dentroCurral(nome: NomeCurral, x: number, z: number) {
    const c = CURRAIS[nome];
    const dx = x - c.centro[0];
    const dz = z - c.centro[1];
    const cs = Math.cos(c.yaw);
    const sn = Math.sin(c.yaw);
    return Math.abs(dx * cs - dz * sn) < c.w / 2 - 0.3 && Math.abs(dx * sn + dz * cs) < c.d / 2 - 0.3;
  }
  definirAltar(n: NomeAltar, e: EstadoAltar) {
    this.altares[n] = e;
  }
  estadoAltar(n: NomeAltar) {
    return this.altares[n];
  }
  definirAcampamentoInimigo(v: boolean) {
    this.inimigoVisivel = v;
  }
  definirDespojos(v: boolean) {
    this.despojosVisiveis = v;
  }
  acenderDespojos(s: boolean) {
    this.despojosAcesos = s;
  }
  amarrarCordaMoria(s: boolean) {
    this.cordaAmarrada = s;
  }
  revelarPedras(t: number) {
    this.pedras = t;
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
  avisos: string[];
  atributos: [string, NomeAtributo, number][];
  xp: [string, FonteXP, number | undefined][];
  creditos: number;
}

function novoRegistro(): Registro {
  return { linhas: [], versiculos: [], recebidos: [], memorias: [], armadura: [], provas: [], cristo: [], alvos: [], avisos: [], atributos: [], xp: [], creditos: 0 };
}

const CENA_NPC = new Set(Object.keys(NPCS_CENA_ABRAAO));

/** Canaã falsa inteira: mundo, personagens, serviços e barramento. */
class CanaaMundoFalso {
  readonly interativos = new Interativos();
  readonly pontos = new Map<string, [number, number]>([...Object.entries(PONTOS_RESERVA), ...Object.entries(MAPA_CANAA.pontos)]);
  readonly escaladas = new Map();
  readonly personagens = new Map<string, PessoaFalsa>();
  readonly mundo = {
    interativos: this.interativos, pontos: this.pontos, escaladas: this.escaladas, personagens: this.personagens,
    chao: () => 0,
  } as unknown as Mundo;
  readonly flags: Record<string, unknown> = {};
  readonly reg = novoRegistro();
  readonly animais = new Set<AnimalFalso>();
  readonly quadros = new Set<(dt: number) => void>();
  readonly canaa = new CanaaFalsa(this.pontos);
  readonly progressoMemorias: string[] = [];
  segredosNoe = 0;
  ouvintes: Ouvinte[] = [];
  ativoId = 'abraao';
  readonly servicos: ServicosAbraao;

  constructor() {
    for (const d of [...JOGAVEIS_ABRAAO, ...NPCS_ABRAAO]) this.criar(d, INICIO_ABRAAO[d.id]?.lugar ?? 'acampamento');
    this.personagens.get('abraao')!.controlado = true;
    const v = this;
    this.servicos = {
      canaa: this.canaa,
      ceu: { hora: 9, gloria: 0, pausado: false, estrelas: 0 },
      audio: { ambiente() {}, musica() {}, efeito() {} },
      animais: {
        criar: async (e, x, z, o = {}) => new AnimalFalso(e, x, z, o, this.animais),
        rebanho: (a) => new RebanhoFalso([...a]),
        soltarRebanho() {},
      },
      progresso: {
        get memorias() {
          return v.progressoMemorias;
        },
        segredos: [],
        estatisticas: {},
        tempoJogado: 0,
        temMemoria: (id) => this.progressoMemorias.includes(id),
        memoria: (id) => {
          if (this.progressoMemorias.includes(id)) return false;
          this.progressoMemorias.push(id);
          this.reg.memorias.push(id);
          return true;
        },
        ganharXP: () => 0,
        somarAtributo: (id, a, n) => {
          this.reg.atributos.push([id, a, n]);
          return n;
        },
        segredosDaEra: (era) => (era === 'noe' ? this.segredosNoe : 0),
      },
      camera: { tremer() {} },
      entrada: { ativa: () => false, pressionou: () => false },
      aCadaQuadro: (fn) => {
        this.quadros.add(fn);
        return () => this.quadros.delete(fn);
      },
      cristo: (id) => this.reg.cristo.push(id),
      controlar: (id) => {
        for (const p of this.personagens.values()) p.controlado = p.id === id;
        this.ativoId = id;
      },
      liberarPosto: (idPosto) => {
        for (const p of this.personagens.values()) if (p.posto?.id === idPosto) p.sairPosto();
      },
      emitir: (e, d) => this.emitir(e, d),
      criarPersonagem: (def, x, z, yaw) => {
        const p = this.criar(def, null);
        p.teleportar(x, 0, z, yaw);
        return p as unknown as Personagem;
      },
      removerPersonagem: (id) => {
        this.personagens.delete(id);
      },
      creditos: async () => {
        this.reg.creditos++;
      },
    };
  }

  private criar(d: DefPersonagem, lugar: string | null) {
    const p = new PessoaFalsa(d, this.flags);
    if (lugar) {
      const [x, z] = this.pontos.get(lugar) ?? [0, 0];
      p.teleportar(x, 0, z);
    }
    this.personagens.set(d.id, p);
    return p;
  }

  pessoa(id: string) {
    const p = this.personagens.get(id);
    if (!p) throw new Error(`personagem ausente: ${id}`);
    return p as unknown as Personagem;
  }

  /** Passa tempo de jogo nas mecânicas (servicos.aCadaQuadro). */
  quadro(dt: number) {
    for (const f of [...this.quadros]) f(dt);
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

  /** Quem pode usar o interativo agora (Abrão primeiro; só quem está em cena e disponível). */
  candidatos(i: Interativo): PessoaFalsa[] {
    if (!Interativos.ativo(i)) return [];
    if (i.posto && [...this.personagens.values()].some((p) => p.posto?.id === i.id)) return [];
    const ordem = ['abraao', 'isaque', 'sara', 'lo', 'eliezer'];
    const lista = [...this.personagens.values()].filter((p) => {
      if (!p.def.jogavel || !p.disponivel || !p.humano.visivel) return false;
      if (!p.pode(i.verbo)) return false;
      if (i.carregando === null && p.carregando) return false;
      if (typeof i.carregando === 'string' && p.carregando !== i.carregando) return false;
      if (p.posto) return false;
      return true;
    });
    lista.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
    return lista;
  }
}

type Ouvinte = { nome: string; filtro?: (d: unknown) => boolean; res: (d: unknown) => void; rej: (e: unknown) => void; ctx?: CtxFalso };

/**
 * CtxMissao falso. No modo 'auto', resolve na hora: as interações esperadas são usadas por
 * quem pode, as chegadas teleportam, as provas são vencidas, as mecânicas em tempo real se
 * resolvem e, a cada espera de tempo, um interativo ativo é usado (como um jogador que age
 * enquanto o tempo passa). No modo 'eventos', nada se resolve sozinho: só os atalhos fazem a
 * história andar (as mecânicas continuam recebendo quadros).
 */
class CtxFalso implements CtxMissao {
  readonly sinal: AbortSignal;
  readonly controle = new AbortController();
  passos = 0;
  acoes = 0;
  provaAtual: { def: DefProva; res: (r: ResultadoProva) => void } | null = null;
  limiteAcoes = Infinity;

  constructor(readonly v: CanaaMundoFalso, readonly missao: DefMissao, readonly estado: EstadoMissao, readonly modo: 'auto' | 'eventos') {
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
  async esperar(s: number) {
    this.checar();
    await imediato();
    this.checar();
    if (this.modo === 'auto') mecanicaAbraao()?.resolverAutomaticamente();
    this.v.quadro(s);
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
  dica() {}
  aviso(t: string) {
    this.v.reg.avisos.push(t);
  }
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
  xp(alvo: string, fonte: FonteXP, qtd?: number) {
    this.v.reg.xp.push([alvo, fonte, qtd]);
  }
  treinar(id: string) {
    expect(this.v.personagens.get(id)?.def.jogavel, `treinar um não jogável: ${id}`).toBe(true);
  }
  memoria(id: string) {
    expect(MEMORIAS_ABRAAO.some((m) => m.id === id), `memória desconhecida ${id}`).toBe(true);
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
  disponivel(id: string, sim: boolean) {
    const p = this.v.personagens.get(id);
    if (p) p.disponivel = sim;
  }
  prova(def: DefProva): Promise<ResultadoProva> {
    this.checar();
    this.v.reg.provas.push(def);
    for (const r of def.respostas ?? []) expect(this.v.reg.recebidos, `resposta ${r} não recebida antes da prova ${def.id}`).toContain(r);
    if (this.modo === 'auto') return Promise.resolve({ venceu: true, tentativas: 1, tempo: 0 });
    return new Promise((res) => (this.provaAtual = { def, res }));
  }
}

function novoEstado(id: string): EstadoMissao {
  return { id, etapa: 0, status: 'ativa', contadores: {} };
}

async function jogarMissao(v: CanaaMundoFalso, m: DefMissao, modo: 'auto' | 'eventos' = 'auto', estado = novoEstado(m.id), aoCtx?: (c: CtxFalso) => void) {
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
    expect(v.quadros.size, `mecânica esquecida depois de ${m.id}.${m.etapas[i].id}`).toBe(0);
    expect(mecanicaAbraao(), `mecânica ativa depois de ${m.id}.${m.etapas[i].id}`).toBeNull();
  }
  estado.status = 'concluida';
}

const SEGREDOS_IDS = new Set(['segredoPo']);
function idsDaEtapaRestantes(v: CanaaMundoFalso) {
  return [...v.interativos.todos()].map((i) => i.id).filter((id) => !SEGREDOS_IDS.has(id));
}

let mundoAtual: CanaaMundoFalso;
beforeEach(() => {
  limparCenaAbraao();
  mundoAtual = new CanaaMundoFalso();
  ligarServicosAbraao(mundoAtual.servicos);
  reconstruirMundoAbraao(mundoAtual.servicos, mundoAtual.mundo as never, mundoAtual.flags);
});
afterEach(() => {
  ligarServicosAbraao(null);
  limparCenaAbraao();
});

// ------------------------------------------------------------------------------ testes

describe('era de Abraão — dados', () => {
  it('missões encadeadas: ids únicos, toda `proxima` existe, a inicial existe, B5 fecha a era', () => {
    const ids = MISSOES_ABRAAO.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MISSOES_ABRAAO) {
      if (m.proxima) expect(ids, `${m.id}.proxima`).toContain(m.proxima);
      expect(m.era).toBe('abraao');
      expect(m.etapas.length).toBeGreaterThan(0);
      const etapas = m.etapas.map((e) => e.id);
      expect(new Set(etapas).size, `etapas repetidas em ${m.id}`).toBe(etapas.length);
      // os atalhos cobrem todas as etapas
      expect(Object.keys(ERA_ABRAAO.atalhos[m.id] ?? {}), `atalhos de ${m.id}`).toEqual(etapas);
    }
    expect(ids).toContain(ERA_ABRAAO.missaoInicial);
    expect(ids).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(MISSOES_ABRAAO[4].proxima).toBeUndefined();
    expect(MISSOES_ABRAAO[4].etapas.map((e) => e.id)).toEqual(['nomes', 'prova', 'pe', 'subida', 'altar', 'carneiro', 'promessa']);
  });

  it('ids de interativos únicos na era (e diferentes das escaladas do motor)', () => {
    const ids = idsInterativosAbraao();
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos).toEqual([]);
    expect(ids).not.toContain('cordaMoria');
    // os do ROTEIRO (a corda do Moriá é 'amarrarCorda', ver interativos.ts)
    for (const id of ['altarMore', 'mastroTenda1', 'mastroTenda2', 'amarrarTenda1', 'amarrarTenda2', 'altarBetel', 'orarBetel', 'porteiraAbrao',
      'porteiraLo', 'miranteNorte', 'miranteSul', 'miranteLeste', 'miranteOeste', 'segredoPo', 'altarManre', 'sinal', 'cativo1', 'cativo5',
      'dizimo', 'amarrarCorda', 'altarMoria', 'carneiro']) expect(ids).toContain(id);
  });

  it('memórias conforme o ROTEIRO (segredo marcado, resultados de prova com força 0)', () => {
    const porId = Object.fromEntries(MEMORIAS_ABRAAO.map((m) => [m.id, m]));
    expect(Object.keys(porId).sort()).toEqual(['altarBetel', 'chamado', 'estrelas', 'jeovaJire', 'melquisedeque', 'naoHajaContenda', 'nemUmFio',
      'percorreATerra', 'poDaTerra', 'resgate'].sort());
    const forcas = Object.fromEntries(MEMORIAS_ABRAAO.map((m) => [m.id, m.forca]));
    expect(forcas).toEqual({ chamado: 1, altarBetel: 1, naoHajaContenda: 1, percorreATerra: 2, resgate: 2, melquisedeque: 2, nemUmFio: 1, poDaTerra: 1, estrelas: 0, jeovaJire: 0 });
    expect(SEGREDOS_ABRAAO).toEqual(['poDaTerra']);
    for (const m of MEMORIAS_ABRAAO) expect(m.era).toBe('abraao');
    // nenhum id repete os da era 1 (o Livro das Memórias junta as duas)
    for (const m of MEMORIAS_ABRAAO) expect(MEMORIAS_NOE.map((n) => n.id)).not.toContain(m.id);
  });

  it('fichas, classes e elenco dos jogáveis conforme o ROTEIRO', () => {
    const f = (id: string) => ORDEM_ATRIBUTOS.map((a) => JOGAVEIS_ABRAAO.find((d) => d.id === id)!.atributos![a]);
    expect(f('abraao')).toEqual([4, 5, 3, 7, 7, 6, 7, 6, 7, 6, 6, 6]);
    expect(f('sara')).toEqual([3, 5, 4, 5, 6, 6, 6, 8, 6, 7, 6, 5]);
    expect(f('lo')).toEqual([5, 6, 6, 4, 3, 4, 4, 5, 3, 4, 3, 5]);
    expect(f('eliezer')).toEqual([6, 7, 5, 5, 5, 6, 6, 5, 6, 6, 5, 7]);
    expect(f('isaque')).toEqual([4, 5, 7, 6, 5, 6, 4, 6, 7, 6, 4, 6]);
    expect(Object.fromEntries(JOGAVEIS_ABRAAO.map((d) => [d.id, d.classe]))).toEqual({
      abraao: 'profeta', sara: 'hospitaleiro', lo: 'pastor', eliezer: 'guerreiro', isaque: 'batedor',
    });
    expect(ELENCO_ABRAAO).toEqual({
      b1: ['abraao', 'sara', 'lo', 'eliezer'], b2: ['abraao', 'sara', 'lo', 'eliezer'], b3: ['abraao', 'eliezer'],
      b4: ['abraao', 'sara', 'eliezer'], b5: ['abraao', 'isaque'],
    });
    for (const d of [...JOGAVEIS_ABRAAO, ...NPCS_ABRAAO]) expect(INICIO_ABRAAO[d.id], `início de ${d.id}`).toBeTruthy();
    expect(INICIO_ABRAAO.isaque.lugar).toBe('bastidor');
  });

  it('referências estáticas existem e trechos são substrings exatos da BKJ', () => {
    const erros: string[] = [];
    const ver = (ref: string, trecho?: string) => {
      const e = conferirRef(ref, trecho);
      if (e) erros.push(e);
    };
    for (const m of MISSOES_ABRAAO) m.refs.forEach((r) => ver(r));
    for (const m of MEMORIAS_ABRAAO) ver(m.ref);
    for (const c of CRISTO_ABRAAO) c.refs.forEach((r) => ver(r));
    for (const d of [...JOGAVEIS_ABRAAO, ...NPCS_ABRAAO, ...Object.values(NPCS_CENA_ABRAAO)]) if (d.ref) ver(d.ref);
    for (const r of PROVA_TENTACAO_B3.respostas ?? []) ver(r);
    // varre o código-fonte: deus/narrador/anjo/<quem>Diz('ref', 'trecho'), versiculo(..), receberVersiculo(..) e toda ref solta
    for (const src of [srcMissoes, srcMemorias, srcCristo, srcPersonagens]) {
      expect(src.length).toBeGreaterThan(500);
      for (const m of src.matchAll(/(?:deus|narrador|anjo|[a-z]+Diz)\(\s*'([^']+)'(?:,\s*'([^']*)')?\s*\)/g)) ver(m[1], m[2]);
      for (const m of src.matchAll(/(?:versiculo|receberVersiculo)\(\s*'([^']+)'\s*\)/g)) ver(m[1]);
      for (const m of src.matchAll(/'((?:[1-3])?[A-ZÊÓ][a-zó]{0,2} \d{1,3}:\d{1,3}(?:-\d{1,3})?)'/g)) ver(m[1]);
    }
    expect(erros).toEqual([]);
  });

  it('mentiras curtas; "Aponta para Cristo" com 2–4 frases', () => {
    for (const z of [...MENTIRAS_B3, ...MENTIRAS_B4, ...MENTIRAS_B5]) expect(z.length).toBeLessThan(80);
    expect(PROVA_DUVIDA_B4.mentiras).toBe(MENTIRAS_B4);
    expect(PROVA_MEDO_B5.aliado).toBe('isaque');
    for (const c of CRISTO_ABRAAO) {
      const frases = c.texto.split(/(?<=[.!?])\s+/).filter(Boolean).length;
      expect(frases, c.id).toBeGreaterThanOrEqual(2);
      expect(frases, c.id).toBeLessThanOrEqual(4);
    }
  });

  it('pontos usados: todos no mapa de Canaã (ou na reserva), inclusive interativos, inícios e rotinas', () => {
    const conhecido = (n: string) => !!(MAPA_CANAA.pontos[n] ?? PONTOS_RESERVA[n]);
    const faltam = PONTOS_USADOS_ABRAAO.filter((n) => !conhecido(n));
    expect(faltam).toEqual([]);
    for (const d of Object.values(INTERATIVOS_ABRAAO).flat()) if (typeof d.lugar === 'string') expect(PONTOS_USADOS_ABRAAO, d.id).toContain(d.lugar);
    for (const [id, ini] of Object.entries(INICIO_ABRAAO)) expect(conhecido(ini.lugar), `início de ${id}`).toBe(true);
    for (const d of [...JOGAVEIS_ABRAAO, ...NPCS_ABRAAO]) for (const r of d.rotina ?? []) {
      if (typeof r.lugar === 'string') expect(conhecido(r.lugar), `rotina de ${d.id}: ${r.lugar}`).toBe(true);
      if (typeof r.olhar === 'string') expect(conhecido(r.olhar), `rotina de ${d.id}: ${r.olhar}`).toBe(true);
    }
  });

  it('B5: os servos esperam fora do raio de chegada ao pé do Moriá (a etapa `pe` não termina sozinha)', () => {
    const m = srcMissoes.match(/c\.chegar\('abraao', 'peMoria'(?:, ([\d.]+))?\)/);
    expect(m, "c.chegar('abraao', 'peMoria'…) em missoes.ts").not.toBeNull();
    const raio = m![1] ? Number(m![1]) : 3;
    const [sx, sz] = MAPA_CANAA.pontos.servosMoria;
    const [px, pz] = MAPA_CANAA.pontos.peMoria;
    // +1,5: a folga que o CtxMissao falso dá ao `chegar`
    expect(Math.hypot(sx - px, sz - pz)).toBeGreaterThan(raio + 1.5);
  });
});

describe('era de Abraão — missões jogadas com CtxMissao falso', () => {
  for (const m of MISSOES_ABRAAO) {
    it(`${m.id} roda do início ao fim (mundo novo)`, async () => {
      await jogarMissao(mundoAtual, m);
    });
  }

  it('legado de Noé no início de B1: +1 fé a cada 2 segredos (até +2), +1 domínio pela A3 de primeira', async () => {
    const v = mundoAtual;
    v.segredosNoe = 5;
    v.flags.a3PrimeiraTentativa = true;
    v.progressoMemorias.push('graca', 'arcoIris');
    await jogarMissao(v, MISSOES_ABRAAO[0]);
    expect(v.reg.atributos).toEqual([['abraao', 'fe', 2], ['abraao', 'dominio', 1]]);
    const legado = v.flags.legadoNoe as string[];
    expect(legado).toEqual([
      'Legado de Noé: +2 Fé', 'Legado de Noé: +1 Domínio próprio', 'Legado de Noé: Abrão sabe construir altares ao Senhor',
      'Legado de Noé: 2 memórias de fidelidade guardadas',
    ]);
    for (const l of legado) expect(v.reg.avisos).toContain(l);
    expect(v.personagens.get('abraao')!.aprendidos).toContain('construirAltar');
    // aplicado uma vez só
    await jogarMissao(v, MISSOES_ABRAAO[0]);
    expect(v.reg.atributos.length).toBe(2);
  });

  it('a era inteira em sequência: memórias, armadura, Cristo, nomes, elenco, textos e estado final', async () => {
    const v = mundoAtual;
    registrarSegredosAbraao(v.mundo as never, v.servicos, v.flags);
    for (const m of MISSOES_ABRAAO) await jogarMissao(v, m);
    const r = v.reg;
    // o jogador de teste usa tudo o que vê: acha também o segredo do pó da terra
    expect(r.memorias).toEqual(['chamado', 'altarBetel', 'naoHajaContenda', 'poDaTerra', 'percorreATerra', 'resgate', 'melquisedeque', 'nemUmFio', 'estrelas', 'jeovaJire']);
    expect(r.armadura).toEqual(['calcado', 'escudo', 'couraca']);
    expect(r.cristo).toEqual(['bencaoNacoes', 'melquisedeque', 'justica', 'cordeiro', 'semente']);
    expect(r.provas.map((p) => p.tipo)).toEqual(['tentacao', 'duvida', 'medo']);
    expect(r.creditos).toBe(1);
    // nomes (Gn 17:5, 17:15) e o filho da promessa
    expect(v.pessoa('abraao').nome).toBe('Abraão');
    expect(v.pessoa('sara').nome).toBe('Sara');
    expect(v.pessoa('servo1').nome).toBe('Servo de Abraão');
    expect(v.flags.isaqueNasceu).toBe(true);
    // elenco de B5: só Abraão e Isaque; Ló fora de cena desde B3
    const disp = Object.fromEntries(['abraao', 'sara', 'lo', 'eliezer', 'isaque'].map((id) => [id, v.personagens.get(id)!.disponivel]));
    expect(disp).toEqual({ abraao: true, sara: false, lo: false, eliezer: false, isaque: true });
    expect(v.personagens.get('lo')!.humano.visivel).toBe(false);
    expect(v.personagens.get('isaque')!.humano.visivel).toBe(true);
    // Canaã ao fim: Manre, altares acesos, corda amarrada, noite desfeita
    expect(v.canaa.acampamento).toBe('manre');
    expect(v.canaa.altares).toEqual({ altarMore: 'aceso', altarBetel: 'aceso', altarManre: 'aceso', altarMoria: 'aceso' });
    expect(v.canaa.cordaAmarrada).toBe(true);
    expect(v.canaa.inimigoVisivel).toBe(false);
    expect(v.servicos.ceu.pausado).toBe(false);
    expect(v.personagens.get('abraao')!.aprendidos).toContain('construirAltar');
    expect(v.personagens.get('abraao')!.aprendidos).not.toContain('escalar');
    expect(v.personagens.get('isaque')!.carregando).toBeNull();
    // nenhum NPC de cena nem animal esquecido (ovelhas, jumento e carneiro saem)
    expect([...v.personagens.keys()].filter((id) => CENA_NPC.has(id))).toEqual([]);
    expect([...v.animais].map((a) => a.especie)).toEqual([]);
    // todas as falas bíblicas conferem
    const erros = r.linhas.filter(ehBiblica).map((l: LinhaBiblica) => conferirRef(l.ref, l.trecho)).filter(Boolean);
    expect(erros).toEqual([]);
    for (const ref of [...r.versiculos, ...r.recebidos]) expect(conferirRef(ref), ref).toBeNull();
    // Deus e o Anjo nunca são figura: só falam por referência bíblica
    for (const l of r.linhas) if (l.quem === 'deus' || l.quem === 'anjo') expect(ehBiblica(l), JSON.stringify(l)).toBe(true);
    // ficção curta
    for (const l of r.linhas) if (!ehBiblica(l)) expect((l as { texto: string }).texto.length, (l as { texto: string }).texto).toBeLessThanOrEqual(140);
    // alvos de objetivo resolvíveis
    for (const a of r.alvos) if (typeof a === 'string') expect(v.pontos.has(a) || idsInterativosAbraao().includes(a), `alvo ${a}`).toBe(true);
  });

  it('etapas são idempotentes: abortar no meio e recomeçar a etapa termina a missão', async () => {
    const v = mundoAtual;
    for (const m of MISSOES_ABRAAO) {
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
        expect(v.quadros.size, `mecânica esquecida ao abortar ${m.id}.${m.etapas[i].id}`).toBe(0);
        // como depois de carregar um save: Canaã reconstruída pelas flags e a etapa do início
        reconstruirMundoAbraao(v.servicos, v.mundo as never, v.flags);
        const c2 = new CtxFalso(v, m, estado, 'auto');
        await m.etapas[i].executar(c2);
        c2.controle.abort();
      }
    }
    expect(v.flags.b5Carneiro).toBe(true);
    expect(v.canaa.altares.altarMoria).toBe('aceso');
  });
});

describe('era de Abraão — ensinamentos 11 (sair pela fé) e 15 (não amar as riquezas)', () => {
  const destinoB1 = MAPA_CANAA.pontos.acampamentoBetel;
  const caminho = caminhoFe([...TRILHA_BETEL, destinoB1]);
  const ultimo = caminho.pontos.length - 1;
  /** Pontos a cada ~1 m ao longo do caminho, do início ao destino. */
  function amostras(): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 1; i < caminho.pontos.length; i++) {
      const [ax, az] = caminho.pontos[i - 1];
      const [bx, bz] = caminho.pontos[i];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az));
      for (let k = 0; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    return out;
  }

  it('11: o caminho de Moré ao monte se divide em trechos de ~24 m e se revela só para a frente', () => {
    expect(caminho.pontos[0]).toEqual(TRILHA_BETEL[0]);
    expect(caminho.pontos[ultimo]).toEqual(destinoB1);
    expect(ultimo).toBeGreaterThanOrEqual(4);
    for (let i = 1; i <= ultimo; i++) {
      const passo = caminho.s[i] - caminho.s[i - 1];
      if (i < ultimo) expect(passo).toBeCloseTo(CAMINHO_FE.passo, 6);
      else expect(passo).toBeGreaterThanOrEqual(CAMINHO_FE.passo / 2);
    }
    // no início, a bússola mostra o fim do primeiro trecho, nunca o destino
    const [x0, z0] = caminho.pontos[0];
    expect(trechoRevelado(caminho, x0, z0, 0)).toBe(1);
    // andando, o trecho só avança, um de cada vez, e o destino aparece só no fim
    let k = 0;
    const vistos: number[] = [];
    for (const [x, z] of amostras()) {
      const n = trechoRevelado(caminho, x, z, k);
      expect(n).toBeGreaterThanOrEqual(k);
      expect(n - Math.max(k, 1)).toBeLessThanOrEqual(1);
      if (n !== k) vistos.push(n);
      if (n === ultimo && k !== ultimo) expect(avancoNoCaminho(caminho, x, z)).toBeGreaterThanOrEqual(caminho.s[ultimo - 1] - CAMINHO_FE.revelar - 1.01);
      k = n;
    }
    expect(vistos).toEqual(Array.from({ length: ultimo }, (_, i) => i + 1));
    // voltar não esconde o que já se abriu
    expect(trechoRevelado(caminho, x0, z0, k)).toBe(ultimo);
  });

  it('11: em B1 a bússola aponta trecho a trecho até o monte entre Betel e Ai', async () => {
    const v = mundoAtual;
    const b1 = MISSOES_ABRAAO[0];
    // o jogador anda pela trilha antes de chegar (o `chegar` falso só teleporta)
    await jogarMissao(v, b1, 'auto', novoEstado(b1.id), (c) => {
      const chegar = c.chegar.bind(c);
      c.chegar = async (quem, alvo, raio) => {
        if (alvo === 'acampamentoBetel') {
          for (const [x, z] of amostras()) {
            v.pessoa('abraao').teleportar(x, 0, z);
            v.quadro(0.1);
          }
        }
        return chegar(quem, alvo, raio);
      };
    });
    const alvos = v.reg.alvos;
    const doCaminho = alvos.slice(alvos.indexOf('altarMore') + 1, alvos.indexOf('mastroTenda1'));
    expect(doCaminho).toEqual([...caminho.pontos.slice(1, ultimo), 'acampamentoBetel']);
  });

  it('15: o brilho dos despojos é pleno perto, desbota com a distância e some longe', () => {
    expect(brilhoDespojos(0)).toBe(1);
    expect(brilhoDespojos(DESPOJOS.perto)).toBe(1);
    expect(brilhoDespojos(DESPOJOS.longe)).toBe(0);
    expect(brilhoDespojos(DESPOJOS.longe + 30)).toBe(0);
    let antes = 1;
    for (let d = DESPOJOS.perto; d <= DESPOJOS.longe; d += 0.5) {
      const b = brilhoDespojos(d);
      expect(b).toBeLessThanOrEqual(antes);
      antes = b;
    }
    expect(brilhoDespojos((DESPOJOS.perto + DESPOJOS.longe) / 2)).toBeCloseTo(0.5, 6);
  });

  it('15: quando o rei de Sodoma faz a oferta, Abrão (no dízimo) está perto o bastante para ver o brilho', () => {
    const [dx, dz] = MAPA_CANAA.pontos.dizimo;
    const [px, pz] = MAPA_CANAA.pontos.despojosSave;
    expect(brilhoDespojos(Math.hypot(dx - px, dz - pz))).toBeGreaterThan(0.75);
    // e a pilha (até ~4,5 m do centro) não encobre o interativo do dízimo (raio 3)
    expect(Math.hypot(dx - px, dz - pz)).toBeGreaterThan(3 + 4.5);
  });

  it('15: em B3 os despojos brilham na tentação, a recusa vale mais que qualquer achado e nada prende o jogador', async () => {
    const v = mundoAtual;
    const [b1, b2, b3, b4] = MISSOES_ABRAAO;
    await jogarMissao(v, b1);
    await jogarMissao(v, b2);
    v.reg.xp.length = 0;
    let acesosNaProva: boolean | null = null;
    await jogarMissao(v, b3, 'auto', novoEstado(b3.id), (c) => {
      const prova = c.prova.bind(c);
      c.prova = (def) => {
        acesosNaProva = v.canaa.despojosVisiveis && v.canaa.despojosAcesos;
        return prova(def);
      };
    });
    expect(acesosNaProva).toBe(true);
    // a recusa: XP de "resistir a uma tentação" (DESIGN §6), acima do maior prêmio por achar algo
    expect(v.reg.xp.filter(([, f]) => f === 'prova')).toEqual([['abraao', 'prova', undefined]]);
    expect(XP.prova).toBe(60);
    expect(XP.prova).toBeGreaterThan(XP.segredo);
    // B3 terminou sem ninguém se afastar: o brilho continua aceso e desbota só pela distância
    expect(v.canaa.despojosVisiveis).toBe(true);
    expect(v.canaa.despojosAcesos).toBe(true);
    // o carregar restaura os despojos pelas flags
    v.canaa.definirDespojos(false);
    v.canaa.acenderDespojos(false);
    reconstruirMundoAbraao(v.servicos, v.mundo as never, v.flags);
    expect([v.canaa.despojosVisiveis, v.canaa.despojosAcesos]).toEqual([true, true]);
    // o rei de Sodoma levou os seus bens (Gn 14:24): em Manre, nada de despojos
    await jogarMissao(v, b4);
    expect([v.canaa.despojosVisiveis, v.canaa.despojosAcesos]).toEqual([false, false]);
  });
});

describe('era de Abraão — atalhos de depuração', () => {
  it('jogam a era inteira só pelas APIs do jogo (sem nada se resolver sozinho)', async () => {
    const v = mundoAtual;
    let atual: { m: DefMissao; estado: EstadoMissao; ctx: CtxFalso | null } | null = null;
    const amb: AmbienteAtalhosAbraao = {
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
      for (const m of MISSOES_ABRAAO) {
        const estado = novoEstado(m.id);
        atual = { m, estado, ctx: null };
        await jogarMissao(v, m, 'eventos', estado, (c) => (atual!.ctx = c));
      }
    })();
    const atalhos = jogarEraAbraao(amb, { aoEtapa: (m, e) => etapas.push(`${m}.${e}`) });
    await Promise.all([historia, atalhos]);
    // todas as etapas em que o jogador age passaram pelos atalhos (as só de cinemática podem
    // terminar antes de o atalho vê-las)
    const comAcao = ['b1.altarMore', 'b1.acampar', 'b1.invocar', 'b2.separar', 'b2.pastores', 'b2.abraoELo', 'b2.percorrer', 'b2.manre',
      'b3.dividir', 'b3.ataque', 'b3.libertar', 'b3.melquisedeque', 'b3.nemUmFio', 'b4.fora', 'b4.duvida', 'b5.pe', 'b5.subida',
      'b5.altar', 'b5.carneiro'];
    for (const e of comAcao) expect(etapas, e).toContain(e);
    expect(atual!.estado).toMatchObject({ id: 'b5', status: 'concluida' });
    expect(v.reg.memorias).toContain('jeovaJire');
    expect(v.reg.creditos).toBe(1);
  }, 60_000);
});
