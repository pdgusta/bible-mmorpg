// Camada de interface (HTML/CSS sobre o canvas). Implementa InterfaceUI (src/jogo/contratos.ts)
// e acrescenta Diário, menus, configurações, carregamento e utilidades.
//
// Teclado: a UI escuta o teclado na fase de captura e consome (stopImmediatePropagation) só as
// teclas que usa enquanto algo dela está aberto — o jogo (Entrada) não as recebe:
//   diálogo: E / Espaço / Enter avançam; Esc pula; escolhas: 1–n, ↑/↓, E/Enter.
//   menus, Diário e "Entender melhor": todas as teclas (Esc volta, J fecha o Diário, Tab navega).
//   roda: 1–5 escolhem, Esc cancela; soltar Tab fecha a roda (o jogo também pode chamar fecharRoda()).
// Ponteiro: ao abrir menus, Diário ou diálogos, a UI libera o pointer lock (o cursor aparece) e,
// se foi ela quem liberou, trava de novo no alvo ao fechar. Se o jogador perder o ponteiro
// (Esc do navegador, trocar de janela) sem nada aberto, a UI abre a Pausa.
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-400-italic.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import type * as THREE from 'three';
import type {
  EstadoHUD, EstadoProvaUI, InterfaceUI, ItemRoda, Linha, MarcadorTela, OpcaoEscolha, Ref, Versiculo,
} from '../jogo/contratos';
import { Avisos, type TipoAviso } from './Avisos';
import type { CtxUI } from './contexto';
import { Dialogo } from './Dialogo';
import { Diario } from './Diario';
import { HUD } from './HUD';
import { Menus, type TelaMenu } from './Menus';
import { OverlayProva } from './Prova';
import { Roda } from './Roda';
import { DicaRef, FaixaVersiculo, PainelEntender } from './Versiculos';
import {
  DIARIO_VAZIO, type AbaDiario, type AcoesUI, type Configuracoes, type DadosDiario, type ServicosUI, type TextoRef,
} from './tipos';

export * from './tipos';
export { servicosBiblia } from './servicos';

export class UI implements InterfaceUI {
  readonly raiz: HTMLDivElement;
  readonly servicos: ServicosUI;
  acoes: AcoesUI;
  readonly hudC: HUD;
  readonly dialogoC: Dialogo;
  readonly diarioC: Diario;
  readonly rodaC: Roda;
  readonly menusC: Menus;
  readonly provaC: OverlayProva;
  readonly avisosC: Avisos;
  readonly faixaC: FaixaVersiculo;
  readonly entenderC: PainelEntender;
  /** Elemento que recebe o pointer lock ao voltar ao jogo (padrão: o primeiro canvas). */
  alvoPonteiro: HTMLElement | null;
  /** Abre a Pausa quando o ponteiro é solto sem nada aberto (Esc do navegador, alt+tab). */
  pausarAoSoltarPonteiro = true;
  /**
   * Quando verdadeiro, a própria UI trata J (Diário) e Esc (Pausa) durante o jogo. Deixe falso se
   * o jogo já liga essas teclas pela Entrada (para não alternar duas vezes).
   */
  atalhosGlobais = false;
  private dados: DadosDiario = { ...DIARIO_VAZIO };
  private soltouPonteiro = false;
  private pausaAnterior = false;
  private fpsAtual: number | null = null;
  private errosRef = new Set<string>();

  constructor(raiz: HTMLDivElement, servicos: ServicosUI, acoes: AcoesUI = {}) {
    this.raiz = raiz;
    this.servicos = servicos;
    this.acoes = acoes;
    raiz.classList.add('ui-raiz');
    raiz.lang = 'pt-BR';
    this.alvoPonteiro = document.querySelector('canvas');

    const ctx: CtxUI = {
      raiz,
      servicos,
      acoes: () => this.acoes,
      diario: () => this.dados,
      texto: (ref, trecho) => this.texto(ref, trecho),
      entender: (ref) => this.entender(ref),
      aviso: (t, tipo) => this.aviso(t, tipo),
      mudouBloqueio: () => this.mudouBloqueio(),
    };
    // a ordem no DOM não importa: as camadas usam z-index (veja estilo.css)
    this.hudC = new HUD(raiz);
    this.provaC = new OverlayProva(ctx);
    this.faixaC = new FaixaVersiculo(raiz);
    this.avisosC = new Avisos(raiz);
    this.hudC.aoMudarColuna = this.avisosC.ajustarLimite;
    this.dialogoC = new Dialogo(ctx);
    this.rodaC = new Roda(ctx);
    this.menusC = new Menus(ctx, {
      abrirDiario: () => this.abrirDiario(),
      aoMudarConfig: (c) => this.aoMudarConfig(c),
    });
    this.diarioC = new Diario(ctx);
    this.entenderC = new PainelEntender(ctx);
    new DicaRef(ctx);
    this.hudC.fps(null);

    window.addEventListener('keydown', this.teclaBaixo, { capture: true });
    window.addEventListener('keyup', this.teclaCima, { capture: true });
    document.addEventListener('pointerlockchange', this.mudouPonteiro);
  }

  /** Remove os ouvintes globais (troca de tela/testes). */
  destruir() {
    window.removeEventListener('keydown', this.teclaBaixo, { capture: true });
    window.removeEventListener('keyup', this.teclaCima, { capture: true });
    document.removeEventListener('pointerlockchange', this.mudouPonteiro);
    this.avisosC.destruir();
    this.provaC.destruir();
  }

  // ===================================== InterfaceUI ==================================

  dialogo(linhas: Linha[]): Promise<void> {
    return this.dialogoC.dialogo(linhas);
  }

  escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[], podeEscolher: (o: OpcaoEscolha) => boolean): Promise<number> {
    return this.dialogoC.escolha(pergunta, opcoes, podeEscolher);
  }

  bannerVersiculo(v: Versiculo): void {
    this.faixaC.mostrar(v);
  }

  objetivo(titulo: string | null, texto: string | null): void {
    this.hudC.objetivo(titulo, texto);
  }

  prompt(info: { texto: string; tecla: string; pode: boolean; dica?: string; progresso?: number } | null): void {
    this.hudC.prompt(info);
  }

  aviso(texto: string, tipo?: TipoAviso): void {
    this.avisosC.aviso(texto, tipo);
  }

  dica(texto: string): void {
    this.avisosC.dica(texto);
  }

  titulo(texto: string, sub?: string): Promise<void> {
    return this.avisosC.titulo(texto, sub);
  }

  /** `duracao` em segundos. */
  fade(paraPreto: boolean, duracao: number): Promise<void> {
    return this.avisosC.fade(paraPreto, duracao);
  }

  modoCinema(ativo: boolean): void {
    this.avisosC.modoCinema(ativo);
    this.raiz.classList.toggle('em-cinema', ativo);
  }

  hud(estado: EstadoHUD): void {
    this.hudC.hud(estado);
    if (this.fpsAtual !== null) this.hudC.fps(this.configuracoes().mostrarFPS ? this.fpsAtual : null);
  }

  prova(estado: EstadoProvaUI | null): void {
    this.provaC.atualizar(estado);
    this.raiz.classList.toggle('em-prova', estado !== null);
    // a faixa de versículo dá lugar à lista de memórias da dúvida (estilo.css)
    this.raiz.classList.toggle('com-memorias', !!estado?.memorias?.length);
  }

  rodaPersonagens(itens: ItemRoda[]): Promise<string | null> {
    return this.rodaC.abrir(itens);
  }

  fecharRoda(): void {
    this.rodaC.fechar();
  }

  legendaTroca(texto: string | null): void {
    this.avisosC.legendaTroca(texto);
  }

  marcadores(m: MarcadorTela[], yawCamera: number): void {
    this.hudC.marcadores(m, yawCamera);
  }

  /** Menu, Diário, "Entender melhor" ou roda abertos (o jogo não deve mover o personagem nem a câmera). */
  menuAberto(): boolean {
    return this.pausaJogo() || this.rodaC.aberta();
  }

  // ===================================== Extras ========================================

  /** Câmera para projetar os marcadores; `foco` (posição do jogador) dá a distância e o rumo na bússola. */
  definirCamera(camera: THREE.Camera | null, foco?: THREE.Vector3 | null) {
    this.hudC.definirCamera(camera, foco);
  }

  /** Menus, Diário ou "Entender melhor" abertos: o jogo deve pausar a simulação. */
  pausaJogo(): boolean {
    return this.menusC.aberto() || this.diarioC.aberto() || this.entenderC.aberto();
  }

  dialogoAberto(): boolean {
    return this.dialogoC.aberto();
  }

  /** Qualquer coisa que tire o controle do jogador (menus, roda ou diálogo). */
  bloqueado(): boolean {
    return this.menuAberto() || this.dialogoC.aberto();
  }

  /** Avança a fala atual (testes automáticos). */
  avancarDialogo() {
    this.dialogoC.avancar();
  }

  /** Fecha falas e escolhas na tela sem resposta (missão abortada, jogo carregado). */
  cancelarDialogo() {
    this.dialogoC.cancelar();
  }

  /** Tela de título sem a paisagem pintada: o mundo 3D aparece por trás (com uma vinheta). */
  tituloSobre3D(sim: boolean) {
    this.raiz.classList.toggle('titulo-3d', sim);
  }

  /** Dados do Diário (parciais são mesclados aos atuais). */
  atualizarDiario(dados: Partial<DadosDiario>) {
    this.dados = { ...this.dados, ...dados };
    this.diarioC.atualizar();
  }

  dadosDiario(): DadosDiario {
    return this.dados;
  }

  abrirDiario(aba?: AbaDiario) {
    this.diarioC.abrir(aba);
  }

  fecharDiario() {
    this.diarioC.fechar();
  }

  alternarDiario(aba?: AbaDiario) {
    if (this.menusC.aberto() && !this.diarioC.aberto()) return;
    this.diarioC.alternar(aba);
  }

  /** Abre o Diário já lendo um capítulo (ex.: meditar na tenda ou junto ao altar). */
  abrirLeitura(livro: string, capitulo: number) {
    this.diarioC.lerCapitulo(livro, capitulo);
  }

  diarioAberto(): boolean {
    return this.diarioC.aberto();
  }

  /** Abre "Entender melhor" para uma referência. */
  entender(ref: Ref) {
    this.entenderC.abrir(ref);
  }

  abrirTitulo(op: { podeContinuar?: boolean } = {}) {
    if (op.podeContinuar !== undefined) this.menusC.podeContinuar = op.podeContinuar;
    this.diarioC.fechar();
    this.entenderC.fechar();
    this.rodaC.cancelar();
    this.menusC.abrir('titulo', { substituir: true });
  }

  /** Abre a Pausa (se nada estiver aberto). Retorna true se abriu. */
  abrirPausa(): boolean {
    if (this.bloqueado()) return false;
    this.menusC.abrir('pausa');
    return true;
  }

  /** Esc no jogo: abre a Pausa; com a Pausa no topo, fecha. */
  alternarPausa() {
    if (this.menusC.topo() === 'pausa' && !this.diarioC.aberto() && !this.entenderC.aberto()) this.menusC.voltar();
    else this.abrirPausa();
  }

  abrirMenu(tela: Exclude<TelaMenu, 'confirmar'>) {
    this.menusC.abrir(tela);
  }

  fecharMenus() {
    this.entenderC.fechar();
    this.diarioC.fechar();
    this.menusC.fecharTudo();
  }

  configuracoes(): Configuracoes {
    return this.menusC.configuracoes();
  }

  definirConfiguracoes(c: Partial<Configuracoes>) {
    this.menusC.definirConfiguracoes(c);
    this.aoMudarConfig(this.configuracoes());
  }

  /** Tela de carregamento (progresso 0..1); null esconde. */
  carregamento(info: { progresso: number; texto?: string } | null) {
    this.avisosC.carregamento(info);
  }

  /** FPS medido (o contador só aparece com "Mostrar FPS" ligado). */
  fps(valor: number) {
    this.fpsAtual = valor;
    this.hudC.fps(this.configuracoes().mostrarFPS ? valor : null);
  }

  /** Nome da genealogia como fio de luz na transição de era (null limpa). */
  genealogia(nome: string | null, indice = 0) {
    this.avisosC.genealogia(nome, indice);
  }

  // ===================================== Interno =======================================

  private texto(ref: Ref, trecho?: string): TextoRef | null {
    try {
      return this.servicos.versiculo(ref, trecho);
    } catch (e) {
      const k = `${ref}|${trecho ?? ''}`;
      if (!this.errosRef.has(k)) {
        this.errosRef.add(k);
        console.error(e);
      }
      return null;
    }
  }

  private aoMudarConfig(c: Configuracoes) {
    if (this.fpsAtual !== null || !c.mostrarFPS) this.hudC.fps(c.mostrarFPS ? this.fpsAtual ?? 0 : null);
    this.acoes.configuracoes?.(c);
  }

  /** Algo abriu/fechou: cuida do ponteiro e avisa o jogo. */
  private mudouBloqueio() {
    const precisaCursor = this.pausaJogo() || this.dialogoC.aberto();
    if (precisaCursor && document.pointerLockElement) {
      this.soltouPonteiro = true;
      this.alvoPonteiro = document.pointerLockElement as HTMLElement;
      document.exitPointerLock();
    }
    if (!precisaCursor && this.soltouPonteiro) {
      setTimeout(() => {
        if (this.pausaJogo() || this.dialogoC.aberto() || !this.soltouPonteiro || document.pointerLockElement) return;
        this.soltouPonteiro = false;
        try {
          const r = this.alvoPonteiro?.requestPointerLock?.() as unknown;
          if (r instanceof Promise) r.catch(() => undefined);
        } catch {
          /* sem gesto do usuário: o jogador clica no jogo para travar */
        }
      }, 140);
    }
    const pausa = this.pausaJogo();
    if (pausa !== this.pausaAnterior) {
      this.pausaAnterior = pausa;
      this.raiz.classList.toggle('com-menu', pausa);
      this.acoes.menu?.(pausa);
    }
    this.raiz.classList.toggle('com-dialogo', this.dialogoC.aberto());
    this.raiz.classList.toggle('com-roda', this.rodaC.aberta());
  }

  private mudouPonteiro = () => {
    if (document.pointerLockElement) {
      this.alvoPonteiro = document.pointerLockElement as HTMLElement;
      this.soltouPonteiro = false;
      return;
    }
    if (this.pausarAoSoltarPonteiro && !this.bloqueado() && !this.avisosC.carregando()) this.abrirPausa();
  };

  private teclaBaixo = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code)) return;
    let usou = false;
    if (this.entenderC.aberto()) {
      if (e.code === 'Escape' && !e.repeat) this.entenderC.voltar();
      usou = true;
    } else if (this.diarioC.aberto()) usou = this.diarioC.tecla(e);
    else if (this.menusC.aberto()) usou = this.menusC.tecla(e);
    else if (this.rodaC.aberta()) usou = this.rodaC.tecla(e);
    else if (this.dialogoC.aberto()) usou = this.dialogoC.tecla(e);
    else if (this.atalhosGlobais && !e.repeat && !this.avisosC.carregando()) {
      if (e.code === 'KeyJ') {
        this.abrirDiario();
        usou = true;
      } else if (e.code === 'Escape') {
        usou = this.abrirPausa();
      }
    }
    if (usou) e.stopImmediatePropagation();
  };

  private teclaCima = (e: KeyboardEvent) => {
    if (e.code === 'Tab' && this.rodaC.aberta()) this.rodaC.fechar();
  };
}
