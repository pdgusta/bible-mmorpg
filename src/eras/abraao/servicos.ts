// Serviços que as missões da era de Abraão usam além do CtxMissao. O orquestrador liga a
// implementação real com `ligarServicosAbraao(...)` antes de iniciar as missões; os testes ligam
// uma versão falsa. Cada grupo indica de qual módulo (agente) vem.
import type * as THREE from 'three';
import type { Acao } from '../../core/Entrada';
import type { FonteXP, NomeAtributo } from '../../jogo/Atributos';
import type { DefPersonagem, Personagem } from '../../jogo/Personagem';
import type { EstadoAltar, LugarAcampamento, NomeAltar, NomeCurral, NomePorteira, NomeTenda } from './construir';

/** Canaã (MundoCanaa, src/eras/abraao/construir.ts — agente canaa). `MundoCanaa` já satisfaz. */
export interface CanaaAbraao {
  readonly acampamento: LugarAcampamento | null;
  readonly cordaAmarrada: boolean;
  /** Mostra as tendas no lugar certo e atualiza os pontos 'acampamento', 'tendaAbrao', 'tendaSara', 'fogueiraAcampamento'. */
  definirAcampamento(lugar: LugarAcampamento | null): void;
  montarTenda(nome: NomeTenda, montada: boolean): void;
  abrirPorteira(nome: NomePorteira, aberta: boolean, instantaneo?: boolean): void;
  porteiraAberta(nome: NomePorteira): boolean;
  /** O ponto está dentro do curral? */
  dentroCurral(nome: NomeCurral, x: number, z: number): boolean;
  definirAltar(nome: NomeAltar, estado: EstadoAltar): void;
  estadoAltar(nome: NomeAltar): EstadoAltar;
  /** Tendas, fogueiras, cercado dos cativos e despojos em Dã (B3). */
  definirAcampamentoInimigo(visivel: boolean): void;
  /** Os despojos trazidos de volta, no vale de Savé (B3). */
  definirDespojos(visivel: boolean): void;
  /** Acende o brilho dos despojos; ele desbota sozinho conforme o jogador se afasta (ensinamento 15). */
  acenderDespojos(sim: boolean): void;
  /** Mostra a corda e ativa a escalada 'cordaMoria' (B5). */
  amarrarCordaMoria(sim: boolean): void;
  /** Discernir no fosso: 0 = normal, 1 = firmes douradas e soltas vermelhas. */
  revelarPedras(t: number): void;
  /** Chamado quando o personagem ativo cai no fosso (já foi devolvido ao 'estreitoMoria'). */
  aoCairFosso: ((p: Personagem) => void) | null;
}

/**
 * Céu (src/render/Ceu.ts — agente motor): propriedades lidas a cada quadro.
 * `estrelas` ainda não existe no Ceu: enquanto o motor não a ler, o céu de B4 só usa a noite.
 */
export interface CeuAbraao {
  hora: number;
  /** Luz dourada 0..1 (voz de Deus, o Anjo do Senhor). */
  gloria: number;
  /** Para o relógio do dia (noites de B3/B4, cinemáticas). */
  pausado: boolean;
  /** Estrelas extras 0..1: "conta as estrelas" (Gn 15:5) enche o céu. */
  estrelas?: number;
}

export type MusicaAbraao = 'calmo' | 'aventura' | 'prova' | 'gloria' | 'silencio' | 'batalha';

/** Áudio (agente animais+áudio). */
export interface AudioAbraao {
  ambiente(nome: string, intensidade: number): void;
  musica(nome: MusicaAbraao): void;
  efeito(nome: string): void;
}

/** Um animal (Animal de src/entidades/Animal.ts — agente animais), visto pelas missões. */
export interface AnimalAbraao {
  readonly especie: string;
  readonly posicao: THREE.Vector3;
  vagar(raio?: number): void;
  seguir(alvo: { posicao: THREE.Vector3 }, distancia?: number): void;
  /** Anda até (x, z); resolve ao chegar. */
  irPara(x: number, z: number): Promise<void>;
  teleportar(x: number, z: number, y?: number): void;
  /** Preso pelos chifres (Gn 22:13). */
  prender(): void;
  soltar(): void;
  /** Tira do mundo (com fade se `suave`). */
  remover(suave?: boolean): Promise<void>;
}

export interface OpcoesAnimalAbraao {
  y?: number;
  yaw?: number;
  sexo?: 'macho' | 'femea';
  /** Cor que multiplica a pelagem (lã escura das ovelhas de Ló). */
  tom?: string;
}

/** Rebanho com boids (src/entidades/Rebanho.ts — agente animais). `Rebanho` já satisfaz. */
export interface RebanhoAbraao {
  readonly animais: AnimalAbraao[];
  /** Posição viva de quem conduz (o bando foge dela). */
  pastor: THREE.Vector3 | null;
  adicionar(a: AnimalAbraao): void;
  remover(a: AnimalAbraao): void;
  /** Assobio do pastor: o bando se junta. */
  juntar(segundos?: number): void;
  conduzirPara(x: number | null, z?: number): void;
  seguirLider(lider: { posicao: THREE.Vector3 } | null, distancia?: number): void;
  dentroDe(area: (x: number, z: number) => boolean, filtro?: (a: AnimalAbraao) => boolean): number;
}

export interface AnimaisAbraao {
  /** `criarAnimal(especie, mundo, x, z, opts)` com o mundo de Canaã. */
  criar(especie: string, x: number, z: number, opts?: OpcoesAnimalAbraao): Promise<AnimalAbraao>;
  /** Novo rebanho com estes animais, já atualizado a cada quadro (`mundo.atualizaveis`). */
  rebanho(animais: AnimalAbraao[]): RebanhoAbraao;
  /** Para de atualizar o rebanho (os animais continuam no mundo). */
  soltarRebanho(r: RebanhoAbraao): void;
}

/** O que as missões leem/gravam no Progresso fora do CtxMissao (agente sistemas). `Progresso` já satisfaz. */
export interface ProgressoAbraao {
  readonly memorias: string[];
  readonly segredos: string[];
  readonly estatisticas: Record<string, number>;
  readonly tempoJogado: number;
  temMemoria(id: string): boolean;
  /** Guarda a memória (segredos contam para o legado). Devolve false se já estava. */
  memoria(id: string): boolean;
  ganharXP(alvo: string | string[], fonte: FonteXP, qtd?: number): number;
  /** Pontos inteiros num atributo (legado entre eras). */
  somarAtributo(id: string, atributo: NomeAtributo, pontos: number): number;
  /** Quantos segredos (memórias opcionais) de uma era foram achados. */
  segredosDaEra(era: string): number;
}

/** Câmera fora de c.camera (agente troca/câmera). */
export interface CameraAbraao {
  /** Tremor curto (golpes, o carneiro no arbusto). */
  tremer(intensidade: number, segundos: number): void;
}

/** Entrada do jogador (jogo.entrada): batalha de B3 (aparar/golpear) e discernir. */
export interface EntradaAbraao {
  ativa(a: Acao): boolean;
  pressionou(a: Acao): boolean;
}

export interface ServicosAbraao {
  canaa: CanaaAbraao;
  ceu: CeuAbraao;
  audio: AudioAbraao;
  animais: AnimaisAbraao;
  progresso: ProgressoAbraao;
  camera: CameraAbraao;
  entrada: EntradaAbraao;
  /** Roda `fn(dt)` a cada quadro (jogo.aCadaQuadro); devolve a função que desliga. */
  aCadaQuadro(fn: (dt: number) => void): () => void;
  /** Desbloqueia uma entrada "Aponta para Cristo" no Diário (ids de cristo.ts; 'semente' em B5 a completa). */
  cristo(id: string): void;
  /** Passa o controle do jogador para um personagem (sem a câmera de troca). */
  controlar(id: string): void;
  /** Tira alguém de um posto de cooperação (Controle.liberarPosto). */
  liberarPosto(id: string): void;
  /** Emite no barramento do jogo (jogo.eventos). */
  emitir(evento: string, dados?: unknown): void;
  /** Cria um NPC de cena (fugitivo, sentinelas, cativos): jogo.criarPersonagem. */
  criarPersonagem(def: DefPersonagem, x: number, z: number, yaw?: number): Personagem;
  /** Tira um NPC do mundo. */
  removerPersonagem(id: string): void;
  /** Créditos do MVP: estatísticas (memórias, segredos, tempo) e volta ao menu. Resolve ao fechar. */
  creditos(): Promise<void>;
}

let atual: ServicosAbraao | null = null;

/** O orquestrador chama isto depois de criar Canaã e antes de iniciar as missões da era. */
export function ligarServicosAbraao(s: ServicosAbraao | null) {
  atual = s;
}

export function servicosAbraao(): ServicosAbraao {
  if (!atual) throw new Error('Serviços da era de Abraão não ligados: chame ligarServicosAbraao() antes das missões.');
  return atual;
}

export function servicosAbraaoLigados(): boolean {
  return atual !== null;
}
