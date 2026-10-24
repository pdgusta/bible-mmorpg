// Barramento de eventos simples e tipado por nome.

export type Ouvinte<T = any> = (dados: T) => void;

export class Eventos {
  private ouvintes = new Map<string, Set<Ouvinte>>();

  on<T = any>(nome: string, fn: Ouvinte<T>): () => void {
    let s = this.ouvintes.get(nome);
    if (!s) this.ouvintes.set(nome, (s = new Set()));
    s.add(fn);
    return () => s!.delete(fn);
  }

  once<T = any>(nome: string, fn: Ouvinte<T>): () => void {
    const off = this.on<T>(nome, (d) => {
      off();
      fn(d);
    });
    return off;
  }

  emit<T = any>(nome: string, dados?: T): void {
    const s = this.ouvintes.get(nome);
    if (s) for (const fn of [...s]) fn(dados);
    const todos = this.ouvintes.get('*');
    if (todos) for (const fn of [...todos]) fn({ nome, dados });
  }

  limpar(): void {
    this.ouvintes.clear();
  }
}
