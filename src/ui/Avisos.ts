// Camadas de apresentação: avisos (xp, atributo, memória...), dica de tutorial, título de
// capítulo, fade para preto, barras de cinema, legenda da troca, genealogia da transição de era
// e tela de carregamento.
import { el, esperarMs, limpar, proximoQuadro, textoMarcado } from './dom';
import { duracaoAviso, FilaAvisos, type ItemAviso, limiteAvisos } from './FilaAvisos';
import { icone } from './icones';

export type TipoAviso = 'xp' | 'atributo' | 'memoria' | 'armadura' | 'info' | 'unidade' | 'nivel';

interface DadosAviso {
  texto: string;
  tipo: TipoAviso;
}

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
  /** No máximo N avisos na tela (pela altura); os outros esperam. Avisos iguais são agrupados. */
  private fila = new FilaAvisos<DadosAviso>(limiteAvisos(window.innerHeight));
  private vivos = new Map<ItemAviso<DadosAviso>, { el: HTMLElement; timer: number }>();
  /** O cartão de cada aviso que ocupa vaga (inclusive o que está saindo), para medir a altura. */
  private cartoes = new Map<ItemAviso<DadosAviso>, HTMLElement>();
  /** Altura (px) dos avisos que voltaram para a fila, medida quando estavam na tela. */
  private medidas = new WeakMap<ItemAviso<DadosAviso>, number>();

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
    window.addEventListener('resize', this.ajustarLimite);
    raiz.append(this.cinema, this.pilha, this.dicaEl, this.legenda, this.genealogiaEl, this.fadeEl, this.tituloEl, this.carregamentoEl);
  }

  aviso(texto: string, tipo: TipoAviso = 'info') {
    this.ajustarLimite();
    const r = this.fila.entrar(`${tipo}|${texto}`, { texto, tipo });
    if (r.tipo === 'mostrar') {
      this.mostrarAviso(r.item);
      this.ajustarLimite(); // o novo pode ter mais de duas linhas
    } else if (r.tipo === 'agrupar') {
      const vivo = this.vivos.get(r.item);
      if (!vivo) return; // ainda na fila: aparece já com o ×n
      const cont = vivo.el.querySelector('.aviso-cont');
      if (cont) cont.textContent = `×${r.item.n}`;
      clearTimeout(vivo.timer);
      vivo.timer = window.setTimeout(() => this.esconderCartao(r.item), duracaoAviso(tipo, this.fila.espera.length > 0));
      this.ajustarLimite(); // o ×n estreita o texto, que pode ganhar uma linha
    }
  }

  private mostrarAviso(item: ItemAviso<DadosAviso>) {
    const { texto, tipo } = item.dados;
    const rot = ROTULO_AVISO[tipo];
    const a = el('div', `aviso tipo-${tipo}`,
      el('div', 'aviso-ico', icone(ICONE_AVISO[tipo])),
      el('div', 'aviso-textos', rot ? el('div', 'aviso-rotulo', rot) : null, el('div', 'aviso-texto', texto)),
      el('span', 'aviso-cont', item.n > 1 ? `×${item.n}` : ''),
    );
    this.pilha.append(a);
    this.cartoes.set(item, a);
    requestAnimationFrame(() => a.classList.add('visivel'));
    const dur = duracaoAviso(tipo, this.fila.espera.length > 0);
    this.vivos.set(item, { el: a, timer: window.setTimeout(() => this.esconderCartao(item), dur) });
  }

  /** Esconde o cartão; com `paraFila`, o aviso já voltou para a fila e reaparece inteiro depois. */
  private esconderCartao(item: ItemAviso<DadosAviso>, paraFila = false) {
    const vivo = this.vivos.get(item);
    if (!vivo) return;
    this.vivos.delete(item);
    clearTimeout(vivo.timer);
    if (paraFila) {
      this.medidas.set(item, this.alturaCartao(vivo.el));
      this.cartoes.delete(item);
      // acabou de entrar e ainda não apareceu (não coube): sai já, sem animação
      if (!vivo.el.classList.contains('visivel')) {
        vivo.el.remove();
        return;
      }
    }
    vivo.el.classList.remove('visivel');
    vivo.el.classList.add('saindo');
    if (paraFila) {
      setTimeout(() => vivo.el.remove(), 300);
      return;
    }
    // a vaga abre depois da saída, para o próximo não empurrar quem está saindo
    this.fila.despedir(item);
    setTimeout(() => {
      vivo.el.remove();
      this.cartoes.delete(item);
      for (const novo of this.fila.sair(item)) this.mostrarAviso(novo);
      this.ajustarLimite();
    }, 500);
  }

  destruir() {
    window.removeEventListener('resize', this.ajustarLimite);
  }

  /**
   * Quantos avisos cabem entre o retrato e a dica (ou o pé da tela), pela altura de cada cartão.
   * Quem entra é medido logo depois de posto (antes de aparecer); se não coube, volta para a fila
   * e a medida fica guardada, por isso a segunda passada já não muda nada.
   */
  readonly ajustarLimite = () => {
    for (let i = 0; i < 4; i++) if (!this.aplicarLimite()) break;
  };

  /** Uma passada do ajuste; devolve se algum aviso entrou ou saiu da tela. */
  private aplicarLimite(): boolean {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 14;
    // offsetTop, e não o retângulo: a dica entra deslizando (transform)
    const fim = this.dicaEl.classList.contains('visivel') ? this.dicaEl.offsetTop : window.innerHeight;
    const espaco = fim - this.pilha.offsetTop - 0.6 * rem;
    const alturas = [...this.fila.visiveis, ...this.fila.espera].map((item) => {
      const c = this.cartoes.get(item);
      return c ? this.alturaCartao(c) : this.medidas.get(item);
    });
    const { entram, voltam } = this.fila.definirLimite(limiteAvisos(window.innerHeight, espaco, rem, alturas));
    for (const item of voltam) this.esconderCartao(item, true);
    for (const novo of entram) this.mostrarAviso(novo);
    return entram.length + voltam.length > 0;
  }

  /** Altura do cartão com o espaço até o próximo (px). */
  private alturaCartao(c: HTMLElement): number {
    return c.offsetHeight + (parseFloat(getComputedStyle(this.pilha).rowGap) || 0);
  }

  dica(texto: string) {
    limpar(this.dicaTexto);
    this.dicaTexto.append(textoMarcado(texto));
    this.dicaEl.classList.remove('visivel');
    void this.dicaEl.offsetWidth;
    this.dicaEl.classList.add('visivel');
    this.ajustarLimite();
    clearTimeout(this.dicaTimer);
    this.dicaTimer = window.setTimeout(() => this.esconderDica(), Math.max(6000, texto.length * 70));
  }

  esconderDica() {
    clearTimeout(this.dicaTimer);
    this.dicaEl.classList.remove('visivel');
    this.ajustarLimite();
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
