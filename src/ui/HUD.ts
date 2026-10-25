// HUD: retrato e barras do personagem, Unidade, era e hora, bússola com marcadores, rastreador
// de objetivo, prompt de interação (com anel de progresso) e marcadores projetados na tela.
import * as THREE from 'three';
import type { EstadoHUD, MarcadorTela } from '../jogo/contratos';
import { clamp01, el, limpar, tecla } from './dom';
import { classeConhecida, COR_CLASSE, icone, iconeClasse } from './icones';

const TAU = Math.PI * 2;
const CAMPO_BUSSOLA = (150 * Math.PI) / 180;

function embrulhar(a: number) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

const NOMES_ERA: Record<string, string> = { noe: 'Era 1 — Noé', abraao: 'Era 2 — Abraão' };

/** 6,5 → "6h30" */
export function formatarHora(h: number): string {
  h = ((h % 24) + 24) % 24;
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60 / 5) * 5;
  if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
  return `${hh}h${String(mm).padStart(2, '0')}`;
}

export function periodoDia(h: number): string {
  h = ((h % 24) + 24) % 24;
  if (h < 4.5) return 'Madrugada';
  if (h < 7) return 'Amanhecer';
  if (h < 11.5) return 'Manhã';
  if (h < 13.5) return 'Meio-dia';
  if (h < 17) return 'Tarde';
  if (h < 19) return 'Entardecer';
  return 'Noite';
}

interface Barra {
  raiz: HTMLDivElement;
  enchimento: HTMLDivElement;
  valor: HTMLSpanElement;
  rotulo: HTMLSpanElement;
}

function criarBarra(cls: string, rotulo: string, ico: string): Barra {
  const enchimento = el('div', 'barra-enchimento');
  const valor = el('span', 'barra-valor');
  const nome = el('span', 'barra-nome', rotulo);
  const raiz = el('div', `hud-barra ${cls}`,
    el('div', 'barra-rotulo', icone(ico), nome, valor),
    el('div', 'barra-trilho', enchimento),
  );
  return { raiz, enchimento, valor, rotulo: nome };
}

interface ElMarcador {
  tela: HTMLDivElement;
  rotulo: HTMLSpanElement;
  dist: HTMLSpanElement;
  bussola: HTMLDivElement;
  visto: boolean;
}

export class HUD {
  readonly raiz: HTMLDivElement;
  private retrato: HTMLDivElement;
  private nivel: HTMLDivElement;
  private nome: HTMLDivElement;
  private classe: HTMLDivElement;
  private xp: Barra;
  private folego: Barra;
  private dominio: Barra;
  private unidade: Barra;
  private hora: HTMLDivElement;
  private era: HTMLDivElement;
  private icoTempo: HTMLDivElement;
  private faixaBussola: HTMLDivElement;
  private marcasBussola: { el: HTMLElement; ang: number }[] = [];
  private objetivoEl: HTMLDivElement;
  private objTitulo: HTMLDivElement;
  private objTexto: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private promptAnel: SVGCircleElement;
  private promptTecla: HTMLElement;
  private promptTexto: HTMLSpanElement;
  private promptDica: HTMLDivElement;
  private camadaMarcadores: HTMLDivElement;
  private fpsEl: HTMLDivElement;
  private marcadoresEl = new Map<string, ElMarcador>();
  private ultimo = new Map<string, string>();
  private ultimoPrompt = '';
  private ultimoTempoNoite: boolean | null = null;
  private camera: THREE.Camera | null = null;
  private foco: THREE.Vector3 | null = null;
  private v = new THREE.Vector3();
  private rumoAtual = 0;
  private fpsUltimo = 0;
  /** Chamado quando a coluna do retrato muda de altura (os avisos começam logo abaixo dela). */
  aoMudarColuna?: () => void;

  constructor(raizUI: HTMLDivElement) {
    // --- perfil
    this.retrato = el('div', 'hud-retrato');
    this.nivel = el('div', 'hud-nivel');
    this.nome = el('div', 'hud-nome');
    this.classe = el('div', 'hud-classe');
    this.xp = criarBarra('xp', 'Nível', 'brilho');
    this.folego = criarBarra('folego', 'Fôlego', 'coracao');
    this.dominio = criarBarra('dominio', 'Domínio próprio', 'escudo');
    this.unidade = criarBarra('unidade', 'Unidade', 'unidade');
    const perfil = el('div', 'hud-perfil painel-hud',
      el('div', 'hud-retrato-caixa', this.retrato, this.nivel),
      el('div', 'hud-info', el('div', 'hud-nome-linha', this.nome, this.classe), this.xp.raiz, this.folego.raiz, this.dominio.raiz),
    );
    const unidadeCaixa = el('div', 'hud-unidade painel-hud', this.unidade.raiz);
    unidadeCaixa.title = 'Unidade do grupo: sobe com cooperação e paz; cai com contenda.';

    // --- tempo e era
    this.icoTempo = el('div', 'hud-tempo-ico');
    this.hora = el('div', 'hud-hora');
    this.era = el('div', 'hud-era');
    const tempo = el('div', 'hud-tempo painel-hud', this.icoTempo, el('div', null, this.hora, this.era));

    // --- bússola
    this.faixaBussola = el('div', 'bussola-faixa');
    const pontos: [string, number][] = [['N', 0], ['NE', 45], ['L', 90], ['SE', 135], ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]];
    for (let g = 0; g < 360; g += 15) {
      const card = pontos.find((p) => p[1] === g);
      const m = card
        ? el('div', `bussola-ponto${card[0].length === 1 ? ' cardeal' : ''}`, card[0])
        : el('div', 'bussola-traco');
      this.faixaBussola.append(m);
      this.marcasBussola.push({ el: m, ang: (g * Math.PI) / 180 });
    }
    const bussola = el('div', 'bussola', this.faixaBussola, el('div', 'bussola-centro'));

    // --- objetivo
    this.objTitulo = el('div', 'obj-titulo');
    this.objTexto = el('div', 'obj-texto');
    this.objetivoEl = el('div', 'hud-objetivo painel-hud', el('div', 'obj-ico', icone('alvo')), el('div', null, this.objTitulo, this.objTexto));

    // --- prompt
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.classList.add('prompt-anel');
    const fundo = document.createElementNS(ns, 'circle');
    fundo.setAttribute('cx', '20'); fundo.setAttribute('cy', '20'); fundo.setAttribute('r', '17');
    fundo.classList.add('anel-fundo');
    this.promptAnel = document.createElementNS(ns, 'circle');
    this.promptAnel.setAttribute('cx', '20'); this.promptAnel.setAttribute('cy', '20'); this.promptAnel.setAttribute('r', '17');
    this.promptAnel.classList.add('anel-progresso');
    this.promptAnel.setAttribute('pathLength', '100');
    svg.append(fundo, this.promptAnel);
    this.promptTecla = tecla('E');
    this.promptTexto = el('span', 'prompt-texto');
    this.promptDica = el('div', 'prompt-dica');
    const caixaTecla = el('div', 'prompt-tecla');
    caixaTecla.append(svg, this.promptTecla);
    this.promptEl = el('div', 'hud-prompt', el('div', 'prompt-linha', caixaTecla, this.promptTexto), this.promptDica);

    this.camadaMarcadores = el('div', 'marcadores-tela');
    this.fpsEl = el('div', 'hud-fps');

    const esquerda = el('div', 'hud-esquerda', perfil, unidadeCaixa);
    this.raiz = el('div', 'hud', esquerda, bussola, tempo, this.objetivoEl, this.promptEl, this.fpsEl);
    raizUI.append(this.camadaMarcadores, this.raiz);
    // os avisos começam logo abaixo da coluna do retrato, que muda de altura (classe longa, Unidade oculta)
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        raizUI.style.setProperty('--base-esquerda', `${esquerda.offsetTop + esquerda.offsetHeight}px`);
        this.aoMudarColuna?.();
      }).observe(esquerda);
    }
    this.objetivo(null, null);
    this.marcadores([], 0);
  }

  definirCamera(camera: THREE.Camera | null, foco?: THREE.Vector3 | null) {
    this.camera = camera;
    this.foco = foco ?? null;
  }

  private mudou(chave: string, valor: string): boolean {
    if (this.ultimo.get(chave) === valor) return false;
    this.ultimo.set(chave, valor);
    return true;
  }

  private barra(b: Barra, chave: string, atual: number, max: number, texto: string) {
    const f = max > 0 ? clamp01(atual / max) : 0;
    if (this.mudou(chave, `${f.toFixed(3)}|${texto}`)) {
      b.enchimento.style.transform = `scaleX(${f})`;
      b.valor.textContent = texto;
      b.raiz.classList.toggle('baixo', f < 0.25);
    }
  }

  hud(e: EstadoHUD) {
    this.raiz.classList.toggle('oculto', !e.visivel);
    this.camadaMarcadores.classList.toggle('oculto', !e.visivel);
    if (this.mudou('quem', `${e.nome}|${e.classe}|${e.iconeClasse}`)) {
      limpar(this.retrato);
      const c = classeConhecida(e.classe);
      this.retrato.style.background = c ? COR_CLASSE[c] : '#8a6a44';
      this.retrato.append(iconeClasse(e.classe, e.iconeClasse));
      this.nome.textContent = e.nome;
      this.classe.textContent = c ? e.classe.charAt(0).toUpperCase() + e.classe.slice(1) : e.classe;
      if (c === 'hospitaleiro') this.classe.textContent = 'Servo hospitaleiro';
    }
    if (this.mudou('nivel', String(e.nivel))) {
      this.nivel.textContent = String(e.nivel);
      this.xp.rotulo.textContent = `Nível ${e.nivel}`;
    }
    this.barra(this.xp, 'xp', e.xp, e.xpProximo, `${Math.floor(e.xp)} / ${Math.floor(e.xpProximo)} XP`);
    this.barra(this.folego, 'folego', e.folego, e.folegoMax, `${Math.round(e.folego)}`);
    this.dominio.raiz.hidden = e.dominio === null;
    if (e.dominio !== null) this.barra(this.dominio, 'dominio', e.dominio, e.dominioMax, `${Math.round(e.dominio)}`);
    this.barra(this.unidade, 'unidade', e.unidade, 100, `${Math.round(e.unidade)}`);
    const noite = e.hora < 5.5 || e.hora >= 19;
    if (this.ultimoTempoNoite !== noite) {
      this.ultimoTempoNoite = noite;
      limpar(this.icoTempo);
      this.icoTempo.append(icone(noite ? 'lua' : 'sol'));
      this.icoTempo.classList.toggle('noite', noite);
    }
    const hora = `${formatarHora(e.hora)} · ${periodoDia(e.hora)}`;
    if (this.mudou('hora', hora)) this.hora.textContent = hora;
    const era = NOMES_ERA[e.era] ?? e.era;
    if (this.mudou('era', era)) this.era.textContent = era;
  }

  objetivo(titulo: string | null, texto: string | null) {
    if (!titulo && !texto) {
      this.objetivoEl.classList.add('oculto');
      this.ultimo.delete('obj');
      return;
    }
    const chave = `${titulo}|${texto}`;
    if (!this.mudou('obj', chave)) return;
    this.objTitulo.textContent = titulo ?? '';
    this.objTexto.textContent = texto ?? '';
    this.objetivoEl.classList.remove('oculto', 'novo');
    void this.objetivoEl.offsetWidth;
    this.objetivoEl.classList.add('novo');
  }

  prompt(info: { texto: string; tecla: string; pode: boolean; dica?: string; progresso?: number } | null) {
    if (!info) {
      this.promptEl.classList.remove('visivel');
      this.ultimoPrompt = '';
      return;
    }
    const chave = `${info.texto}|${info.tecla}|${info.pode}|${info.dica ?? ''}`;
    if (chave !== this.ultimoPrompt) {
      this.ultimoPrompt = chave;
      this.promptTecla.textContent = info.tecla;
      this.promptTexto.textContent = info.texto;
      this.promptEl.classList.toggle('dica', !info.pode);
      limpar(this.promptDica);
      if (!info.pode) this.promptDica.append(icone('info'), el('span', null, info.dica ?? 'Outro personagem pode fazer isto.'));
    }
    const p = info.pode && info.progresso !== undefined ? clamp01(info.progresso) : 0;
    this.promptEl.classList.toggle('segurando', p > 0);
    this.promptAnel.style.strokeDashoffset = String(100 - p * 100);
    this.promptEl.classList.add('visivel');
  }

  fps(valor: number | null) {
    if (valor === null) {
      this.fpsEl.hidden = true;
      return;
    }
    this.fpsEl.hidden = false;
    const agora = performance.now();
    if (agora - this.fpsUltimo < 250) return;
    this.fpsUltimo = agora;
    this.fpsEl.textContent = `${Math.round(valor)} FPS`;
  }

  /** Atualiza a bússola (yaw da câmera) e os marcadores. */
  marcadores(lista: MarcadorTela[], yawCamera: number) {
    const rumo = embrulhar(-yawCamera);
    if (Math.abs(embrulhar(rumo - this.rumoAtual)) > 0.0005 || !this.ultimo.has('bussola')) {
      this.rumoAtual = rumo;
      this.ultimo.set('bussola', '1');
      for (const m of this.marcasBussola) {
        const rel = embrulhar(m.ang - rumo);
        const visivel = Math.abs(rel) < CAMPO_BUSSOLA / 2;
        m.el.style.display = visivel ? '' : 'none';
        if (visivel) m.el.style.left = `${50 + (rel / CAMPO_BUSSOLA) * 100}%`;
      }
    }

    const cam = this.camera;
    const vistos = new Set<string>();
    if (cam) {
      cam.updateMatrixWorld();
      const origem = this.foco ?? cam.position;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const margem = Math.min(w, h) * 0.07;
      for (const m of lista) {
        vistos.add(m.id);
        let e = this.marcadoresEl.get(m.id);
        if (!e) e = this.criarMarcador(m);
        if (e.rotulo.textContent !== m.rotulo) e.rotulo.textContent = m.rotulo;
        const dist = Math.hypot(m.pos.x - origem.x, m.pos.z - origem.z);
        const dTxt = `${Math.round(dist)} m`;
        if (e.dist.textContent !== dTxt) e.dist.textContent = dTxt;
        // bússola
        const ang = Math.atan2(m.pos.x - origem.x, -(m.pos.z - origem.z));
        const rel = embrulhar(ang - rumo);
        const lim = CAMPO_BUSSOLA / 2 - 0.05;
        const relC = Math.max(-lim, Math.min(lim, rel));
        e.bussola.style.left = `${50 + (relC / CAMPO_BUSSOLA) * 100}%`;
        e.bussola.classList.toggle('borda', relC !== rel);
        // tela
        const vc = this.v.copy(m.pos).applyMatrix4(cam.matrixWorldInverse);
        let x: number;
        let y: number;
        let fora = false;
        if (vc.z < -0.1) {
          this.v.copy(m.pos).project(cam);
          x = (this.v.x * 0.5 + 0.5) * w;
          y = (-this.v.y * 0.5 + 0.5) * h;
          if (x < margem || x > w - margem || y < margem || y > h - margem) fora = true;
        } else {
          fora = true;
          x = w / 2 + vc.x * 1000;
          y = h / 2 + Math.abs(vc.z) * 1000 + Math.abs(vc.x) * 200;
        }
        if (fora) {
          const dx = x - w / 2;
          const dy = y - h / 2;
          const s = Math.min((w / 2 - margem) / Math.max(1e-3, Math.abs(dx)), (h / 2 - margem) / Math.max(1e-3, Math.abs(dy)));
          x = w / 2 + dx * Math.min(1, s);
          y = h / 2 + dy * Math.min(1, s);
        }
        e.tela.classList.toggle('fora', fora);
        e.tela.classList.toggle('perto', dist < 6 && !fora);
        e.tela.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    }
    for (const [id, e] of this.marcadoresEl) {
      if (!vistos.has(id)) {
        e.tela.remove();
        e.bussola.remove();
        this.marcadoresEl.delete(id);
      }
    }
  }

  private criarMarcador(m: MarcadorTela): ElMarcador {
    const ico = m.tipo === 'personagem' ? 'pessoa' : m.tipo === 'interativo' ? 'mao' : 'alvo';
    const rotulo = el('span', 'marcador-rotulo');
    const dist = el('span', 'marcador-dist');
    const tela = el('div', `marcador-tela tipo-${m.tipo}`, el('div', 'marcador-pino', icone(ico)), el('div', 'marcador-textos', rotulo, dist));
    const bussola = el('div', `bussola-marcador tipo-${m.tipo}`, icone(ico));
    this.camadaMarcadores.append(tela);
    this.faixaBussola.append(bussola);
    const e: ElMarcador = { tela, rotulo, dist, bussola, visto: true };
    this.marcadoresEl.set(m.id, e);
    return e;
  }
}
