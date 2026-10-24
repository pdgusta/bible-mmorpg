// Ponte entre o jogo e o áudio (src/audio/Audio.ts): ambientes por área/estado (a era informa a
// cada quadro), música por estado, efeitos de eventos (troca, interação, memória, nível),
// passos do personagem ativo e o ouvinte na câmera. As missões falam com esta ponte pelos
// serviços da era (ServicosNoe.audio); ela decide o que chega ao Audio.
import * as THREE from 'three';
import { Audio, type EstadoMusica, type OpcoesSom } from '../../audio/Audio';
import type { Jogo } from '../Jogo';
import type { Personagem } from '../Personagem';

export type Superficie = NonNullable<OpcoesSom['superficie']>;

/** O que a era informa a cada quadro: intensidade de cada ambiente (0..1) e o chão dos passos. */
export interface AmbienteEra {
  ambientes: Record<string, number>;
  superficie(p: Personagem): Superficie;
}

const _dir = new THREE.Vector3();

export class PonteAudio {
  /** Pedidos das missões (valem para os nomes que a área da era não controla). */
  private pedidos = new Map<string, number>();
  /** Calculados pela era (área/estado). */
  private area = new Map<string, number>();
  private aplicados = new Map<string, number>();
  private musicaAtual: EstadoMusica = 'silencio';
  private passo = 0;
  private superficie: ((p: Personagem) => Superficie) | null = null;
  private iniciado = false;

  constructor(private jogo: Jogo) {}

  /** Liga o áudio no primeiro gesto do jogador e os efeitos dos eventos do jogo. Uma vez. */
  iniciar() {
    if (this.iniciado) return;
    this.iniciado = true;
    Audio.iniciarNoPrimeiroGesto();
    const ev = this.jogo.eventos;
    ev.on('troca:salto', (d: { fase?: string } | undefined) => this.efeito('sopro', { volume: d?.fase === 'descida' ? 0.45 : 0.6 }));
    ev.on('interacao', () => this.efeito('clique', { volume: 0.5 }));
    ev.on('memoria', () => this.efeito('memoria'));
    ev.on('nivel', () => this.efeito('nivel'));
    ev.on('armadura', () => this.efeito('armadura'));
    ev.on('atributo', () => this.efeito('brilho', { volume: 0.5 }));
    ev.on('prova:inicio', () => this.musica('prova'));
    ev.on('prova:fim', () => {
      if (this.musicaAtual === 'prova') this.musica('calmo');
    });
  }

  // ------------------------------------------------------------------ usados pelas missões

  ambiente(nome: string, intensidade: number) {
    this.pedidos.set(nome, intensidade);
    this.aplicar(nome);
  }

  musica(nome: EstadoMusica) {
    this.musicaAtual = nome;
    Audio.musica(nome);
  }

  get musicaEstado(): EstadoMusica {
    return this.musicaAtual;
  }

  efeito(nome: string, op?: OpcoesSom) {
    Audio.efeito(nome, op);
  }

  // ------------------------------------------------------------------ orquestrador

  /** Volumes das Configurações (0..1). */
  volumes(musica: number, efeitos: number) {
    Audio.volume({ musica, efeitos });
  }

  /** Esquece os pedidos das missões e desliga os ambientes (carregar, novo jogo, título). */
  limpar() {
    this.pedidos.clear();
    this.area.clear();
    for (const nome of this.aplicados.keys()) Audio.ambiente(nome, 0);
    this.aplicados.clear();
  }

  /** Ambientes calculados pela era neste quadro (nomes ausentes valem 0 se já foram usados). */
  definirArea(a: AmbienteEra | null) {
    this.superficie = a?.superficie ?? null;
    const novos = a?.ambientes ?? {};
    const nomes = new Set([...this.area.keys(), ...Object.keys(novos)]);
    for (const n of nomes) {
      this.area.set(n, novos[n] ?? 0);
      this.aplicar(n);
    }
  }

  private aplicar(nome: string) {
    const v = this.area.has(nome) ? this.area.get(nome)! : this.pedidos.get(nome) ?? 0;
    const antes = this.aplicados.get(nome) ?? 0;
    if (Math.abs(v - antes) < 0.03 && !(v === 0 && antes !== 0)) return;
    this.aplicados.set(nome, v);
    Audio.ambiente(nome, v);
  }

  /** Por quadro: ouvinte na câmera e passos do personagem ativo. */
  quadro(dt: number) {
    const c = this.jogo.cam.camera;
    c.getWorldDirection(_dir);
    Audio.posicaoOuvinte(c.position, Math.atan2(_dir.x, _dir.z));
    const p = this.jogo.ativo;
    if (!p || !p.controlado || p.escalada || p.noAr || p.posto || p.velocidade < 0.6) {
      this.passo = Math.min(this.passo, 0.5);
      return;
    }
    this.passo += p.velocidade * dt;
    const passada = p.velocidade > 4.5 ? 1.15 : 0.78;
    if (this.passo < passada) return;
    this.passo = 0;
    this.efeito('passo', {
      superficie: this.superficie?.(p) ?? 'terra',
      pos: p.posicao,
      volume: p.velocidade > 4.5 ? 0.75 : 0.5,
    });
  }
}
