// Salvamento: 3 espaços + 'auto', exportar/importar .json e migração por `versao`.
// Persistência em IndexedDB (sem dependências), com localStorage como reserva; o adaptador é
// injetável (os testes usam ArmazenamentoMemoria). O DadosSave é montado a partir do
// Progresso, das Missões, das flags e de um provedor de personagens (posição, ficha,
// disponibilidade). Aplicar um save (reconstruir o mundo pelas flags, recriar personagens)
// é do orquestrador; aqui ficam os auxiliares para isso.
import { Ficha, ORDEM_ATRIBUTOS, type NomeAtributo } from './Atributos';
import type { Verbo } from './Classes';
import { VERSAO_SAVE, type DadosSave, type EstadoMissao } from './contratos';
import type { DadosProgresso } from './Progresso';

export type Slot = 1 | 2 | 3 | 'auto';
export const SLOTS: Slot[] = [1, 2, 3, 'auto'];

function chaveSlot(s: Slot): string {
  return s === 'auto' ? 'auto' : `slot${s}`;
}

export class ErroSave extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ErroSave';
  }
}

// =====================================================================================
// Armazenamento
// =====================================================================================

export interface AdaptadorArmazenamento {
  readonly nome: string;
  ler(chave: string): Promise<string | null>;
  escrever(chave: string, valor: string): Promise<void>;
  apagar(chave: string): Promise<void>;
}

/** Em memória (testes, ou quando o navegador não deixa guardar nada). */
export class ArmazenamentoMemoria implements AdaptadorArmazenamento {
  readonly nome = 'memoria';
  readonly dados = new Map<string, string>();
  async ler(chave: string) {
    return this.dados.get(chave) ?? null;
  }
  async escrever(chave: string, valor: string) {
    this.dados.set(chave, valor);
  }
  async apagar(chave: string) {
    this.dados.delete(chave);
  }
}

/** localStorage (reserva). */
export class ArmazenamentoLocal implements AdaptadorArmazenamento {
  readonly nome = 'localStorage';
  private readonly ls: Storage;
  private readonly prefixo: string;
  constructor(ls: Storage, prefixo = 'a-semente:') {
    this.ls = ls;
    this.prefixo = prefixo;
  }
  async ler(chave: string) {
    return this.ls.getItem(this.prefixo + chave);
  }
  async escrever(chave: string, valor: string) {
    this.ls.setItem(this.prefixo + chave, valor);
  }
  async apagar(chave: string) {
    this.ls.removeItem(this.prefixo + chave);
  }
}

const LOJA_IDB = 'saves';

/** IndexedDB: banco 'a-semente', loja 'saves' (chave → texto JSON). */
export class ArmazenamentoIndexedDB implements AdaptadorArmazenamento {
  readonly nome = 'indexeddb';
  private readonly db: IDBDatabase;

  private constructor(db: IDBDatabase) {
    this.db = db;
  }

  static abrir(nomeBanco = 'a-semente', fabrica: IDBFactory = indexedDB, limiteMs = 3000): Promise<ArmazenamentoIndexedDB> {
    return new Promise((resolver, rejeitar) => {
      const tempo = setTimeout(() => rejeitar(new Error('IndexedDB não respondeu')), limiteMs);
      let req: IDBOpenDBRequest;
      try {
        req = fabrica.open(nomeBanco, 1);
      } catch (e) {
        clearTimeout(tempo);
        rejeitar(e);
        return;
      }
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(LOJA_IDB)) req.result.createObjectStore(LOJA_IDB);
      };
      req.onsuccess = () => {
        clearTimeout(tempo);
        resolver(new ArmazenamentoIndexedDB(req.result));
      };
      req.onerror = () => {
        clearTimeout(tempo);
        rejeitar(req.error ?? new Error('Falha ao abrir o IndexedDB'));
      };
      req.onblocked = () => {
        clearTimeout(tempo);
        rejeitar(new Error('IndexedDB bloqueado por outra aba'));
      };
    });
  }

  private pedir<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolver, rejeitar) => {
      const tx = this.db.transaction(LOJA_IDB, modo);
      const r = fn(tx.objectStore(LOJA_IDB));
      tx.oncomplete = () => resolver(r.result);
      tx.onerror = () => rejeitar(tx.error ?? r.error ?? new Error('Falha no IndexedDB'));
      tx.onabort = () => rejeitar(tx.error ?? new Error('Transação abortada'));
    });
  }

  async ler(chave: string) {
    const v = await this.pedir('readonly', (l) => l.get(chave));
    return typeof v === 'string' ? v : null;
  }
  async escrever(chave: string, valor: string) {
    await this.pedir('readwrite', (l) => l.put(valor, chave));
  }
  async apagar(chave: string) {
    await this.pedir('readwrite', (l) => l.delete(chave));
  }
}

/** Usa o primário; se ele falhar, a reserva (ex.: IndexedDB → localStorage). */
export class ArmazenamentoComReserva implements AdaptadorArmazenamento {
  readonly primario: AdaptadorArmazenamento;
  readonly reserva: AdaptadorArmazenamento;
  constructor(primario: AdaptadorArmazenamento, reserva: AdaptadorArmazenamento) {
    this.primario = primario;
    this.reserva = reserva;
  }
  get nome() {
    return `${this.primario.nome}+${this.reserva.nome}`;
  }
  async ler(chave: string) {
    try {
      const v = await this.primario.ler(chave);
      if (v !== null) return v;
    } catch (e) {
      console.warn(`Leitura do save falhou em ${this.primario.nome}; usando ${this.reserva.nome}.`, e);
    }
    return this.reserva.ler(chave);
  }
  async escrever(chave: string, valor: string) {
    try {
      await this.primario.escrever(chave, valor);
    } catch (e) {
      console.warn(`Gravação do save falhou em ${this.primario.nome}; usando ${this.reserva.nome}.`, e);
      await this.reserva.escrever(chave, valor);
    }
  }
  async apagar(chave: string) {
    await Promise.allSettled([this.primario.apagar(chave), this.reserva.apagar(chave)]);
  }
}

function localStorageUsavel(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = '__a-semente-teste__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

/** O melhor armazenamento disponível: IndexedDB (com reserva em localStorage), localStorage ou memória. */
export async function criarArmazenamento(): Promise<AdaptadorArmazenamento> {
  const ls = localStorageUsavel();
  if (typeof indexedDB !== 'undefined') {
    try {
      const idb = await ArmazenamentoIndexedDB.abrir();
      return ls ? new ArmazenamentoComReserva(idb, new ArmazenamentoLocal(ls)) : idb;
    } catch (e) {
      console.warn('IndexedDB indisponível; usando localStorage.', e);
    }
  }
  if (ls) return new ArmazenamentoLocal(ls);
  console.warn('Sem armazenamento persistente: o progresso só dura até fechar a página.');
  return new ArmazenamentoMemoria();
}

// =====================================================================================
// Migração e validação
// =====================================================================================

/** Migrações: MIGRACOES[n] leva um save da versão n para n+1. */
export const MIGRACOES: Record<number, (d: Record<string, any>) => Record<string, any>> = {
  // 0 → 1: saves sem número de versão (protótipo). Os campos ausentes são completados em normalizar().
  0: (d) => ({ ...d }),
};

const ehObjeto = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const listaTextos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const numero = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);

function normalizarMissoes(v: unknown): Record<string, EstadoMissao> {
  if (v === undefined) return {};
  if (!ehObjeto(v)) throw new ErroSave('Save inválido: "missoes" não é um objeto.');
  const out: Record<string, EstadoMissao> = {};
  for (const [id, e] of Object.entries(v)) {
    if (!ehObjeto(e)) throw new ErroSave(`Save inválido: missão "${id}" malformada.`);
    const contadores: Record<string, number> = {};
    if (ehObjeto(e.contadores)) for (const [k, n] of Object.entries(e.contadores)) if (typeof n === 'number') contadores[k] = n;
    out[id] = {
      id,
      etapa: Math.max(0, Math.floor(numero(e.etapa, 0))),
      status: e.status === 'concluida' ? 'concluida' : 'ativa',
      contadores,
    };
  }
  return out;
}

function normalizarFicha(v: unknown): DadosSave['personagens'][string]['ficha'] {
  if (!ehObjeto(v)) return null;
  const atributos = {} as Record<NomeAtributo, number>;
  for (const a of ORDEM_ATRIBUTOS) atributos[a] = Math.max(1, Math.min(10, numero(v.atributos?.[a], 3)));
  const progresso: Partial<Record<NomeAtributo, number>> = {};
  if (ehObjeto(v.progresso)) for (const a of ORDEM_ATRIBUTOS) if (typeof v.progresso[a] === 'number') progresso[a] = v.progresso[a];
  return { atributos, xp: Math.max(0, numero(v.xp, 0)), nivel: Math.max(1, Math.floor(numero(v.nivel, 1))), progresso };
}

function normalizarPersonagens(v: unknown): DadosSave['personagens'] {
  if (v === undefined) return {};
  if (!ehObjeto(v)) throw new ErroSave('Save inválido: "personagens" não é um objeto.');
  const out: DadosSave['personagens'] = {};
  for (const [id, p] of Object.entries(v)) {
    if (!ehObjeto(p)) throw new ErroSave(`Save inválido: personagem "${id}" malformado.`);
    const pos = Array.isArray(p.pos) && p.pos.length === 3 && p.pos.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))
      ? (p.pos as [number, number, number])
      : null;
    if (!pos) throw new ErroSave(`Save inválido: posição de "${id}".`);
    out[id] = {
      pos: [pos[0], pos[1], pos[2]],
      yaw: numero(p.yaw, 0),
      disponivel: p.disponivel !== false,
      ficha: normalizarFicha(p.ficha),
      aprendidos: listaTextos(p.aprendidos),
    };
  }
  return out;
}

/** Completa e confere um save já na versão atual. Lança ErroSave se estiver malformado. */
function normalizar(d: Record<string, any>): DadosSave {
  const agora = new Date().toISOString();
  if (d.era !== undefined && typeof d.era !== 'string') throw new ErroSave('Save inválido: "era".');
  if (d.flags !== undefined && !ehObjeto(d.flags)) throw new ErroSave('Save inválido: "flags".');
  const missoes = normalizarMissoes(d.missoes);
  const atual = typeof d.missaoAtual === 'string' ? d.missaoAtual : null;
  const estatisticas: Record<string, number> = {};
  if (ehObjeto(d.estatisticas)) for (const [k, n] of Object.entries(d.estatisticas)) if (typeof n === 'number') estatisticas[k] = n;
  return {
    versao: VERSAO_SAVE,
    criadoEm: typeof d.criadoEm === 'string' ? d.criadoEm : agora,
    atualizadoEm: typeof d.atualizadoEm === 'string' ? d.atualizadoEm : agora,
    era: d.era ?? 'noe',
    hora: numero(d.hora, 9),
    ativo: typeof d.ativo === 'string' ? d.ativo : '',
    flags: { ...(d.flags ?? {}) },
    missoes,
    missaoAtual: atual,
    personagens: normalizarPersonagens(d.personagens),
    memorias: listaTextos(d.memorias),
    armadura: listaTextos(d.armadura) as DadosSave['armadura'],
    versiculos: listaTextos(d.versiculos),
    unidade: Math.max(0, Math.min(100, numero(d.unidade, 60))),
    segredos: listaTextos(d.segredos),
    estatisticas,
    tempoJogado: Math.max(0, numero(d.tempoJogado, 0)),
    lidos: listaTextos(d.lidos),
  };
}

/** Leva um save de qualquer versão conhecida para a atual. Lança ErroSave se não der. */
export function migrarSave(bruto: unknown): DadosSave {
  if (!ehObjeto(bruto)) throw new ErroSave('Save inválido: o conteúdo não é um objeto JSON.');
  let d: Record<string, any> = { ...bruto };
  let v = d.versao === undefined ? 0 : d.versao;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new ErroSave(`Save inválido: versão "${String(v)}".`);
  if (v > VERSAO_SAVE) throw new ErroSave(`Este save é de uma versão mais nova do jogo (${v}; esta versão lê até ${VERSAO_SAVE}).`);
  while (v < VERSAO_SAVE) {
    const m = MIGRACOES[v];
    if (!m) throw new ErroSave(`Não há migração do save versão ${v}.`);
    d = m(d);
    v++;
    d.versao = v;
  }
  return normalizar(d);
}

/** Lê o texto de um arquivo de save (JSON) e migra. */
export function lerSave(texto: string): DadosSave {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new ErroSave('Arquivo de save inválido: não é JSON.');
  }
  return migrarSave(bruto);
}

// =====================================================================================
// Personagens e flags (auxiliares para o orquestrador)
// =====================================================================================

/** O que o save lê de um personagem (Personagem satisfaz). */
export interface PersonagemSalvavel {
  readonly id: string;
  readonly posicao: { x: number; y: number; z: number };
  yaw: number;
  disponivel: boolean;
  ficha: Ficha | null;
  aprendidos: readonly string[];
}

/** O que é preciso para aplicar o save num personagem já criado (Personagem satisfaz). */
export interface PersonagemAplicavel {
  disponivel: boolean;
  ficha: Ficha | null;
  aprendidos: Verbo[];
  teleportar(x: number, y: number, z: number, yaw?: number): void;
}

/** Monta DadosSave.personagens com os jogáveis (quem tem ficha). */
export function personagensParaSave(lista: Iterable<PersonagemSalvavel>): DadosSave['personagens'] {
  const out: DadosSave['personagens'] = {};
  for (const p of lista) {
    if (!p.ficha) continue;
    out[p.id] = {
      pos: [p.posicao.x, p.posicao.y, p.posicao.z],
      yaw: p.yaw,
      disponivel: p.disponivel,
      ficha: p.ficha.serializar(),
      aprendidos: [...p.aprendidos],
    };
  }
  return out;
}

/** Aplica posição, ficha, disponibilidade e verbos aprendidos aos personagens já criados. */
export function aplicarPersonagens(dados: DadosSave['personagens'], obter: (id: string) => PersonagemAplicavel | null | undefined) {
  for (const [id, d] of Object.entries(dados)) {
    const p = obter(id);
    if (!p) continue;
    p.teleportar(d.pos[0], d.pos[1], d.pos[2], d.yaw);
    p.disponivel = d.disponivel;
    if (d.ficha) p.ficha = Ficha.restaurar(d.ficha);
    p.aprendidos = [...d.aprendidos] as Verbo[];
  }
}

/** Troca o conteúdo das flags mantendo o mesmo objeto (outros módulos guardam a referência). */
export function restaurarFlags(destino: Record<string, unknown>, origem: Record<string, unknown>) {
  for (const k of Object.keys(destino)) delete destino[k];
  Object.assign(destino, origem);
}

// =====================================================================================
// Salvamento
// =====================================================================================

export interface FontesSave {
  progresso: { serializar(): DadosProgresso };
  missoes: { serializar(): { missoes: Record<string, EstadoMissao>; missaoAtual: string | null } };
  flags(): Record<string, unknown>;
  personagens(): DadosSave['personagens'];
  era(): string;
  hora(): number;
  ativo(): string;
  eventos?: { emit(nome: string, dados?: unknown): void };
  /** Relógio (testes). */
  agora?(): Date;
  /** Nomes para o menu Carregar ("Era 1 — Noé", "A viga mestra", "Noé"). */
  nomeEra?(id: string): string;
  nomeMissao?(id: string): string;
  nomePersonagem?(id: string): string;
}

/** Resumo de um espaço para o menu (mesma forma do InfoSlot da UI, mais os ids). */
export interface ResumoSlot {
  slot: Slot;
  vazio: boolean;
  /** Nome da era ("Era 1 — Noé"), ou o id se não houver nome. */
  era?: string;
  /** Título da missão atual. */
  missao?: string;
  /** Nome do personagem ativo. */
  personagem?: string;
  eraId?: string;
  ativo?: string;
  missaoAtual?: string | null;
  atualizadoEm?: string;
  tempoJogado?: number;
  memorias?: number;
  /** Save ilegível (corrompido ou de versão mais nova). */
  erro?: string;
}

export class Salvamento {
  readonly armazenamento: AdaptadorArmazenamento;
  private readonly fontes: FontesSave;
  /** Quando o jogo atual começou (mantido entre saves da mesma partida). */
  criadoEm: string | null = null;
  private fila: Promise<unknown> = Promise.resolve();

  constructor(armazenamento: AdaptadorArmazenamento, fontes: FontesSave) {
    this.armazenamento = armazenamento;
    this.fontes = fontes;
  }

  private agora(): string {
    return (this.fontes.agora?.() ?? new Date()).toISOString();
  }

  /** Novo jogo: zera a data de criação. */
  novoJogo() {
    this.criadoEm = null;
  }

  /** Foto do estado atual do jogo. */
  montar(): DadosSave {
    const f = this.fontes;
    const agora = this.agora();
    this.criadoEm ??= agora;
    const m = f.missoes.serializar();
    const p = f.progresso.serializar();
    return {
      versao: VERSAO_SAVE,
      criadoEm: this.criadoEm,
      atualizadoEm: agora,
      era: f.era(),
      hora: f.hora(),
      ativo: f.ativo(),
      flags: JSON.parse(JSON.stringify(f.flags() ?? {})),
      missoes: m.missoes,
      missaoAtual: m.missaoAtual,
      personagens: f.personagens(),
      memorias: [...p.memorias],
      armadura: [...p.armadura],
      versiculos: [...p.versiculos],
      unidade: p.unidade,
      segredos: [...p.segredos],
      estatisticas: { ...p.estatisticas },
      tempoJogado: p.tempoJogado,
      lidos: [...(p.lidos ?? [])],
    };
  }

  /** Grava um DadosSave num espaço (as gravações entram em fila, uma de cada vez). */
  gravar(slot: Slot, dados: DadosSave): Promise<DadosSave> {
    const texto = JSON.stringify(dados);
    const tarefa = this.fila.then(async () => {
      await this.armazenamento.escrever(chaveSlot(slot), texto);
      this.fontes.eventos?.emit('salvo', { slot: slot === 'auto' ? 0 : slot });
      return dados;
    });
    this.fila = tarefa.catch(() => undefined);
    return tarefa;
  }

  /** Salva o estado atual num espaço. */
  salvar(slot: Slot): Promise<DadosSave> {
    return this.gravar(slot, this.montar());
  }

  /**
   * Autosave (fronteiras de etapa, fim de missão). A foto é tirada na hora da chamada;
   * a gravação vai para a fila. Erros só geram aviso no console.
   */
  autosave(motivo = ''): Promise<DadosSave | null> {
    let dados: DadosSave;
    try {
      dados = this.montar();
    } catch (e) {
      console.warn(`Autosave (${motivo}) falhou ao montar o save.`, e);
      return Promise.resolve(null);
    }
    return this.gravar('auto', dados).catch((e) => {
      console.warn(`Autosave (${motivo}) falhou.`, e);
      return null;
    });
  }

  /** Espera as gravações pendentes. */
  async aguardar(): Promise<void> {
    await this.fila;
  }

  /** Lê um espaço (migrado para a versão atual) ou null se estiver vazio. Não aplica nada. */
  async carregar(slot: Slot): Promise<DadosSave | null> {
    await this.fila;
    const texto = await this.armazenamento.ler(chaveSlot(slot));
    if (texto === null) return null;
    const d = lerSave(texto);
    this.criadoEm = d.criadoEm;
    return d;
  }

  async apagar(slot: Slot): Promise<void> {
    await this.fila;
    await this.armazenamento.apagar(chaveSlot(slot));
  }

  /** Resumo dos espaços para o menu Carregar. */
  async listar(): Promise<ResumoSlot[]> {
    await this.fila;
    const out: ResumoSlot[] = [];
    for (const slot of SLOTS) {
      let texto: string | null = null;
      try {
        texto = await this.armazenamento.ler(chaveSlot(slot));
      } catch (e) {
        out.push({ slot, vazio: false, erro: String((e as Error)?.message ?? e) });
        continue;
      }
      if (texto === null) {
        out.push({ slot, vazio: true });
        continue;
      }
      try {
        const d = lerSave(texto);
        const f = this.fontes;
        const r: ResumoSlot = {
          slot, vazio: false, era: f.nomeEra?.(d.era) ?? d.era, eraId: d.era, ativo: d.ativo, missaoAtual: d.missaoAtual,
          atualizadoEm: d.atualizadoEm, tempoJogado: d.tempoJogado, memorias: d.memorias.length,
        };
        if (d.missaoAtual) r.missao = f.nomeMissao?.(d.missaoAtual) ?? d.missaoAtual;
        if (d.ativo) r.personagem = f.nomePersonagem?.(d.ativo) ?? d.ativo;
        out.push(r);
      } catch (e) {
        out.push({ slot, vazio: false, erro: (e as Error).message });
      }
    }
    return out;
  }

  /** Texto JSON de um save (para baixar como .json). */
  exportar(dados: DadosSave): string {
    return JSON.stringify(dados, null, 2);
  }

  /** JSON do que está num espaço (null se vazio). */
  async exportarSlot(slot: Slot): Promise<string | null> {
    const d = await this.carregar(slot);
    return d ? this.exportar(d) : null;
  }

  /** Lê um .json exportado (migrando se preciso) e, se pedido, grava num espaço. */
  async importar(texto: string, slot?: Slot): Promise<DadosSave> {
    const d = lerSave(texto);
    if (slot !== undefined) await this.gravar(slot, d);
    return d;
  }

  /** Baixa o que está num espaço como arquivo .json (navegador). Devolve false se vazio. */
  async baixar(slot: Slot): Promise<boolean> {
    const texto = await this.exportarSlot(slot);
    if (texto === null) return false;
    const quando = (JSON.parse(texto).atualizadoEm ?? '').slice(0, 10);
    baixarSave(texto, `a-semente-${slot === 'auto' ? 'auto' : `espaco${slot}`}${quando ? `-${quando}` : ''}.json`);
    return true;
  }

  /** Importa um arquivo .json (File/Blob) para um espaço. */
  async importarArquivo(arquivo: Blob, slot: Slot): Promise<DadosSave> {
    return this.importar(await arquivo.text(), slot);
  }
}

/** Baixa um save como arquivo .json (navegador). */
export function baixarSave(texto: string, nome = 'a-semente-save.json') {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
