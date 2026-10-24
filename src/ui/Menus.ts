// Menus: Título, Pausa, Configurações, Slots de save (salvar/carregar, exportar/importar) e
// Créditos. Tudo dispara callbacks (AcoesUI); a UI não sabe salvar nem carregar sozinha.
import type { CtxUI } from './contexto';
import { botao, el, formatarData, formatarTempo, limpar } from './dom';
import { icone } from './icones';
import { CONFIG_PADRAO, type Configuracoes, type IdSlot, type InfoSlot } from './tipos';

export type TelaMenu = 'titulo' | 'pausa' | 'config' | 'salvar' | 'carregar' | 'creditos' | 'confirmar';

const CHAVE_CONFIG = 'a-semente:config';

export function lerConfiguracoes(): Configuracoes {
  try {
    const s = localStorage.getItem(CHAVE_CONFIG);
    if (s) return { ...CONFIG_PADRAO, ...(JSON.parse(s) as Partial<Configuracoes>) };
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return { ...CONFIG_PADRAO };
}

function gravarConfiguracoes(c: Configuracoes) {
  try {
    localStorage.setItem(CHAVE_CONFIG, JSON.stringify(c));
  } catch {
    /* ignora */
  }
}

interface Tela {
  tela: TelaMenu;
  el: HTMLElement;
}

export interface LigacoesMenus {
  abrirDiario(): void;
  aoMudarConfig(c: Configuracoes): void;
}

export class Menus {
  private camada: HTMLDivElement;
  private pilha: Tela[] = [];
  private config: Configuracoes;
  /** "Continuar" do título fica ativo quando há save. */
  podeContinuar = false;
  versao = 'MVP 0.1 — Noé e Abraão';

  constructor(private ctx: CtxUI, private lig: LigacoesMenus) {
    this.camada = el('div', 'menus');
    ctx.raiz.append(this.camada);
    this.config = lerConfiguracoes();
  }

  configuracoes(): Configuracoes {
    return { ...this.config };
  }

  definirConfiguracoes(c: Partial<Configuracoes>) {
    this.config = { ...this.config, ...c };
    gravarConfiguracoes(this.config);
  }

  aberto() {
    return this.pilha.length > 0;
  }

  topo(): TelaMenu | null {
    return this.pilha[this.pilha.length - 1]?.tela ?? null;
  }

  abrir(tela: TelaMenu, opcoes: { substituir?: boolean } = {}) {
    if (opcoes.substituir) this.limparPilha();
    const t: Tela = { tela, el: this.construir(tela) };
    this.pilha.at(-1)?.el.classList.add('coberta');
    this.pilha.push(t);
    this.camada.append(t.el);
    this.atualizarClasses();
    requestAnimationFrame(() => t.el.classList.add('visivel'));
    this.focarPrimeiro(t.el);
    this.ctx.mudouBloqueio();
  }

  /** Volta uma tela. Retorna true se ainda há menu aberto. */
  voltar(): boolean {
    const t = this.pilha.pop();
    if (t) t.el.remove();
    const novo = this.pilha.at(-1);
    if (novo) {
      novo.el.classList.remove('coberta');
      if (novo.tela === 'salvar' || novo.tela === 'carregar') void this.preencherSlots(novo.el, novo.tela);
      this.focarPrimeiro(novo.el);
    }
    this.atualizarClasses();
    this.ctx.mudouBloqueio();
    if (t?.tela === 'pausa' && !novo) this.ctx.acoes().retomar?.();
    return this.pilha.length > 0;
  }

  fecharTudo() {
    this.limparPilha();
    this.atualizarClasses();
    this.ctx.mudouBloqueio();
  }

  private limparPilha() {
    for (const t of this.pilha) t.el.remove();
    this.pilha = [];
  }

  private atualizarClasses() {
    const topo = this.topo();
    this.camada.className = `menus${topo ? ' aberto' : ''}${this.pilha.some((t) => t.tela === 'titulo') ? ' com-titulo' : ''}`;
  }

  tecla(e: KeyboardEvent): boolean {
    if (!this.aberto()) return false;
    if (e.code === 'Escape') {
      if (!e.repeat && this.topo() !== 'titulo') this.voltar();
      return true;
    }
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') {
      const ativo = document.activeElement as HTMLElement | null;
      if (ativo instanceof HTMLInputElement && ativo.type === 'range') return true;
      const lista = [...(this.pilha.at(-1)!.el.querySelectorAll<HTMLElement>('button:not([disabled]), input'))];
      const i = lista.indexOf(ativo as HTMLElement);
      const prox = lista[(i + (e.code === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length];
      prox?.focus();
      e.preventDefault();
      return true;
    }
    return true;
  }

  private focarPrimeiro(raiz: HTMLElement) {
    requestAnimationFrame(() => raiz.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true }));
  }

  // ------------------------------------------------------------------------------------

  private construir(tela: TelaMenu): HTMLElement {
    switch (tela) {
      case 'titulo': return this.telaTitulo();
      case 'pausa': return this.telaPausa();
      case 'config': return this.telaConfig();
      case 'salvar':
      case 'carregar': return this.telaSlots(tela);
      case 'creditos': return this.telaCreditos();
      case 'confirmar': return el('div', 'menu-tela');
    }
  }

  private cartao(titulo: string, ...filhos: (Node | null)[]): HTMLElement {
    const fechar = botao(icone('voltar'), 'btn-icone menu-voltar', () => this.voltar());
    fechar.setAttribute('aria-label', 'Voltar');
    return el('div', 'menu-tela',
      el('div', 'painel menu-cartao',
        el('header', 'menu-cab', fechar, el('h2', 'titulo-serif', titulo)),
        ...filhos,
      ),
    );
  }

  private botaoMenu(texto: string, acao: () => void, desabilitado = false, cls = ''): HTMLButtonElement {
    const b = botao(texto, `menu-botao ${cls}`.trim(), acao);
    b.disabled = desabilitado;
    return b;
  }

  private telaTitulo(): HTMLElement {
    const a = this.ctx.acoes();
    const t = el('div', 'menu-tela tela-titulo',
      el('div', 'titulo-cenario', el('div', 'titulo-sol'), el('div', 'titulo-colinas c1'), el('div', 'titulo-colinas c2'), el('div', 'titulo-colinas c3')),
      el('div', 'titulo-conteudo',
        el('div', 'titulo-logo',
          el('div', 'logo-semente grande', icone('semente')),
          el('h1', null, 'A Semente'),
          el('div', 'titulo-lema', 'Uma jornada pela história da Bíblia'),
        ),
        el('nav', 'titulo-botoes painel',
          this.botaoMenu('Novo jogo', () => { this.fecharTudo(); a.novoJogo?.(); }, !a.novoJogo, 'principal'),
          this.botaoMenu('Continuar', () => { this.fecharTudo(); a.continuar?.(); }, !this.podeContinuar || !a.continuar),
          this.botaoMenu('Carregar', () => this.abrir('carregar'), !a.listarSlots),
          this.botaoMenu('Configurações', () => this.abrir('config')),
          this.botaoMenu('Créditos', () => this.abrir('creditos')),
        ),
      ),
      el('div', 'titulo-versao', this.versao),
    );
    return t;
  }

  private telaPausa(): HTMLElement {
    const a = this.ctx.acoes();
    return el('div', 'menu-tela tela-pausa',
      el('div', 'painel menu-cartao pausa-cartao',
        el('header', 'menu-cab centro', el('h2', 'titulo-serif', 'Pausa')),
        el('nav', 'menu-lista',
          this.botaoMenu('Continuar', () => this.voltar(), false, 'principal'),
          this.botaoMenu('Salvar', () => this.abrir('salvar'), !a.salvar),
          this.botaoMenu('Carregar', () => this.abrir('carregar'), !a.listarSlots),
          this.botaoMenu('Configurações', () => this.abrir('config')),
          this.botaoMenu('Diário', () => this.lig.abrirDiario()),
          this.botaoMenu('Sair para o título', () => this.confirmar(
            'Sair para o título?',
            'O progresso desde o último salvamento será perdido.',
            'Sair',
            () => {
              this.fecharTudo();
              this.ctx.acoes().sairParaTitulo?.();
              this.abrir('titulo', { substituir: true });
            },
          )),
        ),
        el('div', 'menu-rodape', 'Esc para voltar ao jogo'),
      ),
    );
  }

  /** Confirmação simples por cima da tela atual. */
  confirmar(titulo: string, texto: string, sim: string, aoConfirmar: () => void) {
    const t: Tela = {
      tela: 'confirmar',
      el: el('div', 'menu-tela tela-confirmar',
        el('div', 'painel menu-cartao confirmar-cartao',
          el('h2', 'titulo-serif', titulo),
          el('p', null, texto),
          el('div', 'menu-linha-botoes',
            botao('Cancelar', 'btn', () => this.voltar()),
            botao(sim, 'btn principal', () => { this.voltar(); aoConfirmar(); }),
          ),
        ),
      ),
    };
    this.pilha.at(-1)?.el.classList.add('coberta');
    this.pilha.push(t);
    this.camada.append(t.el);
    this.atualizarClasses();
    requestAnimationFrame(() => t.el.classList.add('visivel'));
    this.focarPrimeiro(t.el);
    this.ctx.mudouBloqueio();
  }

  private telaConfig(): HTMLElement {
    const c = this.config;
    const linhas = el('div', 'config-linhas');
    const mudar = (p: Partial<Configuracoes>) => {
      this.definirConfiguracoes(p);
      this.lig.aoMudarConfig(this.configuracoes());
    };

    // qualidade
    const seg = el('div', 'segmentado');
    seg.setAttribute('role', 'radiogroup');
    const opQ: [Configuracoes['qualidade'], string][] = [['baixo', 'Baixa'], ['medio', 'Média'], ['alto', 'Alta']];
    for (const [v, n] of opQ) {
      const b = botao(n, `seg-op${c.qualidade === v ? ' ativo' : ''}`, () => {
        seg.querySelectorAll('.seg-op').forEach((x) => x.classList.remove('ativo'));
        b.classList.add('ativo');
        b.setAttribute('aria-checked', 'true');
        mudar({ qualidade: v });
      });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(c.qualidade === v));
      seg.append(b);
    }
    linhas.append(this.linhaConfig('Qualidade gráfica', 'Baixa para notebooks com vídeo integrado.', seg));

    linhas.append(this.linhaConfig('Sensibilidade do mouse', null,
      this.deslizante(c.sensibilidade, 0.25, 3, 0.05, (v) => `${v.toFixed(2).replace('.', ',')}×`, (v) => mudar({ sensibilidade: v }))));
    linhas.append(this.linhaConfig('Inverter eixo Y', null, this.alternador(c.inverterY, (v) => mudar({ inverterY: v }))));
    linhas.append(this.linhaConfig('Volume da música', null,
      this.deslizante(c.volumeMusica, 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => mudar({ volumeMusica: v }))));
    linhas.append(this.linhaConfig('Volume dos efeitos', null,
      this.deslizante(c.volumeEfeitos, 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => mudar({ volumeEfeitos: v }))));
    linhas.append(this.linhaConfig('Mostrar FPS', null, this.alternador(c.mostrarFPS, (v) => mudar({ mostrarFPS: v }))));

    const restaurar = botao('Restaurar padrão', 'btn', () => {
      mudar({ ...CONFIG_PADRAO });
      const t = this.pilha.at(-1);
      if (t?.tela === 'config') {
        const novo = this.telaConfig();
        novo.classList.add('visivel');
        t.el.replaceWith(novo);
        t.el = novo;
      }
    });
    return this.cartao('Configurações', linhas, el('div', 'menu-linha-botoes', restaurar, botao('Voltar', 'btn principal', () => this.voltar())));
  }

  private linhaConfig(nome: string, sub: string | null, controle: HTMLElement): HTMLElement {
    return el('div', 'config-linha', el('div', 'config-nome', nome, sub ? el('div', 'config-sub', sub) : null), el('div', 'config-controle', controle));
  }

  private deslizante(v: number, min: number, max: number, passo: number, fmt: (v: number) => string, aoMudar: (v: number) => void): HTMLElement {
    const i = el('input', 'deslizante');
    i.type = 'range';
    i.min = String(min);
    i.max = String(max);
    i.step = String(passo);
    i.value = String(v);
    const val = el('span', 'deslizante-valor', fmt(v));
    const pintar = () => i.style.setProperty('--p', `${((Number(i.value) - min) / (max - min)) * 100}%`);
    pintar();
    i.addEventListener('input', () => {
      val.textContent = fmt(Number(i.value));
      pintar();
      aoMudar(Number(i.value));
    });
    return el('div', 'deslizante-caixa', i, val);
  }

  private alternador(v: boolean, aoMudar: (v: boolean) => void): HTMLElement {
    const b = botao(el('span', 'alternador-bola'), `alternador${v ? ' ligado' : ''}`);
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-checked', String(v));
    b.addEventListener('click', () => {
      const novo = !b.classList.contains('ligado');
      b.classList.toggle('ligado', novo);
      b.setAttribute('aria-checked', String(novo));
      aoMudar(novo);
    });
    return b;
  }

  private telaSlots(modo: 'salvar' | 'carregar'): HTMLElement {
    const lista = el('div', 'slots-lista', el('div', 'slots-vazio', 'Lendo os saves…'));
    const t = this.cartao(modo === 'salvar' ? 'Salvar jogo' : 'Carregar jogo', lista,
      el('div', 'menu-rodape', 'Exporte um save para guardá-lo como arquivo .json; importe para trazê-lo de volta.'));
    t.querySelector('.menu-cartao')?.classList.add('slots-cartao');
    void this.preencherSlots(t, modo);
    return t;
  }

  private async preencherSlots(tela: HTMLElement, modo: 'salvar' | 'carregar') {
    const lista = tela.querySelector('.slots-lista') as HTMLElement;
    const a = this.ctx.acoes();
    let slots: InfoSlot[] = [];
    try {
      slots = (await a.listarSlots?.()) ?? [];
    } catch (e) {
      console.error(e);
    }
    const porId = new Map(slots.map((s) => [s.slot, s]));
    limpar(lista);
    if (!a.listarSlots) {
      lista.append(el('div', 'slots-vazio', 'Nenhum save disponível.'));
      return;
    }
    for (const id of ['auto', 1, 2, 3] as IdSlot[]) {
      const s = porId.get(id) ?? { slot: id, vazio: true };
      if (modo === 'salvar' && id === 'auto' && s.vazio) continue;
      lista.append(this.linhaSlot(s, modo, tela));
    }
  }

  private linhaSlot(s: InfoSlot, modo: 'salvar' | 'carregar', tela: HTMLElement): HTMLElement {
    const a = this.ctx.acoes();
    const nome = s.slot === 'auto' ? 'Automático' : `Espaço ${s.slot}`;
    const info = el('div', 'slot-info');
    if (s.erro) info.append(el('div', 'slot-missao vazio', 'Save ilegível'), el('div', 'slot-detalhes', s.erro));
    else if (s.vazio) info.append(el('div', 'slot-missao vazio', 'Vazio'));
    else {
      info.append(
        el('div', 'slot-missao', s.missao ?? s.era ?? 'Jogo salvo'),
        el('div', 'slot-detalhes',
          [s.era, s.personagem, s.memorias !== undefined ? `${s.memorias} ${s.memorias === 1 ? 'memória' : 'memórias'}` : null,
            s.tempoJogado !== undefined ? formatarTempo(s.tempoJogado) : null, s.atualizadoEm ? formatarData(s.atualizadoEm) : null]
            .filter(Boolean).join(' · '),
        ),
      );
    }
    const botoes = el('div', 'slot-botoes');
    if (modo === 'salvar' && s.slot !== 'auto') {
      const b = botao(s.vazio ? 'Salvar aqui' : 'Sobrescrever', 'btn principal', async () => {
        if (!s.vazio && !b.classList.contains('confirmando')) {
          b.classList.add('confirmando');
          b.textContent = 'Confirmar?';
          return;
        }
        b.disabled = true;
        try {
          await a.salvar?.(s.slot);
          this.ctx.aviso(`Jogo salvo no ${nome.toLowerCase()}.`, 'info');
        } catch (e) {
          console.error(e);
          this.ctx.aviso('Não foi possível salvar.', 'info');
        }
        void this.preencherSlots(tela, modo);
      });
      b.disabled = !a.salvar;
      botoes.append(b);
    }
    if (modo === 'carregar') {
      const b = botao('Carregar', 'btn principal', () => {
        this.fecharTudo();
        void a.carregar?.(s.slot);
      });
      b.disabled = s.vazio || !!s.erro || !a.carregar;
      botoes.append(b);
    }
    const exp = botao(icone('baixar'), 'btn-icone', () => void a.exportar?.(s.slot));
    exp.title = 'Exportar como arquivo';
    exp.setAttribute('aria-label', `Exportar ${nome}`);
    exp.disabled = s.vazio || !!s.erro || !a.exportar;
    botoes.append(exp);
    if (s.slot !== 'auto') {
      const arq = el('input');
      arq.type = 'file';
      arq.accept = '.json,application/json';
      arq.hidden = true;
      arq.addEventListener('change', async () => {
        const f = arq.files?.[0];
        if (!f) return;
        try {
          await a.importar?.(f, s.slot);
          this.ctx.aviso(`Save importado para o ${nome.toLowerCase()}.`, 'info');
        } catch (e) {
          console.error(e);
          this.ctx.aviso('Arquivo de save inválido.', 'info');
        }
        void this.preencherSlots(tela, modo);
      });
      const imp = botao(icone('enviar'), 'btn-icone', () => arq.click());
      imp.title = 'Importar arquivo';
      imp.setAttribute('aria-label', `Importar para ${nome}`);
      imp.disabled = !a.importar;
      botoes.append(imp, arq);
    }
    return el('div', `slot${s.vazio ? ' vazio' : ''}`, el('div', 'slot-nome', nome), info, botoes);
  }

  private telaCreditos(): HTMLElement {
    const sec = (titulo: string, ...linhas: (string | Node)[]) =>
      el('section', 'creditos-secao', el('h3', null, titulo), ...linhas.map((l) => el('p', null, l)));
    return this.cartao('Créditos',
      el('div', 'creditos',
        el('p', 'creditos-intro', 'A Semente — um RPG de navegador que percorre a narrativa bíblica.'),
        sec('Texto bíblico',
          'Bíblia King James Fiel 1611 (texto base).',
          'Nova Versão Transformadora — NVT (apoio, no “Entender melhor”).',
          'King James Version 1611 (domínio público), via github.com/arleym/kjv-markdown.'),
        sec('Arte', 'Modelos 3D CC0 de Quaternius.'),
        sec('Fontes', 'Nunito e Cormorant Garamond (SIL Open Font License).'),
        sec('Tecnologia', 'Three.js, TypeScript e Vite.'),
      ),
      el('div', 'menu-linha-botoes', botao('Voltar', 'btn principal', () => this.voltar())),
    );
  }
}
