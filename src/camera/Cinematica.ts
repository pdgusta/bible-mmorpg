import * as THREE from 'three';
import type { CameraTerceira } from './CameraTerceira';
import type { MundoFisico } from '../mundo/Fisica';
import { clamp } from '../core/util';

export type Vec3 = THREE.Vector3 | [number, number, number];

/** Serviço de câmera usado pelos scripts de missão (ctx.camera / ctx.cameraVoltar). */
export interface ServicoCinematica {
  /** Leva a câmera até `pos`, olhando para `alvo`, em `duracao` segundos (0 = corte seco). */
  para(pos: Vec3, alvo: Vec3, duracao: number): Promise<void>;
  /** Devolve a câmera ao jogador, deslizando até a pose normal de terceira pessoa. */
  voltar(duracao?: number): Promise<void>;
}

interface Movimento {
  dePos: THREE.Vector3;
  deOlhar: THREE.Vector3;
  paraPos: THREE.Vector3;
  paraOlhar: THREE.Vector3;
  /** Ponto de controle (Bézier quadrática) que ergue a trajetória acima do relevo. */
  controle: THREE.Vector3;
  dur: number;
  t: number;
  resolver: () => void;
  /** Alvo que se move (voltar ao jogador): recalculado a cada quadro. */
  dinamico?: (pos: THREE.Vector3, olhar: THREE.Vector3) => void;
  devolver?: boolean;
}

export const vec3 = (v: Vec3, out = new THREE.Vector3()) => (Array.isArray(v) ? out.set(v[0], v[1], v[2]) : out.copy(v));

/** Suavização com aceleração e frenagem sem trancos (derivadas 1ª e 2ª nulas nas pontas). */
const suave = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Câmera de cinemática: trajetórias suaves (curva que passa por cima do relevo quando a reta
 * atravessaria um morro), cortes secos e a volta à câmera de jogo exatamente na pose em que
 * o controle normal assume.
 */
export class Cinematica implements ServicoCinematica {
  /** A câmera está nas mãos da cinemática. */
  ativa = false;
  private mov: Movimento | null = null;
  private readonly olharAtual = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();

  constructor(
    private cam: CameraTerceira,
    private fisica: () => MundoFisico | null,
    /** Posição (pés) de quem a câmera deve seguir ao voltar. */
    private foco: () => THREE.Vector3 | null,
  ) {}

  /** Ponto que a câmera está olhando agora. */
  get olhar() {
    return this.olharAtual;
  }

  private assumir() {
    if (this.ativa) return;
    const c = this.cam.camera;
    c.getWorldDirection(this.tmp);
    this.olharAtual.copy(c.position).addScaledVector(this.tmp, Math.max(3, this.cam.distancia));
    this.ativa = true;
    this.cam.externo = true;
  }

  private terminarAnterior() {
    const m = this.mov;
    if (!m) return;
    this.mov = null;
    m.resolver();
  }

  para(pos: Vec3, alvo: Vec3, duracao: number): Promise<void> {
    this.assumir();
    this.terminarAnterior();
    const c = this.cam.camera;
    const paraPos = vec3(pos);
    const paraOlhar = vec3(alvo);
    if (duracao <= 0) {
      c.position.copy(paraPos);
      this.olharAtual.copy(paraOlhar);
      c.lookAt(this.olharAtual);
      return Promise.resolve();
    }
    return new Promise((resolver) => {
      this.mov = {
        dePos: c.position.clone(),
        deOlhar: this.olharAtual.clone(),
        paraPos,
        paraOlhar,
        controle: this.pontoControle(c.position, paraPos),
        dur: duracao,
        t: 0,
        resolver,
      };
    });
  }

  /** Corte seco. */
  cortar(pos: Vec3, alvo: Vec3) {
    return this.para(pos, alvo, 0);
  }

  voltar(duracao = 1): Promise<void> {
    if (!this.ativa) return Promise.resolve();
    this.terminarAnterior();
    const c = this.cam.camera;
    const calcular = (p: THREE.Vector3, o: THREE.Vector3) => {
      const f = this.foco();
      if (f) this.cam.calcularPose(f, this.fisica(), p, o);
    };
    if (duracao <= 0) {
      this.devolver();
      return Promise.resolve();
    }
    const paraPos = new THREE.Vector3();
    const paraOlhar = new THREE.Vector3();
    calcular(paraPos, paraOlhar);
    return new Promise((resolver) => {
      this.mov = {
        dePos: c.position.clone(),
        deOlhar: this.olharAtual.clone(),
        paraPos,
        paraOlhar,
        controle: this.pontoControle(c.position, paraPos),
        dur: duracao,
        t: 0,
        resolver,
        dinamico: calcular,
        devolver: true,
      };
    });
  }

  /** Devolve a câmera ao jogo na hora (sem transição). */
  devolver() {
    this.terminarAnterior();
    if (!this.ativa) return;
    this.ativa = false;
    this.cam.externo = false;
    const f = this.foco();
    if (f) this.cam.encaixar(f, undefined, this.fisica());
  }

  /** Interrompe qualquer movimento e devolve a câmera (ex.: ao pular a cena). */
  cancelar() {
    this.devolver();
  }

  /**
   * Meio do caminho erguido o bastante para a curva passar acima do relevo (amostrado ao
   * longo da reta) e, em viagens longas, um leve arco para dar sensação de voo.
   */
  private pontoControle(a: THREE.Vector3, b: THREE.Vector3) {
    const meio = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const f = this.fisica();
    const dist = a.distanceTo(b);
    let elevar = dist > 30 ? dist * 0.08 : 0;
    if (f) {
      const p = this.tmp2;
      for (let i = 1; i < 12; i++) {
        p.lerpVectors(a, b, i / 12);
        const falta = f.relevo.altura(p.x, p.z) + 1.5 - p.y;
        if (falta > 0) elevar = Math.max(elevar, falta * 2.2);
      }
    }
    meio.y += elevar;
    return meio;
  }

  /** Chamado a cada quadro pelo Jogo (depois dos personagens, antes de renderizar). */
  atualizar(dt: number) {
    if (!this.ativa) return;
    const c = this.cam.camera;
    const m = this.mov;
    if (m) {
      m.t = clamp(m.t + dt / m.dur, 0, 1);
      if (m.dinamico) m.dinamico(m.paraPos, m.paraOlhar);
      const k = suave(m.t);
      // Bézier quadrática: (1-k)²A + 2(1-k)k C + k² B
      const u = 1 - k;
      c.position.set(0, 0, 0)
        .addScaledVector(m.dePos, u * u)
        .addScaledVector(m.controle, 2 * u * k)
        .addScaledVector(m.paraPos, k * k);
      // na volta ao jogador, o arco se desfaz para pousar exatamente na pose de jogo
      if (m.dinamico) c.position.lerp(m.paraPos, k * k);
      this.olharAtual.lerpVectors(m.deOlhar, m.paraOlhar, k);
      const f = this.fisica();
      if (f) {
        const chao = f.relevo.altura(c.position.x, c.position.z) + 0.3;
        if (c.position.y < chao) c.position.y = chao;
      }
      if (m.t >= 1) {
        this.mov = null;
        if (m.devolver) {
          this.ativa = false;
          this.cam.externo = false;
          const foco = this.foco();
          if (foco) this.cam.encaixar(foco, undefined, this.fisica());
        }
        m.resolver();
        if (!this.ativa) return;
      }
    }
    c.lookAt(this.olharAtual);
  }
}
