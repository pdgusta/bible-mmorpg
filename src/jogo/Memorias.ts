// Livro das Memórias: registro das memórias de fidelidade que atravessam as eras.
// O conteúdo de cada era registra as suas (registrarMemorias) ao carregar; quais o jogador
// já guardou fica em Progresso. Uma memória de uma era vira recurso de fé nas seguintes
// (ex.: o arco-íris de Noé acende estrelas na noite de dúvida de Abrão).
import type { DefMemoria } from './contratos';

export class RegistroMemorias {
  private defs = new Map<string, DefMemoria>();

  registrar(defs: DefMemoria | DefMemoria[]) {
    for (const d of Array.isArray(defs) ? defs : [defs]) {
      if (d.forca <= 0) throw new Error(`Memória "${d.id}" com força inválida (${d.forca})`);
      this.defs.set(d.id, d);
    }
  }

  obter(id: string): DefMemoria | undefined {
    return this.defs.get(id);
  }

  /** Lança se a memória não estiver registrada. */
  exigir(id: string): DefMemoria {
    const d = this.defs.get(id);
    if (!d) throw new Error(`Memória desconhecida: ${id}`);
    return d;
  }

  existe(id: string): boolean {
    return this.defs.has(id);
  }

  todas(): DefMemoria[] {
    return [...this.defs.values()];
  }

  daEra(era: string): DefMemoria[] {
    return this.todas().filter((d) => d.era === era);
  }

  limpar() {
    this.defs.clear();
  }
}

/** Registro global usado pelo jogo (as eras registram aqui as suas memórias). */
export const MEMORIAS = new RegistroMemorias();

export function registrarMemorias(defs: DefMemoria | DefMemoria[]) {
  MEMORIAS.registrar(defs);
}

export function obterMemoria(id: string): DefMemoria | undefined {
  return MEMORIAS.obter(id);
}
