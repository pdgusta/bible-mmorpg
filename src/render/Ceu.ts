import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/util';
import { Aleatorio } from '../core/aleatorio';

interface Paleta {
  h: number;
  zenite: string;
  horizonte: string;
  sol: string;
  intSol: number;
  hemiCeu: string;
  hemiChao: string;
  intHemi: number;
  neblina: string;
}

// Paleta quente e suave ao longo do dia (inspirada na luz de fim de tarde de Palia).
const PALETAS: Paleta[] = [
  { h: 0, zenite: '#0b1630', horizonte: '#24365c', sol: '#8fa6e8', intSol: 0.35, hemiCeu: '#33477a', hemiChao: '#141a24', intHemi: 0.55, neblina: '#1c2a48' },
  { h: 4.8, zenite: '#1a2550', horizonte: '#4a4a78', sol: '#9fa8e0', intSol: 0.3, hemiCeu: '#3c4a80', hemiChao: '#1b1e2a', intHemi: 0.55, neblina: '#34365e' },
  { h: 6, zenite: '#5874b8', horizonte: '#f4a98a', sol: '#ffab6e', intSol: 1.2, hemiCeu: '#8fa4d8', hemiChao: '#5a4a3a', intHemi: 0.8, neblina: '#d8a898' },
  { h: 7.5, zenite: '#5f93d8', horizonte: '#ffd2a8', sol: '#ffd09a', intSol: 2.2, hemiCeu: '#b4cde8', hemiChao: '#6f6046', intHemi: 1.0, neblina: '#e6cdb4' },
  { h: 10, zenite: '#4b8fe0', horizonte: '#cfe5f4', sol: '#fff2dc', intSol: 2.7, hemiCeu: '#cfe2f4', hemiChao: '#7a6f52', intHemi: 1.15, neblina: '#cfe0ea' },
  { h: 14, zenite: '#4a8ee2', horizonte: '#d6eaf6', sol: '#fff4e2', intSol: 2.8, hemiCeu: '#d6e6f4', hemiChao: '#7e7254', intHemi: 1.15, neblina: '#d4e4ec' },
  { h: 16.8, zenite: '#5d92d8', horizonte: '#ffe0b0', sol: '#ffd9a0', intSol: 2.5, hemiCeu: '#d8dcec', hemiChao: '#86704e', intHemi: 1.05, neblina: '#f0dcc0' },
  { h: 18.3, zenite: '#556fae', horizonte: '#ffa874', sol: '#ff9a5a', intSol: 1.6, hemiCeu: '#b0a8cc', hemiChao: '#6a4e3c', intHemi: 0.85, neblina: '#e8a888' },
  { h: 19.4, zenite: '#2c3a72', horizonte: '#a86a7a', sol: '#ff7a50', intSol: 0.6, hemiCeu: '#6a6a9c', hemiChao: '#2c2430', intHemi: 0.65, neblina: '#6a5274' },
  { h: 20.5, zenite: '#141e40', horizonte: '#33406a', sol: '#8fa6e8', intSol: 0.3, hemiCeu: '#34467a', hemiChao: '#161a26', intHemi: 0.55, neblina: '#253456' },
  { h: 24, zenite: '#0b1630', horizonte: '#24365c', sol: '#8fa6e8', intSol: 0.35, hemiCeu: '#33477a', hemiChao: '#141a24', intHemi: 0.55, neblina: '#1c2a48' },
];

const C = (s: string) => new THREE.Color(s);
const PAL = PALETAS.map((p) => ({ ...p, cz: C(p.zenite), ch: C(p.horizonte), cs: C(p.sol), chc: C(p.hemiCeu), chg: C(p.hemiChao), cn: C(p.neblina) }));

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */ `
uniform vec3 uZenite; uniform vec3 uHorizonte; uniform vec3 uSolCor; uniform vec3 uSolDir;
uniform float uNoite; uniform float uTempo; uniform float uArco; uniform vec3 uArcoDir; uniform float uTempestade;
uniform vec3 uDourado; uniform float uGloria;
varying vec3 vDir;
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hsv(float h){ vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0); vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0); return clamp(p - 1.0, 0.0, 1.0); }
void main() {
  vec3 d = normalize(vDir);
  float alt = clamp(d.y, -1.0, 1.0);
  float t = pow(clamp(alt, 0.0, 1.0), 0.55);
  vec3 cor = mix(uHorizonte, uZenite, t);
  // abaixo do horizonte: tom do horizonte escurecido
  cor = mix(cor, uHorizonte * 0.75, smoothstep(0.0, -0.25, alt));
  // brilho do sol
  float cs = max(dot(d, uSolDir), 0.0);
  cor += uSolCor * (pow(cs, 9.0) * 0.32 + pow(cs, 90.0) * 0.6) * (1.0 - uNoite * 0.7) * (1.0 - uTempestade);
  float disco = smoothstep(0.9993, 0.99965, cs);
  cor = mix(cor, mix(vec3(1.0, 0.97, 0.9), vec3(0.85, 0.9, 1.0), uNoite), disco * (1.0 - uTempestade));
  // estrelas
  if (uNoite > 0.01 && alt > 0.0) {
    vec3 g = floor(d * 260.0);
    float h = hash13(g);
    float est = step(0.9965, h) * (0.6 + 0.4 * sin(uTempo * (1.0 + h * 4.0) + h * 30.0));
    float h2 = hash13(floor(d * 120.0) + 7.0);
    est += step(0.9985, h2) * 1.2;
    cor += vec3(est) * uNoite * smoothstep(0.0, 0.25, alt) * (1.0 - uTempestade);
  }
  // arco-íris (Gênesis 9:13)
  if (uArco > 0.001) {
    float ang = acos(clamp(dot(d, uArcoDir), -1.0, 1.0));
    float banda = (ang - 0.68) / 0.06;
    if (banda > 0.0 && banda < 1.0 && alt > -0.02) {
      vec3 rb = hsv(0.8 - banda * 0.8);
      float borda = smoothstep(0.0, 0.18, banda) * smoothstep(1.0, 0.82, banda);
      cor = mix(cor, cor + rb * 0.75, borda * uArco * smoothstep(-0.02, 0.12, alt));
    }
  }
  // tempestade: cinza pesado
  cor = mix(cor, vec3(0.24, 0.27, 0.31) * (0.6 + 0.4 * t), uTempestade);
  // glória dourada (transição entre eras)
  cor = mix(cor, uDourado, uGloria);
  gl_FragColor = vec4(cor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/**
 * Céu com ciclo do dia, sol/lua, estrelas, nuvens fofas, arco-íris e tempestade.
 * Controla também as luzes e a neblina da cena.
 */
export class Ceu {
  readonly grupo = new THREE.Group();
  readonly sol: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly neblina: THREE.Fog;
  private cupula: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private nuvens: THREE.InstancedMesh;
  private dadosNuvens: { x: number; z: number; y: number; s: number; v: number }[] = [];
  /** Hora do dia em [0, 24). */
  hora = 9;
  /** Horas de jogo por segundo real (24 min por dia). */
  velocidade = 1 / 60;
  pausado = false;
  tempestade = 0;
  arco = 0;
  gloria = 0;
  private relampago = 0;
  private proxRelampago = 4;
  readonly direcaoSol = new THREE.Vector3();
  private alvoSombra = new THREE.Vector3();
  private tamSombra = 45;
  noite = 0;
  readonly corNeblinaBase = new THREE.Color();

  constructor(cena: THREE.Scene, tamanhoSombra: number) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uZenite: { value: new THREE.Color() }, uHorizonte: { value: new THREE.Color() },
        uSolCor: { value: new THREE.Color() }, uSolDir: { value: new THREE.Vector3(0, 1, 0) },
        uNoite: { value: 0 }, uTempo: { value: 0 }, uArco: { value: 0 }, uArcoDir: { value: new THREE.Vector3(0, -0.3, 1).normalize() },
        uTempestade: { value: 0 }, uDourado: { value: new THREE.Color('#ffe2a0') }, uGloria: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.cupula = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.mat);
    this.cupula.frustumCulled = false;
    this.cupula.renderOrder = -10;
    this.grupo.add(this.cupula);

    this.hemi = new THREE.HemisphereLight('#cfe2f4', '#7a6f52', 1.1);
    this.grupo.add(this.hemi);
    this.sol = new THREE.DirectionalLight('#fff2dc', 2.6);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(tamanhoSombra, tamanhoSombra);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.04;
    const cam = this.sol.shadow.camera;
    cam.near = 1;
    cam.far = 260;
    cam.left = -this.tamSombra; cam.right = this.tamSombra; cam.top = this.tamSombra; cam.bottom = -this.tamSombra;
    this.grupo.add(this.sol, this.sol.target);

    this.neblina = new THREE.Fog('#cfe0ea', 60, 260);
    cena.fog = this.neblina;
    cena.add(this.grupo);

    // nuvens fofas: aglomerados de esferas achatadas, instanciados
    const geo = criarGeometriaNuvem();
    const matN = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, fog: false });
    this.nuvens = new THREE.InstancedMesh(geo, matN, 26);
    this.nuvens.frustumCulled = false;
    const r = new Aleatorio(77);
    for (let i = 0; i < 26; i++) {
      const ang = r.entre(0, Math.PI * 2);
      const dist = r.entre(260, 620);
      this.dadosNuvens.push({ x: Math.cos(ang) * dist, z: Math.sin(ang) * dist, y: r.entre(110, 190), s: r.entre(14, 30), v: r.entre(0.6, 1.4) });
    }
    this.grupo.add(this.nuvens);
  }

  ajustarDistancia(dist: number) {
    this.neblina.near = dist * 0.28;
    this.neblina.far = dist;
  }

  private amostrarPaleta(h: number) {
    let a = PAL[0];
    let b = PAL[PAL.length - 1];
    for (let i = 0; i < PAL.length - 1; i++) {
      if (h >= PAL[i].h && h <= PAL[i + 1].h) {
        a = PAL[i];
        b = PAL[i + 1];
        break;
      }
    }
    const t = (h - a.h) / Math.max(0.0001, b.h - a.h);
    return { a, b, t };
  }

  atualizar(dt: number, foco: THREE.Vector3, tempo: number) {
    if (!this.pausado) this.hora = (this.hora + dt * this.velocidade) % 24;
    const { a, b, t } = this.amostrarPaleta(this.hora);
    const u = this.mat.uniforms;
    (u.uZenite.value as THREE.Color).copy(a.cz).lerp(b.cz, t);
    (u.uHorizonte.value as THREE.Color).copy(a.ch).lerp(b.ch, t);
    const corSol = (u.uSolCor.value as THREE.Color).copy(a.cs).lerp(b.cs, t);
    this.hemi.color.copy(a.chc).lerp(b.chc, t);
    this.hemi.groundColor.copy(a.chg).lerp(b.chg, t);
    this.hemi.intensity = lerp(a.intHemi, b.intHemi, t);
    this.corNeblinaBase.copy(a.cn).lerp(b.cn, t);

    // direção do sol: nasce a leste (+x), põe-se a oeste (-x), passando pelo sul (+z)
    const ang = ((this.hora - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const diaSol = elev > -0.05;
    this.noite = 1 - smoothstep(-0.12, 0.12, elev);
    let dir: THREE.Vector3;
    if (diaSol) dir = this.direcaoSol.set(Math.cos(ang), Math.max(0.06, elev) * 1.1, 0.45).normalize();
    else {
      // lua: lado oposto
      const al = ((this.hora + 6) / 12) * Math.PI;
      dir = this.direcaoSol.set(Math.cos(al), Math.max(0.25, Math.abs(Math.sin(al))), -0.35).normalize();
    }
    (u.uSolDir.value as THREE.Vector3).copy(dir);
    u.uNoite.value = this.noite;
    u.uTempo.value = tempo;
    u.uArco.value = this.arco;
    u.uTempestade.value = this.tempestade;
    u.uGloria.value = this.gloria;

    let intSol = lerp(a.intSol, b.intSol, t);
    intSol *= 1 - this.tempestade * 0.75;
    this.hemi.intensity *= 1 - this.tempestade * 0.35;

    // relâmpagos durante a tempestade
    if (this.tempestade > 0.6) {
      this.proxRelampago -= dt;
      if (this.proxRelampago <= 0) {
        this.relampago = 1;
        this.proxRelampago = 3 + Math.random() * 6;
      }
    }
    if (this.relampago > 0) {
      this.relampago = Math.max(0, this.relampago - dt * 3.5);
      const f = this.relampago > 0.7 || (this.relampago > 0.3 && this.relampago < 0.45) ? 1 : 0;
      this.hemi.intensity += f * 2.5;
    }

    this.sol.color.copy(corSol);
    this.sol.intensity = intSol;
    this.neblina.color.copy(this.corNeblinaBase).lerp(new THREE.Color('#5a626c'), this.tempestade * 0.8);
    if (this.gloria > 0) this.neblina.color.lerp(u.uDourado.value as THREE.Color, this.gloria);

    // sombra acompanha o foco, com passo em texels para evitar tremulação
    const texel = (this.tamSombra * 2) / this.sol.shadow.mapSize.x;
    this.alvoSombra.set(Math.round(foco.x / texel) * texel, foco.y, Math.round(foco.z / texel) * texel);
    this.sol.target.position.copy(this.alvoSombra);
    this.sol.position.copy(this.alvoSombra).addScaledVector(dir, 120);
    this.cupula.position.copy(foco);

    // nuvens
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const matN = this.nuvens.material as THREE.MeshLambertMaterial;
    matN.color.copy(this.hemi.color).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(1 - this.noite * 0.75);
    matN.emissive.copy(corSol).multiplyScalar(0.35 * (1 - this.noite * 0.8)).lerp(new THREE.Color('#40444c'), this.tempestade);
    for (let i = 0; i < this.dadosNuvens.length; i++) {
      const n = this.dadosNuvens[i];
      n.x += n.v * dt * 2.2;
      if (n.x > 650) n.x = -650;
      p.set(foco.x + n.x, n.y - this.tempestade * 40, foco.z + n.z);
      s.set(n.s * (1 + this.tempestade * 0.6), n.s * 0.45, n.s * 0.8);
      m.compose(p, q, s);
      this.nuvens.setMatrixAt(i, m);
    }
    this.nuvens.instanceMatrix.needsUpdate = true;
  }

  get escuridao(): number {
    return clamp(this.noite + this.tempestade * 0.4, 0, 1);
  }
}

function criarGeometriaNuvem(): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = [];
  const r = new Aleatorio(5);
  for (let i = 0; i < 7; i++) {
    const g = new THREE.IcosahedronGeometry(r.entre(0.45, 0.8), 1);
    g.translate(r.entre(-1.1, 1.1), r.entre(-0.1, 0.35), r.entre(-0.5, 0.5));
    partes.push(g);
  }
  return mesclar(partes);
}

/** Mescla geometrias não indexadas simples (posição e normal). */
export function mesclar(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  for (const g0 of partes) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) {
      pos.push(p[i]);
      nor.push(n[i]);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
