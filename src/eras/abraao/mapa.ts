import * as THREE from 'three';
import type { DefMapa } from '../../mundo/Mundo';
import { achatar, distPolilinha, distSegmento, fatorBorda, type Ponto2, type Relevo } from '../../mundo/Relevo';
import { smoothstep, clamp, lerp } from '../../core/util';
import type { Ruido } from '../../core/aleatorio';

/**
 * "Canaã" (520 × 520 m, geografia condensada). Norte = -z, leste = +x.
 * - Noroeste: Siquém e o carvalho de Moré, entre os montes Ebal e Gerizim (Gn 12:6-7).
 * - Centro-norte: o monte entre Betel (oeste) e Ai (leste), com o acampamento (Gn 12:8; 13:3-4).
 * - Centro: pastos, o poço compartilhado e os dois currais (Gn 13:5-7).
 * - Leste: a escarpa e o mirante sobre a planície do Jordão, verde e regada, com Sodoma ao longe (Gn 13:10).
 * - Norte: a passagem até Dã, um vale fechado onde acampam os reis do oriente (Gn 14:14-15).
 * - Sudoeste: os carvalhais de Manre, em Hebrom (Gn 13:18).
 * - Centro-sul: o vale de Savé e Salém (Gn 14:17-18).
 * - Sul: o monte Moriá, rochoso, com a subida em quatro trechos (Gn 22).
 * O lado de Abrão é seco e dourado; o verde fica no Jordão e em Manre.
 */
export const CANAA = {
  tamanho: 520,
  nivelAgua: 0.6,
  more: [-150, -115] as Ponto2,
  siquem: [-192, -140] as Ponto2,
  ebal: [-200, -184] as Ponto2,
  gerizim: [-206, -86] as Ponto2,
  betel: [-112, -92] as Ponto2,
  ai: [58, -70] as Ponto2,
  acampamentoBetel: [-30, -82] as Ponto2,
  poco: [-25, -5] as Ponto2,
  miranteJordao: [80, -30] as Ponto2,
  sodoma: [140, 82] as Ponto2,
  manre: [-120, 115] as Ponto2,
  acampamentoManre: [-112, 108] as Ponto2,
  ceuEstrelas: [-86, 134] as Ponto2,
  save: [-25, 98] as Ponto2,
  salem: [-6, 80] as Ponto2,
  /** Topo do Moriá (centro do platô). */
  moria: [52, 172] as Ponto2,
  peMoria: [42, 106] as Ponto2,
  /** Vale de Dã (centro do acampamento inimigo) e a entrada pela passagem do sul. */
  valeDa: [45, -185] as Ponto2,
  da: [40, -128] as Ponto2,
  mirantes: {
    miranteNorte: [-62, -152] as Ponto2,
    miranteSul: [-42, 46] as Ponto2,
    miranteLeste: [92, -112] as Ponto2,
    miranteOeste: [-152, -32] as Ponto2,
  },
  segredos: {
    segredo1: [-186, 22] as Ponto2,
    segredo2: [-74, -204] as Ponto2,
    segredo3: [98, 58] as Ponto2,
    segredo4: [-168, 186] as Ponto2,
  },
};

/** O rio Jordão, de norte a sul, na planície do leste. */
export const RIO_JORDAO: Ponto2[] = [
  [172, -265], [166, -205], [176, -150], [163, -95], [171, -40], [158, 15], [168, 70], [157, 125], [165, 180], [158, 265],
];

/** Trilha de Moré, por Betel, até o acampamento no monte (B1: o caminho que se revela em trechos). */
export const TRILHA_BETEL: Ponto2[] = [[-146, -110], [-128, -100], [-100, -94], [-72, -88], [-44, -84]];

/** Trilhas de terra batida entre os lugares. */
export const TRILHAS: Ponto2[][] = [
  [[-122, -250], [-128, -195], [-140, -150], [-148, -122]], // do norte (Harã) até Moré
  TRILHA_BETEL, // Moré → Betel → acampamento
  [[-16, -82], [14, -78], [44, -72]], // acampamento → Ai
  [[-30, -68], [-29, -42], [-25, -12]], // acampamento → poço
  [[-17, -6], [18, -14], [52, -24], [74, -30]], // poço → mirante do Jordão
  [[84, -24], [100, -14], [118, -2], [136, 8]], // descida para a planície
  [[-26, 4], [-32, 40], [-30, 76], [-25, 92]], // poço → Savé
  [[-32, 100], [-62, 104], [-96, 108]], // Savé → Manre
  [[-18, 100], [12, 104], [40, 106]], // Savé → pé do Moriá
  [[-22, -96], [-4, -114], [20, -128], [38, -132]], // acampamento → passagem de Dã
  [[-6, 84], [-14, 92], [-22, 97]], // Salém → Savé
];

/** Nó da trilha do Moriá: posição, altura relativa ao pé do monte e meia-largura do caminho. */
export interface NoRota {
  x: number;
  z: number;
  /** Altura acima do pé do Moriá (m). */
  h: number;
  /** Meia-largura do caminho (m). */
  w: number;
  nome?: string;
}

/**
 * A subida do Moriá, em espiral (norte → leste → sul → oeste), com quatro trechos:
 * 1. degraus de rocha + parede baixa (escalada / corda);
 * 2. passagem estreita sobre um fosso com pedras soltas;
 * 3. o patamar (Gn 22:7-8);
 * 4. a subida final, estreita e exposta, até o platô do topo.
 * O caminho é escavado no relevo; paredes invisíveis seguem as bordas (ver construir.ts).
 */
export const ROTA_MORIA: NoRota[] = [
  { x: 42, z: 106, h: 0, w: 3.5, nome: 'peMoria' },
  { x: 43.5, z: 120, h: 0.6, w: 2.4, nome: 'degrausMoria' },
  { x: 50.4, z: 127, h: 5.5, w: 2.2 },
  { x: 55, z: 127.6, h: 5.5, w: 2.4 },
  { x: 55.4, z: 129.4, h: 5.5, w: 2.2, nome: 'paredeMoria' },
  { x: 55.6, z: 130.8, h: 9, w: 2.2 },
  { x: 59.5, z: 132.3, h: 9, w: 2.4, nome: 'cordaMoria' },
  { x: 72, z: 138, h: 10.8, w: 1.6 },
  { x: 79.5, z: 144.5, h: 11.5, w: 1.6, nome: 'fossoInicio' },
  { x: 86, z: 153, h: 11.5, w: 1.6, nome: 'fossoFim' },
  { x: 88.5, z: 165, h: 15.5, w: 1.8, nome: 'estreitoFim' },
  { x: 84, z: 181, h: 19, w: 4, nome: 'patamarMoria' },
  { x: 72, z: 192.5, h: 23, w: 1.5, nome: 'subidaFinal' },
  { x: 58, z: 196, h: 27, w: 1.4 },
  { x: 44.5, z: 188.5, h: 32, w: 1.4 },
  { x: 39, z: 177.5, h: 37, w: 1.4 },
  { x: 44, z: 170, h: 41.2, w: 1.6 },
  { x: 47.5, z: 170.8, h: 42, w: 1.8 },
];
/** Índices especiais na rota. */
export const MORIA = {
  topo: CANAA.moria,
  /** Altura do topo acima do pé. */
  alturaTopo: 42,
  raioPlato: 7.5,
  /** Raio "irregular" do pé do penhasco que cerca o monte. */
  raioBase: 49,
  iParedeBase: 4,
  iParedeTopo: 5,
  iFossoA: 8,
  iFossoB: 9,
  profundidadeFosso: 3,
  /** Fileiras de pedras no fosso (t ao longo do segmento) e quais são firmes [esquerda, direita]. */
  fileirasFosso: [0.11, 0.24, 0.37, 0.5, 0.63, 0.76, 0.89],
  pedrasFirmes: [[true, false], [true, true], [false, true], [false, true], [true, true], [true, false], [true, true]] as [boolean, boolean][],
  /** Afastamento lateral das duas colunas: o meio do caminho fica sem apoio (é preciso pisar nas pedras). */
  ladoPedra: 0.86,
  raioPedra: 0.58,
};

/** Sentinelas do acampamento inimigo: rotas de ronda (vai e volta, ou laço quando fecha). */
export const ROTAS_SENTINELAS: Record<string, Ponto2[]> = {
  sentinela1: [[22, -166], [19, -186], [21, -206]],
  sentinela2: [[68, -166], [72, -186], [70, -207]],
  sentinela3: [[27, -160], [45, -165], [63, -160]],
  sentinela4: [[33, -199], [45, -208], [59, -205], [53, -193], [38, -192], [33, -199]],
};

/** Caminhos cobertos (atrás de pedras e arbustos) da passagem até os flancos (Gn 14:15). */
export const ROTAS_FLANCO: Record<string, Ponto2[]> = {
  flancoOeste: [[40, -128], [30, -143], [12, -158], [5, -176], [10, -190]],
  flancoLeste: [[40, -128], [54, -143], [78, -158], [87, -176], [80, -192]],
  flancoSul: [[40, -128], [42, -141], [44, -150]],
};

/** Currais (Gn 13:5-7): centro, tamanho (x = largura, z = fundo), giro e porteira na face sul. */
export interface DefCurral {
  centro: Ponto2;
  w: number;
  d: number;
  yaw: number;
  /** Dobradiça e extremidade da porteira fechada (locais), e para onde ela abre. */
  dobradica: Ponto2;
  ponta: Ponto2;
  /** Giro (local) da porteira aberta: 1 = gira no sentido que a leva para fora (+z local). */
  sentido: 1 | -1;
}

export const CURRAIS: Record<'curralAbrao' | 'curralLo', DefCurral> = {
  curralAbrao: { centro: [-52, -24], w: 14, d: 10, yaw: 0.12, dobradica: [-0.6, 5], ponta: [2.6, 5], sentido: 1 },
  curralLo: { centro: [2, -24], w: 14, d: 10, yaw: -0.12, dobradica: [0.6, 5], ponta: [-2.6, 5], sentido: -1 },
};

/** Converte um ponto local do curral para o mundo. */
export function localCurral(c: DefCurral, lx: number, lz: number): Ponto2 {
  const cs = Math.cos(c.yaw);
  const sn = Math.sin(c.yaw);
  return [c.centro[0] + lx * cs + lz * sn, c.centro[1] - lx * sn + lz * cs];
}

/** Acampamentos de Abrão: posições (mundo) das tendas e da fogueira. */
export interface DefAcampamento {
  centro: Ponto2;
  tendaAbrao: { pos: Ponto2; yaw: number };
  tendaSara: { pos: Ponto2; yaw: number };
  servos: { pos: Ponto2; yaw: number; w: number; d: number; h: number }[];
  fogueira: Ponto2;
}

export const ACAMPAMENTOS: Record<'betel' | 'manre', DefAcampamento> = {
  betel: {
    centro: CANAA.acampamentoBetel,
    tendaAbrao: { pos: [-37, -86], yaw: 0.15 },
    tendaSara: { pos: [-24.5, -88], yaw: -0.12 },
    servos: [
      { pos: [-45, -75], yaw: 0.7, w: 5, d: 4, h: 2.1 },
      { pos: [-17, -75], yaw: -0.8, w: 5, d: 4, h: 2.1 },
      { pos: [-44, -96], yaw: 1.3, w: 4.6, d: 3.8, h: 2 },
    ],
    fogueira: [-30, -78],
  },
  manre: {
    centro: CANAA.acampamentoManre,
    tendaAbrao: { pos: [-118, 104], yaw: 0.3 },
    tendaSara: { pos: [-106, 101], yaw: -0.2 },
    servos: [
      { pos: [-125, 115], yaw: 1.1, w: 5, d: 4, h: 2.1 },
      { pos: [-99, 113], yaw: -1.2, w: 5, d: 4, h: 2.1 },
      { pos: [-113, 121], yaw: Math.PI - 0.1, w: 4.6, d: 3.8, h: 2 },
    ],
    fogueira: [-112, 110],
  },
};

/** Pontos de referência das tendas (mastro e estaca) usados pela montagem em dupla (B1). */
function pontoTenda(t: { pos: Ponto2; yaw: number }, lx: number, lz: number): Ponto2 {
  const cs = Math.cos(t.yaw);
  const sn = Math.sin(t.yaw);
  return [t.pos[0] + lx * cs + lz * sn, t.pos[1] - lx * sn + lz * cs];
}

const AB = ACAMPAMENTOS.betel;
const AM = ACAMPAMENTOS.manre;
const CA = CURRAIS.curralAbrao;
const CL = CURRAIS.curralLo;

function noRota(nome: string): Ponto2 {
  const n = ROTA_MORIA.find((r) => r.nome === nome)!;
  return [n.x, n.z];
}

/** Ponto um pouco antes do fosso, de frente para as pedras. */
const ANTES_FOSSO: Ponto2 = (() => {
  const a = ROTA_MORIA[MORIA.iFossoA - 1];
  const b = ROTA_MORIA[MORIA.iFossoA];
  const l = Math.hypot(b.x - a.x, b.z - a.z);
  return [b.x - ((b.x - a.x) / l) * 1.6, b.z - ((b.z - a.z) / l) * 1.6];
})();

export const MAPA_CANAA: DefMapa = {
  nome: 'canaa',
  tamanho: CANAA.tamanho,
  semente: 1213,
  nivelAgua: CANAA.nivelAgua,
  gramaDoChao: 0.55,
  pontos: {
    // B1 — chegada, Moré e o monte entre Betel e Ai
    chegada: [-136, -150],
    caravana: [-142, -128],
    more: CANAA.more,
    altarMore: [-141, -122],
    siquem: CANAA.siquem,
    betel: CANAA.betel,
    ai: CANAA.ai,
    acampamentoBetel: CANAA.acampamentoBetel,
    tendaAbraoBetel: AB.tendaAbrao.pos,
    tendaSaraBetel: AB.tendaSara.pos,
    // aliases que acompanham definirAcampamento (começam em Betel)
    acampamento: CANAA.acampamentoBetel,
    tendaAbrao: AB.tendaAbrao.pos,
    tendaSara: AB.tendaSara.pos,
    fogueiraAcampamento: AB.fogueira,
    fogueiraBetel: AB.fogueira,
    mastroTenda1: pontoTenda(AB.tendaAbrao, 0, 2.3),
    amarrarTenda1: pontoTenda(AB.tendaAbrao, 4.4, 3.2),
    mastroTenda2: pontoTenda(AB.tendaSara, 0, 2.1),
    amarrarTenda2: pontoTenda(AB.tendaSara, -4, 3),
    altarBetel: [-19, -97],
    orarBetel: [-20.5, -94.5],
    // B2 — pastos, poço, currais, Jordão, mirantes, Manre
    poco: CANAA.poco,
    pasto: [-25, 16],
    curralAbrao: CA.centro,
    curralLo: CL.centro,
    porteiraAbrao: localCurral(CA, -1.7, 6.4),
    porteiraLo: localCurral(CL, 1.7, 6.4),
    entradaCurralAbrao: localCurral(CA, 1, 8),
    entradaCurralLo: localCurral(CL, -1, 8),
    miranteJordao: CANAA.miranteJordao,
    descidaJordao: [100, -14],
    planicieJordao: [136, 8],
    sodomaLonge: CANAA.sodoma,
    ...CANAA.mirantes,
    segredoPo: CANAA.segredos.segredo1,
    ...CANAA.segredos,
    manre: CANAA.manre,
    acampamentoManre: CANAA.acampamentoManre,
    tendaAbraoManre: AM.tendaAbrao.pos,
    tendaSaraManre: AM.tendaSara.pos,
    fogueiraManre: AM.fogueira,
    altarManre: [-97, 96],
    carvalhoManre: [-131, 97],
    // B3 — notícia, Dã, Savé e Salém
    chegadaFugitivo: [-70, 102],
    reuniaoServos: [-100, 124],
    aliadosManre: [-141, 129],
    da: CANAA.da,
    flancoOeste: [10, -190],
    flancoLeste: [80, -192],
    flancoSul: [44, -150],
    acampamentoInimigo: [45, -188],
    cativos: [59, -198],
    cativo1: [57, -196.5],
    cativo2: [59.5, -196],
    cativo3: [61.5, -197.5],
    cativo4: [57.5, -199.5],
    cativo5: [60.5, -200],
    despojos: [30, -197],
    sentinela1: ROTAS_SENTINELAS.sentinela1[0],
    sentinela2: ROTAS_SENTINELAS.sentinela2[0],
    sentinela3: ROTAS_SENTINELAS.sentinela3[0],
    sentinela4: ROTAS_SENTINELAS.sentinela4[0],
    fugaInimigos: [46, -217],
    save: CANAA.save,
    salem: CANAA.salem,
    altarSalem: [3, 85],
    melquisedeque: [-2, 88],
    dizimo: [-6, 90],
    // os bens de Sodoma trazidos de volta (Gn 14:16), que Abrão recusa (Gn 14:23)
    despojosSave: [-16, 107],
    chegadaSodoma: [30, 104],
    // B4 — a noite das estrelas (junto da tenda em Manre)
    ceuEstrelas: CANAA.ceuEstrelas,
    // B5 — Moriá
    servosMoria: [36, 103],
    peMoria: noRota('peMoria'),
    degrausMoria: noRota('degrausMoria'),
    paredeMoria: noRota('paredeMoria'),
    cordaMoria: noRota('cordaMoria'),
    estreitoMoria: ANTES_FOSSO,
    fossoMoria: [(ROTA_MORIA[MORIA.iFossoA].x + ROTA_MORIA[MORIA.iFossoB].x) / 2, (ROTA_MORIA[MORIA.iFossoA].z + ROTA_MORIA[MORIA.iFossoB].z) / 2],
    estreitoFim: noRota('estreitoFim'),
    patamarMoria: noRota('patamarMoria'),
    subidaFinal: noRota('subidaFinal'),
    topoMoria: CANAA.moria,
    altarMoria: [50.5, 170.6],
    arbustoCarneiro: [56.8, 176.6],
    // canto do mapa onde ficam, fora de cena, os personagens indisponíveis
    bastidor: [-236, 236],
  },

  altura(x, z, r) {
    const T = terreno(r);
    return T.altura(x, z);
  },

  cor(x, z, h, inc, out, r) {
    const T = terreno(r);
    const n = r.fbm(x * 0.03, z * 0.03, 3);
    const n2 = r.ruido(x * 0.11, z * 0.11);
    const n3 = r.fbm(x * 0.008 + 40, z * 0.008, 2);
    // planalto dourado/ocre, com manchas de terra vermelha e capim claro
    out.set('#c8ab66');
    if (n > 0.2) out.lerp(_c.set('#d8c07c'), smoothstep(0.2, 0.55, n) * 0.7);
    if (n < -0.25) out.lerp(_c.set('#b98a55'), smoothstep(-0.25, -0.6, n) * 0.6);
    if (n3 > 0.25) out.lerp(_c.set('#b67a50'), smoothstep(0.25, 0.6, n3) * 0.45);
    if (n3 < -0.3) out.lerp(_c.set('#a8a25e'), smoothstep(-0.3, -0.65, n3) * 0.45);
    // encostas: calcário claro e estratos mais escuros
    const pedra = smoothstep(0.12, 0.3, inc);
    if (pedra > 0) {
      const estrato = Math.sin(h * 1.7 + n2 * 0.8) > 0.3 ? '#b6aa90' : '#d8cfba';
      out.lerp(_c.set(estrato), pedra * 0.85);
    }
    // montanhas da borda: mais pedregosas; Moabe (leste) avermelhado
    out.lerp(_c.set('#c4b496'), smoothstep(24, 46, h) * 0.5);
    out.lerp(_c.set('#b4927a'), smoothstep(185, 230, x) * smoothstep(10, 30, h) * 0.55);
    // planície do Jordão: verde e regada
    const j = T.jordao(x, z) * (1 - smoothstep(6, 16, h));
    if (j > 0) {
      out.lerp(_c.set(n > 0 ? '#6f9f44' : '#5f9340'), j * 0.92);
      const { d } = distPolilinha(x, z, RIO_JORDAO);
      if (d < 26) out.lerp(_c.set('#4f8a3c'), (1 - smoothstep(8, 26, d)) * 0.6 * j);
      if (d < 13) out.lerp(_c.set('#d2c290'), 1 - smoothstep(7.5, 12, d + n2 * 0.8));
    }
    if (h < CANAA.nivelAgua - 0.2) out.lerp(_c.set('#a89870'), 0.8);
    // Manre: carvalhais verdes
    const dm = Math.hypot(x - CANAA.manre[0], z - CANAA.manre[1]);
    if (dm < 70) out.lerp(_c.set(n > 0.1 ? '#8eaa52' : '#7f9f4a'), (1 - smoothstep(35, 70, dm)) * 0.8 * (1 - pedra * 0.6));
    // vale de Dã (nascentes): um pouco mais verde
    const dd = Math.hypot(x - CANAA.valeDa[0], z - CANAA.valeDa[1]);
    if (dd < 55) out.lerp(_c.set('#a3a45c'), (1 - smoothstep(25, 55, dd)) * 0.55 * (1 - pedra));
    // vale de Savé: fundo mais verde
    const ds = Math.hypot(x - CANAA.save[0], z - CANAA.save[1]);
    if (ds < 30) out.lerp(_c.set('#a6a85e'), (1 - smoothstep(10, 30, ds)) * 0.5);
    // Moriá: estratos de calcário quente nas faces íngremes; nos patamares, terra e mato seco
    const dmo = Math.hypot(x - MORIA.topo[0], z - MORIA.topo[1]);
    if (dmo < 58) {
      const m = 1 - smoothstep(44, 56, dmo);
      const faixa = Math.sin(h * 1.3 + n2 * 0.9);
      out.lerp(_c.set(faixa > 0.5 ? '#bea283' : faixa > -0.3 ? '#dcc8a2' : '#ccb08a'), m * (0.45 + pedra * 0.5));
      out.lerp(_c.set(n > 0 ? '#a0975a' : '#b2a366'), m * (1 - pedra) * 0.75);
      if (n2 > 0.45) out.lerp(_c.set('#957f62'), m * pedra * 0.5 * smoothstep(0.45, 0.8, n2));
      const rt = T.rota(x, z);
      if (rt.d < rt.w + 0.4) out.lerp(_c.set('#c9b48c'), 0.7);
    }
    // chão batido: acampamentos, aldeias, poço, currais
    for (const [cx, cz, r0, r1, k] of CHAO_BATIDO) {
      const dc = Math.hypot(x - cx, z - cz);
      if (dc < r1) out.lerp(_c.set('#b99f74'), (1 - smoothstep(r0, r1, dc + n2 * 1.5)) * k);
    }
    // trilhas
    for (const t of TRILHAS) {
      const dt = distTrilha(x, z, t);
      if (dt < 3.2) out.lerp(_c.set('#cdb486'), (1 - smoothstep(1.1, 3.2, dt + n2 * 0.6)) * 0.85);
    }
  },

  densidadeGrama(x, z) {
    const rel = relevoAtual;
    if (rel) {
      const inc = rel.inclinacao(x, z);
      if (inc > 0.2) return 0.06;
    }
    const T = terrenoAtual;
    if (T) {
      const rt = T.rota(x, z);
      if (rt.d < rt.w + 2) return 0.04;
      if (T.jordao(x, z) > 0.5) {
        const d = distPolilinha(x, z, RIO_JORDAO).d;
        return d < 11 ? 0.15 : 0.95;
      }
    }
    for (const [cx, cz, r0] of CHAO_BATIDO) if (Math.hypot(x - cx, z - cz) < r0 + 1) return 0.12;
    for (const t of TRILHAS) if (distTrilha(x, z, t) < 2) return 0.05;
    const dm = Math.hypot(x - CANAA.manre[0], z - CANAA.manre[1]);
    if (dm < 60) return 0.85;
    const dmo = Math.hypot(x - MORIA.topo[0], z - MORIA.topo[1]);
    if (dmo < 50) return 0.15;
    return 0.6;
  },

  corGrama(x, z, out) {
    out.set('#dcc478');
    const w = Math.sin(x * 0.045 + 1) * Math.cos(z * 0.038);
    if (w > 0.25) out.lerp(_c.set('#dcc47c'), (w - 0.25) * 0.9);
    if (w < -0.4) out.lerp(_c.set('#b0a758'), (-0.4 - w) * 0.9);
    const T = terrenoAtual;
    if (T && T.jordao(x, z) > 0.3) out.lerp(_c.set('#7fae4c'), T.jordao(x, z));
    const dm = Math.hypot(x - CANAA.manre[0], z - CANAA.manre[1]);
    if (dm < 65) out.lerp(_c.set('#9ab858'), 1 - smoothstep(35, 65, dm));
  },
};

/** Áreas de chão batido: [x, z, raio cheio, raio de borda, intensidade]. */
const CHAO_BATIDO: [number, number, number, number, number][] = [
  [CANAA.acampamentoBetel[0], CANAA.acampamentoBetel[1], 13, 19, 0.75],
  [CANAA.acampamentoManre[0], CANAA.acampamentoManre[1], 11, 17, 0.6],
  [CANAA.poco[0], CANAA.poco[1], 6, 12, 0.7],
  [CA.centro[0], CA.centro[1], 8, 12, 0.8],
  [CL.centro[0], CL.centro[1], 8, 12, 0.8],
  [CANAA.betel[0], CANAA.betel[1], 15, 22, 0.7],
  [CANAA.ai[0], CANAA.ai[1], 14, 20, 0.7],
  [CANAA.siquem[0], CANAA.siquem[1], 12, 18, 0.7],
  [CANAA.salem[0], CANAA.salem[1], 11, 17, 0.7],
  [CANAA.sodoma[0], CANAA.sodoma[1], 22, 30, 0.8],
  [CANAA.valeDa[0], CANAA.valeDa[1], 17, 25, 0.55],
  [CANAA.peMoria[0], CANAA.peMoria[1], 6, 11, 0.6],
  [-141, 129, 6, 10, 0.5],
];

/** Distância a uma trilha com teste rápido de caixa. */
export function distTrilha(x: number, z: number, t: Ponto2[]) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const bb = caixaTrilha.get(t);
  if (bb) [x0, x1, z0, z1] = bb;
  else {
    for (const [px, pz] of t) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
    caixaTrilha.set(t, [x0, x1, z0, z1]);
  }
  if (x < x0 - 5 || x > x1 + 5 || z < z0 - 5 || z > z1 + 5) return Infinity;
  return distPolilinha(x, z, t).d;
}
const caixaTrilha = new Map<Ponto2[], [number, number, number, number]>();

const _c = new THREE.Color();

/** Relevo do mundo construído (para a grama consultar a inclinação). */
let relevoAtual: Relevo | null = null;
let terrenoAtual: TerrenoCanaa | null = null;
export function ligarRelevo(r: Relevo) {
  relevoAtual = r;
}

/** Margem oeste da planície do Jordão (onde a escarpa termina). */
export function xEscarpa(z: number) {
  return 112 + 9 * Math.sin(z * 0.018) + 5 * Math.sin(z * 0.047 + 1);
}

/** Raio "irregular" do Moriá a partir do topo (deixa o monte menos circular). */
export function fatorRaioMoria(ang: number) {
  return 1 + 0.07 * Math.sin(ang * 3 + 1) + 0.045 * Math.sin(ang * 5 - 0.4);
}

/** Resultado da consulta à trilha do Moriá. */
export interface ConsultaRota {
  d: number;
  /** Altura absoluta do caminho no ponto mais próximo. */
  h: number;
  w: number;
  /** Índice do segmento e posição (0..1) nele. */
  i: number;
  t: number;
}

const ROTA_VAZIA: ConsultaRota = { d: Infinity, h: 0, w: 0, i: -1, t: 0 };

/**
 * Funções de relevo compartilhadas (altura, Jordão, trilha do Moriá), com cache por semente.
 * O mapa é condensado; as alturas de cada lugar são relativas ao planalto naquele ponto.
 */
export class TerrenoCanaa {
  private r: Ruido;
  private cache = new Map<string, number>();
  /** Altura do pé do Moriá (as alturas da trilha são relativas a ela). */
  readonly basePe: number;
  /** Caixa da trilha do Moriá (para descartar consultas longe). */
  private bb: [number, number, number, number];

  constructor(r: Ruido) {
    this.r = r;
    this.basePe = this.planalto(CANAA.peMoria[0], CANAA.peMoria[1]);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const n of ROTA_MORIA) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); z0 = Math.min(z0, n.z); z1 = Math.max(z1, n.z); }
    this.bb = [x0 - 8, x1 + 8, z0 - 8, z1 + 8];
  }

  /** Planalto + Jordão + bordas (sem os lugares). */
  planalto(x: number, z: number) {
    const r = this.r;
    let h = 9 + r.fbm(x * 0.0062, z * 0.0062, 4) * 6.5 + r.fbm(x * 0.028 + 11, z * 0.028 - 3, 3) * 1.3;
    const tj = this.jordao(x, z);
    if (tj > 0) {
      const hPlan = 2.3 + r.fbm(x * 0.02 + 5, z * 0.02, 2) * 0.6;
      h += (hPlan - h) * tj;
    }
    const b = fatorBorda(x, z, CANAA.tamanho / 2, 62);
    if (b > 0) {
      const c = r.cristas(x * 0.011, z * 0.011, 4);
      let alt = 22 + c * 26;
      alt = lerp(alt, 34 + c * 16, smoothstep(150, 220, x));
      alt = lerp(alt, 14 + c * 16, smoothstep(-150, -220, x));
      h += Math.pow(b, 1.5) * alt;
    }
    return h;
  }

  /** 0..1: quanto o ponto está na planície do Jordão. */
  jordao(x: number, z: number) {
    const xe = xEscarpa(z);
    return smoothstep(xe - 24, xe + 12, x);
  }

  /** Altura do planalto num ponto nomeado (memorizada). */
  private base(nome: string, x: number, z: number) {
    let v = this.cache.get(nome);
    if (v === undefined) {
      v = this.planalto(x, z);
      this.cache.set(nome, v);
    }
    return v;
  }

  /** Ponto mais próximo da trilha do Moriá. */
  rota(x: number, z: number): ConsultaRota {
    const [x0, x1, z0, z1] = this.bb;
    if (x < x0 || x > x1 || z < z0 || z > z1) return ROTA_VAZIA;
    let melhor = Infinity;
    let mi = 0;
    let mt = 0;
    for (let i = 0; i < ROTA_MORIA.length - 1; i++) {
      const a = ROTA_MORIA[i];
      const b = ROTA_MORIA[i + 1];
      const s = distSegmento(x, z, a.x, a.z, b.x, b.z);
      if (s.d < melhor) {
        melhor = s.d;
        mi = i;
        mt = s.t;
      }
    }
    const a = ROTA_MORIA[mi];
    const b = ROTA_MORIA[mi + 1];
    let h = this.basePe + lerp(a.h, b.h, mt);
    if (mi === MORIA.iFossoA) {
      // o fosso das pedras soltas: degraus abruptos nas pontas
      h -= MORIA.profundidadeFosso * smoothstep(0.0, 0.07, mt) * (1 - smoothstep(0.93, 1, mt));
    }
    return { d: melhor, h, w: lerp(a.w, b.w, mt), i: mi, t: mt };
  }

  /** Altura do cone rochoso do Moriá (ou -Infinity fora dele). */
  private moria(x: number, z: number) {
    const [sx, sz] = MORIA.topo;
    const dx = x - sx;
    const dz = z - sz;
    const d = Math.hypot(dx, dz);
    if (d > 62) return -Infinity;
    const dd = d * fatorRaioMoria(Math.atan2(dz, dx));
    const topo = this.basePe + MORIA.alturaTopo;
    const rb = MORIA.raioBase;
    let h: number;
    if (dd < MORIA.raioPlato) h = topo;
    else if (dd < rb) {
      h = topo - (dd - MORIA.raioPlato) * 0.86;
      // estratos de calcário: degraus suaves
      const k = 3.4;
      const f = h / k;
      const fl = Math.floor(f);
      h = h * 0.45 + (fl + smoothstep(0.5, 0.95, f - fl)) * k * 0.55;
      h += this.r.fbm(x * 0.09, z * 0.09, 2) * 1.4 * smoothstep(MORIA.raioPlato, MORIA.raioPlato + 6, dd);
    } else {
      const hb = topo - (rb - MORIA.raioPlato) * 0.86;
      h = hb * (1 - smoothstep(rb, rb + 2.2, dd)) - smoothstep(rb, rb + 2.2, dd) * 50;
    }
    return h;
  }

  altura(x: number, z: number) {
    const r = this.r;
    let h = this.planalto(x, z);

    // Siquém, entre Ebal e Gerizim; o carvalho de Moré num vale suave
    h += 20 * (1 - smoothstep(10, 46, Math.hypot(x - CANAA.ebal[0], z - CANAA.ebal[1])));
    h += 17 * (1 - smoothstep(10, 44, Math.hypot(x - CANAA.gerizim[0], z - CANAA.gerizim[1])));
    h = achatar(h, x, z, CANAA.more[0], CANAA.more[1], 10, 32, this.base('more', CANAA.more[0], CANAA.more[1]) - 1);
    h = achatar(h, x, z, CANAA.siquem[0], CANAA.siquem[1], 12, 22, this.base('siquem', CANAA.siquem[0], CANAA.siquem[1]));

    // o monte entre Betel e Ai
    const [bx, bz] = CANAA.acampamentoBetel;
    const db = Math.hypot(x - bx, z - bz);
    h += 8 * (1 - smoothstep(12, 58, db));
    h = achatar(h, x, z, bx, bz, 16, 28, this.base('betelMonte', bx, bz) + 7);
    h = achatar(h, x, z, CANAA.betel[0], CANAA.betel[1], 15, 26, this.base('betel', CANAA.betel[0], CANAA.betel[1]) + 1);
    h = achatar(h, x, z, CANAA.ai[0], CANAA.ai[1], 14, 24, this.base('ai', CANAA.ai[0], CANAA.ai[1]) + 2);

    // mirantes: outeiros com o topo plano
    for (const [nome, [mx, mz]] of LISTA_MIRANTES) {
      const alt = nome === 'miranteOeste' ? 11 : nome === 'miranteLeste' ? 6 : 9;
      const dm = Math.hypot(x - mx, z - mz);
      if (dm < 34) {
        h += alt * (1 - smoothstep(5, 30, dm));
        h = achatar(h, x, z, mx, mz, 3.5, 7, this.base(nome, mx, mz) + alt);
      }
    }
    // mirante do Jordão: saliência de rocha na borda da escarpa
    {
      const [jx, jz] = CANAA.miranteJordao;
      const dj = Math.hypot(x - jx, z - jz);
      if (dj < 30) {
        h += 6 * (1 - smoothstep(4, 24, dj));
        h = achatar(h, x, z, jx, jz, 4, 8, this.base('miranteJordao', jx, jz) + 6);
      }
    }

    // pastos: colinas suaves, currais e poço planos
    {
      const [px, pz] = CANAA.poco;
      const dp = Math.hypot(x - px, z - pz);
      if (dp < 70) {
        const alvo = this.base('poco', px, pz);
        h = lerp(h, alvo + (h - alvo) * 0.35, 1 - smoothstep(30, 70, dp));
        h = achatar(h, x, z, px, pz, 6, 14, alvo);
        for (const c of [CA, CL]) h = achatar(h, x, z, c.centro[0], c.centro[1], 9.5, 16, alvo + 0.2);
      }
    }

    // Manre: planície baixa e verde; clareira do acampamento; outeiro das estrelas
    {
      const [mx, mz] = CANAA.manre;
      const dm = Math.hypot(x - mx, z - mz);
      if (dm < 80) {
        const alvo = this.base('manre', mx, mz) - 1;
        h = lerp(h, alvo + (h - alvo) * 0.3, 1 - smoothstep(35, 80, dm));
        h = achatar(h, x, z, CANAA.acampamentoManre[0], CANAA.acampamentoManre[1], 15, 24, alvo);
        h = achatar(h, x, z, -141, 129, 6, 11, alvo + 0.2);
        const de = Math.hypot(x - CANAA.ceuEstrelas[0], z - CANAA.ceuEstrelas[1]);
        h += 2.6 * (1 - smoothstep(3, 15, de));
      }
    }

    // vale de Savé e Salém na encosta acima dele
    {
      const [sx, sz] = CANAA.save;
      const ds = Math.hypot(x - sx, z - sz);
      if (ds < 45) {
        h -= 4.5 * (1 - smoothstep(6, 40, ds));
        h = achatar(h, x, z, sx, sz, 5, 12, this.base('save', sx, sz) - 4.5);
      }
      h = achatar(h, x, z, CANAA.salem[0], CANAA.salem[1], 10, 17, this.base('salem', CANAA.salem[0], CANAA.salem[1]) - 0.5);
    }

    // vale de Dã: fundo plano cercado por cristas, aberto ao sul (a passagem)
    {
      const [vx, vz] = CANAA.valeDa;
      const dx = x - vx;
      const dz = z - vz;
      const dv = Math.hypot(dx, dz);
      if (dv < 80) {
        const fundo = this.base('valeDa', vx, vz) - 2.5;
        h = achatar(h, x, z, vx, vz, 26, 42, fundo);
        const pdx = CANAA.da[0] - vx;
        const pdz = CANAA.da[1] - vz;
        const pl = Math.hypot(pdx, pdz);
        const cosAng = dv > 0.01 ? (dx * pdx + dz * pdz) / (dv * pl) : 0;
        const brecha = smoothstep(0.9, 0.975, cosAng);
        const anel = smoothstep(34, 50, dv) * (1 - smoothstep(58, 78, dv));
        h += (12 + r.fbm(x * 0.05, z * 0.05, 2) * 3) * anel * (1 - brecha);
      }
    }

    // segredos: uma ravina (2), um abrigo de rocha (4)
    {
      const [s2x, s2z] = CANAA.segredos.segredo2;
      h -= 3.5 * (1 - smoothstep(3, 14, Math.hypot(x - s2x, z - s2z)));
      const [s4x, s4z] = CANAA.segredos.segredo4;
      h += 5 * (1 - smoothstep(4, 16, Math.hypot(x - s4x - 3, z - s4z - 4)));
      for (const [nome, [sx, sz]] of LISTA_SEGREDOS) {
        if (nome === 'segredo2') continue;
        h = achatar(h, x, z, sx, sz, 2.5, 5, this.base(nome, sx, sz) + (nome === 'segredo4' ? 0.6 : 0.3));
      }
    }

    // Sodoma: base plana na planície
    h = achatar(h, x, z, CANAA.sodoma[0], CANAA.sodoma[1], 24, 34, this.base('sodoma', CANAA.sodoma[0], CANAA.sodoma[1]) + 0.3);

    // trilhas levemente aplainadas
    for (const t of TRILHAS) {
      const dt = distTrilha(x, z, t);
      if (dt < 4) h -= (1 - dt / 4) * 0.22;
    }

    // Moriá: pé plano, cone rochoso e a trilha escavada
    h = achatar(h, x, z, CANAA.peMoria[0], CANAA.peMoria[1], 7, 16, this.basePe);
    const hm = this.moria(x, z);
    if (hm > h) h = hm;
    const rt = this.rota(x, z);
    if (rt.d < rt.w + 3) {
      const k = 1 - smoothstep(rt.w, rt.w + 3, rt.d);
      h += (rt.h - h) * k;
    }

    // rio Jordão
    const { d, u } = distPolilinha(x, z, RIO_JORDAO);
    const largura = 6.5 + Math.sin(u * 11) * 1.4;
    if (d < largura + 9) {
      const tt = clamp(d / largura, 0, 1);
      const fundo = CANAA.nivelAgua - 2.4 * (1 - tt * tt);
      const margem = smoothstep(largura, largura + 9, d);
      h = Math.min(h, fundo + (h - fundo) * margem + (1 - margem) * Math.max(0, (tt - 0.85) * 3));
    }
    return h;
  }
}

const LISTA_MIRANTES = Object.entries(CANAA.mirantes);
const LISTA_SEGREDOS = Object.entries(CANAA.segredos);

const terrenos = new WeakMap<Ruido, TerrenoCanaa>();
/** Funções de relevo para a semente do mapa (uma instância por Ruido). */
export function terreno(r: Ruido): TerrenoCanaa {
  let t = terrenos.get(r);
  if (!t) {
    t = new TerrenoCanaa(r);
    terrenos.set(r, t);
    terrenoAtual = t;
  }
  return t;
}
