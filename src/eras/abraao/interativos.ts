// Interativos da era de Abraão: o que o jogador usa com E em cada etapa (ids como no ROTEIRO),
// posicionados pelos pontos do mapa de Canaã (`mundo.pontos`, ver mapa.ts). As missões
// registram os da etapa ao começar e os removem ao sair; o segredo do pó da terra fica
// registrado a era inteira.
import * as THREE from 'three';
import type { Mundo } from '../../mundo/Mundo';
import type { DefPosto, Interativo } from '../../jogo/Interacoes';
import type { Verbo } from '../../jogo/Classes';
import type { NomeClipe } from '../../entidades/humano/Animador';
import type { Personagem } from '../../jogo/Personagem';
import type { ServicosAbraao } from './servicos';

/** O que o conteúdo da era usa do Mundo (os testes montam um falso com só isto). */
export type MundoBase = Pick<Mundo, 'interativos' | 'pontos' | 'escaladas' | 'personagens' | 'chao'>;

/** Onde fica algo: ponto do mapa, personagem (acompanha) ou uma posição (viva, se for de um animal). */
export type LugarAbraao = string | { personagem: string } | THREE.Vector3;

// ------------------------------------------------------------------------------ pontos

/**
 * Posições de reserva para pontos que o mapa de Canaã não tiver. `bastidor` é o canto do mapa
 * onde ficam, invisíveis, os que estão fora da história no momento (Isaque antes de B5, Ló
 * depois de partir).
 */
export const PONTOS_RESERVA: Record<string, [number, number]> = {
  bastidor: [-236, 236],
};

/** Pontos do mapa que as missões da era usam (conferidos contra MAPA_CANAA nos testes). */
export const PONTOS_USADOS_ABRAAO = [
  // B1
  'chegada', 'caravana', 'more', 'altarMore', 'acampamentoBetel', 'mastroTenda1', 'amarrarTenda1', 'mastroTenda2', 'amarrarTenda2',
  'altarBetel', 'orarBetel', 'betel', 'ai',
  // dinâmicos do acampamento (definirAcampamento)
  'acampamento', 'tendaAbrao', 'tendaSara', 'fogueiraAcampamento',
  // B2
  'poco', 'pasto', 'curralAbrao', 'curralLo', 'porteiraAbrao', 'porteiraLo', 'entradaCurralAbrao', 'entradaCurralLo',
  'miranteJordao', 'descidaJordao', 'planicieJordao', 'sodomaLonge', 'miranteNorte', 'miranteSul', 'miranteLeste', 'miranteOeste',
  'segredoPo', 'manre', 'acampamentoManre', 'altarManre', 'carvalhoManre',
  // B3
  'chegadaFugitivo', 'reuniaoServos', 'aliadosManre', 'da', 'flancoOeste', 'flancoLeste', 'flancoSul', 'acampamentoInimigo',
  'cativo1', 'cativo2', 'cativo3', 'cativo4', 'cativo5', 'sentinela1', 'sentinela2', 'sentinela3', 'sentinela4', 'fugaInimigos',
  'save', 'salem', 'altarSalem', 'melquisedeque', 'dizimo', 'chegadaSodoma',
  // B4
  'ceuEstrelas',
  // B5
  'servosMoria', 'peMoria', 'degrausMoria', 'paredeMoria', 'cordaMoria', 'estreitoMoria', 'estreitoFim', 'patamarMoria',
  'subidaFinal', 'topoMoria', 'altarMoria', 'arbustoCarneiro',
  // reserva
  'bastidor',
];

const avisados = new Set<string>();

/** [x, z] de um ponto do mapa (com a reserva, avisando uma vez se faltar no mapa). */
export function ponto2(m: Pick<MundoBase, 'pontos'>, nome: string): [number, number] {
  const p = m.pontos.get(nome);
  if (p) return p;
  const r = PONTOS_RESERVA[nome];
  if (!r) throw new Error(`Ponto desconhecido em Canaã: ${nome}`);
  if (!avisados.has(nome) && nome !== 'bastidor') {
    avisados.add(nome);
    console.warn(`[era abraao] ponto "${nome}" ausente no mapa; usando posição de reserva`);
  }
  return r;
}

/** Posição 3D de um lugar. Personagens e Vector3 são devolvidos vivos (não copiados). */
export function resolverLugar(m: MundoBase, l: LugarAbraao): THREE.Vector3 {
  if (l instanceof THREE.Vector3) return l;
  if (typeof l === 'string') {
    const [x, z] = ponto2(m, l);
    return new THREE.Vector3(x, m.chao(x, z), z);
  }
  const p = m.personagens.get(l.personagem);
  if (!p) throw new Error(`Personagem ausente: ${l.personagem}`);
  return p.posicao;
}

// ------------------------------------------------------------------------------ definições

export interface DefInterativoAbraao {
  id: string;
  verbo: Verbo;
  rotulo: string;
  lugar: LugarAbraao;
  raio?: number;
  segurar?: number;
  animacao?: NomeClipe;
  dica?: string;
  carregando?: string | null;
  posto?: DefPosto;
  marcador?: boolean;
}

/** Partes dinâmicas de um interativo, dadas pela missão ao registrar. */
export interface AjusteInterativo {
  ativo?: boolean | (() => boolean);
  aoInteragir?: (p: Personagem) => void | Promise<void>;
  aoProgresso?: (p: Personagem, t: number) => void;
  aoSairPosto?: (p: Personagem) => void;
  rotulo?: string;
  lugar?: LugarAbraao;
}

const n3 = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i + 1}`);

/** `quem`: o nome exibido na era do altar (Abrão em B1–B2, Abraão em B5, Gn 17:5). */
const ALTAR = (id: string, quem = 'Abrão'): DefInterativoAbraao => ({
  id, verbo: 'construirAltar', rotulo: 'Construir um altar ao Senhor', lugar: id, segurar: 4, animacao: 'consertar', raio: 3,
  dica: `${quem} pode construir o altar.`,
});

/**
 * Postos "qualquer jogável" do ROTEIRO (mastros, porteiras) usam o verbo comum 'usar': o
 * verbo 'segurar' é só do guerreiro.
 */
const POSTO = (id: string, rotulo: string, descricao: string, rotuloSair: string): DefInterativoAbraao => ({
  id, verbo: 'usar', rotulo, lugar: id, raio: 2.6, posto: { descricao, clipe: 'segurar', rotuloSair },
});

/**
 * A corda do Moriá: o ROTEIRO a chama [cordaMoria], mas esse id já é a escalada que o mundo
 * registra (e `Controle.usar` procura escaladas antes dos interativos); o interativo de
 * amarrar fica como 'amarrarCorda', no ponto 'cordaMoria'.
 */
export const ID_AMARRAR_CORDA = 'amarrarCorda';

/** Interativos fixos de cada etapa (chave "missao.etapa"). */
export const INTERATIVOS_ABRAAO: Record<string, DefInterativoAbraao[]> = {
  'b1.altarMore': [ALTAR('altarMore')],
  'b1.acampar': [
    POSTO('mastroTenda1', 'Segurar o mastro da tenda', 'segurando o mastro', 'Soltar o mastro'),
    POSTO('mastroTenda2', 'Segurar o mastro da tenda', 'segurando o mastro', 'Soltar o mastro'),
    ...n3('amarrarTenda', 2).map((id): DefInterativoAbraao => ({
      id, verbo: 'usar', rotulo: 'Amarrar as cordas da tenda', lugar: id, segurar: 2, animacao: 'interagir', raio: 2.6,
      dica: 'Alguém precisa segurar o mastro enquanto outro amarra.',
    })),
  ],
  'b1.invocar': [
    ALTAR('altarBetel'),
    { id: 'orarBetel', verbo: 'orar', rotulo: 'Invocar o nome do Senhor', lugar: 'orarBetel', segurar: 2, raio: 3 },
  ],
  'b2.separar': [
    POSTO('porteiraAbrao', 'Segurar a porteira aberta', 'segurando a porteira', 'Soltar a porteira'),
    POSTO('porteiraLo', 'Segurar a porteira aberta', 'segurando a porteira', 'Soltar a porteira'),
  ],
  'b2.pastores': [
    { id: 'falarPastores', verbo: 'falar', rotulo: 'Falar com os pastores', lugar: 'poco', raio: 5 },
  ],
  'b2.percorrer': ['miranteNorte', 'miranteSul', 'miranteLeste', 'miranteOeste'].map((id): DefInterativoAbraao => ({
    id, verbo: 'olhar', rotulo: 'Olhar a terra', lugar: id, raio: 5,
  })),
  'b2.manre': [ALTAR('altarManre')],
  'b3.dividir': [
    { id: 'sinal', verbo: 'usar', rotulo: 'Dar o sinal', lugar: { personagem: 'abraao' }, raio: 2.5, marcador: false },
  ],
  'b3.libertar': n3('cativo', 5).map((id): DefInterativoAbraao => ({
    id, verbo: 'usar', rotulo: 'Soltar as cordas', lugar: id, segurar: 1.5, animacao: 'interagir', raio: 2.4,
  })),
  'b3.melquisedeque': [
    { id: 'dizimo', verbo: 'usar', rotulo: 'Entregar a décima parte dos despojos', lugar: 'dizimo', raio: 3 },
  ],
  'b5.subida': [
    { id: ID_AMARRAR_CORDA, verbo: 'amarrar', rotulo: 'Amarrar a corda', lugar: 'cordaMoria', segurar: 3, raio: 3, dica: 'Isaque pode subir a parede e amarrar a corda.' },
  ],
  'b5.altar': [ALTAR('altarMoria', 'Abraão')],
  'b5.carneiro': [
    { id: 'carneiro', verbo: 'usar', rotulo: 'Tomar o carneiro', lugar: 'arbustoCarneiro', raio: 3.5 },
  ],
};

/** Segredo (memória opcional) da era: o pó da terra (Gn 13:16), depois que Deus fala de olhar a terra. */
export const SEGREDOS_INTERATIVOS: (DefInterativoAbraao & { memoria: string; depoisDe: string })[] = [
  { id: 'segredoPo', memoria: 'poDaTerra', depoisDe: 'b2Percorrer', verbo: 'olhar', rotulo: 'Pegar um punhado de pó', lugar: 'segredoPo', raio: 3, marcador: false },
];

/** Todos os ids de interativos da era (para os testes de unicidade). */
export function idsInterativosAbraao(): string[] {
  return [...Object.values(INTERATIVOS_ABRAAO).flat().map((d) => d.id), ...SEGREDOS_INTERATIVOS.map((s) => s.id)];
}

// ------------------------------------------------------------------------------ registro

function criar(m: MundoBase, d: DefInterativoAbraao, a: AjusteInterativo = {}): Interativo {
  const i: Interativo = {
    id: d.id,
    pos: resolverLugar(m, a.lugar ?? d.lugar),
    raio: d.raio ?? 2.4,
    rotulo: a.rotulo ?? d.rotulo,
    verbo: d.verbo,
    segurar: d.segurar ?? 0,
    ativo: a.ativo ?? true,
    dica: d.dica,
    marcador: d.marcador ?? true,
    aoInteragir: a.aoInteragir ?? (() => {}),
  };
  if (d.animacao) i.animacao = d.animacao;
  if (d.carregando !== undefined) i.carregando = d.carregando;
  if (d.posto) i.posto = { ...d.posto };
  if (a.aoProgresso) i.aoProgresso = a.aoProgresso;
  if (a.aoSairPosto) i.aoSairPosto = a.aoSairPosto;
  return i;
}

export interface RegistroInterativos {
  readonly ids: string[];
  obter(id: string): Interativo | undefined;
  /** Tira um só (ex.: mirante já visitado). */
  tirar(id: string): void;
  /** Tira todos os que este registro pôs. */
  remover(): void;
}

/** Registra interativos avulsos; devolve um registro para removê-los. */
export function registrarDefs(m: MundoBase, defs: DefInterativoAbraao[], ajustes: Record<string, AjusteInterativo> = {}): RegistroInterativos {
  const meus = new Map<string, Interativo>();
  for (const d of defs) {
    const i = criar(m, d, ajustes[d.id]);
    m.interativos.adicionar(i);
    meus.set(d.id, i);
  }
  return {
    ids: [...meus.keys()],
    obter: (id) => meus.get(id),
    tirar(id) {
      const i = meus.get(id);
      // só remove se ainda for o mesmo objeto (outra etapa pode ter registrado o mesmo id)
      if (i && m.interativos.obter(id) === i) m.interativos.remover(id);
      meus.delete(id);
    },
    remover() {
      for (const id of [...meus.keys()]) this.tirar(id);
    },
  };
}

/** Registra os interativos fixos de uma etapa ("b2.separar"). */
export function registrarEtapa(m: MundoBase, chave: string, ajustes: Record<string, AjusteInterativo> = {}): RegistroInterativos {
  const defs = INTERATIVOS_ABRAAO[chave];
  if (!defs) throw new Error(`Etapa sem interativos: ${chave}`);
  return registrarDefs(m, defs, ajustes);
}

/**
 * Registra o segredo da era (o pó da terra). Fica ativo depois que Deus manda Abrão olhar a
 * terra (flag de B2) e enquanto a memória não for guardada; ao achar: memória (conta como
 * segredo) e XP de descoberta. Devolve a remoção.
 */
export function registrarSegredosAbraao(m: MundoBase, s: Pick<ServicosAbraao, 'progresso' | 'audio'>, flags: Record<string, unknown>): () => void {
  const ajustes: Record<string, AjusteInterativo> = {};
  for (const d of SEGREDOS_INTERATIVOS) {
    ajustes[d.id] = {
      ativo: () => !!flags[d.depoisDe] && !s.progresso.temMemoria(d.memoria),
      aoInteragir: (p) => {
        if (!s.progresso.memoria(d.memoria)) return;
        s.progresso.ganharXP(p.id, 'segredo');
        s.audio.efeito('brilho');
      },
    };
  }
  const reg = registrarDefs(m, SEGREDOS_INTERATIVOS, ajustes);
  return () => reg.remover();
}
