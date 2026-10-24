import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CorpoBase } from './CorpoBase';
import { Animador } from './Animador';
import { gerarPersonagem, type Aparencia } from './Vestimenta';
import { criarAderecos, type NomeAderecos } from './Aderecos';
import { clamp } from '../../core/util';
import { simplificadorPronto, simplificarIndice } from '../../render/Simplificar';

/** Material único compartilhado por todos os humanos (cores vêm dos vértices). */
let materialHumanos: THREE.MeshLambertMaterial | null = null;
function material() {
  if (!materialHumanos) {
    materialHumanos = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    materialHumanos.name = 'humanos';
  }
  return materialHumanos;
}

export type Mao = 'direita' | 'esquerda' | 'costas';

/** Fração dos triângulos do corpo no nível de longe, que é também o da sombra. */
const FRACAO_LONGE = 0.25;

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * Personagem humano visível: corpo base vestido por código + animador + objetos nas mãos.
 * A raiz fica nos pés; o jogo move/gira a `raiz`.
 */
export class Humano {
  readonly raiz = new THREE.Group();
  readonly modelo: THREE.Object3D;
  readonly malha: THREE.SkinnedMesh;
  readonly animador: Animador;
  readonly ossos = new Map<string, THREE.Bone>();
  readonly aparencia: Aparencia;
  private base: CorpoBase;
  private anexos = new Map<Mao, THREE.Object3D>();
  /** Ponto que a cabeça procura olhar (mundo), ou null. */
  olharPara: THREE.Vector3 | null = null;
  private pesoOlhar = 0;
  /** Pose de oração: 0 = nenhuma, 1 = mãos erguidas. */
  oracao = 0;
  private alvoOracao = 0;
  /** Pose de escalar (braços alternando para cima). */
  escalando = false;
  private faseEscalada = 0;
  private pesoEscalada = 0;
  visivel = true;
  /** Distância (m) da câmera em que o corpo passa ao nível de longe (volta ao de perto 2 m antes). */
  static distanciaLonge = 18;
  private longe = false;
  private descartado = false;

  constructor(base: CorpoBase, aparencia: Aparencia) {
    this.base = base;
    this.aparencia = aparencia;
    this.modelo = SkeletonUtils.clone(base.cenaModelo);
    let original: THREE.SkinnedMesh | null = null;
    const remover: THREE.Object3D[] = [];
    this.modelo.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.ossos.set(o.name, o as THREE.Bone);
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        if (!original) original = o as THREE.SkinnedMesh;
        remover.push(o);
      }
    });
    if (!original) throw new Error('modelo humano sem malha');
    const orig = original as THREE.SkinnedMesh;
    const geo = gerarPersonagem(base, aparencia);
    this.malha = new THREE.SkinnedMesh(geo, material());
    this.malha.name = 'corpo';
    this.malha.castShadow = true;
    this.malha.receiveShadow = true;
    this.malha.frustumCulled = false;
    orig.parent!.add(this.malha);
    const ossos = base.nomesOssos.map((n) => this.ossos.get(n)!);
    this.malha.bind(new THREE.Skeleton(ossos, orig.skeleton.boneInverses.map((m) => m.clone())), base.bindMatrix.clone());
    for (const o of remover) o.parent?.remove(o);
    const escala = aparencia.altura / (base.yTopo - base.ySola);
    this.modelo.scale.setScalar(escala);
    // o modelo original tem a origem no centro do corpo: apoia os pés em y = 0
    this.modelo.position.y = -base.ySola * escala;
    this.raiz.add(this.modelo);
    this.animador = new Animador(this.modelo, base);
    this.animador.atualizar(0);
    void simplificadorPronto.then(() => this.prepararLod());
  }

  /**
   * LOD do corpo: o índice simplificado vai depois do original no mesmo buffer, e cada passada
   * escolhe a faixa (drawRange). A de cor usa o de longe a partir de `distanciaLonge`; a de sombra,
   * sempre (não há draw call nem malha a mais).
   */
  private prepararLod() {
    if (this.descartado) return;
    const g = this.malha.geometry;
    const perto = g.index!.array;
    const longe = simplificarIndice(g, FRACAO_LONGE, { coerencia: 'color', erro: 0.01 });
    if (!longe) return;
    const ind = new Uint32Array(perto.length + longe.length);
    ind.set(perto);
    ind.set(longe, perto.length);
    g.setIndex(new THREE.BufferAttribute(ind, 1));
    g.setDrawRange(0, perto.length);
    const nPerto = perto.length;
    const nLonge = longe.length;
    this.malha.onBeforeRender = (_r, _c, camera, geometria) => {
      const e = this.malha.matrixWorld.elements;
      const d = Math.hypot(camera.position.x - e[12], camera.position.y - e[13], camera.position.z - e[14]);
      this.longe = d > Humano.distanciaLonge - (this.longe ? 2 : 0);
      if (this.longe) geometria.setDrawRange(nPerto, nLonge);
      else geometria.setDrawRange(0, nPerto);
    };
    this.malha.onBeforeShadow = (_r, _o, _c, _sc, geometria) => geometria.setDrawRange(nPerto, nLonge);
  }

  /** Coloca um objeto na mão (ou nas costas). null remove. */
  segurar(nome: NomeAderecos | null, mao: Mao = 'direita') {
    const antigo = this.anexos.get(mao);
    if (antigo) {
      antigo.parent?.remove(antigo);
      this.anexos.delete(mao);
    }
    if (!nome) return;
    const { objeto, posicao, rotacao, osso: nomeOsso } = criarAderecos(nome, mao, this.base);
    const osso = this.ossos.get(nomeOsso);
    if (!osso) return;
    // posição definida no espaço de ligação (T-pose); convertida para o espaço local do osso
    const i = this.base.indiceOsso(nomeOsso);
    const inv = this.malha.skeleton.boneInverses[i];
    const P = new THREE.Matrix4().compose(posicao, new THREE.Quaternion().setFromEuler(rotacao), new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().multiplyMatrices(inv, this.malha.bindMatrix).multiply(P);
    objeto.matrixAutoUpdate = false;
    objeto.matrix.copy(local);
    osso.add(objeto);
    this.anexos.set(mao, objeto);
  }

  segurando(mao: Mao = 'direita') {
    return this.anexos.get(mao)?.name ?? null;
  }

  atualizar(dt: number, distanciaCamera = 0) {
    // NPCs longe: anima em taxa menor
    this.animador.atualizar(dt);
    this.raiz.updateMatrixWorld(true);
    this.alvoOracao = this.oracao;
    this.posProcedural(dt, distanciaCamera);
  }

  /** Ajustes procedurais depois do mixer: olhar, oração e escalada. */
  private posProcedural(dt: number, distancia: number) {
    if (distancia > 45) return;
    const cabeca = this.ossos.get('Head');
    const pescoco = this.ossos.get('neck_01');
    // olhar: gira a cabeça (no espaço do corpo) em direção ao alvo, com limites
    const alvoPeso = this.olharPara ? 1 : 0;
    this.pesoOlhar += (alvoPeso - this.pesoOlhar) * Math.min(1, dt * 4);
    if (cabeca && pescoco && this.pesoOlhar > 0.01 && this.olharPara) {
      const qRaiz = this.raiz.getWorldQuaternion(_q2);
      const inv = qRaiz.clone().invert();
      cabeca.getWorldPosition(_v);
      const d = _v2.copy(this.olharPara).sub(_v).applyQuaternion(inv);
      const yawBruto = Math.atan2(d.x, d.z);
      if (Math.abs(yawBruto) < 1.9 && d.lengthSq() > 0.01) {
        const yaw = clamp(yawBruto, -1.05, 1.05);
        const pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.45, 0.5);
        const extraLocal = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
        const extra = qRaiz.clone().multiply(extraLocal).multiply(inv);
        const identidade = new THREE.Quaternion();
        identidade.slerp(extra, this.pesoOlhar * 0.85);
        const mundo = cabeca.getWorldQuaternion(_q);
        const novo = identidade.multiply(mundo);
        const paiInv = cabeca.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
        cabeca.quaternion.copy(paiInv.multiply(novo));
        cabeca.updateMatrixWorld(true);
      }
    }
    // oração: braços erguidos para o céu e cabeça levemente erguida
    this.pesoOracao += (this.alvoOracao - this.pesoOracao) * Math.min(1, dt * 3);
    if (this.pesoOracao > 0.01) {
      for (const [b, a] of [['upperarm_l', 'lowerarm_l'], ['upperarm_r', 'lowerarm_r']] as const) {
        const braco = this.ossos.get(b);
        const ante = this.ossos.get(a);
        if (!braco || !ante) continue;
        const lado = b.endsWith('_l') ? 1 : -1;
        const dir = new THREE.Vector3(0.3 * lado, 0.35, 0.85).applyQuaternion(this.raiz.getWorldQuaternion(_q2)).normalize();
        this.girarOssoParaDirecao(braco, dir, this.pesoOracao * 0.85, ante);
        const dir2 = new THREE.Vector3(0.12 * lado, 0.9, 0.42).applyQuaternion(this.raiz.getWorldQuaternion(_q2)).normalize();
        this.girarOssoParaDirecao(ante, dir2, this.pesoOracao * 0.8, this.ossos.get(lado > 0 ? 'hand_l' : 'hand_r'));
      }
    }
    // escalada: braços alternam para cima
    this.pesoEscalada += ((this.escalando ? 1 : 0) - this.pesoEscalada) * Math.min(1, dt * 6);
    if (this.pesoEscalada > 0.01) {
      this.faseEscalada += dt * 5 * (this.animador.velocidade > 0.1 ? 1 : 0);
      for (const [b, a, f] of [['upperarm_l', 'lowerarm_l', 0], ['upperarm_r', 'lowerarm_r', Math.PI]] as const) {
        const braco = this.ossos.get(b);
        const ante = this.ossos.get(a);
        if (!braco || !ante) continue;
        const lado = b.endsWith('_l') ? 1 : -1;
        const alto = 0.65 + Math.sin(this.faseEscalada + f) * 0.35;
        const dir = new THREE.Vector3(0.3 * lado, alto, 0.6).applyQuaternion(this.raiz.getWorldQuaternion(_q2)).normalize();
        this.girarOssoParaDirecao(braco, dir, this.pesoEscalada, ante);
      }
      // pernas: cada joelho sobe em oposição ao braço do mesmo lado (apoio nos degraus)
      for (const [b, a, f] of [['thigh_l', 'calf_l', Math.PI], ['thigh_r', 'calf_r', 0]] as const) {
        const coxa = this.ossos.get(b);
        const canela = this.ossos.get(a);
        if (!coxa || !canela) continue;
        const lado = b.endsWith('_l') ? 1 : -1;
        const ergue = Math.max(0, Math.sin(this.faseEscalada + f)) * 0.75 + 0.15;
        const qr = this.raiz.getWorldQuaternion(_q2);
        const dirCoxa = new THREE.Vector3(0.1 * lado, -1 + ergue, ergue * 0.9).applyQuaternion(qr).normalize();
        this.girarOssoParaDirecao(coxa, dirCoxa, this.pesoEscalada * 0.9, canela);
        const dirCanela = new THREE.Vector3(0.04 * lado, -1, -0.15 - ergue * 0.2).applyQuaternion(qr).normalize();
        this.girarOssoParaDirecao(canela, dirCanela, this.pesoEscalada * 0.8, this.ossos.get(lado > 0 ? 'foot_l' : 'foot_r'));
      }
    }
  }
  private pesoOracao = 0;

  /**
   * Gira um osso para que a direção até o filho (ou o eixo "para frente" da cabeça) aponte
   * para `dir` (mundo), misturando pelo peso.
   */
  private girarOssoParaDirecao(osso: THREE.Bone, dir: THREE.Vector3, peso: number, filho?: THREE.Object3D) {
    osso.updateMatrixWorld(true);
    const f = filho ?? osso.children[0];
    if (!f) return;
    const qMundo = osso.getWorldQuaternion(new THREE.Quaternion());
    const pf = f.getWorldPosition(new THREE.Vector3());
    const po = osso.getWorldPosition(new THREE.Vector3());
    const atual = pf.sub(po).normalize();
    const delta = new THREE.Quaternion().setFromUnitVectors(atual, dir);
    const novoMundo = delta.multiply(qMundo);
    const paiInv = osso.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    osso.quaternion.slerp(paiInv.multiply(novoMundo), clamp(peso, 0, 1));
    osso.updateMatrixWorld(true);
  }

  /** Posição de mundo de um osso. */
  posicaoOsso(nome: string, out = new THREE.Vector3()) {
    const o = this.ossos.get(nome);
    if (o) o.getWorldPosition(out);
    return out;
  }

  dispose() {
    this.descartado = true;
    this.malha.geometry.dispose();
    this.animador.dispose();
    for (const a of this.anexos.values()) a.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}

