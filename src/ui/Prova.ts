// Overlay das provas espirituais: "dardos" de mentira como cartões escuros que avançam para o
// centro (os bloqueados ficam dourados e caem), barra de firmeza, progresso, "Está escrito" (Q),
// Escudo da fé (botão direito), memórias para a dúvida (as cinco da vez, teclas 1–5) e mensagens ("A luta continua").
import type { EstadoProvaUI, TipoProva } from '../jogo/contratos';
import type { CtxUI } from './contexto';
import { clamp01, el, limpar, tecla } from './dom';
import { afastarDePaineis, distribuirSussurros, type Ret } from './AreaLivre';
import { icone } from './icones';
import { dividirMemorias } from './ListaMemorias';

const FIRMEZA: Record<TipoProva, string> = {
  tentacao: 'Domínio próprio',
  ira: 'Calma',
  medo: 'Calma',
  duvida: 'Confiança',
};

const NOME_TIPO: Record<TipoProva, string> = {
  tentacao: 'Tentação',
  ira: 'Provocação',
  medo: 'Medo',
  duvida: 'Dúvida',
};

interface ElDardo {
  el: HTMLDivElement;
  bloqueado: boolean;
  x: number;
  y: number;
  /** Tamanho do cartão (px), medido quando entra. */
  larg: number;
  alt: number;
  /** Tem vaga na tela (os outros esperam a vez, invisíveis). */
  naTela: boolean;
}

/** Painéis que o sussurro não cobre (os que não estão na tela são ignorados). */
const PAINEIS_PROVA = [
  '.hud-esquerda', '.hud-tempo', '.bussola', '.hud-objetivo', '.hud-prompt', '.avisos', '.dica-tutorial', '.faixa-versiculo',
  '.prova-topo', '.prova-firmeza', '.prova-acoes', '.prova-memorias', '.prova-mensagem',
];
/** Painéis que passam (sem lugar livre, o sussurro mais urgente pode cobri-los; os outros, nunca). */
const PASSAGEIROS = ['.avisos', '.dica-tutorial', '.faixa-versiculo', '.prova-mensagem'];
/** Para onde os dardos andam, em fração da tela (o mesmo CENTRO_X/CENTRO_Y de Provas.ts). */
const ALVO_DARDOS = { x: 0.5, y: 0.55 };
/** De quanto em quanto tempo (ms) os painéis são medidos de novo. */
const MEDIR_PAINEIS_MS = 400;

export class OverlayProva {
  private raiz: HTMLDivElement;
  private vinheta: HTMLDivElement;
  private tipoEl: HTMLDivElement;
  private titulo: HTMLDivElement;
  private instrucao: HTMLDivElement;
  private progresso: HTMLDivElement;
  private firmeza: HTMLDivElement;
  private firmezaRot: HTMLSpanElement;
  private firmezaVal: HTMLSpanElement;
  private camadaDardos: HTMLDivElement;
  private palavra: HTMLButtonElement;
  private escudo: HTMLDivElement;
  private memorias: HTMLDivElement;
  private mensagem: HTMLDivElement;
  private dardos = new Map<number, ElDardo>();
  private chaves = new Map<string, string>();
  private ativa = false;
  private paineis: Ret[] = [];
  private paineisEm = -Infinity;
  /** A tela mudou de tamanho: o rem e os painéis mudam, e os dardos são medidos de novo. */
  private medidasVelhas = false;
  private readonly aoRedimensionar = () => {
    this.paineisEm = -Infinity;
    this.medidasVelhas = true;
  };

  constructor(private ctx: CtxUI) {
    window.addEventListener('resize', this.aoRedimensionar);
    this.vinheta = el('div', 'prova-vinheta');
    this.tipoEl = el('div', 'prova-tipo');
    this.titulo = el('div', 'prova-titulo');
    this.instrucao = el('div', 'prova-instrucao');
    this.progresso = el('div', 'prova-progresso-ench');
    this.firmeza = el('div', 'prova-firmeza-ench');
    this.firmezaRot = el('span', null);
    this.firmezaVal = el('span', 'prova-firmeza-val');
    this.camadaDardos = el('div', 'prova-dardos');
    this.palavra = el('button', 'prova-palavra');
    this.palavra.type = 'button';
    this.palavra.addEventListener('click', () => this.ctx.acoes().estaEscrito?.());
    this.escudo = el('div', 'prova-escudo', el('div', 'prova-acao-tecla', icone('mouseDireito')), el('div', null, el('div', 'prova-acao-nome', 'Escudo da fé'), el('div', 'prova-acao-sub', 'segure o botão direito')));
    this.memorias = el('div', 'prova-memorias');
    this.mensagem = el('div', 'prova-mensagem');
    this.raiz = el('div', 'prova',
      this.vinheta,
      this.camadaDardos,
      el('div', 'prova-topo painel-hud',
        el('div', 'prova-cab', this.tipoEl, this.titulo),
        this.instrucao,
        el('div', 'prova-progresso', el('div', 'prova-progresso-trilho', this.progresso)),
      ),
      el('div', 'prova-firmeza painel-hud',
        el('div', 'prova-firmeza-rot', icone('escudo'), this.firmezaRot, this.firmezaVal),
        el('div', 'prova-firmeza-trilho', this.firmeza),
      ),
      el('div', 'prova-acoes', this.palavra, this.escudo),
      this.memorias,
      this.mensagem,
    );
    ctx.raiz.append(this.raiz);
  }

  destruir() {
    window.removeEventListener('resize', this.aoRedimensionar);
  }

  aberta() {
    return this.ativa;
  }

  /** Caixas dos painéis visíveis, medidas no máximo a cada MEDIR_PAINEIS_MS. */
  private medirPaineis(): Ret[] {
    const agora = performance.now();
    if (agora - this.paineisEm < MEDIR_PAINEIS_MS) return this.paineis;
    this.paineisEm = agora;
    this.paineis = [];
    for (const sel of PAINEIS_PROVA) {
      const e = document.querySelector<HTMLElement>(sel);
      if (!e || e.hidden) continue;
      if (e === this.mensagem) {
        // a frase do centro: só enquanto aparece, e o texto com metade do halo em volta (folga)
        if (!e.classList.contains('visivel')) continue;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const px = (parseFloat(cs.paddingLeft) || 0) / 2;
        const py = (parseFloat(cs.paddingTop) || 0) / 2;
        this.paineis.push({ esq: r.left + px, topo: r.top + py, dir: r.right - px, base: r.bottom - py, passageiro: true });
        continue;
      }
      // os da prova contam já enquanto ela aparece (fade); os do HUD, só se estão na tela
      const daProva = this.raiz.contains(e);
      if (!daProva && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = e.getBoundingClientRect();
      if (r.width && r.height) this.paineis.push({ esq: r.left, topo: r.top, dir: r.right, base: r.bottom, passageiro: PASSAGEIROS.includes(sel) });
    }
    return this.paineis;
  }

  private mudou(k: string, v: string) {
    if (this.chaves.get(k) === v) return false;
    this.chaves.set(k, v);
    return true;
  }

  atualizar(e: EstadoProvaUI | null) {
    if (!e) {
      if (!this.ativa) return;
      this.ativa = false;
      this.raiz.classList.remove('aberta');
      setTimeout(() => {
        if (this.ativa) return;
        limpar(this.camadaDardos);
        this.dardos.clear();
        this.chaves.clear();
      }, 600);
      return;
    }
    if (!this.ativa) {
      this.ativa = true;
      this.raiz.classList.add('aberta');
      this.paineisEm = -Infinity;
    }
    if (this.mudou('tipo', e.tipo)) {
      this.raiz.dataset.tipo = e.tipo;
      this.tipoEl.textContent = NOME_TIPO[e.tipo];
      this.firmezaRot.textContent = FIRMEZA[e.tipo];
    }
    if (this.mudou('titulo', e.titulo)) this.titulo.textContent = e.titulo;
    if (this.mudou('instr', e.instrucao)) this.instrucao.textContent = e.instrucao;
    const prog = clamp01(e.progresso);
    const firm = clamp01(e.firmeza);
    if (this.mudou('prog', prog.toFixed(3))) this.progresso.style.transform = `scaleX(${prog})`;
    if (this.mudou('firm', firm.toFixed(3))) {
      this.firmeza.style.transform = `scaleX(${firm})`;
      this.firmezaVal.textContent = `${Math.round(firm * 100)}%`;
      this.raiz.classList.toggle('firmeza-baixa', firm < 0.3);
      const peso = e.tipo === 'duvida' ? 1 - prog : 1 - firm;
      this.vinheta.style.opacity = (0.25 + peso * 0.75).toFixed(3);
    }

    // dardos: o jogo dá o centro em fração da tela; a UI os tira de cima dos painéis e um do outro,
    // e os que não cabem esperam a vez, invisíveis (AreaLivre)
    const W = window.innerWidth;
    const H = window.innerHeight;
    const vistos = new Set<number>();
    const ativos: { d: (typeof e.dardos)[number]; ed: ElDardo }[] = [];
    for (const d of e.dardos) {
      vistos.add(d.id);
      let ed = this.dardos.get(d.id);
      if (!ed) {
        const c = el('div', 'dardo esperando', el('span', 'dardo-brasa'), el('span', 'dardo-texto', d.texto));
        c.dataset.id = String(d.id);
        this.camadaDardos.append(c);
        ed = { el: c, bloqueado: false, x: d.x, y: d.y, larg: c.offsetWidth, alt: c.offsetHeight, naTela: false };
        this.dardos.set(d.id, ed);
        requestAnimationFrame(() => c.classList.add('visivel'));
      }
      ed.x = d.x;
      ed.y = d.y;
      if (this.medidasVelhas) {
        ed.larg = ed.el.offsetWidth;
        ed.alt = ed.el.offsetHeight;
      }
      if (d.bloqueado && !ed.bloqueado) {
        ed.bloqueado = true;
        // o que esperava a vez não aparece só para cair
        if (ed.naTela) ed.el.classList.add('bloqueado');
      }
      if (ed.bloqueado) {
        const pos = afastarDePaineis({ x: d.x * W - ed.larg / 2, y: d.y * H - ed.alt / 2, larg: ed.larg, alt: ed.alt }, this.medirPaineis(), W, H);
        ed.el.style.setProperty('--pos', `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`);
      } else ativos.push({ d, ed });
    }
    const lugares = distribuirSussurros(
      ativos.map(({ d, ed }) => ({
        id: d.id, cx: d.x * W, cy: d.y * H, larg: ed.larg, alt: ed.alt, naTela: ed.naTela,
        urgencia: Math.hypot(d.x - ALVO_DARDOS.x, d.y - ALVO_DARDOS.y),
      })),
      this.medirPaineis(), W, H,
    );
    for (const { d, ed } of ativos) {
      const pos = lugares.get(d.id);
      ed.naTela = !!pos;
      ed.el.classList.toggle('esperando', !pos);
      if (pos) ed.el.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
    }
    this.medidasVelhas = false;
    for (const [id, ed] of this.dardos) {
      if (vistos.has(id)) continue;
      this.dardos.delete(id);
      if (ed.bloqueado) {
        setTimeout(() => ed.el.remove(), 900);
      } else {
        const perto = Math.hypot(ed.x - ALVO_DARDOS.x, ed.y - ALVO_DARDOS.y) < 0.16;
        ed.el.classList.add(perto ? 'acertou' : 'sumiu');
        if (perto) {
          this.raiz.classList.remove('golpe');
          void this.raiz.offsetWidth;
          this.raiz.classList.add('golpe');
        }
        setTimeout(() => ed.el.remove(), 450);
      }
    }

    // Está escrito
    const pal = e.palavra;
    const kp = pal ? `${pal.ref}|${pal.texto}|${pal.pronta}` : '';
    if (this.mudou('palavra', kp)) {
      this.paineisEm = -Infinity; // muda o tamanho de um painel
      this.palavra.hidden = !pal;
      if (pal) {
        limpar(this.palavra);
        const extenso = this.ctx.texto(pal.ref)?.extenso ?? pal.ref;
        this.palavra.append(
          el('div', 'prova-acao-tecla', tecla('Q')),
          el('div', 'prova-palavra-corpo',
            el('div', 'prova-acao-nome', icone('espada'), 'Está escrito'),
            el('div', 'prova-palavra-texto', pal.texto),
            el('div', 'prova-palavra-ref', extenso),
          ),
        );
        this.palavra.classList.toggle('pronta', pal.pronta);
      }
    }
    this.escudo.hidden = !e.escudo;

    // memórias (dúvida)
    const mems = e.memorias ?? [];
    const km = mems.map((m) => `${m.id}:${m.usada ? 1 : 0}:${m.tecla ?? ''}`).join(',');
    if (this.mudou('mem', km)) {
      this.paineisEm = -Infinity; // muda o tamanho de um painel
      limpar(this.memorias);
      this.memorias.hidden = mems.length === 0;
      if (mems.length) {
        const { daVez, acesas, depois } = dividirMemorias(mems);
        this.memorias.append(el('div', 'prova-memorias-cab', icone('estrela'), 'Lembre-se'));
        if (acesas.length) {
          const fileira = el('div', 'prova-memorias-acesas');
          fileira.setAttribute('aria-label', `${acesas.length} ${acesas.length === 1 ? 'lembrada' : 'lembradas'}`);
          for (const m of acesas) {
            const estrela = el('span', 'prova-memoria-acesa', icone('estrela'));
            estrela.title = m.titulo;
            fileira.append(estrela);
          }
          this.memorias.append(fileira);
        }
        for (const m of daVez) {
          const b = el('button', 'prova-memoria', tecla(String(m.tecla)), el('span', null, m.titulo));
          b.type = 'button';
          b.addEventListener('click', () => this.ctx.acoes().lembrarMemoria?.(m.id));
          this.memorias.append(b);
        }
        if (depois) this.memorias.append(el('div', 'prova-memorias-depois', `+${depois} para depois`));
      }
    }

    // mensagem
    const msg = e.mensagem ?? '';
    if (this.mudou('msg', msg)) {
      this.paineisEm = -Infinity; // a frase do centro também é área ocupada
      this.mensagem.textContent = msg;
      this.mensagem.classList.remove('visivel');
      if (msg) {
        void this.mensagem.offsetWidth;
        this.mensagem.classList.add('visivel');
      }
    }
  }
}
