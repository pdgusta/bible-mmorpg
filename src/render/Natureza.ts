import * as THREE from 'three';
import { extrairPartes, type ParteModelo } from './Ativos';
import { aplicarPatch } from './Shaders';
import { Aleatorio } from '../core/aleatorio';

export interface OpcoesVariante {
  /** Nomes dos modelos-base no natureza.glb (sorteado por instância). */
  modelos: string[];
  tintFolha?: string;
  tintTronco?: string;
  vento?: number;
  /** Distância máxima de desenho (m). */
  alcance?: number;
  /** Até onde usa o modelo completo; depois disso, versão reduzida. */
  alcancePerto?: number;
  sombra?: boolean;
  /** Raio do tronco (para colisão); 0 = sem colisão. */
  raioTronco?: number;
}

interface Modelo {
  nome: string;
  perto: ParteModelo[];
  longe: ParteModelo[];
  raio: number;
}

interface Variante {
  nome: string;
  op: Required<Omit<OpcoesVariante, 'tintFolha' | 'tintTronco'>>;
  modelos: Modelo[];
  instancias: { x: number; y: number; z: number; ry: number; s: number; m: number }[];
  malhasPerto: THREE.InstancedMesh[][]; // [modelo][parte]
  malhasLonge: THREE.InstancedMesh[][];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _esf = new THREE.Sphere();

/**
 * Vegetação e rochas instanciadas a partir do Stylized Nature MegaKit.
 * A cada poucos quadros escolhe o que é visível (distância + frustum) e preenche os
 * InstancedMesh de perto (modelo completo, com sombra) e de longe (folhagem reduzida).
 */
export class Natureza {
  readonly grupo = new THREE.Group();
  private fonte: THREE.Object3D;
  private variantes = new Map<string, Variante>();
  private cacheMat = new Map<string, THREE.Material>();
  private ultimoFoco = new THREE.Vector3(1e9, 0, 0);
  private tempoDesdeAtualizacao = 0;
  private frustum = new THREE.Frustum();
  private projTela = new THREE.Matrix4();
  distanciaMax = 230;

  constructor(cenaNatureza: THREE.Object3D) {
    this.fonte = cenaNatureza;
    this.grupo.name = 'natureza';
  }

  definirVariante(nome: string, op: OpcoesVariante) {
    const modelos: Modelo[] = op.modelos.map((nm) => this.prepararModelo(nm, op, nome));
    const opc = {
      modelos: op.modelos,
      vento: op.vento ?? 0.12,
      alcance: op.alcance ?? 230,
      alcancePerto: op.alcancePerto ?? 60,
      sombra: op.sombra ?? true,
      raioTronco: op.raioTronco ?? 0,
    };
    this.variantes.set(nome, { nome, op: opc, modelos, instancias: [], malhasPerto: [], malhasLonge: [] });
  }

  private prepararModelo(nome: string, op: OpcoesVariante, variante: string): Modelo {
    const no = this.fonte.getObjectByName(nome);
    if (!no) throw new Error(`Modelo de natureza ausente: ${nome}`);
    const partesBase = extrairPartes(no, this.cacheMat);
    const perto: ParteModelo[] = [];
    const longe: ParteModelo[] = [];
    let raio = 0;
    for (const p of partesBase) {
      const mat = p.material.clone() as THREE.MeshLambertMaterial;
      const tint = p.folha ? op.tintFolha : op.tintTronco;
      if (tint) mat.color.multiply(new THREE.Color(tint));
      p.geometria.computeBoundingSphere();
      raio = Math.max(raio, p.geometria.boundingSphere!.radius + p.geometria.boundingSphere!.center.length());
      aplicarPatch(mat, { vento: p.folha ? (op.vento ?? 0.12) : (op.vento ?? 0.12) * 0.25, alturaRef: 6 });
      mat.name = `${variante}_${mat.name}`;
      perto.push({ ...p, material: mat });
      longe.push({ geometria: p.folha ? decimarCartoes(p.geometria, 0.32, 1.45) : simplificarTronco(p.geometria), material: mat, folha: p.folha });
    }
    return { nome, perto, longe, raio };
  }

  adicionar(variante: string, x: number, y: number, z: number, ry: number, s: number, aleatorio?: Aleatorio) {
    const v = this.variantes.get(variante);
    if (!v) throw new Error(`Variante não definida: ${variante}`);
    const m = aleatorio ? Math.floor(aleatorio.proximo() * v.modelos.length) : 0;
    v.instancias.push({ x, y, z, ry, s, m });
    return v.instancias.length - 1;
  }

  raioTronco(variante: string) {
    return this.variantes.get(variante)?.op.raioTronco ?? 0;
  }

  /** Cria os InstancedMesh (chamar depois de adicionar todas as instâncias). */
  construir() {
    for (const v of this.variantes.values()) {
      v.modelos.forEach((mod, mi) => {
        const total = v.instancias.filter((i) => i.m === mi).length;
        if (total === 0) {
          v.malhasPerto[mi] = [];
          v.malhasLonge[mi] = [];
          return;
        }
        const criar = (partes: ParteModelo[], sombra: boolean) =>
          partes.map((p) => {
            const im = new THREE.InstancedMesh(p.geometria, p.material, total);
            im.count = 0;
            im.frustumCulled = false;
            im.castShadow = sombra && v.op.sombra;
            im.receiveShadow = true;
            im.name = `${v.nome}_${mod.nome}`;
            this.grupo.add(im);
            return im;
          });
        v.malhasPerto[mi] = criar(mod.perto, true);
        v.malhasLonge[mi] = criar(mod.longe, false);
      });
    }
  }

  atualizar(dt: number, camera: THREE.Camera, foco: THREE.Vector3, forcar = false) {
    this.tempoDesdeAtualizacao += dt;
    const moveu = foco.distanceToSquared(this.ultimoFoco) > 4;
    if (!forcar && !moveu && this.tempoDesdeAtualizacao < 0.2) return;
    this.tempoDesdeAtualizacao = 0;
    this.ultimoFoco.copy(foco);
    camera.updateMatrixWorld();
    this.projTela.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projTela);
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (const v of this.variantes.values()) {
      const alc = Math.min(v.op.alcance, this.distanciaMax);
      const alc2 = alc * alc;
      const perto2 = v.op.alcancePerto * v.op.alcancePerto;
      const contP: number[] = v.modelos.map(() => 0);
      const contL: number[] = v.modelos.map(() => 0);
      for (const inst of v.instancias) {
        const dx = inst.x - cx;
        const dz = inst.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > alc2) continue;
        const mod = v.modelos[inst.m];
        _esf.center.set(inst.x, inst.y + mod.raio * inst.s * 0.5, inst.z);
        _esf.radius = mod.raio * inst.s;
        if (d2 > 100 && !this.frustum.intersectsSphere(_esf)) continue;
        _q.setFromAxisAngle(_up, inst.ry);
        _p.set(inst.x, inst.y, inst.z);
        _s.setScalar(inst.s);
        _m.compose(_p, _q, _s);
        const perto = d2 < perto2;
        const malhas = perto ? v.malhasPerto[inst.m] : v.malhasLonge[inst.m];
        const k = perto ? contP[inst.m]++ : contL[inst.m]++;
        for (const im of malhas) im.setMatrixAt(k, _m);
      }
      v.modelos.forEach((_, mi) => {
        for (const im of v.malhasPerto[mi] ?? []) { im.count = contP[mi]; im.instanceMatrix.needsUpdate = true; }
        for (const im of v.malhasLonge[mi] ?? []) { im.count = contL[mi]; im.instanceMatrix.needsUpdate = true; }
      });
    }
  }

  /** Lista de troncos para colisão. */
  *troncos(): Generator<{ x: number; z: number; r: number }> {
    for (const v of this.variantes.values()) {
      if (!v.op.raioTronco) continue;
      for (const i of v.instancias) yield { x: i.x, z: i.z, r: v.op.raioTronco * i.s };
    }
  }

  dispose() {
    this.grupo.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) im.dispose();
    });
    for (const v of this.variantes.values()) {
      for (const mod of v.modelos) {
        for (const p of mod.perto) { p.geometria.dispose(); p.material.dispose(); }
        for (const p of mod.longe) p.geometria.dispose();
      }
    }
  }
}

/**
 * Reduz a folhagem para a versão de longe: separa os "cartões" de folha (componentes
 * conectados), mantém uma fração e aumenta cada um para preservar o volume.
 */
function decimarCartoes(g: THREE.BufferGeometry, fracao: number, aumento: number): THREE.BufferGeometry {
  const idx = g.index;
  const pos = g.attributes.position;
  if (!idx) return g;
  const n = pos.count;
  const pai = new Int32Array(n);
  for (let i = 0; i < n; i++) pai[i] = i;
  const achar = (a: number): number => {
    while (pai[a] !== a) { pai[a] = pai[pai[a]]; a = pai[a]; }
    return a;
  };
  const tri = idx.count / 3;
  for (let t = 0; t < tri; t++) {
    const a = achar(idx.getX(t * 3)); const b = achar(idx.getX(t * 3 + 1)); const c = achar(idx.getX(t * 3 + 2));
    pai[b] = a; pai[c] = a;
  }
  const manter = new Map<number, boolean>();
  const rnd = new Aleatorio(91);
  const centro = new Map<number, { x: number; y: number; z: number; k: number }>();
  for (let i = 0; i < n; i++) {
    const r = achar(i);
    let c = centro.get(r);
    if (!c) centro.set(r, (c = { x: 0, y: 0, z: 0, k: 0 }));
    c.x += pos.getX(i); c.y += pos.getY(i); c.z += pos.getZ(i); c.k++;
  }
  for (const r of centro.keys()) manter.set(r, rnd.proximo() < fracao);
  const novoPos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = centro.get(achar(i))!;
    const cx = c.x / c.k, cy = c.y / c.k, cz = c.z / c.k;
    novoPos[i * 3] = cx + (pos.getX(i) - cx) * aumento;
    novoPos[i * 3 + 1] = cy + (pos.getY(i) - cy) * aumento;
    novoPos[i * 3 + 2] = cz + (pos.getZ(i) - cz) * aumento;
  }
  const novoIdx: number[] = [];
  for (let t = 0; t < tri; t++) {
    const a = idx.getX(t * 3);
    if (manter.get(achar(a))) novoIdx.push(a, idx.getX(t * 3 + 1), idx.getX(t * 3 + 2));
  }
  const out = g.clone();
  out.setAttribute('position', new THREE.BufferAttribute(novoPos, 3));
  out.setIndex(novoIdx);
  return out;
}

/** O tronco de longe usa a mesma malha (já é leve na maioria dos modelos). */
function simplificarTronco(g: THREE.BufferGeometry) {
  return g;
}
