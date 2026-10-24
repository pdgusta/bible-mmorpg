import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../core/util';
import type { MundoFisico } from '../mundo/Fisica';
import type { Entrada } from '../core/Entrada';

/**
 * Câmera em terceira pessoa: órbita com o mouse, zoom na roda, colisão com terreno e
 * estruturas, e suavização. Também aceita "controle externo" para cinemáticas e trocas.
 */
export class CameraTerceira {
  readonly camera: THREE.PerspectiveCamera;
  yaw = Math.PI;
  pitch = 0.32;
  distancia = 5.2;
  distanciaAlvo = 5.2;
  min = 2.2;
  max = 11;
  sensibilidade = 0.0026;
  inverterY = false;
  readonly foco = new THREE.Vector3();
  private focoSuave = new THREE.Vector3();
  private distReal = 5.2;
  /** Quando verdadeiro, quem controla a câmera é um script (troca, cinemática). */
  externo = false;
  alturaOmbro = 1.55;
  deslocLateral = 0.35;
  private tmpDir = new THREE.Vector3();
  private tmpOrig = new THREE.Vector3();
  tremor = 0;
  tag?: string;

  constructor(aspecto: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspecto, 0.1, 1200);
  }

  entradaMouse(e: Entrada, dt: number) {
    this.yaw -= e.mouseDX * this.sensibilidade;
    this.pitch += e.mouseDY * this.sensibilidade * (this.inverterY ? -1 : 1);
    this.yaw -= e.eixoCamX * dt * 2.6;
    this.pitch += e.eixoCamY * dt * 1.8;
    this.pitch = clamp(this.pitch, -0.55, 1.15);
    if (e.roda) this.distanciaAlvo = clamp(this.distanciaAlvo + e.roda * 0.8, this.min, this.max);
  }

  /** Posiciona a câmera atrás do alvo instantaneamente. */
  encaixar(alvo: THREE.Vector3, yawPersonagem?: number) {
    if (yawPersonagem !== undefined) this.yaw = yawPersonagem + Math.PI;
    this.foco.copy(alvo);
    this.focoSuave.copy(alvo);
    this.distReal = this.distancia = this.distanciaAlvo;
  }

  atualizar(dt: number, alvo: THREE.Vector3, fisica: MundoFisico | null) {
    if (this.externo) return;
    this.foco.copy(alvo);
    this.focoSuave.x = damp(this.focoSuave.x, alvo.x, 14, dt);
    this.focoSuave.y = damp(this.focoSuave.y, alvo.y, 8, dt);
    this.focoSuave.z = damp(this.focoSuave.z, alvo.z, 14, dt);
    this.distancia = damp(this.distancia, this.distanciaAlvo, 8, dt);

    const pivo = this.tmpOrig.set(this.focoSuave.x, this.focoSuave.y + this.alturaOmbro, this.focoSuave.z);
    // deslocamento sobre o ombro
    pivo.x += Math.cos(this.yaw) * this.deslocLateral * (this.distancia / 6);
    pivo.z -= Math.sin(this.yaw) * this.deslocLateral * (this.distancia / 6);
    const dir = this.tmpDir.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    let d = this.distancia;
    if (fisica) {
      const hit = fisica.raio(pivo, dir, d + 0.3, this.tag);
      if (hit >= 0) d = Math.max(0.6, hit - 0.3);
    }
    // aproxima rápido ao colidir, afasta devagar
    this.distReal = d < this.distReal ? damp(this.distReal, d, 25, dt) : damp(this.distReal, d, 3.5, dt);
    this.camera.position.copy(pivo).addScaledVector(dir, this.distReal);
    if (fisica) {
      const chao = fisica.relevo.altura(this.camera.position.x, this.camera.position.z) + 0.4;
      if (this.camera.position.y < chao) this.camera.position.y = chao;
    }
    if (this.tremor > 0) {
      this.tremor = Math.max(0, this.tremor - dt);
      const k = this.tremor * 0.12;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k;
    }
    this.camera.lookAt(pivo);
  }

  /** Direção "para frente" no plano, segundo a câmera (para mover o personagem). */
  frente(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
  direita(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  /** Mira suave do yaw (ex.: para ficar atrás do personagem após uma troca). */
  girarPara(yaw: number, dt: number, lambda = 3) {
    this.yaw = dampAngle(this.yaw, yaw, lambda, dt);
  }
}
