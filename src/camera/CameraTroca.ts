import * as THREE from 'three';
import type { CameraTerceira } from './CameraTerceira';
import type { MundoFisico } from '../mundo/Fisica';
import { clamp, easeInOut, lerp, wrapAngle } from '../core/util';

export type FaseTroca = 'subida' | 'viagem' | 'descida';

export interface PlanoTroca {
  /** Pés de quem está sendo deixado (ao vivo). */
  de: () => THREE.Vector3;
  /** Pés de quem vai ser controlado (ao vivo: ele continua vivendo enquanto a câmera viaja). */
  para: () => THREE.Vector3;
  /** Yaw da câmera de jogo ao pousar (normalmente atrás do personagem de destino). */
  yawFinal: number;
}

/** Duração de cada salto (movimento rápido + pausa curta). */
const SALTO = 0.3;
const MOVE = 0.19;

/**
 * Coreografia de câmera da troca de personagem dentro da era (estilo GTA V):
 * sobe do personagem atual em três saltos, com a imagem dessaturando e esfriando; viaja pelo
 * céu até ficar acima do outro; desce em três saltos e pousa exatamente na pose da câmera de
 * jogo, de onde o controle normal assume sem tranco. ~2,5 s, sem tela de carregamento.
 */
export class CameraTroca {
  ativa = false;
  fase: FaseTroca | null = null;
  /** Chamado a cada salto (para o som de sopro). */
  aoSalto?: (fase: 'subida' | 'descida', i: number) => void;
  /** Chamado quando começa uma fase. */
  aoFase?: (fase: FaseTroca) => void;
  /** Quanto o filtro frio está aplicado (0..1). */
  filtro = 0;

  private plano: PlanoTroca | null = null;
  private resolver: (() => void) | null = null;
  private t = 0;
  private durViagem = 0.7;
  private alturas: [number, number, number, number] = [0, 9, 30, 90];
  private yaw0 = 0;
  private fov0 = 55;
  private saltoAnterior = -1;
  private faseAnterior: FaseTroca | null = null;
  private readonly inicioPos = new THREE.Vector3();
  private readonly inicioOlhar = new THREE.Vector3();
  private readonly finalPos = new THREE.Vector3();
  private readonly finalOlhar = new THREE.Vector3();
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly oa = new THREE.Vector3();
  private readonly ob = new THREE.Vector3();
  private overlay: HTMLDivElement | null = null;

  constructor(
    private cam: CameraTerceira,
    private fisica: () => MundoFisico | null,
    private canvas: HTMLCanvasElement,
  ) {}

  get duracao() {
    return SALTO * 6 + this.durViagem;
  }

  /** Começa a coreografia; resolve ao pousar (a câmera já está de volta ao jogo). */
  iniciar(plano: PlanoTroca): Promise<void> {
    this.resolver?.();
    this.plano = plano;
    this.ativa = true;
    this.t = 0;
    this.saltoAnterior = -1;
    this.faseAnterior = null;
    const c = this.cam.camera;
    this.cam.externo = true;
    this.fov0 = c.fov;
    this.inicioPos.copy(c.position);
    c.getWorldDirection(this.a);
    this.inicioOlhar.copy(c.position).addScaledVector(this.a, Math.max(3, this.cam.distancia));
    this.yaw0 = this.cam.yaw;
    const d = Math.hypot(plano.para().x - plano.de().x, plano.para().z - plano.de().z);
    const h3 = clamp(55 + d * 0.45, 70, 170);
    this.alturas = [0, 9, Math.max(24, h3 * 0.33), h3];
    this.durViagem = clamp(0.45 + d / 450, 0.5, 0.95);
    return new Promise((r) => (this.resolver = r));
  }

  /**
   * Pose aérea acima de `p`, `h` metros acima e um pouco "atrás" segundo o yaw (inclinação
   * de ~72°: o personagem continua visível no centro da imagem).
   */
  private poseAerea(p: THREE.Vector3, h: number, yaw: number, pos: THREE.Vector3, olhar: THREE.Vector3) {
    const atras = h * 0.33;
    pos.set(p.x + Math.sin(yaw) * atras, p.y + 1.2 + h, p.z + Math.cos(yaw) * atras);
    olhar.set(p.x, p.y + 1.0, p.z);
    const f = this.fisica();
    if (f) {
      const chao = f.relevo.altura(pos.x, pos.z) + 2;
      if (pos.y < chao) pos.y = chao;
    }
  }

  /** Pose do nível `n` (0 = câmera de jogo) sobre a origem ou o destino. */
  private pose(lado: 'de' | 'para', n: number, pos: THREE.Vector3, olhar: THREE.Vector3) {
    const pl = this.plano!;
    if (n === 0) {
      if (lado === 'de') {
        pos.copy(this.inicioPos);
        olhar.copy(this.inicioOlhar);
      } else {
        this.cam.calcularPose(pl.para(), this.fisica(), pos, olhar, pl.yawFinal, this.cam.pitch, this.cam.distanciaAlvo);
      }
      return;
    }
    this.poseAerea(lado === 'de' ? pl.de() : pl.para(), this.alturas[n], lado === 'de' ? this.yaw0 : pl.yawFinal, pos, olhar);
  }

  atualizar(dt: number) {
    if (!this.ativa || !this.plano) return;
    const c = this.cam.camera;
    this.t += dt;
    const t = this.t;
    const tSubida = SALTO * 3;
    const tViagem = tSubida + this.durViagem;
    const tFim = tViagem + SALTO * 3;
    let fase: FaseTroca;
    let fov = this.fov0;
    let filtro: number;

    if (t < tSubida) {
      fase = 'subida';
      const i = Math.min(2, Math.floor(t / SALTO));
      const local = t - i * SALTO;
      const k = this.curvaSalto(local);
      this.pose('de', i, this.a, this.oa);
      this.pose('de', i + 1, this.b, this.ob);
      c.position.lerpVectors(this.a, this.b, k);
      this.oa.lerp(this.ob, k);
      fov += Math.sin(Math.PI * clamp(local / MOVE, 0, 1)) * 7;
      filtro = (i + k) / 3;
      this.avisarSalto('subida', i);
    } else if (t < tViagem) {
      fase = 'viagem';
      const k = easeInOut((t - tSubida) / this.durViagem);
      const pl = this.plano;
      const p = this.a.copy(pl.de()).lerp(pl.para(), k);
      // um arco suave no meio da viagem
      const h = this.alturas[3] * (1 + Math.sin(Math.PI * k) * 0.12);
      const yaw = this.yaw0 + wrapAngle(pl.yawFinal - this.yaw0) * k;
      this.poseAerea(p, h, yaw, c.position, this.oa);
      filtro = 1;
    } else if (t < tFim) {
      fase = 'descida';
      const tt = t - tViagem;
      const i = Math.min(2, Math.floor(tt / SALTO));
      const local = tt - i * SALTO;
      const k = this.curvaSalto(local);
      this.pose('para', 3 - i, this.a, this.oa);
      this.pose('para', 2 - i, this.b, this.ob);
      c.position.lerpVectors(this.a, this.b, k);
      this.oa.lerp(this.ob, k);
      fov += Math.sin(Math.PI * clamp(local / MOVE, 0, 1)) * 7;
      filtro = 1 - (i + k) / 3;
      this.avisarSalto('descida', i);
    } else {
      this.terminar();
      return;
    }
    if (fase !== this.faseAnterior) {
      this.faseAnterior = fase;
      this.saltoAnterior = -1;
      this.aoFase?.(fase);
    }
    c.fov = fov;
    c.updateProjectionMatrix();
    c.lookAt(this.oa);
    this.aplicarFiltro(filtro);
  }

  /** Movimento rápido com frenagem (ease-out exponencial) e depois uma pausa curta. */
  private curvaSalto(local: number) {
    const u = clamp(local / MOVE, 0, 1);
    return u >= 1 ? 1 : 1 - Math.pow(2, -10 * u) * (1 - u);
  }

  private avisarSalto(fase: 'subida' | 'descida', i: number) {
    if (i !== this.saltoAnterior) {
      this.saltoAnterior = i;
      this.aoSalto?.(fase, i);
    }
  }

  private terminar() {
    const pl = this.plano!;
    const c = this.cam.camera;
    c.fov = this.fov0;
    c.updateProjectionMatrix();
    this.cam.yaw = pl.yawFinal;
    this.cam.externo = false;
    this.cam.encaixar(pl.para(), undefined, this.fisica());
    this.aplicarFiltro(0);
    this.ativa = false;
    this.fase = null;
    this.plano = null;
    const r = this.resolver;
    this.resolver = null;
    r?.();
  }

  /** Interrompe na hora (ex.: o mundo foi trocado), devolvendo a câmera ao jogo. */
  cancelar() {
    if (!this.ativa) return;
    this.terminar();
  }

  /** Dessaturação e tom frio: filtro CSS no canvas + um véu azulado em "soft-light". */
  aplicarFiltro(k: number) {
    k = clamp(k, 0, 1);
    this.filtro = k;
    if (k <= 0.001) {
      this.canvas.style.filter = '';
      if (this.overlay) this.overlay.style.opacity = '0';
      return;
    }
    this.canvas.style.filter = `saturate(${lerp(1, 0.38, k).toFixed(3)}) contrast(${lerp(1, 1.08, k).toFixed(3)}) brightness(${lerp(1, 0.94, k).toFixed(3)})`;
    if (!this.overlay) {
      const o = document.createElement('div');
      o.id = 'filtro-troca';
      o.style.cssText = 'position:fixed;inset:0;pointer-events:none;mix-blend-mode:soft-light;opacity:0;background:linear-gradient(180deg,#5d8fd0 0%,#3d6aa6 60%,#2c4f80 100%)';
      this.canvas.insertAdjacentElement('afterend', o);
      this.overlay = o;
    }
    this.overlay.style.opacity = (k * 0.75).toFixed(3);
  }
}
