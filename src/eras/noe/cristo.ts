// "Aponta para Cristo" (Diário): notas do jogo que ligam o texto do Antigo Testamento ao de
// Cristo. O texto é nota do jogo (2–4 frases), sem citar versículos por extenso: as
// referências abrem o texto bíblico no Diário.
import type { Ref } from '../../jogo/contratos';

export interface EntradaCristo {
  id: string;
  titulo: string;
  refs: Ref[];
  /** Nota do jogo (marcada como nota no Diário). */
  texto: string;
  /** Onde a entrada é desbloqueada (missão/etapa). */
  desbloqueia?: string;
  /** Onde a entrada se completa, se for revelada em partes. */
  completaEm?: string;
}

export const CRISTO_NOE: EntradaCristo[] = [
  {
    id: 'semente',
    titulo: 'A Semente prometida',
    refs: ['Gn 3:15', 'Gl 3:16'],
    desbloqueia: 'prologo',
    completaEm: 'b5',
    texto:
      'Logo depois da queda, Deus prometeu que a semente da mulher feriria a cabeça da serpente. ' +
      'Essa promessa passa de geração em geração: de Noé a Sem, de Sem a Abraão. ' +
      'O apóstolo Paulo explica que a Semente é uma só pessoa: Cristo.',
  },
  {
    id: 'arca',
    titulo: 'Uma só porta',
    refs: ['1Pe 3:20-21', 'Jo 10:9', 'Mt 24:37-39'],
    desbloqueia: 'a5.porta',
    texto:
      'A arca tinha uma só porta, e foi o próprio Senhor quem a fechou. ' +
      'Pedro vê nas águas do dilúvio uma figura do batismo, e Jesus se apresenta como a porta: quem entra por ele é salvo. ' +
      'Jesus lembra que, nos dias de Noé, todos comiam e bebiam e não perceberam nada até o dilúvio chegar: assim será a sua vinda.',
  },
  {
    id: 'tempestade',
    titulo: 'Paz, aquieta-te',
    refs: ['Mc 4:39-40'],
    desbloqueia: 'a5.medo',
    texto:
      'Noé e sua família atravessaram a tempestade guardados por Deus, sem ver o fim das águas. ' +
      'Muitos séculos depois, num barco no mar da Galileia, Jesus repreendeu o vento, e o mar se acalmou. ' +
      'Ele perguntou aos discípulos pela fé deles: confiar em Deus no meio da tempestade, como Noé na arca.',
  },
  {
    id: 'linhagem',
    titulo: 'De Noé a Jesus',
    refs: ['Lc 3:34', 'Lc 3:36'],
    desbloqueia: 'a6.transicao',
    texto:
      'Lucas traça a genealogia de Jesus até o princípio, e nela estão Sem e Noé. ' +
      'A promessa feita no Éden atravessou o dilúvio dentro da arca e seguiu por Sem até Abraão. ' +
      'Cada geração guardou a promessa até que viesse a Semente: Cristo.',
  },
];

export function entradaCristoNoe(id: string): EntradaCristo {
  const e = CRISTO_NOE.find((c) => c.id === id);
  if (!e) throw new Error(`"Aponta para Cristo" desconhecido na era de Noé: ${id}`);
  return e;
}
