// Roda de personagens (segurar Tab): retratos em círculo, atividade de cada um; escolha pela
// direção do mouse (com ou sem ponteiro travado), pelas teclas 1–5 ou clique.
import type { ItemRoda } from '../jogo/contratos';
import type { CtxUI } from './contexto';
import { el, tecla } from './dom';
import { classeConhecida, COR_CLASSE, iconeClasse } from './icones';

export class Roda {
  private fundo: HTMLDivElement;
  private anel: HTMLDivElement;
  private centroNome: HTMLDivElement;
  private centroAtiv: HTMLDivElement;
  private centroDica: HTMLDivElement;
  private ponteiro: HTMLDivElement;
  private itens: ItemRoda[] = [];
  private els: HTMLElement[] = [];
  private angulos: number[] = [];
  private destaque = -1;
  private resolver: ((id: string | null) => void) | null = null;
  private vx = 0;
  private vy = 0;

  constructor(private ctx: CtxUI) {
    this.anel = el('div', 'roda-anel');
    this.centroNome = el('div', 'roda-centro-nome');
    this.centroAtiv = el('div', 'roda-centro-ativ');
    this.centroDica = el('div', 'roda-centro-dica');
    this.ponteiro = el('div', 'roda-ponteiro');
    const centro = el('div', 'roda-centro', this.centroNome, this.centroAtiv, this.centroDica);
    this.fundo = el('div', 'roda', el('div', 'roda-disco', this.ponteiro, this.anel, centro));
    this.fundo.setAttribute('role', 'menu');
    this.fundo.setAttribute('aria-label', 'Trocar de personagem');
    ctx.raiz.append(this.fundo);
    window.addEventListener('mousemove', (e) => this.mouse(e));
  }

  aberta() {
    return this.resolver !== null;
  }

  abrir(itens: ItemRoda[]): Promise<string | null> {
    this.cancelar();
    this.itens = [...itens].sort((a, b) => a.tecla - b.tecla);
    this.anel.replaceChildren();
    this.vx = this.vy = 0;
    const n = this.itens.length;
    this.angulos = this.itens.map((_, i) => -Math.PI / 2 + (i * Math.PI * 2) / Math.max(1, n));
    this.els = this.itens.map((it, i) => {
      const c = classeConhecida(it.classe);
      const ret = el('div', 'roda-retrato');
      ret.style.background = c ? COR_CLASSE[c] : '#8a6a44';
      ret.append(iconeClasse(it.classe, it.icone));
      const item = el('button', `roda-item${it.disponivel ? '' : ' indisponivel'}${it.atual ? ' atual' : ''}`,
        ret,
        el('div', 'roda-nome', it.nome),
        el('div', 'roda-tecla', tecla(String(it.tecla))),
      );
      item.type = 'button';
      const a = this.angulos[i];
      item.style.setProperty('--x', `${Math.cos(a)}`);
      item.style.setProperty('--y', `${Math.sin(a)}`);
      item.addEventListener('pointerenter', () => this.destacar(i));
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.destacar(i);
        this.fechar();
      });
      this.anel.append(item);
      return item;
    });
    this.destacar(this.itens.findIndex((i) => i.atual));
    this.fundo.classList.add('aberta');
    const p = new Promise<string | null>((r) => (this.resolver = r));
    this.ctx.mudouBloqueio();
    return p;
  }

  /** Fecha resolvendo com o personagem destacado (ou null se for o atual/indisponível). */
  fechar() {
    const it = this.itens[this.destaque];
    if (this.resolver) this.terminar(it && it.disponivel && !it.atual ? it.id : null);
  }

  cancelar() {
    if (this.resolver) this.terminar(null);
  }

  private terminar(id: string | null) {
    const r = this.resolver;
    this.resolver = null;
    this.fundo.classList.remove('aberta');
    r?.(id);
    this.ctx.mudouBloqueio();
  }

  tecla(e: KeyboardEvent): boolean {
    if (!this.aberta()) return false;
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) {
      if (e.repeat) return true;
      const i = this.itens.findIndex((it) => it.tecla === Number(m[2]));
      if (i >= 0) {
        this.destacar(i);
        const it = this.itens[i];
        if (it.disponivel && !it.atual) this.fechar();
        else this.negar(i);
      }
      return true;
    }
    if (e.code === 'Escape') {
      this.cancelar();
      return true;
    }
    return false;
  }

  private negar(i: number) {
    const b = this.els[i];
    b.classList.remove('negada');
    void b.offsetWidth;
    b.classList.add('negada');
  }

  private mouse(e: MouseEvent) {
    if (!this.aberta()) return;
    if (document.pointerLockElement) {
      this.vx += e.movementX;
      this.vy += e.movementY;
      const l = Math.hypot(this.vx, this.vy);
      if (l > 140) {
        this.vx *= 140 / l;
        this.vy *= 140 / l;
      }
    } else {
      this.vx = e.clientX - window.innerWidth / 2;
      this.vy = e.clientY - window.innerHeight / 2;
    }
    if (Math.hypot(this.vx, this.vy) < 28) return;
    const ang = Math.atan2(this.vy, this.vx);
    let melhor = -1;
    let menor = Infinity;
    this.angulos.forEach((a, i) => {
      let d = Math.abs(ang - a) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < menor) {
        menor = d;
        melhor = i;
      }
    });
    this.destacar(melhor);
  }

  private destacar(i: number) {
    this.destaque = i;
    this.els.forEach((b, k) => b.classList.toggle('destaque', k === i));
    const it = this.itens[i];
    if (i >= 0 && this.angulos[i] !== undefined) {
      this.ponteiro.style.setProperty('--a', `${this.angulos[i] + Math.PI / 2}rad`);
      this.ponteiro.classList.add('visivel');
    } else this.ponteiro.classList.remove('visivel');
    if (!it) {
      this.centroNome.textContent = 'Trocar de personagem';
      this.centroAtiv.textContent = '';
      this.centroDica.textContent = 'Mova o mouse ou use 1–5';
      return;
    }
    this.centroNome.textContent = it.nome;
    this.centroAtiv.textContent = it.atividade || it.classe;
    this.centroDica.textContent = it.atual ? 'Você está aqui' : it.disponivel ? 'Solte Tab para trocar' : 'Indisponível agora';
  }
}
