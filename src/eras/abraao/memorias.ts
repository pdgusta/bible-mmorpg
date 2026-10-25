// Memórias de fidelidade da era de Abraão (Livro das Memórias). Juntam-se às de Noé como
// recurso de fé na noite das estrelas (B4). As duas últimas são o próprio resultado de uma
// prova (força 0: não servem como recurso).
import type { DefMemoria } from '../../jogo/contratos';

const ERA = 'abraao';

export const MEMORIAS_ABRAAO: DefMemoria[] = [
  {
    id: 'chamado', titulo: 'O chamado', ref: 'Gn 12:1', era: ERA, forca: 1,
    descricao: 'Abrão deixou a terra, a parentela e a casa do pai por uma terra que ainda não conhecia. Obedeceu antes de ver.',
  },
  {
    id: 'altarBetel', titulo: 'O altar entre Betel e Ai', ref: 'Gn 12:8', era: ERA, forca: 1,
    descricao: 'Onde armou a tenda, Abrão levantou um altar e invocou o nome do Senhor. A terra prometida começou pela adoração.',
  },
  {
    id: 'naoHajaContenda', titulo: 'Não haja contenda', ref: 'Gn 13:8', era: ERA, forca: 1,
    descricao: 'Para não brigar com o sobrinho, Abrão deixou Ló escolher primeiro. Quem confia em Deus pode ceder.',
  },
  {
    id: 'percorreATerra', titulo: 'Levanta-te, caminha pela terra', ref: 'Gn 13:17', era: ERA, forca: 2,
    descricao: 'Depois que Ló partiu, Deus mandou Abrão olhar para os quatro lados: toda a terra seria dele e da sua semente.',
  },
  {
    id: 'resgate', titulo: 'Trouxe de volta o seu irmão', ref: 'Gn 14:16', era: ERA, forca: 2,
    descricao: 'Ló tinha escolhido a melhor terra e foi levado cativo. Abrão não o abandonou: foi buscá-lo de noite, até Dã.',
  },
  {
    id: 'melquisedeque', titulo: 'Bendito seja Abrão', ref: 'Gn 14:19', era: ERA, forca: 2,
    descricao: 'O rei de Salém, sacerdote do Deus Altíssimo, trouxe pão e vinho e abençoou Abrão. A vitória veio de Deus.',
  },
  {
    id: 'nemUmFio', titulo: 'Nem um fio', ref: 'Gn 14:22-23', era: ERA, forca: 1,
    descricao: 'Abrão recusou as riquezas de Sodoma para que ninguém dissesse que outro o enriqueceu além do Senhor.',
  },
  {
    id: 'poDaTerra', titulo: 'Como o pó da terra', ref: 'Gn 13:16', era: ERA, forca: 1, segredo: true,
    descricao: 'Um punhado de pó na mão, impossível de contar. Assim Deus prometeu que seria a semente de Abrão.',
  },
  {
    id: 'estrelas', titulo: 'Conta as estrelas', ref: 'Gn 15:5', era: ERA, forca: 0,
    descricao: 'Numa noite de dúvida, Deus levou Abrão para fora da tenda e mostrou o céu: assim seria a sua semente. E ele creu.',
  },
  {
    id: 'jeovaJire', titulo: 'Javé-Jiré', ref: 'Gn 22:14', era: ERA, forca: 0,
    descricao: 'No monte Moriá, Deus proveu o carneiro no lugar de Isaque. Abraão deu ao lugar um nome que guarda isso: o Senhor proverá.',
  },
];

/** Memórias opcionais (segredos de exploração) desta era. */
export const SEGREDOS_ABRAAO = MEMORIAS_ABRAAO.filter((m) => m.segredo).map((m) => m.id);

export function memoriaAbraao(id: string): DefMemoria {
  const m = MEMORIAS_ABRAAO.find((d) => d.id === id);
  if (!m) throw new Error(`Memória desconhecida na era de Abraão: ${id}`);
  return m;
}
