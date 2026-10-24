import * as THREE from 'three';
import { Construtor, CORES, materialConstrucao } from '../../entidades/Construtor';
import type { Mundo, Escalada } from '../../mundo/Mundo';
import type { Colisor, OpcoesColisor } from '../../mundo/Colisao';
import { aplicarPatch } from '../../render/Shaders';
import { clamp } from '../../core/util';

/**
 * A arca (Gn 6:14-16): 300 × 50 × 30 côvados ≈ 135 × 22,5 × 13,5 m, três andares,
 * uma porta na lateral e uma abertura de um côvado sob o teto.
 * Eixo longo em x local; frente da porta em +z. Origem no centro da quilha.
 */
export const ARCA = {
  comprimento: 135,
  largura: 22.5,
  altura: 13.5,
  conveses: [0.6, 4.9, 9.2],
  portaX: 20,
  portaLargura: 4.2,
  portaAltura: 4.0,
  /** Janela (abertura sob o teto) no convés 3, lado +z. */
  janelaX: 6,
  /** Viga mestra (transversal) e andaime da obra. */
  vigaX: -7.25,
};

export type EstagioArca = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0 quilha · 1 cavernas · 2 viga mestra · 3 casco até a metade · 4 pronta e betumada
// 5 porta aberta com rampa (animais entrando) · 6 porta fechada pelo Senhor (Gn 7:16)

const BETUME = '#3b2d24';
const BETUME2 = '#46362a';
const W2 = ARCA.largura / 2;
const [D1, D2, D3] = ARCA.conveses;
/** Meia-extensão útil do piso interno. */
const PISO_X = ARCA.comprimento / 2 - 4;
const PISO_Z = W2 - 0.4;
/** Rampas internas (centro x) e buracos nos pisos de cima. */
const RAMPA1 = -26;
const RAMPA2 = 26;
const COMP_RAMPA = 9;
/** Passadiço alto do convés 2 (redes de carga) e plataforma da janela no convés 3. */
const PASSADICO = { x0: 4, x1: 17, z: -1.0, y: D2 + 2.1 };
const PLAT_JANELA = { x0: ARCA.janelaX - 2, x1: ARCA.janelaX + 2, z0: 8.4, z1: W2 - 0.35, y: D3 + 1.9 };
/** Caixas de carga do convés 2 (x de cada uma) e alcance do deslizamento em z. */
const CAIXAS_X = [7.5, 10.5, 16];
const CAIXA_Z = 4.2;
/** Altura da viga mestra (base) em função de t (0 = no chão, 1 = assentada no alto). */
const alturaViga = (t: number) => 0.35 + t * 12.55;
const ANDAIME = { x0: ARCA.vigaX + 0.9, x1: ARCA.vigaX + 3.9, z0: W2 + 0.5, z1: W2 + 3.0, y: 7.4 };
const GUINCHO = { x: ARCA.vigaX - 3.2, z: W2 + 6.5 };

function meiaLargura(x: number) {
  const L = ARCA.comprimento / 2;
  const t = Math.max(0, (Math.abs(x) - (L - 12)) / 12);
  return W2 * (1 - t * t * 0.55);
}

/**
 * Pontos internos e da obra, em coordenadas locais da arca (x, y, z).
 * `pontoArca(nome)` em MundoNoe converte para o mundo, já considerando onde a arca está.
 */
export const PONTOS_ARCA: Record<string, [number, number, number]> = {
  porta: [ARCA.portaX, D1, W2 - 2.0],
  saida: [ARCA.portaX, 0, W2 + 8.5],
  conves1: [0, D1, 0],
  conves2: [0, D2, 0],
  conves3: [0, D3, 0],
  rampa12: [RAMPA1 - COMP_RAMPA / 2 - 1.5, D1, 0],
  rampa23: [RAMPA2 - COMP_RAMPA / 2 - 1.5, D2, 0],
  bomba: [-6.5, D1, -0.9],
  vazamento1: [26, D1, W2 - 2.1],
  vazamento2: [-59.2, D1, 0.5],
  vazamento3: [39, D1, -1.0],
  vazamento4: [59.2, D1, -0.5],
  baia1: [-45.5, D2, -1.7],
  baia1Animal: [-45.5, D2, -5.4],
  baia2: [-3.5, D2, 1.7],
  baia2Animal: [-3.5, D2, 5.4],
  baia3: [38.5, D2, -1.7],
  baia3Animal: [38.5, D2, -5.4],
  corredor2: [10, D2, 0],
  escadaRedes: [PASSADICO.x0 - 1.4, D2, PASSADICO.z],
  rede1: [6.8, PASSADICO.y, PASSADICO.z],
  rede2: [13.8, PASSADICO.y, PASSADICO.z],
  familia: [-6, D3, 0],
  familia1: [-10, D3, -3.2],
  familia2: [-4, D3, -3.6],
  familia3: [-10, D3, 3.2],
  familia4: [-3, D3, 3.4],
  escadaJanela: [ARCA.janelaX, D3, PLAT_JANELA.z0 - 0.9],
  janela: [ARCA.janelaX, PLAT_JANELA.y, W2 - 1.0],
  pombaPouso: [ARCA.janelaX, 11.55, W2 + 0.35],
  // obra (A1/A2), ao lado do casco
  quilha: [0, 0, 4.6],
  guincho: [GUINCHO.x, 0, GUINCHO.z + 1.5],
  andaimeBase: [(ANDAIME.x0 + ANDAIME.x1) / 2, 0, ANDAIME.z1 + 0.9],
  andaimeTopo: [(ANDAIME.x0 + ANDAIME.x1) / 2, ANDAIME.y, (ANDAIME.z0 + ANDAIME.z1) / 2 - 0.2],
  ancoraCorda: [ANDAIME.x0 + 0.5, ANDAIME.y, ANDAIME.z0 + 0.45],
  encaixeViga1: [ARCA.vigaX, 0, -W2 - 1.4],
  encaixeViga2: [ARCA.vigaX - 1.0, 0, W2 + 1.3],
};

interface ColisorLocal {
  local: OpcoesColisor;
  c: Colisor;
}

interface EscaladaLocal {
  id: string;
  base: [number, number, number];
  topo: [number, number, number];
  yaw: number;
  largura: number;
  obj: Escalada;
}

/** Viga mestra erguida pelo guincho (A2). */
export class VigaMestra {
  altura = 0;
  constructor(private arca: Arca) {}
  /** 0 = no chão, 0,6 = na altura do topo do andaime (amarrar), 1 = assentada no alto do casco. */
  definirAltura(t: number) {
    this.altura = clamp(t, 0, 1);
    this.arca.atualizarObra();
  }
}

export class Arca {
  readonly grupo = new THREE.Group();
  private exterior: THREE.Mesh | null = null;
  private interior: THREE.Group | null = null;
  private porta: THREE.Group;
  private rampaPorta: THREE.Mesh;
  private janela: THREE.Group;
  private obra: THREE.Group;
  private malhaViga: THREE.Mesh;
  private tambor: THREE.Mesh;
  private cordas: THREE.Mesh[] = [];
  private aguaInterna: THREE.Mesh;
  private jatos: THREE.Mesh[] = [];
  private caixas: THREE.Mesh[] = [];
  private redes: THREE.Mesh[] = [];
  private mundo: Mundo;
  private colExt: ColisorLocal[] = [];
  private colInt: ColisorLocal[] = [];
  private colObra: ColisorLocal[] = [];
  private colPorta: ColisorLocal[] = [];
  private colCaixas: ColisorLocal[] = [];
  private escaladas: EscaladaLocal[] = [];
  readonly vigaMestra: VigaMestra;
  estagio: EstagioArca = 0;
  portaAberta = false;
  janelaAberta = false;
  interiorVisivel = false;
  nivelAguaInterna = 0;
  readonly vazamentos = [false, false, false, false];
  readonly redesPresas = [false, false];
  caixasSoltas = false;
  private tempoCaixas = 0;
  private zCaixas = CAIXAS_X.map(() => -CAIXA_Z);
  readonly origem = new THREE.Vector3();
  yaw = 0;
  /** Lanternas do interior (local): MundoNoe acende luzes nas mais próximas do jogador. */
  readonly lanternas: THREE.Vector3[] = [];
  /** Avisado depois de mover a arca (MundoNoe atualiza pontos). */
  aoMover: (() => void) | null = null;

  constructor(mundo: Mundo, x: number, y: number, z: number) {
    this.mundo = mundo;
    this.origem.set(x, y, z);
    this.grupo.name = 'arca';
    this.grupo.position.copy(this.origem);
    this.porta = this.criarPorta();
    this.rampaPorta = this.criarRampaPorta();
    this.janela = this.criarJanela();
    this.grupo.add(this.porta, this.rampaPorta, this.janela);
    this.vigaMestra = new VigaMestra(this);
    const obra = this.criarObra();
    this.obra = obra.grupo;
    this.malhaViga = obra.viga;
    this.tambor = obra.tambor;
    this.grupo.add(this.obra);
    this.aguaInterna = new THREE.Mesh(
      new THREE.PlaneGeometry(PISO_X * 2 - 5, PISO_Z * 2).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#56706c', transparent: true, opacity: 0.72, depthWrite: false }),
    );
    this.aguaInterna.name = 'aguaInterna';
    this.aguaInterna.visible = false;
    this.aguaInterna.renderOrder = 3;
    this.grupo.add(this.aguaInterna);
    mundo.estruturas.add(this.grupo);
    mundo.atualizaveis.add(this);
    this.registrarEscalada('andaime', PONTOS_ARCA.andaimeBase, [PONTOS_ARCA.andaimeTopo[0], ANDAIME.y, ANDAIME.z1 - 0.6], Math.PI, 1.0);
    this.registrarEscalada('escadaRedes', PONTOS_ARCA.escadaRedes, [PASSADICO.x0 + 0.7, PASSADICO.y, PASSADICO.z], Math.PI / 2, 0.9);
    this.registrarEscalada('escadaJanela', PONTOS_ARCA.escadaJanela, [ARCA.janelaX, PLAT_JANELA.y, PLAT_JANELA.z0 + 0.6], 0, 0.9);
    this.atualizarObra();
  }

  /** Converte coordenadas locais da arca para o mundo. */
  mundoDe(lx: number, ly: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(lx, ly, lz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, this.yaw).add(this.grupo.position);
  }

  /** Ponto nomeado (ver PONTOS_ARCA) em coordenadas de mundo. */
  ponto(nome: string): THREE.Vector3 | null {
    const p = PONTOS_ARCA[nome];
    return p ? this.mundoDe(p[0], p[1], p[2]) : null;
  }

  definirEstagio(e: EstagioArca) {
    this.estagio = e;
    if (this.exterior) {
      this.grupo.remove(this.exterior);
      this.exterior.geometry.dispose();
    }
    this.removerColisores(this.colExt);
    this.colExt = [];
    const { malha, colisores } = this.construirExterior(e);
    this.exterior = malha;
    if (malha) {
      patchear(malha);
      this.grupo.add(malha);
    }
    this.colExt = this.adicionarColisores(colisores);
    this.porta.visible = e >= 4;
    this.janela.visible = e >= 4;
    if (e >= 4 && !this.interior) this.construirInterior();
    this.definirPorta(e === 5);
    if (e >= 2 && this.vigaMestra.altura < 1) this.vigaMestra.altura = 1;
    if (e < 2 && this.vigaMestra.altura >= 1) this.vigaMestra.altura = 0;
    this.atualizarObra();
    this.atualizarInteriorVisivel(this.interiorVisivel);
  }

  /** Abre/fecha a porta. Aberta, ela desce como rampa até o chão (qualquer estágio ≥ 4). */
  definirPorta(aberta: boolean) {
    this.portaAberta = aberta && this.estagio >= 4;
    // aberta: a folha deita para fora, um pouco abaixo da horizontal (continua a rampa)
    this.porta.rotation.x = this.portaAberta ? Math.PI / 2 + 0.09 : 0;
    this.rampaPorta.visible = this.portaAberta;
    this.removerColisores(this.colPorta);
    this.colPorta = [];
    if (this.estagio >= 4) {
      if (this.portaAberta) {
        this.colPorta = this.adicionarColisores([
          { tipo: 'rampa', x: ARCA.portaX, z: W2 + 3.05, hx: ARCA.portaLargura / 2 + 0.2, hz: 3.55, y0: -1, y1: D1, topoDe: D1, topoAte: 0.02, piso: true, solido: false },
        ]);
      } else {
        this.colPorta = this.adicionarColisores([
          { x: ARCA.portaX, z: W2, hx: ARCA.portaLargura / 2 + 0.2, hz: 0.5, y0: -1, y1: ARCA.portaAltura + 1 },
        ]);
      }
    }
    this.atualizarInteriorVisivel(this.interiorVisivel);
  }

  /** Abre/fecha a cobertura da janela (Gn 8:6). */
  definirJanela(aberta: boolean) {
    this.janelaAberta = aberta;
    const tampa = this.janela.getObjectByName('tampaJanela');
    if (tampa) tampa.rotation.x = aberta ? -1.35 : 0;
  }

  /** Nível da água no convés 1 (0 = seco, 1 = limite, ~1,1 m). */
  definirAguaInterna(nivel: number) {
    this.nivelAguaInterna = clamp(nivel, 0, 1);
    this.aguaInterna.visible = this.nivelAguaInterna > 0.005;
    this.aguaInterna.position.set(-1, D1 + 0.03 + this.nivelAguaInterna * 1.1, 0);
  }

  /** Mostra/esconde o jato d'água de um vazamento (1..4). */
  definirVazamento(n: number, ativo: boolean) {
    if (n < 1 || n > 4) return;
    this.vazamentos[n - 1] = ativo;
    const j = this.jatos[n - 1];
    if (j) j.visible = ativo && this.interior !== null;
  }

  /** Caixas soltas no corredor do convés 2 (deslizam de um lado a outro enquanto ativas). */
  definirCaixasSoltas(ativas: boolean) {
    this.caixasSoltas = ativas;
    this.tempoCaixas = 0;
    if (!ativas) {
      this.zCaixas = CAIXAS_X.map(() => -CAIXA_Z);
      this.posicionarCaixas();
    }
  }

  /** Rede de carga (1..2): solta balança no alto; presa cobre as caixas. */
  definirRede(n: number, presa: boolean) {
    if (n < 1 || n > 2) return;
    this.redesPresas[n - 1] = presa;
    const r = this.redes[n - 1];
    if (!r) return;
    const x = PONTOS_ARCA[`rede${n}`][0];
    if (presa) {
      r.position.set(x, D2 + 1.25, -CAIXA_Z);
      r.scale.set(1.5, 0.35, 1.3);
      r.rotation.set(0, 0, 0);
    } else {
      r.position.set(x, D2 + 3.2, -2.3);
      r.scale.set(0.7, 1.0, 0.7);
    }
  }

  atualizarInteriorVisivel(v: boolean) {
    this.interiorVisivel = v;
    if (this.interior) this.interior.visible = v || this.portaAberta;
  }

  /** Move a arca inteira (flutuar, repousar no monte), levando colisores, escaladas e pontos juntos. */
  mover(x: number, y: number, z: number, yaw = this.yaw) {
    this.grupo.position.set(x, y, z);
    this.yaw = yaw;
    this.grupo.rotation.y = yaw;
    for (const l of [this.colExt, this.colInt, this.colObra, this.colPorta, this.colCaixas]) this.reposicionar(l);
    for (const e of this.escaladas) this.atualizarEscalada(e);
    this.aoMover?.();
  }

  /** Anima as caixas soltas, os jatos e as redes (chamado todo quadro pelo mundo). */
  atualizar(dt: number, t: number) {
    if (!this.interior) return;
    if (this.caixasSoltas) {
      this.tempoCaixas += dt;
      CAIXAS_X.forEach((_, i) => {
        // vai e volta com pausas nas pontas (dá para atravessar no ritmo)
        const fase = this.tempoCaixas * 0.32 + i * 0.27;
        const s = Math.sin(fase * Math.PI * 2);
        this.zCaixas[i] = clamp(s * 1.6, -1, 1) * CAIXA_Z;
      });
      this.posicionarCaixas();
    }
    for (let i = 0; i < 4; i++) {
      const j = this.jatos[i];
      if (j?.visible) j.scale.setScalar(0.9 + Math.sin(t * 23 + i) * 0.1);
    }
    for (let i = 0; i < 2; i++) {
      const r = this.redes[i];
      if (r && !this.redesPresas[i]) r.rotation.z = Math.sin(t * 1.3 + i) * 0.12;
    }
  }

  // ------------------------------------------------------------------ colisores

  private paraMundo(c: OpcoesColisor): OpcoesColisor {
    const p = this.mundoDe(c.x, 0, c.z);
    const y = this.grupo.position.y;
    return { ...c, x: p.x, z: p.z, yaw: (c.yaw ?? 0) + this.yaw, y0: c.y0 + y, y1: c.y1 + y, topoDe: c.topoDe !== undefined ? c.topoDe + y : undefined, topoAte: c.topoAte !== undefined ? c.topoAte + y : undefined, tag: c.tag ?? 'arca' };
  }

  private adicionarColisores(lista: OpcoesColisor[]): ColisorLocal[] {
    return lista.map((local) => ({ local, c: this.mundo.colisoes.adicionar(this.paraMundo(local)) }));
  }

  private removerColisores(lista: ColisorLocal[]) {
    for (const { c } of lista) this.mundo.colisoes.remover(c);
  }

  private reposicionar(lista: ColisorLocal[]) {
    for (const { local, c } of lista) {
      const w = this.paraMundo(local);
      this.mundo.colisoes.mover(c, w.x, w.z, w.yaw, w.y0, w.y1);
      c.topoDe = w.topoDe;
      c.topoAte = w.topoAte;
    }
  }

  private registrarEscalada(id: string, base: [number, number, number], topo: [number, number, number], yaw: number, largura: number) {
    const obj: Escalada = { id, base: new THREE.Vector3(), topo: new THREE.Vector3(), yaw: 0, largura, ativa: false };
    const e: EscaladaLocal = { id, base, topo, yaw, largura, obj };
    this.escaladas.push(e);
    this.atualizarEscalada(e);
    this.mundo.escaladas.set(id, obj);
  }

  private atualizarEscalada(e: EscaladaLocal) {
    this.mundoDe(e.base[0], e.base[1], e.base[2], e.obj.base);
    this.mundoDe(e.topo[0], e.topo[1], e.topo[2], e.obj.topo);
    e.obj.yaw = e.yaw + this.yaw;
  }

  private ativarEscaladas() {
    const obra = this.estagio <= 3;
    const dentro = this.interior !== null;
    for (const e of this.escaladas) e.obj.ativa = e.id === 'andaime' ? obra : dentro;
  }

  // ------------------------------------------------------------------ obra (A1/A2)

  /** Atualiza a obra (visível nos estágios 0–3): altura da viga, cordas e tambor do guincho. */
  atualizarObra() {
    const obra = this.estagio <= 3;
    this.obra.visible = obra;
    if (obra && this.colObra.length === 0) this.colObra = this.adicionarColisores(this.colisoresObra());
    if (!obra && this.colObra.length) {
      this.removerColisores(this.colObra);
      this.colObra = [];
    }
    this.ativarEscaladas();
    const t = this.vigaMestra.altura;
    const yv = alturaViga(t);
    this.malhaViga.position.set(ARCA.vigaX, yv, 0);
    this.malhaViga.visible = obra || this.estagio < 4;
    this.tambor.rotation.x = -t * 40;
    // cordas: pontas da viga → roldanas no pórtico → tambor do guincho
    const topo = ARCA.altura + 2.4;
    const pz = W2 + 1.2;
    const pontos: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(ARCA.vigaX, yv + 0.6, -W2 + 0.4), new THREE.Vector3(ARCA.vigaX, topo, -pz + 0.2)],
      [new THREE.Vector3(ARCA.vigaX, yv + 0.6, W2 - 0.4), new THREE.Vector3(ARCA.vigaX, topo, pz - 0.2)],
      [new THREE.Vector3(ARCA.vigaX, topo, pz), new THREE.Vector3(GUINCHO.x, 1.25, GUINCHO.z)],
    ];
    pontos.forEach(([a, b], i) => posicionarCorda(this.cordas[i], a, b));
  }

  private colisoresObra(): OpcoesColisor[] {
    const a = ANDAIME;
    const cx = (a.x0 + a.x1) / 2;
    const cz = (a.z0 + a.z1) / 2;
    const hx = (a.x1 - a.x0) / 2;
    const hz = (a.z1 - a.z0) / 2;
    return [
      // torre do andaime: sólida até o piso de cima, que é chão
      { x: cx, z: cz, hx, hz, y0: -1, y1: a.y, piso: true, tag: 'andaime' },
      // guarda-corpos do topo (menos do lado da escada)
      { x: cx, z: a.z0 - 0.05, hx, hz: 0.06, y0: a.y, y1: a.y + 1.0, piso: false, tag: 'andaime' },
      { x: a.x0 - 0.05, z: cz, hx: 0.06, hz, y0: a.y, y1: a.y + 1.0, piso: false, tag: 'andaime' },
      { x: a.x1 + 0.05, z: cz, hx: 0.06, hz, y0: a.y, y1: a.y + 1.0, piso: false, tag: 'andaime' },
      // postes do pórtico
      { tipo: 'cilindro', x: ARCA.vigaX, z: W2 + 1.2, r: 0.25, y0: -1, y1: ARCA.altura + 2.6, piso: false },
      { tipo: 'cilindro', x: ARCA.vigaX, z: -W2 - 1.2, r: 0.25, y0: -1, y1: ARCA.altura + 2.6, piso: false },
      // guincho
      { x: GUINCHO.x, z: GUINCHO.z, hx: 1.3, hz: 0.6, y0: -1, y1: 1.4, piso: false },
    ];
  }

  private criarObra() {
    const grupo = new THREE.Group();
    grupo.name = 'obraArca';
    const c = new Construtor(404);
    const a = ANDAIME;
    // andaime: 4 postes, travessas, piso no alto e escada na face +z
    for (const x of [a.x0, a.x1]) for (const z of [a.z0, a.z1]) c.cilindro(x, 0, z, 0.08, 0.1, a.y + 1.1, CORES.madeira, 6);
    for (let y = 1.6; y < a.y; y += 1.9) {
      c.viga(new THREE.Vector3(a.x0, y, a.z0), new THREE.Vector3(a.x1, y, a.z0), 0.05, CORES.madeiraClara, 5);
      c.viga(new THREE.Vector3(a.x0, y, a.z1), new THREE.Vector3(a.x1, y, a.z1), 0.05, CORES.madeiraClara, 5);
      c.viga(new THREE.Vector3(a.x0, y, a.z0), new THREE.Vector3(a.x0, y, a.z1), 0.05, CORES.madeiraClara, 5);
      c.viga(new THREE.Vector3(a.x1, y, a.z0), new THREE.Vector3(a.x1, y, a.z1), 0.05, CORES.madeiraClara, 5);
      c.viga(new THREE.Vector3(a.x0, y - 1.8, a.z0), new THREE.Vector3(a.x1, y, a.z0), 0.04, CORES.madeira, 4);
    }
    c.caixa((a.x0 + a.x1) / 2, a.y - 0.12, (a.z0 + a.z1) / 2, a.x1 - a.x0 + 0.3, 0.12, a.z1 - a.z0 + 0.3, CORES.madeiraClara, { raio: 0.02 });
    for (const [x0, z0, x1, z1] of [[a.x0, a.z0, a.x1, a.z0], [a.x0, a.z0, a.x0, a.z1], [a.x1, a.z0, a.x1, a.z1]] as const) {
      c.viga(new THREE.Vector3(x0, a.y + 1.0, z0), new THREE.Vector3(x1, a.y + 1.0, z1), 0.045, CORES.madeiraClara, 5);
    }
    escadaDeMao(c, (a.x0 + a.x1) / 2, a.z1 + 0.15, 0, a.y + 0.9, 0);
    // cunhas de encaixe junto às pontas da viga (A2)
    for (const [x, z] of [[ARCA.vigaX, -W2 - 0.6], [ARCA.vigaX, W2 + 0.6]] as const) {
      c.caixa(x, 0, z, 0.7, 0.35, 0.5, CORES.madeiraEscura, { raio: 0.04 });
      c.viga(new THREE.Vector3(x, 0.1, z), new THREE.Vector3(x, 3.2, z + Math.sign(z) * -0.35), 0.1, CORES.madeira, 6);
    }
    // pórtico com roldanas sobre a posição da viga
    const topo = ARCA.altura + 2.4;
    for (const s of [-1, 1]) {
      c.cilindro(ARCA.vigaX, 0, s * (W2 + 1.2), 0.18, 0.24, topo + 0.3, CORES.madeiraEscura, 8);
      c.viga(new THREE.Vector3(ARCA.vigaX, 0.2, s * (W2 + 3.2)), new THREE.Vector3(ARCA.vigaX, 6, s * (W2 + 1.25)), 0.12, CORES.madeira, 6);
      c.esfera(ARCA.vigaX, topo, s * (W2 + 1.0), 0.32, CORES.madeiraClara, 0.6, 1, 1, 1);
    }
    c.viga(new THREE.Vector3(ARCA.vigaX, topo + 0.3, -W2 - 1.4), new THREE.Vector3(ARCA.vigaX, topo + 0.3, W2 + 1.4), 0.22, CORES.madeiraEscura, 8);
    // guincho: armação (o tambor gira à parte)
    c.em(GUINCHO.x, 0, GUINCHO.z, 0, () => {
      for (const s of [-1, 1]) {
        c.caixa(s * 1.1, 0, 0, 0.22, 1.35, 0.9, CORES.madeira, { raio: 0.04 });
        c.viga(new THREE.Vector3(s * 1.1, 0.1, -0.9), new THREE.Vector3(s * 1.1, 1.1, 0), 0.07, CORES.madeiraEscura, 5);
      }
      c.caixa(0, 0, 0, 2.6, 0.18, 1.4, CORES.madeiraEscura, { raio: 0.03 });
      for (const s of [-1, 1]) c.cilindro(0, 0.05, s * 0.7, 0.12, 0.14, 0.5, CORES.pedraEscura, 6);
    });
    const { malha } = c.construir('obraArca');
    if (malha) {
      patchear(malha);
      grupo.add(malha);
    }
    // tambor com manivelas (gira com a altura da viga)
    const ct = new Construtor(405);
    ct.cilindro(0, -1.0, 0, 0.32, 0.32, 2.0, CORES.madeiraClara, 10, { rz: 0 });
    for (const s of [-1, 1]) {
      ct.caixa(0, s * 1.15 - 0.05, 0.35, 0.1, 0.1, 0.8, CORES.madeiraEscura, { raio: 0.02 });
      ct.cilindro(0, s * 1.15 - 0.3, 0.7, 0.05, 0.05, 0.6, CORES.madeira, 5);
    }
    const tamb = ct.construir('tambor').malha!;
    tamb.geometry.rotateZ(Math.PI / 2);
    tamb.position.set(GUINCHO.x, 1.25, GUINCHO.z);
    patchear(tamb);
    grupo.add(tamb);
    // a viga mestra (transversal), erguida pelo guincho
    const cv = new Construtor(406);
    cv.caixa(0, 0, 0, 0.6, 0.6, ARCA.largura + 0.4, CORES.madeiraEscura, { raio: 0.05 });
    for (const s of [-1, 1]) cv.cilindro(0, 0.6, s * (W2 - 0.4), 0.06, 0.06, 0.3, CORES.corda, 5);
    const viga = cv.construir('vigaMestra').malha!;
    patchear(viga);
    grupo.add(viga);
    // cordas
    const matCorda = new THREE.MeshLambertMaterial({ color: CORES.corda });
    const geoCorda = new THREE.CylinderGeometry(0.035, 0.035, 1, 5).translate(0, 0.5, 0);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(geoCorda, matCorda);
      m.name = 'corda';
      m.castShadow = false;
      this.cordas.push(m);
      grupo.add(m);
    }
    return { grupo, viga, tambor: tamb };
  }

  // ------------------------------------------------------------------ porta e janela

  private criarPorta(): THREE.Group {
    const g = new THREE.Group();
    const c = new Construtor(9);
    // a folha cresce para +y a partir da dobradiça (na base)
    c.caixa(0, 0, 0, ARCA.portaLargura, ARCA.portaAltura, 0.3, BETUME2, { raio: 0.05, ao: 0 });
    for (let i = 0; i < 5; i++) c.caixa(-ARCA.portaLargura / 2 + 0.42 + i * 0.84, 0.05, 0.16, 0.12, ARCA.portaAltura - 0.1, 0.06, BETUME, { raio: 0.02, ao: 0 });
    // travessas (degraus quando vira rampa)
    for (let i = 1; i < 6; i++) c.caixa(0, i * 0.66, 0.17, ARCA.portaLargura - 0.3, 0.08, 0.07, BETUME, { raio: 0, ao: 0 });
    const { malha } = c.construir('porta');
    if (malha) {
      g.add(malha);
      patchear(malha);
    }
    g.position.set(ARCA.portaX, D1 - 0.42, W2 + 0.2);
    return g;
  }

  private criarRampaPorta(): THREE.Mesh {
    const c = new Construtor(10);
    const comp = 2.9;
    const ang = Math.atan2(0.42, comp);
    c.caixa(ARCA.portaX, -0.05, W2 + 4.25 + comp / 2, ARCA.portaLargura + 0.4, 0.22, comp, CORES.madeira, { raio: 0.03, rx: ang });
    for (const s of [-1, 1]) c.caixa(ARCA.portaX + s * (ARCA.portaLargura / 2 + 0.1), -0.2, W2 + 2.5, 0.25, 0.5, 4.2, CORES.madeiraEscura, { raio: 0.04 });
    const m = c.construir('rampaPorta').malha!;
    patchear(m);
    m.visible = false;
    return m;
  }

  private criarJanela(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'janela';
    const c = new Construtor(11);
    // batentes e parapeito (por fora)
    const x = ARCA.janelaX;
    c.caixa(x, 11.38, W2 + 0.25, 3.5, 0.14, 0.5, '#2a2018', { raio: 0.03 });
    for (const s of [-1, 1]) c.caixa(x + s * 1.65, 11.4, W2 + 0.2, 0.2, 1.65, 0.36, '#2a2018', { raio: 0.03 });
    const m = c.construir('batenteJanela').malha!;
    patchear(m);
    g.add(m);
    // tampa articulada no alto
    const ct = new Construtor(12);
    ct.caixa(0, -1.62, 0.1, 3.1, 1.62, 0.12, BETUME2, { raio: 0.03, ao: 0 });
    for (let i = 0; i < 3; i++) ct.caixa(-1.0 + i, -1.58, 0.18, 0.1, 1.5, 0.05, BETUME, { raio: 0, ao: 0 });
    const tampa = ct.construir('tampaJanela').malha!;
    patchear(tampa);
    const piv = new THREE.Group();
    piv.name = 'tampaJanela';
    piv.position.set(x, 13.05, W2 + 0.2);
    piv.add(tampa);
    g.add(piv);
    g.visible = false;
    return g;
  }

  // ------------------------------------------------------------------ exterior

  private construirExterior(e: EstagioArca) {
    const c = new Construtor(1906);
    const L = ARCA.comprimento / 2;
    const H = ARCA.altura;
    // blocos de apoio e quilha
    for (let x = -L + 6; x <= L - 6; x += 9) c.caixa(x, -0.3, 0, 1.2, 0.6, 6, CORES.pedraEscura, { raio: 0.1 });
    c.caixa(0, 0, 0, ARCA.comprimento - 6, 0.7, 1.2, e >= 4 ? BETUME : CORES.madeiraEscura, { raio: 0.1 });
    const colisores: OpcoesColisor[] = [];
    colisores.push({ x: 0, z: 0, hx: L - 3, hz: 0.7, y0: -1, y1: 0.7, piso: true });

    if (e >= 1 && e <= 3) {
      // cavernas (costelas) em U
      for (let x = -L + 4; x <= L - 4; x += 4.5) {
        const w = meiaLargura(x);
        const cor = (Math.round(x) % 2 === 0) ? CORES.madeira : CORES.madeiraClara;
        c.caixa(x, 0.4, 0, 0.5, 0.5, w * 2, cor, { raio: 0.06 });
        for (const s of [-1, 1]) {
          c.caixa(x, 0.4, s * (w - 0.25), 0.5, H - 0.5, 0.5, cor, { raio: 0.06 });
        }
      }
      // longarinas baixas
      for (const s of [-1, 1]) c.caixa(0, 3.6, s * (W2 - 0.3), ARCA.comprimento - 10, 0.45, 0.45, CORES.madeiraEscura, { raio: 0.05 });
    }
    if (e >= 2 && e <= 3) {
      // longarinas do alto e as vigas dos conveses
      for (const s of [-1, 1]) c.caixa(0, H - 0.6, s * (W2 - 0.3), ARCA.comprimento - 10, 0.55, 0.55, CORES.madeiraEscura, { raio: 0.05 });
      c.caixa(0, D2 - 0.3, 0, ARCA.comprimento - 10, 0.3, 0.4, CORES.madeira, { raio: 0.04 });
    }
    if (e === 3) {
      // casco até a metade, tábua por tábua
      for (let y = 0.6; y < H * 0.5; y += 0.55) {
        for (const s of [-1, 1]) {
          c.caixa(0, y, s * (W2 - 0.05), ARCA.comprimento - 8, 0.52, 0.18, y < 2.3 ? BETUME2 : (Math.round(y * 10) % 2 ? CORES.madeira : CORES.madeiraClara), { raio: 0.03, variacao: 0.08 });
        }
      }
    }
    if (e >= 4) {
      // casco completo, betumado por dentro e por fora (Gn 6:14)
      const fileiras = Math.floor((H - 0.9) / 0.55);
      const a = ARCA.portaX - ARCA.portaLargura / 2;
      const b = ARCA.portaX + ARCA.portaLargura / 2;
      const ja = ARCA.janelaX - 1.5;
      const jb = ARCA.janelaX + 1.5;
      const fileira = (x0: number, x1: number, y: number, z: number, cor: string) => {
        if (x1 - x0 > 0.05) c.caixa((x0 + x1) / 2, y, z, x1 - x0, 0.53, 0.3, cor, { raio: 0.02, variacao: 0.05 });
      };
      for (let k = 0; k < fileiras; k++) {
        const y = 0.5 + k * 0.55;
        const cor = k % 2 ? BETUME : BETUME2;
        const x0 = -L + 6;
        const x1 = L - 6;
        // lado -z: inteiro
        fileira(x0, x1, y, -W2, cor);
        // lado +z: vão da porta embaixo e da janela no alto
        const vaoPorta = y < D1 + ARCA.portaAltura - 0.2 && y + 0.55 > D1 - 0.2;
        const vaoJanela = y >= 11.4;
        if (vaoPorta) {
          fileira(x0, a, y, W2, cor);
          fileira(b, x1, y, W2, cor);
        } else if (vaoJanela) {
          fileira(x0, ja, y, W2, cor);
          fileira(jb, x1, y, W2, cor);
        } else fileira(x0, x1, y, W2, cor);
      }
      // proa e popa afiladas
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const x = s * (L - 6 + k);
          const w = meiaLargura(x);
          c.caixa(x, 0.5, 0, 1.05, H - 0.9, w * 2, k % 2 ? BETUME : BETUME2, { raio: 0.3 - k * 0.03 });
        }
      }
      // faixa da abertura de um côvado sob o teto (Gn 6:16): forro escuro do convés 3
      c.caixa(0, H - 0.45, 0, ARCA.comprimento - 10, 0.45, ARCA.largura - 0.6, '#16110d', { raio: 0, ao: 0 });
      for (let x = -L + 8; x <= L - 8; x += 3) for (const s of [-1, 1]) c.caixa(x, H - 0.45, s * (W2 - 0.1), 0.2, 0.45, 0.2, BETUME, { raio: 0, ao: 0 });
      // teto em duas águas
      for (const s of [-1, 1]) {
        c.caixa(0, H, s * ARCA.largura / 4, ARCA.comprimento - 6, 0.35, W2 + 1.2, '#4a3828', { raio: 0.08, rx: s * -0.12, ao: 0 });
      }
      c.caixa(0, H + 1.2, 0, ARCA.comprimento - 6, 0.3, 0.8, '#3a2c20', { raio: 0.1 });
      // batentes da porta
      for (const s of [-1, 1]) c.caixa(ARCA.portaX + s * (ARCA.portaLargura / 2 + 0.2), D1 - 0.4, W2 + 0.2, 0.4, ARCA.portaAltura + 0.6, 0.4, '#2a2018', { raio: 0.04 });
      // colisores do casco (com o vão da porta)
      colisores.push(
        { x: 0, z: -W2, hx: L, hz: 0.4, y0: -1, y1: H + 1.5, piso: false },
        { x: (-L + a) / 2, z: W2, hx: (a + L) / 2, hz: 0.4, y0: -1, y1: H + 1.5, piso: false },
        { x: (b + L) / 2, z: W2, hx: (L - b) / 2, hz: 0.4, y0: -1, y1: H + 1.5, piso: false },
        { x: ARCA.portaX, z: W2, hx: ARCA.portaLargura / 2 + 0.6, hz: 0.4, y0: D1 + ARCA.portaAltura, y1: H + 1.5, piso: false },
        { x: -L + 4, z: 0, hx: 3.6, hz: W2, y0: -1, y1: H + 1.5, piso: false },
        { x: L - 4, z: 0, hx: 3.6, hz: W2, y0: -1, y1: H + 1.5, piso: false },
        // forro + teto: chão para quem sobe lá em cima e teto para a câmera de dentro
        { x: 0, z: 0, hx: L, hz: W2, y0: H - 0.45, y1: H + 1.6, piso: true },
      );
    } else if (e >= 1) {
      colisores.push({ x: 0, z: 0, hx: L - 3, hz: W2, y0: 0.4, y1: H, piso: false, solido: true });
    }
    const { malha } = c.construir('arca_ext');
    return { malha, colisores };
  }

  // ------------------------------------------------------------------ interior

  /** Três conveses com compartimentos, rampas, a área da família, lanternas e peças das missões. */
  private construirInterior() {
    const grupo = new THREE.Group();
    grupo.name = 'arca_interior';
    const c = new Construtor(77);
    const col: OpcoesColisor[] = [];
    const L = PISO_X;
    const W = PISO_Z;
    const furos: Record<number, [number, number] | null> = {
      0: null,
      1: [RAMPA1 - 1.2, RAMPA1 + COMP_RAMPA / 2],
      2: [RAMPA2 - 1.2, RAMPA2 + COMP_RAMPA / 2],
    };
    const celulaLivre = (k: number, x: number, s: number) => {
      if (k === 0 && s === 1 && Math.abs(x - ARCA.portaX) < 6) return true; // entrada
      if (k === 2 && x > -17 && x < 18) return true; // área da família
      return false;
    };
    const celulaCaixas = (k: number, x: number) => k === 1 && x >= 5 && x <= 12;
    for (const [k, y] of [[0, D1], [1, D2], [2, D3]] as const) {
      const corPiso = k === 0 ? '#5c4632' : '#7a5a3c';
      // piso (com o buraco da rampa que chega de baixo)
      const furo = furos[k];
      const pecas: [number, number, number, number][] = furo
        ? [[-L, furo[0], -W, W], [furo[1], L, -W, W], [furo[0], furo[1], -W, -1.6], [furo[0], furo[1], 1.6, W]]
        : [[-L, L, -W, W]];
      for (const [x0, x1, z0, z1] of pecas) {
        c.caixa((x0 + x1) / 2, y - 0.3, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, corPiso, { raio: 0, ao: 0, variacao: 0.03 });
        col.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, y0: y - 0.3, y1: y, piso: true, solido: true });
      }
      // tábuas do piso (linhas)
      for (let z = -W + 0.6; z < W; z += 1.2) {
        if (furo && Math.abs(z) < 1.7) {
          c.caixa((-L + furo[0]) / 2, y, z, furo[0] + L, 0.02, 0.05, '#4a3626', { raio: 0, ao: 0 });
          c.caixa((furo[1] + L) / 2, y, z, L - furo[1], 0.02, 0.05, '#4a3626', { raio: 0, ao: 0 });
        } else c.caixa(0, y, z, ARCA.comprimento - 9, 0.02, 0.05, '#4a3626', { raio: 0, ao: 0 });
      }
      // guarda-corpo em volta do buraco
      if (furo) {
        for (const s of [-1, 1]) {
          c.caixa((furo[0] + furo[1]) / 2, y + 0.95, s * 1.7, furo[1] - furo[0], 0.08, 0.08, '#6a4a30', { raio: 0, ao: 0 });
          for (let x = furo[0]; x <= furo[1] - 0.5; x += 1.4) c.caixa(x, y, s * 1.7, 0.08, 1.0, 0.08, '#6a4a30', { raio: 0, ao: 0 });
          col.push({ x: (furo[0] + furo[1]) / 2, z: s * 1.72, hx: (furo[1] - furo[0]) / 2, hz: 0.05, y0: y, y1: y + 1.0, piso: false });
        }
        c.caixa(furo[0], y + 0.95, 0, 0.08, 0.08, 3.4, '#6a4a30', { raio: 0, ao: 0 });
        col.push({ x: furo[0] - 0.02, z: 0, hx: 0.05, hz: 1.7, y0: y, y1: y + 1.0, piso: false });
      }
      // pilares centrais
      for (let x = -L + 6; x <= L - 6; x += 9) for (const s of [-1, 1]) {
        c.cilindro(x, y, s * 2.4, 0.22, 0.25, 4.0, '#6a4a30', 7, { ao: 0.1 });
        col.push({ tipo: 'cilindro', x, z: s * 2.4, r: 0.3, y0: y, y1: y + 4.0, piso: false });
      }
      // compartimentos ("ninhos", Gn 6:14) dos dois lados do corredor
      for (let x = -L + 3; x <= L - 6; x += 6) {
        for (const s of [-1, 1]) {
          if (celulaLivre(k, x, s)) continue;
          c.caixa(x, y, s * 5.4, 0.18, 1.3, 5.6, '#8a6a46', { raio: 0, ao: 0.15 });
          col.push({ x, z: s * 5.4, hx: 0.12, hz: 2.8, y0: y, y1: y + 1.3, piso: false });
          if (celulaCaixas(k, x)) continue;
          c.caixa(x + 3, y + 1.1, s * 2.7, 5.6, 0.12, 0.12, '#8a6a46', { raio: 0, ao: 0 });
          // feno
          c.esfera(x + 3, y + 0.15, s * 6.5, 1.2, '#d8c078', 1.6, 0.25, 1.2, 0);
        }
      }
      // lanternas penduradas no corredor
      const teto = k === 2 ? ARCA.altura - 0.45 : ARCA.conveses[k + 1] - 0.3;
      for (let x = -54; x <= 54; x += 18) this.lanternas.push(new THREE.Vector3(x, teto - 0.75, 0));
    }
    // área da família (convés 3): esteiras, almofadas, mesa baixa, cestos e jarros
    const tapetes = ['#a8453a', '#c8a050', '#5a7a8a', '#8a5a7a'];
    PONTO_FAMILIA.forEach(([x, z], i) => {
      c.caixa(x, D3, z, 2.0, 0.06, 1.1, tapetes[i % 4], { raio: 0.02, ao: 0 });
      c.esfera(x - 0.7, D3 + 0.15, z, 0.25, '#e2d2b0', 1.2, 0.5, 1.4, 1);
    });
    c.caixa(-6.5, D3, 0, 1.6, 0.4, 0.9, CORES.madeiraClara, { raio: 0.05 });
    col.push({ x: -6.5, z: 0, hx: 0.8, hz: 0.45, y0: D3, y1: D3 + 0.4, piso: true });
    for (let i = 0; i < 5; i++) c.jarro(-14 + i * 0.7, -8.5, 1.1, i % 2 ? '#b8704a' : '#9a5a3a');
    for (let i = 0; i < 4; i++) c.saco(-13 + i * 0.8, 8.3, 1.1);
    for (const x of [-14, 14]) this.lanternas.push(new THREE.Vector3(x, ARCA.altura - 1.2, 0));
    // mantimentos junto à entrada (convés 1)
    c.em(ARCA.portaX + 6, D1, 6, 0, () => {
      for (let i = 0; i < 6; i++) c.saco((i % 3) * 0.8, 0.0 + Math.floor(i / 3) * 0.9, 1.2);
      for (let i = 0; i < 4; i++) c.jarro(-1.2, -0.6 + i * 0.7, 1.2);
    });
    // rampas internas entre conveses (sobem para +x)
    const rampa = (xr: number, yA: number, yB: number) => {
      const ang = Math.atan2(yB - yA, COMP_RAMPA);
      const comp = Math.hypot(COMP_RAMPA, yB - yA);
      c.caixa(xr, (yA + yB) / 2 - 0.25, 0, comp, 0.25, 3.0, '#7a5a3a', { raio: 0, rz: ang });
      for (let i = 0; i < 10; i++) {
        const t = (i + 0.5) / 10;
        c.caixa(xr - COMP_RAMPA / 2 + t * COMP_RAMPA, yA + t * (yB - yA) - 0.02, 0, 0.08, 0.05, 2.9, '#5a4028', { raio: 0, ao: 0 });
      }
      col.push({ tipo: 'rampa', x: xr, z: 0, hx: 1.5, hz: COMP_RAMPA / 2, yaw: Math.PI / 2, y0: yA - 0.3, y1: yB, topoDe: yA, topoAte: yB, piso: true, solido: false });
    };
    rampa(RAMPA1, D1, D2);
    rampa(RAMPA2, D2, D3);
    // bomba de porão (convés 1)
    c.em(PONTOS_ARCA.bomba[0], D1, -2.0, 0, () => {
      c.cilindro(0, 0, 0, 0.28, 0.32, 1.2, '#6a4a30', 9);
      c.cilindro(0, 1.2, 0, 0.12, 0.12, 0.5, '#4a3626', 6);
      c.viga(new THREE.Vector3(0, 1.6, 0), new THREE.Vector3(0, 1.35, 1.2), 0.06, CORES.madeiraClara, 5);
      c.viga(new THREE.Vector3(0, 0.9, -0.2), new THREE.Vector3(0, 0.9, -8.6), 0.11, '#5a4028', 6);
      c.caixa(0, 0, 0.0, 1.2, 0.1, 1.2, '#4a3626', { raio: 0.02 });
    });
    col.push({ tipo: 'cilindro', x: PONTOS_ARCA.bomba[0], z: -2.0, r: 0.45, y0: D1, y1: D1 + 1.4, piso: false });
    // passadiço alto do convés 2 (redes de carga) com escada
    const p = PASSADICO;
    c.caixa((p.x0 + p.x1) / 2, p.y - 0.12, p.z, p.x1 - p.x0, 0.12, 1.2, CORES.madeiraClara, { raio: 0, ao: 0 });
    for (const x of [p.x0, (p.x0 + p.x1) / 2, p.x1]) for (const s of [-1, 1]) c.cilindro(x, p.y, p.z + s * 0.55, 0.05, 0.05, D3 - 0.3 - p.y, '#6a4a30', 5);
    for (const s of [-1, 1]) c.caixa((p.x0 + p.x1) / 2, p.y + 0.85, p.z + s * 0.6, p.x1 - p.x0, 0.06, 0.06, '#6a4a30', { raio: 0, ao: 0 });
    escadaDeMao(c, p.x0 - 0.35, p.z, D2, p.y + 0.6, -Math.PI / 2);
    col.push(
      { x: (p.x0 + p.x1) / 2, z: p.z, hx: (p.x1 - p.x0) / 2, hz: 0.6, y0: p.y - 0.12, y1: p.y, piso: true, solido: false },
      { x: (p.x0 + p.x1) / 2, z: p.z - 0.62, hx: (p.x1 - p.x0) / 2, hz: 0.05, y0: p.y, y1: p.y + 0.9, piso: false },
      { x: (p.x0 + p.x1) / 2, z: p.z + 0.62, hx: (p.x1 - p.x0) / 2, hz: 0.05, y0: p.y, y1: p.y + 0.9, piso: false },
      { x: p.x1 + 0.05, z: p.z, hx: 0.05, hz: 0.6, y0: p.y, y1: p.y + 0.9, piso: false },
    );
    // plataforma e escada da janela (convés 3)
    const j = PLAT_JANELA;
    c.caixa((j.x0 + j.x1) / 2, j.y - 0.15, (j.z0 + j.z1) / 2, j.x1 - j.x0, 0.15, j.z1 - j.z0, CORES.madeiraClara, { raio: 0.02 });
    for (const x of [j.x0, j.x1]) c.cilindro(x, D3, j.z0 + 0.1, 0.07, 0.07, j.y - D3, '#6a4a30', 6);
    for (const x of [j.x0, j.x1]) c.caixa(x, j.y, (j.z0 + j.z1) / 2, 0.07, 0.9, j.z1 - j.z0, '#6a4a30', { raio: 0, ao: 0 });
    escadaDeMao(c, ARCA.janelaX, j.z0 - 0.2, D3, j.y + 0.6, Math.PI);
    col.push(
      { x: (j.x0 + j.x1) / 2, z: (j.z0 + j.z1) / 2, hx: (j.x1 - j.x0) / 2, hz: (j.z1 - j.z0) / 2, y0: D3, y1: j.y, piso: true },
      { x: j.x0 - 0.04, z: (j.z0 + j.z1) / 2, hx: 0.05, hz: (j.z1 - j.z0) / 2, y0: j.y, y1: j.y + 0.9, piso: false },
      { x: j.x1 + 0.04, z: (j.z0 + j.z1) / 2, hx: 0.05, hz: (j.z1 - j.z0) / 2, y0: j.y, y1: j.y + 0.9, piso: false },
    );
    // armações das lanternas
    for (const l of this.lanternas) {
      c.cilindro(l.x, l.y + 0.35, l.z, 0.015, 0.015, 0.4, '#3a2c20', 4);
      c.caixa(l.x, l.y - 0.22, l.z, 0.3, 0.06, 0.3, '#3a2c20', { raio: 0, ao: 0 });
      c.caixa(l.x, l.y + 0.26, l.z, 0.34, 0.08, 0.34, '#3a2c20', { raio: 0, ao: 0 });
    }
    const { malha } = c.construir('arca_int');
    if (malha) {
      patchear(malha);
      malha.castShadow = false;
      grupo.add(malha);
    }
    // brilho das lanternas (sem iluminação: sempre acesas)
    const geoBrilho: THREE.BufferGeometry[] = [];
    for (const l of this.lanternas) geoBrilho.push(new THREE.BoxGeometry(0.22, 0.42, 0.22).translate(l.x, l.y, l.z));
    const brilho = new THREE.Mesh(mesclarSimples(geoBrilho), new THREE.MeshBasicMaterial({ color: '#ffc870', fog: false }));
    brilho.name = 'lanternas';
    grupo.add(brilho);
    // jatos dos vazamentos
    const matJato = new THREE.MeshBasicMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.6, depthWrite: false });
    const jatos: [number, number, number, number, number][] = [
      // x, y, z, rotX, rotZ  (o cone aponta para +y antes de girar)
      [26, D1 + 0.45, W2 - 0.2, -Math.PI / 2 - 0.5, 0],
      [-61.0, D1 + 0.35, 0.5, 0, -Math.PI / 2 - 0.5],
      [40.5, D1, -1.0, 0, 0],
      [61.0, D1 + 0.35, -0.5, 0, Math.PI / 2 + 0.5],
    ];
    for (const [x, y, z, rx, rz] of jatos) {
      const g = new THREE.ConeGeometry(0.28, 1.4, 7, 1, true).translate(0, 0.7, 0).rotateX(Math.PI);
      g.translate(0, 1.4, 0);
      const m = new THREE.Mesh(g, matJato);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.visible = false;
      m.name = 'vazamento';
      this.jatos.push(m);
      grupo.add(m);
    }
    this.jatos.forEach((jt, i) => (jt.visible = this.vazamentos[i]));
    // caixas de carga e redes (convés 2)
    const cc = new Construtor(78);
    cc.caixa(0, -0.6, 0, 1.2, 1.2, 1.2, '#9a7448', { raio: 0.05 });
    for (const s of [-1, 1]) cc.caixa(0, -0.6, s * 0.61, 1.25, 0.12, 0.04, '#5a4028', { raio: 0, ao: 0 });
    const geoCaixa = cc.construir('caixa').malha!.geometry;
    for (let i = 0; i < CAIXAS_X.length; i++) {
      const m = new THREE.Mesh(geoCaixa, materialConstrucao());
      m.name = 'caixaCarga';
      this.caixas.push(m);
      grupo.add(m);
    }
    this.colCaixas = this.adicionarColisores(CAIXAS_X.map((x) => ({ x, z: -CAIXA_Z, hx: 0.62, hz: 0.62, y0: D2, y1: D2 + 1.2, piso: true })));
    this.posicionarCaixas();
    const matRede = new THREE.MeshLambertMaterial({ color: '#b8a070', wireframe: false });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.IcosahedronGeometry(0.9, 1);
      const m = new THREE.Mesh(g, matRede);
      m.name = 'rede';
      this.redes.push(m);
      grupo.add(m);
    }
    this.definirRede(1, this.redesPresas[0]);
    this.definirRede(2, this.redesPresas[1]);
    this.interior = grupo;
    this.grupo.add(grupo);
    this.colInt = this.adicionarColisores(col.map((k) => ({ ...k, tag: 'arca' })));
    this.ativarEscaladas();
  }

  private posicionarCaixas() {
    CAIXAS_X.forEach((x, i) => {
      const z = this.zCaixas[i];
      const m = this.caixas[i];
      if (m) m.position.set(x, D2 + 0.6, z);
      const c = this.colCaixas[i];
      if (c) {
        c.local.z = z;
        const w = this.paraMundo(c.local);
        this.mundo.colisoes.mover(c.c, w.x, w.z, w.yaw, w.y0, w.y1);
      }
    });
  }
}

const PONTO_FAMILIA: [number, number][] = [
  [PONTOS_ARCA.familia1[0], PONTOS_ARCA.familia1[2] - 1.4],
  [PONTOS_ARCA.familia2[0], PONTOS_ARCA.familia2[2] - 1.4],
  [PONTOS_ARCA.familia3[0], PONTOS_ARCA.familia3[2] + 1.4],
  [PONTOS_ARCA.familia4[0], PONTOS_ARCA.familia4[2] + 1.4],
];

/** Escada de mão encostada (pé em y0, topo em y1), virada para `yaw`. */
function escadaDeMao(c: Construtor, x: number, z: number, y0: number, y1: number, yaw: number) {
  c.em(x, y0, z, yaw, () => {
    const h = y1 - y0;
    for (const s of [-1, 1]) c.viga(new THREE.Vector3(s * 0.28, 0, 0.25), new THREE.Vector3(s * 0.28, h, 0), 0.04, CORES.madeira, 5);
    for (let y = 0.3; y < h - 0.1; y += 0.35) {
      const t = y / h;
      c.viga(new THREE.Vector3(-0.28, y, 0.25 * (1 - t)), new THREE.Vector3(0.28, y, 0.25 * (1 - t)), 0.03, CORES.madeiraClara, 4);
    }
  });
}

/** Coloca um cilindro unitário (altura 1 em +y) entre dois pontos. */
function posicionarCorda(m: THREE.Mesh | undefined, a: THREE.Vector3, b: THREE.Vector3) {
  if (!m) return;
  const d = b.clone().sub(a);
  const len = d.length();
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, d.normalize());
  m.scale.set(1, Math.max(0.01, len), 1);
}

function mesclarSimples(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.attributes.position.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return out;
}

function patchear(m: THREE.Mesh) {
  const mat = m.material as THREE.Material;
  if (!mat.userData.patch) {
    aplicarPatch(mat, { revelar: true });
    mat.userData.patch = true;
  }
}
