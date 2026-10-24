// Camadas de apresentação: avisos (xp, atributo, memória...), dica de tutorial, título de
// capítulo, fade para preto, barras de cinema, legenda da troca, genealogia da transição de era
// e tela de carregamento.
import { el, esperarMs, limpar, proximoQuadro, textoMarcado } from './dom';
import { icone } from './icones';

export type TipoAviso = 'xp' | 'atributo' | 'memoria' | 'armadura' | 'info' | 'unidade' | 'nivel';

const ICONE_AVISO: Record<TipoAviso, string> = {
  xp: 'brilho',
  atributo: 'subir',
  memoria: 'estrela',
  armadura: 'escudo',
  info: 'info',
  unidade: 'unidade',
  nivel: 'nivel',
};

const ROTULO_AVISO: Partial<Record<TipoAviso, string>> = {
  atributo: 'Atributo',
  memoria: 'Livro das Memórias',
  armadura: 'Armadura de Deus',
  unidade: 'Unidade',
  nivel: 'Novo nível',
};

export class Avisos {
  private pilha: HTMLDivElement;
  private dicaEl: HTMLDivElement;
  private dicaTexto: HTMLDivElement;
  private dicaTimer = 0;
  private tituloEl: HTMLDivElement;
  private tituloFila: Promise<void> = Promise.resolve();
  private fadeEl: HTMLDivElement;
  private cinema: HTMLDivElement;
  private legenda: HTMLDivElement;
  private genealogiaEl: HTMLDivElement;
  private carregamentoEl: HTMLDivElement;
  private carregamentoBarra: HTMLDivElement;
  private carregamentoTexto: HTMLDivElement;
  /** Avisos iguais em sequência rápida são agrupados. */
  private recentes = new Map<string, { el: HTMLElement; n: number; timer: number }>();

  constructor(raiz: HTMLDivElement) {
    this.pilha = el('div', 'avisos');
    this.pilha.setAttribute('aria-live', 'polite');
    this.dicaTexto = el('div', 'dica-texto');
    this.dicaEl = el('div', 'dica-tutorial', el('div', 'dica-rotulo', icone('folha'), 'Dica'), this.dicaTexto);
    this.tituloEl = el('div', 'titulo-capitulo');
    this.fadeEl = el('div', 'fade-preto');
    this.cinema = el('div', 'cinema', el('div', 'cinema-barra topo'), el('div', 'cinema-barra base'));
    this.legenda = el('div', 'legenda-troca');
    this.genealogiaEl = el('div', 'genealogia');
    this.carregamentoBarra = el('div', 'carregamento-enchimento');
    this.carregamentoTexto = el('div', 'carregamento-texto');
    this.carregamentoEl = el('div', 'carregamento',
      el('div', 'carregamento-centro',
        el('div', 'logo-semente', icone('semente')),
        el('div', 'carregamento-titulo', 'A Semente'),
        el('div', 'carregamento-trilho', this.carregamentoBarra),
        this.carregamentoTexto,
      ),
    );
    raiz.append(this.cinema, this.pilha, this.dicaEl, this.legenda, this.genealogiaEl, this.fadeEl, this.tituloEl, this.carregamentoEl);
  }

  aviso(texto: string, tipo: TipoAviso = 'info') {
    const chave = `${tipo}|${texto}`;
    const r = this.recentes.get(chave);
    if (r) {
      r.n++;
      const cont = r.el.querySelector('.aviso-cont');
      if (cont) cont.textContent = `×${r.n}`;
      clearTimeout(r.timer);
      r.timer = window.setTimeout(() => this.removerAviso(chave), 4200);
      return;
    }
    const rot = ROTULO_AVISO[tipo];
    const a = el('div', `aviso tipo-${tipo}`,
      el('div', 'aviso-ico', icone(ICONE_AVISO[tipo])),
      el('div', 'aviso-textos', rot ? el('div', 'aviso-rotulo', rot) : null, el('div', 'aviso-texto', texto)),
      el('span', 'aviso-cont'),
    );
    this.pilha.append(a);
    while (this.pilha.children.length > 5) this.pilha.firstElementChild?.remove();
    requestAnimationFrame(() => a.classList.add('visivel'));
    const dur = tipo === 'nivel' || tipo === 'memoria' || tipo === 'armadura' ? 5600 : 4200;
    this.recentes.set(chave, { el: a, n: 1, timer: window.setTimeout(() => this.removerAviso(chave), dur) });
  }

  private removerAviso(chave: string) {
    const r = this.recentes.get(chave);
    if (!r) return;
    this.recentes.delete(chave);
    r.el.classList.remove('visivel');
    r.el.classList.add('saindo');
    setTimeout(() => r.el.remove(), 500);
  }

  dica(texto: string) {
    limpar(this.dicaTexto);
    this.dicaTexto.append(textoMarcado(texto));
    this.dicaEl.classList.remove('visivel');
    void this.dicaEl.offsetWidth;
    this.dicaEl.classList.add('visivel');
    clearTimeout(this.dicaTimer);
    this.dicaTimer = window.setTimeout(() => this.dicaEl.classList.remove('visivel'), Math.max(6000, texto.length * 70));
  }

  esconderDica() {
    clearTimeout(this.dicaTimer);
    this.dicaEl.classList.remove('visivel');
  }

  titulo(texto: string, sub?: string): Promise<void> {
    const p = this.tituloFila.then(async () => {
      limpar(this.tituloEl);
      this.tituloEl.append(el('div', 'titulo-orn', icone('semente')), el('h1', null, texto));
      if (sub) this.tituloEl.append(el('div', 'titulo-sub', sub));
      this.tituloEl.classList.remove('visivel');
      await proximoQuadro();
      this.tituloEl.classList.add('visivel');
      await esperarMs(1100 + 2600);
      this.tituloEl.classList.remove('visivel');
      await esperarMs(1100);
    });
    this.tituloFila = p.catch(() => undefined);
    return p;
  }

  /** Título fixo (sem sumir), para fotos e para a tela de fim. */
  tituloFixo(texto: string | null, sub?: string) {
    limpar(this.tituloEl);
    if (!texto) {
      this.tituloEl.classList.remove('visivel');
      return;
    }
    this.tituloEl.append(el('div', 'titulo-orn', icone('semente')), el('h1', null, texto));
    if (sub) this.tituloEl.append(el('div', 'titulo-sub', sub));
    this.tituloEl.classList.add('visivel');
  }

  async fade(paraPreto: boolean, duracao: number) {
    const ms = Math.max(0, duracao * 1000);
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    await proximoQuadro();
    this.fadeEl.classList.toggle('ativo', paraPreto);
    await esperarMs(ms + 20);
  }

  emPreto(): boolean {
    return this.fadeEl.classList.contains('ativo');
  }

  modoCinema(ativo: boolean) {
    this.cinema.classList.toggle('ativo', ativo);
  }

  cinemaAtivo() {
    return this.cinema.classList.contains('ativo');
  }

  legendaTroca(texto: string | null) {
    if (!texto) {
      this.legenda.classList.remove('visivel');
      return;
    }
    limpar(this.legenda);
    const [quem, ...resto] = texto.split(' — ');
    if (resto.length) this.legenda.append(el('span', 'legenda-nome', quem), el('span', 'legenda-sep', '—'), el('span', 'legenda-ativ', resto.join(' — ')));
    else this.legenda.append(el('span', 'legenda-ativ', texto));
    this.legenda.classList.add('visivel');
  }

  /** Um nome da genealogia passa como fio de luz dourada (transição de era). null limpa. */
  genealogia(nome: string | null, indice = 0) {
    if (nome === null) {
      limpar(this.genealogiaEl);
      return;
    }
    const n = el('div', 'genealogia-nome', nome);
    const lado = indice % 2 === 0 ? -1 : 1;
    n.style.setProperty('--x', `${50 + lado * (8 + (indice % 3) * 7)}%`);
    n.style.setProperty('--y', `${30 + ((indice * 13) % 40)}%`);
    this.genealogiaEl.append(n);
    setTimeout(() => n.remove(), 4200);
  }

  /** Tela de carregamento: progresso 0..1; null esconde. */
  carregamento(info: { progresso: number; texto?: string } | null) {
    if (!info) {
      this.carregamentoEl.classList.remove('visivel');
      return;
    }
    this.carregamentoEl.classList.add('visivel');
    this.carregamentoBarra.style.transform = `scaleX(${Math.max(0, Math.min(1, info.progresso))})`;
    this.carregamentoTexto.textContent = info.texto ?? 'Preparando o vale…';
  }

  carregando() {
    return this.carregamentoEl.classList.contains('visivel');
  }
}
