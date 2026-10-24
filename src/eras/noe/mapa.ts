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
  gruta: [-178, -112] as Ponto2,
  plato: [-30, -168] as Ponto2,
  platoAltura: 38,
};

export const RIO: Ponto2[] = [
  [178, -240], [158, -165], [140, -95], [146, -28], [148, 30], [128, 95], [108, 160], [116, 240],
];

export const CAMINHOS: Ponto2[][] = [
  [[40, 72], [20, 40], [0, 22]], // casa → estaleiro
  [[-60, 10], [-100, 18], [-130, 22]], // estaleiro → bosque
  [[48, 80], [75, 100], [96, 116]], // casa → monte de oração
  [[40, 18], [90, -6], [125, -24], [146, -28], [158, -50], [172, -92]], // estaleiro → vau → cidade
  [[40, 72], [44, 120], [30, 175]], // casa → prados do sul
  [[-30, -40], [-35, -90], [-32, -130]], // estaleiro → trilha do monte
];

function rioPerfil(x: number, z: number) {
  const { d, u } = distPolilinha(x, z, RIO);
  const largura = 7 + Math.sin(u * 9) * 1.5;
  return { d, largura };
}

export const MAPA_NOE: DefMapa = {
  nome: 'vale-de-noe',
  tamanho: NOE.tamanho,
  semente: 6014,
  nivelAgua: NOE.nivelAgua,
  pontos: {
    casa: NOE.casa,
    portaCasa: [40, 76],
    fogueiraCasa: [32, 82],
    curral: [58, 86],
    pomar: [18, 92],
    monteOracao: NOE.monteOracao,
    estaleiro: NOE.estaleiro,
    portaArca: [5, 20],
    pilhaTroncos: [30, 28],
    guincho: [-22, 26],
    andaime: [-14, 15],
    caldeirao: [-48, 24],
    bosque: NOE.bosque,
    bordaBosque: [-120, 22],
    vau: NOE.vau,
    cidade: NOE.cidade,
    praca: [182, -108],
    gruta: NOE.gruta,
    plato: NOE.plato,
    trilhaMonte: [-32, -120],
    prado: [30, 175],
    celeiro: [52, 60],
  },

  altura(x, z, r: Ruido) {
    // vale suave com colinas
    let h = 2.4 + r.fbm(x * 0.0055, z * 0.0055, 4) * 5 + r.fbm(x * 0.025 + 7, z * 0.025, 3) * 1.1;
    // montanhas nas bordas fecham a região
    const b = fatorBorda(x, z, NOE.tamanho / 2, 75);
    h += Math.pow(b, 1.6) * (38 + r.cristas(x * 0.012, z * 0.012, 4) * 40);
    // monte do norte com platô para a arca
    const [px, pz] = NOE.plato;
    const dxp = Math.max(0, Math.abs(x - px) - 70);
    const dzp = Math.max(0, Math.abs(z - pz) - 14);
    const dp = Math.hypot(dxp, dzp);
    const monte = NOE.platoAltura * (1 - smoothstep(0, 70, dp)) + r.fbm(x * 0.03, z * 0.03, 2) * 2 * smoothstep(5, 30, dp);
    h = Math.max(h, monte);
    if (dp < 3) h = NOE.platoAltura;
    // monte de oração
    const [mx, mz] = NOE.monteOracao;
    const dm = Math.hypot(x - mx, z - mz);
    h += 9 * (1 - smoothstep(4, 34, dm));
    // gruta: colinas a oeste
    const [gx, gz] = NOE.gruta;
    h += 16 * (1 - smoothstep(10, 50, Math.hypot(x - gx, z - gz)));
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
    // montanha: grama alta → pedra
    out.lerp(_c.set('#9a9378'), smoothstep(16, 40, h) * 0.75);
    out.lerp(_c.set('#8f8678'), smoothstep(0.18, 0.4, inc));
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
    out.lerp(_c.set('#b9996c'), (1 - smoothstep(0, 10, Math.hypot(dxe, dze))) * 0.8);
    const dcasa = Math.hypot(x - NOE.casa[0], z - NOE.casa[1]);
    out.lerp(_c.set('#b49a6e'), (1 - smoothstep(9, 16, dcasa)) * 0.6);
    // caminhos
    for (const c of CAMINHOS) {
      const dd = distPolilinha(x, z, c).d;
      if (dd < 3) out.lerp(_c.set('#b89a6a'), (1 - smoothstep(1.2, 3, dd + n2 * 0.6)) * 0.85);
    }
    // platô do monte
    const dp = Math.hypot(Math.max(0, Math.abs(x - NOE.plato[0]) - 70), Math.max(0, Math.abs(z - NOE.plato[1]) - 14));
    if (dp < 8 && h > NOE.platoAltura - 2) out.lerp(_c.set('#8f9a5c'), 0.5);
  },

  densidadeGrama(x, z) {
    // calculada pela cor/uso do solo
    const [ex, ez] = NOE.estaleiro;
    if (Math.abs(x - ex) < 92 && Math.abs(z - ez) < 28) return 0.05;
    if (Math.hypot(x - NOE.cidade[0], z - NOE.cidade[1]) < 48) return 0.08;
    if (Math.hypot(x - NOE.casa[0], z - NOE.casa[1]) < 13) return 0.15;
    for (const c of CAMINHOS) if (distPolilinha(x, z, c).d < 2.2) return 0.05;
    const { d, largura } = rioPerfil(x, z);
    if (d < largura + 3) return 0.1;
    return 0.85;
  },

  corGrama(x, z, out) {
    out.set('#8cb04e');
    const w = Math.sin(x * 0.05) * Math.cos(z * 0.04);
    if (w > 0.3) out.lerp(_c.set('#b2b45c'), (w - 0.3) * 0.8);
    if (x < -105) out.lerp(_c.set('#679a44'), 0.6);
  },
};

const _c = new THREE.Color();
