import * as THREE from 'three';
import type { NomeClipe } from '../entidades/humano/Animador';
import type { NomeAderecos } from '../entidades/humano/Aderecos';
import type { MundoFisico } from '../mundo/Fisica';
import type { Navegacao } from '../mundo/Navegacao';
import type { Personagem } from './Personagem';
import { Aleatorio, hashTexto } from '../core/aleatorio';

/** Uma entrada de rotina: onde estar e o que fazer num intervalo de horas do dia. */
export interface EntradaRotina {
  de: number;
  ate: number;
  /** Coordenadas ou nome de um ponto do mapa. */
  lugar: [number, number] | string;
  atividade?: NomeClipe;
  segurar?: NomeAderecos;
  descricao: string;
  /** Raio para passear em volta do lugar (0 = fica parado). */
  vagar?: number;
  olhar?: [number, number] | string;
  /** Só vale se a flag estiver ligada / desligada. */
  se?: string;
  senao?: string;
}

export interface ContextoIA {
  hora: number;
  flags: Record<string, unknown>;
  ponto(nome: string): [number, number] | null;
  nav: Navegacao | null;
  jogador: Personagem | null;
}

export type Ordem =
  | { tipo: 'rotina' }
  | { tipo: 'esperar' }
  | { tipo: 'seguir'; alvo: Personagem; distancia: number }
  | { tipo: 'ir'; x: number; z: number; raio: number; correr: boolean; resolver?: () => void };

/**
 * IA dos coadjuvantes e NPCs: rotina por horário, seguir, esperar e ir até um ponto,
 * com caminho pela grade de navegação e reposicionamento quando fica preso.
 */
export class ControladorIA {
  ordem: Ordem = { tipo: 'rotina' };
  rotina: EntradaRotina[];
  private caminho: [number, number][] = [];
  private idx = 0;
  private destino: [number, number] | null = null;
  private tempoRecalculo = 0;
  private presoT = 0;
  private ultimaPos = new THREE.Vector3();
  private entradaAtual: EntradaRotina | null = null;
  private alvoVagar: [number, number] | null = null;
  private esperaVagar = 0;
  private rnd: Aleatorio;
  // movimento de cena (cinemáticas)
  private cena: { x: number; z: number; vel: number; resolver: () => void } | null = null;

  constructor(rotina: EntradaRotina[]) {
    this.rotina = rotina;
    this.rnd = new Aleatorio(hashTexto(JSON.stringify(rotina).slice(0, 40)) + 7);
  }

  limparCaminho() {
    this.caminho = [];
    this.idx = 0;
    this.destino = null;
  }

  /** Ordena ir até (x,z). A promessa resolve ao chegar. */
  irPara(x: number, z: number, raio = 1, correr = false): Promise<void> {
    if (this.ordem.tipo === 'ir') this.ordem.resolver?.();
    return new Promise((resolver) => {
      this.ordem = { tipo: 'ir', x, z, raio, correr, resolver };
      this.limparCaminho();
    });
  }

  seguir(alvo: Personagem, distancia = 2.6) {
    this.ordem = { tipo: 'seguir', alvo, distancia };
    this.limparCaminho();
  }

  esperar() {
    this.ordem = { tipo: 'esperar' };
    this.limparCaminho();
  }

  voltarARotina() {
    this.ordem = { tipo: 'rotina' };
    this.limparCaminho();
    this.entradaAtual = null;
  }

  /** Movimento controlado por cinemática (sem rotina). */
  moverCena(x: number, z: number, vel = 1.5): Promise<void> {
    this.cena?.resolver();
    return new Promise((resolver) => {
      this.cena = { x, z, vel, resolver };
    });
  }

  calcularCena(_dt: number, p: Personagem, _m: MundoFisico) {
    if (!this.cena) return { vx: 0, vz: 0, correr: false };
    const dx = this.cena.x - p.posicao.x;
    const dz = this.cena.z - p.posicao.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) {
      const r = this.cena.resolver;
      this.cena = null;
      r();
      return { vx: 0, vz: 0, correr: false };
    }
    const v = Math.min(this.cena.vel, d * 2.5);
    return { vx: (dx / d) * v, vz: (dz / d) * v, correr: this.cena.vel > 4 };
  }

  /** Entrada de rotina válida agora (respeitando hora e flags). */
  entradaRotina(ctx: ContextoIA): EntradaRotina | null {
    const h = ctx.hora;
    for (const e of this.rotina) {
      if (e.se && !ctx.flags[e.se]) continue;
      if (e.senao && ctx.flags[e.senao]) continue;
      const dentro = e.de <= e.ate ? h >= e.de && h < e.ate : h >= e.de || h < e.ate;
      if (dentro) return e;
    }
    return null;
  }

  calcular(dt: number, p: Personagem, m: MundoFisico, contexto: unknown) {
    const ctx = contexto as ContextoIA | undefined;
    let alvo: [number, number] | null = null;
    let raio = 1;
    let correr = false;
    const pos = p.posicao;

    switch (this.ordem.tipo) {
      case 'esperar':
        break;
      case 'seguir': {
        const a = this.ordem.alvo.posicao;
        const d = Math.hypot(a.x - pos.x, a.z - pos.z);
        // o líder está escalando: espera embaixo (não tenta atravessar a parede)
        if (this.ordem.alvo.escalada) break;
        if (d > 45) {
          // ficou muito para trás: reaparece perto do líder
          const atras = this.ordem.alvo.frente().multiplyScalar(-2.5);
          const nx = a.x + atras.x;
          const nz = a.z + atras.z;
          if (m.livre(nx, nz, a.y)) p.teleportar(nx, a.y, nz, this.ordem.alvo.yaw);
        } else if (d > this.ordem.distancia) {
          alvo = [a.x, a.z];
          raio = this.ordem.distancia * 0.8;
          correr = d > 8;
        }
        break;
      }
      case 'ir':
        alvo = [this.ordem.x, this.ordem.z];
        raio = this.ordem.raio;
        correr = this.ordem.correr;
        if (Math.hypot(this.ordem.x - pos.x, this.ordem.z - pos.z) <= raio) {
          const r = this.ordem.resolver;
          this.ordem = { tipo: 'esperar' };
          this.limparCaminho();
          r?.();
          alvo = null;
        }
        break;
      case 'rotina': {
        if (!ctx) break;
        const e = this.entradaRotina(ctx);
        if (e !== this.entradaAtual) {
          this.entradaAtual = e;
          this.alvoVagar = null;
          this.limparCaminho();
          p.humano.animador.atividade = null;
          p.humano.segurar(null, 'direita');
          if (e?.segurar) p.humano.segurar(e.segurar, 'direita');
        }
        if (!e) break;
        const lugar = typeof e.lugar === 'string' ? ctx.ponto(e.lugar) : e.lugar;
        if (!lugar) break;
        p.atividade = e.descricao;
        const dl = Math.hypot(lugar[0] - pos.x, lugar[1] - pos.z);
        if (dl > (e.vagar ?? 0) + 2.5) {
          alvo = lugar;
          raio = 1.2;
          correr = dl > 60;
          p.humano.animador.atividade = null;
        } else if (e.vagar) {
          // passeia em volta do lugar
          this.esperaVagar -= dt;
          if (!this.alvoVagar && this.esperaVagar <= 0) {
            const ang = this.rnd.entre(0, Math.PI * 2);
            const r = this.rnd.entre(0.5, e.vagar);
            this.alvoVagar = [lugar[0] + Math.cos(ang) * r, lugar[1] + Math.sin(ang) * r];
          }
          if (this.alvoVagar) {
            alvo = this.alvoVagar;
            raio = 0.6;
            if (Math.hypot(this.alvoVagar[0] - pos.x, this.alvoVagar[1] - pos.z) < 0.8) {
              this.alvoVagar = null;
              this.esperaVagar = this.rnd.entre(2, 7);
              alvo = null;
            }
          }
          p.humano.animador.atividade = alvo ? null : e.atividade ?? null;
        } else {
          p.humano.animador.atividade = e.atividade ?? null;
          const olhar = typeof e.olhar === 'string' ? ctx.ponto(e.olhar) : e.olhar;
          if (olhar) p.yaw = Math.atan2(olhar[0] - pos.x, olhar[1] - pos.z);
        }
        break;
      }
    }

    // reação: olhar para o jogador quando ele chega perto
    const j = ctx?.jogador;
    if (j && j !== p && Math.hypot(j.posicao.x - pos.x, j.posicao.z - pos.z) < 4.5) {
      p.humano.olharPara = j.humano.posicaoOsso('Head', p.humano.olharPara ?? new THREE.Vector3());
    } else p.humano.olharPara = null;

    if (!alvo) return { vx: 0, vz: 0, correr: false };
    return this.seguirCaminho(dt, p, m, ctx?.nav ?? null, alvo, raio, correr);
  }

  private seguirCaminho(dt: number, p: Personagem, m: MundoFisico, nav: Navegacao | null, alvo: [number, number], raio: number, correr: boolean) {
    const pos = p.posicao;
    this.tempoRecalculo -= dt;
    const mudou = !this.destino || Math.hypot(this.destino[0] - alvo[0], this.destino[1] - alvo[1]) > 2;
    if (mudou || (this.tempoRecalculo <= 0 && this.idx >= this.caminho.length)) {
      this.destino = alvo;
      this.caminho = (nav ? nav.caminho(pos.x, pos.z, alvo[0], alvo[1]) : null) ?? [alvo];
      this.idx = 0;
      this.tempoRecalculo = 3;
    }
    // preso?
    if (pos.distanceToSquared(this.ultimaPos) < 0.0004 * dt * 60) this.presoT += dt;
    else this.presoT = 0;
    this.ultimaPos.copy(pos);
    if (this.presoT > 2.5) {
      this.presoT = 0;
      this.limparCaminho();
      const ponto = this.caminho[this.idx] ?? alvo;
      const nx = pos.x + (ponto[0] - pos.x) * 0.3;
      const nz = pos.z + (ponto[1] - pos.z) * 0.3;
      if (m.livre(nx, nz, m.relevo.altura(nx, nz))) p.teleportar(nx, m.chao(nx, nz, pos.y + 2).y, nz);
    }
    let ponto = this.caminho[this.idx] ?? alvo;
    while (this.idx < this.caminho.length - 1 && Math.hypot(ponto[0] - pos.x, ponto[1] - pos.z) < 1.0) {
      this.idx++;
      ponto = this.caminho[this.idx];
    }
    const dx = ponto[0] - pos.x;
    const dz = ponto[1] - pos.z;
    const d = Math.hypot(dx, dz);
    const final = this.idx >= this.caminho.length - 1;
    if (final && Math.hypot(alvo[0] - pos.x, alvo[1] - pos.z) <= raio) return { vx: 0, vz: 0, correr: false };
    const v = (correr ? p.velocidadeCorrida * 0.9 : p.velocidadeBase * 0.75) * p.modVelocidade;
    const k = final ? Math.min(1, d / 1.5) : 1;
    return { vx: (dx / Math.max(d, 0.001)) * v * k, vz: (dz / Math.max(d, 0.001)) * v * k, correr };
  }
}
