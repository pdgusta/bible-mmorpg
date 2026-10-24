// Diário (tecla J): Missões, Escrituras (com "Entender melhor" e "Aponta para Cristo"), Leitura
// (capítulos inteiros; o tempo de leitura faz crescer a Sabedoria), Memórias (Livro das
// Memórias), Personagens (atributos, classe, dons e Armadura de Deus) e Ajuda (controles).
import { ATRIBUTOS, ORDEM_ATRIBUTOS, type InfoAtributo } from '../jogo/Atributos';
import { CLASSES } from '../jogo/Classes';
import type { PecaArmadura, Ref, TipoMissao } from '../jogo/contratos';
import type { CtxUI } from './contexto';
import { botao, chipRef, clamp01, el, formatarTempo, limpar, refsSeTocam, tecla } from './dom';
import { COR_CLASSE, icone, iconeArmadura, iconeClasse } from './icones';
import type { AbaDiario, CapituloUI, MissaoDiario, PersonagemDiario } from './tipos';

const ABAS: { id: AbaDiario; nome: string; icone: string }[] = [
  { id: 'missoes', nome: 'Missões', icone: 'alvo' },
  { id: 'escrituras', nome: 'Escrituras', icone: 'livro' },
  { id: 'leitura', nome: 'Leitura', icone: 'folha' },
  { id: 'memorias', nome: 'Memórias', icone: 'estrela' },
  { id: 'personagens', nome: 'Personagens', icone: 'pessoa' },
  { id: 'ajuda', nome: 'Ajuda', icone: 'info' },
];

export const NOMES_TIPO_MISSAO: Record<TipoMissao, string> = {
  tutorial: 'Tutorial',
  fisico: 'Desafio físico',
  cooperativo: 'Cooperativo',
  espiritual: 'Desafio espiritual',
  masmorra: 'Masmorra',
  servico: 'Serviço',
  exploracao: 'Exploração',
  batalha: 'Batalha narrativa',
};

/** Armadura de Deus (Ef 6:14-17), na ordem do texto. */
export const ARMADURA_UI: { peca: PecaArmadura; nome: string; efeito: string; ref: Ref }[] = [
  { peca: 'cinturao', nome: 'Cinturão da verdade', efeito: 'Revela as mentiras sem precisar procurá-las.', ref: 'Ef 6:14' },
  { peca: 'couraca', nome: 'Couraça da justiça', efeito: 'Protege o domínio próprio das acusações.', ref: 'Ef 6:14' },
  { peca: 'calcado', nome: 'Calçado da paz', efeito: 'A Unidade cai menos; a reconciliação é mais rápida.', ref: 'Ef 6:15' },
  { peca: 'escudo', nome: 'Escudo da fé', efeito: 'Segure o botão direito para apagar os dardos de mentira.', ref: 'Ef 6:16' },
  { peca: 'capacete', nome: 'Capacete da salvação', efeito: 'O medo pesa menos: menos escuridão e tremor.', ref: 'Ef 6:17' },
  { peca: 'espada', nome: 'Espada do Espírito', efeito: '“Está escrito” (Q): responde a uma mentira com um versículo recebido.', ref: 'Ef 6:17' },
];

const GRUPOS_ATR: InfoAtributo['grupo'][] = ['Físico', 'Espiritual', 'Mente', 'Caráter'];

const CONTROLES: [string, [string[], string][]][] = [
  ['Movimento', [
    [['W', 'A', 'S', 'D'], 'Andar'],
    [['Mouse'], 'Olhar ao redor (câmera)'],
    [['Roda do mouse'], 'Aproximar ou afastar a câmera'],
    [['Shift'], 'Correr (gasta fôlego)'],
    [['Espaço'], 'Pular'],
    [['Ctrl'], 'Agachar'],
  ]],
  ['Ações', [
    [['E'], 'Interagir (segure para ações longas)'],
    [['Q'], 'Habilidade da classe · “Está escrito” nas provas'],
    [['R'], 'Orar'],
    [['F'], '“Siga-me” / “Espere aqui” para um companheiro'],
    [['Botão esquerdo'], 'Ação · golpe com o cajado nas batalhas'],
    [['Botão direito'], 'Escudo da fé · aparar nas batalhas'],
  ]],
  ['Grupo e menus', [
    [['Tab'], 'Segure para abrir a roda de personagens'],
    [['1', '2', '3', '4', '5'], 'Troca rápida de personagem'],
    [['J'], 'Diário'],
    [['M'], 'Mapa'],
    [['Esc'], 'Pausa · voltar · segure para pular falas'],
  ]],
];

export class Diario {
  private fundo: HTMLDivElement;
  private abasEl: HTMLDivElement;
  private conteudo: HTMLDivElement;
  private subtitulo: HTMLDivElement;
  private aba: AbaDiario = 'missoes';
  private estaAberto = false;
  private selMissao: string | null = null;
  private selPersonagem: string | null = null;
  private lendo: { cap: CapituloUI; acumulado: number; total: number; timer: number } | null = null;
  private devolverFoco: HTMLElement | null = null;

  constructor(private ctx: CtxUI) {
    this.abasEl = el('div', 'diario-abas');
    this.abasEl.setAttribute('role', 'tablist');
    for (const a of ABAS) {
      const b = botao(el('span', 'aba-conteudo', icone(a.icone), el('span', 'aba-nome', a.nome)), 'diario-aba', () => this.irPara(a.id));
      b.dataset.aba = a.id;
      b.setAttribute('role', 'tab');
      this.abasEl.append(b);
    }
    this.subtitulo = el('div', 'diario-sub');
    const fechar = botao(el('span', null, icone('fechar')), 'btn-icone', () => this.fechar());
    fechar.setAttribute('aria-label', 'Fechar o diário');
    this.conteudo = el('div', 'diario-conteudo');
    const painel = el('div', 'painel diario',
      el('header', 'diario-cab',
        el('div', 'diario-marca', icone('livro')),
        el('div', 'diario-titulos', el('h2', 'titulo-serif', 'Diário'), this.subtitulo),
        el('div', 'diario-dica-tecla', tecla('J')),
        fechar,
      ),
      this.abasEl,
      this.conteudo,
    );
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Diário');
    this.fundo = el('div', 'modal-fundo diario-fundo', painel);
    this.fundo.addEventListener('pointerdown', (e) => {
      if (e.target === this.fundo) this.fechar();
    });
    ctx.raiz.append(this.fundo);
  }

  aberto() {
    return this.estaAberto;
  }

  abaAtual() {
    return this.aba;
  }

  abrir(aba?: AbaDiario) {
    if (aba) this.aba = aba;
    if (!this.estaAberto) this.devolverFoco = document.activeElement as HTMLElement | null;
    this.estaAberto = true;
    this.fundo.classList.add('aberto');
    this.render();
    this.ctx.mudouBloqueio();
    requestAnimationFrame(() => (this.abasEl.querySelector('.ativa') as HTMLElement | null)?.focus({ preventScroll: true }));
  }

  fechar() {
    if (!this.estaAberto) return;
    this.pararLeitura();
    this.estaAberto = false;
    this.fundo.classList.remove('aberto');
    this.ctx.mudouBloqueio();
    this.devolverFoco?.focus?.({ preventScroll: true });
    this.devolverFoco = null;
  }

  alternar(aba?: AbaDiario) {
    if (this.estaAberto && (!aba || aba === this.aba)) this.fechar();
    else this.abrir(aba);
  }

  /** Dados novos: redesenha a aba aberta (preservando a rolagem). */
  atualizar() {
    if (!this.estaAberto || this.lendo) return;
    const rol = this.conteudo.scrollTop;
    this.render();
    this.conteudo.scrollTop = rol;
  }

  tecla(e: KeyboardEvent): boolean {
    if (!this.estaAberto) return false;
    if (e.code === 'Escape') {
      if (e.repeat) return true;
      if (this.lendo) {
        this.pararLeitura();
        this.render();
      } else this.fechar();
      return true;
    }
    if (e.code === 'KeyJ') {
      if (!e.repeat) this.fechar();
      return true;
    }
    if ((e.code === 'ArrowRight' || e.code === 'ArrowLeft') && (document.activeElement as HTMLElement | null)?.classList.contains('diario-aba')) {
      const i = ABAS.findIndex((a) => a.id === this.aba);
      const prox = ABAS[(i + (e.code === 'ArrowRight' ? 1 : -1) + ABAS.length) % ABAS.length];
      this.irPara(prox.id);
      (this.abasEl.querySelector(`[data-aba="${prox.id}"]`) as HTMLElement | null)?.focus();
      return true;
    }
    return true;
  }

  private irPara(aba: AbaDiario) {
    this.pararLeitura();
    this.aba = aba;
    this.render();
    this.conteudo.scrollTop = 0;
  }

  private render() {
    const d = this.ctx.diario();
    const eraAtual = d.missoes.find((m) => m.status === 'ativa')?.era;
    this.subtitulo.textContent = eraAtual ? d.eras[eraAtual] ?? '' : 'A jornada da promessa';
    for (const b of this.abasEl.querySelectorAll<HTMLElement>('.diario-aba')) {
      const ativa = b.dataset.aba === this.aba;
      b.classList.toggle('ativa', ativa);
      b.setAttribute('aria-selected', String(ativa));
      b.tabIndex = ativa ? 0 : -1;
    }
    limpar(this.conteudo);
    this.conteudo.dataset.aba = this.aba;
    switch (this.aba) {
      case 'missoes': this.abaMissoes(); break;
      case 'escrituras': this.abaEscrituras(); break;
      case 'leitura': this.abaLeitura(); break;
      case 'memorias': this.abaMemorias(); break;
      case 'personagens': this.abaPersonagens(); break;
      case 'ajuda': this.abaAjuda(); break;
    }
  }

  private extenso(r: Ref) {
    return this.ctx.texto(r)?.extenso ?? r;
  }

  private chips(refs: Ref[]) {
    const c = el('div', 'linha-chips');
    for (const r of refs) c.append(chipRef(r, this.extenso(r)));
    return c;
  }

  private vazio(texto: string) {
    return el('div', 'diario-vazio', icone('folha'), el('p', null, texto));
  }

  // ------------------------------- Missões --------------------------------------------

  private abaMissoes() {
    const d = this.ctx.diario();
    if (!d.missoes.length) {
      this.conteudo.append(this.vazio('Nenhuma missão ainda. A jornada está para começar.'));
      return;
    }
    const ativas = d.missoes.filter((m) => m.status === 'ativa');
    const concluidas = d.missoes.filter((m) => m.status === 'concluida');
    if (!this.selMissao || !d.missoes.some((m) => m.id === this.selMissao)) this.selMissao = (ativas[0] ?? concluidas[0]).id;
    const lista = el('div', 'missoes-lista');
    const grupo = (titulo: string, ms: MissaoDiario[]) => {
      if (!ms.length) return;
      lista.append(el('div', 'lista-grupo', titulo));
      for (const m of ms) {
        const b = botao(
          el('span', 'missao-item-conteudo',
            el('span', 'missao-item-ico', icone(m.status === 'concluida' ? 'check' : 'alvo')),
            el('span', null, el('span', 'missao-item-titulo', m.titulo), m.status === 'ativa' && m.objetivo ? el('span', 'missao-item-obj', m.objetivo) : null),
          ),
          `missao-item${m.status === 'concluida' ? ' concluida' : ''}${m.id === this.selMissao ? ' sel' : ''}`,
          () => {
            this.selMissao = m.id;
            this.render();
          },
        );
        lista.append(b);
      }
    };
    grupo('Em andamento', ativas);
    grupo('Concluídas', concluidas);
    const m = d.missoes.find((x) => x.id === this.selMissao)!;
    const det = el('article', 'missao-detalhe',
      el('div', 'sobretitulo', m.era ? d.eras[m.era] ?? '' : ''),
      el('h3', 'titulo-serif grande', m.titulo),
      m.tipos?.length ? el('div', 'linha-etiquetas', ...m.tipos.map((t) => el('span', 'etiqueta', NOMES_TIPO_MISSAO[t] ?? t))) : null,
      el('p', 'missao-resumo', m.resumo),
      m.status === 'ativa' && m.objetivo ? el('div', 'missao-objetivo', el('div', 'rotulo', icone('alvo'), 'Objetivo atual'), el('p', null, m.objetivo)) : null,
      m.status === 'concluida' ? el('div', 'missao-concluida', icone('check'), 'Missão concluída') : null,
      m.refs.length ? el('div', 'missao-refs', el('div', 'rotulo', icone('livro'), 'Nas Escrituras'), this.chips(m.refs)) : null,
    );
    this.conteudo.append(el('div', 'duas-colunas', lista, det));
  }

  // ------------------------------- Escrituras -----------------------------------------

  private abaEscrituras() {
    const d = this.ctx.diario();
    if (d.cristo.length) {
      const sec = el('section', 'secao-cristo', el('h3', 'secao-titulo', icone('brilho'), 'Aponta para Cristo'));
      const grade = el('div', 'grade-cristo');
      for (const c of d.cristo) {
        grade.append(el('article', `cartao-cristo${c.completo === false ? ' parcial' : ''}`,
          el('h4', 'titulo-serif', c.titulo),
          this.chips(c.refs),
          el('p', null, c.texto),
          el('div', 'nota-rodape', 'Nota do jogo', c.completo === false ? ' · a promessa ainda se completará' : ''),
        ));
      }
      sec.append(grade);
      this.conteudo.append(sec);
    }
    const sec = el('section', 'secao-versiculos', el('h3', 'secao-titulo', icone('livro'), 'Versículos recebidos'));
    if (!d.escrituras.length) sec.append(this.vazio('Os versículos que você receber na jornada aparecem aqui.'));
    for (const e of [...d.escrituras].reverse()) {
      const t = this.ctx.texto(e.ref);
      if (!t) continue;
      const temCristo = d.cristo.some((c) => c.refs.some((r) => refsSeTocam(r, e.ref)));
      sec.append(el('article', 'cartao-versiculo',
        el('div', 'versiculo-cab', el('span', 'versiculo-ref', t.extenso), temCristo ? el('span', 'marca-cristo', icone('brilho'), 'Aponta para Cristo') : null),
        el('p', 'texto-biblico', t.texto),
        el('div', 'versiculo-pe', botao('Entender melhor', 'btn pequeno', () => this.ctx.entender(e.ref))),
      ));
    }
    this.conteudo.append(sec);
  }

  // ------------------------------- Leitura --------------------------------------------

  private abaLeitura() {
    const caps = this.ctx.servicos.capitulos?.() ?? [];
    const lidos = new Set(this.ctx.diario().lidos);
    this.conteudo.append(el('p', 'diario-intro', 'Leia um capítulo inteiro, sem pressa. Ler e meditar nas Escrituras faz crescer a Sabedoria — em especial num lugar tranquilo, como a tenda ou junto ao altar.'));
    if (!caps.length) {
      this.conteudo.append(this.vazio('Nenhum capítulo disponível para leitura.'));
      return;
    }
    const grade = el('div', 'grade-capitulos');
    for (const c of caps) {
      const chave = `${c.livro} ${c.capitulo}`;
      const b = botao(
        el('span', 'cap-conteudo', el('span', 'cap-titulo', c.titulo), el('span', 'cap-versos', `${c.versos} versículos`), lidos.has(chave) ? el('span', 'cap-lido', icone('check'), 'lido') : null),
        `capitulo${lidos.has(chave) ? ' lido' : ''}`,
        () => this.ler(c),
      );
      grade.append(b);
    }
    this.conteudo.append(grade);
  }

  /** Abre um capítulo para leitura (ex.: ao meditar junto ao altar). */
  lerCapitulo(livro: string, capitulo: number) {
    const cap = this.ctx.servicos.capitulos?.().find((c) => c.livro === livro && c.capitulo === capitulo);
    if (!cap) return;
    this.aba = 'leitura';
    if (!this.estaAberto) this.abrir('leitura');
    this.render();
    this.ler(cap);
  }

  private ler(cap: CapituloUI) {
    this.pararLeitura();
    const versos = this.ctx.servicos.capitulo?.(cap.livro, cap.capitulo) ?? [];
    limpar(this.conteudo);
    const tempo = el('span', 'leitura-tempo');
    const voltar = botao(el('span', 'aba-conteudo', icone('voltar'), 'Capítulos'), 'btn pequeno', () => {
      this.pararLeitura();
      this.render();
    });
    const texto = el('div', 'leitura-texto');
    for (const v of versos) {
      texto.append(el('span', 'verso', el('sup', 'verso-num', String(v.numero)), v.bkj, ' '));
    }
    this.conteudo.append(
      el('div', 'leitura-barra', voltar, tempo),
      el('article', 'leitura',
        el('h3', 'titulo-serif grande centro', cap.titulo),
        el('div', 'leitura-fonte', 'Bíblia King James Fiel 1611'),
        versos.length ? texto : this.vazio('Texto indisponível.'),
        el('div', 'leitura-fim', icone('folha'), 'Fim do capítulo'),
      ),
    );
    this.conteudo.scrollTop = 0;
    const l = { cap, acumulado: 0, total: 0, timer: 0 };
    const mostrar = () => (tempo.textContent = `Tempo de leitura: ${l.total < 60 ? `${l.total} s` : formatarTempo(l.total)}`);
    mostrar();
    l.timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !this.estaAberto) return;
      l.acumulado++;
      l.total++;
      mostrar();
      if (l.acumulado >= 10) {
        this.ctx.acoes().leitura?.(l.acumulado, { livro: cap.livro, capitulo: cap.capitulo });
        l.acumulado = 0;
      }
    }, 1000);
    this.lendo = l;
  }

  private pararLeitura() {
    const l = this.lendo;
    if (!l) return;
    clearInterval(l.timer);
    if (l.acumulado > 0) this.ctx.acoes().leitura?.(l.acumulado, { livro: l.cap.livro, capitulo: l.cap.capitulo });
    this.lendo = null;
  }

  // ------------------------------- Memórias -------------------------------------------

  private abaMemorias() {
    const d = this.ctx.diario();
    this.conteudo.append(el('div', 'memorias-cab',
      el('h3', 'titulo-serif grande', 'Livro das Memórias'),
      el('p', 'diario-intro', 'Lembranças de fidelidade que atravessam as gerações. Nas noites de dúvida, cada memória lembrada acende estrelas no céu.'),
    ));
    if (d.legado.length) {
      this.conteudo.append(el('div', 'legado', el('div', 'rotulo', icone('semente'), 'Legado'), ...d.legado.map((l) => el('p', null, l))));
    }
    if (!d.memorias.length) {
      this.conteudo.append(this.vazio('Nenhuma memória guardada ainda.'));
      return;
    }
    const eras = [...new Set(d.memorias.map((m) => m.era))];
    for (const era of eras) {
      const ms = d.memorias.filter((m) => m.era === era);
      const obtidas = ms.filter((m) => m.obtida).length;
      const sec = el('section', 'secao-memorias', el('h4', 'secao-titulo', el('span', null, d.eras[era] ?? era), el('span', 'contagem', `${obtidas} de ${ms.length}`)));
      const grade = el('div', 'grade-memorias');
      for (const m of ms) {
        if (!m.obtida) {
          grade.append(el('article', 'cartao-memoria trancada',
            el('div', 'memoria-ico', icone(m.segredo ? 'cadeado' : 'estrela')),
            el('div', 'memoria-titulo', m.segredo ? 'Memória oculta' : m.titulo),
            el('div', 'memoria-desc', m.segredo ? 'Um segredo ainda não encontrado.' : 'Ainda não guardada.'),
          ));
          continue;
        }
        const estrelas = el('div', 'memoria-forca');
        estrelas.title = m.forca > 0 ? `Força ${m.forca} na prova de dúvida` : '';
        for (let i = 0; i < m.forca; i++) estrelas.append(icone('estrela'));
        grade.append(el('article', `cartao-memoria${m.segredo ? ' segredo' : ''}`,
          el('div', 'memoria-cab', estrelas, m.segredo ? el('span', 'etiqueta pequena', 'segredo') : null),
          el('div', 'memoria-titulo', m.titulo),
          el('div', 'memoria-desc', m.descricao),
          el('div', 'linha-chips', chipRef(m.ref, this.extenso(m.ref))),
        ));
      }
      sec.append(grade);
      this.conteudo.append(sec);
    }
  }

  // ------------------------------- Personagens ----------------------------------------

  private abaPersonagens() {
    const d = this.ctx.diario();
    if (!d.personagens.length) {
      this.conteudo.append(this.vazio('Nenhum personagem ainda.'));
    } else {
      if (!this.selPersonagem || !d.personagens.some((p) => p.id === this.selPersonagem)) {
        this.selPersonagem = (d.personagens.find((p) => p.atual) ?? d.personagens[0]).id;
      }
      const lista = el('div', 'personagens-lista');
      for (const p of d.personagens) {
        const ret = el('span', 'mini-retrato');
        ret.style.background = COR_CLASSE[p.classe] ?? '#8a6a44';
        ret.append(iconeClasse(p.classe));
        lista.append(botao(
          el('span', 'personagem-item-conteudo', ret, el('span', null, el('span', 'personagem-item-nome', p.nome), el('span', 'personagem-item-classe', `${CLASSES[p.classe]?.nome ?? p.classe} · Nv. ${p.nivel}`))),
          `personagem-item${p.id === this.selPersonagem ? ' sel' : ''}${p.disponivel ? '' : ' indisponivel'}`,
          () => {
            this.selPersonagem = p.id;
            this.render();
          },
        ));
      }
      const p = d.personagens.find((x) => x.id === this.selPersonagem)!;
      this.conteudo.append(el('div', 'duas-colunas personagens', lista, this.fichaPersonagem(p)));
    }
    this.conteudo.append(this.secaoArmadura());
  }

  private fichaPersonagem(p: PersonagemDiario): HTMLElement {
    const c = CLASSES[p.classe];
    const ret = el('div', 'grande-retrato');
    ret.style.background = COR_CLASSE[p.classe] ?? '#8a6a44';
    ret.append(iconeClasse(p.classe));
    const xp = el('div', 'barra-xp', el('div', 'barra-xp-ench'));
    (xp.firstElementChild as HTMLElement).style.transform = `scaleX(${p.xpProximo > 0 ? clamp01(p.xp / p.xpProximo) : 1})`;
    const atr = el('div', 'atributos');
    for (const g of GRUPOS_ATR) {
      const bloco = el('div', 'atributos-grupo', el('div', 'rotulo', g));
      for (const a of ORDEM_ATRIBUTOS.filter((x) => ATRIBUTOS[x].grupo === g)) {
        const info = ATRIBUTOS[a];
        const v = p.atributos[a] ?? 0;
        const pips = el('div', 'pips');
        for (let i = 1; i <= 10; i++) pips.append(el('span', i <= v ? 'pip cheio' : 'pip'));
        const prog = p.progresso?.[a];
        if (prog && v < 10) pips.style.setProperty('--prog', `${clamp01(prog) * 100}%`);
        const linha = el('div', 'atributo',
          el('div', 'atributo-cab', el('span', 'atributo-nome', info.nome), el('span', 'atributo-valor', String(v)), pips),
          el('div', 'atributo-desc', `${info.descricao} ${info.efeito}`),
        );
        linha.title = `Cresce: ${info.cresce}`;
        bloco.append(linha);
      }
      atr.append(bloco);
    }
    const dons = el('div', 'dons');
    for (const dom of c?.dons ?? []) {
      const tem = p.nivel >= dom.nivel;
      dons.append(el('div', `dom${tem ? ' tem' : ''}`,
        el('span', 'dom-nivel', `Nv. ${dom.nivel}`),
        el('span', null, el('strong', null, dom.nome), ' — ', dom.descricao),
      ));
    }
    return el('article', 'ficha',
      el('div', 'ficha-cab',
        ret,
        el('div', null,
          el('h3', 'titulo-serif grande', p.nome),
          el('div', 'ficha-classe', c ? `${c.nome} · ${c.arquetipo}` : p.classe),
          p.descricao ? el('p', 'ficha-desc', p.descricao) : null,
          p.ref ? el('div', 'linha-chips', chipRef(p.ref, this.extenso(p.ref))) : null,
          p.disponivel ? null : el('div', 'etiqueta', 'Indisponível agora'),
        ),
        el('div', 'ficha-nivel', el('div', 'ficha-nivel-num', String(p.nivel)), el('div', 'ficha-nivel-rot', 'Nível'), xp, el('div', 'ficha-xp', `${Math.floor(p.xp)} / ${Math.floor(p.xpProximo)} XP`)),
      ),
      c ? el('div', 'classe-caixa',
        el('div', 'classe-linha', el('span', 'rotulo', 'Papel'), c.papel),
        el('div', 'classe-linha', el('span', 'rotulo', 'Ferramentas'), c.ferramentas),
        el('div', 'classe-linha', el('span', 'rotulo', 'Habilidade'), tecla('Q'), el('strong', null, c.habilidade.nome), ` — ${c.habilidade.descricao}`),
      ) : null,
      el('div', 'rotulo secao', 'Dons da classe'),
      dons,
      el('div', 'rotulo secao', 'Atributos'),
      atr,
    );
  }

  private secaoArmadura(): HTMLElement {
    const d = this.ctx.diario();
    const tem = new Set(d.armadura);
    const grade = el('div', 'grade-armadura');
    for (const a of ARMADURA_UI) {
      const ok = tem.has(a.peca);
      grade.append(el('div', `peca${ok ? ' obtida' : ''}`,
        el('div', 'peca-ico', iconeArmadura(a.peca)),
        el('div', 'peca-nome', ok ? a.nome : a.nome),
        el('div', 'peca-efeito', ok ? a.efeito : 'Ainda não recebida.'),
        el('div', 'linha-chips', chipRef(a.ref, this.extenso(a.ref))),
      ));
    }
    const unidade = el('div', 'unidade-caixa',
      el('div', 'rotulo', icone('unidade'), 'Unidade do grupo', el('span', 'unidade-valor', `${Math.round(d.unidade)}`)),
      el('div', 'barra-unidade', el('div', 'barra-unidade-ench')),
      el('div', 'atributo-desc', 'Sobe com cooperação e paz; cai com contenda. Unidade alta dá mais XP de cooperação.'),
    );
    (unidade.querySelector('.barra-unidade-ench') as HTMLElement).style.transform = `scaleX(${clamp01(d.unidade / 100)})`;
    return el('section', 'secao-armadura',
      el('h3', 'secao-titulo', icone('escudo'), 'Armadura de Deus', el('span', 'contagem', `${tem.size} de 6`)),
      el('p', 'diario-intro', 'Cada peça é conquistada numa era em que sua virtude é vivida.'),
      grade,
      unidade,
    );
  }

  // ------------------------------- Ajuda ----------------------------------------------

  private abaAjuda() {
    const grade = el('div', 'grade-ajuda');
    for (const [titulo, linhas] of CONTROLES) {
      const sec = el('section', 'ajuda-secao', el('h4', 'secao-titulo', titulo));
      for (const [teclas, desc] of linhas) {
        const t = el('div', 'ajuda-teclas');
        teclas.forEach((k) => t.append(tecla(k, k.length > 6 ? 'larga' : '')));
        sec.append(el('div', 'ajuda-linha', t, el('div', 'ajuda-desc', desc)));
      }
      grade.append(sec);
    }
    this.conteudo.append(
      grade,
      el('section', 'ajuda-secao sobre-falas',
        el('h4', 'secao-titulo', 'Sobre as falas'),
        el('p', null, 'Falas com referência (por exemplo, ', el('span', 'chip-ref falso', 'Gênesis 6:14'), ') citam a Bíblia King James Fiel 1611. Passe o mouse para ver o versículo; clique para entender melhor.'),
        el('p', null, 'Falas que a Bíblia não registra levam o selo ', el('span', 'selo-ficcao', 'fala do jogo'), '. Elas nunca contradizem o texto bíblico.'),
        el('p', null, 'Deus nunca aparece como figura: a Sua voz é mostrada como luz, em letras douradas.'),
      ),
    );
  }
}
