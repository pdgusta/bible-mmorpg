import * as THREE from 'three';
import { CorpoBase, Pele } from './CorpoBase';
import { clamp, smoothstep, lerp } from '../../core/util';

export type EstiloCabelo = 'curto' | 'longo' | 'calvo' | 'preso' | 'cacheado';
export type Cobertura = 'nenhuma' | 'lenco' | 'turbante' | 'veu' | 'faixa';

/** Aparência de um personagem humano (tudo gerado por código sobre o corpo base). */
export interface Aparencia {
  corpo: 'masc' | 'fem';
  altura: number;
  pele: string;
  cabelo: { estilo: EstiloCabelo; cor: string };
  barba?: { comprimento: number; cor: string };
  tunica: { cor: string; cor2?: string; listras?: boolean; comprimento?: 'longa' | 'joelho' };
  manto?: { cor: string; cor2?: string; comprimento?: 'longa' | 'joelho' };
  faixa?: string;
  cabeca?: { tipo: Cobertura; cor: string; cor2?: string };
  /** Escala da cabeça (estilização amigável). */
  cabecaEscala?: number;
  sandalia?: string;
}

type Peso = [number, number][];

/** Acumulador de vértices skinned com cor por vértice. */
export class Malhador {
  pos: number[] = [];
  nor: number[] = [];
  cor: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  idx: number[] = [];
  cabecaInicio?: number;

  vert(x: number, y: number, z: number, c: THREE.Color, pesos: Peso, nx = 0, ny = 0, nz = 0): number {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.nor.push(nx, ny, nz);
    this.cor.push(c.r, c.g, c.b);
    const p = normalizarPesos(pesos);
    for (let k = 0; k < 4; k++) {
      this.si.push(p[k]?.[0] ?? 0);
      this.sw.push(p[k]?.[1] ?? 0);
    }
    return i;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  /** Adiciona uma geometria rígida presa a um osso, já posicionada em espaço bind. */
  rigido(g: THREE.BufferGeometry, m: THREE.Matrix4, c: THREE.Color | ((x: number, y: number, z: number) => THREE.Color), osso: number) {
    const geo = g.index ? g : g;
    const p = geo.attributes.position;
    const nn = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize();
      const cor = typeof c === 'function' ? c(v.x, v.y, v.z) : c;
      this.vert(v.x, v.y, v.z, cor, [[osso, 1]], n.x, n.y, n.z);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  geometria(calcularNormais: boolean): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.cor, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    if (calcularNormais) g.computeVertexNormals();
    return g;
  }
}

function normalizarPesos(p: Peso): Peso {
  const ordenado = p.filter((x) => x[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const soma = ordenado.reduce((s, x) => s + x[1], 0) || 1;
  return ordenado.map(([i, w]) => [i, w / soma]);
}

/** Tubo genérico: anéis de raios por ângulo, com pesos e cores por vértice. */
function tubo(
  M: Malhador,
  aneis: { y: number; raios: number[]; centro: [number, number] }[],
  segs: number,
  cor: (anel: number, seg: number) => THREE.Color,
  pesos: (x: number, y: number, z: number, anel: number) => Peso,
  abertura = 0,
) {
  const inicio = M.pos.length / 3;
  const ativos: number[] = [];
  for (let s = 0; s <= segs; s++) {
    const a = (s / segs) * Math.PI * 2 - Math.PI;
    // abertura frontal (manto): ângulo 0 é a frente (+z)
    if (abertura > 0 && Math.abs(a) < abertura) continue;
    ativos.push(s);
  }
  for (let r = 0; r < aneis.length; r++) {
    const an = aneis[r];
    for (const s of ativos) {
      const a = (s / segs) * Math.PI * 2 - Math.PI;
      const rr = an.raios[s % segs];
      const x = an.centro[0] + Math.sin(a) * rr;
      const z = an.centro[1] + Math.cos(a) * rr;
      M.vert(x, an.y, z, cor(r, s), pesos(x, an.y, z, r));
    }
  }
  const n = ativos.length;
  for (let r = 0; r < aneis.length - 1; r++) {
    for (let k = 0; k < n - 1; k++) {
      if (abertura === 0 && ativos[k + 1] - ativos[k] !== 1) continue;
      if (abertura > 0 && ativos[k + 1] - ativos[k] !== 1) continue;
      const a = inicio + r * n + k;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      M.tri(a, c, b);
      M.tri(b, c, d);
    }
  }
}

function suavizarRaios(r: number[][], vezes: number) {
  const A = r.length;
  const S = r[0].length;
  for (let v = 0; v < vezes; v++) {
    const c = r.map((l) => l.slice());
    for (let i = 0; i < A; i++) {
      for (let s = 0; s < S; s++) {
        const viz = [c[i][(s + S - 1) % S], c[i][(s + 1) % S], c[Math.max(0, i - 1)][s], c[Math.min(A - 1, i + 1)][s]];
        r[i][s] = Math.max(c[i][s] * 0.4 + (viz[0] + viz[1] + viz[2] + viz[3]) * 0.15, c[i][s] * 0.97);
      }
    }
  }
}

/**
 * Gera roupa e cabeça sobre o corpo base, devolvendo uma geometria skinned única
 * (corpo + roupas + rosto) para um personagem: 1 draw call.
 */
export function gerarPersonagem(base: CorpoBase, ap: Aparencia): THREE.BufferGeometry {
  const M = new Malhador();
  const J = (n: string) => base.junta(n);
  const I = (n: string) => base.indiceOsso(n);
  const pele = new THREE.Color(ap.pele);
  const junta = pele.clone().multiplyScalar(0.93);
  const sandalia = new THREE.Color(ap.sandalia ?? '#6b4a2e');

  const yPescoco = J('neck_01').y;
  const yQuadril = J('pelvis').y;
  const yJoelho = J('calf_l').y;
  const yTornozelo = J('foot_l').y;
  const ombroX = J('upperarm_l').x;
  const maoX = J('hand_l').x;
  const longa = (ap.tunica.comprimento ?? 'longa') === 'longa';
  const yBarra = longa ? yTornozelo + 0.07 : yJoelho - 0.06;

  // ---- corpo base: recolhe partes cobertas pela roupa e a cabeça original ----
  const cabecaIdx = I('Head');
  const yCabecaJ = J('Head').y;
  const escalaCab = ap.cabecaEscala ?? 1.18;
  const raioCab = ((base.yTopo - yCabecaJ) / 2 + 0.01) * escalaCab;
  const centroCab = new THREE.Vector3(0, yCabecaJ + raioCab * 0.92, J('Head').z + 0.012);
  const nb = base.categoria.length;
  const pernas = new Map<number, [string, string]>([
    [I('thigh_l'), ['thigh_l', 'calf_l']], [I('calf_l'), ['calf_l', 'foot_l']],
    [I('thigh_r'), ['thigh_r', 'calf_r']], [I('calf_r'), ['calf_r', 'foot_r']],
  ]);
  const yPeito = J('spine_03').y;
  for (let i = 0; i < nb; i++) {
    let x = base.posicoes[i * 3];
    let y = base.posicoes[i * 3 + 1];
    let z = base.posicoes[i * 3 + 2];
    const dom = base.dominante(i);
    const perna = pernas.get(dom);
    if (dom === cabecaIdx && y > yCabecaJ - 0.01) {
      x = centroCab.x + (x - centroCab.x) * 0.55;
      y = centroCab.y + (y - centroCab.y) * 0.55;
      z = centroCab.z + (z - centroCab.z) * 0.55;
    } else if (perna && y > yBarra + 0.02) {
      // pernas cobertas: afina em torno do próprio eixo da perna
      const a = J(perna[0]);
      const b = J(perna[1]);
      const t = clamp((y - a.y) / (b.y - a.y), 0, 1);
      const ex = a.x + (b.x - a.x) * t;
      const ez = a.z + (b.z - a.z) * t;
      x = ex + (x - ex) * 0.72;
      z = ez + (z - ez) * 0.72;
    } else if (Math.abs(x) < ombroX * 1.02 && y > yBarra + 0.02 && y < yPescoco - 0.035) {
      const k = y > yPeito - 0.04 && Math.abs(x) > ombroX * 0.45 ? 0.82 : 0.88;
      x *= k;
      z *= 0.88;
      if (k < 0.85) y -= 0.012;
    } else if (Math.abs(x) >= ombroX && Math.abs(x) < maoX - 0.05 && y > yQuadril + 0.2) {
      const e = base.eixoBraco(Math.abs(x));
      y = e.y + (y - e.y) * 0.8;
      z = e.z + (z - e.z) * 0.8;
    }
    const cat = base.categoria[i];
    const c = cat === Pele.Sola ? sandalia : cat === Pele.Junta ? junta : pele;
    const pesos: Peso = [];
    for (let k = 0; k < 4; k++) pesos.push([base.skinIndex[i * 4 + k], base.skinWeight[i * 4 + k]]);
    M.vert(x, y, z, c, pesos, base.normais[i * 3], base.normais[i * 3 + 1], base.normais[i * 3 + 2]);
  }
  for (let i = 0; i < base.indicesPele.length; i++) M.idx.push(base.indicesPele[i]);
  const corpoFim = M.pos.length / 3;

  // ---- túnica ----
  const pesosTronco = criarPesosTronco(base);
  const segs = 36;
  const corT = new THREE.Color(ap.tunica.cor);
  const corT2 = new THREE.Color(ap.tunica.cor2 ?? ap.tunica.cor).multiplyScalar(ap.tunica.cor2 ? 1 : 0.8);
  const aneisT = aneisRoupa(base, yPescoco - 0.008, yBarra, segs, 0.016, longa ? 0.06 : 0.03, yQuadril);
  tubo(M, aneisT, segs,
    (r, s) => {
      const y = aneisT[r].y;
      if (y < yBarra + 0.05) return corT2;
      if (r <= 1) return corT2;
      if (ap.tunica.listras && (s % 9 === 0 || s % 9 === 1)) return corT2;
      return corT;
    },
    (x, y, z) => pesosTronco(x, y, z));

  // ---- faixa (cinto) ----
  if (ap.faixa) {
    const yF = J('spine_01').y + 0.01;
    const corF = new THREE.Color(ap.faixa);
    const aneisF = [yF + 0.035, yF + 0.02, yF - 0.02, yF - 0.035].map((y, k) => {
      const anel = aneisRoupa(base, y + 0.001, y, segs, 0.03 + (k === 0 || k === 3 ? 0 : 0.008), 0, yQuadril)[0];
      return anel;
    });
    tubo(M, aneisF, segs, () => corF, (x, y, z) => pesosTronco(x, y, z));
  }

  // ---- mangas ----
  for (const lado of [1, -1]) {
    const nomeB = lado > 0 ? 'upperarm_l' : 'upperarm_r';
    const nomeA = lado > 0 ? 'lowerarm_l' : 'lowerarm_r';
    const nomeC = lado > 0 ? 'clavicle_l' : 'clavicle_r';
    const xIni = ombroX * 0.5;
    const xFim = maoX - 0.035;
    const cot = J(nomeA).x * lado;
    const nAneis = 14;
    const segsM = 16;
    const ini = M.pos.length / 3;
    for (let r = 0; r <= nAneis; r++) {
      const t = r / nAneis;
      const ax = lerp(xIni, xFim, t);
      const e = base.eixoBraco(ax);
      const raio = Math.min(0.07, base.raioBraco(Math.max(ax, ombroX))) + 0.016 + smoothstep(0.5, 1, t) * 0.03 + (1 - smoothstep(0, 0.25, t)) * 0.02;
      for (let s = 0; s <= segsM; s++) {
        const a = (s / segsM) * Math.PI * 2;
        const y = e.y + Math.cos(a) * raio * 1.0;
        const z = e.z + Math.sin(a) * raio * 1.05;
        const x = ax * lado;
        let pesos: Peso;
        if (ax < ombroX) pesos = [[I(nomeC), 0.5], [I(nomeB), 0.3], [I('spine_03'), 0.2]];
        else {
          const w = smoothstep(cot - 0.05, cot + 0.05, ax);
          pesos = [[I(nomeB), 1 - w], [I(nomeA), w]];
        }
        const corM = t > 0.9 ? corT2 : corT;
        M.vert(x, y, z, corM, pesos);
      }
    }
    for (let r = 0; r < nAneis; r++) {
      for (let s = 0; s < segsM; s++) {
        const a = ini + r * (segsM + 1) + s;
        const b = a + 1;
        const c = a + segsM + 1;
        const d = c + 1;
        if (lado > 0) { M.tri(a, b, c); M.tri(b, d, c); } else { M.tri(a, c, b); M.tri(b, c, d); }
      }
    }
  }

  // ---- manto aberto na frente ----
  if (ap.manto) {
    const longaM = (ap.manto.comprimento ?? 'longa') === 'longa';
    const corM = new THREE.Color(ap.manto.cor);
    const corM2 = new THREE.Color(ap.manto.cor2 ?? ap.manto.cor).multiplyScalar(ap.manto.cor2 ? 1 : 0.85);
    const yBarraM = longaM ? yTornozelo + 0.1 : yJoelho - 0.02;
    const aneisM = aneisRoupa(base, yPescoco - 0.03, yBarraM, segs, 0.04, longaM ? 0.08 : 0.05, yQuadril, true);
    tubo(M, aneisM, segs, (r, s) => {
      const a = (s / segs) * Math.PI * 2 - Math.PI;
      if (Math.abs(Math.abs(a) - 0.42) < 0.09) return corM2;
      if (aneisM[r].y < yBarraM + 0.04) return corM2;
      return corM;
    }, (x, y, z) => pesosTronco(x, y, z), 0.36);
  }

  // ---- cabeça ----
  gerarCabeca(M, base, ap, centroCab, raioCab, cabecaIdx);

  const g = M.geometria(false);
  // normais: corpo mantém as originais; roupas e cabeça recalculadas
  const tmp = M.geometria(true);
  const n = g.attributes.normal as THREE.BufferAttribute;
  const nt = tmp.attributes.normal as THREE.BufferAttribute;
  for (let i = corpoFim; i < n.count; i++) n.setXYZ(i, nt.getX(i), nt.getY(i), nt.getZ(i));
  // as partes rígidas da cabeça já trazem normais próprias (não recalcular)
  for (let i = M.cabecaInicio ?? n.count; i < n.count; i++) {
    n.setXYZ(i, M.nor[i * 3], M.nor[i * 3 + 1], M.nor[i * 3 + 2]);
  }
  tmp.dispose();
  g.computeBoundingSphere();
  return g;
}

/** Anéis de uma peça que veste o tronco (túnica ou manto), acompanhando o corpo. */
function aneisRoupa(base: CorpoBase, yTopo: number, yBarra: number, segs: number, folga: number, abrir: number, yQuadril: number, manto = false) {
  const passo = 0.03;
  const ys: number[] = [];
  for (let y = yTopo; y > yBarra; y -= passo) ys.push(y);
  ys.push(yBarra);
  const maxAcum = new Array(segs).fill(0);
  const raios: number[][] = [];
  const yPeito = base.junta('spine_03').y;
  const ombroX = base.junta('upperarm_l').x;
  for (const y of ys) {
    const linha: number[] = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2 - Math.PI;
      let r = base.raioCorpo(y, a, 0.045);
      if (y < yQuadril) r = Math.max(r, maxAcum[s] * (manto ? 1 : 0.98));
      else maxAcum[s] = Math.max(maxAcum[s], y < yPeito ? r : 0);
      if (y >= yQuadril) maxAcum[s] = Math.max(maxAcum[s], r);
      const queda = y < yQuadril ? smoothstep(yQuadril, yBarra, y) : 0;
      r = r + folga + queda * abrir;
      // forma mínima elíptica (evita cintura fina demais)
      const ex = 0.15 + (y < yQuadril ? 0.03 : 0);
      const ez = 0.11;
      const minimo = (ex * ez) / Math.sqrt((ez * Math.sin(a)) ** 2 + (ex * Math.cos(a)) ** 2);
      r = Math.max(r, minimo + folga * 0.5);
      // ombros: a largura no alto do tronco não passa da junta do ombro (as mangas cobrem o resto)
      if (y > yPeito - 0.06) {
        const lim = (ombroX * 0.86 + folga) / Math.max(0.25, Math.abs(Math.sin(a)));
        r = Math.min(r, lim);
      }
      linha.push(r);
    }
    raios.push(linha);
  }
  suavizarRaios(raios, 3);
  return ys.map((y, i) => ({ y, raios: raios[i], centro: [0, base.junta('spine_02').z * 0.5] as [number, number] }));
}

/** Pesos para roupas do tronco: coluna por altura, pernas abaixo do quadril, clavículas nos ombros. */
function criarPesosTronco(base: CorpoBase) {
  const I = (n: string) => base.indiceOsso(n);
  const coluna = ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01'].map((n) => ({ i: I(n), y: base.junta(n).y }));
  const yQ = base.junta('pelvis').y;
  const yJ = base.junta('calf_l').y;
  const ombroX = base.junta('upperarm_l').x;
  const yOmbro = base.junta('upperarm_l').y;
  return (x: number, y: number, _z: number): Peso => {
    if (y >= yQ) {
      let k = 0;
      while (k < coluna.length - 2 && y > coluna[k + 1].y) k++;
      const a = coluna[k];
      const b = coluna[k + 1];
      const t = clamp((y - a.y) / (b.y - a.y), 0, 1);
      const p: Peso = [[a.i, 1 - t], [b.i, t]];
      const alto = smoothstep(yOmbro - 0.16, yOmbro, y);
      const wc = smoothstep(ombroX * 0.35, ombroX * 0.9, Math.abs(x)) * alto * 0.45;
      const wb = smoothstep(ombroX * 0.55, ombroX * 0.95, Math.abs(x)) * alto * 0.4;
      if (wc + wb > 0) {
        const clav = x > 0 ? I('clavicle_l') : I('clavicle_r');
        const braco = x > 0 ? I('upperarm_l') : I('upperarm_r');
        p[0][1] *= 1 - wc - wb;
        p[1][1] *= 1 - wc - wb;
        p.push([clav, wc], [braco, wb]);
      }
      return p;
    }
    // saia: pélvis + coxas/pernas pelo lado
    const a = smoothstep(yQ, yJ, y) * 0.8;
    const lado = clamp(x / 0.16, -1, 1);
    const wE = Math.pow((1 + lado) / 2, 1.6);
    const wD = Math.pow((1 - lado) / 2, 1.6);
    const soma = wE + wD || 1;
    const pe = (a * wE) / soma;
    const pd = (a * wD) / soma;
    const canela = smoothstep(yJ, yJ - 0.3, y) * 0.45;
    return [
      [I('pelvis'), 1 - a],
      [I('thigh_l'), pe * (1 - canela)], [I('calf_l'), pe * canela],
      [I('thigh_r'), pd * (1 - canela)], [I('calf_r'), pd * canela],
    ];
  };
}

/** Rosto, cabelo, barba e cobertura de cabeça, presos ao osso da cabeça. */
function gerarCabeca(M: Malhador, base: CorpoBase, ap: Aparencia, c: THREE.Vector3, R: number, osso: number) {
  M.cabecaInicio = M.pos.length / 3;
  const pele = new THREE.Color(ap.pele);
  const cabelo = new THREE.Color(ap.cabelo.cor);
  const mat = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().compose(new THREE.Vector3(c.x + x * R, c.y + y * R, c.z + z * R), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx * R, sy * R, sz * R));

  // crânio e rosto (levemente achatado nas laterais, queixo suave)
  const cranio = new THREE.SphereGeometry(1, 24, 18);
  const p = cranio.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    x *= 0.92;
    if (y < 0) { z *= 1 - 0.12 * -y; x *= 1 - 0.18 * -y; y *= 1.08; }
    p.setXYZ(i, x, y, z);
  }
  cranio.computeVertexNormals();
  const bochecha = pele.clone().lerp(new THREE.Color('#e88a7a'), 0.25);
  M.rigido(cranio, mat(0, 0, 0), (x, y, z) => {
    const lx = (x - c.x) / R;
    const ly = (y - c.y) / R;
    const lz = (z - c.z) / R;
    if (lz > 0.55 && ly < -0.05 && ly > -0.4 && Math.abs(lx) > 0.32 && Math.abs(lx) < 0.7) return bochecha;
    return pele;
  }, osso);

  // nariz e orelhas
  M.rigido(new THREE.SphereGeometry(1, 10, 8), mat(0, -0.12, 0.97, 0.13, 0.15, 0.13), pele.clone().multiplyScalar(0.96), osso);
  for (const s of [1, -1]) M.rigido(new THREE.SphereGeometry(1, 10, 8), mat(0.9 * s, -0.05, 0.02, 0.12, 0.22, 0.16), pele.clone().multiplyScalar(0.95), osso);

  // olhos grandes e amigáveis, com brilho
  const olho = new THREE.Color('#2b1d16');
  const brilho = new THREE.Color('#ffffff');
  const sobr = new THREE.Color(ap.barba?.cor ?? ap.cabelo.cor).multiplyScalar(0.9);
  for (const s of [1, -1]) {
    M.rigido(new THREE.SphereGeometry(1, 12, 10), mat(0.36 * s, 0.04, 0.88, 0.13, 0.19, 0.09), olho, osso);
    M.rigido(new THREE.SphereGeometry(1, 6, 5), mat(0.33 * s + 0.04, 0.11, 0.96, 0.045, 0.045, 0.03), brilho, osso);
    M.rigido(new THREE.CapsuleGeometry(1, 2.2, 3, 6).rotateZ(Math.PI / 2), mat(0.37 * s, 0.3, 0.9, 0.035, 0.05, 0.035, 0, 0, -0.12 * s), sobr, osso);
  }
  // boca discreta
  M.rigido(new THREE.CapsuleGeometry(1, 2, 2, 6).rotateZ(Math.PI / 2), mat(0, -0.45, 0.87, 0.028, 0.05, 0.03), new THREE.Color('#8a463e'), osso);

  // cabelo
  const est = ap.cabelo.estilo;
  if (est !== 'calvo') {
    const tampa = new THREE.SphereGeometry(1.06, 22, 14, 0, Math.PI * 2, 0, Math.PI * (est === 'longo' || est === 'preso' ? 0.62 : 0.55));
    M.rigido(tampa, mat(0, 0.04, -0.05, 1, 1, 1.02, -0.38, 0, 0), cabelo, osso);
    if (est === 'cacheado') {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        M.rigido(new THREE.IcosahedronGeometry(1, 0), mat(Math.sin(a) * 0.8, 0.45 + Math.cos(a * 3) * 0.08, Math.cos(a) * 0.75 - 0.1, 0.32, 0.3, 0.32), cabelo, osso);
      }
    }
    if (est === 'longo') {
      const caimento = new THREE.CylinderGeometry(0.95, 1.05, 1.2, 18, 1, true, Math.PI * 0.55, Math.PI * 0.9);
      M.rigido(caimento, mat(0, -0.55, -0.12, 1, 1, 0.9), cabelo, osso);
    }
    if (est === 'preso') M.rigido(new THREE.SphereGeometry(1, 10, 8), mat(0, 0.15, -1.0, 0.35, 0.35, 0.35), cabelo, osso);
  } else {
    // calvo: coroa de cabelo nas laterais e atrás
    const anel = new THREE.TorusGeometry(0.88, 0.17, 6, 20, Math.PI * 1.3);
    M.rigido(anel, mat(0, 0.02, -0.08, 1, 1, 1, Math.PI / 2, 0, -Math.PI * 0.15 + Math.PI), cabelo, osso);
  }

  // barba: cobre queixo e mandíbula, deixando boca e bochechas livres
  if (ap.barba && ap.barba.comprimento > 0.02) {
    const corB = new THREE.Color(ap.barba.cor);
    // barbas escuras levemente clareadas para não virarem uma mancha preta
    const hsl = { h: 0, s: 0, l: 0 };
    corB.getHSL(hsl);
    if (hsl.l < 0.22) corB.setHSL(hsl.h, Math.min(0.5, hsl.s + 0.1), 0.2);
    const L = ap.barba.comprimento / R;
    const barba = new THREE.SphereGeometry(1.02, 20, 12, Math.PI * 0.06, Math.PI * 0.88, Math.PI * 0.64, Math.PI * 0.36);
    const bp = barba.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const y = bp.getY(i);
      const desce = clamp((-0.66 - y) / 0.34, 0, 1);
      bp.setY(i, y - desce * L);
      bp.setX(i, bp.getX(i) * (1 - desce * 0.5));
      bp.setZ(i, bp.getZ(i) * (1 - desce * 0.3) + desce * 0.12);
    }
    barba.computeVertexNormals();
    M.rigido(barba, mat(0, 0, 0.02), corB, osso);
    // bigode acima da boca
    if (ap.barba.comprimento > 0.08) M.rigido(new THREE.TorusGeometry(1, 0.38, 6, 12, Math.PI), mat(0, -0.31, 0.93, 0.19, 0.09, 0.1, 0.2, 0, Math.PI), corB, osso);
    // costeletas ligando ao cabelo
    for (const s of [1, -1]) M.rigido(new THREE.SphereGeometry(1, 8, 6), mat(0.86 * s, -0.28, 0.18, 0.16, 0.32, 0.26), corB, osso);
  }

  // cobertura de cabeça
  const cob = ap.cabeca;
  if (cob && cob.tipo !== 'nenhuma') {
    const corC = new THREE.Color(cob.cor);
    const corC2 = new THREE.Color(cob.cor2 ?? cob.cor).multiplyScalar(cob.cor2 ? 1 : 0.7);
    if (cob.tipo === 'lenco' || cob.tipo === 'veu') {
      const capuz = new THREE.SphereGeometry(1.13, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
      M.rigido(capuz, mat(0, 0.03, -0.04, 1.03, 1, 1.05, -0.5, 0, 0), corC, osso);
      // caimento atrás e nas laterais até os ombros
      const comp = cob.tipo === 'veu' ? 2.6 : 2.1;
      const caida = new THREE.CylinderGeometry(1.1, 1.38, comp, 22, 4, true, Math.PI * 0.42, Math.PI * 1.16);
      const cp = caida.attributes.position;
      for (let i = 0; i < cp.count; i++) {
        // ondulação suave do tecido
        const a = Math.atan2(cp.getX(i), cp.getZ(i));
        const y = cp.getY(i);
        const k = 1 + Math.sin(a * 7) * 0.035 * (0.5 - y / comp);
        cp.setX(i, cp.getX(i) * k);
        cp.setZ(i, cp.getZ(i) * k);
      }
      caida.computeVertexNormals();
      M.rigido(caida, mat(0, -comp / 2 + 0.1, -0.12, 1.02, 1, 0.98), corC, osso);
      if (cob.tipo === 'lenco') {
        // agal (cordão)
        const agal = new THREE.TorusGeometry(1.1, 0.07, 6, 28);
        M.rigido(agal, mat(0, 0.42, -0.12, 1.02, 1, 1.04, Math.PI / 2 - 0.5, 0, 0), corC2, osso);
      } else {
        M.rigido(new THREE.TorusGeometry(1.12, 0.05, 5, 28), mat(0, 0.42, -0.1, 1.02, 1, 1.04, Math.PI / 2 - 0.5, 0, 0), corC2, osso);
      }
    } else if (cob.tipo === 'turbante') {
      for (let k = 0; k < 3; k++) {
        const t = new THREE.TorusGeometry(0.95 - k * 0.18, 0.2 - k * 0.03, 8, 24);
        M.rigido(t, mat(0, 0.45 + k * 0.17, -0.05, 1, 1, 1, Math.PI / 2 - 0.25, 0, k * 0.4), k === 1 ? corC2 : corC, osso);
      }
      M.rigido(new THREE.SphereGeometry(0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0, 0.55, -0.08), corC, osso);
    } else if (cob.tipo === 'faixa') {
      M.rigido(new THREE.TorusGeometry(1.04, 0.09, 6, 28), mat(0, 0.38, -0.02, 1, 1, 1.02, Math.PI / 2 - 0.35, 0, 0), corC, osso);
    }
  }
}
