// Provas espirituais: desafios de caráter vividos em mecânica (DESIGN §6, contratos DefProva).
//   tentacao — dardos de mentira vêm até o personagem e ferem o Domínio próprio. Q ("Está
//              escrito", exige a Espada e um versículo de `respostas` já recebido) desfaz o
//              dardo mais próximo e avança. O botão direito ergue o Escudo da fé (se tiver).
//   ira      — zombarias sobem a ira. Segurar E proclama (avança), segurar R ora em silêncio:
//              acalma, mas pausa o avanço. Com a ira alta demais, a mensagem trava.
//   medo     — a calma cai com o tempo e com os relâmpagos. R (orar) e encorajar a família
//              (interativos 'encorajar*') recuperam; o Capacete reduz a queda. Vence ao somar
//              `alvo` segundos firmes. O jogador continua andando.
//   duvida   — mentiras escurecem a noite. Lembrar memórias (teclas 1..5 ou clique) acende
//              estrelas pela força de cada uma. Vence quando o céu tem `alvo` estrelas.
// Perder nunca altera a Bíblia nem pune duro: "A luta continua" e a prova recomeça.
// Atributos que pesam: domínio (dano), fé (estrelas, escudo), coragem (medo),
// comunhão (oração, sussurros mais fracos), discernimento (mentiras mais lentas),
// perseverança (proclamar).
import type { Acao } from '../core/Entrada';
import type { Atributos, NomeAtributo } from './Atributos';
import { extenso, versiculo } from './Biblia';
import type { DefProva, EstadoProvaUI, InterfaceUI, Ref, ResultadoProva, TipoProva } from './contratos';
import { MEMORIAS, type RegistroMemorias } from './Memorias';
import type { Progresso } from './Progresso';

export interface EntradaProva {
  ativa(a: Acao): boolean;
  pressionou(a: Acao): boolean;
}

/** O que a prova precisa de um personagem (Personagem satisfaz). */
export interface PersonagemProva {
  readonly id: string;
  ficha: { atributos: Atributos; nivel: number } | null;
  readonly classe?: string | null;
  readonly posicao?: { x: number; y: number; z: number };
  modVelocidade?: number;
}

export interface DepsProvas {
  ui: Pick<InterfaceUI, 'prova'>;
  entrada: EntradaProva;
  eventos: { emit(nome: string, dados?: unknown): void; on(nome: string, fn: (dados: any) => void): () => void };
  progresso: Progresso;
  /** Personagem da prova pelo id; sem id, o ativo. */
  personagem(id?: string): PersonagemProva | null;
  memorias?: RegistroMemorias;
  /** Texto de um versículo (padrão: BKJ de versiculos.json). */
  textoVersiculo?(ref: Ref): string;
  /** Gerador aleatório 0..1 (testes usam um determinístico). */
  aleatorio?(): number;
}

interface Dardo {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  texto: string;
  bloqueado: boolean;
  /** Segundos até sumir depois de bloqueado/desfeito. */
  vida: number;
}

interface Execucao {
  def: DefProva;
  personagem: PersonagemProva | null;
  /** Avanço absoluto (0..alvo): mentiras respondidas, segundos, estrelas. */
  valor: number;
  /** 0..1: domínio próprio (tentação), 1 − ira (ira), calma (medo), luz (dúvida). */
  firmeza: number;
  dardos: Dardo[];
  proximoDardo: number;
  tempo: number;
  tentativas: number;
  fase: 'jogando' | 'derrota' | 'vitoria';
  faseTempo: number;
  mensagem: string | null;
  mensagemTempo: number;
  recarga: number;
  indicePalavra: number;
  indiceMentira: number;
  usadas: Set<string>;
  reusoMemorias: number;
  encorajados: Set<string>;
  proximoRelampago: number;
  /** Medo: maior avanço já firmado (volta para ele ao perder). */
  pontoFirme: number;
  modVelocidade: number | undefined;
  avisoTrava: number;
  resolver(r: ResultadoProva): void;
  rejeitar(e: unknown): void;
}

const CENTRO_X = 0.5;
const CENTRO_Y = 0.55;
const RAIO_SURGIR = 0.5;
const RAIO_ACERTO = 0.07;
const CARENCIA = 1.5;
const DURACAO_DERROTA = 2.5;
const DURACAO_VITORIA = 1.2;
const DURACAO_MENSAGEM = 2.4;
const DISTANCIA_ALIADO = 6;

const FIRMEZA_INICIAL: Record<TipoProva, number> = { tentacao: 1, ira: 1, medo: 0.75, duvida: 0.7 };
const MAX_DARDOS: Record<TipoProva, number> = { tentacao: 4, ira: 3, medo: 2, duvida: 3 };

const VITORIA: Record<TipoProva, string> = {
  tentacao: 'A mentira se desfez.',
  ira: 'A mensagem foi entregue com brandura.',
  medo: 'A calma veio de Deus.',
  duvida: 'O céu se encheu de estrelas.',
};

const DERROTA: Record<TipoProva, string> = {
  tentacao: 'A luta continua. Responda com o que Deus já falou (Q).',
  ira: 'A luta continua. Ore em silêncio (segure R) e recomece.',
  medo: 'A luta continua. Ore (segure R) e encoraje os seus.',
  duvida: 'A névoa voltou. A luta continua: lembre-se do que Deus já fez.',
};

const TECLAS_MEMORIA: Acao[] = ['troca1', 'troca2', 'troca3', 'troca4', 'troca5'];

function abortado(): Error {
  const e = new Error('Prova cancelada');
  e.name = 'AbortError';
  return e;
}

function limitar(v: number, a = 0, b = 1) {
  return v < a ? a : v > b ? b : v;
}

/** Corta um texto longo numa fronteira de palavra (para a faixa "Está escrito"). */
export function textoCurto(t: string, max = 120): string {
  if (t.length <= max) return t;
  const corte = t.lastIndexOf(' ', max - 1);
  return `${t.slice(0, corte > max * 0.6 ? corte : max - 1).replace(/[\s,;:]+$/, '')}…`;
}

export class Provas {
  private readonly deps: DepsProvas;
  private ex: Execucao | null = null;
  private proximoId = 1;

  constructor(deps: DepsProvas) {
    this.deps = deps;
    // Encorajar na prova de medo: interativos 'encorajar_<id>' ou o evento 'prova:encorajar'.
    deps.eventos.on('interacao', (d: { id?: string; personagem?: { id?: string } } | undefined) => {
      if (d?.id && d.id.startsWith('encorajar')) this.encorajar(d.id);
    });
    deps.eventos.on('prova:encorajar', (d: { id?: string } | undefined) => this.encorajar(d?.id));
  }

  /** Há uma prova em andamento? (troca de personagem, Q/R/E normais e diálogos ficam suspensos). */
  get emProva(): boolean {
    return this.ex !== null;
  }

  /** Definição da prova em andamento. */
  ativa(): DefProva | null {
    return this.ex?.def ?? null;
  }

  private get rnd(): () => number {
    return this.deps.aleatorio ?? Math.random;
  }

  private get registro(): RegistroMemorias {
    return this.deps.memorias ?? MEMORIAS;
  }

  /** Começa uma prova. Resolve quando for vencida (perder recomeça; nunca rejeita, salvo cancelar()). */
  iniciar(def: DefProva): Promise<ResultadoProva> {
    if (this.ex) return Promise.reject(new Error(`Já há uma prova em andamento: ${this.ex.def.id}`));
    if (!(def.alvo > 0)) return Promise.reject(new Error(`Prova "${def.id}" com alvo inválido (${def.alvo})`));
    if ((def.tipo === 'tentacao' || def.tipo === 'ira') && !def.mentiras.length) console.warn(`Prova "${def.id}" sem mentiras/zombarias.`);
    if (def.tipo === 'tentacao') {
      const p = this.deps.progresso;
      if (!p.temArmadura('espada')) console.warn(`Prova "${def.id}": sem a Espada do Espírito o "Está escrito" não funciona.`);
      const respostas = def.respostas ?? [];
      if (!respostas.length) console.warn(`Prova "${def.id}" sem respostas para "Está escrito".`);
      else if (!respostas.some((r) => p.temVersiculo(r))) {
        // Erro de roteiro: nenhuma palavra foi recebida antes. Para não travar o jogador, recebe a primeira.
        console.warn(`Prova "${def.id}": nenhuma das respostas foi recebida antes; recebendo ${respostas[0]} para não travar.`);
        p.receberVersiculo(respostas[0]);
      }
    }
    return new Promise<ResultadoProva>((resolver, rejeitar) => {
      const personagem = this.deps.personagem(def.personagem) ?? null;
      const ex: Execucao = {
        def,
        personagem,
        valor: 0,
        firmeza: FIRMEZA_INICIAL[def.tipo],
        dardos: [],
        proximoDardo: CARENCIA,
        tempo: 0,
        tentativas: 1,
        fase: 'jogando',
        faseTempo: 0,
        mensagem: null,
        mensagemTempo: 0,
        recarga: 0,
        indicePalavra: 0,
        indiceMentira: Math.floor(this.rnd() * Math.max(1, def.mentiras.length)),
        usadas: new Set(),
        reusoMemorias: 0,
        encorajados: new Set(),
        proximoRelampago: 3 + this.rnd() * 3,
        pontoFirme: 0,
        modVelocidade: personagem?.modVelocidade,
        avisoTrava: 0,
        resolver,
        rejeitar,
      };
      this.ex = ex;
      this.deps.progresso.contar('provas');
      this.deps.eventos.emit('prova:inicio', { id: def.id, tipo: def.tipo, livre: def.tipo === 'medo' });
      this.deps.ui.prova(this.estado());
    });
  }

  // ------------------------------------------------------------------ quadro a quadro

  /** Chamado a cada quadro: lê a entrada, avança a prova e atualiza o overlay. */
  atualizar(dt: number) {
    const ex = this.ex;
    if (!ex) return;
    dt = Math.min(Math.max(dt, 0), 0.1);
    ex.tempo += dt;
    if (ex.mensagemTempo > 0) {
      ex.mensagemTempo -= dt;
      if (ex.mensagemTempo <= 0) ex.mensagem = null;
    }
    if (ex.fase === 'derrota') {
      ex.faseTempo -= dt;
      if (ex.faseTempo <= 0) this.recomecar(ex);
    } else if (ex.fase === 'vitoria') {
      ex.faseTempo -= dt;
      if (ex.faseTempo <= 0) {
        this.concluir(ex);
        return;
      }
    } else {
      ex.recarga = Math.max(0, ex.recarga - dt);
      ex.avisoTrava = Math.max(0, ex.avisoTrava - dt);
      switch (ex.def.tipo) {
        case 'tentacao': this.passoTentacao(ex, dt); break;
        case 'ira': this.passoIra(ex, dt); break;
        case 'medo': this.passoMedo(ex, dt); break;
        case 'duvida': this.passoDuvida(ex, dt); break;
      }
      ex.firmeza = limitar(ex.firmeza);
      if (ex.valor >= ex.def.alvo) this.vencer(ex);
      else if (ex.firmeza <= 0) this.perder(ex);
    }
    if (this.ex === ex) this.deps.ui.prova(this.estado());
  }

  private attr(ex: Execucao, a: NomeAtributo): number {
    return ex.personagem?.ficha?.atributos[a] ?? 5;
  }

  private tem(peca: Parameters<Progresso['temArmadura']>[0]) {
    return this.deps.progresso.temArmadura(peca);
  }

  private mensagem(ex: Execucao, texto: string, duracao = DURACAO_MENSAGEM) {
    ex.mensagem = texto;
    ex.mensagemTempo = duracao;
  }

  /** Proteção da Couraça da justiça contra as acusações. */
  private protecao(): number {
    return this.tem('couraca') ? 0.6 : 1;
  }

  // ------------------------------------------------------------------ dardos (mentiras)

  private velocidadeDardo(ex: Execucao): number {
    const int = ex.def.intensidade ?? 0.5;
    return (0.11 + 0.09 * int) * (1.1 - this.attr(ex, 'discernimento') * 0.03);
  }

  private intervaloDardo(ex: Execucao): number {
    const int = ex.def.intensidade ?? 0.5;
    return (2.8 - 1.4 * int) * (0.85 + this.rnd() * 0.3);
  }

  private gerarDardos(ex: Execucao, dt: number, escala = 1) {
    if (!ex.def.mentiras.length) return;
    ex.proximoDardo -= dt;
    if (ex.proximoDardo > 0) return;
    ex.proximoDardo = this.intervaloDardo(ex) / escala;
    if (ex.dardos.filter((d) => !d.bloqueado).length >= MAX_DARDOS[ex.def.tipo]) return;
    const ang = this.rnd() * Math.PI * 2;
    const x = limitar(CENTRO_X + Math.cos(ang) * RAIO_SURGIR, 0.04, 0.96);
    const y = limitar(CENTRO_Y + Math.sin(ang) * RAIO_SURGIR * 0.8, 0.06, 0.94);
    const dx = CENTRO_X - x;
    const dy = CENTRO_Y - y;
    const d = Math.hypot(dx, dy) || 1;
    const v = this.velocidadeDardo(ex) * escala;
    const m = ex.def.mentiras;
    // varia a ordem sem repetir a anterior
    ex.indiceMentira = (ex.indiceMentira + 1 + (m.length > 2 ? Math.floor(this.rnd() * (m.length - 1)) : 0)) % m.length;
    ex.dardos.push({ id: this.proximoId++, x, y, vx: (dx / d) * v, vy: (dy / d) * v, texto: m[ex.indiceMentira], bloqueado: false, vida: 0 });
  }

  private escudoErguido(): boolean {
    return this.tem('escudo') && this.deps.entrada.ativa('escudo');
  }

  /** Move os dardos; os que chegam ao personagem chamam `aoAcertar`, os que tocam o escudo somem. */
  private moverDardos(ex: Execucao, dt: number, aoAcertar: (d: Dardo) => void) {
    const escudo = this.escudoErguido();
    const raioEscudo = 0.15 + this.attr(ex, 'fe') * 0.006;
    const restantes: Dardo[] = [];
    for (const d of ex.dardos) {
      if (d.bloqueado) {
        d.vida -= dt;
        if (d.vida > 0) restantes.push(d);
        continue;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const dist = Math.hypot(d.x - CENTRO_X, d.y - CENTRO_Y);
      if (escudo && dist <= raioEscudo) {
        d.bloqueado = true;
        d.vida = 0.4;
        this.deps.progresso.contar('dardosBloqueados');
        restantes.push(d);
      } else if (dist <= RAIO_ACERTO) {
        aoAcertar(d);
      } else {
        restantes.push(d);
      }
    }
    ex.dardos = restantes;
  }

  private dardoMaisProximo(ex: Execucao): Dardo | null {
    let melhor: Dardo | null = null;
    let md = Infinity;
    for (const d of ex.dardos) {
      if (d.bloqueado) continue;
      const dist = Math.hypot(d.x - CENTRO_X, d.y - CENTRO_Y);
      if (dist < md) {
        md = dist;
        melhor = d;
      }
    }
    return melhor;
  }

  // ------------------------------------------------------------------ "Está escrito"

  /** Versículos de `respostas` já recebidos pelo jogador. */
  private palavras(ex: Execucao): Ref[] {
    return (ex.def.respostas ?? []).filter((r) => this.deps.progresso.temVersiculo(r));
  }

  private textoVersiculo(ref: Ref): string {
    try {
      return this.deps.textoVersiculo?.(ref) ?? versiculo(ref).bkj;
    } catch {
      return '';
    }
  }

  private palavraAtual(ex: Execucao): { ref: Ref; texto: string; pronta: boolean } | null {
    if (!this.tem('espada')) return null;
    const ps = this.palavras(ex);
    if (!ps.length) return null;
    const ref = ps[ex.indicePalavra % ps.length];
    return { ref, texto: textoCurto(this.textoVersiculo(ref)), pronta: ex.recarga <= 0 && ex.fase === 'jogando' };
  }

  /** Q: responde à mentira mais próxima com um versículo recebido. Devolve true se desfez um dardo. */
  private estaEscrito(ex: Execucao): boolean {
    if (ex.recarga > 0) return false;
    if (!this.tem('espada')) {
      this.mensagem(ex, 'Você ainda não recebeu a Espada do Espírito.');
      return false;
    }
    const ps = this.palavras(ex);
    if (!ps.length) {
      this.mensagem(ex, 'Nenhuma palavra recebida serve para responder a esta mentira.');
      return false;
    }
    const alvo = this.dardoMaisProximo(ex);
    if (!alvo) return false;
    const ref = ps[ex.indicePalavra % ps.length];
    ex.indicePalavra++;
    alvo.bloqueado = true;
    alvo.vida = 0.6;
    const profeta = ex.personagem?.classe === 'profeta' && (ex.personagem.ficha?.nivel ?? 1) >= 2;
    ex.recarga = 1.1 * (profeta ? 0.7 : 1);
    ex.firmeza += 0.05;
    this.mensagem(ex, `Está escrito — ${this.extensoSeguro(ref)}`, 1.6);
    this.deps.progresso.contar('estaEscrito');
    return true;
  }

  /** "Está escrito" na prova em andamento; na tentação, cada mentira desfeita é avanço. */
  private responderCom(ex: Execucao): boolean {
    if (!this.estaEscrito(ex)) return false;
    if (ex.def.tipo === 'tentacao') ex.valor += 1;
    return true;
  }

  /** "Está escrito" por clique na UI (o mesmo que Q). */
  responder(): boolean {
    const ex = this.ex;
    if (!ex || ex.fase !== 'jogando') return false;
    const ok = this.responderCom(ex);
    this.deps.ui.prova(this.estado());
    return ok;
  }

  private extensoSeguro(ref: Ref): string {
    try {
      return extenso(ref);
    } catch {
      return ref;
    }
  }

  // ------------------------------------------------------------------ tipos

  private passoTentacao(ex: Execucao, dt: number) {
    this.gerarDardos(ex, dt);
    const dano = 0.22 * (1.25 - this.attr(ex, 'dominio') * 0.05) * (1 - this.attr(ex, 'comunhao') * 0.02) * this.protecao();
    this.moverDardos(ex, dt, () => {
      ex.firmeza -= dano;
      this.deps.progresso.contar('mentirasSofridas');
    });
    // Comunhão com Deus recupera o domínio próprio.
    ex.firmeza += dt * 0.003 * this.attr(ex, 'comunhao');
    if (this.deps.entrada.pressionou('habilidade')) this.responderCom(ex);
  }

  private passoIra(ex: Execucao, dt: number) {
    const e = this.deps.entrada;
    const orando = e.ativa('orar');
    const proclamando = e.ativa('interagir') && !orando;
    this.gerarDardos(ex, dt, 1.2);
    const golpe = 0.14 * (1.3 - this.attr(ex, 'dominio') * 0.06) * (orando ? 0.5 : 1) * this.protecao();
    this.moverDardos(ex, dt, () => {
      ex.firmeza -= golpe;
    });
    if (orando) {
      ex.firmeza += dt * 0.18 * (1 + this.attr(ex, 'comunhao') * 0.05);
    } else if (proclamando) {
      if (ex.firmeza > 0.2) {
        ex.valor += dt * (0.9 + this.attr(ex, 'perseveranca') * 0.03);
        // responder no calor da hora esquenta: quem não para para orar trava (Pv 15:1)
        ex.firmeza -= dt * 0.06;
      } else if (ex.avisoTrava <= 0) {
        ex.avisoTrava = DURACAO_MENSAGEM;
        this.mensagem(ex, 'A ira trava a mensagem. Acalme-se antes (segure R).');
      }
    }
    if (e.pressionou('habilidade')) this.responderCom(ex);
  }

  private passoMedo(ex: Execucao, dt: number) {
    const int = ex.def.intensidade ?? 0.5;
    let fator = (1.25 - this.attr(ex, 'coragem') * 0.05) * (this.tem('capacete') ? 0.6 : 1);
    if (this.aliadoPerto(ex)) fator *= 0.6;
    fator *= 1 - Math.min(0.3, ex.encorajados.size * 0.1);
    ex.firmeza -= dt * (0.045 + 0.05 * int) * fator;
    ex.proximoRelampago -= dt;
    if (ex.proximoRelampago <= 0) {
      ex.proximoRelampago = 4 + this.rnd() * 4;
      ex.firmeza -= (0.06 + 0.06 * int) * fator;
      this.deps.eventos.emit('prova:relampago', { id: ex.def.id });
    }
    this.gerarDardos(ex, dt, 0.6);
    this.moverDardos(ex, dt, () => {
      ex.firmeza -= 0.05 * fator;
    });
    if (this.deps.entrada.ativa('orar')) ex.firmeza += dt * 0.16 * (1 + this.attr(ex, 'comunhao') * 0.05);
    if (this.deps.entrada.pressionou('habilidade')) this.responderCom(ex);
    if (ex.firmeza >= 0.35) {
      ex.valor += dt;
      const terco = ex.def.alvo / 3;
      ex.pontoFirme = Math.max(ex.pontoFirme, Math.floor(ex.valor / terco) * terco);
    }
    // O medo pesa nos passos (Coragem e calma aliviam).
    if (ex.personagem && ex.modVelocidade !== undefined) {
      ex.personagem.modVelocidade = ex.modVelocidade * (0.6 + 0.4 * limitar(ex.firmeza));
    }
  }

  private aliadoPerto(ex: Execucao): boolean {
    const id = ex.def.aliado;
    const a = ex.personagem?.posicao;
    if (!id || !a) return false;
    const b = this.deps.personagem(id)?.posicao;
    if (!b) return false;
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= DISTANCIA_ALIADO;
  }

  /** Memórias que podem ser lembradas nesta prova (guardadas e com força). */
  private memoriasDisponiveis(ex: Execucao): string[] {
    const p = this.deps.progresso;
    const base = ex.def.memorias ?? p.memorias;
    return base.filter((id) => p.temMemoria(id) && (this.registro.obter(id)?.forca ?? 0) > 0);
  }

  private passoDuvida(ex: Execucao, dt: number) {
    const e = this.deps.entrada;
    this.gerarDardos(ex, dt);
    const dano = 0.09 * (1.2 - this.attr(ex, 'discernimento') * 0.04) * this.protecao();
    this.moverDardos(ex, dt, () => {
      ex.firmeza -= dano;
      ex.valor = Math.max(0, ex.valor - 0.5);
    });
    const disponiveis = this.memoriasDisponiveis(ex);
    const livres = disponiveis.filter((id) => !ex.usadas.has(id));
    for (let i = 0; i < TECLAS_MEMORIA.length; i++) {
      if (e.pressionou(TECLAS_MEMORIA[i]) && livres[i]) {
        this.lembrar(livres[i]);
        break;
      }
    }
    if (e.ativa('orar')) {
      ex.firmeza += dt * 0.08 * (1 + this.attr(ex, 'comunhao') * 0.05);
      // Sem nenhuma memória para lembrar, a oração ainda acende o céu devagar.
      if (!disponiveis.length) ex.valor += dt * 0.4;
    }
    if (e.pressionou('habilidade')) this.responderCom(ex);
    // Todas lembradas e o céu ainda não encheu: elas podem ser lembradas de novo.
    if (disponiveis.length && !livres.length) {
      ex.reusoMemorias += dt;
      if (ex.reusoMemorias >= 2.5) {
        ex.reusoMemorias = 0;
        ex.usadas.clear();
        this.mensagem(ex, 'Lembre-se de novo do que Deus já fez.');
      }
    }
  }

  /** Lembra uma memória na prova de dúvida (teclas 1..5 ou clique na UI). */
  lembrar(id: string): boolean {
    const ex = this.ex;
    if (!ex || ex.def.tipo !== 'duvida' || ex.fase !== 'jogando') return false;
    if (ex.usadas.has(id) || !this.memoriasDisponiveis(ex).includes(id)) return false;
    const def = this.registro.obter(id);
    if (!def) return false;
    ex.usadas.add(id);
    ex.valor += def.forca * (1.2 + this.attr(ex, 'fe') * 0.06);
    ex.firmeza = limitar(ex.firmeza + 0.12 * def.forca);
    this.mensagem(ex, def.frase ?? `Lembrou: ${def.titulo}`, def.frase ? 4 : DURACAO_MENSAGEM);
    this.deps.progresso.contar('memoriasLembradas');
    return true;
  }

  /** Encorajamento na prova de medo (de um aliado ou para um aliado). */
  encorajar(quem = 'aliado'): boolean {
    const ex = this.ex;
    if (!ex || ex.def.tipo !== 'medo' || ex.fase !== 'jogando') return false;
    ex.firmeza = limitar(ex.firmeza + 0.2);
    ex.encorajados.add(quem);
    this.deps.progresso.contar('encorajamentos');
    return true;
  }

  // ------------------------------------------------------------------ fim

  private vencer(ex: Execucao) {
    ex.valor = ex.def.alvo;
    ex.fase = 'vitoria';
    ex.faseTempo = DURACAO_VITORIA;
    ex.dardos = ex.dardos.map((d) => ({ ...d, bloqueado: true, vida: 0.6 }));
    this.mensagem(ex, VITORIA[ex.def.tipo], DURACAO_VITORIA + 1);
  }

  private perder(ex: Execucao) {
    ex.fase = 'derrota';
    ex.faseTempo = DURACAO_DERROTA;
    ex.dardos = [];
    this.mensagem(ex, DERROTA[ex.def.tipo], DURACAO_DERROTA);
    this.deps.progresso.contar('provasPerdidas');
  }

  private recomecar(ex: Execucao) {
    ex.tentativas++;
    ex.fase = 'jogando';
    ex.firmeza = FIRMEZA_INICIAL[ex.def.tipo];
    ex.valor = ex.def.tipo === 'medo' ? ex.pontoFirme : 0;
    ex.dardos = [];
    ex.proximoDardo = CARENCIA;
    ex.recarga = 0;
    ex.usadas.clear();
    ex.encorajados.clear();
    ex.mensagem = null;
  }

  private limpar(ex: Execucao) {
    if (ex.personagem && ex.modVelocidade !== undefined) ex.personagem.modVelocidade = ex.modVelocidade;
    if (this.ex === ex) this.ex = null;
    this.deps.ui.prova(null);
  }

  private concluir(ex: Execucao) {
    const resultado: ResultadoProva = { venceu: true, tentativas: ex.tentativas, tempo: ex.tempo };
    this.limpar(ex);
    this.deps.progresso.contar('provasVencidas');
    this.deps.eventos.emit('prova:fim', { id: ex.def.id, resultado });
    ex.resolver(resultado);
  }

  /** Vence a prova em andamento na hora (atalhos de teste e e2e). */
  resolverAutomaticamente(): boolean {
    const ex = this.ex;
    if (!ex) return false;
    ex.valor = ex.def.alvo;
    this.concluir(ex);
    return true;
  }

  /** Cancela a prova em andamento (missão abortada). A promessa rejeita com AbortError. */
  cancelar() {
    const ex = this.ex;
    if (!ex) return;
    this.limpar(ex);
    this.deps.eventos.emit('prova:fim', { id: ex.def.id, resultado: null });
    ex.rejeitar(abortado());
  }

  /** Estado para o overlay (ui.prova). */
  estado(): EstadoProvaUI | null {
    const ex = this.ex;
    if (!ex) return null;
    const d = ex.def;
    const est: EstadoProvaUI = {
      tipo: d.tipo,
      titulo: d.titulo,
      instrucao: d.instrucao,
      progresso: limitar(ex.valor / d.alvo),
      firmeza: limitar(ex.firmeza),
      dardos: ex.dardos.map((x) => ({ id: x.id, x: x.x, y: x.y, texto: x.texto, bloqueado: x.bloqueado })),
      palavra: this.palavraAtual(ex),
      escudo: this.escudoErguido(),
    };
    if (d.tipo === 'duvida') {
      let tecla = 1;
      est.memorias = this.memoriasDisponiveis(ex).map((id) => {
        const usada = ex.usadas.has(id);
        const item: { id: string; titulo: string; usada: boolean; tecla?: number } = { id, titulo: this.registro.obter(id)?.titulo ?? id, usada };
        if (!usada && tecla <= TECLAS_MEMORIA.length) item.tecla = tecla++;
        return item;
      });
    }
    if (ex.mensagem) est.mensagem = ex.mensagem;
    return est;
  }
}
