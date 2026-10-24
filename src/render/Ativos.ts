import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Carregador central de modelos glTF (com cache e progresso). */
export class Ativos {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<GLTF>>();
  private base: string;
  totalBytes = 0;
  carregados = 0;
  aoProgresso?: (fracao: number, nome: string) => void;
  private pendentes = new Set<string>();
  private concluidos = new Set<string>();

  constructor(base = './modelos/') {
    this.base = base;
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  carregar(nome: string): Promise<GLTF> {
    let p = this.cache.get(nome);
    if (!p) {
      this.pendentes.add(nome);
      p = this.loader.loadAsync(this.base + nome).then((g) => {
        this.concluidos.add(nome);
        this.aoProgresso?.(this.concluidos.size / this.pendentes.size, nome);
        return g;
      });
      this.cache.set(nome, p);
    }
    return p;
  }
}

/** Parte de um modelo pronta para instanciar: geometria com transformações aplicadas + material. */
export interface ParteModelo {
  geometria: THREE.BufferGeometry;
  material: THREE.Material;
  folha: boolean;
}

/**
 * Extrai as partes de um nó (modelo) do GLB, aplicando as transformações dos filhos na geometria.
 * Materiais são convertidos em Lambert (mais barato) mantendo textura e alpha test.
 */
export function extrairPartes(raiz: THREE.Object3D, cacheMat: Map<string, THREE.Material>): ParteModelo[] {
  const partes: ParteModelo[] = [];
  raiz.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(raiz.matrixWorld).invert();
  raiz.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    // desquantiza para Float32 (o shader de vento lê posições em metros)
    for (const nome of Object.keys(g.attributes)) {
      const a = g.attributes[nome] as THREE.BufferAttribute;
      if (a.normalized || !(a.array instanceof Float32Array)) {
        const arr = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) {
          for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(i, c);
        }
        g.setAttribute(nome, new THREE.BufferAttribute(arr, a.itemSize));
      }
    }
    const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    g.applyMatrix4(mat);
    const orig = m.material as THREE.MeshStandardMaterial;
    const chave = orig.name || orig.uuid;
    let novo = cacheMat.get(chave);
    // casca com máscara (ex.: Bark_NormalTree) não é folha: não vira cartão nem ganha face dupla
    const mascara = orig.alphaTest > 0 || orig.transparent;
    const folha = /leaf|leaves|grass|flower|fern|clover|plant/i.test(orig.name) || (mascara && !/bark|rock|trunk/i.test(orig.name));
    if (!novo) {
      const l = new THREE.MeshLambertMaterial({
        name: orig.name,
        map: orig.map,
        color: orig.color,
        alphaTest: mascara || folha ? 0.5 : 0,
        side: folha ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (l.map) l.map.colorSpace = THREE.SRGBColorSpace;
      novo = l;
      cacheMat.set(chave, novo);
    }
    partes.push({ geometria: g, material: novo, folha });
  });
  return partes;
}
