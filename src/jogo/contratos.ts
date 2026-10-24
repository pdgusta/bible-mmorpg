// =====================================================================================
// CONTRATOS ENTRE OS MÓDULOS
// Tipos e nomes de eventos compartilhados por: sistemas de história (Missões, Diálogos,
// Provas, Progresso, Salvamento), interface (UI), troca de personagem/câmera e o conteúdo
// das eras. Mudar algo aqui afeta vários módulos: combine antes.
// =====================================================================================
import type * as THREE from 'three';
import type { NomeAtributo, FonteXP } from './Atributos';
import type { NomeClasse } from './Classes';
import type { Personagem } from './Personagem';
import type { Mundo } from '../mundo/Mundo';
import type { NomeClipe } from '../entidades/humano/Animador';

// ------------------------------- Texto bíblico ---------------------------------------

/**
 * Referência no formato "Gn 6:14" ou "Gn 6:14-16" (abreviações da BKJ Fiel 1611 fornecida).
 * O texto NUNCA é digitado no código: vem de src/data/biblia/versiculos.json.
 */
export type Ref = string;

export interface Versiculo {
  ref: Ref;
  /** "Gênesis 6:14" */
  referenciaExtenso: string;
  bkj: string;
  nvt: string | null;
  kjv: string | null;
}

// ------------------------------- Diálogos --------------------------------------------

/**
 * Quem fala: id de personagem do mundo ('noe', 'sem', ...), ou um falante especial:
 * 'narrador' (texto do jogo, em itálico), 'deus' (voz de Deus: nunca aparece como figura),
 * 'anjo' (o Anjo do Senhor), 'satanas' (sussurro do tentador) ou um nome livre de NPC.
 */
export type Falante = string;

/** Fala com texto da Bíblia (BKJ), por referência. `trecho` deve ser substring EXATA do versículo. */
export interface LinhaBiblica {
  quem: Falante;
  ref: Ref;
  trecho?: string;
}

/** Fala que a Bíblia não registra: aparece com o selo "fala do jogo". Não pode contradizer o texto. */
export interface LinhaFiccao {
  quem: Falante;
  texto: string;
  /** Emoção para o retrato/animação (opcional). */
  emocao?: 'alegre' | 'triste' | 'preocupado' | 'firme' | 'irado' | 'reverente';
}

export type Linha = LinhaBiblica | LinhaFiccao;

export function ehBiblica(l: Linha): l is LinhaBiblica {
  return (l as LinhaBiblica).ref !== undefined;
}

export interface EfeitoEscolha {
  atributos?: Partial<Record<NomeAtributo, number>>;
  unidade?: number;
  flag?: string;
  xp?: number;
}

export interface OpcaoEscolha {
  texto: string;
  /** Exige um atributo mínimo (mostra a opção com o selo ✦ quando disponível). */
  requer?: { atributo: NomeAtributo; minimo: number };
  efeitos?: EfeitoEscolha;
  /** Falas que seguem a escolha. */
  resposta?: Linha[];
}

// ------------------------------- Provas espirituais ----------------------------------

export type TipoProva = 'tentacao' | 'ira' | 'medo' | 'duvida';

/**
 * Definição de uma prova (desafio espiritual vivido em mecânica):
 * - tentacao: "dardos" de mentira voam até o personagem; Domínio próprio é a barra;
 *   Q ("Está escrito") responde com um versículo já recebido; botão direito = Escudo da fé (se tiver).
 * - ira: zombarias sobem a ira; segurar R (orar em silêncio) acalma mas pausa o avanço;
 *   segurar E avança a mensagem (proclamar). Vence ao completar o avanço.
 * - medo: escuridão/tempestade; vinheta e tremor; orar (R) e encorajar aliados reduz; vence ao manter a calma pelo tempo.
 * - duvida: névoa de mentiras; lembrar memórias (teclas 1..n ou clique) acende estrelas; vence quando o céu enche.
 * Perder nunca altera a Bíblia: a prova recomeça ("a luta continua").
 */
export interface DefProva {
  id: string;
  tipo: TipoProva;
  titulo: string;
  /** Texto curto de instrução mostrado no início. */
  instrucao: string;
  /** Sussurros/zombarias (ficção do jogo). */
  mentiras: string[];
  /** Versículos disponíveis para "Está escrito" (precisam ter sido recebidos). */
  respostas?: Ref[];
  /** Duração alvo ou quantidade de progresso necessária. */
  alvo: number;
  /** Para 'duvida': ids de memórias que podem ser lembradas. */
  memorias?: string[];
  /** Personagem que passa pela prova (padrão: o ativo). */
  personagem?: string;
  /** Dificuldade 0..1 (velocidade dos dardos/zombarias). */
  intensidade?: number;
  /** Para 'medo': personagem que, por perto (≤ 6 m), faz a calma cair mais devagar (ex.: Isaque em B5). */
  aliado?: string;
}

export interface ResultadoProva {
  venceu: true;
  tentativas: number;
  tempo: number;
}

// ------------------------------- Memórias e armadura ---------------------------------

/** Memória de fidelidade: lembranças que atravessam as eras (Livro das Memórias). */
export interface DefMemoria {
  id: string;
  titulo: string;
  ref: Ref;
  era: string;
  descricao: string;
  /** Força ao ser lembrada numa prova de dúvida (estrelas acesas). 0 = não serve nas provas. */
  forca: number;
  /** Memória opcional (segredo de exploração): conta para o legado entre eras. */
  segredo?: boolean;
  /** Frase do jogo mostrada quando a memória é lembrada numa prova de dúvida. */
  frase?: string;
}

export type PecaArmadura = 'cinturao' | 'couraca' | 'calcado' | 'escudo' | 'capacete' | 'espada';

// ------------------------------- Missões ---------------------------------------------

export type TipoMissao = 'tutorial' | 'fisico' | 'cooperativo' | 'espiritual' | 'masmorra' | 'servico' | 'exploracao' | 'batalha';

/** Alvo marcado no mundo/bússola: ponto nomeado do mapa, coordenadas ou personagem. */
export type Alvo = string | [number, number] | { personagem: string } | { x: number; y: number; z: number };

export interface DefEtapa {
  id: string;
  /** Texto do objetivo (rastreador). Pode ser atualizado dentro de executar(). */
  objetivo: string;
  /**
   * Script da etapa. Deve ser idempotente ao ser reiniciado depois de carregar um save
   * (o mundo é reconstruído a partir das flags e a etapa atual roda de novo do começo).
   */
  executar(c: CtxMissao): Promise<void>;
}

export interface DefMissao {
  id: string;
  era: string;
  titulo: string;
  tipos: TipoMissao[];
  resumo: string;
  /** Referências principais (para o Diário). */
  refs: Ref[];
  etapas: DefEtapa[];
  recompensa?: { xp?: number; memoria?: string; armadura?: PecaArmadura };
  /** Missão seguinte iniciada automaticamente ao concluir. */
  proxima?: string;
}

export interface EstadoMissao {
  id: string;
  etapa: number;
  status: 'ativa' | 'concluida';
  contadores: Record<string, number>;
}

/** Contexto entregue aos scripts de etapa. Todas as esperas lançam se a missão for abortada. */
export interface CtxMissao {
  readonly missao: DefMissao;
  readonly estado: EstadoMissao;
  readonly sinal: AbortSignal;
  readonly mundo: Mundo;
  readonly flags: Record<string, unknown>;
  personagem(id: string): Personagem;
  ativo(): Personagem;

  // rastreamento
  objetivo(texto: string, alvos?: Alvo[]): void;
  contador(nome: string, valor?: number): number;

  // esperas
  esperar(segundos: number): Promise<void>;
  esperarFlag(nome: string): Promise<void>;
  esperarEvento<T = unknown>(nome: string, filtro?: (dados: T) => boolean): Promise<T>;
  /** Espera um personagem (id ou 'ativo') chegar perto de um alvo. */
  chegar(quem: string, alvo: Alvo, raio?: number): Promise<void>;
  /** Espera o interativo com este id ser usado (evento 'interacao'). Retorna quem usou. */
  interacao(id: string): Promise<Personagem>;

  // fala e texto
  dialogo(linhas: Linha[]): Promise<void>;
  escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[]): Promise<number>;
  versiculo(ref: Ref): void;
  dica(texto: string): void;
  aviso(texto: string): void;

  // cinemática
  cena<T>(fn: () => Promise<T>): Promise<T>;
  camera(pos: THREE.Vector3 | [number, number, number], alvo: THREE.Vector3 | [number, number, number], duracao: number): Promise<void>;
  cameraVoltar(duracao?: number): Promise<void>;
  /** Move um personagem (em cena) até o ponto. */
  mover(quem: string, alvo: Alvo, velocidade?: number): Promise<void>;
  animar(quem: string, clipe: NomeClipe, corpo?: 'todo' | 'superior'): Promise<void>;
  fade(paraPreto: boolean, duracao?: number): Promise<void>;
  titulo(texto: string, sub?: string): Promise<void>;

  // progresso
  xp(alvo: string | 'grupo', fonte: FonteXP, qtd?: number): void;
  treinar(personagem: string, atributo: NomeAtributo, qtd: number): void;
  memoria(id: string): void;
  armadura(peca: PecaArmadura): void;
  unidade(delta: number): void;
  receberVersiculo(ref: Ref): void;
  definirFlag(nome: string, valor?: unknown): void;
  disponivel(personagem: string, sim: boolean): void;

  // espiritual
  prova(def: DefProva): Promise<ResultadoProva>;
}

// ------------------------------- Personagens da era ----------------------------------

export interface InfoJogavel {
  id: string;
  classe: NomeClasse;
}

// ------------------------------- Interface (UI) --------------------------------------

/** O que a camada de interface oferece aos sistemas (implementada em src/ui). */
export interface InterfaceUI {
  /** Mostra falas em sequência; resolve quando o jogador avança a última. */
  dialogo(linhas: Linha[]): Promise<void>;
  /** Pergunta com opções; resolve com o índice escolhido. */
  escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[], podeEscolher: (o: OpcaoEscolha) => boolean): Promise<number>;
  /** Faixa discreta com versículo (não pausa o jogo). */
  bannerVersiculo(v: Versiculo): void;
  objetivo(titulo: string | null, texto: string | null): void;
  /** Interação disponível (null esconde). `pode=false` mostra a dica de quem pode. */
  prompt(info: { texto: string; tecla: string; pode: boolean; dica?: string; progresso?: number } | null): void;
  aviso(texto: string, tipo?: 'xp' | 'atributo' | 'memoria' | 'armadura' | 'info' | 'unidade' | 'nivel'): void;
  dica(texto: string): void;
  titulo(texto: string, sub?: string): Promise<void>;
  fade(paraPreto: boolean, duracao: number): Promise<void>;
  /** Barras pretas de cinema. */
  modoCinema(ativo: boolean): void;
  hud(estado: EstadoHUD): void;
  /** Overlay das provas espirituais (chamado a cada quadro durante a prova). */
  prova(estado: EstadoProvaUI | null): void;
  /** Roda de personagens (Tab). Resolve com o id escolhido ou null. */
  rodaPersonagens(itens: ItemRoda[]): Promise<string | null>;
  fecharRoda(): void;
  legendaTroca(texto: string | null): void;
  /** Marcadores de objetivo projetados na tela e na bússola. */
  marcadores(m: MarcadorTela[], yawCamera: number): void;
  menuAberto(): boolean;
}

export interface EstadoHUD {
  nome: string;
  classe: string;
  iconeClasse: string;
  nivel: number;
  xp: number;
  xpProximo: number;
  folego: number;
  folegoMax: number;
  dominio: number | null;
  dominioMax: number;
  unidade: number;
  hora: number;
  era: string;
  visivel: boolean;
}

export interface EstadoProvaUI {
  tipo: TipoProva;
  titulo: string;
  instrucao: string;
  /** 0..1 */
  progresso: number;
  /** 0..1 (domínio próprio / calma) */
  firmeza: number;
  /** Mentiras na tela: posição normalizada (0..1) e texto. */
  dardos: { id: number; x: number; y: number; texto: string; bloqueado: boolean }[];
  /** Versículo de "Está escrito" disponível (texto curto + ref) ou null. */
  palavra: { ref: string; texto: string; pronta: boolean } | null;
  escudo: boolean;
  /** `tecla`: 1..5 para as ainda não usadas (atalho de teclado). */
  memorias?: { id: string; titulo: string; usada: boolean; tecla?: number }[];
  mensagem?: string;
}

export interface ItemRoda {
  id: string;
  nome: string;
  classe: string;
  icone: string;
  atividade: string;
  disponivel: boolean;
  atual: boolean;
  /** Ângulo/ordem na roda (0..n-1) e tecla rápida. */
  tecla: number;
}

export interface MarcadorTela {
  id: string;
  /** Posição de mundo. */
  pos: THREE.Vector3;
  rotulo: string;
  tipo: 'objetivo' | 'personagem' | 'interativo';
}

// ------------------------------- Eventos (Jogo.eventos) ------------------------------
/**
 * Nomes de eventos emitidos no barramento `jogo.eventos`:
 * 'interacao'        { id: string; personagem: Personagem }         — um interativo foi usado
 * 'controle'         Personagem                                     — passou a controlar alguém
 * 'troca:inicio'     { de: string; para: string }
 * 'troca:fim'        { de: string; para: string }
 * 'missao:iniciada'  { id: string }
 * 'missao:etapa'     { id: string; etapa: number }
 * 'missao:concluida' { id: string }
 * 'flag'             { nome: string; valor: unknown }
 * 'xp'               { personagem: string; qtd: number; fonte: FonteXP }
 * 'nivel'            { personagem: string; nivel: number }
 * 'atributo'         { personagem: string; atributo: NomeAtributo; valor: number }
 * 'memoria'          { id: string }
 * 'armadura'         { peca: PecaArmadura }
 * 'unidade'          { valor: number; delta: number }
 * 'versiculo'        { ref: Ref }   — recebido (vai para o Diário)
 * 'prova:inicio'     { id: string; tipo: TipoProva; livre: boolean }   — livre: o jogador ainda anda e interage (medo)
 * 'prova:fim'        { id: string; resultado: ResultadoProva | null }  — null = prova cancelada
 * 'dialogo:inicio' / 'dialogo:fim'
 * 'area'             { id: string; personagem: string; dentro: boolean }
 * 'era:transicao'    { de: string; para: string }
 * 'salvo'            { slot: number }
 * 'habilidade'       { personagem: string; classe: NomeClasse }   — tecla Q usada fora de provas
 * 'oracao'           { personagem: string }                       — tecla R usada fora de provas
 */
export const EVENTOS = [
  'interacao', 'controle', 'troca:inicio', 'troca:fim', 'missao:iniciada', 'missao:etapa', 'missao:concluida',
  'flag', 'xp', 'nivel', 'atributo', 'memoria', 'armadura', 'unidade', 'versiculo', 'prova:inicio', 'prova:fim',
  'dialogo:inicio', 'dialogo:fim', 'area', 'era:transicao', 'salvo', 'habilidade', 'oracao',
] as const;

// ------------------------------- Save ------------------------------------------------

export interface DadosSave {
  versao: number;
  criadoEm: string;
  atualizadoEm: string;
  era: string;
  hora: number;
  ativo: string;
  flags: Record<string, unknown>;
  missoes: Record<string, EstadoMissao>;
  missaoAtual: string | null;
  personagens: Record<string, {
    pos: [number, number, number];
    yaw: number;
    disponivel: boolean;
    ficha: { atributos: Record<NomeAtributo, number>; xp: number; nivel: number; progresso: Partial<Record<NomeAtributo, number>> } | null;
    aprendidos: string[];
  }>;
  memorias: string[];
  armadura: PecaArmadura[];
  versiculos: Ref[];
  unidade: number;
  segredos: string[];
  estatisticas: Record<string, number>;
  tempoJogado: number;
}

export const VERSAO_SAVE = 1;
