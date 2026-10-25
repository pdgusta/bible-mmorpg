import * as THREE from 'three';
import type { Jogo } from '../jogo/Jogo';
import type { Personagem } from '../jogo/Personagem';
import type { Mundo } from '../mundo/Mundo';
import { GLOBAIS } from '../render/Shaders';
import { clamp, easeIn, easeInOut, lerp, wrapAngle } from '../core/util';

export interface OpcoesTransicaoEra {
  /** Protagonista da era que termina (o close começa no rosto dele). */
  de: Personagem;
  /** Constrói o mundo da próxima era (chamado já no close dourado; pode demorar). */
  criarMundo: () => Promise<Mundo>;
  /** Cria o protagonista no novo mundo (chamado depois de `jogo.definirMundo(novo)`). */
  criarProtagonista: (m: Mundo) => Personagem;
  /** Genealogia que passa como fios de luz (Gn 11:10-26). */
  nomes: string[];
  /** Cada nome, na hora em que deve aparecer (a UI desenha). Sem ele, um texto simples. */
  aoNome?: (nome: string, i: number) => void;
  /** Ids das eras para o evento 'era:transicao'. */
  eras?: { de: string; para: string };
  /** Hora do dia no novo mundo. */
  hora?: number;
  /** Segundos entre um nome e o próximo (padrão 0,62). */
  intervaloNomes?: number;
}

/** Raio (m) a partir do qual o mundo começa a se dissolver / até onde se revela. */
const RAIO_TOTAL = 420;
const RAIO_INFINITO = 1e6;

/**
 * Raio (m) da órbita em volta do rosto no close. Mais perto que isso a cabeça enche a tela e o
 * plano próximo corta o turbante e o manto.
 */
const RAIO_CLOSE = 1.5;

const suave = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Roda `fn(k, dt)` a cada quadro do jogo por `dur` segundos de jogo (k vai de 0 a 1). */
function durante(jogo: Jogo, dur: number, fn: (k: number, dt: number) => void): Promise<void> {
  return new Promise((resolver) => {
    if (dur <= 0) {
      fn(1, 0);
      resolver();
      return;
    }
    let t = 0;
    const off = jogo.aCadaQuadro((dt) => {
      t += dt;
      const k = Math.min(1, t / dur);
      fn(k, dt);
      if (k >= 1) {
        off();
        resolver();
      }
    });
  });
}

/** Pose em coordenadas cilíndricas em volta de um ponto (para orbitar sem atravessar o corpo). */
interface Orbita {
  ang: number;
  raio: number;
  altura: number;
}

function orbitaDe(centro: THREE.Vector3, pos: THREE.Vector3): Orbita {
  return { ang: Math.atan2(pos.x - centro.x, pos.z - centro.z), raio: Math.hypot(pos.x - centro.x, pos.z - centro.z), altura: pos.y - centro.y };
}

function posOrbita(centro: THREE.Vector3, o: Orbita, out: THREE.Vector3) {
  return out.set(centro.x + Math.sin(o.ang) * o.raio, centro.y + o.altura, centro.z + Math.cos(o.ang) * o.raio);
}

/** Ponto do rosto (um pouco acima do osso da cabeça e à frente). */
function rosto(p: Personagem, out: THREE.Vector3) {
  p.humano.raiz.updateMatrixWorld(true);
  p.humano.posicaoOsso('Head', out);
  const f = p.frente();
  return out.set(out.x + f.x * 0.06, out.y + 0.1, out.z + f.z * 0.06);
}

/**
 * Transição entre eras, visualmente oposta à troca de personagem: aproximação até o rosto do
 * protagonista, luz dourada (Ceu.gloria), o mundo se dissolve em volta dele, os nomes da
 * genealogia passam, o novo mundo é trocado por trás (sem tela de carregamento: o laço não
 * para) e se revela em onda a partir do novo protagonista enquanto a câmera se afasta.
 */
export async function transicaoEra(jogo: Jogo, op: OpcoesTransicaoEra): Promise<void> {
  const cam = jogo.cam;
  const c = cam.camera;
  const liberar = jogo.bloquear('transicao');
  jogo.transicao = true;
  jogo.controle.reiniciar();
  jogo.troca.camera.cancelar();
  if (jogo.cinematica.ativa) jogo.cinematica.devolver();
  if (op.eras) jogo.eventos.emit('era:transicao', { de: op.eras.de, para: op.eras.para });

  const de = op.de;
  if (de.posto) jogo.controle.liberarPosto(de);
  if (de.escalada) de.sairEscalada('aqui');
  de.emCena = true;
  cam.externo = true;
  const fov0 = c.fov;
  const filtro = new FiltroDourado(jogo.canvas);
  const nomes = new Genealogia(op.nomes, op.aoNome, op.intervaloNomes ?? 0.62);
  const foco = new THREE.Vector3();
  jogo.focoExterno = foco;
  const olhar = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const centroRosto = new THREE.Vector3();
  // o terreno usa os mesmos uniforms (GLOBAIS); as faixas de Shaders.ts afundam o chão depois
  // de a vegetação e as estruturas encolherem (nada flutua)
  const definirRaio = (r: number, centro: THREE.Vector3) => {
    GLOBAIS.uCentro.value.set(centro.x, centro.z);
    GLOBAIS.uRaio.value = r;
  };
  /** Esconde quem está fora do raio (pessoas não usam o "patch" de revelação). */
  const visibilidade = (r: number, centro: THREE.Vector3, exceto: Personagem) => {
    const m = jogo.mundo;
    if (!m) return;
    for (const p of m.personagens.values()) {
      if (p === exceto) continue;
      p.humano.visivel = Math.hypot(p.posicao.x - centro.x, p.posicao.z - centro.z) < r - 8;
    }
    if (m.agua) m.agua.malha.visible = r > RAIO_TOTAL * 0.75;
  };

  try {
    // 1) aproximação até o rosto, em órbita (sem atravessar o corpo), o olhar se erguendo
    rosto(de, centroRosto);
    foco.copy(de.posicao);
    c.getWorldDirection(tmp);
    const olhar0 = c.position.clone().addScaledVector(tmp, Math.max(3, cam.distancia));
    const o0 = orbitaDe(centroRosto, c.position);
    const angFrente = Math.atan2(de.frente().x, de.frente().z) + 0.32;
    const o1: Orbita = { ang: o0.ang + wrapAngle(angFrente - o0.ang), raio: RAIO_CLOSE + 0.15, altura: 0.06 };
    de.humano.olharPara = centroRosto.clone().add(de.frente().multiplyScalar(3)).add(new THREE.Vector3(0, 2.2, 0));
    await durante(jogo, 2.6, (k) => {
      const s = suave(k);
      rosto(de, centroRosto);
      posOrbita(centroRosto, { ang: lerp(o0.ang, o1.ang, s), raio: lerp(o0.raio, o1.raio, s), altura: lerp(o0.altura, o1.altura, s) }, c.position);
      olhar.lerpVectors(olhar0, centroRosto, Math.min(1, s * 1.25));
      c.fov = lerp(fov0, 38, s);
      c.updateProjectionMatrix();
      c.lookAt(olhar);
      jogo.ceu.gloria = 0.45 * easeIn(k);
      filtro.aplicar(0.35 * k, 0);
    });

    // 2) glória: o mundo se dissolve em volta dele; os nomes começam a passar
    const centro = de.posicao.clone();
    nomes.iniciar();
    await durante(jogo, 3.2, (k, dt) => {
      nomes.atualizar(dt);
      rosto(de, centroRosto);
      posOrbita(centroRosto, { ang: o1.ang + k * 0.12, raio: lerp(o1.raio, RAIO_CLOSE, k), altura: o1.altura }, c.position);
      c.lookAt(centroRosto);
      const r = lerp(RAIO_TOTAL, 1.5, easeInOut(k));
      definirRaio(r, centro);
      visibilidade(r, centro, de);
      jogo.ceu.gloria = lerp(0.45, 0.95, k);
      filtro.aplicar(lerp(0.35, 0.8, k), 0);
    });

    // 3) o novo mundo é construído por trás do close (o laço continua; nomes seguem passando)
    const pendente = { novo: null as Mundo | null, erro: null as unknown };
    const construcao = op.criarMundo().then((m) => (pendente.novo = m), (e) => (pendente.erro = e));
    let respiro = 0;
    const off = jogo.aCadaQuadro((dt) => {
      nomes.atualizar(dt);
      respiro += dt;
      rosto(de, centroRosto);
      posOrbita(centroRosto, { ang: o1.ang + 0.12 + respiro * 0.03, raio: RAIO_CLOSE, altura: o1.altura }, c.position);
      c.lookAt(centroRosto);
    });
    await construcao;
    if (pendente.erro) {
      off();
      throw pendente.erro;
    }
    // deixa todos os nomes passarem antes de revelar
    await new Promise<void>((r) => {
      const off2 = jogo.aCadaQuadro(() => {
        if (nomes.terminou) {
          off2();
          r();
        }
      });
    });
    off();
    const novo = pendente.novo!;

    // clarão dourado: a troca acontece no auge da luz
    await durante(jogo, 0.45, (k) => filtro.aplicar(lerp(0.8, 1, k), easeIn(k)));
    GLOBAIS.uRaio.value = 0;
    jogo.definirMundo(novo);
    const prot = op.criarProtagonista(novo);
    jogo.controlar(prot);
    prot.emCena = true;
    if (op.hora !== undefined) jogo.ceu.hora = op.hora;
    const centro2 = prot.posicao.clone();
    foco.copy(centro2);
    definirRaio(0, centro2);
    visibilidade(0, centro2, prot);
    // compila os materiais do mundo novo durante o clarão (evita engasgos na revelação)
    try {
      await jogo.render.gl.compileAsync(jogo.cena, c);
    } catch {
      /* sem compileAsync: compila no primeiro quadro */
    }
    rosto(prot, centroRosto);
    const angFrente2 = Math.atan2(prot.frente().x, prot.frente().z) + 0.32;
    const oRosto: Orbita = { ang: angFrente2, raio: RAIO_CLOSE, altura: 0.06 };
    posOrbita(centroRosto, oRosto, c.position);
    c.lookAt(centroRosto);
    prot.humano.olharPara = centroRosto.clone().add(prot.frente().multiplyScalar(3)).add(new THREE.Vector3(0, 1.6, 0));
    nomes.fechar();
    await durante(jogo, 0.5, (k) => filtro.aplicar(lerp(1, 0.75, k), 1 - easeInOut(k)));

    // 4) revelação em onda a partir do personagem; a câmera se afasta até a pose de jogo
    const yawFinal = prot.yaw + Math.PI;
    cam.yaw = yawFinal;
    const posFinal = new THREE.Vector3();
    const olharFinal = new THREE.Vector3();
    await durante(jogo, 5.2, (k) => {
      const s = suave(k);
      rosto(prot, centroRosto);
      if (k > 0.35) prot.humano.olharPara = null;
      cam.calcularPose(prot.posicao, novo.fisica, posFinal, olharFinal, yawFinal, cam.pitch, cam.distanciaAlvo);
      const oF = orbitaDe(centroRosto, posFinal);
      const ang = oRosto.ang + wrapAngle(oF.ang - oRosto.ang) * s;
      // afasta com um arco: sobe e abre mais que a pose final no meio do caminho
      const raio = lerp(oRosto.raio, oF.raio, s) + Math.sin(Math.PI * s) * 9;
      const altura = lerp(oRosto.altura, oF.altura, s) + Math.sin(Math.PI * s) * 5.5;
      posOrbita(centroRosto, { ang, raio, altura }, c.position);
      const chao = novo.relevo.altura(c.position.x, c.position.z) + 0.5;
      if (c.position.y < chao) c.position.y = chao;
      olhar.lerpVectors(centroRosto, olharFinal, s);
      c.fov = lerp(38, fov0, s);
      c.updateProjectionMatrix();
      c.lookAt(olhar);
      const r = lerp(0, RAIO_TOTAL, easeIn(Math.min(1, k * 1.08)));
      definirRaio(r, centro2);
      visibilidade(r, centro2, prot);
      jogo.ceu.gloria = 0.95 * (1 - easeInOut(Math.min(1, k * 1.25)));
      filtro.aplicar(0.75 * (1 - k), 0);
    });
  } finally {
    // estado limpo mesmo se algo falhar
    GLOBAIS.uRaio.value = RAIO_INFINITO;
    const m = jogo.mundo;
    if (m) {
      for (const p of m.personagens.values()) p.humano.visivel = true;
      if (m.agua) m.agua.malha.visible = true;
    }
    jogo.ceu.gloria = 0;
    filtro.remover();
    nomes.fechar();
    c.fov = fov0;
    c.updateProjectionMatrix();
    jogo.focoExterno = null;
    const a = jogo.ativo;
    if (a) {
      a.emCena = false;
      a.humano.olharPara = null;
      cam.externo = false;
      cam.encaixar(a.posicao, undefined, jogo.mundo?.fisica);
    } else cam.externo = false;
    jogo.transicao = false;
    liberar();
  }
}

/** Luz dourada sobre a imagem: filtro CSS no canvas + um halo radial em "screen". */
class FiltroDourado {
  private halo: HTMLDivElement;
  constructor(private canvas: HTMLCanvasElement) {
    const d = document.createElement('div');
    d.id = 'filtro-era';
    d.style.cssText = 'position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;background:radial-gradient(ellipse at 50% 42%,rgba(255,236,190,.15) 0%,rgba(255,214,140,.55) 55%,rgba(255,196,110,.9) 100%)';
    canvas.insertAdjacentElement('afterend', d);
    this.halo = d;
  }

  /** k: intensidade do dourado (0..1); clarao: brilho extra do auge (0..1). */
  aplicar(k: number, clarao: number) {
    k = clamp(k, 0, 1);
    this.canvas.style.filter = k + clarao <= 0.001 ? '' : `sepia(${(0.45 * k).toFixed(3)}) saturate(${(1 + 0.35 * k).toFixed(3)}) brightness(${(1 + 0.18 * k + 1.4 * clarao).toFixed(3)})`;
    this.halo.style.opacity = clamp(k * 0.8 + clarao, 0, 1).toFixed(3);
  }

  remover() {
    this.canvas.style.filter = '';
    this.halo.remove();
  }
}

/** Agenda os nomes da genealogia; sem `aoNome`, mostra um texto dourado simples. */
class Genealogia {
  private t = 0;
  private i = 0;
  private ativo = false;
  private el: HTMLDivElement | null = null;
  constructor(private nomes: string[], private aoNome: ((nome: string, i: number) => void) | undefined, private intervalo: number) {}

  get terminou() {
    return this.i >= this.nomes.length && this.t >= this.intervalo;
  }

  iniciar() {
    this.ativo = true;
    this.t = this.intervalo;
  }

  atualizar(dt: number) {
    if (!this.ativo) return;
    this.t += dt;
    if (this.i < this.nomes.length && this.t >= this.intervalo) {
      this.t = 0;
      const nome = this.nomes[this.i];
      if (this.aoNome) this.aoNome(nome, this.i);
      else this.mostrar(nome, this.i);
      this.i++;
    }
  }

  private mostrar(nome: string, i: number) {
    if (!this.el) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;right:0;top:12%;text-align:center;pointer-events:none;font:500 15px/1.5 Georgia,serif;letter-spacing:.08em;color:#fff6dc;text-shadow:0 0 12px #ffcf70,0 0 2px #a8742a';
      document.body.appendChild(d);
      this.el = d;
    }
    const s = document.createElement('span');
    s.textContent = (i > 0 ? '  ·  ' : '') + nome;
    s.style.cssText = 'opacity:0;transition:opacity .8s';
    this.el.appendChild(s);
    requestAnimationFrame(() => (s.style.opacity = '1'));
  }

  fechar() {
    this.ativo = false;
    this.el?.remove();
    this.el = null;
  }
}
