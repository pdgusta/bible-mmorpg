import * as THREE from 'three';
import { GLOBAIS, GLSL_RUIDO, GLSL_SEM_VERSO, FAIXA_REVELAR } from './Shaders';
import type { Relevo } from '../mundo/Relevo';

export type FuncaoDensidade = (x: number, z: number) => number; // 0..1
export type FuncaoCorGrama = (x: number, z: number, out: THREE.Color) => void;

/** Tufo de lâminas curvas, com cor de base escura e ponta clara (cores por vértice). */
function geometriaTufo(lam: number, seg: number, larg: number, alturaBase: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  for (let b = 0; b < lam; b++) {
    const ang = (b / lam) * Math.PI * 2 + b * 0.7;
    const inc = 0.25 + (b % 3) * 0.12;
    const alt = alturaBase + ((b * 37) % 7) * 0.035;
    const ox = Math.cos(ang) * 0.07;
    const oz = Math.sin(ang) * 0.07;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const px = -dz;
    const pz = dx;
    const base = pos.length / 3;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      const w = larg * (1 - t * 0.85);
      const curva = inc * t * t;
      const cx = ox + dx * curva;
      const cz = oz + dz * curva;
      const y = alt * t;
      pos.push(cx - px * w, y, cz - pz * w, cx + px * w, y, cz + pz * w);
      const k = 0.58 + t * 0.47;
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
  // normais apontando para cima: iluminação macia e uniforme, como em jogos estilizados
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Perfil da grama (troca depois do dilúvio: brotos novos, curtos e esparsos). */
export interface PerfilGrama {
  densidade: FuncaoDensidade;
  cor: FuncaoCorGrama;
  /** Multiplicador de altura das lâminas. */
  altura: number;
}

/**
 * Campo de grama instanciado ao redor do foco, em dois anéis: perto (lâminas curvas, 3 segmentos)
 * e longe (lâminas retas, mais largas). A grade acompanha o jogador e é refeita a cada 4 m.
 * A densidade é pré-calculada numa grade de 1 m; a cor vem da cor do chão (sem emenda visível).
 */
export class Grama {
  readonly malha: THREE.Group;
  private perto: THREE.InstancedMesh;
  private longe: THREE.InstancedMesh;
  private raio: number;
  private raioPerto: number;
  private espac: number;
  private centro = new THREE.Vector2(1e9, 1e9);
  private relevo: Relevo;
  private perfil: PerfilGrama;
  private grade: Uint8Array | null = null;
  private material: THREE.MeshLambertMaterial;
  private uAltura = { value: 1 };
  densidadeGlobal = 1;
  /** Altura da água abaixo da qual não nasce grama. */
  nivelAgua = -1e9;

  constructor(relevo: Relevo, densidade: FuncaoDensidade, cor: FuncaoCorGrama, raio = 34, espac = 0.6) {
    this.relevo = relevo;
    this.perfil = { densidade, cor, altura: 1 };
    this.raio = raio;
    this.raioPerto = Math.min(14, raio * 0.42);
    this.espac = espac;
    const lado = Math.ceil((raio * 2) / espac);
    const max = Math.ceil(lado * lado * 0.8);
    const maxPerto = Math.ceil(Math.PI * (this.raioPerto + 3) ** 2 / (espac * espac));
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, GLOBAIS);
      sh.uniforms.uFoco = this.uFoco;
      sh.uniforms.uRaioG = { value: raio };
      sh.uniforms.uAltura = this.uAltura;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTempo; uniform float uVento; uniform vec3 uFoco; uniform float uRaioG; uniform vec2 uCentro; uniform float uRaio; uniform float uAltura;
          varying float vMulCor;
          ${GLSL_RUIDO}`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 _b = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
           float _d = distance(_b.xz, uFoco.xz);
           float _f = 1.0 - smoothstep(uRaioG * 0.72, uRaioG, _d);
           _f *= 1.0 - smoothstep(uRaio - ${FAIXA_REVELAR.toFixed(1)}, uRaio, distance(_b.xz, uCentro));
           transformed.y *= uAltura;
           float _h = transformed.y;
           float _w = sin(uTempo * 2.2 + _b.x * 0.4 + _b.z * 0.3) * 0.5 + sin(uTempo * 3.7 + _b.x * 0.9) * 0.2;
           transformed.x += _w * 0.12 * uVento * _h * 2.5;
           transformed.z += cos(uTempo * 1.6 + _b.z * 0.5) * 0.06 * uVento * _h * 2.5;
           // dobra para longe do jogador (pisar na grama)
           vec2 _af = _b.xz - uFoco.xz; float _dl = length(_af);
           if (_dl < 1.0) { transformed.xz += normalize(_af + 0.001) * (1.0 - _dl) * _h * 0.8; transformed.y *= 0.6 + 0.4 * _dl; }
           transformed *= _f;
           // mesma variação de cor do terreno (ver Terreno.ts)
           float _d1 = vnoise(_b.xz * 0.35);
           float _d2 = vnoise(_b.xz * 1.7);
           vMulCor = 0.88 + 0.16 * _d1 + 0.07 * _d2;`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vMulCor;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vMulCor;')
        .replace('#include <normal_fragment_begin>', GLSL_SEM_VERSO);
    };
    this.material = mat;
    const criar = (geo: THREE.BufferGeometry, n: number, nome: string) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      im.frustumCulled = false;
      im.receiveShadow = true;
      im.count = 0;
      im.name = nome;
      return im;
    };
    this.perto = criar(geometriaTufo(6, 3, 0.045, 0.38), maxPerto, 'grama');
    this.longe = criar(geometriaTufo(4, 1, 0.06, 0.4), max, 'gramaLonge');
    this.malha = new THREE.Group();
    this.malha.name = 'grama';
    this.malha.add(this.perto, this.longe);
  }

  private uFoco = { value: new THREE.Vector3() };

  /** Troca o perfil (densidade, cor, altura) e refaz a grama. */
  definirPerfil(p: Partial<PerfilGrama>) {
    this.perfil = { ...this.perfil, ...p };
    this.uAltura.value = this.perfil.altura;
    this.grade = null;
    this.forcarReconstrucao();
  }

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

  /** Densidade pré-calculada (0..255) numa grade de 1 m. */
  private densidadeEm(x: number, z: number): number {
    const r = this.relevo;
    const n = Math.round(r.tamanho) + 1;
    if (!this.grade) {
      this.grade = new Uint8Array(n * n);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          this.grade[j * n + i] = Math.round(Math.max(0, Math.min(1, this.perfil.densidade(i - r.meio, j - r.meio))) * 255);
        }
      }
    }
    const i = Math.round(x + r.meio);
    const j = Math.round(z + r.meio);
    if (i < 0 || j < 0 || i >= n || j >= n) return 0;
    return this.grade[j * n + i] / 255;
  }

  private reconstruir(cx: number, cz: number) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const c = new THREE.Color();
    let kp = 0;
    let kl = 0;
    const e = this.espac;
    const r2 = this.raio * this.raio;
    const rp2 = this.raioPerto * this.raioPerto;
    const ini = -this.raio;
    const maxP = this.perto.instanceMatrix.count;
    const maxL = this.longe.instanceMatrix.count;
    const fx = this.uFoco.value.x;
    const fz = this.uFoco.value.z;
    for (let gz = ini; gz < this.raio; gz += e) {
      for (let gx = ini; gx < this.raio; gx += e) {
        if (gx * gx + gz * gz > r2) continue;
        const wx0 = cx + gx;
        const wz0 = cz + gz;
        // jitter determinístico por célula de mundo
        const ci = Math.round(wx0 / e);
        const cj = Math.round(wz0 / e);
        const h1 = hash(ci, cj);
        const h2 = hash(cj + 17, ci - 9);
        const wx = wx0 + (h1 - 0.5) * e;
        const wz = wz0 + (h2 - 0.5) * e;
        if (!this.relevo.dentro(wx, wz, 2)) continue;
        const dens = this.densidadeEm(wx, wz) * this.densidadeGlobal;
        if (h1 * 0.7 + h2 * 0.3 > dens) continue;
        const y = this.relevo.altura(wx, wz);
        if (y < this.nivelAgua + 0.05) continue;
        const dfx = wx - fx;
        const dfz = wz - fz;
        const ehPerto = dfx * dfx + dfz * dfz < rp2;
        if (ehPerto ? kp >= maxP : kl >= maxL) continue;
        q.setFromAxisAngle(up, h2 * 6.283);
        const esc = (0.75 + h1 * 0.7) * (ehPerto ? 1 : 1.12);
        s.set(esc, esc * (0.8 + h2 * 0.6), esc);
        p.set(wx, y - 0.02, wz);
        m.compose(p, q, s);
        this.perfil.cor(wx, wz, c);
        c.offsetHSL((h1 - 0.5) * 0.03, 0, (h2 - 0.5) * 0.06);
        if (ehPerto) {
          this.perto.setMatrixAt(kp, m);
          this.perto.setColorAt(kp, c);
          kp++;
        } else {
          this.longe.setMatrixAt(kl, m);
          this.longe.setColorAt(kl, c);
          kl++;
        }
      }
    }
    for (const [im, k] of [[this.perto, kp], [this.longe, kl]] as const) {
      im.count = k;
      im.visible = k > 0;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    this.perto.geometry.dispose();
    this.longe.geometry.dispose();
    this.material.dispose();
    this.perto.dispose();
    this.longe.dispose();
  }
}

function hash(a: number, b: number): number {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
