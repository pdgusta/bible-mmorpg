// Depuração e e2e (só com ?dev ou pelo window.partida.dev): joga a era pelos atalhos dela,
// avança o tempo de jogo em modo manual (sem esperar a renderização), passa as falas
// sozinho e para em "capturas" (momentos de foto) até o e2e liberar.
import type { Partida } from '../Partida';
import type { AtalhosEra } from '../eras';
import { esperarJogo, estadoMissaoAtual } from './comum';

/** Momento de foto: quando `quando()` fica verdadeiro, espera `atraso` s de jogo e para. */
interface Captura {
  nome: string;
  /** Missão em que vale (as provas dela esperam a foto antes de serem vencidas). */
  missao?: string;
  quando(): boolean;
  atraso?: number;
  /** Segura a vitória automática das provas desta missão até a foto. */
  segurarProva?: boolean;
  /** Deixa a fala na tela (não avança o diálogo enquanto espera). */
  manterFala?: boolean;
  /** Algo a fazer ao disparar (ex.: começar uma troca). */
  acao?(): void;
}

export interface ResultadoAvanco {
  /** Segundos de jogo avançados. */
  t: number;
  captura?: string;
  fim?: boolean;
  erro?: string;
}

export class Depuracao {
  /** Capturas ligadas (nomes de CAPTURAS). */
  capturas = new Set<string>();
  readonly feitas = new Set<string>();
  /** Captura esperando a foto (o e2e chama liberar()). */
  pendente: string | null = null;
  /** Etapas vistas pelos atalhos ("a1.orar"). */
  readonly etapas: string[] = [];
  jogando: Promise<void> | null = null;
  fim = false;
  erro: string | null = null;
  private provaPendente = false;
  private disparada: { c: Captura; t: number } | null = null;
  private inicioTransicao = -1;

  constructor(private p: Partida) {
    p.jogo.eventos.on('era:transicao', () => (this.inicioTransicao = p.jogo.tempo));
  }

  private get missao(): string | null {
    return this.p.s.missoes.missaoAtual;
  }

  private etapaAtual(): string {
    const e = estadoMissaoAtual(this.p.s);
    if (!e) return '';
    const def = this.p.s.missoes.definicao(e.id);
    return `${e.id}.${def?.etapas[e.etapa]?.id ?? e.etapa}`;
  }

  /** Momentos de foto do e2e da era 1 (e da transição). */
  private lista(): Captura[] {
    const { jogo, ui, s } = this.p;
    const falante = (quem: string) => !!ui.raiz.querySelector(`.dialogo.aberto.falante-${quem}`);
    return [
      { nome: 'a1-deus', missao: 'a1', manterFala: true, quando: () => this.missao === 'a1' && ui.dialogoAberto() && falante('deus') },
      {
        nome: 'troca', missao: 'a1', atraso: 1.15,
        quando: () => this.etapaAtual() === 'a1.troncos' && jogo.podeTrocar && jogo.ativo?.id !== 'cam',
        acao: () => void jogo.troca.trocarPara('cam'),
      },
      { nome: 'a2-viga', missao: 'a2', atraso: 0.6, quando: () => this.missao === 'a2' && !!jogo.flags.vigaAmarrada },
      { nome: 'a3-prova', missao: 'a3', atraso: 1.5, segurarProva: true, quando: () => this.missao === 'a3' && s.provas.emProva },
      { nome: 'a5-arca', missao: 'a5', atraso: 2, quando: () => this.etapaAtual() === 'a5.fontes' && !!jogo.flags.interiorArca },
      { nome: 'a6-arco', missao: 'a6', manterFala: true, quando: () => !!jogo.flags.arcoIrisNoCeu && ui.dialogoAberto() && falante('deus') },
      { nome: 'transicao', atraso: 0, quando: () => this.inicioTransicao >= 0 && jogo.tempo - this.inicioTransicao > 6.5 && jogo.transicao },
    ];
  }

  /** Liga capturas pelo nome (ou todas, sem argumento). */
  ligarCapturas(nomes?: string[]) {
    for (const c of this.lista()) if (!nomes || nomes.includes(c.nome)) this.capturas.add(c.nome);
  }

  private atalhos(): AtalhosEra {
    const era = this.p.era;
    const a = era?.atalhos?.({
      resolverProva: () => this.resolverProva(),
      esperar: (seg) => esperarJogo(this.p.jogo, seg),
      limite: 900,
    });
    if (!a) throw new Error(`A era ${era?.def.id ?? '?'} não tem atalhos de depuração.`);
    return a;
  }

  private resolverProva(): boolean {
    const m = this.missao;
    const segura = this.lista().some((c) => c.segurarProva && c.missao === m && this.capturas.has(c.nome) && !this.feitas.has(c.nome));
    if (segura) {
      this.provaPendente = true;
      return true;
    }
    return this.p.s.provas.resolverAutomaticamente();
  }

  /** Começa a jogar a era atual pelos atalhos (não espera; use avancar()). */
  jogar(ate?: string) {
    this.fim = false;
    this.erro = null;
    this.p.ui.dialogoC.velocidade = 0;
    this.jogando = this.atalhos()
      .jogar({ ate, aoEtapa: (m, e) => this.etapas.push(`${m}.${e}`) })
      .then(
        () => {
          this.fim = true;
        },
        (e) => {
          this.erro = String((e as Error)?.message ?? e);
          this.fim = true;
          console.error('[dev] atalhos:', e);
        },
      );
  }

  /** Passa a fala/escolha na tela (a primeira opção disponível). */
  private passarFala() {
    const ui = this.p.ui;
    // os créditos do fim da era 2 esperam alguém fechar a tela
    if (ui.menusC.topo() === 'creditos') {
      ui.fecharMenus();
      return;
    }
    if (!ui.dialogoAberto()) return;
    if (ui.dialogoC.emEscolha()) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1', key: '1', bubbles: true }));
    } else ui.avancarDialogo();
  }

  /**
   * Avança `segundos` de jogo em passos de `passo` (modo manual: a lógica corre sem esperar a
   * renderização), passando as falas. Para antes se uma captura disparar ou os atalhos acabarem.
   */
  async avancar(segundos: number, passo = 0.1): Promise<ResultadoAvanco> {
    const jogo = this.p.jogo;
    jogo.manual = true;
    let t = 0;
    while (t < segundos - 1e-6) {
      if (this.pendente) return { t, captura: this.pendente };
      const c = this.verificarCapturas();
      if (c) return { t, captura: c };
      if (!this.disparada?.c.manterFala) this.passarFala();
      if (this.fim && !this.disparada) return { t, fim: true, erro: this.erro ?? undefined };
      await jogo.avancar(passo);
      t += passo;
    }
    return { t };
  }

  private verificarCapturas(): string | null {
    const jogo = this.p.jogo;
    const d = this.disparada;
    if (d) {
      if (jogo.tempo - d.t >= (d.c.atraso ?? 0) - 1e-6) {
        this.disparada = null;
        this.pendente = d.c.nome;
        return d.c.nome;
      }
      return null;
    }
    for (const c of this.lista()) {
      if (!this.capturas.has(c.nome) || this.feitas.has(c.nome)) continue;
      let ok = false;
      try {
        ok = c.quando();
      } catch {
        ok = false;
      }
      if (!ok) continue;
      c.acao?.();
      if (!c.atraso) {
        this.pendente = c.nome;
        return c.nome;
      }
      this.disparada = { c, t: jogo.tempo };
      return null;
    }
    return null;
  }

  /** Foto tirada: segue o jogo (e vence a prova que estava esperando). */
  liberar() {
    if (this.pendente) this.feitas.add(this.pendente);
    this.pendente = null;
    if (this.provaPendente) {
      this.provaPendente = false;
      this.p.s.provas.resolverAutomaticamente();
    }
  }

  /** ?dev&missao=a3: joga pelos atalhos até a missão pedida, atrás da tela de carregamento. */
  async pularPara(missao: string) {
    const { jogo, ui, s } = this.p;
    const ordem = this.p.era?.def.missoes.map((m) => m.id) ?? [];
    const alvo = ordem.indexOf(missao);
    if (alvo < 0) {
      ui.aviso(`Missão desconhecida nesta era: ${missao}`, 'info');
      return;
    }
    const titulo = s.missoes.definicao(missao)?.titulo ?? missao;
    this.jogar(missao);
    while (!this.fim) {
      const i = Math.max(0, ordem.indexOf(this.missao ?? ''));
      ui.carregamento({ progresso: Math.min(0.98, (i + 0.5) / Math.max(1, alvo)), texto: `Avançando até ${titulo}…` });
      const r = await this.avancar(4);
      if (r.captura) this.liberar();
    }
    ui.carregamento(null);
    ui.dialogoC.velocidade = 52;
    jogo.manual = false;
    if (this.erro) ui.aviso(`Atalho falhou: ${this.erro}`, 'info');
  }

  /** ?dev&auto=1: joga a era inteira sozinho (a renderização continua a cada quadro). */
  async jogarSozinho() {
    this.jogar();
    while (!this.fim) {
      const r = await this.avancar(2);
      if (r.captura) this.liberar();
    }
    this.p.jogo.manual = false;
    this.p.ui.dialogoC.velocidade = 52;
    if (this.erro) this.p.ui.aviso(`Atalho falhou: ${this.erro}`, 'info');
  }
}
