import * as THREE from 'three';
import { Renderizador, type Qualidade } from '../render/Renderizador';
import { Ceu } from '../render/Ceu';
import { GLOBAIS } from '../render/Shaders';
import { Ativos } from '../render/Ativos';
import { Entrada } from '../core/Entrada';
import { Eventos } from '../core/Eventos';
import { CameraTerceira } from '../camera/CameraTerceira';
import { CorpoBase } from '../entidades/humano/CorpoBase';
import type { Mundo } from '../mundo/Mundo';
import { Personagem, type Comando, type DefPersonagem } from './Personagem';
import type { ContextoIA } from './IA';
import { clamp } from '../core/util';

export interface Corpos {
  masc: CorpoBase;
  fem: CorpoBase;
}

/**
 * Núcleo do jogo: renderização, laço, câmera, mundo atual, personagens e controle do jogador.
 * Sistemas de história (missões, diálogos, provas, UI) se ligam pelos eventos.
 */
export class Jogo {
  readonly canvas: HTMLCanvasElement;
  readonly render: Renderizador;
  readonly cena = new THREE.Scene();
  readonly ceu: Ceu;
  readonly ativos = new Ativos();
  readonly entrada: Entrada;
  readonly eventos = new Eventos();
  readonly cam: CameraTerceira;
  mundo: Mundo | null = null;
  corpos!: Corpos;
  natureza!: THREE.Object3D;
  ativo: Personagem | null = null;
  /** Quando falso, o jogador não move o personagem (diálogos, cinemáticas, menus). */
  controleLivre = true;
  pausado = false;
  tempo = 0;
  flags: Record<string, unknown> = {};
  private relogio = new THREE.Clock();
  private aoQuadro = new Set<(dt: number) => void>();
  private ctxIA: ContextoIA;
  readonly focoCamera = new THREE.Vector3();
  quadro = 0;

  constructor(canvas: HTMLCanvasElement, qualidade: Qualidade) {
    this.canvas = canvas;
    this.render = new Renderizador(canvas, qualidade);
    this.ceu = new Ceu(this.cena, this.render.preset.sombra);
    this.ceu.ajustarDistancia(this.render.preset.distancia);
    this.cam = new CameraTerceira(this.render.aspecto);
    this.entrada = new Entrada(canvas);
    window.addEventListener('resize', () => {
      this.cam.camera.aspect = this.render.aspecto;
      this.cam.camera.updateProjectionMatrix();
    });
    this.ctxIA = {
      hora: 9,
      flags: this.flags,
      ponto: (n) => this.mundo?.pontos.get(n) ?? null,
      nav: null,
      jogador: null,
    };
  }

  async carregarBase(progresso?: (f: number, nome: string) => void) {
    this.ativos.aoProgresso = progresso;
    const [gm, gf, nat] = await Promise.all([
      this.ativos.carregar('personagens/humano.glb'),
      this.ativos.carregar('personagens/humana.glb'),
      this.ativos.carregar('natureza.glb'),
    ]);
    this.corpos = { masc: new CorpoBase(gm, gm.animations), fem: new CorpoBase(gf, gm.animations) };
    this.natureza = nat.scene;
  }

  definirMundo(m: Mundo) {
    if (this.mundo) {
      this.cena.remove(this.mundo.grupo);
      this.mundo.dispose();
    }
    this.mundo = m;
    this.cena.add(m.grupo);
    m.natureza.distanciaMax = this.render.preset.distancia;
    m.grama.densidadeGlobal = this.render.preset.densidadeGrama;
    this.ctxIA.nav = m.nav;
  }

  criarPersonagem(def: DefPersonagem, x: number, z: number, yaw = 0): Personagem {
    if (!this.mundo) throw new Error('sem mundo');
    const p = new Personagem(def, def.aparencia.corpo === 'fem' ? this.corpos.fem : this.corpos.masc, () => this.flags);
    const y = this.mundo.chao(x, z);
    p.teleportar(x, y, z, yaw);
    this.mundo.personagens.set(def.id, p);
    this.mundo.grupo.add(p.humano.raiz);
    return p;
  }

  personagem(id: string): Personagem {
    const p = this.mundo?.personagens.get(id);
    if (!p) throw new Error(`personagem ausente: ${id}`);
    return p;
  }

  controlar(p: Personagem) {
    if (this.ativo) {
      this.ativo.controlado = false;
      if (!this.ativo.posto) this.ativo.ia.esperar();
    }
    this.ativo = p;
    p.controlado = true;
    this.ctxIA.jogador = p;
    this.eventos.emit('controle', p);
  }

  aCadaQuadro(fn: (dt: number) => void) {
    this.aoQuadro.add(fn);
    return () => this.aoQuadro.delete(fn);
  }

  iniciar() {
    this.relogio.start();
    const laco = () => {
      requestAnimationFrame(laco);
      this.passo();
    };
    requestAnimationFrame(laco);
  }

  /** Um quadro (exposto para os testes automáticos avançarem o tempo). */
  passo(dtForcado?: number) {
    const dtReal = this.relogio.getDelta();
    const dt = clamp(dtForcado ?? dtReal, 0, 1 / 20);
    this.render.medir(dtReal);
    this.entrada.lerControle();
    if (!this.pausado) this.atualizar(dt);
    this.render.gl.render(this.cena, this.cam.camera);
    this.entrada.fimDoQuadro();
    this.quadro++;
  }

  private comandoJogador(): Comando | null {
    if (!this.controleLivre || !this.ativo || this.ativo.emCena) return null;
    const e = this.entrada;
    let fx = (e.ativa('direita') ? 1 : 0) - (e.ativa('esquerda') ? 1 : 0) + e.eixoMovX;
    let fz = (e.ativa('frente') ? 1 : 0) - (e.ativa('tras') ? 1 : 0) - e.eixoMovY;
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const f = this.cam.frente();
    const d = this.cam.direita();
    return {
      x: f.x * fz + d.x * fx,
      z: f.z * fz + d.z * fx,
      correr: e.ativa('correr'),
      pular: e.pressionou('pular'),
      agachar: e.ativa('agachar'),
    };
  }

  private atualizar(dt: number) {
    this.tempo += dt;
    GLOBAIS.uTempo.value = this.tempo;
    const m = this.mundo;
    if (!m) return;
    this.ctxIA.hora = this.ceu.hora;
    if (this.controleLivre && !this.cam.externo) this.cam.entradaMouse(this.entrada, dt);
    const cmd = this.comandoJogador();
    const camPos = this.cam.camera.position;
    for (const p of m.personagens.values()) {
      const d = p.posicao.distanceTo(camPos);
      p.atualizar(dt, m.fisica, p === this.ativo ? (cmd ?? { x: 0, z: 0, correr: false, pular: false, agachar: false }) : null, d, this.ctxIA);
    }
    for (const fn of this.aoQuadro) fn(dt);
    if (this.ativo) {
      m.verificarAreas(this.ativo);
      this.focoCamera.copy(this.ativo.posicao);
    }
    this.cam.atualizar(dt, this.focoCamera, m.fisica);
    this.ceu.atualizar(dt, this.focoCamera, this.tempo);
    if (m.agua) m.agua.sincronizarLuz(this.ceu.direcaoSol, this.ceu.sol.color, this.ceu.corNeblinaBase, this.ceu.escuridao);
    m.atualizar(dt, this.tempo, this.cam.camera, this.focoCamera);
  }
}
