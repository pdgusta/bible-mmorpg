// Serviços que as missões da era de Noé usam além do CtxMissao. O orquestrador liga a
// implementação real com `ligarServicosNoe(...)` antes de iniciar as missões; os testes ligam
// uma versão falsa. Cada grupo indica de qual módulo (agente) vem.
import type * as THREE from 'three';
import type { EstagioArca } from './Arca';
import type { FonteXP } from '../../jogo/Atributos';

export type EstadoValeNoe = 'antes' | 'diluvio' | 'depois';

/** Pontos 3D dentro/junto da arca (`MundoNoe.pontoArca`); acompanham a arca quando ela se move. */
export type NomePontoArca =
  | 'porta' | 'saida' | 'conves1' | 'conves2' | 'conves3' | 'rampa12' | 'rampa23'
  | 'bomba' | 'vazamento1' | 'vazamento2' | 'vazamento3' | 'vazamento4'
  | 'baia1' | 'baia2' | 'baia3' | 'baia1Animal' | 'baia2Animal' | 'baia3Animal' | 'corredor2' | 'escadaRedes' | 'rede1' | 'rede2'
  | 'familia' | 'familia1' | 'familia2' | 'familia3' | 'familia4'
  | 'escadaJanela' | 'janela' | 'pombaPouso';

/** A arca (src/eras/noe/Arca.ts — agente motor). */
export interface ArcaNoe {
  readonly estagio: number;
  readonly grupo: { readonly position: THREE.Vector3; readonly rotation?: { readonly y: number } };
  definirEstagio(e: EstagioArca): void;
  /** Aberta cria a rampa (estágio ≥ 4). */
  definirPorta(aberta: boolean): void;
  /** A janela "de um côvado" sob o teto (Gn 6:16; 8:6). */
  definirJanela(aberta: boolean): void;
}

/** O vale (MundoNoe, src/eras/noe/construir.ts — agente motor). */
export interface ValeNoe {
  readonly arca: ArcaNoe;
  readonly vigaMestra: { readonly altura: number; definirAltura(t: number): void };
  definirEstado(e: EstadoValeNoe): void;
  /** Só a água (malha + nível físico); recortada dentro do casco. */
  animarAgua(nivel: number, segundos: number): Promise<void>;
  /** Clima de interior: lanternas, neblina curta, sem chuva visível. */
  definirInterior(ativo: boolean): void;
  pontoArca(nome: NomePontoArca): THREE.Vector3;
  /** Move a arca e atualiza os pontos do mapa que a acompanham (portaArca, entregaArca, saidaArca, bomba, janela). */
  moverArca(x: number, y: number, z: number, yaw?: number): void;
  /** Põe a arca no repouso do platô (Gn 8:4): `moverArca(...NOE.arcaRepouso)`. */
  repousarArca(): void;
  /** Água no convés 1: 0 seco … 1 limite. */
  definirAguaInterna(nivel: number): void;
  /** Jato d'água visível de um vazamento (1..4). */
  definirVazamento(n: number, ativo: boolean): void;
  /** Caixas que deslizam pelo corredor do convés 2 enquanto as redes estão soltas. */
  definirCaixasSoltas(ativas: boolean): void;
  /** Altar do platô: pedras juntadas (0..6) e fogo. */
  definirAltar(pedras: number, fogo: boolean): void;
  /** Derruba um cipreste marcado ('arvoreGofer1'..'3'): fica o toco. */
  cortarArvore(id: string): void;
}

/** Céu (src/render/Ceu.ts — agente motor): propriedades lidas a cada quadro. */
export interface CeuNoe {
  hora: number;
  /** 0..1 */
  tempestade: number;
  /** Arco-íris 0..1. */
  arco: number;
  /** Luz dourada 0..1 (voz de Deus). */
  gloria: number;
  /** Para o relógio do dia (cinemáticas). */
  pausado: boolean;
}

export type MusicaNoe = 'calmo' | 'aventura' | 'prova' | 'gloria' | 'silencio';

/** Áudio (agente animais+áudio). */
export interface AudioNoe {
  ambiente(nome: string, intensidade: number): void;
  musica(nome: MusicaNoe): void;
  efeito(nome: string): void;
}

/** Um animal (Animal de src/entidades/Animal.ts — agente animais), visto pelas missões. */
export interface AnimalNoe {
  readonly especie: string;
  readonly posicao: THREE.Vector3;
  /** Passeia em volta de onde está. */
  vagar(raio?: number): void;
  seguir(alvo: { posicao: THREE.Vector3 }, distancia?: number): void;
  /** Agitado: para e não segue ninguém até ser acalmado. */
  agitar(): void;
  acalmar(): void;
  /** Corre para longe de `pos` por alguns segundos; se estava agitado, continua agitado. */
  fugirDe(pos: THREE.Vector3, segundos?: number): void;
  /** Anda até (x, z); resolve ao chegar. */
  irPara(x: number, z: number): Promise<void>;
  /** Aves: voa até o ponto; resolve ao chegar. */
  voarPara(x: number, y: number, z: number): Promise<void>;
  /** Anda pelos pontos e some com fade (entrar na arca). */
  entrar(pontos: [number, number][]): Promise<void>;
  /** Tira do mundo (com fade se `suave`). */
  remover(suave?: boolean): Promise<void>;
}

export interface OpcoesAnimalNoe {
  y?: number;
  yaw?: number;
  /** O par: a fêmea acompanha o macho. */
  sexo?: 'macho' | 'femea';
}

export interface AnimaisNoe {
  /** `criarAnimal(especie, mundo, x, z, opts)` com o mundo do vale. */
  criar(especie: string, x: number, z: number, opts?: OpcoesAnimalNoe): Promise<AnimalNoe>;
}

/** O que as missões leem/gravam no Progresso fora do CtxMissao (segredos achados a qualquer hora). */
export interface ProgressoNoe {
  temMemoria(id: string): boolean;
  /** Guarda a memória (segredos contam para o legado). Devolve false se já estava. */
  memoria(id: string): boolean;
  ganharXP(alvo: string | string[], fonte: FonteXP, qtd?: number): number;
}

/** Câmera fora de c.camera (agente troca/câmera). */
export interface CameraNoe {
  /** Tremor curto (trovão, tranco da arca no monte). */
  tremer(intensidade: number, segundos: number): void;
  /** Balanço contínuo (rolagem) da arca no mar: 0 desliga. */
  balanco(intensidade: number): void;
}

export interface ServicosNoe {
  vale: ValeNoe;
  ceu: CeuNoe;
  audio: AudioNoe;
  animais: AnimaisNoe;
  progresso: ProgressoNoe;
  camera: CameraNoe;
  /** Desbloqueia uma entrada "Aponta para Cristo" no Diário (ids de cristo.ts). */
  cristo(id: string): void;
  /** Passa o controle do jogador para um personagem (sem a câmera de troca). */
  controlar(id: string): void;
  /** Tira quem estiver no posto de cooperação com este id (Controle.liberarPosto). */
  liberarPosto(idPosto: string): void;
  /** Some com um NPC do mundo (moradores da cidade depois do dilúvio). */
  removerPersonagem(id: string): void;
  /**
   * Transição de era (TransicaoEra): zoom no rosto de Noé, a genealogia como fios de luz e o
   * mundo de Canaã se reconstruindo em onda. Resolve quando a era 2 está pronta.
   */
  transicaoEra(genealogia: string[]): Promise<void>;
}

let atual: ServicosNoe | null = null;

/** O orquestrador chama isto depois de criar o vale e antes de iniciar as missões da era. */
export function ligarServicosNoe(s: ServicosNoe | null) {
  atual = s;
}

export function servicosNoe(): ServicosNoe {
  if (!atual) throw new Error('Serviços da era de Noé não ligados: chame ligarServicosNoe() antes das missões.');
  return atual;
}

export function servicosNoeLigados(): boolean {
  return atual !== null;
}
