// Texto bíblico na interface: dica flutuante dos chips de referência, painel "Entender melhor"
// (BKJ e NVT lado a lado, nota do jogo, "Aponta para Cristo", KJV recolhido) e a faixa de versículo.
import type { Ref, Versiculo } from '../jogo/contratos';
import type { CtxUI } from './contexto';
import { botao, chipRef, el, limpar, refsSeTocam } from './dom';
import { icone } from './icones';

// ------------------------------- Dica flutuante (hover) ------------------------------

export class DicaRef {
  private caixa: HTMLDivElement;
  private alvo: HTMLElement | null = null;

  constructor(private ctx: CtxUI) {
    this.caixa = el('div', 'dica-ref');
    this.caixa.setAttribute('role', 'tooltip');
    ctx.raiz.append(this.caixa);
    ctx.raiz.addEventListener('pointerover', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ref]');
      if (t && t !== this.alvo) this.mostrar(t);
    });
    ctx.raiz.addEventListener('pointerout', (e) => {
      if (!this.alvo) return;
      const para = e.relatedTarget as Node | null;
      if (para && this.alvo.contains(para)) return;
      this.esconder();
    });
    ctx.raiz.addEventListener('focusin', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ref]');
      if (t) this.mostrar(t);
    });
    ctx.raiz.addEventListener('focusout', () => this.esconder());
    ctx.raiz.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-ref]');
      if (!t?.dataset.ref) return;
      e.stopPropagation();
      this.esconder();
      ctx.entender(t.dataset.ref);
    });
  }

  mostrar(alvo: HTMLElement) {
    const ref = alvo.dataset.ref;
    if (!ref) return;
    const t = this.ctx.texto(ref);
    if (!t) return;
    this.alvo = alvo;
    limpar(this.caixa);
    this.caixa.append(
      el('div', 'dica-ref-cab', t.extenso),
      el('p', 'texto-biblico', t.texto),
      el('div', 'dica-ref-pe', 'BKJ Fiel 1611 · clique para entender melhor'),
    );
    this.caixa.classList.add('visivel');
    const r = alvo.getBoundingClientRect();
    const w = Math.min(this.caixa.offsetWidth || 360, window.innerWidth - 16);
    const h = this.caixa.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
    let y = r.top - h - 10;
    if (y < 8) y = r.bottom + 10;
    this.caixa.style.left = `${x}px`;
    this.caixa.style.top = `${y}px`;
  }

  esconder() {
    this.alvo = null;
    this.caixa.classList.remove('visivel');
  }
}

// ------------------------------- Entender melhor -------------------------------------

export class PainelEntender {
  private fundo: HTMLDivElement;
  private painel: HTMLDivElement;
  private historico: Ref[] = [];
  private devolverFoco: HTMLElement | null = null;

  constructor(private ctx: CtxUI) {
    this.painel = el('div', 'painel entender');
    this.painel.setAttribute('role', 'dialog');
    this.painel.setAttribute('aria-modal', 'true');
    this.fundo = el('div', 'modal-fundo entender-fundo', this.painel);
    this.fundo.addEventListener('pointerdown', (e) => {
      if (e.target === this.fundo) this.fechar();
    });
    ctx.raiz.append(this.fundo);
  }

  aberto() {
    return this.fundo.classList.contains('aberto');
  }

  abrir(ref: Ref) {
    if (!this.aberto()) {
      this.historico = [];
      this.devolverFoco = document.activeElement as HTMLElement | null;
    }
    const atual = this.historico[this.historico.length - 1];
    if (atual !== ref) this.historico.push(ref);
    this.render();
    this.fundo.classList.add('aberto');
    this.ctx.mudouBloqueio();
  }

  /** Volta para a referência anterior; fecha se não houver. Retorna true se ainda está aberto. */
  voltar(): boolean {
    this.historico.pop();
    if (this.historico.length === 0) {
      this.fechar();
      return false;
    }
    this.render();
    return true;
  }

  fechar() {
    if (!this.aberto()) return;
    this.fundo.classList.remove('aberto');
    this.historico = [];
    this.ctx.mudouBloqueio();
    this.devolverFoco?.focus?.();
    this.devolverFoco = null;
  }

  private render() {
    const ref = this.historico[this.historico.length - 1];
    const p = this.painel;
    limpar(p);
    const t = this.ctx.texto(ref);
    const diario = this.ctx.diario();
    const cab = el('header', 'entender-cab');
    if (this.historico.length > 1) {
      const v = botao(icone('voltar'), 'btn-icone', () => this.voltar());
      v.setAttribute('aria-label', 'Voltar');
      cab.append(v);
    }
    cab.append(
      el('div', 'entender-titulos', el('div', 'sobretitulo', 'Entender melhor'), el('h2', 'titulo-serif', t?.extenso ?? ref)),
    );
    const f = botao(icone('fechar'), 'btn-icone', () => this.fechar());
    f.setAttribute('aria-label', 'Fechar');
    cab.append(f);
    p.append(cab);

    const corpo = el('div', 'entender-corpo');
    p.append(corpo);
    if (!t) {
      corpo.append(el('p', 'aviso-texto', 'Este versículo não está disponível nesta versão do jogo.'));
      return;
    }
    corpo.append(
      el('div', 'entender-colunas',
        el('section', 'entender-col',
          el('div', 'rotulo-traducao', 'BKJ Fiel 1611'),
          el('p', 'texto-biblico grande', t.texto),
        ),
        el('section', 'entender-col nvt',
          el('div', 'rotulo-traducao', 'NVT — Nova Versão Transformadora'),
          t.nvt ? el('p', 'texto-biblico grande', t.nvt) : el('p', 'texto-indisponivel', 'Texto da NVT indisponível para esta referência.'),
        ),
      ),
    );

    const nota = diario.escrituras.find((e) => e.ref === ref)?.nota;
    if (nota) {
      corpo.append(el('aside', 'nota-jogo', el('div', 'selo-nota', icone('folha'), 'Nota do jogo'), el('p', null, nota)));
    }

    for (const c of diario.cristo.filter((c) => c.refs.some((r) => refsSeTocam(r, ref)))) {
      const refs = el('div', 'linha-chips');
      for (const r of c.refs) if (r !== ref) refs.append(chipRef(r, this.curto(r)));
      corpo.append(
        el('aside', 'cristo-caixa',
          el('div', 'selo-cristo', icone('brilho'), 'Aponta para Cristo'),
          el('h3', 'titulo-serif', c.titulo),
          el('p', null, c.texto),
          el('div', 'nota-rodape', 'Nota do jogo', c.completo === false ? ' · ainda se completará' : ''),
          refs,
        ),
      );
    }

    if (t.kjv) {
      const det = el('details', 'kjv');
      det.append(el('summary', null, 'Texto de origem em inglês (King James Version, 1611)'));
      const pk = el('p', 'texto-biblico', t.kjv);
      pk.lang = 'en';
      det.append(pk);
      corpo.append(det);
    }
    corpo.append(el('div', 'entender-fontes', 'Texto base: Bíblia King James Fiel 1611. Apoio: Nova Versão Transformadora. Original: KJV 1611 (domínio público).'));
    queueMicrotask(() => (p.querySelector('.btn-icone:last-of-type') as HTMLElement | null)?.focus({ preventScroll: true }));
  }

  private curto(r: Ref) {
    return this.ctx.texto(r)?.extenso ?? r;
  }
}

// ------------------------------- Faixa de versículo ----------------------------------

/** Faixa no alto da tela com o versículo recebido. Não bloqueia; some sozinha (~6 s). */
export class FaixaVersiculo {
  private caixa: HTMLDivElement;
  private fila: Versiculo[] = [];
  private ocupada = false;

  constructor(raiz: HTMLDivElement) {
    this.caixa = el('div', 'faixa-versiculo');
    this.caixa.setAttribute('aria-live', 'polite');
    raiz.append(this.caixa);
  }

  mostrar(v: Versiculo) {
    this.fila.push(v);
    if (!this.ocupada) void this.proxima();
  }

  private async proxima() {
    const v = this.fila.shift();
    if (!v) {
      this.ocupada = false;
      return;
    }
    this.ocupada = true;
    limpar(this.caixa);
    this.caixa.append(
      el('div', 'faixa-orn', icone('folha')),
      el('div', 'faixa-conteudo', el('p', 'texto-biblico', v.bkj), el('div', 'faixa-ref', v.referenciaExtenso)),
    );
    this.caixa.classList.add('visivel');
    const dur = Math.min(9000, Math.max(5200, 3000 + v.bkj.length * 28));
    await new Promise((r) => setTimeout(r, dur));
    this.caixa.classList.remove('visivel');
    await new Promise((r) => setTimeout(r, 700));
    void this.proxima();
  }

  limpar() {
    this.fila = [];
    this.caixa.classList.remove('visivel');
  }
}
