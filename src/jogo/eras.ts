// Registro das eras jogáveis. Cada era diz como montar o seu mundo e os seus personagens,
// liga os serviços que as missões dela usam, reconstrói o mundo pelas flags (carregar um
// save) e informa o áudio de área. O fluxo (título, novo jogo, carregar, transição) fica
// em Partida.ts; a ligação de cada era fica em ligacao/<era>.ts.
import type { Jogo } from './Jogo';
import type { UI } from '../ui/UI';
import type { SistemasHistoria } from './Missoes';
import type { Mundo } from '../mundo/Mundo';
import type { DefMemoria, DefMissao, Ref } from './contratos';
import type { DefPersonagem } from './Personagem';
import type { AmbienteEra, PonteAudio } from './ligacao/audio';
import { ERA_NOE_JOGO } from './ligacao/noe';
import { ERA_ABRAAO_JOGO } from './ligacao/abraao';

/** O que o orquestrador entrega a uma era ao montá-la. */
export interface ContextoEra {
  jogo: Jogo;
  ui: UI;
  s: SistemasHistoria;
  audio: PonteAudio;
  /** Transição para a era seguinte (a missão final da era chama isto pelos serviços). */
  transicaoEra(genealogia: string[]): Promise<void>;
  /** Desbloqueia uma entrada "Aponta para Cristo" no Diário. */
  cristo(id: string): void;
}

/** Câmera da tela de título: órbita lenta em volta de um ponto. */
export interface VistaTitulo {
  centro: [number, number, number];
  raio: number;
  /** Altura da câmera acima do centro. */
  altura: number;
  hora: number;
  /** rad/s (padrão 0,025). */
  velocidade?: number;
}

/** Opções dos atalhos de depuração (o orquestrador decide como vencer provas e esperar). */
export interface OpcoesAtalhos {
  /** Vence a prova em andamento (o e2e pode adiar para tirar uma foto). */
  resolverProva(): boolean;
  /** Espera tempo de jogo. */
  esperar(segundos: number): Promise<void>;
  /** Quanto esperar (s de jogo) por algo antes de desistir. */
  limite?: number;
}

export interface AtalhosEra {
  /** Joga da missão atual até `ate` (id de missão, sem jogá-la) ou até o fim da era. */
  jogar(opts?: { ate?: string; aoEtapa?: (missao: string, etapa: string) => void }): Promise<void>;
}

/** Uma era montada (o mundo existe; os personagens, depois de `criarPersonagens`). */
export interface EraAtiva {
  readonly def: DefEra;
  readonly mundo: Mundo;
  /** O mundo já foi mexido por missões: para voltar ao começo, monte outro. */
  sujo: boolean;
  /** Cria os personagens da era nas posições iniciais (depois de `jogo.definirMundo`). */
  criarPersonagens(): void;
  /** Novo jogo num mundo limpo: todos voltam ao começo (posição, rotina, mãos vazias). */
  posicoesIniciais(): void;
  /** Liga os serviços das missões e o que vale a era inteira (segredos, pontos extras). */
  ligar(): void;
  /** Reconstrói o mundo pelo estado atual das flags (carregar, novo jogo). */
  reconstruir(): void;
  vistaTitulo(): VistaTitulo;
  /** Ambiente sonoro por área/estado neste quadro (null: nada a dizer). */
  ambiente(): AmbienteEra | null;
  /** Desfaz o que `ligar` fez (troca de era, mundo descartado). */
  desligar(): void;
  /** Atalhos de depuração (e2e, ?dev&missao=). */
  atalhos?(op: OpcoesAtalhos): AtalhosEra;
}

export interface EntradaCristoEra {
  id: string;
  titulo: string;
  refs: Ref[];
  texto: string;
  /** Missão que completa a entrada (revelada em partes). */
  completaEm?: string;
}

/** Definição de uma era (dados + montagem). */
export interface DefEra {
  id: string;
  /** "Era 1 — Noé" */
  nome: string;
  /** "Gênesis 6–9" */
  sub: string;
  protagonista: string;
  missaoInicial: string;
  /** Jogáveis na ordem da troca (teclas 1–5). */
  jogaveis: DefPersonagem[];
  npcs: DefPersonagem[];
  missoes: DefMissao[];
  memorias: DefMemoria[];
  cristo: EntradaCristoEra[];
  /** Depois da última missão: a era seguinte e a missão por onde ela começa. */
  seguinte?: { era: string; missao: string };
  /** Texto da tela de carregamento enquanto o mundo é erguido. */
  textoCarregamento: string;
  /** Hora do dia ao chegar pela transição de era. */
  horaChegada?: number;
  /** Monta o mundo (pesado: o orquestrador mostra a tela de carregamento antes). */
  criar(ctx: ContextoEra): EraAtiva | Promise<EraAtiva>;
}

/** Todas as eras, na ordem da história. */
export const ERAS: Record<string, DefEra> = {
  noe: ERA_NOE_JOGO,
  abraao: ERA_ABRAAO_JOGO,
};

export const ORDEM_ERAS = ['noe', 'abraao'];

export function defEra(id: string): DefEra {
  const d = ERAS[id];
  if (!d) throw new Error(`Era desconhecida: ${id}`);
  return d;
}

export const NOMES_ERAS: Record<string, string> = Object.fromEntries(Object.values(ERAS).map((e) => [e.id, e.nome]));
