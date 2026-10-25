// Fluxo do jogo: carregamento → título sobre o vale vivo → novo jogo / continuar / carregar →
// era (mundo, personagens, missões) → transição de era → … → sair para o título.
// Liga o Jogo à UI (HUD, Diário, menus, configurações), aos sistemas de história
// (criarSistemas) e ao áudio, e expõe a depuração (?dev) usada pelo e2e.
import * as THREE from 'three';
import { Jogo } from './Jogo';
import { carregarBiblia } from './Biblia';
import { MEMORIAS, registrarMemorias } from './Memorias';
import { criarSistemas, definirFlag, type SistemasHistoria } from './Missoes';
import { criarArmazenamento } from './Salvamento';
import { CLASSES, type NomeClasse } from './Classes';
import { xpParaNivel } from './Atributos';
import { transicaoEra } from '../camera/TransicaoEra';
import type { Qualidade } from '../render/Renderizador';
import {
  UI, servicosBiblia, type AcoesUI, type Configuracoes, type CristoDiario, type DadosDiario, type IdSlot, type InfoSlot,
  type PersonagemDiario,
} from '../ui/UI';
import { ERAS, NOMES_ERAS, ORDEM_ERAS, defEra, eraDaMissao, type ContextoEra, type EraAtiva } from './eras';
import { PonteAudio } from './ligacao/audio';
import { Depuracao } from './ligacao/depuracao';

export type ModoPartida = 'carregando' | 'titulo' | 'jogo';

/** Parâmetros de depuração (só valem com ?dev na URL). */
export interface OpcoesDev {
  ativo: boolean;
  /** Pula para esta missão pelos atalhos da era (?missao=a3). */
  missao?: string;
  /** Hora do dia ao começar (?hora=). */
  hora?: number;
  /** Teleporta o personagem ativo ao começar (?pos=x,z). */
  pos?: [number, number];
  /** Joga sozinho do começo ao fim (?auto=1). */
  auto?: boolean;
}

/** Flag que guarda uma entrada "Aponta para Cristo" desbloqueada. */
export const flagCristo = (id: string) => `cristo_${id}`;

const quadro = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export class Partida {
  readonly jogo: Jogo;
  readonly ui: UI;
  readonly s: SistemasHistoria;
  readonly audio: PonteAudio;
  readonly dev: Depuracao;
  readonly opcoesDev: OpcoesDev;
  modo: ModoPartida = 'carregando';
  /** Era montada agora (mundo + personagens). */
  era: EraAtiva | null = null;
  /** Era da história agora (vai para o save; muda no meio da transição). */
  eraId = ORDEM_ERAS[0];
  /** Há algum save (habilita "Continuar"). */
  temSave = false;
  /** Erros de missão vistos nesta sessão ('missao:erro'). */
  readonly errosMissao: string[] = [];
  private ocupado = false;
  private ctxEra: ContextoEra;
  private orbita = { ang: 0.6, centro: new THREE.Vector3(), raio: 120, altura: 45, vel: 0.022 };
  private diarioSujo = true;
  private tDiario = 0;
  private tFps = 0;

  private constructor(jogo: Jogo, ui: UI, s: SistemasHistoria, opcoesDev: OpcoesDev) {
    this.jogo = jogo;
    this.ui = ui;
    this.s = s;
    this.opcoesDev = opcoesDev;
    this.audio = new PonteAudio(jogo);
    this.ctxEra = {
      jogo, ui, s, audio: this.audio,
      transicaoEra: (nomes) => this.transicao(nomes),
      cristo: (id) => this.desbloquearCristo(id),
      creditos: () => this.creditos(),
    };
    this.dev = new Depuracao(this);
  }

  /**
   * Monta tudo: Bíblia, UI (com a tela de carregamento), Jogo, sistemas, o mundo da primeira era
   * e a tela de título. Resolve com o título na tela.
   */
  static async criar(canvas: HTMLCanvasElement, raiz: HTMLDivElement): Promise<Partida> {
    const P = new URLSearchParams(location.search);
    const dev: OpcoesDev = { ativo: P.has('dev') };
    if (dev.ativo) {
      if (P.get('missao')) dev.missao = P.get('missao')!;
      if (P.get('hora')) dev.hora = Number(P.get('hora'));
      if (P.get('pos')) dev.pos = P.get('pos')!.split(',').map(Number) as [number, number];
      dev.auto = P.get('auto') === '1';
    }
    await carregarBiblia();
    for (const e of Object.values(ERAS)) registrarMemorias(e.memorias);
    const nomes: Record<string, string> = {};
    const classes: Record<string, NomeClasse> = {};
    for (const e of Object.values(ERAS)) {
      for (const d of [...e.jogaveis, ...e.npcs]) {
        nomes[d.id] = d.nome;
        if (d.classe) classes[d.id] = d.classe;
      }
    }
    let jogoRef: Jogo | null = null;
    const ui = new UI(raiz, servicosBiblia({
      // nomes vivos (Abrão → Abraão) vêm do personagem no mundo
      nomes: (f) => jogoRef?.mundo?.personagens.get(f)?.nome ?? nomes[f],
      classes,
    }));
    ui.carregamento({ progresso: 0.02, texto: 'Preparando a jornada…' });
    const qParam = P.get('q') as Qualidade | null;
    const qualidade: Qualidade = qParam && ['baixo', 'medio', 'alto'].includes(qParam) ? qParam : ui.configuracoes().qualidade;
    const jogo = new Jogo(canvas, qualidade);
    jogoRef = jogo;
    jogo.ui = ui;
    (window as unknown as { jogo: Jogo }).jogo = jogo;
    await jogo.carregarBase((f) => ui.carregamento({ progresso: 0.04 + f * 0.56, texto: 'Carregando pessoas e paisagens…' }));
    const s = criarSistemas(jogo, ui, jogo.cinematica, {
      armazenamento: await criarArmazenamento(),
      era: () => partida.eraId,
      nomesEras: NOMES_ERAS,
    });
    for (const e of Object.values(ERAS)) s.missoes.registrar(e.missoes);
    const partida: Partida = new Partida(jogo, ui, s, dev);
    (window as unknown as { partida: Partida }).partida = partida;
    await partida.iniciar(qParam !== null);
    return partida;
  }

  private async iniciar(qualidadeFixa: boolean) {
    const { jogo, ui } = this;
    ui.acoes = this.acoes();
    this.audio.iniciar();
    this.aplicarConfig(ui.configuracoes(), qualidadeFixa);
    ui.definirCamera(jogo.cam.camera, jogo.focoCamera);
    jogo.entrada.podeTravar = () => this.modo === 'jogo' && !ui.bloqueado();
    jogo.entradaBloqueada = () => ui.bloqueado();
    this.ligarEventos();
    jogo.aCadaQuadro((dt) => this.porQuadro(dt));
    // o mundo do título: a primeira era, viva
    await this.montarEra(ORDEM_ERAS[0], 0.62);
    this.era!.reconstruir();
    jogo.iniciar();
    try {
      await jogo.render.gl.compileAsync(jogo.cena, jogo.cam.camera);
    } catch {
      /* compila no primeiro quadro */
    }
    this.temSave = await this.haSave();
    this.entrarTitulo(true);
    ui.carregamento(null);
    let n = 0;
    const off = jogo.aCadaQuadro(() => {
      if (++n === 30) {
        (window as unknown as { pronto: boolean }).pronto = true;
        off();
      }
    });
    if (this.opcoesDev.auto || this.opcoesDev.missao) void this.novoJogo();
  }

  // ===================================================================== ações da UI

  private acoes(): AcoesUI {
    const s = this.s;
    return {
      novoJogo: () => void this.novoJogo(),
      continuar: () => void this.continuar(),
      carregar: (slot) => this.carregar(slot),
      salvar: (slot) => this.salvar(slot),
      exportar: async (slot) => {
        if (!(await s.salvamento.baixar(slot))) this.ui.aviso('Este espaço está vazio.', 'info');
      },
      importar: async (arquivo, slot) => {
        await s.salvamento.importarArquivo(arquivo, slot);
        this.temSave = true;
        this.ui.aviso('Save importado.', 'info');
      },
      listarSlots: () => this.listarSlots(),
      configuracoes: (c) => this.aplicarConfig(c, false),
      sairParaTitulo: () => this.sairParaTitulo(),
      menu: (aberto) => {
        if (this.modo === 'jogo') this.jogo.pausado = aberto;
        if (aberto) this.atualizarDiario();
        this.audio.interface(aberto ? 'abrir' : 'fechar');
      },
      leitura: (seg, cap) => s.progresso.meditar(seg, cap),
      lembrarMemoria: (id) => void s.provas.lembrar(id),
      estaEscrito: () => void s.provas.responder(),
    };
  }

  private async listarSlots(): Promise<InfoSlot[]> {
    const lista = await this.s.salvamento.listar();
    return lista.map((r) => ({
      slot: r.slot as IdSlot, vazio: r.vazio, era: r.era, missao: r.missao, personagem: r.personagem,
      tempoJogado: r.tempoJogado, atualizadoEm: r.atualizadoEm, memorias: r.memorias, erro: r.erro,
    }));
  }

  private async haSave(): Promise<boolean> {
    try {
      return (await this.s.salvamento.listar()).some((r) => !r.vazio && !r.erro);
    } catch {
      return false;
    }
  }

  // ===================================================================== fluxo

  /**
   * Novo jogo: a primeira era do começo (reaproveita o mundo do título se ainda estiver limpo).
   * Com `?dev&missao=b3`, começa pela era que tem a missão.
   */
  async novoJogo() {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      this.modo = 'carregando';
      await this.ui.fade(true, 0.7);
      this.limparSessao();
      this.s.novoJogo();
      const missaoDev = this.opcoesDev.missao;
      const def = defEra((missaoDev && eraDaMissao(missaoDev)) || ORDEM_ERAS[0]);
      this.eraId = def.id;
      if (!this.era || this.era.def.id !== def.id || this.era.sujo) await this.montarEra(def.id, 0);
      else this.era.posicoesIniciais();
      this.era!.reconstruir();
      this.comecarJogo(def.protagonista);
      this.ui.carregamento(null);
      void this.s.missoes.iniciar(def.missaoInicial);
      // a missão inicial costuma abrir com a própria cinemática (fade); sem ela, clareia aqui
      void this.ui.fade(false, 1.2);
      this.aplicarDev();
    } finally {
      this.ocupado = false;
    }
    if (this.opcoesDev.missao) await this.dev.pularPara(this.opcoesDev.missao);
    if (this.opcoesDev.auto) await this.dev.jogarSozinho();
  }

  /** Continua do save mais recente (automático ou manual). */
  async continuar() {
    const lista = (await this.s.salvamento.listar()).filter((r) => !r.vazio && !r.erro);
    lista.sort((a, b) => (b.atualizadoEm ?? '').localeCompare(a.atualizadoEm ?? ''));
    if (!lista.length) {
      this.ui.aviso('Nenhum jogo salvo ainda.', 'info');
      this.entrarTitulo(true);
      return;
    }
    await this.carregar(lista[0].slot as IdSlot);
  }

  /**
   * Carrega um save: monta a era dele (mundo novo, se o atual já foi mexido), aplica flags,
   * progresso, missões e personagens, reconstrói o mundo pelas flags e retoma a etapa.
   */
  async carregar(slot: IdSlot) {
    if (this.ocupado) return;
    const s = this.s;
    let d;
    try {
      d = await s.salvamento.carregar(slot);
    } catch (e) {
      console.error(e);
      this.ui.aviso('Não foi possível ler este save.', 'info');
      if (this.modo !== 'jogo') this.entrarTitulo(true);
      return;
    }
    if (!d) {
      this.ui.aviso('Este espaço está vazio.', 'info');
      if (this.modo !== 'jogo') this.entrarTitulo(true);
      return;
    }
    if (!ERAS[d.era]) {
      this.ui.aviso('Este save é de uma era que ainda não existe nesta versão.', 'info');
      if (this.modo !== 'jogo') this.entrarTitulo(true);
      return;
    }
    this.ocupado = true;
    try {
      this.modo = 'carregando';
      await this.ui.fade(true, 0.5);
      this.limparSessao();
      if (!this.era || this.era.def.id !== d.era || this.era.sujo) await this.montarEra(d.era, 0);
      else this.era.posicoesIniciais();
      const era = this.era!;
      s.aplicar(d);
      this.eraId = d.era;
      era.reconstruir();
      era.sujo = true;
      const ativo = this.jogo.mundo?.personagens.has(d.ativo) ? d.ativo : era.def.protagonista;
      this.comecarJogo(ativo);
      this.ui.carregamento(null);
      void this.ui.fade(false, 0.8);
      const retomada = s.missoes.retomar();
      if (!retomada) this.iniciarSeNaoComecou(era.def.missaoInicial);
      this.ui.aviso('Jogo carregado.', 'info');
      this.diarioSujo = true;
      this.aplicarDev();
    } finally {
      this.ocupado = false;
    }
  }

  async salvar(slot: IdSlot) {
    if (this.modo !== 'jogo') return;
    await this.s.salvamento.salvar(slot);
    this.temSave = true;
    this.ui.aviso('Jogo salvo.', 'info');
  }

  /** Volta ao título: a missão para (o progresso desde o último save se perde), o mundo fica. */
  sairParaTitulo() {
    this.limparSessao();
    this.entrarTitulo(false);
  }

  private iniciarSeNaoComecou(id: string) {
    const m = this.s.missoes;
    if (m.definicao(id) && !m.estado(id)) void m.iniciar(id);
  }

  // ===================================================================== eras

  /** Monta uma era (tela de carregamento), troca o mundo, cria os personagens e liga os serviços. */
  private async montarEra(id: string, progresso: number) {
    const def = defEra(id);
    this.ui.carregamento({ progresso: Math.max(progresso, 0.62), texto: def.textoCarregamento });
    await quadro();
    await quadro();
    this.era?.desligar();
    const era = await def.criar(this.ctxEra);
    this.ui.carregamento({ progresso: 0.9, texto: def.textoCarregamento });
    this.jogo.definirMundo(era.mundo);
    this.era = era;
    this.eraId = id;
    era.criarPersonagens();
    era.ligar();
    this.diarioSujo = true;
    await quadro();
  }

  /** A missão final de uma era chama isto (pelos serviços da era): genealogia e o mundo novo. */
  private async transicao(nomes: string[]) {
    const atual = this.era;
    const prox = atual?.def.seguinte;
    if (!atual || !prox) return;
    const def = defEra(prox.era);
    const jogo = this.jogo;
    let nova: EraAtiva | null = null;
    const de = jogo.ativo ?? jogo.personagem(atual.def.protagonista);
    await transicaoEra(jogo, {
      de,
      nomes,
      aoNome: (n, i) => this.ui.genealogia(n, i),
      eras: { de: atual.def.id, para: def.id },
      hora: def.horaChegada,
      criarMundo: async () => {
        await quadro();
        nova = await def.criar(this.ctxEra);
        return nova.mundo;
      },
      criarProtagonista: () => {
        const e = nova!;
        atual.desligar();
        this.era = e;
        this.eraId = def.id;
        e.criarPersonagens();
        e.ligar();
        e.sujo = true;
        e.reconstruir();
        return jogo.personagem(def.protagonista);
      },
    });
    this.ui.genealogia(null);
    this.audio.limpar();
    this.audio.musica('calmo');
    this.diarioSujo = true;
  }

  /** Depois da última missão de uma era: começa a seguinte (se a transição já aconteceu). */
  private aoConcluirMissao(id: string) {
    this.diarioSujo = true;
    const m = this.s.missoes.definicao(id);
    if (!m || m.proxima) return;
    const seg = ERAS[m.era]?.seguinte;
    if (!seg) {
      this.ui.aviso('Fim desta parte da jornada. Obrigado por jogar!', 'info');
      // depois que o motor de missões terminar de encerrar a missão (e o autosave)
      setTimeout(() => void this.voltarAoTitulo(), 1500);
      return;
    }
    if (this.eraId !== seg.era) return;
    // depois que o motor de missões terminar de encerrar a missão atual
    setTimeout(() => {
      if (this.s.missoes.definicao(seg.missao)) this.iniciarSeNaoComecou(seg.missao);
      else this.ui.aviso(`${defEra(seg.era).nome}: a jornada continua em breve.`, 'info');
    }, 0);
  }

  /**
   * Créditos do MVP: o resumo da jornada e depois a tela de créditos; resolve quando ela fecha.
   * O resumo vai na camada do título, que fica acima do fade preto com que a B5 termina
   * (os avisos ficam abaixo dele).
   */
  private async creditos(): Promise<void> {
    const prog = this.s.progresso;
    const min = Math.round(prog.tempoJogado / 60);
    const tempo = min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
    await this.ui.titulo(
      'Fim da jornada',
      `Memórias: ${prog.memorias.length} de ${MEMORIAS.todas().length} · Segredos: ${prog.segredos.length} · Tempo de jornada: ${tempo}`,
    );
    this.ui.menusC.abrir('creditos');
    // tempo real: com o menu aberto o jogo fica pausado e aCadaQuadro não roda
    return new Promise((r) => {
      const t = setInterval(() => {
        if (this.ui.menusC.topo() === 'creditos') return;
        clearInterval(t);
        r();
      }, 250);
    });
  }

  /** Fim da última era: volta ao título com o menu aberto ("Continuar" leva ao último save). */
  private async voltarAoTitulo() {
    if (this.modo !== 'jogo') return;
    await this.ui.fade(true, 1);
    this.limparSessao();
    this.entrarTitulo(true);
    void this.ui.fade(false, 1.2);
  }

  private desbloquearCristo(id: string) {
    const nome = flagCristo(id);
    if (this.jogo.flags[nome]) return;
    definirFlag(this.jogo, nome, true);
    const e = Object.values(ERAS).flatMap((x) => x.cristo).find((c) => c.id === id);
    if (e) this.ui.aviso(`Aponta para Cristo: ${e.titulo}`, 'memoria');
    this.diarioSujo = true;
  }

  // ===================================================================== modos

  private entrarTitulo(abrirMenu: boolean) {
    const { jogo, ui } = this;
    this.modo = 'titulo';
    jogo.soltarControle();
    jogo.pausado = false;
    jogo.controleLivre = true;
    if (jogo.cinematica.ativa) jogo.cinematica.devolver();
    const v = this.era?.vistaTitulo() ?? { centro: [0, 5, 0] as [number, number, number], raio: 120, altura: 45, hora: 6.2 };
    this.orbita.centro.set(...v.centro);
    this.orbita.raio = v.raio;
    this.orbita.altura = v.altura;
    this.orbita.vel = v.velocidade ?? 0.022;
    jogo.ceu.hora = v.hora;
    jogo.ceu.pausado = true;
    jogo.cam.externo = true;
    jogo.focoExterno = this.orbita.centro;
    this.posicionarOrbita(0);
    ui.pausarAoSoltarPonteiro = false;
    ui.tituloSobre3D(true);
    ui.objetivo(null, null);
    this.esconderHUD();
    this.audio.limpar();
    this.audio.musica('calmo');
    if (document.pointerLockElement) document.exitPointerLock();
    if (abrirMenu) ui.abrirTitulo({ podeContinuar: this.temSave });
    else ui.menusC.podeContinuar = this.temSave;
  }

  /** Passa a jogar com `idAtivo` no controle (depois de montar/reconstruir o mundo). */
  private comecarJogo(idAtivo: string) {
    const { jogo, ui } = this;
    ui.tituloSobre3D(false);
    ui.fecharMenus();
    jogo.focoExterno = null;
    jogo.cam.externo = false;
    jogo.ceu.pausado = false;
    jogo.pausado = false;
    jogo.controleLivre = true;
    const p = jogo.personagem(idAtivo);
    jogo.controlar(p);
    jogo.cam.pitch = 0.32;
    jogo.cam.encaixar(p.posicao, p.yaw, jogo.mundo?.fisica);
    ui.pausarAoSoltarPonteiro = true;
    this.modo = 'jogo';
    this.audio.limpar();
    this.audio.musica('calmo');
    this.diarioSujo = true;
  }

  /** Para tudo o que a sessão anterior deixou na tela (missão, prova, fala, cinemática). */
  private limparSessao() {
    const { jogo, ui, s } = this;
    s.missoes.abortar();
    s.provas.cancelar();
    s.dialogo.cancelar();
    ui.cancelarDialogo();
    ui.prova(null);
    ui.modoCinema(false);
    ui.objetivo(null, null);
    ui.prompt(null);
    ui.legendaTroca(null);
    ui.fecharRoda();
    ui.genealogia(null);
    jogo.troca.camera.cancelar();
    jogo.troca.emAndamento = false;
    jogo.troca.rodaAberta = false;
    if (jogo.cinematica.ativa) jogo.cinematica.devolver();
    jogo.controle.reiniciar();
    jogo.controleLivre = true;
    jogo.escalaTempo = 1;
    jogo.pausado = false;
    jogo.cam.balanco(0);
    jogo.ceu.gloria = 0;
    this.audio.limpar();
  }

  private aplicarDev() {
    const d = this.opcoesDev;
    if (!d.ativo) return;
    if (d.hora !== undefined && Number.isFinite(d.hora)) this.jogo.ceu.hora = d.hora;
    const a = this.jogo.ativo;
    if (d.pos && a && d.pos.every(Number.isFinite)) {
      const [x, z] = d.pos;
      a.teleportar(x, this.jogo.mundo!.chao(x, z), z);
      this.jogo.cam.encaixar(a.posicao, a.yaw, this.jogo.mundo?.fisica);
    }
  }

  // ===================================================================== por quadro

  private ligarEventos() {
    const ev = this.jogo.eventos;
    const sujar = () => (this.diarioSujo = true);
    for (const nome of ['missao:iniciada', 'missao:etapa', 'memoria', 'versiculo', 'armadura', 'unidade', 'nivel', 'atributo', 'controle', 'xp']) ev.on(nome, sujar);
    ev.on('missao:concluida', (d: { id: string }) => this.aoConcluirMissao(d.id));
    ev.on('missao:iniciada', (d: { id: string }) => {
      const tipos = this.s.missoes.definicao(d.id)?.tipos ?? [];
      if (tipos.some((t) => t === 'cooperativo' || t === 'masmorra' || t === 'batalha')) this.audio.musica('aventura');
    });
    ev.on('missao:erro', (d: { id: string; etapa: number; erro: string }) => {
      this.errosMissao.push(`${d.id}[${d.etapa}]: ${d.erro}`);
    });
    ev.on('salvo', () => (this.temSave = true));
    // cliques nos botões da interface
    this.ui.raiz.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) this.audio.interface('clique');
    });
  }

  private porQuadro(dt: number) {
    const { jogo, ui } = this;
    this.audio.quadro(dt);
    this.tFps += dt;
    if (this.tFps > 0.5) {
      this.tFps = 0;
      ui.fps(Math.round(jogo.render.fpsMedio));
    }
    if (this.modo === 'titulo') {
      this.posicionarOrbita(dt);
      this.audio.definirArea(this.era?.ambiente() ?? null);
      return;
    }
    if (this.modo !== 'jogo') return;
    this.audio.definirArea(this.era?.ambiente() ?? null);
    this.hud();
    // teclas do jogo que abrem a interface (com a UI fechada; aberta, ela mesma trata J/Esc)
    const e = jogo.entrada;
    if (!ui.bloqueado() && !jogo.transicao) {
      if (e.pressionou('diario')) {
        this.atualizarDiario();
        ui.alternarDiario();
      } else if (e.pressionou('pausa')) {
        ui.abrirPausa();
      }
    }
    this.tDiario += dt;
    if (this.diarioSujo && this.tDiario > 2) this.atualizarDiario();
  }

  private posicionarOrbita(dt: number) {
    const o = this.orbita;
    o.ang += o.vel * dt;
    const c = this.jogo.cam.camera;
    const x = o.centro.x + Math.sin(o.ang) * o.raio;
    const z = o.centro.z + Math.cos(o.ang) * o.raio;
    const chao = this.jogo.mundo ? this.jogo.mundo.relevo.altura(x, z) : 0;
    c.position.set(x, Math.max(o.centro.y + o.altura, chao + 18), z);
    c.lookAt(o.centro);
  }

  private esconderHUD() {
    this.ui.hud({
      nome: '', classe: '', iconeClasse: '', nivel: 1, xp: 0, xpProximo: 1, folego: 0, folegoMax: 1, dominio: null, dominioMax: 1,
      unidade: 0, hora: this.jogo.ceu.hora, era: this.eraId, visivel: false,
    });
  }

  private hud() {
    const p = this.jogo.ativo;
    if (!p) {
      this.esconderHUD();
      return;
    }
    const f = p.ficha;
    const mostrarDominio = !!f && (!!this.jogo.prova || f.dominio < f.dominioMax - 0.5);
    this.ui.hud({
      nome: p.nome,
      classe: p.classe ?? '',
      iconeClasse: p.classe ? CLASSES[p.classe].icone : '',
      nivel: f?.nivel ?? 1,
      xp: f?.xp ?? 0,
      xpProximo: f ? xpParaNivel(f.nivel) : 1,
      folego: f?.folego ?? 0,
      folegoMax: f?.folegoMax ?? 1,
      dominio: mostrarDominio ? f!.dominio : null,
      dominioMax: f?.dominioMax ?? 1,
      unidade: this.s.progresso.unidade,
      hora: this.jogo.ceu.hora,
      era: this.eraId,
      visivel: true,
    });
  }

  // ===================================================================== Diário

  /** Envia o estado atual ao Diário (missões, Escrituras, Cristo, memórias, personagens…). */
  atualizarDiario() {
    this.diarioSujo = false;
    this.tDiario = 0;
    this.ui.atualizarDiario(this.dadosDiario());
  }

  private dadosDiario(): Partial<DadosDiario> {
    const { s, jogo } = this;
    const prog = s.progresso;
    const cristo: CristoDiario[] = [];
    for (const e of Object.values(ERAS)) {
      for (const c of e.cristo) {
        if (!jogo.flags[flagCristo(c.id)]) continue;
        cristo.push({ id: c.id, titulo: c.titulo, refs: c.refs, texto: c.texto, era: e.id, completo: !c.completaEm || s.missoes.concluida(c.completaEm) });
      }
    }
    const personagens: PersonagemDiario[] = [];
    const m = jogo.mundo;
    if (m) {
      for (const p of jogo.troca.jogaveis()) {
        const f = p.ficha;
        if (!f || !p.classe) continue;
        personagens.push({
          id: p.id, nome: p.nome, classe: p.classe, nivel: f.nivel, xp: f.xp, xpProximo: xpParaNivel(f.nivel),
          atributos: { ...f.atributos }, progresso: { ...f.progresso }, disponivel: p.disponivel, atual: p === jogo.ativo,
          descricao: p.def.descricao, ref: p.def.ref,
        });
      }
    }
    return {
      eras: NOMES_ERAS,
      missoes: s.missoes.listaDiario().map((x) => ({
        id: x.id, titulo: x.titulo, status: x.status, resumo: x.resumo, objetivo: x.objetivo, refs: x.refs, tipos: x.tipos, era: x.era,
      })),
      escrituras: prog.versiculos.map((ref) => ({ ref, era: eraDaRef(ref) ?? this.eraId })),
      cristo,
      memorias: MEMORIAS.todas().map((d) => ({ ...d, obtida: prog.temMemoria(d.id) })),
      personagens,
      armadura: [...prog.armadura],
      unidade: prog.unidade,
      lidos: [...prog.lidos],
    };
  }

  // ===================================================================== configurações

  private aplicarConfig(c: Configuracoes, qualidadeFixa: boolean) {
    const { jogo } = this;
    if (!qualidadeFixa && c.qualidade !== jogo.render.qualidade) {
      const r = jogo.render;
      r.definirQualidade(c.qualidade);
      const pr = r.preset;
      jogo.ceu.ajustarDistancia(pr.distancia);
      const sombra = jogo.ceu.sol.shadow;
      if (sombra.mapSize.x !== pr.sombra) {
        sombra.mapSize.set(pr.sombra, pr.sombra);
        sombra.map?.dispose();
        sombra.map = null;
      }
      if (jogo.mundo) {
        jogo.mundo.natureza.distanciaMax = pr.distancia;
        jogo.mundo.grama.densidadeGlobal = pr.densidadeGrama;
      }
    }
    jogo.cam.sensibilidade = 0.0026 * c.sensibilidade;
    jogo.cam.inverterY = c.inverterY;
    this.audio.volumes(c.volumeMusica, c.volumeEfeitos);
  }
}

/** Era de uma referência (para o Diário): Gn 1–11 → Noé; Gn 12–25 → Abraão. */
function eraDaRef(ref: string): string | null {
  const m = /^Gn (\d+):/.exec(ref);
  if (!m) return null;
  const cap = Number(m[1]);
  if (cap <= 11) return 'noe';
  if (cap <= 25) return 'abraao';
  return null;
}
