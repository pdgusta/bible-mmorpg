// Tipos públicos da camada de interface (UI): serviços que a UI consome, ações que ela
// dispara (menus, saves, leitura) e os dados do Diário. A implementação está em UI.ts.
import type { DefMemoria, Falante, PecaArmadura, Ref, TipoMissao } from '../jogo/contratos';
import type { NomeAtributo } from '../jogo/Atributos';
import type { NomeClasse } from '../jogo/Classes';
import type { Qualidade } from '../render/Renderizador';

// ------------------------------- Serviços (injetados) --------------------------------

/** Texto de uma referência, como a UI o exibe. Nunca é digitado no código: vem de versiculos.json. */
export interface TextoRef {
  /** Texto BKJ a mostrar (o trecho validado, ou o versículo inteiro). */
  texto: string;
  /** "Gênesis 6:14" */
  extenso: string;
  nvt: string | null;
  kjv: string | null;
}

export interface CapituloUI {
  livro: string;
  capitulo: number;
  versos: number;
  /** "Gênesis 6" */
  titulo: string;
}

export interface VersoUI {
  numero: number;
  ref: Ref;
  bkj: string;
}

/** Aparência do retrato de um falante no diálogo (sem imagem: monograma com o ícone da classe). */
export interface RetratoUI {
  classe?: NomeClasse | null;
  /** Cor de fundo do retrato (CSS). */
  cor?: string;
  /** Letra do monograma (padrão: inicial do nome). */
  inicial?: string;
}

/** O que a UI precisa do resto do jogo. Veja `servicosBiblia()` em servicos.ts para a versão padrão. */
export interface ServicosUI {
  /** Texto de uma referência ("Gn 6:14" ou "Gn 7:2-3"); `trecho` deve ser substring exata da BKJ. Pode lançar. */
  versiculo(ref: Ref, trecho?: string): TextoRef;
  /** Nome exibido de um falante ('noe' → "Noé"; 'deus' → "Deus"; 'narrador' → ""). */
  nomeDe(falante: Falante): string;
  /** Retrato do falante (opcional). */
  retratoDe?(falante: Falante): RetratoUI | null;
  /** Capítulos disponíveis para leitura (Diário → Leitura). */
  capitulos?(): CapituloUI[];
  /** Versos de um capítulo de leitura. */
  capitulo?(livro: string, capitulo: number): VersoUI[];
}

// ------------------------------- Ações (callbacks) -----------------------------------

/** Espaço de save (igual a `Slot` de src/jogo/Salvamento.ts): 1..3 manuais e 'auto'. */
export type IdSlot = 1 | 2 | 3 | 'auto';

export interface InfoSlot {
  slot: IdSlot;
  vazio: boolean;
  /** "Era 1 — Noé" */
  era?: string;
  /** Missão atual ("A2 — A viga mestra"). */
  missao?: string;
  /** Nome do personagem ativo. */
  personagem?: string;
  /** Segundos jogados. */
  tempoJogado?: number;
  /** ISO 8601. */
  atualizadoEm?: string;
  /** Memórias guardadas. */
  memorias?: number;
  /** Save ilegível (corrompido ou de versão mais nova). */
  erro?: string;
}

export interface Configuracoes {
  qualidade: Qualidade;
  /** Multiplicador da sensibilidade do mouse (1 = padrão). */
  sensibilidade: number;
  inverterY: boolean;
  /** 0..1 */
  volumeMusica: number;
  /** 0..1 */
  volumeEfeitos: number;
  mostrarFPS: boolean;
}

export const CONFIG_PADRAO: Configuracoes = {
  qualidade: 'medio',
  sensibilidade: 1,
  inverterY: false,
  volumeMusica: 0.7,
  volumeEfeitos: 0.8,
  mostrarFPS: false,
};

/**
 * Ações que a UI dispara. Todas são opcionais: o que não estiver ligado aparece desabilitado
 * (ex.: sem `listarSlots`, a tela de slots mostra só "Nenhum save disponível").
 */
export interface AcoesUI {
  novoJogo?(): void;
  continuar?(): void;
  carregar?(slot: IdSlot): void | Promise<void>;
  salvar?(slot: IdSlot): void | Promise<void>;
  /** Baixa o save como arquivo .json. */
  exportar?(slot: IdSlot): void | Promise<void>;
  /** Importa um arquivo .json para o espaço indicado. */
  importar?(arquivo: File, slot: IdSlot): void | Promise<void>;
  listarSlots?(): InfoSlot[] | Promise<InfoSlot[]>;
  /** Chamado a cada mudança nas configurações (já salvas no navegador pela UI). */
  configuracoes?(c: Configuracoes): void;
  sairParaTitulo?(): void;
  /** O menu de pausa foi fechado com "Continuar" (ou Esc). */
  retomar?(): void;
  /** Um menu/diário/roda abriu (true) ou todos fecharam (false). Use para pausar o jogo. */
  menu?(aberto: boolean): void;
  /** Tempo de leitura no Diário (chamado a cada ~10 s de leitura e ao fechar o capítulo). */
  leitura?(segundos: number, cap: { livro: string; capitulo: number }): void;
  /** Clique numa memória durante a prova de dúvida (além das teclas 1..n). */
  lembrarMemoria?(id: string): void;
  /** Clique no "Está escrito" durante uma prova (além da tecla Q). */
  estaEscrito?(): void;
}

// ------------------------------- Diário ----------------------------------------------

export interface MissaoDiario {
  id: string;
  titulo: string;
  status: 'ativa' | 'concluida';
  resumo: string;
  /** Objetivo atual (missões ativas). */
  objetivo?: string | null;
  refs: Ref[];
  tipos?: TipoMissao[];
  /** Id da era ('noe', 'abraao'). */
  era?: string;
}

export interface EscrituraDiario {
  ref: Ref;
  /** Nota curta do jogo (exibida marcada como nota, nunca como texto bíblico). */
  nota?: string;
  era?: string;
}

/** Entrada "Aponta para Cristo" (texto do jogo, marcado como nota, ligando AT e NT). */
export interface CristoDiario {
  id: string;
  titulo: string;
  refs: Ref[];
  /** 2–4 frases do jogo. */
  texto: string;
  /** Parcial até se completar numa era posterior (ex.: a Semente, completa em B5). */
  completo?: boolean;
  era?: string;
}

export interface MemoriaDiario extends DefMemoria {
  obtida: boolean;
}

export interface PersonagemDiario {
  id: string;
  nome: string;
  classe: NomeClasse;
  nivel: number;
  xp: number;
  xpProximo: number;
  atributos: Record<NomeAtributo, number>;
  /** Progresso fracionário até o próximo ponto (0..1). */
  progresso?: Partial<Record<NomeAtributo, number>>;
  disponivel: boolean;
  atual?: boolean;
  /** Quem é, em uma frase. */
  descricao?: string;
  /** Referência principal ("Gn 6:9"). */
  ref?: Ref;
}

export interface DadosDiario {
  /** Nomes das eras por id ({ noe: 'Era 1 — Noé' }). */
  eras: Record<string, string>;
  missoes: MissaoDiario[];
  escrituras: EscrituraDiario[];
  cristo: CristoDiario[];
  memorias: MemoriaDiario[];
  personagens: PersonagemDiario[];
  armadura: PecaArmadura[];
  /** Unidade do grupo (0..100). */
  unidade: number;
  /** Capítulos já lidos ("Gn 6"). */
  lidos: string[];
  /** Linhas do legado entre eras ("Legado de Noé: +1 Fé"). */
  legado: string[];
}

export type AbaDiario = 'missoes' | 'escrituras' | 'leitura' | 'memorias' | 'personagens' | 'ajuda';

export const DIARIO_VAZIO: DadosDiario = {
  eras: { noe: 'Era 1 — Noé', abraao: 'Era 2 — Abraão' },
  missoes: [],
  escrituras: [],
  cristo: [],
  memorias: [],
  personagens: [],
  armadura: [],
  unidade: 50,
  lidos: [],
  legado: [],
};
