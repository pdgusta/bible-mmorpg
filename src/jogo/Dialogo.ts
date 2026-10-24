// Diálogos e escolhas. Antes de mostrar, confere cada fala bíblica contra versiculos.json
// (referência existente e `trecho` substring exata: em desenvolvimento, erro). A interface
// recebe as Linhas como estão e mostra o texto com Biblia.textoLinha().
// Escolhas: as opções com requisito de atributo (✦) só valem para o personagem ativo que o
// cumpre; os efeitos vão para o Progresso (atributos, Unidade, XP) e para as flags.
import type { Ficha, NomeAtributo } from './Atributos';
import { carregarBiblia, textoLinha } from './Biblia';
import { ehBiblica, type EfeitoEscolha, type InterfaceUI, type Linha, type OpcaoEscolha } from './contratos';
import type { EmissorEventos, Progresso } from './Progresso';

export interface DepsDialogo {
  ui: Pick<InterfaceUI, 'dialogo' | 'escolha'>;
  eventos: EmissorEventos;
  progresso: Progresso;
  /** Personagem ativo (para requisitos e efeitos das escolhas). */
  ativo(): { id: string; ficha: Ficha | null } | null;
  definirFlag(nome: string, valor?: unknown): void;
}

export class Dialogo {
  private readonly deps: DepsDialogo;
  /** Sessões de diálogo abertas (falas e escolhas podem se aninhar). */
  private abertas = new Set<number>();
  private proxima = 1;

  constructor(deps: DepsDialogo) {
    this.deps = deps;
  }

  get emDialogo(): boolean {
    return this.abertas.size > 0;
  }

  /** Confere as falas bíblicas (lança se a referência não existir; em DEV, se o trecho não bater). */
  validar(linhas: (Linha | null | undefined)[]) {
    for (const l of linhas) if (l && ehBiblica(l)) textoLinha(l);
  }

  /** Texto a mostrar para uma fala (bíblica ou do jogo). */
  texto(l: Linha): string {
    return ehBiblica(l) ? textoLinha(l) : l.texto;
  }

  private abrir(): number {
    const id = this.proxima++;
    if (this.abertas.size === 0) this.deps.eventos.emit('dialogo:inicio');
    this.abertas.add(id);
    return id;
  }

  private fechar(id: number) {
    if (!this.abertas.delete(id)) return;
    if (this.abertas.size === 0) this.deps.eventos.emit('dialogo:fim');
  }

  /** Fecha tudo (missão abortada, jogo carregado). Emite 'dialogo:fim' se havia algo aberto. */
  cancelar() {
    if (!this.abertas.size) return;
    this.abertas.clear();
    this.deps.eventos.emit('dialogo:fim');
  }

  /** Mostra as falas em sequência; resolve quando o jogador avança a última. */
  async falar(linhas: Linha[]): Promise<void> {
    if (!linhas.length) return;
    await carregarBiblia();
    this.validar(linhas);
    const sessao = this.abrir();
    try {
      await this.deps.ui.dialogo(linhas);
    } finally {
      this.fechar(sessao);
    }
  }

  /** A opção está disponível para o personagem ativo? */
  podeEscolher(o: OpcaoEscolha): boolean {
    if (!o.requer) return true;
    const f = this.deps.ativo()?.ficha;
    return !!f && f.atributos[o.requer.atributo] >= o.requer.minimo;
  }

  /** Pergunta com opções. Aplica os efeitos da escolhida, mostra a resposta e devolve o índice. */
  async escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[]): Promise<number> {
    if (!opcoes.length) throw new Error('Escolha sem opções');
    await carregarBiblia();
    this.validar([pergunta, ...opcoes.flatMap((o) => o.resposta ?? [])]);
    const sessao = this.abrir();
    try {
      let i = await this.deps.ui.escolha(pergunta, opcoes, (o) => this.podeEscolher(o));
      if (!Number.isInteger(i) || !opcoes[i] || !this.podeEscolher(opcoes[i])) {
        const valida = opcoes.findIndex((o) => this.podeEscolher(o));
        i = valida >= 0 ? valida : 0;
      }
      const opcao = opcoes[i];
      this.aplicarEfeitos(opcao.efeitos);
      this.deps.progresso.contar('escolhas');
      if (opcao.resposta?.length) await this.deps.ui.dialogo(opcao.resposta);
      return i;
    } finally {
      this.fechar(sessao);
    }
  }

  /** Efeitos de uma escolha: pontos de atributo no ativo, Unidade, flag e XP. */
  aplicarEfeitos(e?: EfeitoEscolha) {
    if (!e) return;
    const ativo = this.deps.ativo();
    const p = this.deps.progresso;
    if (e.atributos && ativo) {
      for (const [a, n] of Object.entries(e.atributos)) if (n) p.somarAtributo(ativo.id, a as NomeAtributo, n);
    }
    if (e.unidade) p.alterarUnidade(e.unidade);
    if (e.flag) this.deps.definirFlag(e.flag, true);
    if (e.xp && ativo) p.ganharXP(ativo.id, 'servir', e.xp);
  }
}
