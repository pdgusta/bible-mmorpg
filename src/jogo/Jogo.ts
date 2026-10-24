import * as THREE from 'three';
import { Renderizador, type Qualidade } from '../render/Renderizador';
import { Ceu } from '../render/Ceu';
import { GLOBAIS } from '../render/Shaders';
import { Ativos } from '../render/Ativos';
import { Entrada } from '../core/Entrada';
import { Eventos } from '../core/Eventos';
import { CameraTerceira } from '../camera/CameraTerceira';
import { CopasCamera } from '../camera/Copas';
import { CorpoBase } from '../entidades/humano/CorpoBase';
import type { Mundo } from '../mundo/Mundo';
import { Personagem, type Comando, type DefPersonagem } from './Personagem';
import type { ContextoIA } from './IA';
import type { InterfaceUI, TipoProva } from './contratos';
import { Troca } from './Troca';
import { Controle } from './Controle';
import { Cinematica } from '../camera/Cinematica';
import { clamp } from '../core/util';

export interface Corpos {
  masc: CorpoBase;
  fem: CorpoBase;
}

/**
 * Núcleo do jogo: renderização, laço, câmera, mundo atual, personagens e controle do jogador.
 * Sistemas de história (missões, diálogos, provas, UI) se ligam pelos eventos.
 */
export class Jogo {
  readonly canvas: HTMLCanvasElement;
  readonly render: Renderizador;
  readonly cena = new THREE.Scene();
  readonly ceu: Ceu;
  readonly ativos = new Ativos();
  readonly entrada: Entrada;
  readonly eventos = new Eventos();
  readonly cam: CameraTerceira;
  mundo: Mundo | null = null;
  corpos!: Corpos;
  natureza!: THREE.Object3D;
  ativo: Personagem | null = null;
  /** Quando falso, o jogador não move o personagem (diálogos, cinemáticas, menus). */
  controleLivre = true;
  pausado = false;
  tempo = 0;
  flags: Record<string, unknown> = {};
  private relogio = new THREE.Clock();
  private aoQuadro = new Set<(dt: number) => void>();
  private ctxIA: ContextoIA;
  readonly focoCamera = new THREE.Vector3();
  quadro = 0;
  /** Camada de interface (opcional: o jogo funciona sem ela). O orquestrador faz `jogo.ui = ui`. */
  ui?: InterfaceUI;
  /** Troca de personagem (teclas 1–5, Tab, câmera aérea). */
  readonly troca: Troca;
  /** Interações, postos, escalada, oração, habilidade e comandos (por quadro). */
  readonly controle: Controle;
  /** Câmera de cinemática (serviço dos scripts de missão). */
  readonly cinematica: Cinematica;
  /** Prova espiritual em andamento (eventos 'prova:inicio'/'prova:fim'). */
  prova: { id: string; tipo?: TipoProva; livre: boolean } | null = null;
  /** Transição entre eras em andamento (TransicaoEra). */
  transicao = false;
  /** Multiplicador do tempo de jogo (câmera lenta com a roda de personagens aberta). */
  escalaTempo = 1;
  /** Testes: o laço só renderiza; a lógica avança por `avancar()`. */
  manual = false;
  /** Quando definido, a vegetação/grama/sombras seguem este ponto em vez do personagem ativo. */
  focoExterno: THREE.Vector3 | null = null;
  /**
   * Quando verdadeiro, o jogador não move o personagem nem a câmera (diálogo ou menu da UI
   * abertos). O orquestrador (Partida) liga a `ui.bloqueado()`.
   */
  entradaBloqueada: () => boolean = () => false;
  /** Em modo manual (testes), o laço renderiza a cada quadro do navegador? (falso acelera o e2e) */
  renderizarManual = true;
  private bloqueios = new Map<string, number>();
  private semGiroCamera = 0;

  constructor(canvas: HTMLCanvasElement, qualidade: Qualidade) {
    this.canvas = canvas;
    this.render = new Renderizador(canvas, qualidade);
    this.ceu = new Ceu(this.cena, this.render.preset.sombra);
    this.ceu.ajustarDistancia(this.render.preset.distancia);
    this.cam = new CameraTerceira(this.render.aspecto);
    this.entrada = new Entrada(canvas);
    window.addEventListener('resize', () => {
      this.cam.camera.aspect = this.render.aspecto;
      this.cam.camera.updateProjectionMatrix();
    });
    this.ctxIA = {
      hora: 9,
      flags: this.flags,
      ponto: (n) => this.mundo?.pontos.get(n) ?? null,
      nav: null,
      jogador: null,
    };
    this.cinematica = new Cinematica(this.cam, () => this.mundo?.fisica ?? null, () => this.ativo?.posicao ?? null);
    this.troca = new Troca(this);
    this.controle = new Controle(this);
    // diálogos e provas bloqueiam a troca sozinhos (os sistemas só emitem os eventos)
    this.eventos.on('dialogo:inicio', () => this.bloquear('dialogo'));
    this.eventos.on('dialogo:fim', () => this.liberar('dialogo'));
    this.eventos.on<{ id: string; tipo?: TipoProva; livre?: boolean }>('prova:inicio', (d) => {
      this.prova = { id: d?.id ?? 'prova', tipo: d?.tipo, livre: !!d?.livre };
    });
    this.eventos.on('prova:fim', () => {
      this.prova = null;
    });
  }

  /**
   * Bloqueia a troca de personagem (e o que mais depender de `podeTrocar`) por um motivo.
   * Devolve a função que libera. Motivos repetidos se acumulam (cada bloquear pede um liberar).
   */
  bloquear(motivo: string): () => void {
    this.bloqueios.set(motivo, (this.bloqueios.get(motivo) ?? 0) + 1);
    let feito = false;
    return () => {
      if (feito) return;
      feito = true;
      this.liberar(motivo);
    };
  }

  /** Libera um bloqueio por motivo (sem a função devolvida por `bloquear`). */
  liberar(motivo: string) {
    const n = (this.bloqueios.get(motivo) ?? 0) - 1;
    if (n > 0) this.bloqueios.set(motivo, n);
    else this.bloqueios.delete(motivo);
  }

  bloqueado(motivo?: string) {
    return motivo ? this.bloqueios.has(motivo) : this.bloqueios.size > 0;
  }

  /** Pode trocar de personagem agora? (fora de diálogos, cinemáticas, provas e menus) */
  get podeTrocar(): boolean {
    return !!this.mundo && !!this.ativo && this.controleLivre && !this.pausado && this.bloqueios.size === 0 && !this.prova
      && !this.troca.emAndamento && !this.cinematica.ativa && !this.transicao && !this.ativo.emCena
      // a própria roda conta como "menu aberto" na UI: ela não impede a troca
      && (this.troca.rodaAberta || !(this.ui?.menuAberto() ?? false));
  }

  async carregarBase(progresso?: (f: number, nome: string) => void) {
    this.ativos.aoProgresso = progresso;
    let gm, gf, nat;
    try {
      [gm, gf, nat] = await Promise.all([
        this.ativos.carregar('personagens/humano.glb'),
        this.ativos.carregar('personagens/humana.glb'),
        this.ativos.carregar('natureza.glb'),
      ]);
    } finally {
      // o progresso é só da carga base: modelos carregados depois (animais) não reabrem a tela
      this.ativos.aoProgresso = undefined;
    }
    this.corpos = { masc: new CorpoBase(gm, gm.animations), fem: new CorpoBase(gf, gm.animations) };
    this.natureza = nat.scene;
  }

  definirMundo(m: Mundo) {
    if (this.mundo) {
      this.cena.remove(this.mundo.grupo);
      this.mundo.dispose();
    }
    if (this.ativo && m.personagens.get(this.ativo.id) !== this.ativo) {
      this.ativo = null;
      this.ctxIA.jogador = null;
    }
    this.troca.camera.cancelar();
    this.controle.reiniciar();
    this.mundo = m;
    this.cena.add(m.grupo);
    m.natureza.distanciaMax = this.render.preset.distancia;
    m.grama.densidadeGlobal = this.render.preset.densidadeGrama;
    this.ctxIA.nav = m.nav;
    this.cam.copas = new CopasCamera(m.natureza);
  }

  criarPersonagem(def: DefPersonagem, x: number, z: number, yaw = 0): Personagem {
    if (!this.mundo) throw new Error('sem mundo');
    const p = new Personagem(def, def.aparencia.corpo === 'fem' ? this.corpos.fem : this.corpos.masc, () => this.flags);
    const y = this.mundo.chao(x, z);
    p.teleportar(x, y, z, yaw);
    this.mundo.personagens.set(def.id, p);
    this.mundo.grupo.add(p.humano.raiz);
    return p;
  }

  personagem(id: string): Personagem {
    const p = this.mundo?.personagens.get(id);
    if (!p) throw new Error(`personagem ausente: ${id}`);
    return p;
  }

  /**
   * Passa o controle do jogador para `p`. O anterior volta à IA: por padrão espera onde está
   * ('rotina' devolve à rotina; 'manter' não mexe na ordem). Quem está num posto ou escalando
   * continua lá.
   */
  controlar(p: Personagem, opcoes: { anterior?: 'esperar' | 'rotina' | 'manter' } = {}) {
    const ant = this.ativo;
    if (ant && ant !== p) {
      ant.controlado = false;
      const modo = opcoes.anterior ?? 'esperar';
      if (!ant.posto && !ant.escalada) {
        if (modo === 'esperar') ant.ia.esperar();
        else if (modo === 'rotina') ant.ia.voltarARotina();
      }
    }
    this.ativo = p;
    p.controlado = true;
    this.ctxIA.jogador = p;
    this.eventos.emit('controle', p);
  }

  /** Ninguém sob controle do jogador (tela de título): o ativo volta à rotina. */
  soltarControle() {
    const a = this.ativo;
    if (a) {
      a.controlado = false;
      if (!a.posto && !a.escalada) a.ia.voltarARotina();
    }
    this.ativo = null;
    this.ctxIA.jogador = null;
  }

  aCadaQuadro(fn: (dt: number) => void) {
    this.aoQuadro.add(fn);
    return () => this.aoQuadro.delete(fn);
  }

  iniciar() {
    this.relogio.start();
    const laco = () => {
      requestAnimationFrame(laco);
      if (this.manual) {
        if (this.renderizarManual) this.renderizar();
      } else this.passo();
    };
    requestAnimationFrame(laco);
  }

  /** Um quadro (exposto para os testes automáticos avançarem o tempo). */
  passo(dtForcado?: number) {
    const dtReal = this.relogio.getDelta();
    const dt = clamp(dtForcado ?? dtReal, 0, 1 / 20) * this.escalaTempo;
    this.render.medir(dtReal);
    this.entrada.lerControle();
    if (!this.pausado) this.atualizar(dt);
    this.renderizar();
    this.entrada.fimDoQuadro();
    this.quadro++;
  }

  renderizar() {
    this.render.gl.render(this.cena, this.cam.camera);
  }

  /**
   * Testes: avança a lógica `segundos` em passos fixos, sem renderizar, cedendo ao event loop
   * entre os quadros (promessas e tarefas assíncronas continuam andando).
   */
  async avancar(segundos: number, dt = 1 / 30) {
    let t = 0;
    while (t < segundos - 1e-6) {
      this.entrada.lerControle();
      if (!this.pausado) this.atualizar(dt * this.escalaTempo);
      this.entrada.fimDoQuadro();
      this.quadro++;
      t += dt;
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  private comandoJogador(): Comando | null {
    if (!this.controleLivre || !this.ativo || !this.ativo.controlado || this.ativo.emCena || this.transicao) return null;
    if (this.controle.prendeMovimento || this.entradaBloqueada()) return { x: 0, z: 0, correr: false, pular: false, agachar: false, subir: 0 };
    const e = this.entrada;
    let fx = (e.ativa('direita') ? 1 : 0) - (e.ativa('esquerda') ? 1 : 0) + e.eixoMovX;
    let fz = (e.ativa('frente') ? 1 : 0) - (e.ativa('tras') ? 1 : 0) - e.eixoMovY;
    const len = Math.hypot(fx, fz);
    if (len > 1) { fx /= len; fz /= len; }
    const f = this.cam.frente();
    const d = this.cam.direita();
    return {
      x: f.x * fz + d.x * fx,
      z: f.z * fz + d.z * fx,
      correr: e.ativa('correr'),
      pular: e.pressionou('pular'),
      agachar: e.ativa('agachar'),
      subir: clamp(fz, -1, 1),
    };
  }

  private atualizar(dt: number) {
    this.tempo += dt;
    GLOBAIS.uTempo.value = this.tempo;
    const m = this.mundo;
    if (!m) return;
    this.cam.desfazerEfeitos();
    this.ctxIA.hora = this.ceu.hora;
    const menu = this.ui?.menuAberto() ?? false;
    if (this.controleLivre && !this.cam.externo && !this.troca.rodaAberta && !menu && !this.entradaBloqueada()) this.cam.entradaMouse(this.entrada, dt);
    this.troca.atualizar(dt);
    this.controle.atualizar(dt);
    const cmd = this.comandoJogador();
    const camPos = this.cam.camera.position;
    for (const p of m.personagens.values()) {
      const d = p.posicao.distanceTo(camPos);
      const jogador = p === this.ativo && p.controlado;
      p.atualizar(dt, m.fisica, jogador ? (cmd ?? { x: 0, z: 0, correr: false, pular: false, agachar: false }) : null, d, this.ctxIA);
    }
    this.controle.depoisDoMovimento(dt);
    for (const fn of this.aoQuadro) fn(dt);
    if (this.ativo) {
      m.verificarAreas(this.ativo);
      this.focoCamera.copy(this.ativo.posicao);
    }
    if (this.focoExterno) this.focoCamera.copy(this.focoExterno);
    else if (this.troca.camera.ativa) this.focoCamera.copy(this.troca.camera.foco);
    else if (this.cinematica.ativa) this.focoCamera.copy(this.cinematica.olhar);
    this.seguirComControle(dt);
    this.cam.atualizar(dt, this.focoCamera, m.fisica);
    this.cinematica.atualizar(dt);
    this.troca.camera.atualizar(dt);
    this.cam.aplicarEfeitos(dt);
    this.ceu.atualizar(dt, this.focoCamera, this.tempo);
    this.troca.camera.ajustarNeblina(this.ceu.neblina);
    if (m.agua) m.agua.sincronizarLuz(this.ceu.direcaoSol, this.ceu.sol.color, this.ceu.corNeblinaBase, this.ceu.escuridao);
    m.atualizar(dt, this.tempo, this.cam.camera, this.focoCamera);
  }

  /** Com controle (gamepad), a câmera volta devagar para trás do personagem quando ele anda. */
  private seguirComControle(dt: number) {
    const e = this.entrada;
    const a = this.ativo;
    if (Math.abs(e.eixoCamX) + Math.abs(e.eixoCamY) > 0.01 || e.mouseDX || e.mouseDY) this.semGiroCamera = 0;
    else this.semGiroCamera += dt;
    if (!a || !e.usandoControle || this.cam.externo || !this.controleLivre) return;
    if (this.semGiroCamera > 1.2 && a.velocidade > 1.5 && !a.posto && !a.escalada) this.cam.girarPara(a.yaw + Math.PI, dt, 0.9);
  }
}
