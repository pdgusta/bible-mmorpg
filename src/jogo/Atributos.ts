// Atributos (sem magia), XP e níveis. Os atributos crescem pelo uso e mudam o que o
// personagem consegue fazer; o XP mede maturidade e libera os dons da classe.

export type NomeAtributo =
  | 'forca' | 'resistencia' | 'agilidade'
  | 'fe' | 'comunhao'
  | 'dominio' | 'sabedoria'
  | 'compaixao' | 'humildade' | 'perseveranca' | 'discernimento' | 'coragem';

export interface InfoAtributo {
  nome: string;
  grupo: 'Físico' | 'Espiritual' | 'Caráter' | 'Mente';
  descricao: string;
  cresce: string;
  efeito: string;
}

export const ATRIBUTOS: Record<NomeAtributo, InfoAtributo> = {
  forca: { nome: 'Força', grupo: 'Físico', descricao: 'Vigor para carregar, empurrar e construir.', cresce: 'Carregando, empurrando e construindo.', efeito: 'Ergue objetos mais pesados e constrói mais rápido.' },
  resistencia: { nome: 'Resistência', grupo: 'Físico', descricao: 'Fôlego para longas jornadas e trabalhos.', cresce: 'Caminhando longas distâncias e trabalhando sem parar.', efeito: 'Mais fôlego para correr, carregar e segurar posições.' },
  agilidade: { nome: 'Agilidade', grupo: 'Físico', descricao: 'Leveza para escalar e se equilibrar.', cresce: 'Escalando e explorando.', efeito: 'Escala mais rápido e alcança lugares altos.' },
  fe: { nome: 'Fé', grupo: 'Espiritual', descricao: 'Confiança em Deus antes de ver o resultado.', cresce: 'Obedecendo antes de ver, vencendo provas e guardando memórias.', efeito: 'Memórias brilham mais; caminhos de fé se revelam; escudo maior.' },
  comunhao: { nome: 'Comunhão com Deus', grupo: 'Espiritual', descricao: 'Proximidade com Deus em oração e adoração.', cresce: 'Orando, adorando nos altares.', efeito: 'Recupera o domínio próprio e enfraquece os sussurros.' },
  dominio: { nome: 'Domínio próprio', grupo: 'Mente', descricao: 'Firmeza diante da tentação, do medo e da ira.', cresce: 'Resistindo a tentações e respondendo com brandura.', efeito: 'É a força mental nas provas espirituais.' },
  sabedoria: { nome: 'Sabedoria', grupo: 'Mente', descricao: 'Entendimento que vem da Palavra.', cresce: 'Orando, lendo e meditando nas Escrituras.', efeito: 'Libera falas de conselho e dicas de quebra-cabeça.' },
  compaixao: { nome: 'Compaixão', grupo: 'Caráter', descricao: 'Amor que se inclina para servir.', cresce: 'Servindo pessoas e cuidando de animais.', efeito: 'Animais e pessoas se acalmam e confiam mais.' },
  humildade: { nome: 'Humildade', grupo: 'Caráter', descricao: 'Considerar os outros superiores a si mesmo.', cresce: 'Cedendo, servindo sem recompensa, aceitando correção.', efeito: 'Abre caminhos de reconciliação.' },
  perseveranca: { nome: 'Perseverança', grupo: 'Caráter', descricao: 'Não desistir de fazer o bem.', cresce: 'Concluindo tarefas longas e tentando de novo.', efeito: 'Segura posições por mais tempo; continua mesmo sem fôlego.' },
  discernimento: { nome: 'Discernimento', grupo: 'Mente', descricao: 'Distinguir a verdade do engano.', cresce: 'Identificando mentiras e estudando a Palavra.', efeito: 'Revela enganos e caminhos ocultos.' },
  coragem: { nome: 'Coragem', grupo: 'Caráter', descricao: 'Firmeza diante do medo.', cresce: 'Enfrentando o escuro, a tempestade e as alturas.', efeito: 'O medo pesa menos.' },
};

export const ORDEM_ATRIBUTOS: NomeAtributo[] = [
  'forca', 'resistencia', 'agilidade', 'fe', 'comunhao', 'dominio', 'sabedoria',
  'compaixao', 'humildade', 'perseveranca', 'discernimento', 'coragem',
];

export type Atributos = Record<NomeAtributo, number>;

export function atributosPadrao(): Atributos {
  return Object.fromEntries(ORDEM_ATRIBUTOS.map((a) => [a, 3])) as Atributos;
}

/** XP necessário para alcançar o nível n+1. */
export function xpParaNivel(n: number): number {
  return Math.round(120 * Math.pow(n, 1.35));
}

export const NIVEL_MAX = 10;

/** Ficha de um personagem jogável. */
export class Ficha {
  atributos: Atributos;
  xp = 0;
  nivel = 1;
  /** Progresso fracionário até o próximo ponto de cada atributo. */
  progresso: Partial<Record<NomeAtributo, number>> = {};
  folego = 100;
  dominio = 100;

  constructor(iniciais?: Partial<Atributos>) {
    this.atributos = { ...atributosPadrao(), ...iniciais };
  }

  get folegoMax() {
    return 70 + this.atributos.resistencia * 8 + this.nivel * 2;
  }
  get dominioMax() {
    return 60 + this.atributos.dominio * 9;
  }

  /** Adiciona XP e devolve quantos níveis subiu. */
  ganharXP(qtd: number): number {
    this.xp += qtd;
    let subiu = 0;
    while (this.nivel < NIVEL_MAX && this.xp >= xpParaNivel(this.nivel)) {
      this.xp -= xpParaNivel(this.nivel);
      this.nivel++;
      subiu++;
    }
    return subiu;
  }

  /**
   * Treina um atributo pelo uso: cada "quantidade" soma ao progresso; ao completar 1,
   * o atributo sobe um ponto (até 10). Retorna true se subiu.
   */
  treinar(a: NomeAtributo, quantidade: number): boolean {
    if (this.atributos[a] >= 10) return false;
    const custo = 0.6 + this.atributos[a] * 0.25;
    const p = (this.progresso[a] ?? 0) + quantidade / custo;
    if (p >= 1) {
      this.atributos[a] = Math.min(10, this.atributos[a] + 1);
      this.progresso[a] = p - 1;
      return true;
    }
    this.progresso[a] = p;
    return false;
  }

  serializar() {
    return { atributos: { ...this.atributos }, xp: this.xp, nivel: this.nivel, progresso: { ...this.progresso } };
  }

  static restaurar(d: ReturnType<Ficha['serializar']>): Ficha {
    const f = new Ficha(d.atributos);
    f.xp = d.xp;
    f.nivel = d.nivel;
    f.progresso = { ...d.progresso };
    return f;
  }
}

/** Fontes de XP (nunca por derrotar inimigos). */
export const XP = {
  missao: 100,
  cooperacao: 60,
  prova: 60,
  quebraCabeca: 40,
  construir: 30,
  servir: 20,
  segredo: 25,
  disciplina: 10,
  batalha: 50,
} as const;
export type FonteXP = keyof typeof XP;

export const NOMES_FONTE_XP: Record<FonteXP, string> = {
  missao: 'Missão concluída',
  cooperacao: 'Cooperação',
  prova: 'Prova vencida',
  quebraCabeca: 'Quebra-cabeça',
  construir: 'Construir e restaurar',
  servir: 'Servir',
  segredo: 'Descoberta',
  disciplina: 'Disciplina espiritual',
  batalha: 'Batalha concluída',
};
