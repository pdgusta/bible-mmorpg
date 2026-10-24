import * as THREE from 'three';
import { aplicarPatch } from '../../render/Shaders';

/**
 * Montador de animais procedurais low-poly: junta peças simples (elipsoides, membros, caixas,
 * tubos) presas rigidamente a ossos numa única SkinnedMesh com cor por vértice e normais
 * chapadas (um draw call por animal). As peças são dadas no espaço do modelo, na pose de
 * repouso: +Z é a frente, Y para cima, pés em y = 0, esquerda em +X.
 */

export type Cor = THREE.ColorRepresentation;
export type V3 = [number, number, number];

let materialAnimais: THREE.MeshLambertMaterial | null = null;

/** Material único (cor por vértice) dos animais procedurais, preparado para a revelação das eras. */
export function materialProcedural(): THREE.MeshLambertMaterial {
  if (!materialAnimais) {
    materialAnimais = new THREE.MeshLambertMaterial({ vertexColors: true });
    materialAnimais.name = 'animais';
    aplicarPatch(materialAnimais, { revelar: true });
  }
  return materialAnimais;
}

export interface OpcoesParte {
  /** Escurece a face de baixo (oclusão falsa), 0..1. Padrão 0.22. */
  sombra?: number;
  /** Cor por face: recebe o centro da face (espaço do modelo) e devolve a cor ou null (usa a da peça). */
  porFace?: (c: THREE.Vector3, indiceFace: number) => Cor | null;
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _centro = new THREE.Vector3();

export class Montador {
  readonly ossos: THREE.Bone[] = [];
  private porNome = new Map<string, THREE.Bone>();
  private absoluto = new Map<string, THREE.Vector3>();
  private pos: number[] = [];
  private nor: number[] = [];
  private cor: number[] = [];
  private si: number[] = [];
  triangulos = 0;

  /** Cria um osso na posição absoluta (x,y,z) do modelo, filho de `pai`. */
  osso(nome: string, pai: string | null, x: number, y: number, z: number): THREE.Bone {
    const b = new THREE.Bone();
    b.name = nome;
    const abs = new THREE.Vector3(x, y, z);
    if (pai) {
      const p = this.porNome.get(pai);
      if (!p) throw new Error(`Osso pai desconhecido: ${pai}`);
      b.position.copy(abs).sub(this.absoluto.get(pai)!);
      p.add(b);
    } else {
      b.position.copy(abs);
    }
    this.porNome.set(nome, b);
    this.absoluto.set(nome, abs);
    this.ossos.push(b);
    return b;
  }

  temOsso(nome: string) {
    return this.porNome.has(nome);
  }

  /** Posição absoluta de repouso de um osso. */
  ondeOsso(nome: string): THREE.Vector3 {
    return this.absoluto.get(nome)!.clone();
  }

  /** Adiciona uma geometria (já no espaço do modelo) presa rigidamente ao osso. */
  parte(osso: string, geo: THREE.BufferGeometry, cor: Cor, op: OpcoesParte = {}) {
    const i = this.ossos.indexOf(this.porNome.get(osso)!);
    if (i < 0) throw new Error(`Osso desconhecido: ${osso}`);
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.computeVertexNormals();
    const ap = g.attributes.position;
    const an = g.attributes.normal;
    const sombra = op.sombra ?? 0.22;
    const base = new THREE.Color(cor);
    for (let v = 0; v < ap.count; v += 3) {
      let corFace = base;
      if (op.porFace) {
        _centro.set(0, 0, 0);
        for (let k = 0; k < 3; k++) _centro.add(_v.fromBufferAttribute(ap, v + k));
        _centro.multiplyScalar(1 / 3);
        const c = op.porFace(_centro, v / 3);
        if (c !== null) corFace = _c2.set(c);
      }
      for (let k = 0; k < 3; k++) {
        _v.fromBufferAttribute(ap, v + k);
        _n.fromBufferAttribute(an, v + k);
        // oclusão falsa: faces viradas para baixo um pouco mais escuras
        const f = 1 - sombra * Math.max(0, -_n.y) - sombra * 0.35 * (1 - Math.abs(_n.y));
        _c.copy(corFace).multiplyScalar(f);
        this.pos.push(_v.x, _v.y, _v.z);
        this.nor.push(_n.x, _n.y, _n.z);
        this.cor.push(_c.r, _c.g, _c.b);
        this.si.push(i);
      }
    }
    this.triangulos += ap.count / 3;
    if (g !== geo) g.dispose();
    geo.dispose();
  }

  /** Constrói a malha com esqueleto. O material padrão é o compartilhado dos animais. */
  construir(material: THREE.Material = materialProcedural()): THREE.SkinnedMesh {
    const g = new THREE.BufferGeometry();
    const n = this.si.length;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3));
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      si[k * 4] = this.si[k];
      sw[k * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const malha = new THREE.SkinnedMesh(g, material);
    malha.add(this.ossos[0]);
    malha.updateMatrixWorld(true);
    malha.bind(new THREE.Skeleton(this.ossos));
    malha.castShadow = true;
    malha.receiveShadow = false;
    return malha;
  }
}

// ------------------------------------------------------------------ primitivas -------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

function transformar(g: THREE.BufferGeometry, c: V3, rot: V3 = [0, 0, 0], esc: V3 = [1, 1, 1]) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  _m.compose(_p.set(c[0], c[1], c[2]), _q, _s.set(esc[0], esc[1], esc[2]));
  g.applyMatrix4(_m);
  return g;
}

/** Elipsoide (icosaedro escalado): detalhe 0 = 20 triângulos, 1 = 80. */
export function elipsoide(c: V3, r: V3, detalhe = 1, rot: V3 = [0, 0, 0]): THREE.BufferGeometry {
  return transformar(new THREE.IcosahedronGeometry(1, detalhe), c, rot, r);
}

/** Octaedro escalado (8 triângulos): olhos, focinhos pequenos, tufos. */
export function octaedro(c: V3, r: V3, rot: V3 = [0, 0, 0]): THREE.BufferGeometry {
  return transformar(new THREE.OctahedronGeometry(1, 0), c, rot, r);
}

/** Caixa com afinamento opcional do topo (x,z) — 12 triângulos. */
export function caixa(c: V3, tam: V3, rot: V3 = [0, 0, 0], afinar: [number, number] = [1, 1]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(tam[0], tam[1], tam[2]);
  if (afinar[0] !== 1 || afinar[1] !== 1) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * afinar[0], p.getY(i), p.getZ(i) * afinar[1]);
    }
  }
  return transformar(g, c, rot);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Membro cilíndrico de `a` até `b` (raio r0 em a, r1 em b). Sem tampas quando `aberto`. */
export function membro(a: V3, b: V3, r0: number, r1: number, lados = 5, aberto = false): THREE.BufferGeometry {
  _a.set(a[0], a[1], a[2]);
  _b.set(b[0], b[1], b[2]);
  _d.subVectors(_b, _a);
  const h = _d.length();
  const g = new THREE.CylinderGeometry(r1, r0, h, lados, 1, aberto);
  _q.setFromUnitVectors(_up, _d.normalize());
  _m.compose(_p.addVectors(_a, _b).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}

/** Cone de `base` até `ponta`. */
export function cone(base: V3, ponta: V3, r: number, lados = 5): THREE.BufferGeometry {
  _a.set(base[0], base[1], base[2]);
  _b.set(ponta[0], ponta[1], ponta[2]);
  _d.subVectors(_b, _a);
  const h = _d.length();
  const g = new THREE.ConeGeometry(r, h, lados, 1, false);
  _q.setFromUnitVectors(_up, _d.normalize());
  _m.compose(_p.addVectors(_a, _b).multiplyScalar(0.5), _q, _s.set(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}

/**
 * Tubo ao longo de uma curva (anéis orientados por transporte paralelo), com ponta fechada.
 * `cores` (opcional) colore cada trecho entre anéis — usado nos sulcos dos chifres.
 */
export function tubo(pontos: THREE.Vector3[], raios: number[], lados = 5, achatar = 1): THREE.BufferGeometry {
  const n = pontos.length;
  const aneis: THREE.Vector3[][] = [];
  const tang = new THREE.Vector3();
  let normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = pontos[Math.max(0, i - 1)];
    const b = pontos[Math.min(n - 1, i + 1)];
    const tNovo = new THREE.Vector3().subVectors(b, a).normalize();
    if (i === 0) {
      // normal inicial: qualquer perpendicular à tangente
      normal = Math.abs(tNovo.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      normal.sub(tNovo.clone().multiplyScalar(normal.dot(tNovo))).normalize();
    } else {
      // transporte paralelo: gira a normal anterior pelo mesmo giro da tangente
      const q = new THREE.Quaternion().setFromUnitVectors(tang, tNovo);
      normal.applyQuaternion(q).normalize();
    }
    tang.copy(tNovo);
    binormal.crossVectors(tang, normal).normalize();
    const anel: THREE.Vector3[] = [];
    const r = raios[i];
    for (let k = 0; k < lados; k++) {
      const ang = (k / lados) * Math.PI * 2;
      anel.push(pontos[i].clone()
        .addScaledVector(normal, Math.cos(ang) * r * achatar)
        .addScaledVector(binormal, Math.sin(ang) * r));
    }
    aneis.push(anel);
  }
  const pos: number[] = [];
  const tri = (p: THREE.Vector3, q: THREE.Vector3, s: THREE.Vector3) => pos.push(p.x, p.y, p.z, q.x, q.y, q.z, s.x, s.y, s.z);
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < lados; k++) {
      const k2 = (k + 1) % lados;
      const a = aneis[i][k], b = aneis[i][k2], c = aneis[i + 1][k], d = aneis[i + 1][k2];
      tri(a, c, b);
      tri(b, c, d);
    }
  }
  // tampa da ponta (se o último raio for > 0) e da base
  const fim = pontos[n - 1];
  if (raios[n - 1] > 1e-4) for (let k = 0; k < lados; k++) tri(aneis[n - 1][k], fim, aneis[n - 1][(k + 1) % lados]);
  const ini = pontos[0];
  for (let k = 0; k < lados; k++) tri(aneis[0][(k + 1) % lados], ini, aneis[0][k]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Curva suave (Catmull-Rom) por pontos de controle, amostrada em `n` pontos. */
export function curva(controle: V3[], n: number): THREE.Vector3[] {
  const c = new THREE.CatmullRomCurve3(controle.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  return c.getPoints(n - 1);
}

/** Asa/leque achatado: um polígono em leque no plano XZ com espessura pequena (dois lados). */
export function leque(contorno: [number, number][], y: number, espessura = 0.01): THREE.BufferGeometry {
  // triangulação em leque a partir do primeiro ponto (contorno convexo, sentido anti-horário visto de cima)
  const pos: number[] = [];
  const e = espessura / 2;
  const [x0, z0] = contorno[0];
  for (let i = 1; i < contorno.length - 1; i++) {
    const [x1, z1] = contorno[i];
    const [x2, z2] = contorno[i + 1];
    pos.push(x0, y + e, z0, x2, y + e, z2, x1, y + e, z1); // topo
    pos.push(x0, y - e, z0, x1, y - e, z1, x2, y - e, z2); // baixo
  }
  // bordas
  for (let i = 0; i < contorno.length; i++) {
    const [xa, za] = contorno[i];
    const [xb, zb] = contorno[(i + 1) % contorno.length];
    pos.push(xa, y + e, za, xb, y + e, zb, xa, y - e, za);
    pos.push(xb, y + e, zb, xb, y - e, zb, xa, y - e, za);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Ruído de valor 3D barato e determinístico (manchas de girafa, variação de pelagem). */
export function ruido3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Ruído suave (interpolado) para manchas agrupadas. */
export function manchas(p: THREE.Vector3, escala: number): number {
  const x = p.x * escala, y = p.y * escala, z = p.z * escala;
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const peso = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    r += peso * ruido3(xi + dx, yi + dy, zi + dz);
  }
  return r;
}
