// Progresso do jogador: XP e níveis por personagem, treino de atributos, memórias,
// Armadura de Deus, Unidade do grupo, versículos recebidos, segredos, estatísticas e
// tempo jogado. É o modelo; a interface só lê daqui (Diário, HUD) e recebe os avisos.
// As fichas ficam nos personagens (Personagem.ficha) e chegam aqui por um provedor.
import { ATRIBUTOS, NOMES_FONTE_XP, XP, type Ficha, type FonteXP, type NomeAtributo } from './Atributos';
import type { DadosSave, PecaArmadura, Ref } from './contratos';
import { MEMORIAS, type RegistroMemorias } from './Memorias';

export type TipoAviso = 'xp' | 'atributo' | 'memoria' | 'armadura' | 'info' | 'unidade' | 'nivel';

export interface EmissorEventos {
  emit(nome: string, dados?: unknown): void;
}

export interface DepsProgresso {
  eventos: EmissorEventos;
  /** Ficha de um personagem jogável (null se não existir ou não for jogável). */
  ficha(id: string): Ficha | null;
  /** Ids do grupo atual (jogáveis disponíveis), usados no XP 'grupo'. */
  grupo(): string[];
  /** Id do personagem controlado agora. */
  ativo?(): string | null;
  /** Nome de exibição ("Cam"). */
  nome?(id: string): string;
  /** Aviso discreto na tela (ligado a ui.aviso). */
  avisar?(texto: string, tipo: TipoAviso): void;
  /** Registro de memórias (padrão: o global). */
  memorias?: RegistroMemorias;
}

/** As seis peças da Armadura de Deus (Ef 6:14-17). */
export const ARMADURA: Record<PecaArmadura, { nome: string; ref: Ref; efeito: string }> = {
  cinturao: { nome: 'Cinturão da verdade', ref: 'Ef 6:14', efeito: 'Revela as mentiras.' },
  couraca: { nome: 'Couraça da justiça', ref: 'Ef 6:14', efeito: 'Protege o Domínio próprio das acusações.' },
  calcado: { nome: 'Calçado da paz', ref: 'Ef 6:15', efeito: 'A Unidade cai menos nas contendas.' },
  escudo: { nome: 'Escudo da fé', ref: 'Ef 6:16', efeito: 'Segure o botão direito para apagar os dardos de mentira.' },
  capacete: { nome: 'Capacete da salvação', ref: 'Ef 6:17', efeito: 'O medo pesa menos.' },
  espada: { nome: 'Espada do Espírito', ref: 'Ef 6:17', efeito: '"Está escrito" (Q): responde a uma mentira com um versículo já recebido.' },
};

export const UNIDADE_INICIAL = 60;
/** A partir deste valor a Unidade é "alta": +20% de XP de cooperação (Ec 4:12). */
export const UNIDADE_ALTA = 75;
export const BONUS_UNIDADE = 0.2;

export type DadosProgresso = Pick<DadosSave, 'memorias' | 'armadura' | 'versiculos' | 'unidade' | 'segredos' | 'estatisticas' | 'tempoJogado' | 'lidos'>;

/** Leitura mínima de um capítulo (s) para contar como lido e render XP de disciplina. */
export const LEITURA_MINIMA = 60;
/** Intervalo entre dois XP de disciplina por leitura (s de jogo). */
export const INTERVALO_DISCIPLINA = 300;

export class Progresso {
  unidade = UNIDADE_INICIAL;
  /** Ids das memórias guardadas, na ordem em que foram recebidas. */
  memorias: string[] = [];
  armadura: PecaArmadura[] = [];
  /** Versículos recebidos (Diário → Escrituras), na ordem. */
  versiculos: Ref[] = [];
  segredos: string[] = [];
  estatisticas: Record<string, number> = {};
  /** Segundos de jogo. */
  tempoJogado = 0;
  /** Capítulos lidos no Diário ("Gn 6"). */
  lidos: string[] = [];
  private leitura: Record<string, number> = {};
  private ultimaDisciplina = -Infinity;
  private readonly deps: DepsProgresso;

  constructor(deps: DepsProgresso) {
    this.deps = deps;
  }

  private get registro(): RegistroMemorias {
    return this.deps.memorias ?? MEMORIAS;
  }

  private nome(id: string): string {
    return this.deps.nome?.(id) ?? id;
  }

  private avisar(texto: string, tipo: TipoAviso) {
    this.deps.avisar?.(texto, tipo);
  }

  private idsAlvo(alvo: string | string[]): string[] {
    if (Array.isArray(alvo)) return alvo;
    if (alvo === 'grupo') return this.deps.grupo();
    if (alvo === 'ativo') {
      const a = this.deps.ativo?.();
      return a ? [a] : [];
    }
    return [alvo];
  }

  /** A Unidade está alta o bastante para o bônus de cooperação? */
  get unidadeAlta(): boolean {
    return this.unidade >= UNIDADE_ALTA;
  }

  // ------------------------------------------------------------------ XP

  /**
   * Dá XP a um personagem, a vários, ao 'grupo' (jogáveis disponíveis) ou ao 'ativo'.
   * Sem `qtd`, usa o valor padrão da fonte. Devolve o XP dado a cada um.
   */
  ganharXP(alvo: string | string[], fonte: FonteXP, qtd?: number): number {
    const base = qtd ?? XP[fonte];
    const bonus = fonte === 'cooperacao' && this.unidadeAlta;
    const total = Math.max(0, Math.round(base * (bonus ? 1 + BONUS_UNIDADE : 1)));
    if (total <= 0) return 0;
    const recebidos: string[] = [];
    for (const id of this.idsAlvo(alvo)) {
      const ficha = this.deps.ficha(id);
      if (!ficha) continue;
      const antes = ficha.nivel;
      ficha.ganharXP(total);
      recebidos.push(id);
      this.deps.eventos.emit('xp', { personagem: id, qtd: total, fonte });
      if (ficha.nivel > antes) {
        this.deps.eventos.emit('nivel', { personagem: id, nivel: ficha.nivel });
        this.avisar(`${this.nome(id)} alcançou o nível ${ficha.nivel}`, 'nivel');
      }
    }
    if (!recebidos.length) return 0;
    this.contar('xp', total * recebidos.length);
    const quem = recebidos.length > 1 ? ' para o grupo' : recebidos[0] !== this.deps.ativo?.() ? ` para ${this.nome(recebidos[0])}` : '';
    this.avisar(`+${total} XP${quem} — ${NOMES_FONTE_XP[fonte]}${bonus ? ' (Unidade +20%)' : ''}`, 'xp');
    return total;
  }

  // ------------------------------------------------------------------ atributos

  /** Treina um atributo pelo uso (Ficha.treinar). Devolve true se o atributo subiu um ponto. */
  treinar(id: string, atributo: NomeAtributo, qtd: number): boolean {
    const ficha = this.deps.ficha(id);
    if (!ficha || qtd <= 0) return false;
    if (!ficha.treinar(atributo, qtd)) return false;
    this.anunciarAtributo(id, atributo, ficha.atributos[atributo]);
    return true;
  }

  /** Soma pontos inteiros a um atributo (efeitos de escolha, legado entre eras). Limita a 1..10. */
  somarAtributo(id: string, atributo: NomeAtributo, pontos: number): number {
    const ficha = this.deps.ficha(id);
    if (!ficha) return 0;
    const antes = ficha.atributos[atributo];
    const depois = Math.max(1, Math.min(10, Math.round(antes + pontos)));
    if (depois === antes) return antes;
    ficha.atributos[atributo] = depois;
    this.anunciarAtributo(id, atributo, depois, depois - antes);
    return depois;
  }

  private anunciarAtributo(id: string, atributo: NomeAtributo, valor: number, delta = 1) {
    this.deps.eventos.emit('atributo', { personagem: id, atributo, valor });
    const sinal = delta > 0 ? '▲' : '▼';
    this.avisar(`${this.nome(id)}: ${ATRIBUTOS[atributo].nome} ${sinal} ${valor}`, 'atributo');
  }

  // ------------------------------------------------------------------ memórias, armadura, versículos

  temMemoria(id: string): boolean {
    return this.memorias.includes(id);
  }

  /** Guarda uma memória de fidelidade. Devolve false se já estava guardada. */
  memoria(id: string): boolean {
    if (this.temMemoria(id)) return false;
    const def = this.registro.obter(id);
    if (!def) console.warn(`Memória não registrada: ${id}`);
    this.memorias.push(id);
    this.contar('memorias');
    if (def?.segredo) this.segredo(id);
    this.deps.eventos.emit('memoria', { id });
    this.avisar(`Memória guardada: ${def?.titulo ?? id}`, 'memoria');
    // A fé cresce guardando memórias (DESIGN §4).
    const ativo = this.deps.ativo?.();
    if (ativo) this.treinar(ativo, 'fe', 0.4);
    return true;
  }

  temArmadura(peca: PecaArmadura): boolean {
    return this.armadura.includes(peca);
  }

  /** Recebe uma peça da Armadura de Deus. Devolve false se já a tinha. */
  receberArmadura(peca: PecaArmadura): boolean {
    if (this.temArmadura(peca)) return false;
    this.armadura.push(peca);
    this.deps.eventos.emit('armadura', { peca });
    this.avisar(`Armadura de Deus: ${ARMADURA[peca].nome}`, 'armadura');
    return true;
  }

  temVersiculo(ref: Ref): boolean {
    return this.versiculos.includes(ref);
  }

  /** Registra um versículo recebido (vai para o Diário). Devolve false se já estava lá. */
  receberVersiculo(ref: Ref): boolean {
    if (this.temVersiculo(ref)) return false;
    this.versiculos.push(ref);
    this.contar('versiculos');
    this.deps.eventos.emit('versiculo', { ref });
    return true;
  }

  /** Marca um segredo de exploração como achado. Devolve false se já estava. */
  segredo(id: string): boolean {
    if (this.segredos.includes(id)) return false;
    this.segredos.push(id);
    this.contar('segredos');
    return true;
  }

  /** Quantos segredos achados pertencem a uma era (pelas memórias registradas). */
  segredosDaEra(era: string): number {
    return this.segredos.filter((id) => this.registro.obter(id)?.era === era).length;
  }

  // ------------------------------------------------------------------ Unidade

  /**
   * Muda a Unidade do grupo (0..100). Com o Calçado da paz, as quedas valem metade.
   * Devolve o novo valor.
   */
  alterarUnidade(delta: number): number {
    if (!delta) return this.unidade;
    const d = delta < 0 && this.temArmadura('calcado') ? delta * 0.5 : delta;
    const novo = Math.max(0, Math.min(100, this.unidade + d));
    const real = novo - this.unidade;
    if (real === 0) return this.unidade;
    this.unidade = novo;
    this.deps.eventos.emit('unidade', { valor: novo, delta: real });
    const r = Math.round(real);
    if (r !== 0) this.avisar(`Unidade ${r > 0 ? '+' : ''}${r}`, 'unidade');
    return novo;
  }

  // ------------------------------------------------------------------ meditar

  /**
   * Leitura no Diário (DESIGN §8): cresce a Sabedoria do ativo; um capítulo lido por
   * LEITURA_MINIMA segundos conta como lido e rende XP de disciplina (com intervalo).
   */
  meditar(segundos: number, cap: { livro: string; capitulo: number }) {
    if (!(segundos > 0)) return;
    const nome = `${cap.livro} ${cap.capitulo}`;
    const total = (this.leitura[nome] ?? 0) + segundos;
    this.leitura[nome] = total;
    this.contar('leitura', segundos);
    const ativo = this.deps.ativo?.();
    if (ativo) this.treinar(ativo, 'sabedoria', segundos / 240);
    if (total >= LEITURA_MINIMA && !this.lidos.includes(nome)) {
      this.lidos.push(nome);
      if (ativo && this.tempoJogado - this.ultimaDisciplina >= INTERVALO_DISCIPLINA) {
        this.ultimaDisciplina = this.tempoJogado;
        this.ganharXP(ativo, 'disciplina');
      }
    }
  }

  // ------------------------------------------------------------------ estatísticas e tempo

  contar(nome: string, n = 1) {
    this.estatisticas[nome] = (this.estatisticas[nome] ?? 0) + n;
  }

  /** Chamado a cada quadro (fora da pausa). */
  atualizar(dt: number) {
    this.tempoJogado += dt;
  }

  // ------------------------------------------------------------------ save

  serializar(): DadosProgresso {
    return {
      memorias: [...this.memorias],
      armadura: [...this.armadura],
      versiculos: [...this.versiculos],
      unidade: this.unidade,
      segredos: [...this.segredos],
      estatisticas: { ...this.estatisticas },
      tempoJogado: this.tempoJogado,
      lidos: [...this.lidos],
    };
  }

  /** Restaura sem emitir eventos nem avisos. */
  restaurar(d: Partial<DadosProgresso>) {
    this.memorias = [...(d.memorias ?? [])];
    this.armadura = [...(d.armadura ?? [])];
    this.versiculos = [...(d.versiculos ?? [])];
    this.unidade = typeof d.unidade === 'number' ? Math.max(0, Math.min(100, d.unidade)) : UNIDADE_INICIAL;
    this.segredos = [...(d.segredos ?? [])];
    this.estatisticas = { ...(d.estatisticas ?? {}) };
    this.tempoJogado = d.tempoJogado ?? 0;
    this.lidos = [...(d.lidos ?? [])];
    this.leitura = {};
    this.ultimaDisciplina = -Infinity;
  }

  /** Novo jogo. */
  reiniciar() {
    this.restaurar({});
  }
}
