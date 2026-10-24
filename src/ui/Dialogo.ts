// Caixa de diálogo e escolhas. Falas bíblicas: texto BKJ + chip de referência (hover mostra o
// versículo, clique abre "Entender melhor"). Falas de ficção: selo "fala do jogo". Deus nunca
// aparece como figura (rótulo dourado e um brilho); Satanás é um sussurro; o narrador, itálico.
import { ATRIBUTOS } from '../jogo/Atributos';
import { ehBiblica, type Falante, type Linha, type OpcaoEscolha } from '../jogo/contratos';
import type { CtxUI } from './contexto';
import { chipRef, el, limpar, tecla } from './dom';
import { classeConhecida, COR_CLASSE, iconeClasse } from './icones';

type Tipo = 'deus' | 'anjo' | 'satanas' | 'narrador' | 'pessoa';

function tipoFalante(f: Falante): Tipo {
  return f === 'deus' || f === 'anjo' || f === 'satanas' || f === 'narrador' ? f : 'pessoa';
}

function corDoNome(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const tons = ['#8a6a44', '#7a5a3a', '#6d7a4a', '#8a5a4a', '#5f6f82', '#7f6a8a'];
  return tons[h % tons.length];
}

export class Dialogo {
  private captura: HTMLDivElement;
  private caixa: HTMLDivElement;
  private retrato: HTMLDivElement;
  private nome: HTMLDivElement;
  private selo: HTMLSpanElement;
  private texto: HTMLParagraphElement;
  private pe: HTMLDivElement;
  private continuar: HTMLDivElement;
  private opcoesEl: HTMLDivElement;
  private fila: Promise<unknown> = Promise.resolve();
  private aoAvancar: (() => void) | null = null;
  private digitacao: { cheio: string; inicio: number; timer: number } | null = null;
  private escolhaAtual: { opcoes: OpcaoEscolha[]; podem: boolean[]; foco: number; resolver: (i: number) => void; botoes: HTMLButtonElement[] } | null = null;
  private emUso = 0;
  private ultimoPulo = 0;
  /** Caracteres por segundo da máquina de escrever (0 = instantâneo). */
  velocidade = 52;

  constructor(private ctx: CtxUI) {
    this.retrato = el('div', 'dlg-retrato');
    this.nome = el('div', 'dlg-nome');
    this.selo = el('span', 'selo-ficcao', 'fala do jogo');
    this.texto = el('p', 'dlg-texto');
    this.pe = el('div', 'dlg-pe');
    this.continuar = el('div', 'dlg-continuar', tecla('E'), el('span', 'seta-continuar', '▸'));
    this.opcoesEl = el('div', 'escolhas');
    this.opcoesEl.setAttribute('role', 'listbox');
    this.caixa = el('div', 'dialogo',
      this.retrato,
      el('div', 'dlg-corpo', el('div', 'dlg-cabeca', this.nome, this.selo), this.texto, this.opcoesEl, el('div', 'dlg-rodape', this.pe, this.continuar)),
    );
    this.caixa.setAttribute('role', 'dialog');
    this.caixa.setAttribute('aria-live', 'polite');
    this.captura = el('div', 'dialogo-captura');
    ctx.raiz.append(this.captura, this.caixa);
    const clique = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-ref], .escolha-opcao')) return;
      if (e.button !== 0) return;
      this.avancar();
    };
    this.caixa.addEventListener('click', clique);
    this.captura.addEventListener('click', clique);
  }

  aberto(): boolean {
    return this.emUso > 0;
  }

  emEscolha(): boolean {
    return this.escolhaAtual !== null;
  }

  dialogo(linhas: Linha[]): Promise<void> {
    const p = this.fila.then(() => this.executar(linhas));
    this.fila = p.catch(() => undefined);
    return p;
  }

  escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[], pode: (o: OpcaoEscolha) => boolean): Promise<number> {
    const p = this.fila.then(() => this.executarEscolha(pergunta, opcoes, pode));
    this.fila = p.catch(() => undefined);
    return p;
  }

  /** E / Espaço / clique: completa a digitação ou avança. */
  avancar() {
    if (this.escolhaAtual) return;
    if (this.digitacao) {
      this.completar();
      return;
    }
    const f = this.aoAvancar;
    this.aoAvancar = null;
    f?.();
  }

  /** Esc segurado: pula a fala (completa e avança de uma vez). */
  pular() {
    if (this.escolhaAtual) return;
    this.completar();
    this.avancar();
  }

  /** Teclado. Retorna true se a tecla foi usada (e não deve chegar ao jogo). */
  tecla(e: KeyboardEvent): boolean {
    if (!this.aberto()) return false;
    const c = e.code;
    const esc = this.escolhaAtual;
    if (esc) {
      const n = /^(Digit|Numpad)([1-9])$/.exec(c);
      if (n) {
        if (!e.repeat) this.escolher(Number(n[2]) - 1);
        return true;
      }
      if (c === 'ArrowDown' || c === 'KeyS') { this.moverFoco(1); return true; }
      if (c === 'ArrowUp' || c === 'KeyW') { this.moverFoco(-1); return true; }
      if (c === 'KeyE' || c === 'Enter' || c === 'Space' || c === 'NumpadEnter') {
        if (!e.repeat) this.escolher(esc.foco);
        return true;
      }
      return c === 'Escape' || c === 'Tab';
    }
    if (c === 'KeyE' || c === 'Space' || c === 'Enter' || c === 'NumpadEnter') {
      if (!e.repeat) this.avancar();
      return true;
    }
    if (c === 'Escape') {
      // segurar Esc pula fala a fala, num ritmo em que ainda se vê o que passa
      const agora = performance.now();
      if (!e.repeat || agora - this.ultimoPulo > 160) {
        this.ultimoPulo = agora;
        this.pular();
      }
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------------

  private abrir() {
    this.emUso++;
    if (this.emUso === 1) {
      this.caixa.classList.add('aberto');
      this.captura.classList.add('aberto');
      this.ctx.mudouBloqueio();
    }
  }

  private fechar() {
    this.emUso = Math.max(0, this.emUso - 1);
    // espera um instante: se outra fala vier logo em seguida, a caixa não pisca
    setTimeout(() => {
      if (this.emUso > 0) return;
      this.caixa.classList.remove('aberto');
      this.captura.classList.remove('aberto');
      this.ctx.mudouBloqueio();
    }, 60);
  }

  private async executar(linhas: Linha[]) {
    if (!linhas.length) return;
    this.abrir();
    try {
      for (const l of linhas) {
        this.mostrarLinha(l, true);
        await new Promise<void>((r) => (this.aoAvancar = r));
      }
    } finally {
      this.aoAvancar = null;
      this.pararDigitacao();
      this.fechar();
    }
  }

  private async executarEscolha(pergunta: Linha | null, opcoes: OpcaoEscolha[], pode: (o: OpcaoEscolha) => boolean): Promise<number> {
    this.abrir();
    try {
      if (pergunta) this.mostrarLinha(pergunta, false);
      else this.mostrarVazio();
      return await new Promise<number>((resolver) => this.montarOpcoes(opcoes, pode, resolver));
    } finally {
      this.escolhaAtual = null;
      limpar(this.opcoesEl);
      this.caixa.classList.remove('com-escolhas');
      this.fechar();
    }
  }

  private mostrarVazio() {
    this.caixa.className = 'dialogo aberto falante-narrador sem-texto';
    limpar(this.retrato);
    this.nome.textContent = '';
    this.selo.hidden = true;
    this.texto.textContent = '';
    limpar(this.pe);
  }

  private mostrarLinha(l: Linha, digitar: boolean) {
    const tipo = tipoFalante(l.quem);
    const biblica = ehBiblica(l);
    let texto: string;
    let ref: { ref: string; extenso: string } | null = null;
    if (biblica) {
      const t = this.ctx.texto(l.ref, l.trecho);
      texto = t ? t.texto : `[${l.ref}]`;
      if (t) ref = { ref: l.ref, extenso: t.extenso };
    } else {
      texto = l.texto;
    }
    let nome = this.ctx.servicos.nomeDe(l.quem);
    if (tipo === 'deus' && !nome) nome = 'Deus';

    this.caixa.className = `dialogo aberto falante-${tipo} ${biblica ? 'biblica' : 'ficcao'}${nome ? '' : ' sem-nome'}`;
    if (!biblica && 'emocao' in l && l.emocao) this.caixa.classList.add(`emocao-${l.emocao}`);
    this.nome.textContent = nome;
    this.selo.hidden = biblica;
    this.selo.title = 'A Bíblia não registra esta fala. Ela não contradiz o texto bíblico.';
    this.montarRetrato(tipo, l.quem, nome);

    limpar(this.pe);
    if (ref) this.pe.append(chipRef(ref.ref, ref.extenso));
    this.texto.lang = 'pt-BR';
    this.texto.setAttribute('aria-label', texto);
    this.pararDigitacao();
    if (digitar && this.velocidade > 0 && texto.length > 1) {
      this.texto.textContent = '';
      this.caixa.classList.add('digitando');
      const d = { cheio: texto, inicio: performance.now(), timer: 0 };
      d.timer = window.setInterval(() => {
        const n = Math.floor(((performance.now() - d.inicio) / 1000) * this.velocidade);
        if (n >= d.cheio.length) this.completar();
        else this.texto.textContent = d.cheio.slice(0, n);
      }, 16);
      this.digitacao = d;
    } else {
      this.texto.textContent = texto;
    }
  }

  private montarRetrato(tipo: Tipo, quem: Falante, nome: string) {
    const r = this.retrato;
    limpar(r);
    r.className = 'dlg-retrato';
    r.style.background = '';
    if (tipo === 'deus' || tipo === 'anjo') {
      r.classList.add('retrato-luz', tipo === 'anjo' ? 'luz-anjo' : 'luz-deus');
      r.append(el('span', 'raios'), el('span', 'nucleo'));
      return;
    }
    if (tipo === 'satanas' || tipo === 'narrador') {
      r.classList.add('oculto');
      return;
    }
    const ret = this.ctx.servicos.retratoDe?.(quem) ?? null;
    const classe = classeConhecida(ret?.classe ?? null);
    r.style.background = ret?.cor ?? (classe ? COR_CLASSE[classe] : corDoNome(nome));
    r.append(el('span', 'monograma', ret?.inicial ?? (nome.replace(/^(o|a|um|uma) /i, '').charAt(0).toUpperCase() || '?')));
    if (classe) {
      const b = el('span', 'retrato-classe');
      b.append(iconeClasse(classe));
      r.append(b);
    }
  }

  private completar() {
    const d = this.digitacao;
    if (!d) return;
    clearInterval(d.timer);
    this.texto.textContent = d.cheio;
    this.digitacao = null;
    this.caixa.classList.remove('digitando');
  }

  private pararDigitacao() {
    if (this.digitacao) clearInterval(this.digitacao.timer);
    this.digitacao = null;
    this.caixa.classList.remove('digitando');
  }

  private montarOpcoes(opcoes: OpcaoEscolha[], pode: (o: OpcaoEscolha) => boolean, resolver: (i: number) => void) {
    limpar(this.opcoesEl);
    this.caixa.classList.add('com-escolhas');
    const podem = opcoes.map((o) => {
      try {
        return pode(o);
      } catch {
        return false;
      }
    });
    const botoes = opcoes.map((o, i) => {
      const b = el('button', 'escolha-opcao');
      b.type = 'button';
      b.setAttribute('role', 'option');
      const partes: (Node | string)[] = [tecla(String(i + 1))];
      if (o.requer) partes.push(el('span', 'marca-requer', '✦'));
      partes.push(el('span', 'escolha-texto', o.texto));
      if (o.requer) {
        const nomeAtr = ATRIBUTOS[o.requer.atributo]?.nome ?? o.requer.atributo;
        partes.push(el('span', podem[i] ? 'selo-requer' : 'selo-requer falta', podem[i] ? `${nomeAtr} ${o.requer.minimo}` : `Requer ${nomeAtr} ${o.requer.minimo}`));
      }
      b.append(...partes);
      if (!podem[i]) {
        b.classList.add('bloqueada');
        b.setAttribute('aria-disabled', 'true');
      }
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.escolher(i);
      });
      // só o movimento real do mouse muda o foco (opções que surgem sob o cursor não o roubam)
      b.addEventListener('pointermove', () => {
        if (this.escolhaAtual?.foco !== i) this.focar(i);
      });
      this.opcoesEl.append(b);
      return b;
    });
    const primeira = Math.max(0, podem.indexOf(true));
    this.escolhaAtual = { opcoes, podem, foco: primeira, resolver, botoes };
    this.focar(primeira);
  }

  private focar(i: number) {
    const e = this.escolhaAtual;
    if (!e) return;
    e.foco = i;
    e.botoes.forEach((b, k) => b.classList.toggle('foco', k === i));
  }

  private moverFoco(d: number) {
    const e = this.escolhaAtual;
    if (!e) return;
    const n = e.opcoes.length;
    let i = e.foco;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (e.podem[i]) break;
    }
    this.focar(i);
  }

  private escolher(i: number) {
    const e = this.escolhaAtual;
    if (!e || i < 0 || i >= e.opcoes.length) return;
    if (!e.podem[i]) {
      const b = e.botoes[i];
      b.classList.remove('negada');
      void b.offsetWidth;
      b.classList.add('negada');
      return;
    }
    this.escolhaAtual = null;
    e.resolver(i);
  }
}
