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
  private tmpDir2 = new THREE.Vector3();
  private tmpRaio = new THREE.Vector3();
  tremor = 0;
  /** Tag de colisor que a câmera atravessa (paredes invisíveis do Moriá: 'invisivel'). */
  tag: string | undefined = 'invisivel';
  // efeitos aplicados por cima de qualquer controlador (jogo, cinemática, troca, transição)
  private efTremor = { forca: 0, t: 0, dur: 0 };
  private efBalanco = 0;
  private efBalancoAlvo = 0;
  private efFase = 0;
  private efPos = new THREE.Vector3();
  private efRolar = 0;
  private efAplicado = false;

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

  /**
   * Posiciona a câmera atrás do alvo instantaneamente. Com `fisica`, já começa na distância
   * livre de colisão (sem o "pulo" de aproximação no primeiro quadro).
   */
  encaixar(alvo: THREE.Vector3, yawPersonagem?: number, fisica?: MundoFisico | null) {
    if (yawPersonagem !== undefined) this.yaw = yawPersonagem + Math.PI;
    this.foco.copy(alvo);
    this.focoSuave.copy(alvo);
    this.distReal = this.distancia = this.distanciaAlvo;
    if (fisica) {
      const pivo = this.pivo(alvo, this.distancia, this.yaw, new THREE.Vector3());
      const dir = this.direcao(this.yaw, this.pitch, new THREE.Vector3());
      this.distReal = this.distanciaLivre(pivo, dir, this.distancia, fisica);
    }
  }

  /** Ponto que a câmera olha (ombro do personagem). */
  pivo(foco: THREE.Vector3, distancia: number, yaw: number, out: THREE.Vector3) {
    out.set(foco.x, foco.y + this.alturaOmbro, foco.z);
    // deslocamento sobre o ombro
    out.x += Math.cos(yaw) * this.deslocLateral * (distancia / 6);
    out.z -= Math.sin(yaw) * this.deslocLateral * (distancia / 6);
    return out;
  }

  /** Direção do pivô para a câmera. */
  direcao(yaw: number, pitch: number, out: THREE.Vector3) {
    return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  }

  /**
   * Distância máxima sem atravessar terreno nem estruturas: um feixe de 5 raios (centro e as
   * bordas do plano próximo), para a câmera não "espiar" através de paredes finas e quinas.
   */
  distanciaLivre(pivo: THREE.Vector3, dir: THREE.Vector3, d: number, fisica: MundoFisico, yaw = this.yaw) {
    const dir2 = this.tmpDir2.copy(dir);
    const dx = Math.cos(yaw) * 0.28;
    const dz = -Math.sin(yaw) * 0.28;
    let melhor = d;
    for (let i = 0; i < 5; i++) {
      const o = this.tmpRaio.copy(pivo);
      if (i === 1) { o.x += dx; o.z += dz; }
      else if (i === 2) { o.x -= dx; o.z -= dz; }
      else if (i === 3) o.y += 0.22;
      else if (i === 4) o.y -= 0.22;
      const hit = fisica.raio(o, dir2, melhor + 0.3, this.tag);
      // um raio lateral que já nasce dentro de uma parede (personagem encostado) não conta
      if (hit >= 0 && (i === 0 || hit > 0.35)) melhor = Math.min(melhor, Math.max(0.6, hit - 0.3));
    }
    return melhor;
  }

  /**
   * Pose que a câmera de jogo teria agora para este alvo (sem suavização), usada para
   * pousar trocas e cinemáticas exatamente onde o controle normal assume.
   */
  calcularPose(alvo: THREE.Vector3, fisica: MundoFisico | null, outPos: THREE.Vector3, outOlhar: THREE.Vector3, yaw = this.yaw, pitch = this.pitch, distancia = this.distanciaAlvo) {
    const pivo = this.pivo(alvo, distancia, yaw, outOlhar);
    const dir = this.direcao(yaw, pitch, this.tmpDir2);
    const d = fisica ? this.distanciaLivre(pivo, dir.clone(), distancia, fisica, yaw) : distancia;
    outPos.copy(pivo).addScaledVector(dir, d);
    if (fisica) {
      const chao = fisica.relevo.altura(outPos.x, outPos.z) + 0.4;
      if (outPos.y < chao) outPos.y = chao;
    }
    return outPos;
  }

  atualizar(dt: number, alvo: THREE.Vector3, fisica: MundoFisico | null) {
    if (this.externo) return;
    this.foco.copy(alvo);
    this.focoSuave.x = damp(this.focoSuave.x, alvo.x, 14, dt);
    this.focoSuave.y = damp(this.focoSuave.y, alvo.y, 8, dt);
    this.focoSuave.z = damp(this.focoSuave.z, alvo.z, 14, dt);
    this.distancia = damp(this.distancia, this.distanciaAlvo, 8, dt);

    const pivo = this.pivo(this.focoSuave, this.distancia, this.yaw, this.tmpOrig);
    const dir = this.direcao(this.yaw, this.pitch, this.tmpDir);
    const d = fisica ? this.distanciaLivre(pivo, dir, this.distancia, fisica) : this.distancia;
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

  /**
   * Tremor curto (trovão, tranco da arca): `intensidade` 0..1 (≈ 25 cm no máximo) por
   * `segundos`, decaindo. Vale também em cinemáticas e trocas.
   */
  tremer(intensidade: number, segundos: number) {
    const e = this.efTremor;
    const restante = e.dur > 0 ? e.forca * (e.t / e.dur) : 0;
    if (intensidade >= restante) {
      e.forca = intensidade;
      e.t = e.dur = Math.max(0.05, segundos);
    }
  }

  /** Balanço contínuo (a arca no mar): `intensidade` 0..1; 0 desliga suavemente. */
  balanco(intensidade: number) {
    this.efBalancoAlvo = clamp(intensidade, 0, 1);
  }

  /** Tira os efeitos do quadro anterior (o Jogo chama no começo do quadro). */
  desfazerEfeitos() {
    if (!this.efAplicado) return;
    this.efAplicado = false;
    this.camera.position.sub(this.efPos);
    if (this.efRolar) this.camera.rotateZ(-this.efRolar);
  }

  /** Aplica tremor e balanço depois de todos os controladores da câmera (o Jogo chama). */
  aplicarEfeitos(dt: number) {
    this.desfazerEfeitos();
    this.efBalanco = damp(this.efBalanco, this.efBalancoAlvo, 1.2, dt);
    const e = this.efTremor;
    if (e.t > 0) e.t = Math.max(0, e.t - dt);
    const tremor = e.dur > 0 ? e.forca * (e.t / e.dur) : 0;
    const b = this.efBalanco < 0.002 ? 0 : this.efBalanco;
    if (tremor <= 0.0005 && !b) return;
    this.efFase += dt;
    const f = this.efFase;
    const k = tremor * 0.25;
    this.efPos.set(
      (Math.random() - 0.5) * k + Math.sin(f * 0.83) * 0.12 * b,
      (Math.random() - 0.5) * k + Math.sin(f * 1.31) * 0.18 * b,
      (Math.random() - 0.5) * k * 0.5,
    );
    this.efRolar = Math.sin(f * 0.9) * 0.045 * b + (Math.random() - 0.5) * tremor * 0.012;
    this.camera.position.add(this.efPos);
    if (this.efRolar) this.camera.rotateZ(this.efRolar);
    this.efAplicado = true;
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
