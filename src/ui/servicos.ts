// Serviços padrão da UI ligados ao texto bíblico de src/jogo/Biblia.ts.
// Exige `await carregarBiblia()` antes do primeiro uso.
import { capitulosLeitura, textoCapitulo, trecho, versiculo } from '../jogo/Biblia';
import type { NomeClasse } from '../jogo/Classes';
import type { Falante, Ref } from '../jogo/contratos';
import type { RetratoUI, ServicosUI, TextoRef } from './tipos';

/** Nomes dos falantes especiais (podem ser sobrescritos). */
export const NOMES_ESPECIAIS: Record<string, string> = {
  deus: 'Deus',
  anjo: 'O Anjo do Senhor',
  satanas: 'Sussurro',
  narrador: '',
};

export interface OpcoesServicos {
  /** Nomes por id de falante ({ noe: 'Noé', cam: 'Cam' }). Função para nomes dinâmicos (Abrão → Abraão). */
  nomes?: Record<string, string> | ((falante: Falante) => string | undefined);
  /** Classe de cada falante jogável (para o retrato). */
  classes?: Record<string, NomeClasse>;
}

export function servicosBiblia(op: OpcoesServicos = {}): ServicosUI {
  const nomeDe = (f: Falante): string => {
    const n = typeof op.nomes === 'function' ? op.nomes(f) : op.nomes?.[f];
    if (n !== undefined) return n;
    if (f in NOMES_ESPECIAIS) return NOMES_ESPECIAIS[f];
    // nome livre de NPC: "pastor de Ló" → "Pastor de Ló"
    return f.charAt(0).toUpperCase() + f.slice(1);
  };
  return {
    versiculo(ref: Ref, parte?: string): TextoRef {
      const v = versiculo(ref);
      return { texto: trecho(ref, parte), extenso: v.referenciaExtenso, nvt: v.nvt, kjv: v.kjv };
    },
    nomeDe,
    retratoDe(f: Falante): RetratoUI | null {
      const classe = op.classes?.[f];
      return classe ? { classe } : null;
    },
    capitulos: () => capitulosLeitura(),
    capitulo: (livro, cap) => textoCapitulo(livro, cap).map((v) => ({ numero: v.numero, ref: v.ref, bkj: v.bkj })),
  };
}
