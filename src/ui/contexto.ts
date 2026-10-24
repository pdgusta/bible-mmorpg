// Contexto compartilhado entre os componentes da interface.
import type { Ref } from '../jogo/contratos';
import type { AcoesUI, DadosDiario, ServicosUI, TextoRef } from './tipos';

export interface CtxUI {
  readonly raiz: HTMLDivElement;
  readonly servicos: ServicosUI;
  acoes(): AcoesUI;
  diario(): DadosDiario;
  /** Texto de uma referência; null (e erro no console) se não existir na fonte. */
  texto(ref: Ref, trecho?: string): TextoRef | null;
  /** Abre o painel "Entender melhor". */
  entender(ref: Ref): void;
  aviso(texto: string, tipo?: 'xp' | 'atributo' | 'memoria' | 'armadura' | 'info' | 'unidade' | 'nivel'): void;
  /** Um componente abriu ou fechou algo que bloqueia o jogo. */
  mudouBloqueio(): void;
}
