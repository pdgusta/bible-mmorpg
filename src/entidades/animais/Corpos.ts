import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { aplicarPatch } from '../../render/Shaders';
import { Marcha, articulacaoDireta, articulacaoModelo, type Articulacao, type DefMarcha, type PoseAnimal } from './Marcha';
import { materialProcedural } from './Montador';
import type { ModeloProcedural } from './procedurais';
import { clamp, damp } from '../../core/util';

/** Parte visual de um animal: malha esqueletal + animação. O Animal cuida da lógica e da física. */
export interface CorpoAnimal {
  /** Raiz visual (filha da raiz do Animal); já corrige a orientação do modelo para +Z. */
  readonly raiz: THREE.Object3D;
  readonly malha: THREE.SkinnedMesh;
  /** Osso da cabeça (olhar, prender objetos, pousar). */
  readonly cabeca: THREE.Object3D | null;
  atualizar(dt: number, p: PoseAnimal): void;
  /** Troca o material (fade/tom) mantendo a geometria. */
  definirMaterial(m: THREE.Material): void;
  dispose(): void;
}

// ------------------------------------------------------------------ procedural -------

interface MoldeProcedural {
  geometria: THREE.BufferGeometry;
  ossos: THREE.Bone[];
  marcha: DefMarcha;
  cabeca: string;
  triangulos: number;
}

const moldesProcedurais = new Map<string, MoldeProcedural>();

export function moldeProcedural(chave: string, construir: () => ModeloProcedural): MoldeProcedural {
  let m = moldesProcedurais.get(chave);
  if (!m) {
    const mp = construir();
    const malha = mp.montador.construir();
    m = { geometria: malha.geometry, ossos: mp.montador.ossos, marcha: mp.marcha, cabeca: mp.cabeca, triangulos: mp.montador.triangulos };
    // os ossos do molde ficam soltos (não estão em cena); cada instância os clona
    malha.remove(mp.montador.ossos[0]);
    moldesProcedurais.set(chave, m);
  }
  return m;
}

export class CorpoProcedural implements CorpoAnimal {
  readonly raiz = new THREE.Group();
  readonly malha: THREE.SkinnedMesh;
  readonly cabeca: THREE.Object3D | null;
  readonly marcha: Marcha;
  readonly triangulos: number;

  constructor(molde: MoldeProcedural, semente: number) {
    const raizOssos = molde.ossos[0].clone(true) as THREE.Bone;
    const porNome = new Map<string, THREE.Bone>();
    raizOssos.traverse((o) => porNome.set(o.name, o as THREE.Bone));
    const ossos = molde.ossos.map((b) => porNome.get(b.name)!);
    this.malha = new THREE.SkinnedMesh(molde.geometria, materialProcedural());
    this.malha.add(raizOssos);
    this.malha.castShadow = true;
    this.malha.updateMatrixWorld(true);
    this.malha.bind(new THREE.Skeleton(ossos));
    this.raiz.add(this.malha);
    const juntas = new Map<string, Articulacao>();
    for (const b of ossos) juntas.set(b.name, articulacaoDireta(b));
    this.marcha = new Marcha(molde.marcha, juntas, semente);
    this.cabeca = porNome.get(molde.cabeca) ?? null;
    this.triangulos = molde.triangulos;
  }

  atualizar(dt: number, p: PoseAnimal) {
    this.marcha.atualizar(dt, p);
  }

  definirMaterial(m: THREE.Material) {
    this.malha.material = m;
  }

  dispose() {
    this.malha.skeleton.dispose();
  }
}

// ------------------------------------------------------------------ glTF -------------

/** Modelo glTF processado: todas as peças fundidas numa geometria com cor por vértice. */
export interface MoldeGLB {
  geometria: THREE.BufferGeometry;
  nomesOssos: string[];
  inversas: THREE.Matrix4[];
  /** Hierarquia de nós (sem malhas) para clonar. */
  esqueleto: THREE.Object3D;
  clipes: THREE.AnimationClip[];
  material: THREE.MeshLambertMaterial;
  triangulos: number;
}

export interface ConfigGLB {
  arquivo: string;
  /** Distingue variantes do mesmo arquivo (ex.: 'boi' usa o modelo da vaca com outra paleta). */
  chave?: string;
  /** Giro em Y para o modelo olhar para +Z. */
  giro?: number;
  /** Cores (sRGB) que substituem as dos materiais do arquivo, por nome do material. */
  paleta?: Record<string, string>;
  /** Clipes por papel. */
  clipes: { parado: string; andar?: string; correr?: string; voar?: string; pulo?: string };
  /** Velocidade (m/s) em que o clipe de andar/correr não escorrega. */
  velAndarClipe?: number;
  velCorrerClipe?: number;
  /** Marcha procedural quando o modelo não tem clipe de andar (ossos do glTF). */
  marcha?: DefMarcha;
  /** Ossos de cabeça/pescoço do arquivo (para pastar, alerta, olhar). */
  cabeca?: string;
  pescoco?: string[];
  cauda?: string[];
}

const moldesGLB = new Map<string, Promise<MoldeGLB>>();

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _acc = new THREE.Matrix4();
const _nm = new THREE.Matrix3();
const _cor = new THREE.Color();

/** Clareia pretos absolutos e aquece um pouco as cores dos modelos para o estilo do jogo. */
function suavizar(c: THREE.Color) {
  const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  if (lum < 0.03) c.lerp(_cor.setRGB(0.035, 0.028, 0.024), 0.85);
  return c;
}

export function carregarMoldeGLB(gltfP: Promise<GLTF>, cfg: ConfigGLB): Promise<MoldeGLB> {
  const chave = cfg.arquivo + '|' + (cfg.chave ?? '');
  let p = moldesGLB.get(chave);
  if (!p) {
    p = gltfP.then((gltf) => fundirGLB(gltf, cfg));
    moldesGLB.set(chave, p);
  }
  return p;
}

function fundirGLB(gltf: GLTF, cfg: ConfigGLB): MoldeGLB {
  const cena = gltf.scene;
  cena.updateMatrixWorld(true);
  const pecas: THREE.SkinnedMesh[] = [];
  cena.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) pecas.push(o as THREE.SkinnedMesh);
  });
  if (!pecas.length) throw new Error(`Modelo sem malha esqueletal: ${cfg.arquivo}`);
  // ossos unificados (as peças compartilham os mesmos nós)
  const ossos: THREE.Bone[] = [];
  for (const pc of pecas) for (const b of pc.skeleton.bones) if (!ossos.includes(b)) ossos.push(b);
  const pos: number[] = [];
  const nor: number[] = [];
  const cor: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const paleta = new Map<string, THREE.Color>();
  for (const [k, v] of Object.entries(cfg.paleta ?? {})) paleta.set(k, new THREE.Color(v));
  let tris = 0;
  for (const pc of pecas) {
    const g = pc.geometry;
    const ap = g.attributes.position;
    const an = g.attributes.normal;
    const ac = g.attributes.color as THREE.BufferAttribute | undefined;
    const ai = g.attributes.skinIndex;
    const aw = g.attributes.skinWeight;
    const mat = pc.material as THREE.MeshStandardMaterial;
    const corMat = suavizar((paleta.get(mat.name) ?? mat.color).clone());
    const mapa = pc.skeleton.bones.map((b) => ossos.indexOf(b));
    const indices = g.index ? Array.from(g.index.array as ArrayLike<number>) : Array.from({ length: ap.count }, (_, i) => i);
    tris += indices.length / 3;
    for (const i of indices) {
      // posição deformada na pose atual, em espaço de mundo do modelo
      pc.getVertexPosition(i, _v).applyMatrix4(pc.matrixWorld);
      // matriz de deformação para a normal
      _acc.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = aw.getComponent(i, k);
        if (w <= 0) continue;
        const bi = ai.getComponent(i, k);
        _m.multiplyMatrices(pc.skeleton.bones[bi].matrixWorld, pc.skeleton.boneInverses[bi]).multiply(pc.bindMatrix);
        for (let q = 0; q < 16; q++) _acc.elements[q] += _m.elements[q] * w;
      }
      _n.fromBufferAttribute(an, i).applyMatrix3(_nm.getNormalMatrix(_acc)).normalize();
      pos.push(_v.x, _v.y, _v.z);
      nor.push(_n.x, _n.y, _n.z);
      _cor.copy(corMat);
      if (ac) _cor.multiply(new THREE.Color(ac.getX(i), ac.getY(i), ac.getZ(i)));
      cor.push(_cor.r, _cor.g, _cor.b);
      for (let k = 0; k < 4; k++) {
        si.push(Math.max(0, mapa[ai.getComponent(i, k)]));
        sw.push(aw.getComponent(i, k));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const inversas = ossos.map((b) => b.matrixWorld.clone().invert());
  // esqueleto sem malhas
  const esqueleto = cena.clone(true);
  const remover: THREE.Object3D[] = [];
  esqueleto.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) remover.push(o);
  });
  for (const o of remover) o.removeFromParent();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, name: 'animal_' + cfg.arquivo + (cfg.chave ?? '') });
  aplicarPatch(material, { revelar: true });
  return { geometria: geo, nomesOssos: ossos.map((b) => b.name), inversas, esqueleto, clipes: gltf.animations, material, triangulos: tris };
}

export class CorpoGLB implements CorpoAnimal {
  readonly raiz = new THREE.Group();
  readonly malha: THREE.SkinnedMesh;
  readonly cabeca: THREE.Object3D | null;
  readonly molde: MoldeGLB;
  private cfg: ConfigGLB;
  private modelo: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private acParado: THREE.AnimationAction;
  private acAndar: THREE.AnimationAction | null = null;
  private acCorrer: THREE.AnimationAction | null = null;
  private acVoar: THREE.AnimationAction | null = null;
  private marcha: Marcha | null = null;
  private pAndar = 0;
  private pCorrer = 0;
  private pVoar = 0;
  private tremor = new THREE.Vector3();

  constructor(molde: MoldeGLB, cfg: ConfigGLB, semente: number) {
    this.molde = molde;
    this.cfg = cfg;
    this.modelo = molde.esqueleto.clone(true);
    this.modelo.rotation.y = cfg.giro ?? 0;
    const porNome = new Map<string, THREE.Object3D>();
    this.modelo.traverse((o) => {
      if (o.name && !porNome.has(o.name)) porNome.set(o.name, o);
    });
    const ossos = molde.nomesOssos.map((n) => porNome.get(n) as THREE.Bone);
    this.malha = new THREE.SkinnedMesh(molde.geometria, molde.material);
    this.malha.castShadow = true;
    this.modelo.add(this.malha);
    this.raiz.add(this.modelo);
    this.malha.bind(new THREE.Skeleton(ossos, molde.inversas), new THREE.Matrix4());
    this.mixer = new THREE.AnimationMixer(this.modelo);
    const clipe = (nome?: string) => (nome ? molde.clipes.filter((c) => c.name === nome).sort((a, b) => b.tracks.length - a.tracks.length)[0] ?? null : null);
    const acao = (nome?: string) => {
      const c = clipe(nome);
      if (!c) return null;
      const a = this.mixer.clipAction(c);
      a.play();
      a.setEffectiveWeight(0);
      return a;
    };
    this.acParado = acao(cfg.clipes.parado)!;
    this.acParado.setEffectiveWeight(1);
    this.acParado.time = (semente * 7.3) % this.acParado.getClip().duration;
    this.acAndar = acao(cfg.clipes.andar);
    this.acCorrer = acao(cfg.clipes.correr);
    this.acVoar = acao(cfg.clipes.voar);
    this.cabeca = cfg.cabeca ? porNome.get(cfg.cabeca) ?? null : null;
    // marcha procedural (pernas sem clipe) + cabeça/pescoço/cauda sobre os clipes
    const juntas = new Map<string, Articulacao>();
    const def: DefMarcha = cfg.marcha ?? {
      pernas: [], passada: 1, passadaCorrida: 2, amplitude: 0, amplitudeCorrida: 0, joelho: 0, velRef: 1, corpo: '',
      quique: 0,
    };
    def.cabeca ??= cfg.cabeca;
    def.pescoco ??= cfg.pescoco;
    def.cauda ??= cfg.cauda;
    const nomes = new Set<string>();
    for (const p of def.pernas) {
      nomes.add(p.coxa);
      if (p.canela) nomes.add(p.canela);
    }
    for (const n of [def.cabeca, ...(def.pescoco ?? []), ...(def.cauda ?? [])]) if (n) nomes.add(n);
    this.modelo.updateMatrixWorld(true);
    for (const n of nomes) {
      const o = porNome.get(n);
      if (o) juntas.set(n, articulacaoModelo(o, this.modelo));
    }
    this.marcha = new Marcha({ ...def, corpo: '', cauda: def.cauda && cfg.clipes.andar ? [] : def.cauda }, juntas, semente);
  }

  atualizar(dt: number, p: PoseAnimal) {
    const cfg = this.cfg;
    const vA = cfg.velAndarClipe ?? 0.6;
    const vC = cfg.velCorrerClipe ?? 2.5;
    const voando = p.voo > 0.5 || p.planar > 0.5;
    const alvoVoar = this.acVoar && voando ? 1 : 0;
    const movendo = clamp(p.vel / Math.max(0.15, vA * 0.6), 0, 1);
    const alvoCorrer = this.acCorrer ? clamp(p.correr, 0, 1) * movendo : 0;
    const alvoAndar = this.acAndar ? movendo * (1 - alvoCorrer) : 0;
    this.pVoar = damp(this.pVoar, alvoVoar, 8, dt);
    this.pAndar = damp(this.pAndar, alvoAndar * (1 - alvoVoar), 8, dt);
    this.pCorrer = damp(this.pCorrer, alvoCorrer * (1 - alvoVoar), 8, dt);
    const pParado = Math.max(0, 1 - this.pAndar - this.pCorrer - this.pVoar);
    this.acParado.setEffectiveWeight(pParado);
    if (this.acAndar) {
      this.acAndar.setEffectiveWeight(this.pAndar);
      this.acAndar.timeScale = clamp(p.vel / vA, 0.6, 2.4);
    }
    if (this.acCorrer) {
      this.acCorrer.setEffectiveWeight(this.pCorrer);
      this.acCorrer.timeScale = clamp(p.vel / vC, 0.7, 1.8);
    }
    if (this.acVoar) {
      this.acVoar.setEffectiveWeight(this.pVoar);
      this.acVoar.timeScale = p.planar > p.voo ? 0.35 : 1;
    }
    this.mixer.update(dt);
    // sem clipe de andar: a marcha procedural mexe as pernas; com clipe, só cabeça/pescoço
    const pose = this.acAndar ? { ...p, vel: 0 } : p;
    this.marcha?.atualizar(dt, pose);
    // tremor do medo
    const a = p.agitacao;
    const t = p.t;
    this.tremor.set(Math.sin(t * 43) * 0.012 * a, Math.abs(Math.sin(t * 29)) * 0.008 * a, 0);
    this.modelo.position.copy(this.tremor);
    this.modelo.rotation.z = Math.sin(t * 37) * 0.025 * a + p.lutar * Math.sin(t * 8) * 0.05;
  }

  definirMaterial(m: THREE.Material) {
    this.malha.material = m;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.malha.skeleton.dispose();
  }
}
