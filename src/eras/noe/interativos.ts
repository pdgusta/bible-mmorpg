// Interativos da era de Noé: o que o jogador usa com E em cada etapa (ids exatamente como no
// ROTEIRO), posicionados pelos pontos do mapa (`mundo.pontos`) ou da arca
// (`MundoNoe.pontoArca`). As missões registram os da etapa ao começar e os removem ao sair;
// os segredos ficam registrados a era inteira.
import * as THREE from 'three';
import type { Mundo } from '../../mundo/Mundo';
import type { DefPosto, Interativo } from '../../jogo/Interacoes';
import type { Verbo } from '../../jogo/Classes';
import type { NomeClipe } from '../../entidades/humano/Animador';
import type { Personagem } from '../../jogo/Personagem';
import type { NomePontoArca, ServicosNoe } from './servicos';

/** O que o conteúdo da era usa do Mundo (os testes montam um falso com só isto). */
export type MundoBase = Pick<Mundo, 'interativos' | 'pontos' | 'escaladas' | 'personagens' | 'chao'>;

/**
 * Onde fica algo: nome de ponto do mapa, ponto da arca, personagem (acompanha), uma posição
 * fixa ou viva (Vector3 de um animal, por exemplo: o interativo acompanha).
 */
export type LugarNoe = string | { arca: NomePontoArca } | { personagem: string } | THREE.Vector3;

// ------------------------------------------------------------------------------ pontos

/**
 * Posições de reserva para os pontos que o mapa ainda não tiver (o motor registra os nomes
 * reais em `mundo.pontos`; estes valores só evitam travar a história se faltar algum).
 */
export const PONTOS_RESERVA: Record<string, [number, number]> = {
  vistaVale: [-60, 140], centroVale: [0, 0],
  inicio: [36, 84], orarMonte: [100, 116], corteLenha: [-128, 24], pilhaBosque: [-122, 30],
  arvoreGofer1: [-134, 14], arvoreGofer2: [-140, 32], arvoreGofer3: [-130, 44], entregaTroncos: [30, 28],
  quilha: [-10, 12], guincho: [-22, 26], andaime: [-14, 15], vauOeste: [138, -28], vauLeste: [156, -30],
  andaimeBase: [-14, 18], andaimeTopo: [-14, 14], ancoraCorda: [-14, 13],
  encaixeViga1: [-70, 18], encaixeViga2: [40, 18],
  betumarCasco1: [-50, 18], betumarCasco2: [-20, 18], betumarCasco3: [30, 18],
  entradaCidade: [160, -90], pregarPraca: [182, -106], mercado: [189, -112], pregarMercado: [188, -104],
  torre: [180, -148], pregarTorre: [180, -146], pocoCidade: [178, -112],
  chegadaAnimais1: [-190, 80], chegadaAnimais2: [20, 190], chegadaAnimais3: [-150, -40], chegadaAnimais4: [90, 150],
  filaAnimais: [5, 36], entregaArca: [5, 20],
  saco1: [48, 56], saco2: [50, 55], saco3: [54, 55], saco4: [56, 56],
  arvoreFruta1: [10, 100], arvoreFruta2: [26, 104], fruta1: [10.5, 100], fruta2: [26.5, 104],
  fundoGruta: [-167.5, -98.5], segredoEnoque: [-164, -98], segredoLameque: [30, 64],
  saidaArca: [-10, -150], altarPlato: [-36, -144], descidaPlato: [-32, -130], segredoEstacoes: [66, 106],
  pedraAltar1: [-60, -146], pedraAltar2: [-48, -138], pedraAltar3: [-20, -136],
  pedraAltar4: [8, -142], pedraAltar5: [22, -148], pedraAltar6: [-75, -150],
  trigal: [66, 106], poco: [48, 66], margemRio: [132, 40], cavalete: [24, 30],
};
// portas das casas da cidade (anel em volta da praça)
([[-24, -16], [-8, -27], [9, -28], [25, -18], [30, 0], [26, 18], [10, 28], [-9, 28], [-25, 18], [-31, 1], [-37, -26], [38, -28], [40, 26], [-40, 24]] as const)
  .forEach(([x, z], i) => (PONTOS_RESERVA[`casaCidade${i + 1}`] = [178 + x * 0.8, -112 + z * 0.8]));

const avisados = new Set<string>();

/** [x, z] de um ponto do mapa (com a reserva, avisando uma vez se faltar no mapa). */
export function ponto2(m: Pick<MundoBase, 'pontos'>, nome: string): [number, number] {
  const p = m.pontos.get(nome);
  if (p) return p;
  const r = PONTOS_RESERVA[nome];
  if (!r) throw new Error(`Ponto desconhecido no vale de Noé: ${nome}`);
  if (!avisados.has(nome)) {
    avisados.add(nome);
    console.warn(`[era noe] ponto "${nome}" ausente no mapa; usando posição de reserva`);
  }
  return r;
}

/** Posição 3D de um lugar. Personagens e Vector3 são devolvidos vivos (não copiados). */
export function resolverLugar(m: MundoBase, s: Pick<ServicosNoe, 'vale'>, l: LugarNoe): THREE.Vector3 {
  if (l instanceof THREE.Vector3) return l;
  if (typeof l === 'string') {
    const [x, z] = ponto2(m, l);
    return new THREE.Vector3(x, m.chao(x, z), z);
  }
  if ('arca' in l) return s.vale.pontoArca(l.arca).clone();
  const p = m.personagens.get(l.personagem);
  if (!p) throw new Error(`Personagem ausente: ${l.personagem}`);
  return p.posicao;
}

// ------------------------------------------------------------------------------ definições

export interface DefInterativoNoe {
  id: string;
  verbo: Verbo;
  rotulo: string;
  lugar: LugarNoe;
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
  lugar?: LugarNoe;
}

const n3 = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i + 1}`);

/** Interativos fixos de cada etapa (chave "missao.etapa"). */
export const INTERATIVOS_NOE: Record<string, DefInterativoNoe[]> = {
  'a1.orar': [
    { id: 'orarMonte', verbo: 'orar', rotulo: 'Orar', lugar: 'orarMonte', segurar: 2, raio: 3 },
  ],
  'a1.troncos': [
    { id: 'pilhaBosque', verbo: 'carregarPesado', rotulo: 'Pegar um tronco', lugar: 'pilhaBosque', carregando: null, dica: 'Cam pode carregar troncos pesados.', raio: 3 },
    { id: 'entregaTroncos', verbo: 'usar', rotulo: 'Entregar o tronco', lugar: 'entregaTroncos', carregando: 'tronco', raio: 4 },
    ...n3('arvoreGofer', 3).map((id): DefInterativoNoe => ({ id, verbo: 'cortar', rotulo: 'Cortar a árvore de gofer', lugar: id, segurar: 3, animacao: 'cortar', dica: 'Noé pode cortar as árvores marcadas.' })),
  ],
  'a1.quilha': [
    { id: 'quilha', verbo: 'construir', rotulo: 'Assentar a quilha', lugar: 'quilha', segurar: 4, animacao: 'consertar', dica: 'Noé pode assentar a quilha.', raio: 3 },
  ],
  'a2.erguer': [
    { id: 'guincho', verbo: 'segurar', rotulo: 'Segurar o guincho', lugar: 'guincho', dica: 'Cam pode segurar o guincho.', posto: { descricao: 'segurando o guincho', clipe: 'segurar', rotuloSair: 'Soltar o guincho' } },
    { id: 'ancoraCorda', verbo: 'amarrar', rotulo: 'Amarrar a corda', lugar: 'ancoraCorda', segurar: 3, dica: 'Jafé pode amarrar a corda no alto do andaime.' },
    { id: 'encaixeViga1', verbo: 'construir', rotulo: 'Fixar a ponta da viga', lugar: 'encaixeViga1', segurar: 3, animacao: 'consertar', dica: 'Noé pode fixar a viga.' },
    { id: 'encaixeViga2', verbo: 'construir', rotulo: 'Fixar a ponta da viga', lugar: 'encaixeViga2', segurar: 3, animacao: 'consertar', dica: 'Noé pode fixar a viga.' },
  ],
  'a2.betume': [
    { id: 'caldeirao', verbo: 'usar', rotulo: 'Encher o balde de betume', lugar: 'caldeirao', carregando: null, raio: 3 },
    // ROTEIRO: "Noé ou qualquer um" → verbo comum 'usar' com o balde na mão.
    ...n3('betumarCasco', 3).map((id): DefInterativoNoe => ({ id, verbo: 'usar', rotulo: 'Betumar o casco', lugar: id, segurar: 2, animacao: 'consertar', carregando: 'balde', raio: 3 })),
  ],
  'a3.pregar': [
    { id: 'pregarPraca', verbo: 'falar', rotulo: 'Proclamar o aviso', lugar: 'pregarPraca', raio: 4 },
    { id: 'pregarMercado', verbo: 'falar', rotulo: 'Proclamar o aviso', lugar: 'pregarMercado', raio: 4 },
    { id: 'pregarTorre', verbo: 'falar', rotulo: 'Proclamar o aviso', lugar: 'pregarTorre', raio: 4 },
  ],
  'a4.mantimento': [
    ...n3('saco', 4).map((id): DefInterativoNoe => ({ id, verbo: 'carregarPesado', rotulo: 'Pegar o saco de grãos', lugar: id, carregando: null, dica: 'Cam pode carregar os sacos.' })),
    ...n3('fruta', 2).map((id): DefInterativoNoe => ({ id, verbo: 'pegar', rotulo: 'Pegar o cesto de frutas', lugar: id, carregando: null, dica: 'Jafé pode subir na árvore.' })),
    { id: 'entregaArca', verbo: 'usar', rotulo: 'Guardar o mantimento', lugar: 'entregaArca', raio: 4 },
  ],
  'a4.parPerdido': [
    { id: 'gruta', verbo: 'olhar', rotulo: 'Procurar no escuro', lugar: 'fundoGruta', raio: 4 },
  ],
  'a5.fontes': [
    { id: 'bomba', verbo: 'segurar', rotulo: 'Bombear', lugar: { arca: 'bomba' }, dica: 'Cam pode bombear a água.', posto: { descricao: 'bombeando a água', clipe: 'empurrar', rotuloSair: 'Parar de bombear' } },
    ...n3('vazamento', 4).map((id, i): DefInterativoNoe => ({ id, verbo: 'reparar', rotulo: 'Tapar o vazamento', lugar: { arca: `vazamento${i + 1}` as NomePontoArca }, segurar: 3, animacao: 'consertar', dica: 'Noé pode tapar os vazamentos.' })),
  ],
  'a5.inquietos': [
    ...n3('baia', 3).map((id, i): DefInterativoNoe => ({ id, verbo: 'acalmar', rotulo: 'Acalmar os animais', lugar: { arca: `baia${i + 1}` as NomePontoArca }, segurar: 2, dica: 'Sem pode acalmar os animais.', raio: 3 })),
    ...n3('rede', 2).map((id, i): DefInterativoNoe => ({ id, verbo: 'amarrar', rotulo: 'Prender a rede de carga', lugar: { arca: `rede${i + 1}` as NomePontoArca }, segurar: 2, dica: 'Jafé pode subir e prender as redes.' })),
  ],
  'a5.janela': [
    // Jafé só solta as amarras; quem abre a janela é Noé (Gn 8:6), em soltarCorvo
    { id: 'janela', verbo: 'amarrar', rotulo: 'Soltar as amarras da janela', lugar: { arca: 'janela' }, segurar: 2, dica: 'Jafé pode subir até a janela.' },
  ],
  'a5.corvo': [
    { id: 'soltarCorvo', verbo: 'usar', rotulo: 'Abrir a janela e soltar o corvo', lugar: { arca: 'escadaJanela' }, raio: 3.5 },
  ],
  'a5.soltarPomba': [
    { id: 'soltarPomba', verbo: 'usar', rotulo: 'Soltar a pomba', lugar: { arca: 'escadaJanela' }, raio: 3.5 },
  ],
  'a5.receberPomba': [
    { id: 'receberPomba', verbo: 'usar', rotulo: 'Estender a mão', lugar: { arca: 'escadaJanela' }, raio: 3.5 },
  ],
  'a6.altar': [
    ...n3('pedraAltar', 6).map((id): DefInterativoNoe => ({ id, verbo: 'pegar', rotulo: 'Pegar a pedra', lugar: id })),
    { id: 'altarPlato', verbo: 'construirAltar', rotulo: 'Construir o altar', lugar: 'altarPlato', segurar: 4, dica: 'Noé pode construir o altar.', raio: 3 },
  ],
};

/**
 * Espécies de A4 que chegam sozinhas (as agitadas param e esperam Sem). As limpas vêm de sete
 * em sete, as outras de dois em dois (Gn 7:2). Leitura do jogo: sete animais, três casais e um
 * macho a mais, o que será oferecido no altar (Gn 8:20).
 */
export const PARES_A4: { especie: string; chegada: string; agitado: boolean; atraso: number; limpo?: boolean }[] = [
  { especie: 'ovelha', chegada: 'chegadaAnimais1', agitado: false, atraso: 0, limpo: true },
  { especie: 'cabra', chegada: 'chegadaAnimais2', agitado: false, atraso: 5, limpo: true },
  { especie: 'camelo', chegada: 'chegadaAnimais3', agitado: true, atraso: 10 },
  { especie: 'boi', chegada: 'chegadaAnimais4', agitado: false, atraso: 16, limpo: true },
  { especie: 'cavalo', chegada: 'chegadaAnimais1', agitado: true, atraso: 22 },
  { especie: 'jumento', chegada: 'chegadaAnimais2', agitado: false, atraso: 28 },
  { especie: 'leao', chegada: 'chegadaAnimais3', agitado: true, atraso: 34 },
];
/** Quantos de cada espécie entram na arca (Gn 7:2). */
export const quantosDaEspecie = (par: { limpo?: boolean }) => (par.limpo ? 7 : 2);
/** A oitava espécie, que se escondeu na gruta: o cervo, limpo, vem de sete em sete (Gn 7:2). */
export const ESPECIE_PERDIDA = 'cervo';
export const QUANTOS_PERDIDOS = quantosDaEspecie({ limpo: true });
export const TOTAL_PARES = PARES_A4.length + 1;
/** Animais das baias do convés 2 (A5). */
export const ANIMAIS_BAIAS = ['boi', 'camelo', 'leao'];
/** Quem Noé encoraja na prova de medo (A5). */
export const ENCORAJAVEIS = ['sem', 'cam', 'jafe', 'mulherNoe', 'mulherSem', 'mulherCam', 'mulherJafe'];
/** Conversas de ficção no vale renovado (A6). */
export const CONVERSAS_A6 = ['cam', 'jafe', 'mulherNoe', 'mulherSem', 'mulherCam', 'mulherJafe'];

export const idAcalmar = (especie: string) => `acalmar_${especie}`;
export const idEncorajar = (pessoa: string) => `encorajar_${pessoa}`;
export const idConversa = (pessoa: string) => `conversa_${pessoa}`;

/** Interativos criados durante as etapas (seguem animais/pessoas). */
export function interativoAcalmar(especie: string, pos: THREE.Vector3): DefInterativoNoe {
  return { id: idAcalmar(especie), verbo: 'acalmar', rotulo: 'Acalmar', lugar: pos, segurar: 1.5, dica: 'Sem pode acalmar os animais.', raio: 4 };
}
export function interativoEncorajar(pessoa: string): DefInterativoNoe {
  return { id: idEncorajar(pessoa), verbo: 'falar', rotulo: 'Encorajar', lugar: { personagem: pessoa }, raio: 2.5 };
}
export function interativoConversa(pessoa: string): DefInterativoNoe {
  return { id: idConversa(pessoa), verbo: 'falar', rotulo: 'Conversar', lugar: { personagem: pessoa }, raio: 2.5, marcador: false };
}
export const INTERATIVO_FALAR_SEM: DefInterativoNoe = { id: 'falarSem', verbo: 'falar', rotulo: 'Falar com Sem', lugar: { personagem: 'sem' }, raio: 2.8 };

/**
 * Segredos (memórias opcionais), ativos a era inteira enquanto não forem achados. `depoisDe`:
 * flag que precisa estar marcada (o vale novo só se abre depois do altar, Ensinamento 9).
 */
export const SEGREDOS_INTERATIVOS: (DefInterativoNoe & { memoria: string; quando: 'antes' | 'depois'; depoisDe?: string })[] = [
  { id: 'segredoLameque', memoria: 'lameque', quando: 'antes', verbo: 'olhar', rotulo: 'Ler a pedra', lugar: 'segredoLameque', raio: 2.5, marcador: false },
  { id: 'segredoEnoque', memoria: 'enoque', quando: 'antes', verbo: 'olhar', rotulo: 'Ler a pedra memorial', lugar: 'segredoEnoque', raio: 2.5, marcador: false },
  { id: 'segredoEstacoes', memoria: 'estacoes', quando: 'depois', depoisDe: 'a6Altar', verbo: 'olhar', rotulo: 'Olhar o campo', lugar: 'segredoEstacoes', raio: 4, marcador: false },
];

/** Todos os ids de interativos da era (para os testes de unicidade). */
export function idsInterativosNoe(): string[] {
  return [
    ...Object.values(INTERATIVOS_NOE).flat().map((d) => d.id),
    ...PARES_A4.filter((p) => p.agitado).map((p) => idAcalmar(p.especie)),
    idAcalmar(ESPECIE_PERDIDA),
    ...ENCORAJAVEIS.map(idEncorajar),
    ...CONVERSAS_A6.map(idConversa),
    INTERATIVO_FALAR_SEM.id,
    ...SEGREDOS_INTERATIVOS.map((s) => s.id),
  ];
}

/** Nomes de pontos do mapa que a era usa (para conferir com o mapa do motor). */
export function pontosUsadosNoe(): string[] {
  const nomes = new Set<string>(Object.keys(PONTOS_RESERVA));
  for (const d of [...Object.values(INTERATIVOS_NOE).flat(), ...SEGREDOS_INTERATIVOS]) if (typeof d.lugar === 'string') nomes.add(d.lugar);
  for (const p of PARES_A4) nomes.add(p.chegada);
  return [...nomes].sort();
}

// ------------------------------------------------------------------------------ registro

function criar(m: MundoBase, s: Pick<ServicosNoe, 'vale'>, d: DefInterativoNoe, a: AjusteInterativo = {}): Interativo {
  const i: Interativo = {
    id: d.id,
    pos: resolverLugar(m, s, a.lugar ?? d.lugar),
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
  /** Tira um só (ex.: árvore cortada). */
  tirar(id: string): void;
  /** Tira todos os que este registro pôs. */
  remover(): void;
}

/** Registra interativos avulsos; devolve um registro para removê-los. */
export function registrarDefs(m: MundoBase, s: Pick<ServicosNoe, 'vale'>, defs: DefInterativoNoe[], ajustes: Record<string, AjusteInterativo> = {}): RegistroInterativos {
  const meus = new Map<string, Interativo>();
  for (const d of defs) {
    const i = criar(m, s, d, ajustes[d.id]);
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

/** Registra os interativos fixos de uma etapa ("a2.erguer"). */
export function registrarEtapa(m: MundoBase, s: Pick<ServicosNoe, 'vale'>, chave: string, ajustes: Record<string, AjusteInterativo> = {}): RegistroInterativos {
  const defs = INTERATIVOS_NOE[chave];
  if (!defs) throw new Error(`Etapa sem interativos: ${chave}`);
  return registrarDefs(m, s, defs, ajustes);
}

/**
 * Registra os segredos da era (pedras de Lameque e de Enoque antes do dilúvio, o campo de
 * semeadura depois do altar). Ficam ativos enquanto a memória não for guardada; ao achar: memória
 * (conta como segredo para o legado de Abrão) e XP de descoberta. Devolve a remoção.
 */
export function registrarSegredosNoe(m: MundoBase, s: Pick<ServicosNoe, 'vale' | 'progresso' | 'audio'>, flags: Record<string, unknown>): () => void {
  const estado = () => (flags.valeEstado as string | undefined) ?? 'antes';
  const defs = SEGREDOS_INTERATIVOS;
  const ajustes: Record<string, AjusteInterativo> = {};
  for (const d of defs) {
    ajustes[d.id] = {
      ativo: () => !s.progresso.temMemoria(d.memoria) && estado() === d.quando && (!d.depoisDe || !!flags[d.depoisDe]),
      aoInteragir: (p) => {
        if (!s.progresso.memoria(d.memoria)) return;
        s.progresso.ganharXP(p.id, 'segredo');
        s.audio.efeito('brilho');
      },
    };
  }
  const reg = registrarDefs(m, s, defs, ajustes);
  return () => reg.remover();
}

/** Garante uma escalada (o motor registra as do vale; esta é só a reserva). */
export function garantirEscalada(m: MundoBase, id: string, base: string, topo: string) {
  if (m.escaladas.has(id)) return;
  const b = ponto2(m, base);
  const t = ponto2(m, topo);
  const yb = m.chao(b[0], b[1]);
  m.escaladas.set(id, {
    id,
    base: new THREE.Vector3(b[0], yb, b[1]),
    topo: new THREE.Vector3(t[0], m.chao(t[0], t[1]), t[1]),
    yaw: Math.atan2(t[0] - b[0], t[1] - b[1]),
    ativa: true,
  });
}
