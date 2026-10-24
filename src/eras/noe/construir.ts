import * as THREE from 'three';
import { Mundo } from '../../mundo/Mundo';
import { espalhar } from '../../mundo/Espalhar';
import { Construtor, CORES } from '../../entidades/Construtor';
import { distPolilinha } from '../../mundo/Relevo';
import { MAPA_NOE, NOE, CAMINHOS, RIO } from './mapa';
import { Arca } from './Arca';
import { smoothstep } from '../../core/util';

export type EstadoVale = 'antes' | 'depois';

/** Mundo da era de Noé com as peças que mudam ao longo da história. */
export class MundoNoe {
  readonly mundo: Mundo;
  readonly arca: Arca;
  readonly cidade = new THREE.Group();
  readonly estaleiro = new THREE.Group();
  estado: EstadoVale = 'antes';

  constructor(cenaNatureza: THREE.Object3D) {
    this.mundo = new Mundo(MAPA_NOE, cenaNatureza);
    const m = this.mundo;
    definirVariantes(m);
    vegetacaoAntes(m);
    construirCasa(m);
    construirCidade(m, this.cidade);
    construirEstaleiro(m);
    construirMonteOracao(m);
    construirGruta(m);
    construirVau(m);
    const [ex, ez] = NOE.estaleiro;
    this.arca = new Arca(m, ex, NOE.estaleiroAltura, ez);
    this.arca.definirEstagio(0);
    m.finalizar();
  }
}

function definirVariantes(m: Mundo) {
  const n = m.natureza;
  // madeira de gofer: tradicionalmente identificada com o cipreste (NVT)
  n.definirVariante('cipreste', { modelos: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'], tintFolha: '#9cc08a', vento: 0.1, raioTronco: 0.35, alcancePerto: 55 });
  n.definirVariante('arvore', { modelos: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'], tintFolha: '#d8f0a0', vento: 0.14, raioTronco: 0.4, alcancePerto: 60 });
  n.definirVariante('oliveira', { modelos: ['TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3', 'TwistedTree_4', 'TwistedTree_5'], tintFolha: '#b8c8a0', tintTronco: '#c8b8a0', vento: 0.1, raioTronco: 1.0, alcancePerto: 50 });
  n.definirVariante('arvoreSeca', { modelos: ['DeadTree_1', 'DeadTree_2', 'DeadTree_3'], vento: 0.02, raioTronco: 0.4, alcancePerto: 60 });
  n.definirVariante('arbusto', { modelos: ['Bush_Common', 'Bush_Common_Flowers'], tintFolha: '#d0e8a0', vento: 0.08, alcance: 120, alcancePerto: 45 });
  n.definirVariante('pedra', { modelos: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], vento: 0, raioTronco: 1.0, alcance: 200, alcancePerto: 70 });
  n.definirVariante('seixo', { modelos: ['Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2'], vento: 0, alcance: 60, alcancePerto: 60, sombra: false });
  n.definirVariante('flores', { modelos: ['Flower_3_Group', 'Flower_4_Group', 'Flower_3_Single', 'Clover_1', 'Plant_1'], vento: 0.12, alcance: 55, alcancePerto: 55, sombra: false });
  n.definirVariante('samambaia', { modelos: ['Fern_1', 'Plant_7'], tintFolha: '#c8e0a0', vento: 0.1, alcance: 70, alcancePerto: 50, sombra: false });
  n.definirVariante('capim', { modelos: ['Grass_Common_Tall', 'Grass_Wispy_Tall'], tintFolha: '#e8e0a0', vento: 0.2, alcance: 60, alcancePerto: 60, sombra: false });
  n.definirVariante('trigo', { modelos: ['Grass_Wispy_Tall'], tintFolha: '#ffe08a', vento: 0.25, alcance: 80, alcancePerto: 80, sombra: false });
}

/** Zonas livres de vegetação: estruturas, caminhos, rio. */
function livre(x: number, z: number): number {
  const [ex, ez] = NOE.estaleiro;
  if (Math.abs(x - ex) < 95 && Math.abs(z - ez) < 32) return 0;
  if (Math.hypot(x - NOE.cidade[0], z - NOE.cidade[1]) < 52) return 0;
  if (Math.hypot(x - NOE.casa[0], z - NOE.casa[1]) < 15) return 0;
  if (Math.hypot(x - NOE.monteOracao[0], z - NOE.monteOracao[1]) < 9) return 0;
  const dp = Math.hypot(Math.max(0, Math.abs(x - NOE.plato[0]) - 72), Math.max(0, Math.abs(z - NOE.plato[1]) - 16));
  if (dp < 4) return 0;
  for (const c of CAMINHOS) if (distPolilinha(x, z, c).d < 3.5) return 0;
  return 1;
}

function vegetacaoAntes(m: Mundo) {
  const r = m.ruido;
  // bosque de gofer a oeste
  espalhar(m, 'cipreste', {
    espacamento: 6.5, escala: [0.95, 1.6], inclinacaoMax: 0.35,
    densidade: (x, z) => livre(x, z) * smoothstep(-95, -130, x) * (0.75 + r.ruido(x * 0.02, z * 0.02) * 0.25),
  });
  // árvores espalhadas pelo vale
  espalhar(m, 'arvore', {
    espacamento: 14, escala: [0.8, 1.25], inclinacaoMax: 0.3,
    densidade: (x, z) => livre(x, z) * (x > -100 ? 1 : 0) * smoothstep(0.1, 0.5, r.fbm(x * 0.012 + 3, z * 0.012, 2) + 0.35) * 0.55,
  });
  // pomar de oliveiras junto da casa
  espalhar(m, 'oliveira', {
    espacamento: 7, escala: [0.32, 0.42], x0: 2, x1: 34, z0: 82, z1: 110,
    densidade: (x, z) => livre(x, z) * 0.9,
  });
  espalhar(m, 'oliveira', { espacamento: 22, escala: [0.3, 0.42], densidade: (x, z) => livre(x, z) * (x > -90 && x < 130 ? 0.12 : 0), semente: 99 });
  espalhar(m, 'arbusto', { espacamento: 7, escala: [0.6, 1.3], inclinacaoMax: 0.4, densidade: (x, z) => livre(x, z) * (0.25 + r.fbm(x * 0.03, z * 0.03, 2) * 0.3) });
  espalhar(m, 'pedra', { espacamento: 9, escala: [0.5, 1.6], afundar: 0.4, densidade: (x, z) => livre(x, z) * (0.06 + smoothstep(14, 40, m.relevo.altura(x, z)) * 0.5 + smoothstep(0.15, 0.35, m.relevo.inclinacao(x, z)) * 0.4) });
  espalhar(m, 'flores', { espacamento: 3.2, escala: [0.7, 1.3], inclinacaoMax: 0.3, densidade: (x, z) => livre(x, z) * (z > 60 || x < -100 ? 0.45 : 0.18) * (m.relevo.altura(x, z) < 16 ? 1 : 0.2) });
  espalhar(m, 'samambaia', { espacamento: 4, escala: [0.6, 1.0], densidade: (x, z) => livre(x, z) * smoothstep(-100, -130, x) * 0.5 });
  espalhar(m, 'capim', { espacamento: 3.5, escala: [0.6, 1.1], densidade: (x, z) => livre(x, z) * 0.18 });
  // seixos na margem do rio
  espalhar(m, 'seixo', {
    espacamento: 2.5, escala: [0.6, 1.4], evitarAgua: false, afundar: 0.05,
    densidade: (x, z) => {
      const d = distPolilinha(x, z, RIO).d;
      return d > 6 && d < 12 ? 0.5 : 0;
    },
  });
  // trigal da casa de Noé (em fileiras)
  for (let x = 54; x < 78; x += 1.4) {
    for (let z = 96; z < 116; z += 1.2) {
      const y = m.relevo.altura(x, z);
      m.natureza.adicionar('trigo', x + Math.sin(z * 3) * 0.3, y, z, x * 3.1, 0.7 + ((x * 7 + z * 3) % 1) * 0.3, m.aleatorio);
    }
  }
}

function base(m: Mundo, x: number, z: number) {
  return m.relevo.altura(x, z);
}

function construirCasa(m: Mundo) {
  const c = new Construtor(41);
  const [cx, cz] = NOE.casa;
  const y = base(m, cx, cz);
  c.em(cx, y, cz, 0.15, () => {
    c.casa(8, 6, 3.2);
    c.em(11, 0, -6, -0.2, () => c.casa(5, 4.5, 2.7, CORES.barroEscuro));
    c.em(-8, 0, 10, 0, () => c.fogueira());
    c.em(16, 0, 12, 0, () => c.cerca([[-6, -5], [6, -5], [6, 5], [-6, 5], [-6, -5]], 1.1, [3]));
    for (let i = 0; i < 4; i++) c.jarro(-3 + i * 0.8, 3.6, 1);
    c.saco(4.6, 3.7);
    c.saco(5.3, 3.9, 0.8);
    c.em(2, 0, -8, 0, () => c.pilhaTroncos(2.6, 2));
  });
  const { malha, colisores } = c.construir('casaNoe');
  if (malha) m.adicionar(malha, colisores);
}

function construirCidade(m: Mundo, grupo: THREE.Group) {
  const c = new Construtor(613);
  const [cx, cz] = NOE.cidade;
  const y = base(m, cx, cz);
  c.em(cx, y, cz, 0, () => {
    // casas em anel ao redor da praça
    const casas: [number, number, number, number, number, number][] = [
      [-24, -16, 0.4, 9, 7, 3.6], [-8, -27, 0.1, 7, 6, 3.2], [9, -28, -0.15, 8, 6, 4.4], [25, -18, -0.5, 7, 7, 3.4],
      [30, 0, -1.5, 9, 6, 3.8], [26, 18, -2.3, 7, 6, 3.2], [10, 28, 3.0, 8, 7, 4.0], [-9, 28, 3.2, 7, 6, 3.4],
      [-25, 18, 2.4, 8, 6, 3.6], [-31, 1, 1.5, 7, 7, 3.2], [-37, -26, 0.8, 6, 5, 3.0], [38, -28, -0.8, 6, 5, 3.0],
      [40, 26, -2.6, 6, 6, 3.4], [-40, 24, 2.2, 6, 5, 3.0],
    ];
    casas.forEach(([x, z, yaw, w, d, h], i) => {
      c.em(x, 0, z, yaw, () => c.casa(w, d, h, i % 3 === 0 ? CORES.barroEscuro : i % 3 === 1 ? CORES.barro : CORES.barroClaro));
    });
    // praça do mercado
    const cores = ['#c8603a', '#3a6a8a', '#d8b050', '#7a4a7a', '#4a7a4a'];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      c.em(Math.cos(a) * 11, 0, Math.sin(a) * 11, -a + Math.PI / 2, () => c.banca(cores[i]));
    }
    c.em(0, 0, 0, 0, () => c.poco());
    // uma torre de tijolos: o orgulho da cidade
    c.em(2, 0, -44, 0, () => {
      c.caixa(0, 0, 0, 12, 4, 12, CORES.barroEscuro, { raio: 0.2 });
      c.caixa(0, 4, 0, 9, 4, 9, CORES.barro, { raio: 0.2 });
      c.caixa(0, 8, 0, 6, 4, 6, CORES.barroClaro, { raio: 0.2 });
      c.caixa(0, 12, 0, 3.5, 2.5, 3.5, CORES.barro, { raio: 0.2 });
      c.colisor({ x: 0, z: 0, hx: 6.2, hz: 6.2, y0: -1, y1: 15, piso: false });
    });
    for (let i = 0; i < 9; i++) c.jarro(-4 + (i % 3) * 0.7, 14 + Math.floor(i / 3) * 0.7, 1.1);
  });
  const { malha, colisores } = c.construir('cidade');
  if (malha) {
    grupo.add(malha);
    m.adicionar(grupo, colisores);
  }
}

function construirEstaleiro(m: Mundo) {
  const c = new Construtor(77);
  const [ex, ez] = NOE.estaleiro;
  const y = NOE.estaleiroAltura;
  c.em(ex, y, ez, 0, () => {
    c.em(45, 0, 23, 0.1, () => c.pilhaTroncos(4, 3));
    c.em(52, 0, 25, -0.2, () => c.pilhaTroncos(4, 2));
    c.em(38, 0, 26, 1.5, () => c.pilhaTroncos(5, 2));
    // cavaletes de serrar
    for (const [x, z] of [[30, 28], [24, 30], [-60, 25]] as const) {
      c.em(x, 0, z, 0.4, () => {
        for (const s of [-1, 1]) {
          c.viga(new THREE.Vector3(s * 1.2, 0, -0.5), new THREE.Vector3(s * 1.2, 0.9, 0.3), 0.05, CORES.madeira);
          c.viga(new THREE.Vector3(s * 1.2, 0, 0.5), new THREE.Vector3(s * 1.2, 0.9, -0.3), 0.05, CORES.madeira);
        }
        c.cilindro(0, 0.9, 0, 0.18, 0.18, 3, CORES.madeiraClara, 8, { rx: 0, rz: Math.PI / 2 });
        c.colisor({ x: 0, z: 0, hx: 1.5, hz: 0.6, y0: -1, y1: 1.1, piso: false });
      });
    }
    // caldeirão de betume sobre o fogo
    c.em(-33, 0, 19, 0, () => {
      c.fogueira();
      c.cilindro(0, 0.35, 0, 0.75, 0.55, 0.9, '#3a2e26', 12);
      c.cilindro(0, 1.24, 0, 0.7, 0.7, 0.02, CORES.betume, 12, { ao: 0 });
      for (let i = 0; i < 3; i++) c.jarro(1.6 + i * 0.7, 0.8, 1, '#4a3a2e');
    });
    // ferramentas e tábuas empilhadas
    for (let i = 0; i < 6; i++) c.caixa(58, i * 0.12, 18 + (i % 2) * 0.1, 6, 0.1, 0.5, i % 2 ? CORES.madeiraClara : CORES.madeira, { raio: 0.01 });
  });
  const { malha, colisores } = c.construir('estaleiro');
  if (malha) m.adicionar(malha, colisores);
}

function construirMonteOracao(m: Mundo) {
  const c = new Construtor(5);
  const [x, z] = NOE.monteOracao;
  c.em(x, base(m, x, z), z, 0, () => {
    // pedras planas onde Noé costuma orar
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      c.esfera(Math.cos(a) * 3.2, 0.1, Math.sin(a) * 3.2, 0.5, CORES.pedra, 1.5, 0.5, 1.2, 0);
    }
    c.esfera(0, 0.05, -1.2, 0.8, CORES.pedraEscura, 1.6, 0.35, 1.0, 0);
  });
  const { malha, colisores } = c.construir('monteOracao');
  if (malha) m.adicionar(malha, colisores);
}

function construirGruta(m: Mundo) {
  const c = new Construtor(17);
  const [x, z] = NOE.gruta;
  const y = base(m, x + 12, z + 16);
  c.em(x + 12, y, z + 16, 0.6, () => {
    // arco de pedra na entrada
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      c.esfera(Math.cos(a) * 3.4, Math.sin(a) * 3.4 + 0.5, 0, 1.3, i % 2 ? CORES.pedra : CORES.pedraEscura, 1, 1, 1.4, 0);
    }
    c.caixa(0, 0, -3, 6, 4.5, 6, '#2a2620', { raio: 0.8, ao: 0 });
    for (const s of [-1, 1]) c.colisor({ x: s * 3.4, z: -1.5, hx: 1.2, hz: 4, y0: -1, y1: 5, piso: false });
    c.colisor({ x: 0, z: -6.5, hx: 4, hz: 0.8, y0: -1, y1: 5, piso: false });
  });
  const { malha, colisores } = c.construir('gruta');
  if (malha) m.adicionar(malha, colisores);
  m.pontos.set('entradaGruta', [x + 12 + Math.sin(0.6) * 2, z + 16 + Math.cos(0.6) * 2]);
}

function construirVau(m: Mundo) {
  const c = new Construtor(3);
  const [vx, vz] = NOE.vau;
  for (let i = -4; i <= 4; i++) {
    const x = vx + i * 1.7;
    const z = vz + Math.sin(i) * 0.6;
    c.esfera(x, m.relevo.altura(x, z) + 0.2, z, 0.55, CORES.pedra, 1.3, 0.55, 1.1, 0);
  }
  const { malha } = c.construir('vau');
  if (malha) m.adicionar(malha);
}
