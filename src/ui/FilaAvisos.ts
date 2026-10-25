// Fila dos avisos (xp, atributo, memória...): no máximo `limite` na tela, o resto espera a vez.
// Lógica pura, sem DOM nem relógio; quem desenha e marca o tempo é o Avisos.
import type { TipoAviso } from './Avisos';

export interface ItemAviso<T> {
  chave: string;
  dados: T;
  /** Quantas vezes o mesmo aviso chegou (×n). */
  n: number;
  /** Já está saindo da tela: ainda ocupa a vaga, mas não agrupa mais. */
  saindo?: boolean;
}

export type Entrada<T> = { tipo: 'mostrar' | 'esperar' | 'agrupar'; item: ItemAviso<T> };

export class FilaAvisos<T> {
  readonly visiveis: ItemAviso<T>[] = [];
  readonly espera: ItemAviso<T>[] = [];

  constructor(private limite: number, private tetoEspera = 8) {}

  entrar(chave: string, dados: T): Entrada<T> {
    const igual = [...this.visiveis, ...this.espera].find((i) => i.chave === chave && !i.saindo);
    if (igual) {
      igual.n++;
      return { tipo: 'agrupar', item: igual };
    }
    const item = { chave, dados, n: 1 };
    if (this.visiveis.length < this.limite) {
      this.visiveis.push(item);
      return { tipo: 'mostrar', item };
    }
    this.espera.push(item);
    while (this.espera.length > this.tetoEspera) this.espera.shift();
    return { tipo: 'esperar', item };
  }

  /** O aviso começou a sair: a vaga continua ocupada até `sair`, mas um igual que chegar é novo. */
  despedir(item: ItemAviso<T>) {
    item.saindo = true;
  }

  /** Tira o aviso (da tela ou da fila) e devolve os que passam a aparecer. */
  sair(item: ItemAviso<T>): ItemAviso<T>[] {
    const i = this.visiveis.indexOf(item);
    if (i >= 0) {
      this.visiveis.splice(i, 1);
      return this.promover();
    }
    const j = this.espera.indexOf(item);
    if (j >= 0) this.espera.splice(j, 1);
    return [];
  }

  /**
   * Muda o limite (a tela mudou de tamanho, a dica apareceu). Com limite maior, `entram` os
   * primeiros da fila; com menor, os mais novos da tela `voltam` para a frente da fila (quem já
   * está saindo termina de sair).
   */
  definirLimite(limite: number): { entram: ItemAviso<T>[]; voltam: ItemAviso<T>[] } {
    this.limite = limite;
    const voltam: ItemAviso<T>[] = [];
    for (let i = this.visiveis.length - 1; i >= 0 && this.visiveis.length > limite; i--) {
      if (this.visiveis[i].saindo) continue;
      voltam.unshift(...this.visiveis.splice(i, 1));
    }
    this.espera.unshift(...voltam);
    return { entram: this.promover(), voltam };
  }

  private promover(): ItemAviso<T>[] {
    const novos: ItemAviso<T>[] = [];
    while (this.visiveis.length < this.limite && this.espera.length) {
      const item = this.espera.shift()!;
      this.visiveis.push(item);
      novos.push(item);
    }
    return novos;
  }
}

/** Altura que um aviso de duas linhas ocupa na pilha, com o espaço entre eles, em rem. */
export const ALTURA_AVISO_REM = 4.2;

/**
 * Quantos avisos aparecem de uma vez: um teto pela altura da tela (px) e, abaixo dele, quantos
 * cabem no `espaco` livre (px) entre o retrato e a dica. Sempre pelo menos um.
 */
export function limiteAvisos(altura: number, espaco = Infinity, rem = 14): number {
  const teto = altura < 560 ? 2 : altura < 900 ? 3 : 4;
  return Math.max(1, Math.min(teto, Math.floor(espaco / (ALTURA_AVISO_REM * rem))));
}

const MARCANTES: TipoAviso[] = ['nivel', 'memoria', 'armadura'];

/** Tempo na tela em ms. Com gente na fila, todos encurtam para a fila andar. */
export function duracaoAviso(tipo: TipoAviso, comFila: boolean): number {
  const marcante = MARCANTES.includes(tipo);
  if (comFila) return marcante ? 3600 : 2600;
  return marcante ? 5600 : 4200;
}
