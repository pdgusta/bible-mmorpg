// Memórias de fidelidade da era de Noé (Livro das Memórias). Cada uma vira recurso de fé
// nas provas de dúvida das eras seguintes; o arco-íris é a mais forte (a ponte para B4).
import type { DefMemoria } from '../../jogo/contratos';

const ERA = 'noe';

export const MEMORIAS_NOE: DefMemoria[] = [
  {
    id: 'graca', titulo: 'Achou graça', ref: 'Gn 6:8', era: ERA, forca: 1,
    descricao: 'Numa terra cheia de violência, Noé achou graça diante do Senhor. A história da salvação começa pela graça, não pelo mérito.',
  },
  {
    id: 'pacto', titulo: 'Contigo estabelecerei o meu pacto', ref: 'Gn 6:18', era: ERA, forca: 2,
    descricao: 'Antes de cair uma gota de chuva, Deus prometeu guardar Noé e toda a sua casa. A primeira palavra para responder ao tentador.',
  },
  {
    id: 'pregador', titulo: 'Pregador da justiça', ref: '2Pe 2:5', era: ERA, forca: 1,
    descricao: 'Noé avisou a cidade mesmo sem ninguém ouvir. A vitória foi a fidelidade, não o resultado.',
  },
  {
    id: 'portaFechada', titulo: 'O Senhor fechou a porta', ref: 'Gn 7:16', era: ERA, forca: 2,
    descricao: 'Não foi Noé quem fechou a arca: foi o Senhor. Quem estava dentro estava guardado por Deus.',
  },
  {
    id: 'deusLembrou', titulo: 'Deus lembrou de Noé', ref: 'Gn 8:1', era: ERA, forca: 2,
    descricao: 'No escuro da tempestade, a família não estava esquecida. Deus lembrou de Noé e fez as águas baixarem.',
  },
  {
    id: 'folhaOliveira', titulo: 'A folha de oliveira', ref: 'Gn 8:11', era: ERA, forca: 2,
    descricao: 'Noé esperou mais sete dias e soltou a pomba outra vez. À tarde ela voltou com uma folha de oliveira no bico: as águas tinham baixado.',
  },
  {
    id: 'arcoIris', titulo: 'O sinal da aliança', ref: 'Gn 9:13', era: ERA, forca: 3,
    descricao: 'Deus pôs o seu arco na nuvem como sinal do pacto com toda a terra. Esta memória atravessará as gerações.',
    frase: 'Deus guardou Noé, como tinha prometido. Ele também cumprirá o que prometeu a você.',
  },
  {
    id: 'enoque', titulo: 'Enoque caminhava com Deus', ref: 'Gn 5:24', era: ERA, forca: 1, segredo: true,
    descricao: 'Uma pedra memorial na gruta lembra o bisavô de Noé, que caminhava com Deus. Noé andou no mesmo caminho.',
  },
  {
    id: 'lameque', titulo: 'Este nos consolará', ref: 'Gn 5:29', era: ERA, forca: 1, segredo: true,
    descricao: 'Lameque deu ao filho o nome de Noé, esperando consolo para o trabalho duro numa terra amaldiçoada.',
  },
  {
    id: 'estacoes', titulo: 'Semeadura e colheita', ref: 'Gn 8:22', era: ERA, forca: 1, segredo: true,
    descricao: 'No campo onde antes havia trigo, a terra lavada espera a semente. Enquanto a terra durar, as estações não cessarão.',
  },
];

/** Memórias opcionais (segredos de exploração) desta era: contam para o legado de Abrão. */
export const SEGREDOS_NOE = MEMORIAS_NOE.filter((m) => m.segredo).map((m) => m.id);

export function memoriaNoe(id: string): DefMemoria {
  const m = MEMORIAS_NOE.find((d) => d.id === id);
  if (!m) throw new Error(`Memória desconhecida na era de Noé: ${id}`);
  return m;
}
