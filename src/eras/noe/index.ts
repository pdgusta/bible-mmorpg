// Era 1 — Noé (Gn 6–9): tudo o que o orquestrador precisa para montar e jogar a era.
import { JOGAVEIS_NOE, NPCS_NOE, FAMILIA_NOE, MORADORES_NOE, INICIO_NOE } from './personagens';
import { MISSOES_NOE, reconstruirMundoNoe, GENEALOGIA_NOE } from './missoes';
import { MEMORIAS_NOE, SEGREDOS_NOE } from './memorias';
import { CRISTO_NOE } from './cristo';
import { ATALHOS_NOE, jogarEraNoe, resolverEtapaNoe } from './atalhos';
import { registrarSegredosNoe } from './interativos';
import { ligarServicosNoe } from './servicos';

export const ERA_NOE = {
  id: 'noe',
  nome: 'Era 1 — Noé',
  sub: 'Gênesis 6–9',
  /** Jogáveis na ordem da roda de troca (teclas 1–4). */
  jogaveis: JOGAVEIS_NOE,
  /** A família (as quatro mulheres) e os moradores da cidade. */
  npcs: NPCS_NOE,
  familia: FAMILIA_NOE,
  moradores: MORADORES_NOE,
  /** Onde cada personagem começa num jogo novo (ponto do mapa + yaw). */
  inicio: INICIO_NOE,
  protagonista: 'noe',
  missoes: MISSOES_NOE,
  missaoInicial: 'prologo',
  memorias: MEMORIAS_NOE,
  segredos: SEGREDOS_NOE,
  cristo: CRISTO_NOE,
  atalhos: ATALHOS_NOE,
  genealogia: GENEALOGIA_NOE,
  /** Depois de A6 (a transição de era), a história segue em Canaã. */
  seguinte: { era: 'abraao', missao: 'b1' },
  /** Liga os serviços (vale, céu, áudio, animais...) antes de iniciar as missões. */
  ligarServicos: ligarServicosNoe,
  /** Reconstrói o vale pelas flags (carregar save / entrar na era). */
  reconstruir: reconstruirMundoNoe,
  /** Registra os segredos (memórias opcionais) que valem a era inteira. */
  registrarSegredos: registrarSegredosNoe,
  jogar: jogarEraNoe,
  resolverEtapa: resolverEtapaNoe,
} as const;

export * from './personagens';
export * from './memorias';
export * from './cristo';
export * from './servicos';
export * from './interativos';
export * from './missoes';
export * from './atalhos';
