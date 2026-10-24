import * as THREE from 'three';
import type { Personagem } from './Personagem';
import { NOMES_VERBOS, type Verbo } from './Classes';

/** Algo no mundo com que o personagem controlado pode interagir (tecla E). */
export interface Interativo {
  id: string;
  pos: THREE.Vector3;
  raio: number;
  rotulo: string;
  verbo: Verbo;
  /** Segundos segurando E (0 = toque). */
  segurar?: number;
  ativo: boolean | (() => boolean);
  /** Nome de quem pode fazer isso (para a dica quando o personagem atual não pode). */
  dica?: string;
  /** Mostra um marcador flutuante. */
  marcador?: boolean;
  aoInteragir(p: Personagem): void | Promise<void>;
  /** Progresso enquanto segura (0..1). */
  aoProgresso?(p: Personagem, t: number): void;
  /** Animação do personagem enquanto segura. */
  animacao?: import('../entidades/humano/Animador').NomeClipe;
  /** Exige que o personagem esteja carregando algo (ou nada). */
  carregando?: string | null;
}

export class Interativos {
  private lista = new Map<string, Interativo>();

  adicionar(i: Interativo): Interativo {
    this.lista.set(i.id, i);
    return i;
  }

  remover(id: string) {
    this.lista.delete(id);
  }

  obter(id: string) {
    return this.lista.get(id);
  }

  todos() {
    return this.lista.values();
  }

  static ativo(i: Interativo) {
    return typeof i.ativo === 'function' ? i.ativo() : i.ativo;
  }

  /** O interativo mais próximo ao alcance do personagem (preferindo os que estão à frente). */
  maisProximo(p: Personagem): { i: Interativo; pode: boolean } | null {
    let melhor: Interativo | null = null;
    let melhorNota = Infinity;
    const pos = p.posicao;
    const frente = p.frente();
    for (const i of this.lista.values()) {
      if (!Interativos.ativo(i)) continue;
      const dx = i.pos.x - pos.x;
      const dz = i.pos.z - pos.z;
      const dy = i.pos.y - pos.y;
      const d = Math.hypot(dx, dz);
      if (d > i.raio || Math.abs(dy) > 3.5) continue;
      if (i.carregando !== undefined) {
        if (i.carregando === null && p.carregando) continue;
        if (i.carregando && p.carregando !== i.carregando) continue;
      }
      const alinh = d > 0.01 ? (dx * frente.x + dz * frente.z) / d : 1;
      const nota = d - alinh * 0.8;
      if (nota < melhorNota) {
        melhorNota = nota;
        melhor = i;
      }
    }
    if (!melhor) return null;
    return { i: melhor, pode: p.pode(melhor.verbo) };
  }
}

export function textoAcao(i: Interativo): string {
  return i.rotulo || NOMES_VERBOS[i.verbo];
}
