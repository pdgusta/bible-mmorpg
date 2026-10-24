import * as THREE from 'three';
import { Mundo } from '../../mundo/Mundo';
import { espalhar } from '../../mundo/Espalhar';
import type { Colisor } from '../../mundo/Colisao';
import { Construtor, CORES } from '../../entidades/Construtor';
import { distPolilinha } from '../../mundo/Relevo';
import { MAPA_NOE, NOE, CAMINHOS, RIO, CASAS_CIDADE, TORRE_CIDADE } from './mapa';
import { Arca, ARCA } from './Arca';
import { smoothstep, clamp, easeInOut } from '../../core/util';
import { Chuva } from '../../render/Chuva';
import { Ceu } from '../../render/Ceu';
import { GLOBAIS, aplicarPatch } from '../../render/Shaders';

export type EstadoVale = 'antes' | 'diluvio' | 'depois';

/** Árvores de gofer marcadas para corte (A1): ponto do mapa → posição do tronco. */
const GOFER: Record<string, [number, number]> = {
  arvoreGofer1: [-130.6, 35.5],
  arvoreGofer2: [-133.1, 27],
  arvoreGofer3: [-128.6, 42],
};
/** Árvores com fruta no alto (A4): tronco, pé da escada (ponto arvoreFrutaN) e plataforma (frutaN). */
const FRUTEIRAS: { tronco: [number, number]; base: string; topo: string; id: string }[] = [
  { tronco: [7.5, 114.2], base: 'arvoreFruta1', topo: 'fruta1', id: 'arvoreFruta1' },
  { tronco: [-10.4, 96.2], base: 'arvoreFruta2', topo: 'fruta2', id: 'arvoreFruta2' },
];
const ALTURA_PLATAFORMA_FRUTA = 3.4;

/**
 * Mundo da era de Noé com as peças que mudam ao longo da história:
 * - estados 'antes' | 'diluvio' | 'depois' (céu, chuva, água, lama, vegetação, cidade);
 * - a arca (estágios, porta, janela, interior), a obra da viga mestra e os pontos internos;
 * - pequenos objetos das missões (árvores marcadas, altar do platô).
 */
export class MundoNoe {
  readonly mundo: Mundo;
  readonly arca: Arca;
  readonly cidade = new THREE.Group();
  readonly ruinas = new THREE.Group();
  readonly chuva: Chuva;
  estado: EstadoVale = 'antes';
  interior = false;
  private vegetacao: 'antes' | 'depois' = 'antes';
  private trigal: THREE.InstancedMesh;
  private pecas: Record<string, { malha: THREE.Object3D | null; colisores: Colisor[] }> = {};
  private luzes: THREE.PointLight[] = [];
  private gofer = new Map<string, { indice: number; cortada: boolean }>();
  private marcas: THREE.Mesh | null = null;
  private tocos = new THREE.Group();
  private altar: { grupo: THREE.Group; pedras: THREE.Mesh[]; fogo: THREE.Group; colisor: Colisor | null; n: number; aceso: boolean } | null = null;
  private tempestadeAlvo: number | null = null;
  private animAgua: { de: number; para: number; dur: number; t: number; fim: () => void } | null = null;
  private alturaMaxTerreno = 0;
  private submerso = false;

  constructor(cenaNatureza: THREE.Object3D) {
    this.mundo = new Mundo(MAPA_NOE, cenaNatureza);
    const m = this.mundo;
    for (const v of m.relevo.alturas) if (v > this.alturaMaxTerreno) this.alturaMaxTerreno = v;
    definirVariantes(m);
    this.plantarAntes();
    this.trigal = criarTrigal(m);
    m.estruturas.add(this.trigal);
    this.pecas.casa = construirCasa(m);
    this.pecas.cidade = construirCidade(m, this.cidade);
    this.pecas.estaleiro = construirEstaleiro(m);
    this.pecas.bosque = construirPilhaBosque(m);
    this.pecas.monte = construirMonteOracao(m);
    this.pecas.gruta = construirGruta(m);
    this.pecas.vau = construirVau(m);
    this.pecas.fruteiras = construirFruteiras(m);
    this.marcas = construirMarcasGofer(m);
    m.estruturas.add(this.tocos);
    const [ex, ez] = NOE.estaleiro;
    this.arca = new Arca(m, ex, NOE.estaleiroAltura, ez);
    this.arca.definirEstagio(0);
    this.arca.aoMover = () => this.atualizarPontosArca();
    this.atualizarPontosArca();
    m.finalizar();
    // índices das árvores de gofer (para cortar)
    // chuva e luzes do interior
    this.chuva = new Chuva();
    m.grupo.add(this.chuva.malha);
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight('#ffb867', 0, 16, 1.6);
      l.visible = false;
      this.luzes.push(l);
      m.grupo.add(l);
    }
    m.aoAtualizar.add((dt, t, camera, foco) => this.atualizar(dt, t, camera, foco));
  }

  get vigaMestra() {
    return this.arca.vigaMestra;
  }

  /** Ponto dentro (ou junto) da arca, em 3D, onde quer que a arca esteja. Ver PONTOS_ARCA em Arca.ts. */
  pontoArca(nome: string): THREE.Vector3 {
    const p = this.arca.ponto(nome);
    if (!p) throw new Error(`Ponto da arca desconhecido: ${nome}`);
    return p;
  }

  /** Move a arca (flutuar com as águas, repousar no platô) mantendo os pontos do mapa em dia. */
  moverArca(x: number, y: number, z: number, yaw = this.arca.yaw) {
    this.arca.mover(x, y, z, yaw);
  }

  /** A arca repousa sobre o platô do monte (Gn 8:4). */
  repousarArca() {
    const r = NOE.arcaRepouso;
    this.arca.mover(r.x, r.y, r.z, r.yaw);
  }

  private atualizarPontosArca() {
    const pts = this.mundo.pontos;
    const p2 = (nome: string): [number, number] => {
      const v = this.arca.ponto(nome)!;
      return [v.x, v.z];
    };
    pts.set('portaArca', p2('saida'));
    pts.set('entregaArca', p2('saida'));
    pts.set('saidaArca', p2('saida'));
    pts.set('bomba', p2('bomba'));
    pts.set('janela', p2('janela'));
    for (const n of ['guincho', 'andaimeBase', 'andaimeTopo', 'ancoraCorda', 'encaixeViga1', 'encaixeViga2', 'quilha']) pts.set(n, p2(n));
    pts.set('andaime', p2('andaimeBase'));
    const o = this.arca.grupo.position;
    this.mundo.agua?.definirRecorte(o.x, o.z, ARCA.comprimento / 2 - 0.5, ARCA.largura / 2 - 0.2, this.arca.yaw);
  }

  // ------------------------------------------------------------------ estados

  /** Muda o vale: antes do dilúvio, durante (tempestade e chuva) ou depois (lama, ruínas, brotos). */
  definirEstado(e: EstadoVale) {
    const m = this.mundo;
    this.estado = e;
    const ceu = Ceu.atual;
    if (e === 'diluvio') {
      this.tempestadeAlvo = 1;
      this.chuva.definir(1, 6);
      m.agua?.definirTurbidez(0.65, 2.2);
      GLOBAIS.uVento.value = 2.4;
      if (this.vegetacao !== 'antes') this.plantarAntes(true);
      this.mostrarAntes(true);
      m.terreno.uniforms.uLama.value = 0;
    } else {
      this.tempestadeAlvo = 0;
      this.chuva.definir(0, e === 'depois' ? 0.01 : 3);
      GLOBAIS.uVento.value = 1;
      this.animAgua?.fim();
      this.animAgua = null;
      this.aplicarNivel(NOE.nivelAgua);
      if (e === 'antes') {
        m.agua?.definirTurbidez(0, 1);
        if (this.vegetacao !== 'antes') this.plantarAntes(true);
        this.mostrarAntes(true);
        m.terreno.uniforms.uLama.value = 0;
        m.grama.definirPerfil({ densidade: MAPA_NOE.densidadeGrama, altura: 1 });
      } else {
        m.agua?.definirTurbidez(0.45, 0.8);
        if (this.vegetacao !== 'depois') this.plantarDepois();
        this.mostrarAntes(false);
        m.terreno.uniforms.uLama.value = 1;
        if (ceu) ceu.tempestade = 0;
        this.tempestadeAlvo = null;
      }
    }
  }

  /** Sobe/desce a água do vale até `nivel` (m) em `segundos`. Só mexe na água (malha e física). */
  animarAgua(nivel: number, segundos: number): Promise<void> {
    this.animAgua?.fim();
    const de = this.mundo.agua?.nivel ?? NOE.nivelAgua;
    if (segundos <= 0) {
      this.aplicarNivel(nivel);
      this.animAgua = null;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.animAgua = { de, para: nivel, dur: segundos, t: 0, fim: resolve };
    });
  }

  get nivelAgua() {
    return this.mundo.agua?.nivel ?? NOE.nivelAgua;
  }

  private aplicarNivel(n: number) {
    const m = this.mundo;
    m.agua?.definirNivel(n);
    m.fisica.nivelAgua = n;
    m.grama.nivelAgua = n;
  }

  /** Modo de interior (dentro da arca): luz morna das lanternas, neblina curta, chuva escondida. */
  definirInterior(ativo: boolean) {
    this.interior = ativo;
    Ceu.atual?.definirInterior(ativo);
    this.arca.atualizarInteriorVisivel(ativo);
    for (const l of this.luzes) l.visible = ativo;
  }

  // ------------------------------------------------------------------ objetos das missões (repasses)

  definirAguaInterna(nivel: number) {
    this.arca.definirAguaInterna(nivel);
  }

  definirCaixasSoltas(ativas: boolean) {
    this.arca.definirCaixasSoltas(ativas);
  }

  definirVazamento(n: number, ativo: boolean) {
    this.arca.definirVazamento(n, ativo);
  }

  definirRede(n: number, presa: boolean) {
    this.arca.definirRede(n, presa);
  }

  /** Corta uma árvore de gofer marcada ('arvoreGofer1'..'3'): some a árvore e fica o toco. */
  cortarArvore(id: string) {
    const g = this.gofer.get(id);
    if (!g || g.cortada) return;
    g.cortada = true;
    const [x, z] = GOFER[id];
    const m = this.mundo;
    m.natureza.ocultar('cipreste', g.indice, true);
    for (const c of m.colisoes.perto(x, z, 0.5)) if (c.tag === 'arvore' && Math.hypot(c.x - x, c.z - z) < 0.3) m.colisoes.remover(c);
    const k = new Construtor(hashId(id));
    const y = m.relevo.altura(x, z);
    k.cilindro(x, y - 0.1, z, 0.36, 0.42, 0.55, CORES.madeira, 9);
    k.cilindro(x, y + 0.44, z, 0.33, 0.33, 0.02, CORES.madeiraClara, 9, { ao: 0 });
    const toco = k.construir('toco').malha;
    if (toco) {
      aplicarPatch(toco.material as THREE.Material, { revelar: true });
      this.tocos.add(toco);
    }
    this.atualizarMarcas();
  }

  arvoreCortada(id: string) {
    return this.gofer.get(id)?.cortada ?? false;
  }

  /** Altar no platô (A6): `pedras` 0..6 empilhadas; `fogo` acende chama e fumaça. */
  definirAltar(pedras: number, fogo: boolean) {
    if (!this.altar) this.altar = criarAltar(this.mundo);
    const a = this.altar;
    a.n = clamp(Math.round(pedras), 0, 6);
    a.aceso = fogo && a.n > 0;
    a.pedras.forEach((p, i) => (p.visible = i < a.n));
    a.fogo.visible = a.aceso;
    a.grupo.visible = a.n > 0 || a.aceso;
    if (a.colisor) {
      this.mundo.colisoes.remover(a.colisor);
      a.colisor = null;
    }
    if (a.n >= 3) {
      const [x, z] = this.mundo.ponto('altarPlato');
      const y = this.mundo.relevo.altura(x, z);
      a.colisor = this.mundo.colisoes.adicionar({ tipo: 'cilindro', x, z: z - 1.6, r: 0.95, y0: y - 1, y1: y + 0.2 + a.n * 0.17, piso: true, tag: 'altar' });
    }
  }

  // ------------------------------------------------------------------ quadro a quadro

  private atualizar(dt: number, t: number, camera: THREE.Camera, foco: THREE.Vector3) {
    const ceu = Ceu.atual;
    if (ceu && this.tempestadeAlvo !== null) {
      const d = this.tempestadeAlvo - ceu.tempestade;
      if (Math.abs(d) < 0.002) {
        ceu.tempestade = this.tempestadeAlvo;
        this.tempestadeAlvo = null;
      } else ceu.tempestade += Math.sign(d) * Math.min(Math.abs(d), dt / 6);
    }
    if (this.animAgua) {
      const a = this.animAgua;
      a.t += dt;
      const k = easeInOut(clamp(a.t / a.dur, 0, 1));
      this.aplicarNivel(a.de + (a.para - a.de) * k);
      if (a.t >= a.dur) {
        this.animAgua = null;
        a.fim();
      }
    }
    // chuva (escondida dentro da arca) e chão molhado
    const corLuz = ceu?.hemi.color;
    this.chuva.atualizar(dt, camera, corLuz);
    if (this.interior) this.chuva.malha.visible = false;
    this.mundo.terreno.uniforms.uMolhado.value = this.chuva.intensidade;
    // com o vale todo coberto pelas águas, nada fora da arca precisa ser desenhado
    const submerso = this.estado === 'diluvio' && this.nivelAgua > this.alturaMaxTerreno - 0.5;
    if (submerso !== this.submerso) {
      this.submerso = submerso;
      const m = this.mundo;
      m.terreno.grupo.visible = !submerso;
      m.natureza.grupo.visible = !submerso;
      m.grama.malha.visible = !submerso;
      for (const o of m.estruturas.children) if (o !== this.arca.grupo) o.visible = !submerso && this.visivelNoEstado(o);
    }
    // luzes das lanternas mais próximas do foco
    if (this.interior) {
      const ki = ceu ? ceu.interior : 1;
      const lista = this.arca.lanternas
        .map((l) => this.arca.mundoDe(l.x, l.y, l.z))
        .sort((a, b) => a.distanceToSquared(foco) - b.distanceToSquared(foco));
      this.luzes.forEach((luz, i) => {
        const p = lista[i];
        if (!p) return;
        luz.position.copy(p).y -= 0.35;
        luz.intensity = (14 + Math.sin(t * 7 + i * 2) * 0.8 + Math.sin(t * 13.1 + i) * 0.5) * ki;
      });
    }
    // fogo do altar
    if (this.altar?.aceso) animarFogo(this.altar.fogo, t);
  }

  // ------------------------------------------------------------------ vegetação e peças de cada estado

  private visivelNoEstado(o: THREE.Object3D) {
    if (o === this.ruinas) return this.vegetacao === 'depois';
    if (o === this.trigal || o === this.cidade || o === this.marcasObj() || o === this.tocos) return this.vegetacao === 'antes';
    const nome = o.name;
    if (['casaNoe', 'estaleiro', 'pilhaBosque', 'fruteiras'].includes(nome)) return this.vegetacao === 'antes';
    return true;
  }

  private marcasObj() {
    return this.marcas;
  }

  /** Mostra as peças de antes do dilúvio (ou as ruínas de depois), trocando os colisores. */
  private mostrarAntes(antes: boolean) {
    const m = this.mundo;
    for (const nome of ['casa', 'cidade', 'estaleiro', 'bosque', 'fruteiras']) {
      const p = this.pecas[nome];
      if (!p) continue;
      if (p.malha) p.malha.visible = antes;
      for (const c of p.colisores) c.ativo = antes;
    }
    this.cidade.visible = antes;
    this.trigal.visible = antes;
    this.tocos.visible = antes;
    if (this.marcas) this.marcas.visible = antes;
    for (const f of FRUTEIRAS) {
      const e = m.escaladas.get(f.id);
      if (e) e.ativa = antes;
    }
    if (!antes && !this.ruinas.parent) {
      this.pecas.ruinas = construirRuinas(m, this.ruinas);
    }
    this.ruinas.visible = !antes;
    for (const c of this.pecas.ruinas?.colisores ?? []) c.ativo = !antes;
    m.nav?.reconstruir();
  }

  private plantarAntes(reconstruir = false) {
    const m = this.mundo;
    if (reconstruir) m.natureza.limpar();
    vegetacaoAntes(m);
    this.gofer.clear();
    for (const [id, [x, z]] of Object.entries(GOFER)) {
      const idx = m.natureza.adicionar('cipreste', x, m.relevo.altura(x, z) - 0.1, z, hashId(id) % 6, 1.35);
      m.natureza.definirModelo('cipreste', idx, 0);
      this.gofer.set(id, { indice: idx, cortada: false });
    }
    for (const f of FRUTEIRAS) {
      const [x, z] = f.tronco;
      const idx = m.natureza.adicionar('arvore', x, m.relevo.altura(x, z) - 0.1, z, 0.4, 1.15);
      m.natureza.definirModelo('arvore', idx, 2);
    }
    this.tocos.clear();
    this.vegetacao = 'antes';
    if (reconstruir) {
      m.natureza.construir();
      m.colisoesArvores();
      m.grama.definirPerfil({ densidade: MAPA_NOE.densidadeGrama, altura: 1 });
      this.atualizarMarcas();
    }
  }

  private plantarDepois() {
    const m = this.mundo;
    m.natureza.limpar();
    vegetacaoDepois(m);
    this.vegetacao = 'depois';
    m.natureza.construir();
    m.colisoesArvores();
    const verde = new THREE.Color('#9fd060');
    m.grama.definirPerfil({
      densidade: (x, z) => MAPA_NOE.densidadeGrama(x, z) * 0.42,
      altura: 0.5,
      cor: (x, z, out) => {
        m.terreno.corEm(x, z, out).lerp(verde, 0.75);
      },
    });
  }

  private atualizarMarcas() {
    // as marcas (faixas vermelhas) somem das árvores já cortadas: refaz a malha
    if (this.marcas) {
      this.marcas.parent?.remove(this.marcas);
      this.marcas.geometry.dispose();
    }
    const cortadas = new Set([...this.gofer.entries()].filter(([, g]) => g.cortada).map(([id]) => id));
    this.marcas = construirMarcasGofer(this.mundo, cortadas);
  }
}

function hashId(s: string) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ====================================================================== vegetação

function definirVariantes(m: Mundo) {
  const n = m.natureza;
  // madeira de gofer: tradicionalmente identificada com o cipreste (NVT)
  n.definirVariante('cipreste', { modelos: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'], tintFolha: '#9cc08a', vento: 0.1, raioTronco: 0.35, alcancePerto: 40, fracaoLonge: 0.28 });
  n.definirVariante('arvore', { modelos: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'], tintFolha: '#d8f0a0', vento: 0.14, raioTronco: 0.4, alcancePerto: 45, fracaoLonge: 0.3 });
  n.definirVariante('oliveira', { modelos: ['TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3', 'TwistedTree_4', 'TwistedTree_5'], tintFolha: '#b8c8a0', tintTronco: '#c8b8a0', vento: 0.1, raioTronco: 1.0, alcancePerto: 38, fracaoLonge: 0.25, reduzirTronco: 0.35 });
  n.definirVariante('arbusto', { modelos: ['Bush_Common', 'Bush_Common_Flowers'], tintFolha: '#d0e8a0', vento: 0.08, alcance: 110, alcancePerto: 35 });
  n.definirVariante('pedra', { modelos: ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'], vento: 0, raioTronco: 1.0, alcance: 200, alcancePerto: 45 });
  n.definirVariante('seixo', { modelos: ['Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2'], vento: 0, alcance: 55, alcancePerto: 55, sombra: false });
  n.definirVariante('flores', { modelos: ['Flower_3_Group', 'Flower_3_Single', 'Clover_1', 'Plant_1'], vento: 0.12, alcance: 50, alcancePerto: 50, sombra: false });
  n.definirVariante('samambaia', { modelos: ['Fern_1', 'Plant_7'], tintFolha: '#c8e0a0', vento: 0.1, alcance: 60, alcancePerto: 60, sombra: false });
  n.definirVariante('capim', { modelos: ['Grass_Common_Tall', 'Grass_Wispy_Short'], tintFolha: '#e8e0a0', vento: 0.2, alcance: 50, alcancePerto: 50, sombra: false });
}

/** Variantes que só aparecem depois do dilúvio (definidas sob demanda). */
function definirVariantesDepois(m: Mundo) {
  const n = m.natureza;
  n.definirVariante('arvoreSeca', { modelos: ['DeadTree_1', 'DeadTree_2', 'DeadTree_3'], tintTronco: '#9a8a78', vento: 0.02, raioTronco: 0.4, alcancePerto: 40, reduzirTronco: 0.25 });
  n.definirVariante('arvoreCaida', { modelos: ['DeadTree_1', 'DeadTree_2', 'DeadTree_3'], tintTronco: '#7a6a58', vento: 0, alcance: 140, alcancePerto: 35, reduzirTronco: 0.25 });
  n.definirVariante('broto', { modelos: ['Plant_1', 'Clover_1', 'Grass_Common_Short'], tintFolha: '#b8f088', vento: 0.12, alcance: 45, alcancePerto: 45, sombra: false });
  n.definirVariante('oliveiraNova', { modelos: ['TwistedTree_2', 'TwistedTree_4'], tintFolha: '#c8e0a0', tintTronco: '#c8b8a0', vento: 0.12, alcance: 120, alcancePerto: 30, fracaoLonge: 0.3, reduzirTronco: 0.35 });
}

/** Zonas livres de vegetação: estruturas, caminhos, rio, pontos das missões. */
function livre(x: number, z: number): number {
  const [ex, ez] = NOE.estaleiro;
  if (Math.abs(x - ex) < 95 && Math.abs(z - ez) < 32) return 0;
  if (Math.hypot(x - NOE.cidade[0], z - NOE.cidade[1]) < 52) return 0;
  if (Math.hypot(x - NOE.casa[0], z - NOE.casa[1]) < 16) return 0;
  if (Math.hypot(x - NOE.monteOracao[0], z - NOE.monteOracao[1]) < 9) return 0;
  if (Math.hypot(x - NOE.gruta[0], z - NOE.gruta[1]) < 15) return 0;
  const dxp = Math.max(0, Math.abs(x - NOE.plato[0]) - NOE.platoMeio[0] - 2);
  const dzp = Math.max(0, Math.abs(z - NOE.plato[1]) - NOE.platoMeio[1] - 2);
  if (Math.hypot(dxp, dzp) < 2) return 0;
  for (const c of CAMINHOS) if (distPolilinha(x, z, c).d < 3.5) return 0;
  for (const [px, pz] of RESERVADOS) if (Math.hypot(x - px, z - pz) < 5) return 0;
  return 1;
}

const RESERVADOS: [number, number][] = [
  ...Object.values(GOFER),
  ...FRUTEIRAS.map((f) => f.tronco),
  [-119.5, 27.5], [-126, 31], // pilha do bosque, lugar do corte
  [24.5, 74], [22.8, 65], // poço e pedra de Lameque
];

/** Árvores, arbustos e flores plantados à mão em volta da casa (sombra e vida no terreiro). */
const JARDIM_CASA: [string, number, number, number, number][] = [
  ['arvore', 24, 61.5, 1.25, 1],
  ['arvore', 59, 57, 1.05, 3],
  ['arvore', 69, 72, 1.15, 0],
  ['arvore', 15, 80, 1.0, 4],
  ['oliveira', 51, 93, 0.36, 1],
  ['oliveira', 30, 95, 0.33, 3],
  ['arvore', 63, 90, 0.95, 2],
  ['arbusto', 34.5, 66.8, 1.1, 0],
  ['arbusto', 46.5, 67.3, 0.9, 1],
  ['arbusto', 30.6, 73, 1.2, 1],
  ['arbusto', 27, 80, 1.0, 0],
  ['arbusto', 53, 76, 0.9, 1],
  ['arbusto', 47, 85, 1.1, 0],
];

function vegetacaoAntes(m: Mundo) {
  const r = m.ruido;
  // bosque de gofer a oeste
  espalhar(m, 'cipreste', {
    espacamento: 6.0, escala: [0.95, 1.6], inclinacaoMax: 0.35,
    densidade: (x, z) => livre(x, z) * smoothstep(-95, -128, x) * (0.75 + r.ruido(x * 0.02, z * 0.02) * 0.25),
  });
  // ciprestes esparsos nas encostas baixas das montanhas (quebram a silhueta do horizonte)
  espalhar(m, 'cipreste', {
    espacamento: 16, escala: [1.0, 1.5], inclinacaoMax: 0.32, semente: 4411,
    densidade: (x, z) => {
      const h = m.relevo.altura(x, z);
      return livre(x, z) * smoothstep(8, 16, h) * (1 - smoothstep(30, 44, h)) * 0.45;
    },
  });
  // árvores espalhadas pelo vale
  espalhar(m, 'arvore', {
    espacamento: 12, escala: [0.8, 1.25], inclinacaoMax: 0.3,
    densidade: (x, z) => livre(x, z) * (x > -100 ? 1 : 0) * smoothstep(0.05, 0.45, r.fbm(x * 0.012 + 3, z * 0.012, 2) + 0.35) * 0.6,
  });
  // pomar de oliveiras junto da casa
  espalhar(m, 'oliveira', {
    espacamento: 7, escala: [0.32, 0.42], x0: 2, x1: 34, z0: 82, z1: 110,
    densidade: (x, z) => livre(x, z) * 0.9,
  });
  espalhar(m, 'oliveira', { espacamento: 22, escala: [0.3, 0.42], densidade: (x, z) => livre(x, z) * (x > -90 && x < 130 ? 0.12 : 0), semente: 99 });
  espalhar(m, 'arbusto', { espacamento: 7, escala: [0.6, 1.3], inclinacaoMax: 0.4, densidade: (x, z) => livre(x, z) * (0.25 + r.fbm(x * 0.03, z * 0.03, 2) * 0.3) });
  espalhar(m, 'pedra', { espacamento: 9, escala: [0.5, 1.6], afundar: 0.4, densidade: (x, z) => livre(x, z) * (0.06 + smoothstep(14, 40, m.relevo.altura(x, z)) * 0.5 + smoothstep(0.15, 0.35, m.relevo.inclinacao(x, z)) * 0.4) });
  espalhar(m, 'flores', { espacamento: 3.4, escala: [0.7, 1.3], inclinacaoMax: 0.3, densidade: (x, z) => livre(x, z) * (z > 60 || x < -100 ? 0.42 : 0.16) * (m.relevo.altura(x, z) < 16 ? 1 : 0.2) });
  espalhar(m, 'samambaia', { espacamento: 4, escala: [0.6, 1.0], densidade: (x, z) => livre(x, z) * smoothstep(-100, -130, x) * 0.5 });
  espalhar(m, 'capim', { espacamento: 3.6, escala: [0.6, 1.1], densidade: (x, z) => livre(x, z) * 0.16 });
  // seixos na margem do rio
  espalhar(m, 'seixo', {
    espacamento: 2.5, escala: [0.6, 1.4], evitarAgua: false, afundar: 0.05,
    densidade: (x, z) => {
      const d = distPolilinha(x, z, RIO).d;
      return d > 6 && d < 12 ? 0.5 : 0;
    },
  });
  for (const [v, x, z, s, mod] of JARDIM_CASA) {
    const idx = m.natureza.adicionar(v, x, m.relevo.altura(x, z) - 0.1, z, (x * 7 + z) % 6.28, s);
    m.natureza.definirModelo(v, idx, mod);
  }
  // flores junto à porta e ao poço
  for (const [x, z] of [[37.5, 76.2], [44, 76.4], [26.5, 72.5], [23, 77.5], [21.5, 66.5]] as const) {
    m.natureza.adicionar('flores', x, m.relevo.altura(x, z), z, x, 1.1, m.aleatorio);
  }
}

function vegetacaoDepois(m: Mundo) {
  definirVariantesDepois(m);
  const r = m.ruido;
  // mesmas pedras e seixos (sementes determinísticas)
  espalhar(m, 'pedra', { espacamento: 9, escala: [0.5, 1.6], afundar: 0.4, densidade: (x, z) => livre(x, z) * (0.06 + smoothstep(14, 40, m.relevo.altura(x, z)) * 0.5 + smoothstep(0.15, 0.35, m.relevo.inclinacao(x, z)) * 0.4) });
  espalhar(m, 'seixo', {
    espacamento: 2.5, escala: [0.6, 1.4], evitarAgua: false, afundar: 0.05,
    densidade: (x, z) => {
      const d = distPolilinha(x, z, RIO).d;
      return d > 6 && d < 12 ? 0.5 : 0;
    },
  });
  // árvores mortas de pé e caídas
  espalhar(m, 'arvoreSeca', {
    espacamento: 20, escala: [0.7, 1.1], inclinacaoMax: 0.3, semente: 808,
    densidade: (x, z) => livre(x, z) * (0.3 + smoothstep(-95, -128, x) * 0.5) * smoothstep(-0.2, 0.3, r.fbm(x * 0.012 + 3, z * 0.012, 2) + 0.2),
  });
  const rr = m.aleatorio;
  let n = 0;
  espalharCaidas: for (let i = 0; i < 400 && n < 70; i++) {
    const x = rr.entre(-200, 200);
    const z = rr.entre(-140, 200);
    if (!livre(x, z) || m.fisica.profundidade(x, z) > -0.3 || m.relevo.inclinacao(x, z) > 0.25) continue espalharCaidas;
    m.natureza.adicionar('arvoreCaida', x, m.relevo.altura(x, z) - 0.15, z, rr.entre(0, 6.28), rr.entre(0.6, 0.95), rr, 1.48);
    n++;
  }
  // brotos novos
  espalhar(m, 'broto', { espacamento: 3.2, escala: [0.5, 0.9], inclinacaoMax: 0.35, semente: 909, densidade: (x, z) => livre(x, z) * 0.35 * (m.relevo.altura(x, z) < 20 ? 1 : 0.3) });
  // oliveiras novas (Gn 8:11) ao pé do monte
  for (const [x, z] of [[-60, -110], [-18, -96], [12, -120], [-82, -126], [-34, -70]] as const) {
    m.natureza.adicionar('oliveiraNova', x, m.relevo.altura(x, z) - 0.05, z, x * 0.37, 0.16, rr);
  }
  // "Semeadura e colheita" (segredo): um canteiro de brotos no antigo trigal
  for (let i = 0; i < 26; i++) {
    const x = 60 + (i % 6) * 1.3 + Math.sin(i) * 0.3;
    const z = 101 + Math.floor(i / 6) * 1.4;
    m.natureza.adicionar('broto', x, m.relevo.altura(x, z), z, i, 0.8, rr);
  }
}

// ====================================================================== estruturas

type Peca = { malha: THREE.Object3D | null; colisores: Colisor[] };

function base(m: Mundo, x: number, z: number) {
  return m.relevo.altura(x, z);
}

function finalizarPeca(m: Mundo, c: Construtor, nome: string): Peca {
  const { malha, colisores } = c.construir(nome);
  if (!malha) return { malha: null, colisores: [] };
  return { malha, colisores: m.adicionar(malha, colisores) };
}

function construirCasa(m: Mundo): Peca {
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
    // banco e toldo junto à porta
    c.caixa(-2.6, 0, 4.2, 1.8, 0.45, 0.5, CORES.madeiraClara, { raio: 0.04 });
    for (const sx of [-1, 1]) c.cilindro(-1.2 + sx * 1.4, 0, 5.4, 0.06, 0.07, 2.4, CORES.madeira, 6);
    c.caixa(-1.2, 2.35, 4.4, 3.4, 0.06, 2.2, '#c8a87a', { raio: 0.02, rx: 0.18, ao: 0 });
  });
  // poço da família
  c.em(24.5, base(m, 24.5, 74), 74, 0.3, () => c.poco());
  // pedra com o nome de Lameque (segredo)
  c.em(22.8, base(m, 22.8, 65), 65, -0.4, () => {
    c.caixa(0, -0.2, 0, 0.75, 1.35, 0.32, CORES.pedra, { raio: 0.12 });
    for (let i = 0; i < 4; i++) c.caixa(-0.18 + (i % 2) * 0.3, 0.55 + Math.floor(i / 2) * 0.28, 0.165, 0.18, 0.05, 0.02, CORES.pedraEscura, { raio: 0, ao: 0 });
    c.colisor({ x: 0, z: 0, hx: 0.4, hz: 0.2, y0: -1, y1: 1.1, piso: false });
  });
  return finalizarPeca(m, c, 'casaNoe');
}

function construirCidade(m: Mundo, grupo: THREE.Group): Peca {
  const c = new Construtor(613);
  const [cx, cz] = NOE.cidade;
  const y = base(m, cx, cz);
  c.em(cx, y, cz, 0, () => {
    CASAS_CIDADE.forEach(([x, z, yaw, w, d, h], i) => {
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
    c.em(TORRE_CIDADE[0], 0, TORRE_CIDADE[1], 0, () => {
      c.caixa(0, 0, 0, 12, 4, 12, CORES.barroEscuro, { raio: 0.2 });
      c.caixa(0, 4, 0, 9, 4, 9, CORES.barro, { raio: 0.2 });
      c.caixa(0, 8, 0, 6, 4, 6, CORES.barroClaro, { raio: 0.2 });
      c.caixa(0, 12, 0, 3.5, 2.5, 3.5, CORES.barro, { raio: 0.2 });
      c.colisor({ x: 0, z: 0, hx: 6.2, hz: 6.2, y0: -1, y1: 15, piso: false });
    });
    for (let i = 0; i < 9; i++) c.jarro(-4 + (i % 3) * 0.7, 14 + Math.floor(i / 3) * 0.7, 1.1);
  });
  const { malha, colisores } = c.construir('cidade');
  if (!malha) return { malha: null, colisores: [] };
  grupo.add(malha);
  return { malha: grupo, colisores: m.adicionar(grupo, colisores) };
}

/** Depois do dilúvio: montes de barro e ruínas baixas no lugar da cidade e da casa (sem corpos). */
function construirRuinas(m: Mundo, grupo: THREE.Group): Peca {
  const c = new Construtor(714);
  const [cx, cz] = NOE.cidade;
  const y = base(m, cx, cz);
  const barro = ['#8a6a4a', '#7a5c40', '#9a7a56'];
  c.em(cx, y, cz, 0, () => {
    CASAS_CIDADE.forEach(([x, z, yaw, w, d], i) => {
      c.em(x, 0, z, yaw, () => {
        // tocos de parede de alturas diferentes
        const h = 0.4 + ((i * 37) % 5) * 0.18;
        for (const s of [-1, 1]) {
          c.caixa(s * (w / 2 - 0.2), -0.1, 0, 0.4, h * (0.6 + 0.4 * ((i + s) % 2)), d * 0.8, barro[i % 3], { raio: 0.12, variacao: 0.1 });
          c.caixa(0, -0.1, s * (d / 2 - 0.2), w * 0.7, h * 0.7, 0.4, barro[(i + 1) % 3], { raio: 0.12, variacao: 0.1 });
        }
        c.esfera(0, -0.2, 0, Math.min(w, d) * 0.45, barro[(i + 2) % 3], 1.1, 0.32, 0.9, 1);
        c.colisor({ x: 0, z: 0, hx: w / 2, hz: d / 2, y0: -1, y1: h, piso: true });
      });
    });
    // montes de barro e a base desfeita da torre
    c.em(TORRE_CIDADE[0], 0, TORRE_CIDADE[1], 0, () => {
      c.caixa(0, -0.3, 0, 11, 1.6, 11, '#7a5c40', { raio: 0.5, variacao: 0.1 });
      c.esfera(2, 1.0, -1, 3.2, '#8a6a4a', 1.2, 0.5, 1, 1);
      c.colisor({ x: 0, z: 0, hx: 5.6, hz: 5.6, y0: -1, y1: 1.3, piso: true });
    });
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39;
      const r = 6 + (i * 13) % 30;
      c.esfera(Math.cos(a) * r, -0.3, Math.sin(a) * r, 1.4 + (i % 4) * 0.5, barro[i % 3], 1.3, 0.38, 1.1, 1);
    }
  });
  // a casa de Noé também ficou para trás
  const [hx, hz] = NOE.casa;
  c.em(hx, base(m, hx, hz), hz, 0.15, () => {
    for (const s of [-1, 1]) {
      c.caixa(s * 3.8, -0.1, 0, 0.4, 0.9, 5.4, barro[1], { raio: 0.12 });
      c.caixa(0, -0.1, s * 2.8, 7, s > 0 ? 0.5 : 1.1, 0.4, barro[0], { raio: 0.12 });
    }
    c.esfera(0, -0.2, 0, 2.6, barro[2], 1.2, 0.3, 0.9, 1);
    c.colisor({ x: 0, z: 0, hx: 4, hz: 3, y0: -1, y1: 0.8, piso: true });
  });
  const { malha, colisores } = c.construir('ruinas');
  if (!malha) return { malha: null, colisores: [] };
  grupo.add(malha);
  grupo.name = 'ruinas';
  return { malha: grupo, colisores: m.adicionar(grupo, colisores) };
}

function construirEstaleiro(m: Mundo): Peca {
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
    // telheiro de descanso (sombra) com jarros de água
    c.em(68, 0, 24, -0.3, () => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.cilindro(sx * 2, 0, sz * 1.5, 0.08, 0.1, 2.6, CORES.madeira, 6);
      c.caixa(0, 2.55, 0, 4.8, 0.08, 3.8, '#c8a87a', { raio: 0.02, rx: 0.1, ao: 0 });
      for (let i = 0; i < 3; i++) c.jarro(-1 + i * 0.7, 1.1, 1.1);
      c.caixa(0, 0, -0.6, 2.4, 0.42, 0.5, CORES.madeiraClara, { raio: 0.04 });
    });
  });
  return finalizarPeca(m, c, 'estaleiro');
}

/** Pilha de troncos na borda do bosque (A1): onde Cam junta o que cortou. */
function construirPilhaBosque(m: Mundo): Peca {
  const c = new Construtor(88);
  const [x, z] = [-117.6, 27.2];
  c.em(x, base(m, x, z), z, 1.35, () => {
    c.pilhaTroncos(3.6, 3);
    c.em(1.8, 0, 2.5, 0.6, () => {
      c.cilindro(0, 0, 0, 0.42, 0.45, 0.55, CORES.madeira, 9);
      c.cilindro(0, 0.55, 0, 0.4, 0.4, 0.02, CORES.madeiraClara, 9, { ao: 0 });
      c.colisor({ tipo: 'cilindro', x: 0, z: 0, r: 0.45, y0: -1, y1: 0.55, piso: true });
    });
  });
  return finalizarPeca(m, c, 'pilhaBosque');
}

/** Faixas vermelhas nas árvores de gofer marcadas para corte. */
function construirMarcasGofer(m: Mundo, cortadas = new Set<string>()): THREE.Mesh | null {
  const c = new Construtor(89);
  for (const [id, [x, z]] of Object.entries(GOFER)) {
    if (cortadas.has(id)) continue;
    const y = base(m, x, z);
    c.cilindro(x, y + 1.3, z, 0.47, 0.49, 0.22, '#b8402e', 10, { ao: 0 });
    c.caixa(x + 0.45, y + 1.0, z, 0.06, 0.4, 0.14, '#b8402e', { raio: 0, ao: 0 });
  }
  const { malha } = c.construir('marcasGofer');
  if (malha) m.adicionar(malha);
  return malha;
}

/** Escadas e plataformas nas árvores com fruta (A4). */
function construirFruteiras(m: Mundo): Peca {
  const c = new Construtor(90);
  for (const f of FRUTEIRAS) {
    const [tx, tz] = f.tronco;
    const [bx, bz] = m.ponto(f.base);
    const y = base(m, tx, tz);
    const ya = ALTURA_PLATAFORMA_FRUTA;
    c.em(tx, y, tz, 0, () => {
      // plataforma de tábuas na forquilha, do lado +z do tronco
      c.caixa(0, ya - 0.12, 1.4, 1.8, 0.12, 1.7, CORES.madeiraClara, { raio: 0.02 });
      for (const s of [-1, 1]) c.viga(new THREE.Vector3(s * 0.8, ya - 0.1, 2.2), new THREE.Vector3(s * 0.25, ya - 1.6, 0.4), 0.05, CORES.madeira, 5);
      // cesto de frutas
      c.cilindro(-0.45, ya, 1.0, 0.32, 0.25, 0.32, '#b8935a', 9);
      for (let i = 0; i < 5; i++) c.esfera(-0.45 + Math.cos(i * 1.3) * 0.15, ya + 0.36, 1.0 + Math.sin(i * 1.3) * 0.15, 0.1, i % 2 ? '#c8402e' : '#e09a30', 1, 1, 1, 0);
      c.colisor({ x: 0, z: 1.4, hx: 0.9, hz: 0.85, y0: ya - 0.12, y1: ya, piso: true, solido: false });
    });
    c.em(bx, base(m, bx, bz), bz, 0, () => {
      // escada encostada na plataforma (inclina para -z, rumo ao tronco)
      const h = y + ya - base(m, bx, bz) + 0.7;
      for (const s of [-1, 1]) c.viga(new THREE.Vector3(s * 0.28, 0, 0.3), new THREE.Vector3(s * 0.28, h, -1.2), 0.04, CORES.madeira, 5);
      for (let k = 0.3; k < h - 0.1; k += 0.35) {
        const t = k / h;
        c.viga(new THREE.Vector3(-0.28, k, 0.3 - 1.5 * t), new THREE.Vector3(0.28, k, 0.3 - 1.5 * t), 0.03, CORES.madeiraClara, 4);
      }
    });
    m.escaladas.set(f.id, {
      id: f.id,
      base: new THREE.Vector3(bx, base(m, bx, bz), bz),
      topo: new THREE.Vector3(tx, y + ya, tz + 1.6),
      yaw: Math.PI,
      largura: 0.8,
      ativa: true,
    });
  }
  return finalizarPeca(m, c, 'fruteiras');
}

function construirMonteOracao(m: Mundo): Peca {
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
  return finalizarPeca(m, c, 'monteOracao');
}

/**
 * Gruta: câmara de pedra escavada na encosta (um nicho plano no relevo), com casca interna
 * voltada para dentro, boca em arco virada para o vale e a pedra memorial de Enoque.
 */
function construirGruta(m: Mundo): Peca {
  const c = new Construtor(17);
  const [gx, gz] = NOE.gruta;
  const [dx, dz] = NOE.grutaDir;
  const y = base(m, gx, gz);
  const yaw = Math.atan2(dx, dz); // +z local aponta para a boca
  const R = 6.2;
  const vao = 0.42; // meia-abertura angular da boca (rad)
  c.em(gx, y, gz, yaw, () => {
    // casca interna (cúpula invertida, com a boca recortada)
    const casca = cupulaInterna(R, vao);
    c.peca(casca, '#4a4038', 0, 0, 0, 0, 0, 0, 1, 1, 1, { ao: 0.35, variacao: 0 });
    // rochas por fora: anel e teto
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < vao + 0.12) continue; // a boca fica em a=0 (+z)
      const r = R + 0.9;
      c.esfera(Math.sin(a) * r, 1.2, Math.cos(a) * r, 2.0, i % 2 ? CORES.pedra : CORES.pedraEscura, 1.0, 1.3, 1.0, 1);
      const p0 = { x: Math.sin(a) * (R + 0.4), z: Math.cos(a) * (R + 0.4) };
      c.colisor({ x: p0.x, z: p0.z, hx: 1.8, hz: 0.6, yaw: a, y0: -1, y1: 5, piso: false });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      c.esfera(Math.sin(a) * 2.6, R * 0.82, Math.cos(a) * 2.6 - 0.5, 2.6, i % 2 ? CORES.pedraEscura : CORES.pedra, 1.2, 0.7, 1.2, 1);
    }
    // arco da boca
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      c.esfera(Math.cos(a) * 3.0, Math.sin(a) * 3.3 + 0.3, R - 0.2, 1.05, i % 2 ? CORES.pedra : CORES.pedraEscura, 1, 1, 1.3, 0);
    }
    // pedra memorial de Enoque (segredo), junto à parede
    c.em(3.6, 0, -1.4, -1.2, () => {
      c.caixa(0, -0.2, 0, 0.7, 1.5, 0.3, CORES.pedra, { raio: 0.1 });
      for (let i = 0; i < 3; i++) c.caixa(0, 0.5 + i * 0.25, 0.155, 0.4, 0.05, 0.02, CORES.pedraEscura, { raio: 0, ao: 0 });
      c.colisor({ x: 0, z: 0, hx: 0.38, hz: 0.18, y0: -1, y1: 1.2, piso: false });
    });
    // pedras soltas no chão
    for (let i = 0; i < 6; i++) c.esfera(Math.sin(i * 2.1) * 4.2, 0.0, Math.cos(i * 2.1) * 3.6 - 1, 0.35 + (i % 3) * 0.1, CORES.pedraEscura, 1.2, 0.6, 1, 0);
  });
  return finalizarPeca(m, c, 'gruta');
}

/** Meia esfera com as faces voltadas para dentro e um vão (boca) em torno de +z. */
function cupulaInterna(R: number, vao: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(R, 22, 9, Math.PI / 2 + vao, Math.PI * 2 - vao * 2, 0, Math.PI / 2 + 0.1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + Math.sin(x * 1.3 + z * 0.7) * 0.06 + Math.cos(y * 1.9 + x) * 0.05;
    p.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  // inverte as faces (vistas por dentro)
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
  g.computeVertexNormals();
  return g;
}

function construirVau(m: Mundo): Peca {
  const c = new Construtor(3);
  const [vx, vz] = NOE.vau;
  for (let i = -4; i <= 4; i++) {
    const x = vx + i * 1.7;
    const z = vz + Math.sin(i) * 0.6;
    c.esfera(x, m.relevo.altura(x, z) + 0.2, z, 0.55, CORES.pedra, 1.3, 0.55, 1.1, 0);
  }
  return finalizarPeca(m, c, 'vau');
}

/** Trigal da casa de Noé: touceiras de trigo procedurais (leves) em fileiras, com vento. */
function criarTrigal(m: Mundo): THREE.InstancedMesh {
  const pos: number[] = [];
  const cor: number[] = [];
  const hastes = 6;
  for (let i = 0; i < hastes; i++) {
    const a = (i / hastes) * Math.PI * 2 + i;
    const ox = Math.cos(a) * 0.12;
    const oz = Math.sin(a) * 0.12;
    const h = 0.95 + (i % 3) * 0.12;
    const inc = 0.08 + (i % 2) * 0.06;
    const tx = ox + Math.cos(a) * inc;
    const tz = oz + Math.sin(a) * inc;
    const lx = -Math.sin(a) * 0.012;
    const lz = Math.cos(a) * 0.012;
    // haste (fina)
    pos.push(ox - lx, 0, oz - lz, ox + lx, 0, oz + lz, tx + lx, h, tz + lz, ox - lx, 0, oz - lz, tx + lx, h, tz + lz, tx - lx, h, tz - lz);
    for (let k = 0; k < 6; k++) cor.push(0.62, 0.55, 0.3);
    // espiga (losango)
    const ex = lx * 4, ez = lz * 4;
    const t2x = tx + Math.cos(a) * 0.05, t2z = tz + Math.sin(a) * 0.05;
    pos.push(tx, h, tz, tx + ex, h + 0.12, tz + ez, t2x, h + 0.26, t2z, tx, h, tz, t2x, h + 0.26, t2z, tx - ex, h + 0.12, tz - ez);
    for (let k = 0; k < 6; k++) cor.push(1, 0.86, 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, color: '#f0d890' });
  aplicarPatch(mat, { vento: 0.18, alturaRef: 1.1, revelar: true });
  const lista: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  for (let x = 54; x < 78; x += 0.75) {
    for (let z = 96; z < 116; z += 0.7) {
      const j1 = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      const r = j1 - Math.floor(j1);
      if ((Math.round(x / 0.75) % 4) === 0) continue; // sulcos entre as fileiras
      const px = x + (r - 0.5) * 0.3;
      const pz = z + Math.sin(x * 3 + z) * 0.2;
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r * 6.28);
      s.setScalar(0.85 + r * 0.3);
      p.set(px, m.relevo.altura(px, pz) - 0.03, pz);
      lista.push(new THREE.Matrix4().compose(p, q, s));
    }
  }
  const im = new THREE.InstancedMesh(g, mat, lista.length);
  lista.forEach((mm, i) => im.setMatrixAt(i, mm));
  im.receiveShadow = true;
  im.name = 'trigal';
  im.computeBoundingSphere();
  return im;
}

// ====================================================================== altar do platô (A6)

function criarAltar(m: Mundo) {
  const [x, z] = m.ponto('altarPlato');
  const az = z - 1.6;
  const y = m.relevo.altura(x, az);
  const grupo = new THREE.Group();
  grupo.name = 'altarPlato';
  grupo.position.set(x, y, az);
  const pedras: THREE.Mesh[] = [];
  // 6 camadas: cada pedra recolhida acrescenta uma camada ao altar
  for (let k = 0; k < 6; k++) {
    const c = new Construtor(500 + k);
    const camada = Math.floor(k / 2);
    const n = 4 - camada;
    const raio = 0.85 * (1 - camada * 0.18);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + k * 0.7;
      const sc = 0.34 + ((k + i) % 3) * 0.04;
      c.esfera(Math.cos(a) * raio * 0.7, k * 0.17 + sc * 0.35, Math.sin(a) * raio * 0.7, sc, (k + i) % 2 ? CORES.pedra : CORES.pedraEscura, 1.25, 0.7, 1.1, 0);
    }
    const malha = c.construir(`pedraAltar${k + 1}`).malha!;
    aplicarPatch(malha.material as THREE.Material, { revelar: true });
    malha.visible = false;
    pedras.push(malha);
    grupo.add(malha);
  }
  // fogo e fumaça
  const fogo = new THREE.Group();
  fogo.position.y = 1.15;
  const matChama = new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  const matChama2 = new THREE.MeshBasicMaterial({ color: '#ff6a20', transparent: true, opacity: 0.85, depthWrite: false, fog: false });
  for (let i = 0; i < 4; i++) {
    const ch = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.03, 0.9 - i * 0.12, 7).translate(0, 0.4, 0), i % 2 ? matChama2 : matChama);
    ch.position.set(Math.cos(i * 1.7) * 0.18, 0, Math.sin(i * 1.7) * 0.18);
    ch.name = 'chama';
    fogo.add(ch);
  }
  const matFumaca = new THREE.MeshLambertMaterial({ color: '#d8d0c8', transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), matFumaca);
    f.name = 'fumaca';
    f.userData.fase = i / 6;
    fogo.add(f);
  }
  const luz = new THREE.PointLight('#ff9a40', 6, 12, 1.6);
  luz.position.y = 0.6;
  fogo.add(luz);
  fogo.visible = false;
  grupo.add(fogo);
  m.estruturas.add(grupo);
  return { grupo, pedras, fogo, colisor: null as Colisor | null, n: 0, aceso: false };
}

function animarFogo(fogo: THREE.Group, t: number) {
  let i = 0;
  for (const o of fogo.children) {
    if (o.name === 'chama') {
      const k = 0.85 + Math.sin(t * 9 + i * 1.7) * 0.12 + Math.sin(t * 15.3 + i) * 0.06;
      o.scale.set(1, k, 1);
      o.rotation.y = t * 0.6 + i;
      i++;
    } else if (o.name === 'fumaca') {
      const f = (t * 0.18 + (o.userData.fase as number)) % 1;
      o.position.set(Math.sin(f * 6 + t * 0.3) * 0.4 * f, 0.6 + f * 7, Math.cos(f * 5) * 0.3 * f);
      o.scale.setScalar(0.5 + f * 2.2);
    } else if ((o as THREE.PointLight).isPointLight) {
      (o as THREE.PointLight).intensity = 5 + Math.sin(t * 11) * 0.8 + Math.sin(t * 17.7) * 0.5;
    }
  }
}
