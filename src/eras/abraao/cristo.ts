// "Aponta para Cristo" (Diário) da era de Abraão: notas do jogo que ligam o texto do Antigo
// Testamento ao de Cristo (2–4 frases, sem citar versículos por extenso: as referências abrem
// o texto bíblico no Diário). A entrada 'semente' é da era de Noé e se completa em B5.
import type { EntradaCristo } from '../noe/cristo';

export type { EntradaCristo };

export const CRISTO_ABRAAO: EntradaCristo[] = [
  {
    id: 'bencaoNacoes',
    titulo: 'Todas as famílias da terra',
    refs: ['Gn 12:3', 'Gl 3:8', 'Gl 3:16'],
    desbloqueia: 'b1.altarMore',
    texto:
      'Deus prometeu a Abrão que nele todas as famílias da terra seriam abençoadas. ' +
      'Paulo diz que essa promessa já era o evangelho anunciado de antemão: a bênção chegaria a todos os povos pela fé. ' +
      'Em Cristo, a Semente de Abraão, a porta se abre para gente de toda nação.',
  },
  {
    id: 'melquisedeque',
    titulo: 'Rei de justiça e de paz',
    refs: ['Hb 7:1-3'],
    desbloqueia: 'b3.melquisedeque',
    texto:
      'Melquisedeque, rei de Salém e sacerdote do Deus Altíssimo, abençoou Abrão e recebeu dele o dízimo. ' +
      'A carta aos Hebreus lê no seu nome "rei de justiça" e no seu reino "rei de paz". ' +
      'A carta o compara ao Filho de Deus: ele aponta para Jesus, o sacerdote que permanece para sempre.',
  },
  {
    id: 'justica',
    titulo: 'Creu, e foi justiça',
    refs: ['Gn 15:6', 'Rm 4:3', 'Gl 3:8'],
    desbloqueia: 'b4.creu',
    texto:
      'Abrão olhou as estrelas e creu na promessa, e Deus lhe atribuiu isso por justiça. ' +
      'Paulo volta a este versículo para mostrar que é pela fé que Deus declara alguém justo. ' +
      'Esse é o evangelho anunciado de antemão a Abraão: em Cristo, a mesma justiça chega pela fé a gente de todas as nações.',
  },
  {
    id: 'cordeiro',
    titulo: 'Deus proverá o cordeiro',
    refs: ['Gn 22:8', 'Jo 1:29', 'Rm 8:32', 'Jo 8:56'],
    desbloqueia: 'b5.carneiro',
    texto:
      'No caminho do Moriá, Isaque perguntou pelo cordeiro, e Abraão respondeu que Deus proveria. ' +
      'Deus poupou Isaque, mas não poupou o próprio Filho: João Batista apontou para Jesus como o Cordeiro de Deus. ' +
      'Jesus disse que Abraão se alegrou por ver o seu dia.',
  },
];

export function entradaCristoAbraao(id: string): EntradaCristo {
  const e = CRISTO_ABRAAO.find((c) => c.id === id);
  if (!e) throw new Error(`"Aponta para Cristo" desconhecido na era de Abraão: ${id}`);
  return e;
}
