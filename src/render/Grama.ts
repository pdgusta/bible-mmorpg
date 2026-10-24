import * as THREE from 'three';
import { GLOBAIS } from './Shaders';
import type { Relevo } from '../mundo/Relevo';

export type FuncaoDensidade = (x: number, z: number) => number; // 0..1
export type FuncaoCorGrama = (x: number, z: number, out: THREE.Color) => void;

/** Tufo de 5 lâminas curvas, com cor de base escura e ponta clara (cores por vértice). */
function geometriaTufo(): THREE.BufferGeometry {
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const lam = 5;
  for (let b = 0; b < lam; b++) {
    const ang = (b / lam) * Math.PI * 2 + b * 0.7;
    const inc = 0.25 + (b % 3) * 0.12;
    const alt = 0.38 + ((b * 37) % 7) * 0.035;
    const larg = 0.045;
    const ox = Math.cos(ang) * 0.06;
    const oz = Math.sin(ang) * 0.06;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz;
    const pz = dx;
    const base = pos.length / 3;
    const seg = 3;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      const w = larg * (1 - t * 0.85);
      const curva = inc * t * t;
      const cx = ox + dx * curva;
      const cz = oz + dz * curva;
      const y = alt * t;
      pos.push(cx - px * w, y, cz - pz * w, cx + px * w, y, cz + pz * w);
      const k = 0.55 + t * 0.6;
      cor.push(k, k, k, k, k, k);
    }
    for (let s = 0; s < seg; s++) {
      const a = base + s * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // normais apontando para cima: iluminação macia e uniforme, como em jogos estilizados
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/**
 * Campo de grama instanciado ao redor da câmera. A grade acompanha o jogador e é
 * reconstruída quando ele se afasta alguns metros.
 */
export class Grama {
  readonly malha: THREE.InstancedMesh;
  private raio: number;
  private espac: number;
  private centro = new THREE.Vector2(1e9, 1e9);
  private relevo: Relevo;
  private densidade: FuncaoDensidade;
  private cor: FuncaoCorGrama;
  densidadeGlobal = 1;
  /** Altura da água abaixo da qual não nasce grama. */
  nivelAgua = -1e9;

  constructor(relevo: Relevo, densidade: FuncaoDensidade, cor: FuncaoCorGrama, raio = 34, espac = 0.62) {
    this.relevo = relevo;
    this.densidade = densidade;
    this.cor = cor;
    this.raio = raio;
    this.espac = espac;
    const lado = Math.ceil((raio * 2) / espac);
    const max = lado * lado;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, GLOBAIS);
      sh.uniforms.uFoco = this.uFoco;
      sh.uniforms.uRaioG = { value: raio };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTempo; uniform float uVento; uniform vec3 uFoco; uniform float uRaioG; uniform vec2 uCentro; uniform float uRaio;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 _b = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float _d = distance(_b.xz, uFoco.xz);
           float _f = 1.0 - smoothstep(uRaioG * 0.7, uRaioG, _d);
           _f *= 1.0 - smoothstep(uRaio - 20.0, uRaio, distance(_b.xz, uCentro));
           float _h = transformed.y;
           float _w = sin(uTempo * 2.2 + _b.x * 0.4 + _b.z * 0.3) * 0.5 + sin(uTempo * 3.7 + _b.x * 0.9) * 0.2;
           transformed.x += _w * 0.12 * uVento * _h * 2.5;
           transformed.z += cos(uTempo * 1.6 + _b.z * 0.5) * 0.06 * uVento * _h * 2.5;
           // dobra para longe do jogador (pisar na grama)
           vec2 _af = _b.xz - uFoco.xz; float _dl = length(_af);
           if (_dl < 1.0) { transformed.xz += normalize(_af + 0.001) * (1.0 - _dl) * _h * 0.8; transformed.y *= 0.6 + 0.4 * _dl; }
           transformed *= _f;`,
        );
    };
    this.malha = new THREE.InstancedMesh(geometriaTufo(), mat, max);
    this.malha.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.malha.frustumCulled = false;
    this.malha.receiveShadow = true;
    this.malha.count = 0;
    this.malha.name = 'grama';
  }

  private uFoco = { value: new THREE.Vector3() };

  atualizar(foco: THREE.Vector3) {
    this.uFoco.value.copy(foco);
    const passoGrade = 4;
    const cx = Math.round(foco.x / passoGrade) * passoGrade;
    const cz = Math.round(foco.z / passoGrade) * passoGrade;
    if (cx === this.centro.x && cz === this.centro.y) return;
    this.centro.set(cx, cz);
    this.reconstruir(cx, cz);
  }

  forcarReconstrucao() {
    this.centro.set(1e9, 1e9);
  }

  private reconstruir(cx: number, cz: number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    let k = 0;
    const e = this.espac;
    const r2 = this.raio * this.raio;
    const ini = -this.raio;
    for (let gz = ini; gz < this.raio; gz += e) {
      for (let gx = ini; gx < this.raio; gx += e) {
        if (gx * gx + gz * gz > r2) continue;
        const wx0 = cx + gx;
        const wz0 = cz + gz;
        // jitter determinístico por célula de mundo
        const h1 = hash(Math.round(wx0 / e), Math.round(wz0 / e));
        const h2 = hash(Math.round(wz0 / e) + 17, Math.round(wx0 / e) - 9);
        const wx = wx0 + (h1 - 0.5) * e;
        const wz = wz0 + (h2 - 0.5) * e;
        if (!this.relevo.dentro(wx, wz, 2)) continue;
        const dens = this.densidade(wx, wz) * this.densidadeGlobal;
        if (h1 * 0.7 + h2 * 0.3 > dens) continue;
        const y = this.relevo.altura(wx, wz);
        if (y < this.nivelAgua + 0.05) continue;
        q.setFromAxisAngle(up, h2 * 6.283);
        const esc = 0.7 + h1 * 0.75;
        s.set(esc, esc * (0.8 + h2 * 0.6), esc);
        p.set(wx, y - 0.02, wz);
        m.compose(p, q, s);
        this.malha.setMatrixAt(k, m);
        this.cor(wx, wz, c);
        c.offsetHSL((h1 - 0.5) * 0.03, 0, (h2 - 0.5) * 0.08);
        this.malha.setColorAt(k, c);
        k++;
        if (k >= this.malha.instanceMatrix.count) break;
      }
    }
    this.malha.count = k;
    this.malha.instanceMatrix.needsUpdate = true;
    if (this.malha.instanceColor) this.malha.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.malha.geometry.dispose();
    (this.malha.material as THREE.Material).dispose();
    this.malha.dispose();
  }
}

function hash(a: number, b: number): number {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
