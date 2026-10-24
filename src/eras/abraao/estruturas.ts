import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Construtor, CORES } from '../../entidades/Construtor';
import type { Mundo } from '../../mundo/Mundo';
import type { Colisor } from '../../mundo/Colisao';
import { GLOBAIS, aplicarPatch } from '../../render/Shaders';
import { damp } from '../../core/util';
import { Aleatorio } from '../../core/aleatorio';

/** Cores próprias de Canaã: calcário claro, tendas de pelo de cabra, tendas dos reis do oriente. */
export const CORES_CANAA = {
  calcario: '#dcd2bc',
  calcarioEscuro: '#bdb197',
  calcarioQuente: '#d4c3a0',
  rebocoClaro: '#e4d8bf',
  tendaCabra: '#3a3028',
  tendaCabra2: '#4a3c30',
  tendaListra: '#c8b48a',
  tendaInimiga: '#5a2622',
  tendaInimiga2: '#3e2a3c',
  listraInimiga: '#b8743a',
  tapete: '#a8453a',
  tapete2: '#3a5a7a',
  tapete3: '#c89a3a',
  bronze: '#a87a3a',
  ouro: '#d8b050',
};

// ------------------------------------------------------------------------------------------
// Peças (usam a API pública do Construtor)
// ------------------------------------------------------------------------------------------

/** Casa cananeia de pedra (teto plano de terra, mureta, porta escura). Frente para +z. Leve: serve de silhueta ao longe. */
export function casaPedra(c: Construtor, w: number, d: number, h: number, cor = CORES_CANAA.calcario, detalhe = true) {
  c.caixa(0, 0, 0, w, h, d, cor, { raio: detalhe ? 0.15 : 0, ao: 0.28 });
  c.caixa(0, h, 0, w + 0.25, 0.22, d + 0.25, CORES.barroClaro, { raio: 0, ao: 0 });
  c.caixa(0, h + 0.22, -d / 2 + 0.1, w + 0.25, 0.35, 0.2, cor, { raio: 0 });
  c.caixa(0.3, 0, d / 2 + 0.01, 0.95, 1.8, 0.08, CORES.madeiraEscura, { raio: 0, ao: 0 });
  if (detalhe) {
    c.caixa(-w / 4 - 0.3, 1.35, d / 2 + 0.01, 0.5, 0.45, 0.06, '#3a2c20', { raio: 0, ao: 0 });
    for (let i = 0; i < Math.floor(w / 1.1); i++) {
      c.cilindro(-w / 2 + 0.55 + i * 1.1, h - 0.3, d / 2 + 0.12, 0.07, 0.07, 0.4, CORES.madeiraEscura, 5, { rx: Math.PI / 2 });
    }
  }
  c.colisor({ x: 0, z: 0, hx: w / 2 + 0.05, hz: d / 2 + 0.05, y0: -1, y1: h + 0.5, piso: true });
}

/** Muro baixo de pedra seca entre dois pontos locais. */
export function muroPedra(c: Construtor, ax: number, az: number, bx: number, bz: number, h = 1.1, cor = CORES_CANAA.calcarioEscuro) {
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bx - ax, bz - az);
  c.caixa((ax + bx) / 2, 0, (az + bz) / 2, 0.7, h, len, cor, { raio: 0.12, ry: yaw, ao: 0.3 });
  c.colisor({ x: (ax + bx) / 2, z: (az + bz) / 2, hx: 0.38, hz: len / 2, yaw, y0: -1, y1: h, piso: true });
}

/** Aldeia pequena: casas de pedra em volta de um pátio, com um trecho de muro. */
export function aldeia(c: Construtor, casas: [number, number, number, number, number, number][], detalhe = true) {
  casas.forEach(([x, z, yaw, w, d, h], i) => {
    const cor = [CORES_CANAA.calcario, CORES_CANAA.calcarioQuente, CORES_CANAA.rebocoClaro][i % 3];
    c.em(x, 0, z, yaw, () => casaPedra(c, w, d, h, cor, detalhe));
  });
}

/** Tenda de pelo de cabra desmontada: rolos de pano, mastros deitados e estacas. */
export function tendaDesmontada(c: Construtor, w: number, cor = CORES_CANAA.tendaCabra) {
  for (let i = 0; i < 2; i++) {
    c.cilindro(-0.3 + i * 0.75, 0.32, 0, 0.32, 0.32, w * 0.55, i ? CORES_CANAA.tendaCabra2 : cor, 9, { rz: Math.PI / 2 });
  }
  c.caixa(0.2, 0, 0.9, w * 0.5, 0.05, 1.2, CORES_CANAA.tendaListra, { raio: 0.01, ao: 0 });
  for (let i = 0; i < 3; i++) {
    c.viga(new THREE.Vector3(-w * 0.35, 0.05 + i * 0.07, -0.8 - i * 0.18), new THREE.Vector3(w * 0.35, 0.05 + i * 0.07, -0.7 - i * 0.18), 0.045, CORES.madeira, 6);
  }
  for (let i = 0; i < 5; i++) c.cilindro(-1 + i * 0.4, 0, 1.6, 0.03, 0.04, 0.45, CORES.madeiraClara, 5, { rz: 1.3 });
  c.saco(1.6, 0.4, 0.9);
  c.colisor({ x: 0, z: 0, hx: w * 0.3, hz: 0.6, y0: -1, y1: 0.6, piso: true });
}

/** Utensílios de acampamento em volta de uma tenda: jarros, sacos, alforjes, tapete. */
export function utensilios(c: Construtor, r: Aleatorio, n = 4) {
  for (let i = 0; i < n; i++) {
    const a = r.entre(0, Math.PI * 2);
    const d = r.entre(0.6, 1.4);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (r.chance(0.5)) c.jarro(x, z, r.entre(0.8, 1.15), r.chance(0.5) ? '#b8704a' : '#9a6a4a');
    else c.saco(x, z, r.entre(0.7, 1));
  }
}

/** Sela/alforje de jumento ou camelo deixado no chão. */
export function alforje(c: Construtor, cor = '#8a5a3a') {
  c.caixa(0, 0, 0, 1.0, 0.35, 0.6, cor, { raio: 0.12 });
  c.caixa(0, 0.35, 0, 0.7, 0.2, 0.45, CORES_CANAA.tapete, { raio: 0.06 });
  for (const s of [-1, 1]) c.esfera(s * 0.62, 0.25, 0, 0.24, '#7a5236', 0.8, 1, 1.1, 1);
}

/** Tear de chão simples (as mulheres teciam o pelo de cabra). */
export function tear(c: Construtor) {
  for (const s of [-1, 1]) c.cilindro(s * 0.7, 0, -1, 0.04, 0.04, 0.35, CORES.madeira, 5);
  for (const s of [-1, 1]) c.cilindro(s * 0.7, 0, 1, 0.04, 0.04, 0.35, CORES.madeira, 5);
  c.viga(new THREE.Vector3(-0.75, 0.3, -1), new THREE.Vector3(0.75, 0.3, -1), 0.035, CORES.madeiraClara, 5);
  c.viga(new THREE.Vector3(-0.75, 0.3, 1), new THREE.Vector3(0.75, 0.3, 1), 0.035, CORES.madeiraClara, 5);
  c.caixa(0, 0.28, 0, 1.3, 0.015, 2.0, CORES_CANAA.tendaCabra2, { raio: 0, ao: 0 });
}

/** Cocho de pedra para o rebanho beber. */
export function cocho(c: Construtor, comp = 2.4) {
  c.caixa(0, 0, 0, comp, 0.5, 0.75, CORES_CANAA.calcarioEscuro, { raio: 0.08, ao: 0.2 });
  c.caixa(0, 0.42, 0, comp - 0.3, 0.04, 0.45, '#3c6e78', { raio: 0, ao: 0 });
  c.colisor({ x: 0, z: 0, hx: comp / 2, hz: 0.4, y0: -1, y1: 0.5, piso: true });
}

/** Pedra memorial: uma pedra em pé com pedrinhas ao redor. */
export function pedraMemorial(c: Construtor, alta = 1.5) {
  c.caixa(0, 0, 0, 0.55, alta, 0.42, CORES_CANAA.calcario, { raio: 0.18, ao: 0.35 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    c.esfera(Math.cos(a) * 0.9, 0.08, Math.sin(a) * 0.9, 0.2, i % 2 ? CORES.pedra : CORES_CANAA.calcarioEscuro, 1.2, 0.6, 1, 0);
  }
  c.colisor({ x: 0, z: 0, hx: 0.3, hz: 0.25, y0: -1, y1: alta, piso: false });
}

/** Marco de mirante: pedra alta e um montículo de pedras empilhadas. */
export function marcoMirante(c: Construtor) {
  c.caixa(0, 0, 0, 0.8, 2.6, 0.6, CORES_CANAA.calcarioQuente, { raio: 0.25, ao: 0.35 });
  c.caixa(0.15, 2.55, 0, 0.55, 0.4, 0.45, CORES_CANAA.calcario, { raio: 0.15, ry: 0.4 });
  let k = 0;
  for (let camada = 0; camada < 3; camada++) {
    for (let i = 0; i < 5 - camada; i++) {
      const a = (i / (5 - camada)) * Math.PI * 2 + camada;
      c.esfera(1.4 + Math.cos(a) * (0.5 - camada * 0.12), 0.18 + camada * 0.26, 0.6 + Math.sin(a) * (0.5 - camada * 0.12), 0.24, k++ % 2 ? CORES.pedra : CORES_CANAA.calcarioEscuro, 1.1, 0.7, 1, 0);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = 2 + i * 0.9;
    c.esfera(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6, 0.55, CORES_CANAA.calcarioEscuro, 1.4, 0.7, 1.1, 0);
  }
  c.colisor({ x: 0, z: 0, hx: 0.45, hz: 0.35, y0: -1, y1: 2.9, piso: false });
}

/** Pilha de despojos: sacos, jarros, cestos, rolos de tecido, arcas, armas encostadas. */
export function despojos(c: Construtor, r: Aleatorio) {
  for (let i = 0; i < 9; i++) c.saco(r.entre(-2.2, 2.2), r.entre(-1.4, 1.4), r.entre(0.8, 1.2));
  for (let i = 0; i < 8; i++) c.jarro(r.entre(-2.4, 2.4), r.entre(-1.6, 1.6), r.entre(0.9, 1.3), r.chance(0.5) ? '#b8704a' : CORES_CANAA.bronze);
  const tecidos = [CORES_CANAA.tapete, CORES_CANAA.tapete2, CORES_CANAA.tapete3, '#7a3a6a'];
  for (let i = 0; i < 4; i++) c.cilindro(r.entre(-1.5, 1.5), 0.22 + (i % 2) * 0.4, r.entre(-0.6, 0.6), 0.22, 0.22, 1.6, tecidos[i], 8, { rz: Math.PI / 2, ry: r.entre(0, 3) });
  for (let i = 0; i < 3; i++) {
    c.em(r.entre(-2, 2), 0, r.entre(-1.2, 1.2), r.entre(0, 3), () => {
      c.caixa(0, 0, 0, 0.9, 0.55, 0.6, '#6a4228', { raio: 0.04 });
      c.caixa(0, 0.55, 0, 0.95, 0.12, 0.65, CORES_CANAA.ouro, { raio: 0.03, ao: 0 });
    });
  }
  // lanças e escudos de bronze encostados
  for (let i = 0; i < 4; i++) {
    const x = -2.6 + i * 0.35;
    c.viga(new THREE.Vector3(x, 0, 1.9), new THREE.Vector3(x + 0.2, 2.3, 1.5), 0.03, CORES.madeiraEscura, 5);
  }
  for (let i = 0; i < 3; i++) c.cilindro(1.6 + i * 0.5, 0.45, 1.8, 0.42, 0.42, 0.06, CORES_CANAA.bronze, 10, { rx: 1.35 });
  c.colisor({ x: 0, z: 0, hx: 2.6, hz: 1.8, y0: -1, y1: 0.9, piso: true });
}

/** Cercado de cativos: estacas e cordas (sem tranca: uma corda amarrada). */
export function cercadoCativos(c: Construtor, w: number, d: number) {
  const cantos: [number, number][] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = cantos[i];
    const [bx, bz] = cantos[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      c.cilindro(ax + (bx - ax) * t, 0, az + (bz - az) * t, 0.05, 0.07, 1.25, CORES.madeiraEscura, 5);
    }
    for (const y of [0.55, 1.05]) c.viga(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz), 0.018, CORES.corda, 4);
    const yaw = Math.atan2(bx - ax, bz - az);
    c.colisor({ x: (ax + bx) / 2, z: (az + bz) / 2, hx: 0.1, hz: len / 2, yaw, y0: -1, y1: 1.2, piso: false });
  }
  c.caixa(0, 0.01, 0, w - 0.6, 0.03, d - 0.6, '#8a7a5a', { raio: 0, ao: 0 });
}

/** Feixe de lanças em pé (cavalete), típico de um acampamento de guerra. */
export function cavaleteLancas(c: Construtor) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    c.viga(new THREE.Vector3(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5), new THREE.Vector3(Math.cos(a) * 0.1, 2.6, Math.sin(a) * 0.1), 0.03, CORES.madeiraEscura, 5);
  }
  c.colisor({ tipo: 'cilindro', x: 0, z: 0, r: 0.5, y0: -1, y1: 2.4, piso: false });
}

// ------------------------------------------------------------------------------------------
// Fogueiras animadas (chamas sem luz real: brilho aditivo no ar e no chão, visível à noite)
// ------------------------------------------------------------------------------------------

const VERT_BRILHO = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform vec2 uCentro;
uniform float uRaio;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  float enc = 1.0 - smoothstep(uRaio - 20.0, uRaio, distance(base.xz, uCentro));
#ifdef BILLBOARD
  vec4 mvPosition = viewMatrix * base;
  mvPosition.xy += position.xy * s * enc;
#else
  vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position * enc, 1.0);
#endif
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG_BRILHO = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uCor;
uniform float uForca;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - r), 2.4) * uForca;
#ifdef USE_FOG
  a *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
#endif
  gl_FragColor = vec4(uCor * a, 1.0);
}`;

function materialBrilho(cor: string, billboard: boolean) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCor: { value: new THREE.Color(cor) }, uForca: { value: 1 } }]),
    vertexShader: VERT_BRILHO,
    fragmentShader: FRAG_BRILHO,
    defines: billboard ? { BILLBOARD: '' } : {},
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
    toneMapped: false,
  });
  // uCentro/uRaio compartilhados com a "revelação" da transição de era
  m.uniforms.uCentro = GLOBAIS.uCentro;
  m.uniforms.uRaio = GLOBAIS.uRaio;
  if (!billboard) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
  }
  m.userData.patch = true;
  return m;
}

/** Chama estilizada: três cones (vermelho → laranja → amarelo) e duas línguas laterais. */
function geometriaChama() {
  const partes: THREE.BufferGeometry[] = [];
  const cores = [new THREE.Color('#ff5a1e'), new THREE.Color('#ff9a2a'), new THREE.Color('#ffe27a')];
  const cones: [number, number, number, number, number][] = [
    // raio, altura, dx, dz, índice de cor
    [0.34, 0.95, 0, 0, 0],
    [0.17, 0.55, 0.22, 0.08, 0],
    [0.15, 0.5, -0.18, -0.14, 0],
    [0.24, 0.72, 0.02, 0.03, 1],
    [0.13, 0.46, -0.01, 0.02, 2],
  ];
  const base = new THREE.Color('#fff2b0');
  for (const [r, h, dx, dz, ci] of cones) {
    const g = new THREE.CylinderGeometry(0, r, h, 7, 2, true);
    g.translate(dx, h / 2 + 0.05, dz);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp((pos.getY(i) - 0.05) / h, 0, 1);
      c.copy(base).lerp(cores[ci], Math.min(1, t * 1.4));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    partes.push(g.index ? g.toNonIndexed() : g);
  }
  return mergeGeometries(partes, false)!;
}

interface Fogo {
  x: number;
  y: number;
  z: number;
  escala: number;
  ativa: boolean;
  fase: number;
}

/**
 * Todas as fogueiras de um mundo em três draw calls (chamas, halo no ar, brilho no chão).
 * O brilho cresce à noite (`noite` 0..1). Adicione todas antes de `construir()`.
 */
export class Fogueiras {
  readonly grupo = new THREE.Group();
  readonly lista: Fogo[] = [];
  /** 0 = dia, 1 = noite (controla o halo e o brilho no chão). */
  noite = 0;
  private chamas: THREE.InstancedMesh | null = null;
  private halos: THREE.InstancedMesh | null = null;
  private chao: THREE.InstancedMesh | null = null;
  private matHalo = materialBrilho('#ff9038', true);
  private matChao = materialBrilho('#ff8a30', false);
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private eixo = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.grupo.name = 'fogueiras';
  }

  adicionar(x: number, y: number, z: number, escala = 1, ativa = true): number {
    this.lista.push({ x, y, z, escala, ativa, fase: this.lista.length * 2.17 });
    return this.lista.length - 1;
  }

  ativar(i: number, sim: boolean) {
    const f = this.lista[i];
    if (f) f.ativa = sim;
  }

  construir() {
    const n = Math.max(1, this.lista.length);
    const matChama = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
    aplicarPatch(matChama, { revelar: true });
    matChama.userData.patch = true;
    this.chamas = new THREE.InstancedMesh(geometriaChama(), matChama, n);
    this.chamas.name = 'chamas';
    const quad = new THREE.PlaneGeometry(1, 1);
    this.halos = new THREE.InstancedMesh(quad, this.matHalo, n);
    this.halos.name = 'halosFogo';
    const disco = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.chao = new THREE.InstancedMesh(disco, this.matChao, n);
    this.chao.name = 'brilhoChao';
    for (const im of [this.chamas, this.halos, this.chao]) {
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = false;
      this.grupo.add(im);
    }
    this.halos.renderOrder = 5;
    this.chao.renderOrder = 4;
    this.atualizar(0, 0);
  }

  atualizar(_dt: number, t: number) {
    if (!this.chamas || !this.halos || !this.chao) return;
    const { m4, q, p, s } = this;
    let k = 0;
    for (const f of this.lista) {
      if (!f.ativa) continue;
      const e = f.escala;
      const fl = 1 + Math.sin(t * 9.1 + f.fase) * 0.13 + Math.sin(t * 17.3 + f.fase * 2.3) * 0.07;
      q.setFromAxisAngle(this.eixo, t * 0.9 + f.fase);
      p.set(f.x, f.y, f.z);
      s.set(e * (1 + Math.sin(t * 13 + f.fase) * 0.05), e * fl, e * (1 + Math.cos(t * 11 + f.fase) * 0.05));
      m4.compose(p, q, s);
      this.chamas.setMatrixAt(k, m4);
      q.identity();
      p.set(f.x, f.y + 0.65 * e, f.z);
      s.setScalar(e * (3.2 + this.noite * 2.2) * (1 + Math.sin(t * 7.7 + f.fase) * 0.06));
      m4.compose(p, q, s);
      this.halos.setMatrixAt(k, m4);
      p.set(f.x, f.y + 0.06, f.z);
      s.setScalar(e * (5 + this.noite * 4) * (1 + Math.sin(t * 6.1 + f.fase) * 0.05));
      m4.compose(p, q, s);
      this.chao.setMatrixAt(k, m4);
      k++;
    }
    for (const im of [this.chamas, this.halos, this.chao]) {
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
    }
    this.matHalo.uniforms.uForca.value = 0.18 + this.noite * 0.75;
    this.matChao.uniforms.uForca.value = 0.08 + this.noite * 0.55;
  }
}

// ------------------------------------------------------------------------------------------
// Porteira móvel com colisor
// ------------------------------------------------------------------------------------------

/**
 * Porteira de curral que gira na dobradiça. O colisor acompanha o painel (fechada bloqueia a
 * abertura; aberta fica encostada para fora). A navegação da região é refeita ao parar.
 */
export class Porteira {
  readonly grupo = new THREE.Group();
  readonly nome: string;
  aberta = false;
  private colisor: Colisor;
  private ang: number;
  private alvo: number;
  private movendo = false;

  constructor(
    private m: Mundo,
    nome: string,
    private hx: number,
    hy: number,
    private hz: number,
    private yawFechada: number,
    private yawAberta: number,
    private comp: number,
  ) {
    this.nome = nome;
    this.ang = yawFechada;
    this.alvo = yawFechada;
    const c = new Construtor(nome.length * 7 + 3);
    const L = comp;
    for (const y of [0.32, 0.68, 1.02]) c.viga(new THREE.Vector3(0.1, y, 0), new THREE.Vector3(L - 0.05, y, 0), 0.04, CORES.madeiraClara, 5);
    c.cilindro(0.14, 0.05, 0, 0.05, 0.05, 1.1, CORES.madeira, 6);
    c.cilindro(L - 0.12, 0.05, 0, 0.05, 0.05, 1.1, CORES.madeira, 6);
    c.viga(new THREE.Vector3(0.18, 0.3, 0), new THREE.Vector3(L - 0.15, 1.0, 0), 0.035, CORES.madeira, 5);
    // anel de corda na dobradiça
    c.cilindro(0.02, 0.9, 0, 0.09, 0.09, 0.08, CORES.corda, 8);
    c.cilindro(0.02, 0.35, 0, 0.09, 0.09, 0.08, CORES.corda, 8);
    const { malha } = c.construir(`porteira_${nome}`);
    if (malha) this.grupo.add(malha);
    this.grupo.name = nome;
    this.grupo.position.set(hx, hy, hz);
    this.grupo.rotation.y = this.ang;
    m.adicionar(this.grupo);
    this.colisor = m.colisoes.adicionar({ x: hx, z: hz, hx: L / 2, hz: 0.12, yaw: this.ang, y0: hy - 1, y1: hy + 1.15, piso: false, tag: 'porteira' });
    this.posicionarColisor();
    m.atualizaveis.add(this);
  }

  private posicionarColisor() {
    const c = Math.cos(this.ang);
    const s = Math.sin(this.ang);
    const x = this.hx + c * this.comp / 2;
    const z = this.hz - s * this.comp / 2;
    this.m.colisoes.mover(this.colisor, x, z, this.ang);
  }

  definir(aberta: boolean, instantaneo = false) {
    this.aberta = aberta;
    this.alvo = aberta ? this.yawAberta : this.yawFechada;
    if (instantaneo) {
      this.ang = this.alvo;
      this.grupo.rotation.y = this.ang;
      this.posicionarColisor();
      this.refazerNavegacao();
      this.movendo = false;
    } else this.movendo = true;
  }

  atualizar(dt: number) {
    if (!this.movendo) return;
    this.ang = damp(this.ang, this.alvo, 5, dt);
    if (Math.abs(this.ang - this.alvo) < 0.004) {
      this.ang = this.alvo;
      this.movendo = false;
      this.refazerNavegacao();
    }
    this.grupo.rotation.y = this.ang;
    this.posicionarColisor();
  }

  private refazerNavegacao() {
    const r = this.comp + 2;
    this.m.nav?.reconstruir(this.hx - r, this.hz - r, this.hx + r, this.hz + r);
  }
}
