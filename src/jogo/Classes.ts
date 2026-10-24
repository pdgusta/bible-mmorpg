// Classes: correlatos bíblicos dos arquétipos clássicos. Cada classe dá "verbos" (ações que
// o personagem sabe fazer no mundo), uma habilidade de classe (tecla Q) e dons por nível.

export type NomeClasse = 'construtor' | 'guerreiro' | 'batedor' | 'sacerdote' | 'profeta' | 'pastor' | 'hospitaleiro' | 'conselheiro';

/** Verbos de interação. Comuns a todos: falar, pegar, orar, olhar, carregar (leve). */
export type Verbo =
  | 'falar' | 'pegar' | 'orar' | 'olhar' | 'carregar' | 'usar'
  | 'construir' | 'reparar' | 'cortar'
  | 'carregarPesado' | 'empurrar' | 'segurar' | 'lutar'
  | 'escalar' | 'amarrar' | 'equilibrar'
  | 'acalmar' | 'interceder' | 'abencoar'
  | 'proclamar' | 'discernir'
  | 'guiar' | 'funda'
  | 'preparar' | 'cuidar' | 'servir'
  | 'negociar' | 'mediar'
  | 'construirAltar';

export const VERBOS_COMUNS: Verbo[] = ['falar', 'pegar', 'orar', 'olhar', 'carregar', 'usar'];

export interface Dom {
  nivel: number;
  nome: string;
  descricao: string;
}

export interface InfoClasse {
  nome: string;
  arquetipo: string;
  papel: string;
  ferramentas: string;
  verbos: Verbo[];
  habilidade: { nome: string; descricao: string };
  dons: Dom[];
  icone: string;
}

export const CLASSES: Record<NomeClasse, InfoClasse> = {
  construtor: {
    nome: 'Construtor', arquetipo: 'engenheiro / tanque utilitário', papel: 'Ergue, conserta e abre passagem.',
    ferramentas: 'Machado, martelo, prumo, cordas e betume.',
    verbos: ['construir', 'reparar', 'cortar'],
    habilidade: { nome: 'Avaliar a obra', descricao: 'Mostra o que falta para concluir uma construção por perto.' },
    dons: [
      { nivel: 2, nome: 'Mãos firmes', descricao: 'Constrói e conserta 25% mais rápido.' },
      { nivel: 4, nome: 'Olho de prumo', descricao: 'Reparos de emergência gastam menos fôlego.' },
      { nivel: 6, nome: 'Mestre de obras', descricao: 'Companheiros por perto constroem mais rápido.' },
    ],
    icone: '🔨',
  },
  guerreiro: {
    nome: 'Guerreiro', arquetipo: 'guerreiro / tanque', papel: 'Protege, sustenta e luta quando a história pede.',
    ferramentas: 'Escudo, cajado de luta e espada (só em batalhas narrativas).',
    verbos: ['carregarPesado', 'empurrar', 'segurar', 'lutar'],
    habilidade: { nome: 'Firmar-se', descricao: 'Por alguns segundos, nada o derruba e o fôlego não cai.' },
    dons: [
      { nivel: 2, nome: 'Ombros largos', descricao: 'Carrega peso sem perder velocidade.' },
      { nivel: 4, nome: 'Muralha', descricao: 'Segura guinchos e portões por mais tempo.' },
      { nivel: 6, nome: 'Guardião', descricao: 'Aliados por perto sentem menos medo.' },
    ],
    icone: '🛡️',
  },
  batedor: {
    nome: 'Batedor', arquetipo: 'ladino / explorador', papel: 'Alcança o inacessível e abre caminho.',
    ferramentas: 'Corda e tocha.',
    verbos: ['escalar', 'amarrar', 'equilibrar'],
    habilidade: { nome: 'Olhar de águia', descricao: 'Destaca pontos de escalada e segredos por perto.' },
    dons: [
      { nivel: 2, nome: 'Pés leves', descricao: 'Escala mais rápido.' },
      { nivel: 4, nome: 'Corda firme', descricao: 'Cordas amarradas ficam para os outros usarem.' },
      { nivel: 6, nome: 'Sem vertigem', descricao: 'Alturas não causam medo.' },
    ],
    icone: '🧗',
  },
  sacerdote: {
    nome: 'Sacerdote', arquetipo: 'curandeiro / suporte', papel: 'Cuida do grupo diante de Deus.',
    ferramentas: 'Altar e incenso.',
    verbos: ['acalmar', 'interceder', 'abencoar'],
    habilidade: { nome: 'Acalmar', descricao: 'Acalma pessoas e animais agitados ao redor.' },
    dons: [
      { nivel: 2, nome: 'Voz serena', descricao: 'Acalmar alcança mais longe.' },
      { nivel: 4, nome: 'Intercessor', descricao: 'Orar restaura o domínio próprio de todo o grupo.' },
      { nivel: 6, nome: 'Bênção', descricao: 'Aliados abençoados ganham fôlego extra.' },
    ],
    icone: '🕯️',
  },
  profeta: {
    nome: 'Profeta', arquetipo: '“mago” sem magia: a Palavra', papel: 'Fala a verdade, discerne e intercede.',
    ferramentas: 'A Palavra (Espada do Espírito).',
    verbos: ['proclamar', 'discernir', 'interceder'],
    habilidade: { nome: 'Discernir', descricao: 'Um pulso que revela enganos, sinais falsos e caminhos ocultos.' },
    dons: [
      { nivel: 2, nome: 'Palavra firme', descricao: '"Está escrito" recarrega mais rápido.' },
      { nivel: 4, nome: 'Olhos abertos', descricao: 'O discernimento alcança mais longe.' },
      { nivel: 6, nome: 'Intercessão', descricao: 'Orar fortalece aliados nas provas.' },
    ],
    icone: '📜',
  },
  pastor: {
    nome: 'Pastor', arquetipo: 'arqueiro / ranger', papel: 'Guia e protege rebanhos.',
    ferramentas: 'Cajado, funda e assobio.',
    verbos: ['guiar', 'funda'],
    habilidade: { nome: 'Assobio', descricao: 'Chama o rebanho e faz os animais seguirem o pastor.' },
    dons: [
      { nivel: 2, nome: 'Voz conhecida', descricao: 'Ovelhas seguem de mais longe (Jo 10:4).' },
      { nivel: 4, nome: 'Mira certeira', descricao: 'A funda alcança mais longe.' },
      { nivel: 6, nome: 'Bom pastor', descricao: 'Nenhuma ovelha se perde.' },
    ],
    icone: '🐑',
  },
  hospitaleiro: {
    nome: 'Servo hospitaleiro', arquetipo: 'suporte / curandeiro', papel: 'Sustenta pessoas e o grupo.',
    ferramentas: 'Jarro, forno e pão.',
    verbos: ['preparar', 'cuidar', 'servir'],
    habilidade: { nome: 'Cuidar', descricao: 'Restaura o fôlego de quem está por perto.' },
    dons: [
      { nivel: 2, nome: 'Mesa farta', descricao: 'Alimentos rendem o dobro.' },
      { nivel: 4, nome: 'Mãos que servem', descricao: 'Servir dá mais Compaixão.' },
      { nivel: 6, nome: 'Casa aberta', descricao: 'Visitantes trazem notícias e segredos.' },
    ],
    icone: '🍞',
  },
  conselheiro: {
    nome: 'Conselheiro', arquetipo: 'bardo / diplomata', papel: 'Media, negocia e interpreta.',
    ferramentas: 'Rolos e harpa.',
    verbos: ['negociar', 'mediar'],
    habilidade: { nome: 'Mediar', descricao: 'Acalma contendas entre pessoas.' },
    dons: [
      { nivel: 2, nome: 'Palavra a seu tempo', descricao: 'Novas opções de diálogo.' },
      { nivel: 4, nome: 'Acordo justo', descricao: 'Negociações rendem mais.' },
      { nivel: 6, nome: 'Pacificador', descricao: 'Contendas não reduzem a Unidade.' },
    ],
    icone: '⚖️',
  },
};

export function temVerbo(classe: NomeClasse, v: Verbo, aprendidos: Verbo[] = []): boolean {
  return VERBOS_COMUNS.includes(v) || CLASSES[classe].verbos.includes(v) || aprendidos.includes(v);
}

export const NOMES_VERBOS: Record<Verbo, string> = {
  falar: 'Falar', pegar: 'Pegar', orar: 'Orar', olhar: 'Observar', carregar: 'Carregar', usar: 'Usar',
  construir: 'Construir', reparar: 'Reparar', cortar: 'Cortar',
  carregarPesado: 'Carregar (pesado)', empurrar: 'Empurrar', segurar: 'Segurar', lutar: 'Lutar',
  escalar: 'Escalar', amarrar: 'Amarrar', equilibrar: 'Equilibrar-se',
  acalmar: 'Acalmar', interceder: 'Interceder', abencoar: 'Abençoar',
  proclamar: 'Proclamar', discernir: 'Discernir',
  guiar: 'Guiar', funda: 'Funda',
  preparar: 'Preparar', cuidar: 'Cuidar', servir: 'Servir',
  negociar: 'Negociar', mediar: 'Mediar',
  construirAltar: 'Construir altar',
};
