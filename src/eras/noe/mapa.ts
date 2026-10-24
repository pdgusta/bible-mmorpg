import * as THREE from 'three';
import type { DefMapa } from '../../mundo/Mundo';
import { achatar, distPolilinha, fatorBorda, type Ponto2 } from '../../mundo/Relevo';
import { smoothstep, clamp } from '../../core/util';
import type { Ruido } from '../../core/aleatorio';

/**
 * "Vale de Noé" (460 × 460 m). Norte = -z, leste = +x.
 * - Casa de Noé e pomar ao centro-sul; monte de oração a sudeste.
 * - Estaleiro da arca no centro (arca de 135 m alinhada no eixo x).
 * - Bosque de gofer a oeste; rio a leste com um vau; a cidade além do rio, a nordeste.
 * - Monte ao norte, com um platô onde a arca repousa depois do dilúvio (Gn 8:4).
 * - Gruta numa colina a noroeste.
 */
export const NOE = {
  tamanho: 460,
  nivelAgua: 0.4,
  casa: [40, 72] as Ponto2,
  monteOracao: [100, 118] as Ponto2,
  estaleiro: [-15, 5] as Ponto2,
  estaleiroAltura: 2.6,
  cidade: [178, -112] as Ponto2,
  vau: [146, -28] as Ponto2,
  bosque: [-165, 20] as Ponto2,
  /** Centro da colina da gruta. */
  colinaGruta: [-178, -112] as Ponto2,
  /** Centro da câmara da gruta (escavada na encosta). */
  gruta: [-157.9, -89.7] as Ponto2,
  /** Direção (unitária) da câmara para a boca da gruta. */
  grutaDir: [0.669, 0.743] as Ponto2,
  plato: [-30, -172] as Ponto2,
  /** Meia-extensão do platô plano (x, z). */
  platoMeio: [72, 24] as Ponto2,
  platoAltura: 38,
  /** Onde a arca repousa depois do dilúvio (origem da arca = centro da quilha). */
  arcaRepouso: { x: -30, y: 38, z: -181, yaw: 0 },
};

export const RIO: Ponto2[] = [
  [178, -240], [158, -165], [140, -95], [146, -28], [148, 30], [128, 95], [108, 160], [116, 240],
];

/** Trilha que sobe do estaleiro ao platô (encosta sul do monte, suave). */
export const TRILHA_MONTE: Ponto2[] = [[-30, -40], [-38, -90], [-46, -128], [-50, -150]];

export const CAMINHOS: Ponto2[][] = [
  [[40, 72], [20, 40], [0, 22]], // casa → estaleiro
  [[-60, 10], [-100, 18], [-130, 22]], // estaleiro → bosque
  [[48, 80], [75, 100], [96, 116]], // casa → monte de oração
  [[40, 18], [90, -6], [125, -24], [146, -28], [158, -50], [172, -92]], // estaleiro → vau → cidade
  [[40, 72], [44, 120], [30, 175]], // casa → prados do sul
  TRILHA_MONTE, // estaleiro → platô
  [[-130, 22], [-140, -40], [-151, -81]], // bosque → gruta
];

/** Casas da cidade (local à praça): x, z, yaw, largura, profundidade, altura. */
export const CASAS_CIDADE: [number, number, number, number, number, number][] = [
  [-24, -16, 0.4, 9, 7, 3.6], [-8, -27, 0.1, 7, 6, 3.2], [9, -28, -0.15, 8, 6, 4.4], [25, -18, -0.5, 7, 7, 3.4],
  [30, 0, -1.5, 9, 6, 3.8], [26, 18, -2.3, 7, 6, 3.2], [10, 28, 3.0, 8, 7, 4.0], [-9, 28, 3.2, 7, 6, 3.4],
  [-25, 18, 2.4, 8, 6, 3.6], [-31, 1, 1.5, 7, 7, 3.2], [-37, -26, 0.8, 6, 5, 3.0], [38, -28, -0.8, 6, 5, 3.0],
  [40, 26, -2.6, 6, 6, 3.4], [-40, 24, 2.2, 6, 5, 3.0],
];
/** Torre de tijolos da cidade (local à praça). */
export const TORRE_CIDADE: Ponto2 = [2, -44];

function rioPerfil(x: number, z: number) {
  const { d, u } = distPolilinha(x, z, RIO);
  const largura = 7 + Math.sin(u * 9) * 1.5;
  return { d, largura };
}

/** Distância (com borda arredondada) ao retângulo plano do platô. Ao sul a encosta é mais longa e suave. */
function distPlato(x: number, z: number) {
  const [px, pz] = NOE.plato;
  const dxp = Math.max(0, Math.abs(x - px) - NOE.platoMeio[0]);
  let dzp = Math.max(0, Math.abs(z - pz) - NOE.platoMeio[1]);
  if (z > pz) dzp *= 70 / 100;
  return Math.hypot(dxp, dzp);
}

function rodar(x: number, z: number, yaw: number): Ponto2 {
  // mesma convenção do three (rotação em Y): x' = x cos + z sen, z' = -x sen + z cos
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

/** Pontos nomeados da cidade (praça, mercado, torre, portas das casas). */
function pontosCidade(): Record<string, Ponto2> {
  const [cx, cz] = NOE.cidade;
  const out: Record<string, Ponto2> = {};
  CASAS_CIDADE.forEach(([x, z, yaw, , d], i) => {
    const [ox, oz] = rodar(0.2, d / 2 + 1.0, yaw);
    out[`casaCidade${i + 1}`] = [cx + x + ox, cz + z + oz];
  });
  const [tx, tz] = TORRE_CIDADE;
  out.torre = [cx + tx, cz + tz + 9];
  out.pregarTorre = out.torre;
  // bancas do mercado num anel de 11 m; o pregador fica entre a 1ª e a 2ª banca, do lado de dentro
  const a = (0.5 / 5) * Math.PI * 2;
  out.mercado = [cx + Math.cos(a) * 7.5, cz + Math.sin(a) * 7.5];
  out.pregarMercado = out.mercado;
  out.praca = [cx - 3.5, cz + 4.5];
  out.pregarPraca = out.praca;
  out.pocoCidade = [cx + 2.2, cz];
  out.entradaCidade = [172, -92];
  return out;
}

function pontosGruta(): Record<string, Ponto2> {
  const [gx, gz] = NOE.gruta;
  const [dx, dz] = NOE.grutaDir;
  const em = (a: number, lado = 0): Ponto2 => [gx + dx * a - dz * lado, gz + dz * a + dx * lado];
  return {
    gruta: em(11.5),
    entradaGruta: em(5.2),
    fundoGruta: em(-3.6),
    segredoEnoque: em(-1.2, 3.6),
  };
}

/** Pontos que dependem da arca (atualizados por MundoNoe quando a arca se move). */
export const PONTOS_ARCA_INICIAIS: Record<string, Ponto2> = {
  portaArca: [5, 25],
  entregaArca: [5, 25],
  saidaArca: [5, 25],
  bomba: [-3, 12],
  janela: [-9, 14],
};

const PONTOS: Record<string, Ponto2> = {
  // casa de Noé e arredores
  casa: NOE.casa,
  portaCasa: [40.9, 77.3],
  inicio: [35, 86],
  fogueiraCasa: [33.9, 84.8],
  curral: [57.6, 81.5],
  pomar: [18, 92],
  trigal: [66, 106],
  poco: [24.5, 76],
  celeiro: [50.6, 68.4],
  saco1: [48.4, 69.6], saco2: [49.6, 70.2], saco3: [51.4, 70.2], saco4: [52.6, 69.6],
  segredoLameque: [23.4, 66.4],
  prado: [30, 175],
  centroVale: [10, 30],
  vistaVale: [70, 150],
  // monte de oração
  monteOracao: NOE.monteOracao,
  orarMonte: [100, 115.6],
  // estaleiro (os pontos da viga, do guincho e do andaime são recalculados a partir da arca)
  estaleiro: NOE.estaleiro,
  quilha: [-15, 9.6],
  pilhaTroncos: [30, 31.5],
  entregaTroncos: [30, 31.5],
  cavalete: [15, 31.6],
  caldeirao: [-48, 26],
  betumarCasco1: [-52, 17.8],
  betumarCasco2: [-30, 17.8],
  betumarCasco3: [30, 17.8],
  filaAnimais: [5, 34],
  // bosque de gofer
  bosque: NOE.bosque,
  bordaBosque: [-120, 22],
  corteLenha: [-126, 31],
  pilhaBosque: [-119.5, 27.5],
  arvoreGofer1: [-129, 35.5],
  arvoreGofer2: [-131.5, 27],
  arvoreGofer3: [-127, 42],
  // frutas no alto (pé da escada / plataforma na copa)
  arvoreFruta1: [7.5, 117.6],
  fruta1: [7.5, 115.4],
  arvoreFruta2: [-10.4, 99.6],
  fruta2: [-10.4, 97.4],
  // rio e vau
  vau: NOE.vau,
  vauOeste: [133, -26],
  vauLeste: [159, -30],
  margemRio: [134, 30],
  // chegada dos animais (A4)
  chegadaAnimais1: [-196, 60],
  chegadaAnimais2: [36, 196],
  chegadaAnimais3: [-120, -60],
  chegadaAnimais4: [92, 168],
  // monte do norte e platô
  plato: [-30, -158],
  altarPlato: [-22, -156],
  pedraAltar1: [-40, -152], pedraAltar2: [-4, -151], pedraAltar3: [12, -159],
  pedraAltar4: [-56, -158], pedraAltar5: [-31, -150], pedraAltar6: [24, -153],
  descidaPlato: [-50, -150],
  trilhaMonte: [-40, -100],
  segredoEstacoes: [64, 104],
  ...PONTOS_ARCA_INICIAIS,
  ...pontosCidade(),
  ...pontosGruta(),
};

let alturaGruta: number | null = null;

function alturaBase(x: number, z: number, r: Ruido) {
  // vale suave com colinas
  let h = 2.4 + r.fbm(x * 0.0055, z * 0.0055, 4) * 5 + r.fbm(x * 0.025 + 7, z * 0.025, 3) * 1.1;
  // montanhas nas bordas fecham a região: cristas largas e arredondadas (sem agulhas)
  const b = fatorBorda(x, z, NOE.tamanho / 2, 80);
  h += Math.pow(b, 1.5) * (30 + r.fbm(x * 0.006 + 3, z * 0.006, 3) * 12 + r.cristas(x * 0.0085, z * 0.0085, 2) * 34);
  // monte do norte com platô para a arca
  const dp = distPlato(x, z);
  const monte = NOE.platoAltura * (1 - smoothstep(0, 70, dp)) + r.fbm(x * 0.03, z * 0.03, 2) * 2 * smoothstep(5, 30, dp);
  h = Math.max(h, monte);
  if (dp < 3) h = NOE.platoAltura;
  // monte de oração
  const [mx, mz] = NOE.monteOracao;
  const dm = Math.hypot(x - mx, z - mz);
  h += 9 * (1 - smoothstep(4, 34, dm));
  // colina da gruta
  const [gx, gz] = NOE.colinaGruta;
  h += 16 * (1 - smoothstep(10, 50, Math.hypot(x - gx, z - gz)));
  return h;
}

export const MAPA_NOE: DefMapa = {
  nome: 'vale-de-noe',
  tamanho: NOE.tamanho,
  semente: 6014,
  nivelAgua: NOE.nivelAgua,
  pontos: PONTOS,
  gramaDoChao: 0.7,

  altura(x, z, r: Ruido) {
    let h = alturaBase(x, z, r);
    const [mx, mz] = NOE.monteOracao;
    // gruta: um nicho plano escavado na encosta, onde fica a câmara de pedra
    const [gcx, gcz] = NOE.gruta;
    const [gdx, gdz] = NOE.grutaDir;
    if (alturaGruta === null) alturaGruta = alturaBase(gcx + gdx * 13, gcz + gdz * 13, r);
    h = achatar(h, x, z, gcx, gcz, 8.5, 12.5, alturaGruta);
    h = achatar(h, x, z, gcx + gdx * 7, gcz + gdz * 7, 4, 8, alturaGruta);
    // áreas planas
    h = achatar(h, x, z, NOE.casa[0], NOE.casa[1], 20, 34, 3);
    h = achatar(h, x, z, NOE.cidade[0], NOE.cidade[1], 40, 60, 4.2);
    h = achatar(h, x, z, mx, mz, 4, 7, 2.4 + 9);
    // estaleiro: retângulo plano 180 × 56
    const [ex, ez] = NOE.estaleiro;
    const dxe = Math.max(0, Math.abs(x - ex) - 88);
    const dze = Math.max(0, Math.abs(z - ez) - 26);
    const de = Math.hypot(dxe, dze);
    const te = 1 - smoothstep(0, 16, de);
    h += (NOE.estaleiroAltura - h) * te;
    // caminhos levemente aplainados
    for (const c of CAMINHOS) {
      const { d } = distPolilinha(x, z, c);
      if (d < 4) h -= (1 - d / 4) * 0.25;
    }
    // rio
    const { d, largura } = rioPerfil(x, z);
    const vau = Math.hypot(x - NOE.vau[0], z - NOE.vau[1]) < 14;
    const prof = vau ? 0.75 : 2.6;
    if (d < largura + 10) {
      const t = clamp(d / largura, 0, 1);
      const fundo = NOE.nivelAgua - prof * (1 - t * t);
      const margem = smoothstep(largura, largura + 10, d);
      h = Math.min(h, fundo + (h - fundo) * margem + (1 - margem) * Math.max(0, (t - 0.85) * 3));
    }
    return h;
  },

  cor(x, z, h, inc, out, r) {
    const n = r.fbm(x * 0.03, z * 0.03, 3);
    const n2 = r.ruido(x * 0.11, z * 0.11);
    out.set('#86a84c');
    // prados mais claros ao sul, mais secos em manchas
    if (n > 0.25) out.lerp(_c.set('#a8ad58'), smoothstep(0.25, 0.6, n) * 0.6);
    if (n < -0.3) out.lerp(_c.set('#6f9a42'), smoothstep(-0.3, -0.6, n) * 0.7);
    // bosque: verde mais fechado
    const bosque = smoothstep(-95, -125, x);
    out.lerp(_c.set('#5d8a3e'), bosque * 0.7);
    // montanha: campo alto (verde-oliva) → pedra clara no alto
    out.lerp(_c.set('#8e9a5e'), smoothstep(12, 26, h) * 0.6);
    out.lerp(_c.set('#a39a84'), smoothstep(34, 60, h) * 0.75);
    out.lerp(_c.set('#8f8678'), smoothstep(0.2, 0.42, inc) * 0.85);
    // margem do rio: areia
    const { d, largura } = rioPerfil(x, z);
    if (d < largura + 6) out.lerp(_c.set('#d6c08e'), 1 - smoothstep(largura - 1, largura + 6, d));
    if (h < NOE.nivelAgua - 0.2) out.lerp(_c.set('#a89870'), 0.8);
    // cidade e estaleiro: terra batida
    const dc = Math.hypot(x - NOE.cidade[0], z - NOE.cidade[1]);
    out.lerp(_c.set('#c4a77c'), (1 - smoothstep(36, 50, dc)) * 0.85);
    const [ex, ez] = NOE.estaleiro;
    const dxe = Math.max(0, Math.abs(x - ex) - 82);
    const dze = Math.max(0, Math.abs(z - ez) - 20);
    out.lerp(_c.set('#b9996c'), (1 - smoothstep(0, 10, Math.hypot(dxe, dze) + n2 * 2)) * 0.8);
    // terreiro da casa
    const dcasa = Math.hypot(x - NOE.casa[0], z - NOE.casa[1]);
    out.lerp(_c.set('#b89c6c'), (1 - smoothstep(8, 15, dcasa + n2 * 1.5)) * 0.85);
    // caminhos
    for (const c of CAMINHOS) {
      const dd = distPolilinha(x, z, c).d;
      if (dd < 3) out.lerp(_c.set('#b89a6a'), (1 - smoothstep(1.2, 3, dd + n2 * 0.6)) * 0.85);
    }
    // platô do monte: capim ralo
    if (distPlato(x, z) < 8 && h > NOE.platoAltura - 2) out.lerp(_c.set('#9aa062'), 0.45);
    // chão da gruta: terra escura
    const dg = Math.hypot(x - NOE.gruta[0], z - NOE.gruta[1]);
    if (dg < 9) out.lerp(_c.set('#6a5c4a'), 1 - smoothstep(5.5, 9, dg));
  },

  densidadeGrama(x, z) {
    const [ex, ez] = NOE.estaleiro;
    let f = 0.85;
    const dxe = Math.max(0, Math.abs(x - ex) - 86);
    const dze = Math.max(0, Math.abs(z - ez) - 22);
    f = Math.min(f, 0.05 + 0.8 * smoothstep(0, 8, Math.hypot(dxe, dze)));
    f = Math.min(f, 0.08 + 0.77 * smoothstep(44, 54, Math.hypot(x - NOE.cidade[0], z - NOE.cidade[1])));
    f = Math.min(f, 0.06 + 0.79 * smoothstep(9, 17, Math.hypot(x - NOE.casa[0], z - NOE.casa[1])));
    for (const c of CAMINHOS) f = Math.min(f, 0.04 + 0.81 * smoothstep(1.2, 3.2, distPolilinha(x, z, c).d));
    const { d, largura } = rioPerfil(x, z);
    f = Math.min(f, 0.1 + 0.75 * smoothstep(largura + 1, largura + 5, d));
    if (Math.hypot(x - NOE.gruta[0], z - NOE.gruta[1]) < 9) f = 0;
    return f;
  },

  corGrama(x, z, out) {
    out.set('#8cb04e');
    const w = Math.sin(x * 0.05) * Math.cos(z * 0.04);
    if (w > 0.3) out.lerp(_c.set('#b2b45c'), (w - 0.3) * 0.8);
    if (x < -105) out.lerp(_c.set('#679a44'), 0.6);
  },
};

const _c = new THREE.Color();
