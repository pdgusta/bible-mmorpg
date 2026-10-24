import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** Ossos do esqueleto UAL2 usados pelo gerador de roupas e pelo animador. */
export const OSSOS = {
  pelvis: 'pelvis', spine1: 'spine_01', spine2: 'spine_02', spine3: 'spine_03', pescoco: 'neck_01', cabeca: 'Head',
  clavE: 'clavicle_l', bracoE: 'upperarm_l', antebracoE: 'lowerarm_l', maoE: 'hand_l',
  clavD: 'clavicle_r', bracoD: 'upperarm_r', antebracoD: 'lowerarm_r', maoD: 'hand_r',
  coxaE: 'thigh_l', pernaE: 'calf_l', peE: 'foot_l', dedoE: 'ball_l',
  coxaD: 'thigh_r', pernaD: 'calf_r', peD: 'foot_r', dedoD: 'ball_r',
} as const;
export type NomeOsso = keyof typeof OSSOS;

const INFERIORES = new Set(['root', 'pelvis', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'ball_leaf_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r', 'ball_leaf_r']);

/** Categoria de cor de cada vértice do corpo base. */
export const enum Pele {
  Pele = 0,
  Junta = 1,
  Sola = 2,
}

/**
 * Corpo base processado (um por tipo: masculino/feminino). Guarda a geometria unificada no
 * espaço de ligação (bind), as posições das juntas, um perfil do corpo por fatias (para a roupa
 * não atravessar a pele) e os clipes divididos em parte inferior e superior.
 */
export class CorpoBase {
  readonly cenaModelo: THREE.Object3D;
  readonly posicoes: Float32Array;
  readonly normais: Float32Array;
  readonly indicesPele: Uint16Array | Uint32Array;
  readonly skinIndex: Uint16Array;
  readonly skinWeight: Float32Array;
  readonly categoria: Uint8Array;
  readonly bindMatrix: THREE.Matrix4;
  readonly nomesOssos: string[];
  readonly juntas = new Map<string, THREE.Vector3>();
  readonly clipsInferiores = new Map<string, THREE.AnimationClip>();
  readonly clipsSuperiores = new Map<string, THREE.AnimationClip>();
  readonly clipsCompletos = new Map<string, THREE.AnimationClip>();
  /** Altura (y) da sola dos pés e do topo da cabeça original, no espaço bind. */
  readonly ySola: number;
  readonly yTopo: number;
  private perfil: Float32Array;
  private perfilY0: number;
  private perfilPasso = 0.03;
  private perfilFatias: number;
  static readonly SETORES = 32;

  constructor(gltf: GLTF, clips: THREE.AnimationClip[]) {
    this.cenaModelo = gltf.scene;
    const malhas: THREE.SkinnedMesh[] = [];
    gltf.scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) malhas.push(o as THREE.SkinnedMesh);
    });
    if (!malhas.length) throw new Error('Corpo base sem SkinnedMesh');
    const principal = malhas[0];
    gltf.scene.updateMatrixWorld(true);
    principal.skeleton.pose();
    gltf.scene.updateMatrixWorld(true);
    this.bindMatrix = principal.bindMatrix.clone();
    const ossos = principal.skeleton.bones;
    this.nomesOssos = ossos.map((b) => b.name);
    const bindInv = principal.bindMatrix.clone().invert();

    // juntas em espaço bind: posição de mundo do osso na pose de ligação, levada ao espaço do bind
    for (const b of ossos) {
      const p = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(bindInv);
      this.juntas.set(b.name, p);
    }

    // unifica as malhas (pele e juntas do manequim) numa só geometria
    const pos: number[] = [];
    const nor: number[] = [];
    const si: number[] = [];
    const sw: number[] = [];
    const cat: number[] = [];
    const idx: number[] = [];
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const invBind1 = principal.skeleton.boneInverses.map((m) => m.clone().invert());
    malhas.forEach((m, mi) => {
      const g = m.geometry;
      const ap = g.attributes.position;
      const an = g.attributes.normal;
      const ai = g.attributes.skinIndex;
      const aw = g.attributes.skinWeight;
      const mapa = m.skeleton.bones.map((b) => ossos.indexOf(b));
      // Cada malha pode ter suas próprias matrizes inversas de ligação. Levamos os vértices
      // para a ligação da malha principal: v' = bind1⁻¹ · Σ wₖ (B1ⱼ⁻¹ · B2ᵢ) · bind2 · v
      const porOsso = m.skeleton.boneInverses.map((b2, i) => {
        const j = mapa[i];
        return j >= 0 ? new THREE.Matrix4().multiplyMatrices(invBind1[j], b2) : new THREE.Matrix4();
      });
      const acum = new THREE.Matrix4();
      const tmpM = new THREE.Matrix4();
      const base = pos.length / 3;
      for (let i = 0; i < ap.count; i++) {
        acum.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        for (let k = 0; k < 4; k++) {
          const w = aw.getComponent(i, k);
          if (w <= 0) continue;
          tmpM.copy(porOsso[ai.getComponent(i, k)]);
          const e = tmpM.elements;
          for (let q = 0; q < 16; q++) acum.elements[q] += e[q] * w;
        }
        const conv = new THREE.Matrix4().multiplyMatrices(bindInv, acum).multiply(m.bindMatrix);
        v.fromBufferAttribute(ap, i).applyMatrix4(conv);
        n.fromBufferAttribute(an, i).applyMatrix3(new THREE.Matrix3().getNormalMatrix(conv)).normalize();
        pos.push(v.x, v.y, v.z);
        nor.push(n.x, n.y, n.z);
        for (let k = 0; k < 4; k++) {
          si.push(Math.max(0, mapa[ai.getComponent(i, k)]));
          sw.push(aw.getComponent(i, k));
        }
        cat.push(mi === 0 ? Pele.Pele : Pele.Junta);
      }
      const ix = g.index!;
      for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
    });
    this.posicoes = new Float32Array(pos);
    this.normais = new Float32Array(nor);
    this.skinIndex = new Uint16Array(si);
    this.skinWeight = new Float32Array(sw);
    this.categoria = new Uint8Array(cat);
    this.indicesPele = this.posicoes.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);

    let ySola = Infinity;
    let yTopo = -Infinity;
    for (let i = 1; i < this.posicoes.length; i += 3) {
      ySola = Math.min(ySola, this.posicoes[i]);
      yTopo = Math.max(yTopo, this.posicoes[i]);
    }
    this.ySola = ySola;
    this.yTopo = yTopo;
    // solas: vértices do pé abaixo do tornozelo
    const iPeE = this.nomesOssos.indexOf('foot_l');
    const iPeD = this.nomesOssos.indexOf('foot_r');
    const iDedoE = this.nomesOssos.indexOf('ball_l');
    const iDedoD = this.nomesOssos.indexOf('ball_r');
    for (let i = 0; i < this.categoria.length; i++) {
      const y = this.posicoes[i * 3 + 1];
      const dom = this.dominante(i);
      if ((dom === iPeE || dom === iPeD || dom === iDedoE || dom === iDedoD) && y < ySola + 0.045) this.categoria[i] = Pele.Sola;
    }

    this.perfilY0 = ySola;
    this.perfilFatias = Math.ceil((yTopo - ySola) / this.perfilPasso) + 1;
    this.perfil = new Float32Array(this.perfilFatias * CorpoBase.SETORES);
    this.construirPerfil();

    for (const c of clips) this.dividirClip(c);
  }

  dominante(i: number): number {
    let melhor = 0;
    let peso = -1;
    for (let k = 0; k < 4; k++) {
      const w = this.skinWeight[i * 4 + k];
      if (w > peso) { peso = w; melhor = this.skinIndex[i * 4 + k]; }
    }
    return melhor;
  }

  junta(nome: string): THREE.Vector3 {
    const j = this.juntas.get(nome);
    if (!j) throw new Error(`Osso ausente: ${nome}`);
    return j;
  }

  indiceOsso(nome: string): number {
    const i = this.nomesOssos.indexOf(nome);
    if (i < 0) throw new Error(`Osso ausente: ${nome}`);
    return i;
  }

  /** Raio máximo do tronco/pernas (sem braços e cabeça) por fatia de altura e setor angular. */
  private construirPerfil() {
    const S = CorpoBase.SETORES;
    const cabeca = this.indiceOsso('Head');
    const pescoco = this.junta('neck_01').y;
    const ombro = this.junta('upperarm_l').x * 1.05;
    const quadril = this.junta('pelvis').y;
    const bracos = new Set(['upperarm_l', 'lowerarm_l', 'hand_l', 'upperarm_r', 'lowerarm_r', 'hand_r'].map((n) => this.indiceOsso(n)));
    for (let i = 0; i < this.categoria.length; i++) {
      const x = this.posicoes[i * 3];
      const y = this.posicoes[i * 3 + 1];
      const z = this.posicoes[i * 3 + 2];
      const dom = this.dominante(i);
      if (dom === cabeca || y > pescoco + 0.02) continue;
      if (bracos.has(dom) && Math.abs(x) > ombro * 0.95) continue;
      if (y > quadril + 0.2 && Math.abs(x) > ombro) continue;
      const f = Math.round((y - this.perfilY0) / this.perfilPasso);
      if (f < 0 || f >= this.perfilFatias) continue;
      const ang = Math.atan2(x, z);
      const s = ((Math.round((ang / (Math.PI * 2)) * S) % S) + S) % S;
      const r = Math.hypot(x, z);
      const k = f * S + s;
      if (r > this.perfil[k]) this.perfil[k] = r;
    }
    // espalha para setores vizinhos (suaviza buracos)
    const copia = this.perfil.slice();
    for (let f = 0; f < this.perfilFatias; f++) {
      for (let s = 0; s < S; s++) {
        let m = 0;
        for (let d = -1; d <= 1; d++) m = Math.max(m, copia[f * S + ((s + d + S) % S)]);
        this.perfil[f * S + s] = m;
      }
    }
  }

  private perfilBraco: Float32Array | null = null;

  /** Eixo do braço esquerdo (o direito é espelhado em x) na coordenada |x|. */
  eixoBraco(ax: number): THREE.Vector3 {
    const o = this.junta('upperarm_l');
    const m = this.junta('hand_l');
    const t = Math.min(1, Math.max(0, (ax - o.x) / (m.x - o.x)));
    return new THREE.Vector3(ax, o.y + (m.y - o.y) * t, o.z + (m.z - o.z) * t);
  }

  /** Raio do braço (distância máxima dos vértices ao eixo) na coordenada |x|. */
  raioBraco(ax: number): number {
    if (!this.perfilBraco) {
      const passo = 0.01;
      const n = 120;
      const arr = new Float32Array(n);
      const bracos = new Set(['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r'].map((x) => this.indiceOsso(x)));
      const ombro = this.junta('upperarm_l').x;
      for (let i = 0; i < this.categoria.length; i++) {
        if (!bracos.has(this.dominante(i))) continue;
        const x = Math.abs(this.posicoes[i * 3]);
        if (x < ombro * 0.9) continue;
        const e = this.eixoBraco(x);
        const r = Math.hypot(this.posicoes[i * 3 + 1] - e.y, this.posicoes[i * 3 + 2] - e.z);
        const k = Math.round(x / passo);
        if (k < n && r > arr[k]) arr[k] = r;
      }
      for (let k = 1; k < n - 1; k++) arr[k] = Math.max(arr[k], (arr[k - 1] + arr[k + 1]) * 0.5);
      this.perfilBraco = arr;
    }
    const k = Math.min(this.perfilBraco.length - 1, Math.max(0, Math.round(ax / 0.01)));
    let m = 0;
    for (let d = -2; d <= 2; d++) m = Math.max(m, this.perfilBraco[Math.min(this.perfilBraco.length - 1, Math.max(0, k + d))]);
    return m;
  }

  /** Raio do corpo na altura y e ângulo (atan2(x,z)). */
  raioCorpo(y: number, ang: number, janela = 0.04): number {
    const S = CorpoBase.SETORES;
    const s = ((Math.round((ang / (Math.PI * 2)) * S) % S) + S) % S;
    const f0 = Math.floor((y - janela - this.perfilY0) / this.perfilPasso);
    const f1 = Math.ceil((y + janela - this.perfilY0) / this.perfilPasso);
    let m = 0;
    for (let f = Math.max(0, f0); f <= Math.min(this.perfilFatias - 1, f1); f++) m = Math.max(m, this.perfil[f * S + s]);
    return m;
  }

  private dividirClip(c: THREE.AnimationClip) {
    const inf: THREE.KeyframeTrack[] = [];
    const sup: THREE.KeyframeTrack[] = [];
    // a raiz não é animada no jogo (movimento vem da física); evita escala/posição divergentes
    const trilhas = c.tracks.filter((t) => t.name.split('.')[0] !== 'root');
    for (const t of trilhas) {
      const osso = t.name.split('.')[0];
      (INFERIORES.has(osso) ? inf : sup).push(t);
    }
    c = new THREE.AnimationClip(c.name, c.duration, trilhas);
    this.clipsCompletos.set(c.name, c);
    this.clipsInferiores.set(c.name, new THREE.AnimationClip(`${c.name}#inf`, c.duration, inf));
    this.clipsSuperiores.set(c.name, new THREE.AnimationClip(`${c.name}#sup`, c.duration, sup));
  }
}
