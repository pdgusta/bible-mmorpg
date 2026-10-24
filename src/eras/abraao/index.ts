// Era 2 — Abraão (Gn 12–22): tudo o que o orquestrador precisa para montar e jogar a era.
import {
  JOGAVEIS_ABRAAO, NPCS_ABRAAO, NPCS_CENA_ABRAAO, INICIO_ABRAAO, ELENCO_ABRAAO,
} from './personagens';
import { MISSOES_ABRAAO, reconstruirMundoAbraao, limparCenaAbraao } from './missoes';
import { MEMORIAS_ABRAAO, SEGREDOS_ABRAAO } from './memorias';
import { CRISTO_ABRAAO } from './cristo';
import { ATALHOS_ABRAAO, jogarEraAbraao, resolverEtapaAbraao } from './atalhos';
import { registrarSegredosAbraao } from './interativos';
import { ligarServicosAbraao } from './servicos';

export const ERA_ABRAAO = {
  id: 'abraao',
  nome: 'Era 2 — Abraão',
  sub: 'Gênesis 12–22',
  /** Jogáveis na ordem da roda de troca (teclas 1–5). Isaque só entra em B5. */
  jogaveis: JOGAVEIS_ABRAAO,
  /** Quem vive em Canaã a era inteira (Melquisedeque, o rei de Sodoma, aliados, pastores, servos). */
  npcs: NPCS_ABRAAO,
  /** NPCs criados só durante uma missão (fugitivo, sentinelas, guerreiros, cativos). */
  npcsCena: NPCS_CENA_ABRAAO,
  /** Onde cada personagem começa ao entrar na era (ponto do mapa + yaw). */
  inicio: INICIO_ABRAAO,
  /** Quem pode ser controlado em cada missão. */
  elenco: ELENCO_ABRAAO,
  protagonista: 'abraao',
  missoes: MISSOES_ABRAAO,
  missaoInicial: 'b1',
  memorias: MEMORIAS_ABRAAO,
  segredos: SEGREDOS_ABRAAO,
  cristo: CRISTO_ABRAAO,
  atalhos: ATALHOS_ABRAAO,
  /** Última era do MVP: B5 termina nos créditos (`servicos.creditos()`), sem era seguinte. */
  seguinte: null,
  /** Liga os serviços (Canaã, céu, áudio, rebanhos...) antes de iniciar as missões. */
  ligarServicos: ligarServicosAbraao,
  /** Reconstrói Canaã pelas flags (carregar save / entrar na era). */
  reconstruir: reconstruirMundoAbraao,
  /** Registra os segredos (memórias opcionais) que valem a era inteira. */
  registrarSegredos: registrarSegredosAbraao,
  /** Esquece animais, rebanhos e a mecânica de cena guardados pelas missões (mundo descartado). */
  limparCena: limparCenaAbraao,
  jogar: jogarEraAbraao,
  resolverEtapa: resolverEtapaAbraao,
} as const;

export * from './personagens';
export * from './memorias';
export * from './cristo';
export * from './servicos';
export * from './interativos';
export * from './mecanicas';
export * from './missoes';
export * from './atalhos';
