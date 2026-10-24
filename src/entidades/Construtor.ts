import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { OpcoesColisor } from '../mundo/Colisao';
import { Aleatorio } from '../core/aleatorio';

/** Material único das estruturas: cor por vértice (tudo de uma zona vira um draw call). */
let materialEstruturas: THREE.MeshLambertMaterial | null = null;
export function materialConstrucao() {
  if (!materialEstruturas) {
    materialEstruturas = new THREE.MeshLambertMaterial({ vertexColors: true });
    materialEstruturas.name = 'estruturas';
  }
  return materialEstruturas;
}

export const CORES = {
  barro: '#c9a47c',
  barroEscuro: '#a8825a',
  barroClaro: '#dcc19a',
  madeira: '#8a6040',
  madeiraClara: '#b48a5c',
  madeiraEscura: '#5e4028',
  pedra: '#a8a092',
  pedraEscura: '#857d70',
  palha: '#d8c084',
  tecidoBege: '#e2d2b0',
  betume: '#2a2420',
  corda: '#c8ad7e',
  tendaPreta: '#3a3028',
  tendaListra: '#c8b48a',
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

interface OpcoesParte {
  /** Escurece a base (oclusão de ambiente falsa). */
  ao?: number;
  /** Variação aleatória de brilho por peça. */
  variacao?: number;
}

/**
 * Acumula geometrias coloridas (cor por vértice) e colisores de uma zona e as funde num único
 * Mesh. Inclui peças prontas: casas de barro, tendas, altares, cercas, poços, andaimes...
 */
export class Construtor {
  private partes: THREE.BufferGeometry[] = [];
  readonly colisores: OpcoesColisor[] = [];
  private rnd: Aleatorio;
  /** Transformação aplicada a tudo o que for adicionado (pilha simples). */
  private base = new THREE.Matrix4();
  private pilha: THREE.Matrix4[] = [];
  private yawBase = 0;
  private origem = new THREE.Vector3();

  constructor(semente = 1) {
    this.rnd = new Aleatorio(semente);
  }

  /** Muda a origem/rotação local (x,y,z,yaw) para as próximas peças e colisores. */
  em(x: number, y: number, z: number, yaw = 0, fn: () => void) {
    this.pilha.push(this.base.clone());
    const yawAnt = this.yawBase;
    const origAnt = this.origem.clone();
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    this.base = this.base.clone().multiply(local);
    this.origem.set(0, 0, 0).applyMatrix4(this.base);
    this.yawBase += yaw;
    fn();
    this.base = this.pilha.pop()!;
    this.yawBase = yawAnt;
    this.origem.copy(origAnt);
  }

  peca(geo: THREE.BufferGeometry, cor: string | THREE.Color, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, op: OpcoesParte = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    g.applyMatrix4(this.base);
    const c = new THREE.Color(cor);
    const vari = op.variacao ?? 0.06;
    if (vari) c.offsetHSL(0, 0, (this.rnd.proximo() - 0.5) * vari);
    const pos = g.attributes.position;
    const cores = new Float32Array(pos.count * 3);
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      ymin = Math.min(ymin, pos.getY(i));
      ymax = Math.max(ymax, pos.getY(i));
    }
    const ao = op.ao ?? 0.18;
    for (let i = 0; i < pos.count; i++) {
      const t = ymax > ymin ? (pos.getY(i) - ymin) / (ymax - ymin) : 1;
      const k = 1 - ao * (1 - Math.min(1, t * 2.5));
      cores[i * 3] = c.r * k;
      cores[i * 3 + 1] = c.g * k;
      cores[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cores, 3));
    for (const nome of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(nome)) g.deleteAttribute(nome);
    this.partes.push(g);
  }

  caixa(x: number, y: number, z: number, w: number, h: number, d: number, cor: string, op: OpcoesParte & { raio?: number; ry?: number; rx?: number; rz?: number } = {}) {
    const r = op.raio ?? Math.min(0.06, w * 0.2, h * 0.2, d * 0.2);
    const geo = r > 0.005 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
    this.peca(geo, cor, x, y + h / 2, z, op.rx ?? 0, op.ry ?? 0, op.rz ?? 0, 1, 1, 1, op);
  }

  cilindro(x: number, y: number, z: number, rTopo: number, rBase: number, h: number, cor: string, segs = 8, op: OpcoesParte & { rx?: number; ry?: number; rz?: number } = {}) {
    this.peca(new THREE.CylinderGeometry(rTopo, rBase, h, segs), cor, x, y + h / 2, z, op.rx ?? 0, op.ry ?? 0, op.rz ?? 0, 1, 1, 1, op);
  }

  /** Cilindro deitado entre dois pontos (vigas, troncos). */
  viga(a: THREE.Vector3, b: THREE.Vector3, r: number, cor: string, segs = 7) {
    const d = b.clone().sub(a);
    const len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, segs);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    const m = a.clone().add(b).multiplyScalar(0.5);
    this.peca(g, cor, m.x, m.y, m.z, e.x, e.y, e.z, 1, 1, 1, { ao: 0 });
  }

  esfera(x: number, y: number, z: number, r: number, cor: string, sx = 1, sy = 1, sz = 1, detalhe = 1) {
    this.peca(new THREE.IcosahedronGeometry(r, detalhe), cor, x, y, z, 0, 0, 0, sx, sy, sz, { ao: 0.1 });
  }

  /** Colisor em coordenadas locais (aplica a origem e o yaw atuais). */
  colisor(c: OpcoesColisor) {
    const p = new THREE.Vector3(c.x, 0, c.z).applyMatrix4(this.base);
    const dy = new THREE.Vector3().setFromMatrixPosition(this.base).y;
    this.colisores.push({ ...c, x: p.x, z: p.z, yaw: (c.yaw ?? 0) + this.yawBase, y0: c.y0 + dy, y1: c.y1 + dy, topoDe: c.topoDe !== undefined ? c.topoDe + dy : undefined, topoAte: c.topoAte !== undefined ? c.topoAte + dy : undefined });
  }

  // ---------------- peças prontas ----------------

  /** Casa de barro com teto plano, vigas aparentes e porta. Frente para +z. */
  casa(w: number, d: number, h: number, cor = CORES.barro) {
    const esp = 0.35;
    this.caixa(0, 0, 0, w, h, d, cor, { raio: 0.18, ao: 0.25 });
    // teto com beiral
    this.caixa(0, h, 0, w + 0.3, 0.25, d + 0.3, CORES.barroClaro, { raio: 0.1, ao: 0 });
    // mureta do terraço
    for (const s of [-1, 1]) {
      this.caixa(s * (w / 2), h + 0.25, 0, 0.25, 0.45, d + 0.3, cor, { raio: 0.08 });
      this.caixa(0, h + 0.25, s * (d / 2), w + 0.3, 0.45, 0.25, cor, { raio: 0.08 });
    }
    // vigas saindo da parede
    for (let i = 0; i < Math.floor(w / 0.9); i++) {
      const x = -w / 2 + 0.45 + i * 0.9;
      this.cilindro(x, h - 0.35, d / 2 + 0.15, 0.08, 0.08, 0.5, CORES.madeiraEscura, 6, { rx: Math.PI / 2 });
    }
    // porta e janela
    this.caixa(0.2, 0, d / 2 + 0.01, 1.0, 1.95, 0.08, CORES.madeiraEscura, { raio: 0.02, ao: 0 });
    this.caixa(0.2, 1.95, d / 2 + 0.02, 1.25, 0.18, 0.12, CORES.madeira, { raio: 0.02, ao: 0 });
    this.caixa(-w / 4 - 0.2, 1.4, d / 2 + 0.01, 0.6, 0.5, 0.06, '#3a2c20', { raio: 0.02, ao: 0 });
    this.colisor({ x: 0, z: 0, hx: w / 2 + 0.05, hz: d / 2 + 0.05, y0: -1, y1: h + 0.7, piso: true });
    void esp;
  }

  /** Tenda de pelos de cabra (pastores): teto de tecido inclinado sobre estacas. Frente para +z. */
  tenda(w: number, d: number, h: number, cor = CORES.tendaPreta, listra = CORES.tendaListra) {
    const g = new THREE.BufferGeometry();
    // teto com curva suave: grade de vértices
    const nx = 8;
    const nz = 4;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / nz;
        const x = (u - 0.5) * w;
        const z = (v - 0.5) * d;
        const arco = Math.sin(u * Math.PI);
        const y = h * (0.62 + 0.38 * arco) - Math.abs(v - 0.5) * h * 0.55 + Math.sin(u * Math.PI * nx) * 0.06;
        pos.push(x, y, z);
      }
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const e = c + 1;
      idx.push(a, c, b, b, c, e);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const dupla = mergeGeometries([g.toNonIndexed(), inverter(g.toNonIndexed())])!;
    this.peca(dupla, cor, 0, 0, 0, 0, 0, 0, 1, 1, 1, { ao: 0.05, variacao: 0.03 });
    // faixas claras
    for (const fz of [-d * 0.18, d * 0.18]) {
      const faixa = new THREE.BoxGeometry(w * 0.98, 0.04, 0.3);
      this.peca(faixa, listra, 0, h * 0.97 - Math.abs(fz / d) * h * 0.55, fz, 0, 0, 0, 1, 1, 1, { ao: 0 });
    }
    // paredes laterais e de trás
    this.caixa(0, 0, -d / 2 + 0.05, w * 0.96, h * 0.62, 0.05, cor, { raio: 0.01, ao: 0.1 });
    for (const s of [-1, 1]) this.caixa(s * w / 2 * 0.98, 0, 0, 0.05, h * 0.6, d * 0.9, cor, { raio: 0.01, ao: 0.1 });
    // estacas e cordas
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
      this.cilindro(sx * w * 0.45, 0, sz * d * 0.45, 0.04, 0.05, h * (sx === 0 ? 1.02 : 0.66), CORES.madeira, 6);
    }
    for (const sx of [-1, 1]) {
      this.viga(new THREE.Vector3(sx * w * 0.5, h * 0.6, d * 0.45), new THREE.Vector3(sx * (w * 0.5 + 1.4), 0.05, d * 0.75), 0.012, CORES.corda, 4);
      this.viga(new THREE.Vector3(sx * w * 0.5, h * 0.6, -d * 0.45), new THREE.Vector3(sx * (w * 0.5 + 1.4), 0.05, -d * 0.75), 0.012, CORES.corda, 4);
    }
    // tapete na entrada
    this.caixa(0, 0.01, d * 0.3, w * 0.5, 0.04, d * 0.4, '#a8453a', { raio: 0.01, ao: 0 });
    this.colisor({ x: 0, z: -d * 0.1, hx: w / 2, hz: d * 0.35, y0: -1, y1: h, piso: false });
  }

  /** Altar de pedras empilhadas (sem cimento, como em Êx 20:25). */
  altar(r = 0.9, h = 1.0, aceso = false) {
    let k = 0;
    for (let camada = 0; camada < 4; camada++) {
      const n = 7 - camada;
      const raio = r * (1 - camada * 0.12);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + camada * 0.4;
        const s = 0.32 + this.rnd.proximo() * 0.12;
        this.esfera(Math.cos(a) * raio * 0.75, camada * (h / 4) + s * 0.4, Math.sin(a) * raio * 0.75, s, k++ % 2 ? CORES.pedra : CORES.pedraEscura, 1.2, 0.75, 1.1, 0);
      }
    }
    this.cilindro(0, h * 0.75, 0, r * 0.75, r * 0.8, h * 0.28, CORES.pedra, 9);
    if (aceso) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this.viga(new THREE.Vector3(Math.cos(a) * 0.4, h + 0.05, Math.sin(a) * 0.4), new THREE.Vector3(-Math.cos(a) * 0.3, h + 0.15, -Math.sin(a) * 0.3), 0.05, CORES.madeiraEscura, 5);
      }
    }
    this.colisor({ tipo: 'cilindro', x: 0, z: 0, r: r * 0.95, y0: -1, y1: h + 0.1, piso: true });
  }

  /** Cerca de madeira entre pontos locais (com colisores). */
  cerca(pontos: [number, number][], altura = 1.1, abertas: number[] = []) {
    for (let i = 0; i < pontos.length - 1; i++) {
      if (abertas.includes(i)) continue;
      const [ax, az] = pontos[i];
      const [bx, bz] = pontos[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 2.2));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        this.cilindro(ax + (bx - ax) * t, 0, az + (bz - az) * t, 0.06, 0.07, altura + 0.1, CORES.madeira, 6);
      }
      for (const y of [altura * 0.45, altura * 0.9]) {
        this.viga(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz), 0.045, CORES.madeiraClara, 5);
      }
      const yaw = Math.atan2(bx - ax, bz - az);
      this.colisor({ x: (ax + bx) / 2, z: (az + bz) / 2, hx: 0.12, hz: len / 2, yaw, y0: -1, y1: altura, piso: false });
    }
  }

  /** Poço de pedra com trave e balde. */
  poco() {
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.caixa(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0, 0.55, 0.85, 0.35, i % 2 ? CORES.pedra : CORES.pedraEscura, { ry: -a + Math.PI / 2, raio: 0.06 });
    }
    this.cilindro(0, 0.05, 0, 0.8, 0.8, 0.02, '#2c5a6a', 12, { ao: 0 });
    for (const s of [-1, 1]) this.cilindro(s * 1.1, 0, 0, 0.07, 0.08, 2.1, CORES.madeira, 6);
    this.viga(new THREE.Vector3(-1.2, 2.0, 0), new THREE.Vector3(1.2, 2.0, 0), 0.07, CORES.madeiraEscura);
    this.colisor({ tipo: 'cilindro', x: 0, z: 0, r: 1.25, y0: -1, y1: 0.9, piso: false });
  }

  /** Fogueira com pedras em volta (a chama é um objeto animado à parte). */
  fogueira() {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.esfera(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55, 0.16, CORES.pedraEscura, 1.2, 0.8, 1, 0);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      this.viga(new THREE.Vector3(Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45), new THREE.Vector3(0, 0.35, 0), 0.05, CORES.madeiraEscura, 5);
    }
    this.colisor({ tipo: 'cilindro', x: 0, z: 0, r: 0.7, y0: -1, y1: 0.3, piso: false });
  }

  /** Pilha de troncos. */
  pilhaTroncos(comp = 3, camadas = 3) {
    for (let c = 0; c < camadas; c++) {
      const n = camadas - c + 1;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.34;
        this.cilindro(x, c * 0.3 + 0.15, 0, 0.16, 0.16, comp, i % 2 ? CORES.madeira : CORES.madeiraEscura, 8, { rx: Math.PI / 2 });
      }
    }
    this.colisor({ x: 0, z: 0, hx: (camadas + 1) * 0.2, hz: comp / 2 + 0.1, y0: -1, y1: camadas * 0.3 + 0.2, piso: true });
  }

  /** Banca de mercado com toldo de tecido. */
  banca(cor: string) {
    this.caixa(0, 0, 0, 2.2, 0.85, 1.0, CORES.madeiraClara, { raio: 0.04 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.cilindro(sx * 1.05, 0, sz * 0.45, 0.04, 0.04, 2.2, CORES.madeira, 5);
    this.caixa(0, 2.1, 0, 2.5, 0.06, 1.4, cor, { raio: 0.02, rx: 0.15, ao: 0 });
    for (let i = 0; i < 6; i++) this.esfera(-0.8 + i * 0.32, 0.95, (i % 2) * 0.2 - 0.1, 0.12, ['#c84a3a', '#e8a040', '#7a9a3a', '#8a4a7a'][i % 4], 1, 0.8, 1, 0);
    this.colisor({ x: 0, z: 0, hx: 1.15, hz: 0.55, y0: -1, y1: 0.9, piso: true });
  }

  jarro(x: number, z: number, s = 1, cor = '#b8704a') {
    const pts = [0, 0.16, 0.24, 0.26, 0.22, 0.12, 0.1, 0.14].map((r, i) => new THREE.Vector2(r * s, i * 0.09 * s));
    this.peca(new THREE.LatheGeometry(pts, 9), cor, x, 0, z, 0, 0, 0, 1, 1, 1, { ao: 0.15 });
  }

  saco(x: number, z: number, s = 1) {
    this.esfera(x, 0.25 * s, z, 0.3 * s, '#cdb48a', 1, 0.85, 0.9, 1);
  }

  /** Geometria final (uma malha) e colisores. */
  construir(nome = 'zona'): { malha: THREE.Mesh | null; colisores: OpcoesColisor[] } {
    if (!this.partes.length) return { malha: null, colisores: this.colisores };
    const geo = mergeGeometries(this.partes, false)!;
    for (const p of this.partes) p.dispose();
    this.partes = [];
    geo.computeBoundingSphere();
    const malha = new THREE.Mesh(geo, materialConstrucao());
    malha.name = nome;
    malha.castShadow = true;
    malha.receiveShadow = true;
    return { malha, colisores: this.colisores };
  }
}

function inverter(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
