import * as THREE from 'three';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
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
  /** Até onde usa o modelo completo (com sombra); depois disso, versão reduzida. */
  alcancePerto?: number;
  sombra?: boolean;
  /** Raio do tronco (para colisão); 0 = sem colisão. */
  raioTronco?: number;
  /** Fração de cartões de folha mantida na versão de longe (padrão 0,32). */
  fracaoLonge?: number;
  /** Reduz também a malha do tronco na versão de longe (fração de triângulos, ex.: 0,3). */
  reduzirTronco?: number;
}

interface Modelo {
  nome: string;
  perto: ParteModelo[];
  longe: ParteModelo[];
  raio: number;
}

interface Instancia {
  x: number;
  y: number;
  z: number;
  ry: number;
  s: number;
  m: number;
  /** Inclinação (rad) em torno do eixo x local — árvores caídas. */
  rx: number;
  oculta: boolean;
}

interface Variante {
  nome: string;
  op: Required<Omit<OpcoesVariante, 'tintFolha' | 'tintTronco'>>;
  modelos: Modelo[];
  instancias: Instancia[];
  malhasPerto: THREE.InstancedMesh[][]; // [modelo][parte]
  malhasLonge: THREE.InstancedMesh[][];
  uAlcance: { value: number };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _esf = new THREE.Sphere();

/**
 * Vegetação e rochas instanciadas a partir do Stylized Nature MegaKit.
 * A cada poucos quadros escolhe o que é visível (distância + frustum) e preenche os
 * InstancedMesh de perto (modelo completo, com sombra) e de longe (folhagem reduzida).
 * Perto do alcance a instância encolhe no shader (sem "pop").
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
  private construida = false;
  distanciaMax = 230;

  constructor(cenaNatureza: THREE.Object3D) {
    this.fonte = cenaNatureza;
    this.grupo.name = 'natureza';
  }

  definirVariante(nome: string, op: OpcoesVariante) {
    if (this.variantes.has(nome)) return;
    const uAlcance = { value: op.alcance ?? 230 };
    const modelos: Modelo[] = op.modelos.map((nm) => this.prepararModelo(nm, op, nome, uAlcance));
    const opc = {
      modelos: op.modelos,
      vento: op.vento ?? 0.12,
      alcance: op.alcance ?? 230,
      alcancePerto: op.alcancePerto ?? 45,
      sombra: op.sombra ?? true,
      raioTronco: op.raioTronco ?? 0,
      fracaoLonge: op.fracaoLonge ?? 0.32,
      reduzirTronco: op.reduzirTronco ?? 0,
    };
    this.variantes.set(nome, { nome, op: opc, modelos, instancias: [], malhasPerto: [], malhasLonge: [], uAlcance });
  }

  temVariante(nome: string) {
    return this.variantes.has(nome);
  }

  private prepararModelo(nome: string, op: OpcoesVariante, variante: string, uAlcance: { value: number }): Modelo {
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
      aplicarPatch(mat, { vento: p.folha ? (op.vento ?? 0.12) : (op.vento ?? 0.12) * 0.25, alturaRef: 6, alcance: uAlcance });
      mat.name = `${variante}_${mat.name}`;
      perto.push({ ...p, material: mat });
      const geoLonge = p.folha
        ? decimarCartoes(p.geometria, op.fracaoLonge ?? 0.32, 1 / Math.sqrt(op.fracaoLonge ?? 0.32) * 0.82)
        : op.reduzirTronco ? simplificar(p.geometria, op.reduzirTronco) : p.geometria;
      longe.push({ geometria: geoLonge, material: mat, folha: p.folha });
    }
    return { nome, perto, longe, raio };
  }

  adicionar(variante: string, x: number, y: number, z: number, ry: number, s: number, aleatorio?: Aleatorio, rx = 0) {
    const v = this.variantes.get(variante);
    if (!v) throw new Error(`Variante não definida: ${variante}`);
    const m = aleatorio ? Math.floor(aleatorio.proximo() * v.modelos.length) : 0;
    v.instancias.push({ x, y, z, ry, s, m, rx, oculta: false });
    if (this.construida) this.construirVariante(v);
    return v.instancias.length - 1;
  }

  /** Escolhe o modelo de uma instância já adicionada (índice dentro da variante). */
  definirModelo(variante: string, indice: number, modelo: number) {
    const v = this.variantes.get(variante);
    if (!v || !v.instancias[indice]) return;
    v.instancias[indice].m = modelo % v.modelos.length;
    if (this.construida) this.construirVariante(v);
  }

  /** Esconde/mostra uma instância (árvore cortada, por exemplo). */
  ocultar(variante: string, indice: number, oculta = true) {
    const v = this.variantes.get(variante);
    if (!v || !v.instancias[indice]) return;
    v.instancias[indice].oculta = oculta;
    this.ultimoFoco.set(1e9, 0, 0);
  }

  instancia(variante: string, indice: number): Readonly<Instancia> | null {
    return this.variantes.get(variante)?.instancias[indice] ?? null;
  }

  raioTronco(variante: string) {
    return this.variantes.get(variante)?.op.raioTronco ?? 0;
  }

  /** Cria os InstancedMesh (chamar depois de adicionar todas as instâncias). */
  construir() {
    for (const v of this.variantes.values()) this.construirVariante(v);
    this.construida = true;
    this.ultimoFoco.set(1e9, 0, 0);
  }

  private construirVariante(v: Variante) {
    for (const lista of [...v.malhasPerto, ...v.malhasLonge]) for (const im of lista) {
      this.grupo.remove(im);
      im.dispose();
    }
    v.malhasPerto = [];
    v.malhasLonge = [];
    v.modelos.forEach((mod, mi) => {
      const total = v.instancias.filter((i) => i.m === mi).length;
      if (total === 0) {
        v.malhasPerto[mi] = [];
        v.malhasLonge[mi] = [];
        return;
      }
      const criar = (partes: ParteModelo[], sombra: boolean, sufixo: string) =>
        partes.map((p) => {
          const im = new THREE.InstancedMesh(p.geometria, p.material, total);
          im.count = 0;
          im.visible = false;
          im.frustumCulled = false;
          im.castShadow = sombra && v.op.sombra;
          im.receiveShadow = true;
          im.name = `${v.nome}_${mod.nome}${sufixo}`;
          this.grupo.add(im);
          return im;
        });
      v.malhasPerto[mi] = criar(mod.perto, true, '');
      v.malhasLonge[mi] = criar(mod.longe, false, '_longe');
    });
    this.ultimoFoco.set(1e9, 0, 0);
  }

  /** Remove todas as instâncias (mantém as variantes definidas). Depois: adicionar(...) e construir(). */
  limpar(variantes?: string[]) {
    for (const v of this.variantes.values()) {
      if (variantes && !variantes.includes(v.nome)) continue;
      for (const lista of [...v.malhasPerto, ...v.malhasLonge]) for (const im of lista) {
        this.grupo.remove(im);
        im.dispose();
      }
      v.malhasPerto = [];
      v.malhasLonge = [];
      v.instancias = [];
    }
    this.ultimoFoco.set(1e9, 0, 0);
  }

  atualizar(dt: number, camera: THREE.Camera, foco: THREE.Vector3, forcar = false) {
    this.tempoDesdeAtualizacao += dt;
    const moveu = foco.distanceToSquared(this.ultimoFoco) > 4;
    if (!forcar && !moveu && this.tempoDesdeAtualizacao < 0.25) return;
    this.tempoDesdeAtualizacao = 0;
    this.ultimoFoco.copy(foco);
    camera.updateMatrixWorld();
    this.projTela.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projTela);
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (const v of this.variantes.values()) {
      const alc = Math.min(v.op.alcance, this.distanciaMax);
      v.uAlcance.value = alc;
      const alc2 = alc * alc;
      const perto2 = v.op.alcancePerto * v.op.alcancePerto;
      const contP: number[] = v.modelos.map(() => 0);
      const contL: number[] = v.modelos.map(() => 0);
      for (const inst of v.instancias) {
        if (inst.oculta) continue;
        const dx = inst.x - cx;
        const dz = inst.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > alc2) continue;
        const mod = v.modelos[inst.m];
        if (!v.malhasPerto[inst.m]) continue;
        _esf.center.set(inst.x, inst.y + mod.raio * inst.s * 0.5, inst.z);
        _esf.radius = mod.raio * inst.s;
        if (d2 > 100 && !this.frustum.intersectsSphere(_esf)) continue;
        if (inst.rx) {
          _e.set(inst.rx, inst.ry, 0, 'YXZ');
          _q.setFromEuler(_e);
        } else _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, inst.ry);
        _p.set(inst.x, inst.y, inst.z);
        _s.setScalar(inst.s);
        _m.compose(_p, _q, _s);
        const perto = d2 < perto2;
        const malhas = perto ? v.malhasPerto[inst.m] : v.malhasLonge[inst.m];
        const k = perto ? contP[inst.m]++ : contL[inst.m]++;
        for (const im of malhas) im.setMatrixAt(k, _m);
      }
      v.modelos.forEach((_, mi) => {
        for (const im of v.malhasPerto[mi] ?? []) { im.count = contP[mi]; im.visible = contP[mi] > 0; im.instanceMatrix.needsUpdate = true; }
        for (const im of v.malhasLonge[mi] ?? []) { im.count = contL[mi]; im.visible = contL[mi] > 0; im.instanceMatrix.needsUpdate = true; }
      });
    }
  }

  /** Lista de troncos para colisão. */
  *troncos(): Generator<{ x: number; z: number; r: number; variante: string; indice: number }> {
    for (const v of this.variantes.values()) {
      if (!v.op.raioTronco) continue;
      for (let k = 0; k < v.instancias.length; k++) {
        const i = v.instancias[k];
        if (i.oculta || i.rx) continue;
        yield { x: i.x, z: i.z, r: v.op.raioTronco * i.s, variante: v.nome, indice: k };
      }
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

// o simplificador (WASM) fica pronto bem antes de o mundo ser montado; se não estiver, usa a malha cheia
let simplificadorPronto = false;
MeshoptSimplifier.ready.then(() => { simplificadorPronto = true; });

/** Simplifica uma malha indexada (troncos de longe, árvores secas) mantendo os atributos. */
function simplificar(g: THREE.BufferGeometry, fracao: number): THREE.BufferGeometry {
  const idx = g.index;
  if (!simplificadorPronto || !idx) return g;
  const pa = g.attributes.position;
  const pos = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) { pos[i * 3] = pa.getX(i); pos[i * 3 + 1] = pa.getY(i); pos[i * 3 + 2] = pa.getZ(i); }
  const ind = new Uint32Array(idx.count);
  for (let i = 0; i < idx.count; i++) ind[i] = idx.getX(i);
  const alvo = Math.max(3, Math.floor((idx.count * fracao) / 3) * 3);
  const [novo] = MeshoptSimplifier.simplify(ind, pos, 3, alvo, 0.05, ['LockBorder']);
  if (novo.length < 3) return g;
  const out = g.clone();
  out.setIndex(new THREE.BufferAttribute(novo, 1));
  return out;
}
