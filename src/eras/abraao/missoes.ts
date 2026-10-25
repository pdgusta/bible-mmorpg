// Missões da era de Abraão (B1–B5), conforme docs/ROTEIRO.md.
//
// Regras seguidas aqui (as mesmas da era de Noé):
// - Texto bíblico só por referência (`ref` + `trecho` exato da BKJ); falas de ficção curtas.
// - Deus nunca aparece como figura: voz e luz dourada. O Anjo do Senhor também é só voz e luz.
// - Gn 22 em tom solene: Isaque nunca é ferido; plano aberto, sem close no amarrar; a cena
//   corta para a luz em Gn 22:10 e o carneiro preso pelos chifres é oferecido como fogo no altar.
// - Cada etapa é idempotente: flags e contadores dizem o que já foi feito, o mundo é
//   reconstruído pelas flags (`reconstruirMundoAbraao`) e a etapa recomeça pulando o que já está feito.
// - Tudo o que não está no CtxMissao vem de `servicosAbraao()` (ver servicos.ts); as mecânicas
//   em tempo real (rebanhos, furtividade, batalha, "os dois juntos") ficam em mecanicas.ts.
import * as THREE from 'three';
import type { Alvo, CtxMissao, DefEtapa, DefMissao, DefProva, Linha, OpcaoEscolha } from '../../jogo/contratos';
import type { Personagem } from '../../jogo/Personagem';
import type { NomeClipe } from '../../entidades/humano/Animador';
import { ATRIBUTOS } from '../../jogo/Atributos';
import { MEMORIAS_NOE } from '../noe/memorias';
import { CURRAIS, ROTAS_FLANCO, ROTAS_SENTINELAS, TRILHA_BETEL, localCurral } from './mapa';
import type { EstadoAltar, LugarAcampamento, NomeAltar, NomeCurral, NomePorteira, NomeTenda } from './construir';
import { servicosAbraao, type AnimalAbraao, type OpcoesAnimalAbraao, type RebanhoAbraao, type ServicosAbraao } from './servicos';
import {
  ID_AMARRAR_CORDA, ponto2, registrarEtapa, resolverLugar,
  type AjusteInterativo, type LugarAbraao, type MundoBase, type RegistroInterativos,
} from './interativos';
import {
  CATIVOS_B3, ELENCO_ABRAAO, FLAG_ISAQUE, FLAG_LO_PARTIU, FLAG_MANRE, FLAG_NOME_ABRAAO, FLAG_NOME_SARA, GRUPOS_B3,
  IDS_JOGAVEIS_ABRAAO, IDS_PASTORES_LO, INIMIGOS_B3, NPCS_CENA_ABRAAO, SENTINELAS_B3, SERVOS_ABRAAO, SERVOS_MORIA,
  ALIADOS_ABRAAO,
} from './personagens';
import { Batalha, Furtividade, Juntos, caminhoFe, trechoRevelado, type GrupoFurtivo, type Ponto2, type SentinelaRonda } from './mecanicas';

const ERA = 'abraao';
/** Pose de oração / ajoelhado (o Animador ainda não tem um clipe próprio de oração). */
export const CLIPE_ORACAO: NomeClipe = 'agachado';
const ALTARES: NomeAltar[] = ['altarMore', 'altarBetel', 'altarManre', 'altarMoria'];
const TENDAS: NomeTenda[] = ['tendaAbrao', 'tendaSara'];
const IDS_SERVOS = SERVOS_ABRAAO.map((d) => d.id);
const IDS_ALIADOS = ALIADOS_ABRAAO.map((d) => d.id);
const TOTAL_OVELHAS = 10;
/** Lã escura das ovelhas de Ló. */
export const TOM_LO = '#7a6656';

type EvInteracao = { id: string; personagem: Personagem };

const sv = () => servicosAbraao();

// ------------------------------------------------------------------------------ falas

const narrador = (ref: string, trecho?: string): Linha => (trecho ? { quem: 'narrador', ref, trecho } : { quem: 'narrador', ref });
const deus = (ref: string, trecho?: string): Linha => (trecho ? { quem: 'deus', ref, trecho } : { quem: 'deus', ref });
/** O Anjo do Senhor: voz e luz, rosto nunca mostrado. */
const anjo = (ref: string, trecho?: string): Linha => (trecho ? { quem: 'anjo', ref, trecho } : { quem: 'anjo', ref });
const diz = (quem: string) => (ref: string, trecho?: string): Linha => (trecho ? { quem, ref, trecho } : { quem, ref });
const abraaoDiz = diz('abraao');
const isaqueDiz = diz('isaque');
const saraDiz = diz('sara');
const melquisedequeDiz = diz('melquisedeque');
const reiSodomaDiz = diz('reiSodoma');
const ficcao = (quem: string, texto: string, emocao?: 'alegre' | 'triste' | 'preocupado' | 'firme' | 'irado' | 'reverente'): Linha =>
  (emocao ? { quem, texto, emocao } : { quem, texto });

/** Sussurros do tentador (ficção) diante dos despojos de Sodoma (B3). */
export const MENTIRAS_B3 = [
  'Isso é seu. Não divida com ninguém.',
  'Pegue tudo antes que outro pegue.',
  'Com isso você nunca mais precisará de ninguém.',
  'Ló escolheu a melhor terra. Pegue a sua parte.',
];
/** Mentiras da noite de dúvida (ficção) em B4. */
export const MENTIRAS_B4 = [
  'Você é velho demais.',
  'Sarai é estéril. Promessas são só palavras.',
  'Ele te esqueceu, como esqueceu Noé.',
  'Eliézer será o herdeiro. Aceite.',
];
/** O medo da subida final (ficção) em B5: vento e altura. */
export const MENTIRAS_B5 = [
  'O vento vai derrubar vocês.',
  'Está alto demais. Desça.',
  'Ainda dá tempo de voltar.',
  'Um passo em falso, e tudo acaba.',
];

export const PROVA_TENTACAO_B3: DefProva = {
  id: 'b3_tentacao',
  tipo: 'tentacao',
  titulo: 'Nem um fio',
  instrucao: 'Os despojos brilham e o sussurro insiste. Responda com Q — "Está escrito" — com a Palavra que já recebeu.',
  mentiras: MENTIRAS_B3,
  respostas: ['Gn 14:22-23', 'Gn 13:8', 'Gn 12:2'],
  alvo: 6,
  personagem: 'abraao',
  intensidade: 0.5,
};

/** A noite das estrelas: todas as memórias guardadas (das duas eras) servem; o arco-íris de Noé é a mais forte. */
export const PROVA_DUVIDA_B4: DefProva = {
  id: 'b4_duvida',
  tipo: 'duvida',
  titulo: 'Conta as estrelas',
  instrucao: 'Lembre-se do que Deus já fez (teclas 1–5): cada memória acende estrelas. Segure o botão direito para apagar os dardos.',
  mentiras: MENTIRAS_B4,
  alvo: 12,
  personagem: 'abraao',
  intensidade: 0.45,
};

export const PROVA_MEDO_B5: DefProva = {
  id: 'b5_medo',
  tipo: 'medo',
  titulo: 'A subida final',
  instrucao: 'Segure R para orar e subam juntos: perto de Isaque, a calma cai mais devagar.',
  mentiras: MENTIRAS_B5,
  alvo: 15,
  personagem: 'abraao',
  aliado: 'isaque',
  intensidade: 0.4,
};

// ------------------------------------------------------------------------------ utilidades

const feito = (c: CtxMissao, nome: string) => !!c.flags[nome];
const marcar = (c: CtxMissao, nome: string, valor: unknown = true) => c.definirFlag(nome, valor);
const lista = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i + 1}`);

function lugar(c: CtxMissao, l: LugarAbraao): THREE.Vector3 {
  return resolverLugar(c.mundo as MundoBase, l);
}
function pessoa(c: CtxMissao, id: string): Personagem | undefined {
  return c.mundo.personagens.get(id);
}
/** O personagem controlado (ou null, se ninguém). */
function ativoOu(c: CtxMissao): Personagem | null {
  try {
    return c.ativo();
  } catch {
    return null;
  }
}
/** Nome exibido agora (Abrão/Abraão, Sarai/Sara). */
function nome(c: CtxMissao, id: string): string {
  return pessoa(c, id)?.nome ?? id;
}

/** Ponto em volta de um centro (para não empilhar pessoas). */
function anel(v: THREE.Vector3, i: number, r = 1.8): THREE.Vector3 {
  if (!i) return v.clone();
  const a = i * 2.1;
  return new THREE.Vector3(v.x + Math.cos(a) * r, v.y, v.z + Math.sin(a) * r);
}

/** Espera o próximo uso de qualquer um destes interativos. */
function interacaoEntre(c: CtxMissao, ids: Iterable<string>): Promise<EvInteracao> {
  const set = new Set(ids);
  return c.esperarEvento<EvInteracao>('interacao', (d) => !!d && set.has(d.id));
}

/** Espera o interativo ser usado por um personagem específico (dica para os outros). */
async function interacaoDe(c: CtxMissao, id: string, quem: string, dica: string): Promise<Personagem> {
  for (;;) {
    const p = await c.interacao(id);
    if (p.id === quem) return p;
    c.dica(dica);
  }
}

/** Anima um valor ao longo do tempo de jogo (passos de 0,1 s). */
async function transicao(c: CtxMissao, segundos: number, fn: (t: number) => void, passo = 0.1) {
  const n = Math.max(1, Math.round(segundos / passo));
  for (let i = 1; i <= n; i++) {
    await c.esperar(passo);
    fn(i / n);
  }
}

async function animarCeu(c: CtxMissao, chave: 'gloria' | 'estrelas', alvo: number, segundos: number) {
  const ceu = sv().ceu;
  const de = ceu[chave] ?? 0;
  await transicao(c, segundos, (t) => (ceu[chave] = de + (alvo - de) * t));
}

/** A voz de Deus (ou do Anjo do Senhor): a luz dourada sobe, as falas, a luz volta. */
async function vozDeDeus(c: CtxMissao, linhas: Linha[], luz = 0.55) {
  await animarCeu(c, 'gloria', luz, 1.5);
  await c.dialogo(linhas);
  await animarCeu(c, 'gloria', 0, 1.5);
}

/** Leva alguém até perto de um ponto se estiver longe (carregar save, posições perdidas). */
function aproximarSeLonge(c: CtxMissao, id: string, destino: THREE.Vector3, raio: number, indice = 0): boolean {
  const p = pessoa(c, id);
  if (!p || p.posicao.distanceTo(destino) <= raio) return false;
  if (p.escalada) p.sairEscalada('aqui');
  const v = anel(destino, indice, 1.6);
  p.teleportar(v.x, c.mundo.chao(v.x, v.z, v.y + 3) + 0.05, v.z);
  return true;
}

function pose(c: CtxMissao, id: string, clipe: NomeClipe | null) {
  const p = pessoa(c, id);
  if (p && !p.controlado) p.humano.animador.atividade = clipe;
}

function esperarAli(c: CtxMissao, ids: string[]) {
  for (const id of ids) {
    const p = pessoa(c, id);
    if (p && !p.controlado && !p.posto) p.ia.esperar();
  }
}

function voltarRotinas(c: CtxMissao, ids: string[]) {
  for (const id of ids) {
    const p = pessoa(c, id);
    if (p && !p.controlado && !p.posto && p.humano.visivel) p.ia.voltarARotina();
  }
}

function seguirLider(c: CtxMissao, ids: string[], lider: string, distancia = 2.4) {
  const l = pessoa(c, lider);
  if (!l) return;
  for (const id of ids) {
    const p = pessoa(c, id);
    if (p && !p.controlado && !p.posto && id !== lider) p.ia.seguir(l, distancia);
  }
}

function ocupante(c: CtxMissao, idPosto: string): Personagem | null {
  for (const p of c.mundo.personagens.values()) if (p.posto?.id === idPosto) return p;
  return null;
}

function soltarPosto(c: CtxMissao, idPosto: string) {
  if (ocupante(c, idPosto)) sv().liberarPosto(idPosto);
}

/** Garante que o jogador controla alguém do elenco (ex.: Abrão para a escolha dos pastores). */
function controlarSe(c: CtxMissao, id: string) {
  const a = ativoOu(c);
  if (a?.id !== id && pessoa(c, id)) sv().controlar(id);
}

/** Promessa que ninguém espera: nunca vira rejeição solta. */
function soltar(p: Promise<unknown>) {
  p.catch(() => {});
}

/** Registra os interativos de uma etapa, roda o corpo e remove ao sair (mesmo se abortada). */
async function comEtapa<T>(c: CtxMissao, chave: string, ajustes: Record<string, AjusteInterativo>, corpo: (r: RegistroInterativos) => Promise<T>): Promise<T> {
  const r = registrarEtapa(c.mundo as MundoBase, chave, ajustes);
  try {
    return await corpo(r);
  } finally {
    r.remover();
  }
}

/** Roda `fn` a cada quadro enquanto o corpo executa. */
async function comQuadro<T>(fn: (dt: number) => void, corpo: () => Promise<T>): Promise<T> {
  const off = sv().aCadaQuadro(fn);
  try {
    return await corpo();
  } finally {
    off();
  }
}

/** O profeta usou Q (discernir) neste quadro? */
function discerniu(c: CtxMissao): boolean {
  const e = sv().entrada;
  const a = ativoOu(c);
  return !!a && a.classe === 'profeta' && (e.pressionou('habilidade') || e.pressionou('discernir'));
}

// ------------------------------------------------------------------------------ mecânica atual

/** Mecânica em tempo real em andamento (para os atalhos de depuração e testes). */
export interface MecanicaAbraao {
  nome: 'rebanhos' | 'furtividade' | 'batalha';
  /** Resolve na hora pelas mesmas APIs do jogo (teleporta, desarma), como `Provas.resolverAutomaticamente`. */
  resolverAutomaticamente(): void;
}
let mecanica: MecanicaAbraao | null = null;

export function mecanicaAbraao(): MecanicaAbraao | null {
  return mecanica;
}

// ------------------------------------------------------------------------------ mundo e elenco

function definirAltar(c: CtxMissao, nomeAltar: NomeAltar, estado: EstadoAltar) {
  sv().canaa.definirAltar(nomeAltar, estado);
  marcar(c, `altar_${nomeAltar}`, estado);
}

function montarTenda(c: CtxMissao, t: NomeTenda, montada: boolean) {
  sv().canaa.montarTenda(t, montada);
  marcar(c, `tendaMontada_${t}`, montada);
}

/** Os despojos de Savé (B3) e o brilho sobre eles, guardados nas flags para o carregar. */
function mostrarDespojos(c: CtxMissao, visivel: boolean, aceso = false) {
  const k = sv().canaa;
  k.definirDespojos(visivel);
  k.acenderDespojos(visivel && aceso);
  marcar(c, 'despojosSave', visivel);
  marcar(c, 'despojosAcesos', visivel && aceso);
}

function mudarAcampamento(c: CtxMissao, l: LugarAcampamento) {
  const s = sv();
  if (s.canaa.acampamento !== l) s.canaa.definirAcampamento(l);
  marcar(c, 'acampamento', l);
}

/** Põe alguém em cena ou o tira dela (invisível, no bastidor, sem rotina). */
function presenca(m: MundoBase, s: Pick<ServicosAbraao, 'liberarPosto'>, id: string, presente: boolean, onde?: THREE.Vector3) {
  const p = m.personagens.get(id);
  if (!p) return;
  if (!presente) {
    if (p.posto) s.liberarPosto(p.posto.id);
    if (p.escalada) p.sairEscalada('aqui');
    if (p.carregando) p.carregar(null);
    p.humano.visivel = false;
    p.humano.animador.atividade = null;
    p.ia.esperar();
    const [x, z] = ponto2(m, 'bastidor');
    if (Math.hypot(p.posicao.x - x, p.posicao.z - z) > 4) p.teleportar(x, m.chao(x, z) + 0.05, z);
    return;
  }
  const estava = p.humano.visivel;
  p.humano.visivel = true;
  if (onde) p.teleportar(onde.x, m.chao(onde.x, onde.z, onde.y + 3) + 0.05, onde.z);
  else if (!estava) {
    const [x, z] = ponto2(m, 'acampamento');
    p.teleportar(x, m.chao(x, z) + 0.05, z);
  }
  if (!estava && !p.controlado) p.ia.voltarARotina();
}

/** Quem está na história agora (Isaque nasce em B5; Ló parte em B2). */
function presente(flags: Record<string, unknown>, id: string): boolean {
  if (id === 'isaque') return !!flags[FLAG_ISAQUE];
  if (id === 'lo') return !flags[FLAG_LO_PARTIU];
  return true;
}

/** Disponibilidade e presença dos jogáveis numa missão (tabela do ROTEIRO). */
function aplicarElenco(c: CtxMissao, missao: string) {
  const s = sv();
  const elenco = ELENCO_ABRAAO[missao] ?? [];
  marcar(c, 'elencoAbraao', missao);
  const ativo = ativoOu(c);
  if (ativo && !elenco.includes(ativo.id)) controlarSe(c, 'abraao');
  for (const id of IDS_JOGAVEIS_ABRAAO) {
    if (!pessoa(c, id)) continue;
    const esta = presente(c.flags, id);
    presenca(c.mundo as MundoBase, s, id, esta);
    c.disponivel(id, esta && elenco.includes(id));
  }
}

/** Abrão herda de Noé o altar (A6): o verbo construirAltar. */
function herdarAltar(m: MundoBase) {
  const a = m.personagens.get('abraao');
  if (a && !a.aprendidos.includes('construirAltar')) a.aprendidos.push('construirAltar');
}

/**
 * Legado da era 1 (ROTEIRO): +1 de fé para cada 2 segredos achados na era de Noé (até +2),
 * +1 de domínio se A3 foi vencida na primeira tentativa. As memórias de Noé já estão no
 * Progresso e servem na noite das estrelas (B4). Aplicado uma vez, no início de B1; as linhas
 * ficam na flag 'legadoNoe' para o Diário.
 */
function aplicarLegado(c: CtxMissao) {
  if (feito(c, 'legadoAplicado')) return;
  const s = sv();
  const linhas: string[] = [];
  const fe = Math.min(2, Math.floor(s.progresso.segredosDaEra('noe') / 2));
  if (fe > 0) {
    s.progresso.somarAtributo('abraao', 'fe', fe);
    linhas.push(`Legado de Noé: +${fe} ${ATRIBUTOS.fe.nome}`);
  }
  if (feito(c, 'a3PrimeiraTentativa')) {
    s.progresso.somarAtributo('abraao', 'dominio', 1);
    linhas.push(`Legado de Noé: +1 ${ATRIBUTOS.dominio.nome}`);
  }
  linhas.push('Legado de Noé: Abrão sabe construir altares ao Senhor');
  const idsNoe = new Set(MEMORIAS_NOE.map((m) => m.id));
  const memorias = s.progresso.memorias.filter((id) => idsNoe.has(id)).length;
  if (memorias) linhas.push(`Legado de Noé: ${memorias} memória${memorias > 1 ? 's' : ''} de fidelidade guardada${memorias > 1 ? 's' : ''}`);
  for (const l of linhas) c.aviso(l);
  marcar(c, 'legadoNoe', linhas);
  marcar(c, 'legadoAplicado');
}

// NPCs de cena e animais criados pelas etapas (recriar a etapa não duplica).
function garantirNPC(c: CtxMissao, id: string, l: LugarAbraao, yaw = 0, raio = 30): Personagem {
  const v = lugar(c, l);
  const p = pessoa(c, id);
  if (p) {
    aproximarSeLonge(c, id, v, raio);
    return p;
  }
  const def = NPCS_CENA_ABRAAO[id];
  if (!def) throw new Error(`NPC de cena desconhecido: ${id}`);
  const novo = sv().criarPersonagem(def, v.x, v.z, yaw);
  if (FIGURANTES_B3.includes(id)) ajustarFigurante(novo, !!c.flags.figurantesB3);
  return novo;
}

function tirarNPC(c: CtxMissao, id: string) {
  if (pessoa(c, id)) sv().removerPersonagem(id);
}

const animaisCena = new Map<string, AnimalAbraao>();

async function criarAnimal(chave: string, especie: string, x: number, z: number, opts?: OpcoesAnimalAbraao): Promise<AnimalAbraao> {
  const velho = animaisCena.get(chave);
  if (velho) return velho;
  const a = await sv().animais.criar(especie, x, z, opts);
  animaisCena.set(chave, a);
  return a;
}

async function removerAnimal(chave: string, suave = true) {
  const a = animaisCena.get(chave);
  if (!a) return;
  animaisCena.delete(chave);
  try {
    await a.remover(suave);
  } catch {
    /* já removido */
  }
}

// ------------------------------------------------------------------------------ reconstrução

/**
 * Reconstrói Canaã a partir das flags (ao carregar um save ou ao entrar na era). O
 * orquestrador chama isto depois de ligar os serviços e antes de retomar a missão atual.
 */
export function reconstruirMundoAbraao(s: ServicosAbraao, m: MundoBase, flags: Record<string, unknown>) {
  const k = s.canaa;
  k.definirAcampamento((flags.acampamento as LugarAcampamento | undefined) ?? 'betel');
  for (const t of TENDAS) {
    const v = flags[`tendaMontada_${t}`];
    k.montarTenda(t, v === undefined ? true : !!v);
  }
  for (const a of ALTARES) k.definirAltar(a, (flags[`altar_${a}`] as EstadoAltar | undefined) ?? 'oculto');
  k.definirAcampamentoInimigo(!!flags.inimigoVisivel);
  k.definirDespojos(!!flags.despojosSave);
  k.acenderDespojos(!!flags.despojosAcesos);
  k.amarrarCordaMoria(!!flags.cordaAmarrada);
  for (const p of ['porteiraAbrao', 'porteiraLo'] as NomePorteira[]) k.abrirPorteira(p, false, true);
  k.revelarPedras(0);
  const noite = flags.b3Noite ? 22 : flags.b4Noite ? 21.5 : null;
  s.ceu.pausado = noite !== null;
  if (noite !== null) s.ceu.hora = noite;
  s.ceu.estrelas = flags.b4Estrelas ? 1 : 0;
  s.ceu.gloria = 0;
  // elenco: quem está na história e quem pode ser controlado
  const elenco = ELENCO_ABRAAO[(flags.elencoAbraao as string | undefined) ?? 'b1'] ?? [];
  for (const id of IDS_JOGAVEIS_ABRAAO) {
    const p = m.personagens.get(id);
    if (!p) continue;
    const esta = presente(flags, id);
    presenca(m, s, id, esta);
    p.disponivel = esta && elenco.includes(id);
  }
  if (flags[FLAG_LO_PARTIU]) for (const id of IDS_PASTORES_LO) presenca(m, s, id, false);
  // os figurantes de B3 (de Dã ao fim de Savé), pela flag
  for (const id of FIGURANTES_B3) ajustarFigurante(m.personagens.get(id), !!flags.figurantesB3);
  herdarAltar(m);
  const a = m.personagens.get('abraao');
  if (a) {
    const escala = a.aprendidos.indexOf('escalar');
    if (flags.b5EscalarLiberado && !flags.b5Altar) {
      if (escala < 0) a.aprendidos.push('escalar');
    } else if (escala >= 0 && flags.b5EscalarLiberado) a.aprendidos.splice(escala, 1);
  }
}

// ------------------------------------------------------------------------------ B1

const MASTROS = [
  { mastro: 'mastroTenda1', amarrar: 'amarrarTenda1', tenda: 'tendaAbrao' as NomeTenda },
  { mastro: 'mastroTenda2', amarrar: 'amarrarTenda2', tenda: 'tendaSara' as NomeTenda },
];

const B1: DefMissao = {
  id: 'b1', era: ERA, titulo: 'Para a terra que eu te mostrarei', tipos: ['tutorial'],
  resumo: 'A caravana de Abrão chega a Canaã. Junto ao carvalho de Moré e no monte entre Betel e Ai, Abrão levanta altares e invoca o nome do Senhor.',
  refs: ['Gn 12:1-8', 'Hb 11:8'],
  recompensa: { xp: 100 },
  proxima: 'b2',
  etapas: [
    {
      id: 'chegada',
      objetivo: '',
      async executar(c) {
        const s = sv();
        aplicarElenco(c, 'b1');
        herdarAltar(c.mundo as MundoBase);
        if (!feito(c, 'b1Comecou')) {
          // a caravana chega ao carvalho de Moré; as tendas só serão armadas em Betel
          for (const t of TENDAS) montarTenda(c, t, false);
          mudarAcampamento(c, 'betel');
          const ini = lugar(c, 'chegada');
          c.personagem('abraao').teleportar(ini.x, ini.y + 0.05, ini.z, Math.PI);
          ['sara', 'lo', 'eliezer'].forEach((id, i) => aproximarSeLonge(c, id, lugar(c, 'caravana'), 4, i + 1));
          s.ceu.hora = 8;
          marcar(c, 'b1Comecou');
        }
        if (feito(c, 'b1Chegada')) return;
        s.audio.musica('calmo');
        s.audio.ambiente('canaa', 0.6);
        await c.cena(async () => {
          const more = lugar(c, 'more');
          await c.fade(true, 0);
          await c.camera(more.clone().add(new THREE.Vector3(-16, 10, -18)), more.clone().add(new THREE.Vector3(0, 3, 0)), 0);
          await c.fade(false, 2);
          await c.dialogo([narrador('Gn 12:1-3')]);
          // a caravana caminha até o carvalho
          ['abraao', 'sara', 'lo', 'eliezer'].forEach((id, i) => soltar(c.mover(id, anel(more, i + 1, 4))));
          await c.dialogo([narrador('Gn 12:4'), narrador('Gn 12:5'), narrador('Gn 12:6')]);
          await c.cameraVoltar(2);
        });
        c.memoria('chamado');
        c.versiculo('Hb 11:8');
        aplicarLegado(c);
        c.dica('Novos companheiros: Sarai (hospitaleira), Ló (pastor), Eliézer (guerreiro). Use Tab para trocar.');
        marcar(c, 'b1Chegada');
      },
    },
    {
      id: 'altarMore',
      objetivo: 'Construa um altar junto ao carvalho de Moré.',
      async executar(c) {
        const s = sv();
        herdarAltar(c.mundo as MundoBase);
        seguirLider(c, ['sara', 'lo', 'eliezer'], 'abraao');
        if (!feito(c, 'b1PromessaTerra')) {
          c.objetivo('Vá ao carvalho de Moré.', ['more']);
          await c.chegar('abraao', 'more', 14);
          await c.cena(() => vozDeDeus(c, [deus('Gn 12:7', 'À tua semente eu darei esta terra;')]));
          marcar(c, 'b1PromessaTerra');
        }
        if (!feito(c, 'b1AltarMore')) {
          c.objetivo(`${nome(c, 'abraao')}: construa um altar ao Senhor junto ao carvalho de Moré.`, ['altarMore']);
          c.dica('Segure E no lugar do altar. Aprendido nos dias de Noé.');
          const p = await comEtapa(c, 'b1.altarMore', {}, () => interacaoDe(c, 'altarMore', 'abraao', 'Quem constrói o altar é Abrão.'));
          definirAltar(c, 'altarMore', 'aceso');
          s.audio.efeito('fogo');
          c.xp(p.id, 'construir');
          c.treinar(p.id, 'comunhao', 0.5);
          marcar(c, 'b1AltarMore');
        }
        await c.dialogo([narrador('Gn 12:7', 'e ali ele edificou um altar ao Senhor, que lhe apareceu.')]);
        s.cristo('bencaoNacoes');
      },
    },
    {
      id: 'acampar',
      objetivo: 'Siga para o monte entre Betel e Ai e arme as tendas.',
      async executar(c) {
        const s = sv();
        const montada = (t: (typeof MASTROS)[number]) => feito(c, `tendaMontada_${t.tenda}`);
        if (MASTROS.every(montada)) return;
        if (!feito(c, 'b1NoMonte')) {
          seguirLider(c, ['sara', 'lo', 'eliezer'], 'abraao');
          // Sair pela fé (ensinamento 11, Hb 11:8): a bússola mostra só o fim do trecho revelado;
          // o destino aparece quando se chega ao último trecho
          const caminho = caminhoFe([...TRILHA_BETEL, ponto2(c.mundo as MundoBase, 'acampamentoBetel')]);
          const ultimo = caminho.pontos.length - 1;
          let trecho = 0;
          const revelar = () => {
            const a = c.ativo().posicao;
            const k = trechoRevelado(caminho, a.x, a.z, trecho);
            if (k === trecho) return;
            trecho = k;
            c.objetivo('Siga para o monte entre Betel e Ai.', [k === ultimo ? 'acampamentoBetel' : caminho.pontos[k]]);
          };
          revelar();
          await comQuadro(revelar, () => c.chegar('ativo', 'acampamentoBetel', 18));
          marcar(c, 'b1NoMonte');
        }
        const acamp = lugar(c, 'acampamentoBetel');
        ['abraao', 'sara', 'lo', 'eliezer'].forEach((id, i) => aproximarSeLonge(c, id, acamp, 40, i));
        esperarAli(c, ['sara', 'lo', 'eliezer']);
        const objetivo = () => {
          const n = MASTROS.filter(montada).length;
          const falta = MASTROS.filter((t) => !montada(t));
          c.objetivo(`Arme as tendas (${n}/2): alguém segura o mastro, outro amarra as cordas.`, falta.flatMap((t) => [t.mastro, t.amarrar]));
        };
        objetivo();
        c.dica('Ponha alguém segurando o mastro (E), troque de personagem (Tab) e amarre as cordas com outro. Quem está num posto continua lá.');
        const ajustes: Record<string, AjusteInterativo> = {};
        for (const t of MASTROS) {
          ajustes[t.mastro] = { ativo: () => !montada(t) };
          ajustes[t.amarrar] = { ativo: () => !montada(t) && !!ocupante(c, t.mastro) };
        }
        try {
          await comEtapa(c, 'b1.acampar', ajustes, async (reg) => {
            for (const t of MASTROS) if (montada(t)) {
              reg.tirar(t.mastro);
              reg.tirar(t.amarrar);
            }
            while (!MASTROS.every(montada)) {
              const { id, personagem: p } = await interacaoEntre(c, reg.ids);
              const t = MASTROS.find((x) => x.amarrar === id);
              if (!t || montada(t)) continue; // entrar num posto também é uma interação
              const segurando = ocupante(c, t.mastro);
              if (!segurando || segurando === p) {
                c.dica('Alguém precisa segurar o mastro enquanto outro amarra.');
                continue;
              }
              montarTenda(c, t.tenda, true);
              s.audio.efeito('corda');
              soltarPosto(c, t.mastro);
              reg.tirar(t.mastro);
              reg.tirar(t.amarrar);
              for (const q of [p, segurando]) c.xp(q.id, 'cooperacao', 20);
              c.treinar(p.id, 'agilidade', 0.3);
              c.treinar(segurando.id, 'forca', 0.3);
              objetivo();
            }
          });
        } finally {
          for (const t of MASTROS) soltarPosto(c, t.mastro);
        }
        c.unidade(5);
        voltarRotinas(c, ['sara', 'lo', 'eliezer']);
      },
    },
    {
      id: 'invocar',
      objetivo: 'Construa o altar entre Betel e Ai e invoque o nome do Senhor.',
      async executar(c) {
        const s = sv();
        if (feito(c, 'b1Invocou')) return;
        herdarAltar(c.mundo as MundoBase);
        const ajustes: Record<string, AjusteInterativo> = {
          altarBetel: { ativo: () => !feito(c, 'b1AltarBetel') },
          orarBetel: { ativo: () => feito(c, 'b1AltarBetel') },
        };
        await comEtapa(c, 'b1.invocar', ajustes, async (reg) => {
          if (feito(c, 'b1AltarBetel')) reg.tirar('altarBetel');
          else {
            c.objetivo(`${nome(c, 'abraao')}: construa um altar entre Betel e Ai.`, ['altarBetel']);
            const p = await interacaoDe(c, 'altarBetel', 'abraao', 'Quem constrói o altar é Abrão.');
            definirAltar(c, 'altarBetel', 'aceso');
            s.audio.efeito('fogo');
            c.xp(p.id, 'construir');
            marcar(c, 'b1AltarBetel');
            reg.tirar('altarBetel');
          }
          await c.dialogo([narrador('Gn 12:8')]);
          c.objetivo(`${nome(c, 'abraao')}: invoque o nome do Senhor junto ao altar.`, ['orarBetel']);
          c.dica('Segure E para orar.');
          await interacaoDe(c, 'orarBetel', 'abraao', 'Junto ao altar, é Abrão quem invoca o nome do Senhor.');
        });
        c.memoria('altarBetel');
        c.xp('abraao', 'disciplina');
        c.treinar('abraao', 'comunhao', 0.6);
        marcar(c, 'b1Invocou');
      },
    },
  ],
};

// ------------------------------------------------------------------------------ B2

interface RebanhosB2 {
  abrao: RebanhoAbraao;
  lo: RebanhoAbraao | null;
}
let rebanhosB2: RebanhosB2 | null = null;
let criandoRebanhos: Promise<RebanhosB2> | null = null;

/** Posição dentro de um curral (grade 5 × 2, longe das cercas). */
function noCurral(curral: NomeCurral, i: number): Ponto2 {
  const c = CURRAIS[curral];
  const lx = -c.w / 2 + 2 + (i % 5) * ((c.w - 4) / 4);
  const lz = Math.floor(i / 5) % 2 ? 1.6 : -1.6;
  return localCurral(c, lx, lz);
}

/** Os rebanhos de Abrão (lã clara) e de Ló (lã escura), misturados no poço ou já separados. */
function garantirRebanhos(c: CtxMissao): Promise<RebanhosB2> {
  if (rebanhosB2) return Promise.resolve(rebanhosB2);
  if (criandoRebanhos) return criandoRebanhos;
  const s = sv();
  const separados = feito(c, 'b2Separados');
  const comLo = !feito(c, FLAG_LO_PARTIU);
  const [px, pz] = ponto2(c.mundo as MundoBase, 'poco');
  const criarBando = async (dono: 'abrao' | 'lo') => {
    const animais: AnimalAbraao[] = [];
    for (let i = 0; i < TOTAL_OVELHAS; i++) {
      const [x, z] = separados
        ? noCurral(dono === 'abrao' ? 'curralAbrao' : 'curralLo', i)
        : [px + Math.cos(i * 1.3 + (dono === 'lo' ? 0.6 : 0)) * (5 + (i % 4) * 1.6), pz + 6 + Math.sin(i * 1.3 + (dono === 'lo' ? 0.6 : 0)) * (4 + (i % 3) * 1.4)];
      const a = await criarAnimal(`ovelha_${dono}_${i}`, 'ovelha', x, z, dono === 'lo' ? { tom: TOM_LO } : {});
      animais.push(a);
    }
    return s.animais.rebanho(animais);
  };
  criandoRebanhos = (async () => {
    const r: RebanhosB2 = { abrao: await criarBando('abrao'), lo: comLo ? await criarBando('lo') : null };
    rebanhosB2 = r;
    criandoRebanhos = null;
    return r;
  })();
  return criandoRebanhos;
}

async function removerRebanhoLo() {
  const r = rebanhosB2;
  if (!r?.lo) return;
  sv().animais.soltarRebanho(r.lo);
  r.lo = null;
  await Promise.all(lista('', TOTAL_OVELHAS).map((_, i) => removerAnimal(`ovelha_lo_${i}`, true)));
}

async function removerRebanhos() {
  const r = rebanhosB2;
  if (!r) return;
  await removerRebanhoLo();
  sv().animais.soltarRebanho(r.abrao);
  rebanhosB2 = null;
  await Promise.all(lista('', TOTAL_OVELHAS).map((_, i) => removerAnimal(`ovelha_abrao_${i}`, false)));
}

const PORTEIRAS: { id: NomePorteira; curral: NomeCurral; entrada: string; dono: 'abrao' | 'lo' }[] = [
  { id: 'porteiraAbrao', curral: 'curralAbrao', entrada: 'entradaCurralAbrao', dono: 'abrao' },
  { id: 'porteiraLo', curral: 'curralLo', entrada: 'entradaCurralLo', dono: 'lo' },
];

/** Porteira aberta: as ovelhas do outro dono que estavam presas no curral escapam. */
function expulsarErradas(c: CtxMissao, r: RebanhosB2, pt: (typeof PORTEIRAS)[number]) {
  const s = sv();
  const errado = pt.dono === 'abrao' ? r.lo : r.abrao;
  if (!errado) return;
  const centro = CURRAIS[pt.curral].centro;
  const [ex, ez] = ponto2(c.mundo as MundoBase, pt.entrada);
  const d = Math.hypot(ex - centro[0], ez - centro[1]) || 1;
  const fora: Ponto2 = [ex + ((ex - centro[0]) / d) * 4, ez + ((ez - centro[1]) / d) * 4];
  for (const a of [...errado.animais]) {
    if (!s.canaa.dentroCurral(pt.curral, a.posicao.x, a.posicao.z)) continue;
    errado.remover(a);
    soltar(a.irPara(fora[0] + (Math.random() - 0.5) * 3, fora[1] + (Math.random() - 0.5) * 3).then(() => {
      if (rebanhosB2 && (rebanhosB2.abrao === errado || rebanhosB2.lo === errado)) errado.adicionar(a);
    }));
  }
}

/** Atalho: cada ovelha no curral do seu dono, porteiras fechadas. */
function colocarNosCurrais(c: CtxMissao, r: RebanhosB2) {
  const s = sv();
  for (const pt of PORTEIRAS) {
    soltarPosto(c, pt.id);
    s.canaa.abrirPorteira(pt.id, false, true);
  }
  for (const [rb, curral] of [[r.abrao, 'curralAbrao'], [r.lo, 'curralLo']] as const) {
    if (!rb) continue;
    rb.animais.forEach((a, i) => {
      const [x, z] = noCurral(curral, i);
      a.teleportar(x, z);
    });
  }
}

const OPCOES_PASTORES: OpcaoEscolha[] = [
  {
    texto: 'Irmãos não brigam por água. Deixem os rebanhos de Ló beberem primeiro.',
    efeitos: { atributos: { humildade: 1 }, unidade: 10, flag: 'b2Cedeu' },
    resposta: [
      ficcao('pastorLo1', 'Primeiro os nossos? Então… obrigado, senhor.'),
      ficcao('pastorAbrao1', 'Como o senhor quiser. Esperaremos.', 'reverente'),
    ],
  },
  {
    texto: 'Vamos dividir os dias do poço, com justiça para todos.',
    requer: { atributo: 'sabedoria', minimo: 6 },
    efeitos: { atributos: { sabedoria: 1 }, unidade: 6, flag: 'b2Dividiu' },
    resposta: [
      ficcao('pastorAbrao1', 'Um dia para cada rebanho. É justo.'),
      ficcao('pastorLo1', 'Assim ninguém fica sem água.'),
    ],
  },
  {
    texto: 'Basta! O poço é meu, e quem manda aqui sou eu.',
    efeitos: { unidade: -10, flag: 'b2Orgulho' },
    resposta: [ficcao('narrador', 'Os pastores baixam os olhos e obedecem calados. O silêncio pesa mais que a briga.')],
  },
];

const MIRANTES = ['miranteNorte', 'miranteSul', 'miranteLeste', 'miranteOeste'];

const B2: DefMissao = {
  id: 'b2', era: ERA, titulo: 'Não haja contenda', tipos: ['cooperativo'],
  resumo: 'Os rebanhos de Abrão e de Ló se misturam no poço e os pastores brigam. Abrão deixa Ló escolher primeiro, e Deus lhe mostra a terra para os quatro lados.',
  refs: ['Gn 13:1-18', 'Fp 2:3', 'Mt 5:9', '2Co 5:7', 'Sl 133:1'],
  recompensa: { xp: 100 },
  proxima: 'b3',
  etapas: [
    {
      id: 'muitos',
      objetivo: '',
      async executar(c) {
        aplicarElenco(c, 'b2');
        if (feito(c, 'b2Muitos')) {
          await garantirRebanhos(c);
          return;
        }
        await c.cena(async () => {
          await c.dialogo([narrador('Gn 13:2'), narrador('Gn 13:5'), narrador('Gn 13:6')]);
          await c.fade(true, 1);
          await garantirRebanhos(c);
          const poco = lugar(c, 'poco');
          ['abraao', 'lo', 'sara', 'eliezer'].forEach((id, i) => aproximarSeLonge(c, id, poco.clone().add(new THREE.Vector3(-6, 0, -4)), 6, i));
          ['pastorAbrao1', 'pastorLo1', 'pastorAbrao2', 'pastorLo2'].forEach((id, i) => aproximarSeLonge(c, id, poco, 5, i + 1));
          esperarAli(c, ['pastorAbrao1', 'pastorLo1', 'pastorAbrao2', 'pastorLo2', 'sara', 'eliezer']);
          await c.camera(poco.clone().add(new THREE.Vector3(9, 6, 12)), poco.clone().add(new THREE.Vector3(0, 1.2, 3)), 0);
          await c.fade(false, 1);
          await c.dialogo([
            narrador('Gn 13:7'),
            ficcao('pastorLo1', 'Este poço é nosso! Chegamos primeiro!', 'irado'),
            ficcao('pastorAbrao1', 'Mentira! Nossas ovelhas bebem aqui desde a lua passada!', 'irado'),
          ]);
          await c.cameraVoltar(1.5);
        });
        marcar(c, 'b2Muitos');
      },
    },
    {
      id: 'separar',
      objetivo: 'Separe os rebanhos: as ovelhas de Abrão no curral de Abrão e as de Ló no de Ló.',
      async executar(c) {
        const s = sv();
        const r = await garantirRebanhos(c);
        if (feito(c, 'b2Separados') || !r.lo) return;
        const rLo = r.lo;
        const dentro = (curral: NomeCurral) => (x: number, z: number) => s.canaa.dentroCurral(curral, x, z);
        const contar = () => [r.abrao.dentroDe(dentro('curralAbrao')), rLo.dentroDe(dentro('curralLo'))];
        const abertas: Record<string, boolean> = { porteiraAbrao: false, porteiraLo: false };
        for (const pt of PORTEIRAS) s.canaa.abrirPorteira(pt.id, false, true);
        c.dica('Ló é pastor: ande atrás das ovelhas para conduzi-las e use Q (assobio) para juntá-las. As porteiras só ficam abertas com alguém segurando.');
        const quadro = () => {
          const a = ativoOu(c);
          const pastor = a && !a.posto ? a.posicao : null;
          r.abrao.pastor = pastor;
          rLo.pastor = pastor;
          if (a?.classe === 'pastor' && s.entrada.pressionou('habilidade')) {
            r.abrao.juntar();
            rLo.juntar();
          }
          for (const pt of PORTEIRAS) {
            const aberta = !!ocupante(c, pt.id);
            if (aberta === abertas[pt.id]) continue;
            abertas[pt.id] = aberta;
            s.canaa.abrirPorteira(pt.id, aberta);
            if (aberta) expulsarErradas(c, r, pt);
          }
        };
        mecanica = { nome: 'rebanhos', resolverAutomaticamente: () => colocarNosCurrais(c, r) };
        let texto = '';
        try {
          await comEtapa(c, 'b2.separar', {}, () => comQuadro(quadro, async () => {
            for (;;) {
              const [a, l] = contar();
              const novo = `Ovelhas de Abrão no curral de Abrão (${a}/${TOTAL_OVELHAS}) e de Ló no de Ló (${l}/${TOTAL_OVELHAS}).`;
              if (novo !== texto) {
                texto = novo;
                c.contador('ovelhasAbrao', a);
                c.contador('ovelhasLo', l);
                const alvos: Alvo[] = [{ personagem: 'lo' }];
                if (a < TOTAL_OVELHAS) alvos.push('porteiraAbrao');
                if (l < TOTAL_OVELHAS) alvos.push('porteiraLo');
                c.objetivo(novo, alvos);
              }
              if (a >= TOTAL_OVELHAS && l >= TOTAL_OVELHAS) break;
              await c.esperar(0.25);
            }
          }));
        } finally {
          mecanica = null;
          for (const pt of PORTEIRAS) {
            soltarPosto(c, pt.id);
            s.canaa.abrirPorteira(pt.id, false);
          }
          r.abrao.pastor = null;
          rLo.pastor = null;
        }
        marcar(c, 'b2Separados');
        c.xp('grupo', 'cooperacao');
        c.treinar('lo', 'compaixao', 0.5);
        c.treinar('lo', 'perseveranca', 0.4);
        c.unidade(5);
        c.versiculo('Sl 133:1');
      },
    },
    {
      id: 'pastores',
      objetivo: 'Abrão: fale com os pastores junto ao poço.',
      async executar(c) {
        if (feito(c, 'b2Escolheu')) return;
        await garantirRebanhos(c);
        const poco = lugar(c, 'poco');
        ['pastorAbrao1', 'pastorLo1'].forEach((id, i) => aproximarSeLonge(c, id, poco, 8, i + 1));
        esperarAli(c, ['pastorAbrao1', 'pastorLo1']);
        c.objetivo(`${nome(c, 'abraao')}: fale com os pastores junto ao poço.`, ['poco']);
        await comEtapa(c, 'b2.pastores', {}, () => interacaoDe(c, 'falarPastores', 'abraao', 'Quem fala com os pastores é Abrão.'));
        controlarSe(c, 'abraao');
        c.versiculo('Fp 2:3');
        const i = await c.escolha(ficcao('narrador', 'Os pastores esperam. O que Abrão dirá?'), OPCOES_PASTORES);
        marcar(c, 'b2Escolheu', i + 1);
        voltarRotinas(c, ['pastorAbrao1', 'pastorLo1']);
      },
    },
    {
      id: 'abraoELo',
      objetivo: 'Vá com Ló ao mirante sobre a planície do Jordão.',
      async executar(c) {
        const s = sv();
        if (feito(c, FLAG_LO_PARTIU)) {
          await removerRebanhoLo();
          for (const id of ['lo', ...IDS_PASTORES_LO]) presenca(c.mundo as MundoBase, s, id, false);
          return;
        }
        const r = await garantirRebanhos(c);
        c.objetivo('Vá com Ló ao mirante sobre a planície do Jordão.', ['miranteJordao']);
        if (ativoOu(c)?.id === 'lo') controlarSe(c, 'abraao');
        seguirLider(c, ['lo'], 'abraao', 2);
        await c.chegar('abraao', 'miranteJordao', 9);
        const mirante = lugar(c, 'miranteJordao');
        await c.cena(async () => {
          aproximarSeLonge(c, 'lo', mirante, 5, 1);
          const ab = c.personagem('abraao').posicao;
          await c.camera(ab.clone().add(new THREE.Vector3(-5, 2.6, -4)), ab.clone().add(new THREE.Vector3(0, 1.5, 0)), 1.5);
          await c.dialogo([
            abraaoDiz('Gn 13:8', 'Que não haja contenda, eu te suplico, entre mim e ti, e entre meus pastores e teus pastores, pois somos irmãos.'),
            abraaoDiz('Gn 13:9'),
          ]);
          // a câmera mostra o que Ló vê: a planície do Jordão, verde e regada
          const plan = lugar(c, 'planicieJordao');
          const sodoma = lugar(c, 'sodomaLonge');
          await c.camera(mirante.clone().add(new THREE.Vector3(0, 4.5, 0)), plan.clone().add(new THREE.Vector3(0, 2, 0)), 3);
          await c.dialogo([narrador('Gn 13:10')]);
          await c.camera(mirante.clone().add(new THREE.Vector3(2, 5, 3)), sodoma.clone().add(new THREE.Vector3(0, 4, 0)), 4);
          await c.dialogo([narrador('Gn 13:11'), narrador('Gn 13:12'), narrador('Gn 13:13')]);
          await c.cameraVoltar(1.5);
        });
        // Ló parte com os seus rebanhos e pastores para a planície
        c.disponivel('lo', false);
        marcar(c, FLAG_LO_PARTIU);
        const [dx, dz] = ponto2(c.mundo as MundoBase, 'descidaJordao');
        const lo = c.personagem('lo');
        soltar(lo.ia.irPara(dx, dz));
        IDS_PASTORES_LO.forEach((id, i) => {
          const p = pessoa(c, id);
          if (p) soltar(p.ia.irPara(dx + 2 + i * 1.5, dz + 2));
        });
        s.canaa.abrirPorteira('porteiraLo', true);
        r.lo?.seguirLider(lo, 3);
        c.memoria('naoHajaContenda');
        c.armadura('calcado');
        c.versiculo('Mt 5:9');
        try {
          await c.esperar(8);
          c.versiculo('2Co 5:7');
          await c.esperar(4);
        } finally {
          s.canaa.abrirPorteira('porteiraLo', false);
          for (const id of ['lo', ...IDS_PASTORES_LO]) presenca(c.mundo as MundoBase, s, id, false);
          await removerRebanhoLo();
        }
      },
    },
    {
      id: 'percorrer',
      objetivo: 'Caminhe pela terra (0/4 mirantes).',
      async executar(c) {
        marcar(c, 'b2Percorrer'); // o segredo do pó da terra fica ativo
        if (!feito(c, 'b2Promessa')) {
          await c.cena(() => vozDeDeus(c, [
            deus('Gn 13:14', 'Eleva agora os teus olhos, e olha do lugar em que estás para o norte, e para o sul, e para o leste, e para o oeste.'),
            deus('Gn 13:15'),
            deus('Gn 13:16'),
            deus('Gn 13:17'),
          ]));
          marcar(c, 'b2Promessa');
        }
        const ok = (id: string) => feito(c, `b2_${id}`);
        if (!MIRANTES.every(ok)) {
          const objetivo = () =>
            c.objetivo(`Caminhe pela terra (${MIRANTES.filter(ok).length}/4 mirantes).`, MIRANTES.filter((id) => !ok(id)));
          objetivo();
          const ajustes: Record<string, AjusteInterativo> = {};
          for (const id of MIRANTES) ajustes[id] = { ativo: () => !ok(id) };
          await comEtapa(c, 'b2.percorrer', ajustes, async (reg) => {
            for (const id of MIRANTES) if (ok(id)) reg.tirar(id);
            while (!MIRANTES.every(ok)) {
              const { id, personagem: p } = await interacaoEntre(c, MIRANTES.filter((x) => !ok(x)));
              if (p.id !== 'abraao') {
                c.dica('Foi a Abrão que Deus mandou caminhar pela terra.');
                continue;
              }
              marcar(c, `b2_${id}`);
              reg.tirar(id);
              c.contador('mirantes', MIRANTES.filter(ok).length);
              c.xp(p.id, 'segredo', 15);
              c.treinar(p.id, 'fe', 0.25);
              // a vista: do alto do mirante, para fora (a terra prometida)
              await c.cena(async () => {
                const m = lugar(c, id);
                const fora = new THREE.Vector3(m.x, 0, m.z).normalize().multiplyScalar(60);
                await c.camera(m.clone().add(new THREE.Vector3(0, 5, 0)), m.clone().add(fora).add(new THREE.Vector3(0, -6, 0)), 2.5);
                await c.esperar(1.5);
                await c.cameraVoltar(1.5);
              });
              objetivo();
            }
          });
        }
        c.memoria('percorreATerra');
      },
    },
    {
      id: 'manre',
      objetivo: 'Mude a tenda para os carvalhais de Manre.',
      async executar(c) {
        const s = sv();
        if (!feito(c, FLAG_MANRE)) {
          c.objetivo('Mude a tenda para os carvalhais de Manre.', ['acampamentoManre']);
          await c.chegar('ativo', 'acampamentoManre', 30);
          await c.cena(async () => {
            await c.fade(true, 0.8);
            await removerRebanhos();
            mudarAcampamento(c, 'manre');
            marcar(c, FLAG_MANRE);
            const t = lugar(c, 'acampamentoManre');
            ['abraao', 'sara', 'eliezer', ...IDS_SERVOS, 'pastorAbrao1', 'pastorAbrao2'].forEach((id, i) => aproximarSeLonge(c, id, t, 30, i));
            await c.fade(false, 0.8);
          });
          voltarRotinas(c, ['sara', 'eliezer', ...IDS_SERVOS, 'pastorAbrao1', 'pastorAbrao2']);
        } else {
          mudarAcampamento(c, 'manre');
          await removerRebanhos();
        }
        if (!feito(c, 'b2AltarManre')) {
          c.objetivo(`${nome(c, 'abraao')}: construa um altar ao Senhor em Manre.`, ['altarManre']);
          const p = await comEtapa(c, 'b2.manre', {}, () => interacaoDe(c, 'altarManre', 'abraao', 'Quem constrói o altar é Abrão.'));
          definirAltar(c, 'altarManre', 'aceso');
          s.audio.efeito('fogo');
          c.xp(p.id, 'construir');
          marcar(c, 'b2AltarManre');
        }
        await c.dialogo([narrador('Gn 13:18')]);
      },
    },
  ],
};

// ------------------------------------------------------------------------------ B3

/** Põe a noite de Dã (hora 22, relógio parado). */
function noiteDeDa(c: CtxMissao) {
  const s = sv();
  s.ceu.hora = 22;
  s.ceu.pausado = true;
  marcar(c, 'b3Noite');
  s.canaa.definirAcampamentoInimigo(true);
  marcar(c, 'inimigoVisivel');
  figurantesDeB3(c, true);
}

/** Os cativos sentados no cercado; Ló é o quinto. */
function garantirCativos(c: CtxMissao) {
  const s = sv();
  CATIVOS_B3.forEach((id, i) => {
    if (feito(c, `b3_cativo${i + 1}`)) return;
    garantirNPC(c, id, `cativo${i + 1}`, Math.PI, 3);
    esperarAli(c, [id]);
    pose(c, id, 'sentado');
  });
  if (!feito(c, 'b3_cativo5')) {
    presenca(c.mundo as MundoBase, s, 'lo', true, lugar(c, 'cativo5'));
    c.disponivel('lo', false);
    esperarAli(c, ['lo']);
    pose(c, 'lo', 'sentado');
  }
}

/**
 * Os figurantes de B3 longe de Manre: os servos, os aliados amorreus, os cativos de Sodoma e os
 * guerreiros do oriente.
 */
export const FIGURANTES_B3 = [...IDS_SERVOS, ...IDS_ALIADOS, ...CATIVOS_B3, ...INIMIGOS_B3];
/** Distância (m) em que os figurantes de B3 passam ao corpo de longe (o padrão é `Humano.distanciaLonge`). */
export const LOD_FIGURANTES_B3 = 6;

function ajustarFigurante(p: Personagem | undefined, ligado: boolean) {
  if (!p) return;
  p.humano.distanciaLongePropria = ligado ? LOD_FIGURANTES_B3 : null;
  p.humano.malha.castShadow = !ligado;
}

/**
 * Orçamento de B3: na batalha de Dã e com Abrão no meio do povo em Savé, os corpos passavam de
 * 150 draw calls ou de 600 mil triângulos no preset médio. Da noite de Dã ao fim de Savé, os
 * figurantes trocam de corpo mais cedo e não projetam sombra; os jogáveis, Melquisedeque e o rei
 * de Sodoma ficam como estão. Fica na flag para o carregar e para quem `garantirNPC` cria depois.
 */
function figurantesDeB3(c: CtxMissao, ligado: boolean) {
  marcar(c, 'figurantesB3', ligado);
  for (const id of FIGURANTES_B3) ajustarFigurante(pessoa(c, id), ligado);
}

const ROTA_FLANCO_DE: Record<'abraao' | 'eliezer', string> = { abraao: 'flancoOeste', eliezer: 'flancoLeste' };

const B3: DefMissao = {
  id: 'b3', era: ERA, titulo: 'Trezentos e dezoito', tipos: ['fisico', 'batalha', 'cooperativo'],
  resumo: 'Ló é levado cativo. Abrão arma os seus servos, divide-se contra os reis à noite e traz de volta o seu irmão. Melquisedeque o abençoa, e Abrão não aceita nem um fio de Sodoma.',
  refs: ['Gn 14:12-24', 'Hb 7:1-3', 'Mt 6:21'],
  recompensa: { xp: 100 },
  proxima: 'b4',
  etapas: [
    {
      id: 'noticia',
      objetivo: '',
      async executar(c) {
        const s = sv();
        aplicarElenco(c, 'b3');
        if (feito(c, 'b3EmDa')) {
          noiteDeDa(c);
          return;
        }
        mudarAcampamento(c, 'manre');
        if (!feito(c, 'b3Noticia')) {
          s.ceu.hora = 15;
          const tenda = lugar(c, 'tendaAbrao');
          aproximarSeLonge(c, 'abraao', tenda, 30);
          aproximarSeLonge(c, 'eliezer', tenda, 30, 2);
          garantirNPC(c, 'fugitivo', 'chegadaFugitivo', -Math.PI / 2, 60);
          await c.cena(async () => {
            const ab = c.personagem('abraao').posicao;
            await c.camera(ab.clone().add(new THREE.Vector3(6, 3, 6)), ab.clone().add(new THREE.Vector3(0, 1.4, 0)), 1.5);
            await c.mover('fugitivo', anel(ab.clone().add(new THREE.Vector3(1.8, 0, 1.8)), 0), 4.8);
            await c.dialogo([
              narrador('Gn 14:12'),
              narrador('Gn 14:13'),
              ficcao('fugitivo', 'Ló foi levado! Os reis do oriente levaram tudo de Sodoma!', 'preocupado'),
              narrador('Gn 14:14'),
            ]);
            // os servos treinados se reúnem; Aner, Escol e Manre vêm com os seus
            await c.fade(true, 0.8);
            const reuniao = lugar(c, 'reuniaoServos');
            ['abraao', 'eliezer', ...IDS_SERVOS, ...IDS_ALIADOS].forEach((id, i) => aproximarSeLonge(c, id, reuniao, 3, i));
            esperarAli(c, [...IDS_SERVOS, ...IDS_ALIADOS, 'eliezer', 'fugitivo']);
            await c.camera(reuniao.clone().add(new THREE.Vector3(-8, 5, 9)), reuniao.clone().add(new THREE.Vector3(0, 1.2, 0)), 0);
            await c.fade(false, 0.8);
            await c.dialogo([ficcao('eliezer', 'Os servos estão armados, senhor. Aner, Escol e Manre vêm conosco.', 'firme')]);
            await c.cameraVoltar(1);
          });
          marcar(c, 'b3Noticia');
        }
        // até Dã, à noite
        await c.cena(async () => {
          await c.fade(true, 1.2);
          noiteDeDa(c);
          const da = lugar(c, 'da');
          ['abraao', 'eliezer', ...IDS_SERVOS, ...IDS_ALIADOS].forEach((id, i) => {
            const p = pessoa(c, id);
            if (!p) return;
            const v = anel(da, i, 2.2);
            p.teleportar(v.x, c.mundo.chao(v.x, v.z) + 0.05, v.z, Math.PI);
          });
          esperarAli(c, [...IDS_SERVOS, ...IDS_ALIADOS, 'eliezer']);
          tirarNPC(c, 'fugitivo');
          controlarSe(c, 'abraao');
          s.audio.musica('silencio');
          s.audio.ambiente('noite', 0.7);
          await c.titulo('Até Dã, à noite');
          await c.fade(false, 1.2);
        });
        marcar(c, 'b3EmDa');
      },
    },
    {
      id: 'dividir',
      objetivo: 'Dividam-se: Abrão e Eliézer, cada um com seus servos, até os flancos.',
      async executar(c) {
        const s = sv();
        noiteDeDa(c);
        garantirCativos(c);
        if (feito(c, 'b3Sinal')) return;
        await c.dialogo([narrador('Gn 14:15', 'E ele se dividiu contra eles, ele e seus servos, à noite,')]);
        c.dica('Troque entre Abrão e Eliézer (Tab) para levar cada grupo. Agache (Ctrl) e fique longe da luz das tochas.');
        // as sentinelas rondam com tochas
        const sentinelas: SentinelaRonda[] = SENTINELAS_B3.map((id, i) => {
          const rota = ROTAS_SENTINELAS[id].map((p) => [p[0], p[1]] as Ponto2);
          const fecha = rota.length > 2 && rota[0][0] === rota[rota.length - 1][0] && rota[0][1] === rota[rota.length - 1][1];
          if (fecha) rota.pop();
          const p = garantirNPC(c, id, id, 0, 40);
          return { p, rota, laco: fecha, fase: i * 1.3 };
        });
        // dois grupos, cada um com o seu caminho coberto até o flanco
        const grupos: GrupoFurtivo[] = (['abraao', 'eliezer'] as const).map((lider) => {
          const rota = ROTAS_FLANCO[ROTA_FLANCO_DE[lider]].map((p) => [p[0], p[1]] as Ponto2);
          const l = c.personagem(lider);
          // ao recomeçar a etapa longe do caminho, volta ao começo dele
          if (Math.min(...rota.map((p) => Math.hypot(l.posicao.x - p[0], l.posicao.z - p[1]))) > 30) aproximarSeLonge(c, lider, lugar(c, 'da'), 4);
          const seguidores = GRUPOS_B3[lider].map((id) => pessoa(c, id)).filter((p): p is Personagem => !!p);
          for (const p of seguidores) {
            aproximarSeLonge(c, p.id, l.posicao, 12, seguidores.indexOf(p) + 1);
            p.ia.seguir(l, 1.6);
          }
          return { lider: l, seguidores, rota, seguro: 0, imune: 0 };
        });
        // o grupo de Aner, Escol e Manre vai sozinho para o flanco sul
        const [sx, sz] = ponto2(c.mundo as MundoBase, 'flancoSul');
        IDS_ALIADOS.forEach((id, i) => {
          const p = pessoa(c, id);
          if (p) soltar(p.ia.irPara(sx + (i - 1) * 1.6, sz + 1));
        });
        const chao = (x: number, z: number) => c.mundo.chao(x, z);
        const f = new Furtividade(sentinelas, grupos, chao, () => {
          c.aviso('Fomos vistos! Recuem.');
          s.audio.efeito('alarme');
        });
        f.iniciar();
        mecanica = { nome: 'furtividade', resolverAutomaticamente: () => f.resolverAutomaticamente() };
        let sinal = false;
        let fase = -1;
        const ajustes: Record<string, AjusteInterativo> = {
          sinal: {
            ativo: () => f.todosNosFlancos,
            aoInteragir: (p) => {
              if (p.id === 'abraao' && f.todosNosFlancos) sinal = true;
              else c.dica('Quem dá o sinal é Abrão, com os dois grupos nos flancos.');
            },
          },
        };
        try {
          await comEtapa(c, 'b3.dividir', ajustes, () => comQuadro((dt) => f.atualizar(dt), async () => {
            while (!sinal) {
              const nf = f.todosNosFlancos ? 1 : 0;
              if (nf !== fase) {
                fase = nf;
                if (nf) c.objetivo(`Os dois grupos estão nos flancos. ${nome(c, 'abraao')}: dê o sinal (E).`, [{ personagem: 'abraao' }]);
                else c.objetivo('Abrão ao flanco oeste e Eliézer ao flanco leste, sem entrar na luz das tochas.', ['flancoOeste', 'flancoLeste']);
              }
              await c.esperar(0.2);
            }
          }));
        } finally {
          f.parar();
          mecanica = null;
        }
        marcar(c, 'b3Sinal');
        c.xp('abraao', 'cooperacao');
        c.xp('eliezer', 'cooperacao');
        c.treinar('abraao', 'discernimento', 0.5);
        c.treinar('eliezer', 'coragem', 0.5);
      },
    },
    {
      id: 'ataque',
      objetivo: 'Os inimigos acordam! Apare (botão direito) e golpeie com o cajado (clique).',
      async executar(c) {
        const s = sv();
        noiteDeDa(c);
        garantirCativos(c);
        if (feito(c, 'b3Batalha')) {
          for (const id of INIMIGOS_B3) tirarNPC(c, id);
          return;
        }
        const acamp = lugar(c, 'acampamentoInimigo');
        const inimigos = INIMIGOS_B3.map((id, i) => garantirNPC(c, id, id.startsWith('sentinela') ? id : anel(acamp, i + 1, 3), 0, 60));
        for (const id of ['abraao', 'eliezer'] as const) aproximarSeLonge(c, id, lugar(c, ROTA_FLANCO_DE[id]), 40);
        await c.cena(async () => {
          await c.camera(acamp.clone().add(new THREE.Vector3(0, 12, 22)), acamp.clone().add(new THREE.Vector3(0, 1, 0)), 1.5);
          s.audio.efeito('alarme');
          await c.dialogo([ficcao('narrador', 'O sinal ecoa na noite. O acampamento acorda confuso, e os guerreiros do oriente pegam as armas.')]);
          await c.cameraVoltar(1);
        });
        s.audio.musica('batalha');
        const b = new Batalha({
          inimigos,
          aliados: [c.personagem('abraao'), c.personagem('eliezer')],
          entrada: s.entrada,
          fuga: ponto2(c.mundo as MundoBase, 'fugaInimigos'),
          aoSair: (p) => tirarNPC(c, p.id),
          aoGolpe: (_alvo, aparado) => {
            if (!aparado) s.camera.tremer(0.25, 0.2);
            s.audio.efeito(aparado ? 'aparar' : 'golpe');
          },
        });
        b.iniciar();
        c.dica('Botão direito apara o golpe; clique golpeia com o cajado. Desarmado, o inimigo foge. Abrão pode usar Q (discernir) para ver de onde vem o próximo golpe.');
        mecanica = { nome: 'batalha', resolverAutomaticamente: () => b.resolverAutomaticamente() };
        const quadro = (dt: number) => {
          if (discerniu(c)) {
            b.discernir();
            c.aviso('Discernimento: os golpes ficam lentos e você vê de onde vem o próximo.');
          }
          b.atualizar(dt);
        };
        try {
          await comQuadro(quadro, async () => {
            let texto = '';
            let marcado: Personagem | null = null;
            while (!b.terminou) {
              const prox = b.discernindo ? b.proximoAtacante() : null;
              const novo = `Desarme os guerreiros do oriente (${b.desarmados}/${inimigos.length}).`;
              if (novo !== texto || prox !== marcado) {
                texto = novo;
                marcado = prox;
                c.contador('desarmados', b.desarmados);
                c.objetivo(novo, prox ? [{ personagem: prox.id }] : ['acampamentoInimigo']);
              }
              await c.esperar(0.2);
            }
            // os que fugiram para o norte saem de cena (Gn 14:15, "os perseguiu")
            for (let t = 0; t < 8 && !b.encerrada; t += 0.25) await c.esperar(0.25);
          });
        } finally {
          b.parar();
          mecanica = null;
          for (const id of INIMIGOS_B3) tirarNPC(c, id);
          s.audio.musica('calmo');
        }
        marcar(c, 'b3Batalha');
        c.xp('abraao', 'batalha');
        c.xp('eliezer', 'batalha');
        c.treinar('eliezer', 'forca', 0.6);
        c.treinar('eliezer', 'coragem', 0.4);
        c.treinar('abraao', 'coragem', 0.5);
      },
    },
    {
      id: 'libertar',
      objetivo: 'Solte os cativos (0/5).',
      async executar(c) {
        noiteDeDa(c);
        const ids = lista('cativo', 5);
        const ok = (id: string) => feito(c, `b3_${id}`);
        if (!ok('cativo5')) {
          garantirCativos(c);
          const objetivo = () =>
            c.objetivo(`Solte os cativos (${ids.filter(ok).length}/5).`, ids.filter((id) => !ok(id)).map((id) => id as Alvo));
          objetivo();
          c.dica('Solte as cordas (segure E). Ló está entre eles.');
          const ajustes: Record<string, AjusteInterativo> = {};
          for (const id of ids) ajustes[id] = { ativo: () => !ok(id) && (id !== 'cativo5' || ids.slice(0, 4).every(ok)) };
          await comEtapa(c, 'b3.libertar', ajustes, async (reg) => {
            for (const id of ids) if (ok(id)) reg.tirar(id);
            while (!ok('cativo5')) {
              const { id, personagem: p } = await interacaoEntre(c, ids.filter((x) => !ok(x)));
              if (id === 'cativo5' && p.id !== 'abraao') {
                c.dica('Abrão quer soltar Ló com as próprias mãos.');
                continue;
              }
              marcar(c, `b3_${id}`);
              reg.tirar(id);
              c.xp(p.id, 'servir');
              c.treinar(p.id, 'compaixao', 0.3);
              const quem = id === 'cativo5' ? 'lo' : CATIVOS_B3[Number(id.slice(-1)) - 1];
              pose(c, quem, null);
              objetivo();
            }
          });
        }
        await c.cena(async () => {
          const ab = c.personagem('abraao').posicao;
          aproximarSeLonge(c, 'lo', ab, 4, 1);
          pose(c, 'lo', null);
          await c.camera(ab.clone().add(new THREE.Vector3(3, 2.2, 3.5)), ab.clone().add(new THREE.Vector3(0, 1.5, 0)), 1.2);
          await c.dialogo([
            ficcao('lo', 'Tio… depois de tudo, você veio por mim?', 'triste'),
            ficcao('abraao', 'Somos irmãos, Ló. Sempre fomos.', 'firme'),
            narrador('Gn 14:16'),
          ]);
          await c.cameraVoltar(1);
        });
        c.memoria('resgate');
        c.unidade(15);
        seguirLider(c, ['lo', ...CATIVOS_B3, ...IDS_SERVOS], 'abraao', 3);
      },
    },
    {
      id: 'melquisedeque',
      objetivo: 'Volte com os resgatados ao vale de Savé.',
      async executar(c) {
        const s = sv();
        const save = lugar(c, 'save');
        if (!feito(c, 'b3EmSave')) {
          await c.cena(async () => {
            await c.fade(true, 1.2);
            s.canaa.definirAcampamentoInimigo(false);
            marcar(c, 'inimigoVisivel', false);
            s.ceu.pausado = false;
            marcar(c, 'b3Noite', false);
            s.ceu.hora = 9;
            s.audio.ambiente('noite', 0);
            // os bens de Sodoma trazidos de volta (Gn 14:16)
            mostrarDespojos(c, true);
            marcar(c, 'b3EmSave');
            await c.fade(false, 0.1);
            await c.fade(true, 0);
          });
        }
        // todos no vale do rei: Abrão e os seus, Ló e o povo resgatado, o rei de Sodoma e Melquisedeque
        ['abraao', 'eliezer', ...IDS_SERVOS, ...IDS_ALIADOS].forEach((id, i) => aproximarSeLonge(c, id, save, 14, i));
        for (const id of CATIVOS_B3) garantirNPC(c, id, anel(save.clone().add(new THREE.Vector3(5, 0, 3)), CATIVOS_B3.indexOf(id), 1.6), 0, 14);
        figurantesDeB3(c, true);
        presenca(c.mundo as MundoBase, s, 'lo', true, save.clone().add(new THREE.Vector3(3, 0, -2)));
        c.disponivel('lo', false);
        aproximarSeLonge(c, 'reiSodoma', lugar(c, 'chegadaSodoma'), 30);
        aproximarSeLonge(c, 'melquisedeque', lugar(c, 'melquisedeque'), 30);
        esperarAli(c, ['eliezer', 'lo', 'reiSodoma', 'melquisedeque', ...CATIVOS_B3, ...IDS_SERVOS, ...IDS_ALIADOS]);
        c.personagem('melquisedeque').carregar('pao');
        if (!feito(c, 'b3Bencao')) {
          await c.cena(async () => {
            await c.camera(save.clone().add(new THREE.Vector3(-10, 6, 12)), save.clone().add(new THREE.Vector3(0, 1.5, 0)), 0);
            await c.fade(false, 1.2);
            await c.dialogo([narrador('Gn 14:17')]);
            soltar(c.mover('reiSodoma', save.clone().add(new THREE.Vector3(6, 0, 4))));
            await c.dialogo([narrador('Gn 14:18')]);
            const ab = c.personagem('abraao').posicao;
            await c.mover('melquisedeque', anel(ab.clone().add(new THREE.Vector3(1.6, 0, 1.6)), 0));
            await c.camera(ab.clone().add(new THREE.Vector3(-3, 2.2, 4)), ab.clone().add(new THREE.Vector3(1, 1.6, 1)), 1.5);
            await c.dialogo([
              melquisedequeDiz('Gn 14:19', 'Bendito seja Abrão do Deus Altíssimo, criador do céu e da terra.'),
              melquisedequeDiz('Gn 14:20', 'E bendito seja o Deus Altíssimo, que entregou teus inimigos em tuas mãos.'),
            ]);
            await c.cameraVoltar(1);
          });
          marcar(c, 'b3Bencao');
        } else await c.fade(false, 0.6);
        if (!feito(c, 'b3Dizimo')) {
          c.objetivo(`${nome(c, 'abraao')}: entregue a Melquisedeque a décima parte dos despojos.`, ['dizimo']);
          await comEtapa(c, 'b3.melquisedeque', {}, () => interacaoDe(c, 'dizimo', 'abraao', 'Quem entrega o dízimo é Abrão.'));
          c.treinar('abraao', 'humildade', 0.5);
          marcar(c, 'b3Dizimo');
        }
        await c.dialogo([narrador('Gn 14:20', 'E lhe deu dízimos de tudo.')]);
        c.personagem('melquisedeque').carregar(null);
        c.memoria('melquisedeque');
        s.cristo('melquisedeque');
      },
    },
    {
      id: 'nemUmFio',
      objetivo: '',
      async executar(c) {
        const s = sv();
        figurantesDeB3(c, true);
        if (!feito(c, 'b3NemUmFio')) {
          const ab = c.personagem('abraao').posicao;
          aproximarSeLonge(c, 'reiSodoma', ab, 4, 2);
          controlarSe(c, 'abraao');
          // Não amar as riquezas (ensinamento 15): os despojos brilham e o brilho desbota sozinho
          // conforme o jogador se afasta. Nada prende o jogador ali: a recusa é a prova.
          mostrarDespojos(c, true, true);
          await c.dialogo([reiSodomaDiz('Gn 14:21', 'Dá-me as pessoas, e toma os bens para ti.')]);
          // a resposta de Abrão (Gn 14:22) é a Palavra que vence a cobiça
          c.receberVersiculo('Gn 14:22-23');
          c.receberVersiculo('Gn 13:8');
          c.receberVersiculo('Gn 12:2');
          c.dica('Pressione Q: "Está escrito".');
          s.audio.musica('prova');
          await c.prova(PROVA_TENTACAO_B3);
          s.audio.musica('calmo');
          // a recusa vale XP.prova (60, "resistir a uma tentação" no DESIGN §6): mais que qualquer achado
          c.xp('abraao', 'prova');
          c.treinar('abraao', 'dominio', 0.6);
          c.treinar('abraao', 'humildade', 0.4);
          await c.dialogo([
            abraaoDiz('Gn 14:22', 'Eu levanto a minha mão ao Senhor, o Deus Altíssimo, o possuidor do céu e da terra,'),
            abraaoDiz('Gn 14:23'),
            abraaoDiz('Gn 14:24'),
          ]);
          c.memoria('nemUmFio');
          c.versiculo('Mt 6:21');
          marcar(c, 'b3NemUmFio');
        }
        // Ló volta a Sodoma com o rei e o povo (Gn 14:12 conta que ele habitava lá)
        c.disponivel('lo', false);
        const [qx, qz] = ponto2(c.mundo as MundoBase, 'chegadaSodoma');
        ['lo', 'reiSodoma', ...CATIVOS_B3].forEach((id, i) => {
          const p = pessoa(c, id);
          if (p && !p.controlado) soltar(p.ia.irPara(qx + (i % 3) * 1.5, qz + Math.floor(i / 3) * 1.5));
        });
        try {
          await c.esperar(6);
        } finally {
          presenca(c.mundo as MundoBase, s, 'lo', false);
          for (const id of CATIVOS_B3) tirarNPC(c, id);
          figurantesDeB3(c, false);
          aproximarSeLonge(c, 'reiSodoma', lugar(c, 'sodomaLonge'), 10);
          aproximarSeLonge(c, 'melquisedeque', lugar(c, 'salem'), 10);
          IDS_ALIADOS.forEach((id, i) => aproximarSeLonge(c, id, lugar(c, 'aliadosManre'), 10, i));
          voltarRotinas(c, ['reiSodoma', 'melquisedeque', 'eliezer', ...IDS_ALIADOS, ...IDS_SERVOS]);
        }
      },
    },
  ],
};

// ------------------------------------------------------------------------------ B4

const B4: DefMissao = {
  id: 'b4', era: ERA, titulo: 'Conta as estrelas', tipos: ['espiritual'],
  resumo: 'Numa noite em Manre, Abrão pergunta pelo herdeiro. Deus o leva para fora da tenda e mostra as estrelas: assim será a tua semente. E Abrão creu.',
  refs: ['Gn 15:1-6', 'Rm 4:3', 'Hb 11:1'],
  recompensa: { xp: 100 },
  proxima: 'b5',
  etapas: [
    {
      id: 'visao',
      objetivo: '',
      async executar(c) {
        const s = sv();
        aplicarElenco(c, 'b4');
        mudarAcampamento(c, 'manre');
        if (feito(c, 'b4Visao')) {
          mostrarDespojos(c, false);
          s.ceu.hora = 21.5;
          s.ceu.pausado = true;
          return;
        }
        await c.cena(async () => {
          await c.fade(true, 1);
          // o rei de Sodoma levou os seus bens (Gn 14:24)
          mostrarDespojos(c, false);
          s.ceu.hora = 21.5;
          s.ceu.pausado = true;
          marcar(c, 'b4Noite');
          const tenda = lugar(c, 'tendaAbrao');
          aproximarSeLonge(c, 'abraao', tenda, 4);
          controlarSe(c, 'abraao');
          voltarRotinas(c, ['sara', 'eliezer', ...IDS_SERVOS]);
          s.audio.musica('silencio');
          s.audio.ambiente('noite', 0.6);
          const ab = c.personagem('abraao').posicao;
          await c.camera(ab.clone().add(new THREE.Vector3(4, 2.4, 5)), ab.clone().add(new THREE.Vector3(0, 1.5, 0)), 0);
          await c.fade(false, 1.5);
          await vozDeDeus(c, [deus('Gn 15:1', 'Não temas, Abrão; eu sou o teu escudo, e a tua recompensa será infinitamente grande.')], 0.4);
          c.armadura('escudo');
          c.aviso('Escudo da fé: segure o botão direito para apagar os dardos.');
          await c.dialogo([
            abraaoDiz('Gn 15:2', 'Senhor Deus, o que me darás, visto que ando sem filhos, e o mordomo da minha casa é Eliézer de Damasco?'),
            abraaoDiz('Gn 15:3', 'Eis que não me deste semente, e eis que um nascido na minha casa é meu herdeiro.'),
          ]);
          await vozDeDeus(c, [deus('Gn 15:4', 'Este não será teu herdeiro, mas o que sairá de tuas próprias entranhas será teu herdeiro.')], 0.4);
          await c.cameraVoltar(1.2);
        });
        marcar(c, 'b4Visao');
      },
    },
    {
      id: 'fora',
      objetivo: 'Saia da tenda (Gn 15:5).',
      async executar(c) {
        c.objetivo('Saia da tenda (Gn 15:5).', ['ceuEstrelas']);
        if (ativoOu(c)?.id !== 'abraao') c.dica('Deus chamou Abrão para fora. Troque para ele.');
        await c.chegar('abraao', 'ceuEstrelas', 4);
      },
    },
    {
      id: 'duvida',
      objetivo: 'Olhe para o céu.',
      async executar(c) {
        const s = sv();
        if (feito(c, 'b4Duvida')) return;
        controlarSe(c, 'abraao');
        const ab = c.personagem('abraao').posicao;
        // a câmera se inclina para o céu, com a névoa escura das mentiras
        await c.camera(ab.clone().add(new THREE.Vector3(1.5, 1.2, -2)), ab.clone().add(new THREE.Vector3(-8, 40, 30)), 2);
        s.audio.musica('prova');
        await c.prova(PROVA_DUVIDA_B4);
        s.audio.musica('gloria');
        await c.dialogo([deus('Gn 15:5', 'Olha agora para o céu, e conta as estrelas, se tu fores capaz de contá-las;')]);
        await animarCeu(c, 'estrelas', 1, 3);
        marcar(c, 'b4Estrelas');
        await c.dialogo([deus('Gn 15:5', 'Assim será a tua semente.')]);
        c.xp('abraao', 'prova');
        c.treinar('abraao', 'fe', 0.8);
        await c.cameraVoltar(2);
        marcar(c, 'b4Duvida');
      },
    },
    {
      id: 'creu',
      objetivo: '',
      async executar(c) {
        const s = sv();
        await c.dialogo([narrador('Gn 15:6')]);
        c.armadura('couraca');
        c.memoria('estrelas');
        s.cristo('justica');
        c.versiculo('Rm 4:3');
        await c.esperar(6);
        c.versiculo('Hb 11:1');
        await animarCeu(c, 'estrelas', 0, 3);
        marcar(c, 'b4Estrelas', false);
        s.ceu.pausado = false;
        marcar(c, 'b4Noite', false);
        s.audio.musica('calmo');
      },
    },
  ],
};

// ------------------------------------------------------------------------------ B5

/** Isaque leva o feixe de lenha; Abraão, o fogo (Gn 22:6). */
function carga(c: CtxMissao, sim: boolean) {
  const i = pessoa(c, 'isaque');
  const a = pessoa(c, 'abraao');
  if (i) i.carregar(sim ? 'feixe' : null);
  if (a) a.humano.segurar(sim ? 'fogo' : null, 'esquerda');
}

/** Abraão sobe pela corda que Isaque amarrou ("escalada liberada para todos"). */
function liberarEscalada(c: CtxMissao, sim: boolean) {
  const a = pessoa(c, 'abraao');
  if (!a) return;
  const i = a.aprendidos.indexOf('escalar');
  if (sim && i < 0) a.aprendidos.push('escalar');
  if (!sim && i >= 0) a.aprendidos.splice(i, 1);
}

const B5: DefMissao = {
  id: 'b5', era: ERA, titulo: 'O Senhor proverá', tipos: ['masmorra', 'cooperativo', 'espiritual'],
  resumo: 'Isaque, o filho da promessa, nasce. Anos depois, Deus prova Abraão: pai e filho sobem juntos o monte Moriá, e lá o Senhor provê o carneiro.',
  refs: ['Gn 17:5', 'Gn 17:15', 'Gn 21:1-6', 'Gn 22:1-19', 'Hb 11:17-19'],
  recompensa: { xp: 100 },
  etapas: [
    {
      id: 'nomes',
      objetivo: '',
      async executar(c) {
        const s = sv();
        aplicarElenco(c, 'b5');
        mudarAcampamento(c, 'manre');
        if (feito(c, 'b5Nomes')) return;
        await c.cena(async () => {
          await c.fade(true, 1);
          s.ceu.pausado = false;
          s.ceu.hora = 10;
          const tenda = lugar(c, 'tendaAbrao');
          aproximarSeLonge(c, 'abraao', tenda, 4);
          aproximarSeLonge(c, 'sara', tenda, 6, 2);
          controlarSe(c, 'abraao');
          esperarAli(c, ['sara']);
          await c.titulo('Anos depois…');
          const ab = c.personagem('abraao').posicao;
          await c.camera(ab.clone().add(new THREE.Vector3(5, 2.6, 5)), ab.clone().add(new THREE.Vector3(0, 1.5, 0)), 0);
          await c.fade(false, 1.2);
          await vozDeDeus(c, [deus('Gn 17:5', 'O teu nome não se chamará mais Abrão, mas teu nome será Abraão, pois pai de muitas nações eu te fiz.')]);
          c.definirFlag(FLAG_NOME_ABRAAO);
          await vozDeDeus(c, [deus('Gn 17:15', 'Quanto a Sarai, tua mulher, não chamarás seu nome Sarai, mas Sara será seu nome.')]);
          c.definirFlag(FLAG_NOME_SARA);
          await c.dialogo([narrador('Gn 21:1'), narrador('Gn 21:2'), narrador('Gn 21:3')]);
          // o filho da promessa
          marcar(c, FLAG_ISAQUE);
          presenca(c.mundo as MundoBase, s, 'isaque', true, lugar(c, 'tendaSara'));
          c.disponivel('isaque', true);
          esperarAli(c, ['isaque']);
          await c.camera(tenda.clone().add(new THREE.Vector3(-4, 2.4, 6)), lugar(c, 'tendaSara').add(new THREE.Vector3(0, 1.4, 0)), 1.5);
          await c.dialogo([saraDiz('Gn 21:6', 'Deus me fez rir, de modo que todos os que ouvirem rirão comigo.')]);
          await c.cameraVoltar(1.2);
        });
        c.dica('Isaque é batedor: escala e amarra cordas. Neste capítulo, Sara e Eliézer ficam no acampamento.');
        marcar(c, 'b5Nomes');
      },
    },
    {
      id: 'prova',
      objetivo: '',
      async executar(c) {
        const s = sv();
        if (!feito(c, 'b5Prova')) {
          await c.cena(async () => {
            await c.dialogo([narrador('Gn 22:1', 'E aconteceu depois destas coisas, que Deus tentou Abraão, e lhe disse:')]);
            await vozDeDeus(c, [deus('Gn 22:1', 'Abraão;')], 0.35);
            await c.dialogo([abraaoDiz('Gn 22:1', 'Eis-me aqui.')]);
            await vozDeDeus(c, [deus('Gn 22:2', 'Toma agora o teu filho, teu único filho Isaque, a quem tu amas, e vai para a terra de Moriá, e oferece-o ali como oferta queimada sobre um dos montes que eu te direi.')], 0.4);
            await c.dialogo([narrador('Gn 22:3')]);
          });
          marcar(c, 'b5Prova');
        }
        const servos = lugar(c, 'servosMoria');
        if (!feito(c, 'b5TerceiroDia')) {
          await c.cena(async () => {
            await c.fade(true, 1.5);
            s.audio.musica('silencio');
            await c.titulo('No terceiro dia');
            s.ceu.hora = 7;
            ['abraao', 'isaque', ...SERVOS_MORIA].forEach((id, i) => {
              const p = pessoa(c, id);
              if (!p) return;
              const v = anel(servos, i, 2);
              p.teleportar(v.x, c.mundo.chao(v.x, v.z) + 0.05, v.z, Math.PI);
            });
            esperarAli(c, SERVOS_MORIA);
            controlarSe(c, 'abraao');
            await criarAnimal('jumento', 'jumento', servos.x - 2.5, servos.z - 1.5);
            const topo = lugar(c, 'topoMoria');
            await c.camera(servos.clone().add(new THREE.Vector3(-3, 2.2, -4)), topo.clone().add(new THREE.Vector3(0, 6, 0)), 0);
            await c.fade(false, 1.5);
            await c.dialogo([narrador('Gn 22:4')]);
            await c.cameraVoltar(1.5);
          });
          marcar(c, 'b5TerceiroDia');
        } else await criarAnimal('jumento', 'jumento', servos.x - 2.5, servos.z - 1.5);
      },
    },
    {
      id: 'pe',
      objetivo: 'Vá ao pé do monte Moriá.',
      async executar(c) {
        if (!feito(c, 'b5Pe')) {
          esperarAli(c, SERVOS_MORIA);
          c.objetivo('Vá ao pé do monte Moriá.', ['peMoria']);
          seguirLider(c, ['isaque'], 'abraao', 2.2);
          // raio padrão (3): o pé é plano só ~7 m em volta, e os servos (Gn 22:5) esperam na beira dele
          await c.chegar('abraao', 'peMoria');
          aproximarSeLonge(c, 'isaque', lugar(c, 'peMoria'), 8, 1);
          await c.dialogo([
            abraaoDiz('Gn 22:5', 'Ficai aqui com o jumento, e eu e o menino vamos adiante para adorar, e voltaremos a vós.'),
            narrador('Gn 22:6'),
          ]);
          marcar(c, 'b5Pe');
        }
        carga(c, true);
        c.versiculo('Jo 19:17');
        c.dica('Isaque leva a lenha; Abraão leva o fogo. Subam juntos: não se afastem.');
      },
    },
    {
      id: 'subida',
      objetivo: 'Subam juntos o monte Moriá.',
      async executar(c) {
        const s = sv();
        if (feito(c, 'b5Topo')) return;
        carga(c, true);
        const juntos = new Juntos(c.personagem('abraao'), c.personagem('isaque'), (t) => c.dica(t));
        let revelar = 0;
        const quadro = (dt: number) => {
          juntos.atualizar(dt);
          if (discerniu(c)) {
            revelar = 8;
            s.audio.efeito('discernir');
          }
          if (revelar > 0) {
            revelar = Math.max(0, revelar - dt);
            s.canaa.revelarPedras(Math.min(1, revelar / 2));
          }
        };
        try {
          await comQuadro(quadro, async () => {
            // trecho 1: degraus de rocha; Isaque escala a parede e amarra a corda
            if (!feito(c, 'b5Corda')) {
              c.objetivo('Isaque: suba a parede de rocha e amarre a corda lá em cima.', ['paredeMoria', ID_AMARRAR_CORDA]);
              c.dica('Isaque é batedor: escale a parede baixa (E na base) e amarre a corda no alto.');
              const p = await comEtapa(c, 'b5.subida', {}, () => interacaoDe(c, ID_AMARRAR_CORDA, 'isaque', 'Isaque pode subir a parede e amarrar a corda.'));
              s.canaa.amarrarCordaMoria(true);
              marcar(c, 'cordaAmarrada');
              s.audio.efeito('corda');
              c.treinar(p.id, 'agilidade', 0.5);
              marcar(c, 'b5Corda');
            }
            liberarEscalada(c, true);
            marcar(c, 'b5EscalarLiberado');
            if (!feito(c, 'b5Parede')) {
              c.objetivo('Abraão: suba pela corda que Isaque amarrou.', ['cordaMoria']);
              c.dica('A corda está presa: agora Abraão também pode subir.');
              await c.chegar('abraao', 'cordaMoria', 3);
              aproximarSeLonge(c, 'isaque', lugar(c, 'cordaMoria'), 10, 1);
              c.xp('isaque', 'cooperacao');
              c.xp('abraao', 'cooperacao');
              marcar(c, 'b5Parede');
            }
            // trecho 2: a passagem estreita; discernir revela o caminho firme
            if (!feito(c, 'b5Fosso')) {
              c.objetivo('Atravessem a passagem estreita: só as pedras firmes aguentam.', ['estreitoFim']);
              c.dica('Abraão é profeta: pressione Q (discernir) para revelar o caminho firme. As pedras falsas brilham em vermelho.');
              s.canaa.aoCairFosso = () => {
                c.dica('Pedra solta! Use Q (discernir) para ver o caminho firme.');
                s.audio.efeito('pedra');
              };
              try {
                await c.chegar('ativo', 'estreitoFim', 3);
              } finally {
                s.canaa.aoCairFosso = null;
              }
              const quem = ativoOu(c)?.id === 'isaque' ? 'abraao' : 'isaque';
              aproximarSeLonge(c, quem, lugar(c, 'estreitoFim'), 6, 1); // segue os mesmos passos
              c.treinar('abraao', 'discernimento', 0.6);
              marcar(c, 'b5Fosso');
            }
            // trecho 3: a pergunta, no patamar
            if (!feito(c, 'b5Pergunta')) {
              c.objetivo('Subam juntos até o patamar.', ['patamarMoria']);
              await c.chegar('ativo', 'patamarMoria', 5);
              const pat = lugar(c, 'patamarMoria');
              aproximarSeLonge(c, 'abraao', pat, 6);
              aproximarSeLonge(c, 'isaque', pat, 6, 1);
              await c.cena(async () => {
                const ab = c.personagem('abraao').posicao;
                await c.camera(ab.clone().add(new THREE.Vector3(3.5, 2, 3)), ab.clone().add(new THREE.Vector3(0, 1.4, 0)), 1.5);
                await c.dialogo([
                  isaqueDiz('Gn 22:7', 'Meu pai,'),
                  abraaoDiz('Gn 22:7', 'Aqui estou, meu filho.'),
                  isaqueDiz('Gn 22:7', 'Eis o fogo e a lenha, mas onde está o cordeiro para a oferta queimada?'),
                  abraaoDiz('Gn 22:8', 'Meu filho, Deus proverá para si um cordeiro para a oferta queimada;'),
                  narrador('Gn 22:8', 'então foram os dois juntos.'),
                ]);
                await c.cameraVoltar(1.5);
              });
              marcar(c, 'b5Pergunta');
            }
            // trecho 4: a subida final, com vento e altura
            if (!feito(c, 'b5Medo')) {
              c.objetivo('Subam juntos a encosta final.', ['subidaFinal']);
              await c.chegar('ativo', 'subidaFinal', 5);
              controlarSe(c, 'abraao');
              s.audio.ambiente('vento', 0.8);
              s.audio.musica('prova');
              c.objetivo('Subam até o topo. Ore (R) e fiquem perto um do outro.', ['topoMoria']);
              await c.prova(PROVA_MEDO_B5);
              s.audio.musica('silencio');
              c.xp('abraao', 'prova');
              c.treinar('abraao', 'coragem', 0.6);
              c.treinar('isaque', 'coragem', 0.4);
              marcar(c, 'b5Medo');
            }
            c.objetivo('Chegue ao topo do monte.', ['topoMoria']);
            await c.chegar('abraao', 'topoMoria', 6);
            aproximarSeLonge(c, 'isaque', lugar(c, 'topoMoria'), 8, 1);
          });
        } finally {
          juntos.parar();
          s.canaa.revelarPedras(0);
        }
        marcar(c, 'b5Topo');
      },
    },
    {
      id: 'altar',
      objetivo: 'Abraão: construa o altar no alto do monte.',
      async executar(c) {
        const s = sv();
        liberarEscalada(c, false);
        marcar(c, 'b5Altar');
        esperarAli(c, ['isaque']);
        if (!feito(c, 'b5AltarFeito')) {
          c.objetivo(`${nome(c, 'abraao')}: construa o altar no alto do monte.`, ['altarMoria']);
          await comEtapa(c, 'b5.altar', {}, () => interacaoDe(c, 'altarMoria', 'abraao', 'Quem constrói o altar é Abraão.'));
          definirAltar(c, 'altarMoria', 'construido');
          marcar(c, 'b5AltarFeito');
        }
        if (feito(c, 'b5Provera')) return;
        carga(c, false);
        await c.cena(async () => {
          const altar = lugar(c, 'altarMoria');
          s.audio.musica('silencio');
          // plano aberto, sem close: o lugar, o altar, pai e filho
          await c.camera(altar.clone().add(new THREE.Vector3(14, 7, 12)), altar.clone().add(new THREE.Vector3(0, 1, 0)), 3);
          await c.dialogo([narrador('Gn 22:9')]);
          aproximarSeLonge(c, 'isaque', altar, 1.6, 1);
          pose(c, 'isaque', CLIPE_ORACAO);
          // o rosto de Abraão, olhos fechados; a mão se ergue, só a silhueta contra o céu
          const ab = c.personagem('abraao');
          const frente = new THREE.Vector3(Math.sin(ab.yaw), 0, Math.cos(ab.yaw));
          await c.camera(ab.posicao.clone().add(frente.clone().multiplyScalar(2.2)).add(new THREE.Vector3(0, 1.5, 0)), ab.posicao.clone().add(new THREE.Vector3(0, 1.7, 0)), 2.5);
          soltar(c.animar('abraao', 'estenderMaoInicio', 'superior'));
          await c.dialogo([narrador('Gn 22:10')]);
          // corte para a luz
          await animarCeu(c, 'gloria', 1, 0.6);
          await c.dialogo([
            anjo('Gn 22:11', 'Abraão, Abraão;'),
            abraaoDiz('Gn 22:11', 'Aqui estou.'),
            anjo('Gn 22:12', 'Não ponhas a tua mão sobre o menino, nem faças alguma coisa com ele. Porque agora eu sei que temes a Deus, vendo que não negaste a mim teu filho, teu único filho.'),
          ]);
          await animarCeu(c, 'gloria', 0.15, 1.5);
          pose(c, 'isaque', null);
          await c.cameraVoltar(2);
        });
        c.xp('abraao', 'prova');
        c.treinar('abraao', 'fe', 1);
        c.treinar('isaque', 'fe', 0.6);
        marcar(c, 'b5Provera');
      },
    },
    {
      id: 'carneiro',
      objetivo: 'Olhe ao redor.',
      async executar(c) {
        const s = sv();
        if (!feito(c, 'b5Carneiro')) {
          const [bx, bz] = ponto2(c.mundo as MundoBase, 'arbustoCarneiro');
          const carneiro = await criarAnimal('carneiro', 'carneiro', bx, bz);
          carneiro.prender();
          await c.dialogo([narrador('Gn 22:13', 'E Abraão levantou seus olhos, e olhou, e eis detrás dele um carneiro, preso pelos chifres em um arbusto;')]);
          c.objetivo('Olhe ao redor.', ['arbustoCarneiro']);
          await comEtapa(c, 'b5.carneiro', {}, () => interacaoDe(c, 'carneiro', 'abraao', 'Quem toma o carneiro é Abraão.'));
          // a oferta é mostrada só como fogo no altar
          await c.cena(async () => {
            await c.fade(true, 0.8);
            await removerAnimal('carneiro', false);
            definirAltar(c, 'altarMoria', 'aceso');
            s.audio.efeito('fogo');
            const altar = lugar(c, 'altarMoria');
            await c.camera(altar.clone().add(new THREE.Vector3(8, 4, 8)), altar.clone().add(new THREE.Vector3(0, 1.4, 0)), 0);
            await c.fade(false, 1.2);
            await c.dialogo([narrador('Gn 22:13', 'e Abraão foi e tomou o carneiro, e o ofereceu como oferta queimada no lugar de seu filho.')]);
          });
          marcar(c, 'b5Carneiro');
        }
        await c.cena(async () => {
          // Isaque abraça o pai
          const ab = c.personagem('abraao').posicao;
          await c.mover('isaque', anel(ab.clone().add(new THREE.Vector3(0.9, 0, 0.6)), 0));
          await c.camera(ab.clone().add(new THREE.Vector3(3, 1.9, 3)), ab.clone().add(new THREE.Vector3(0.4, 1.4, 0.3)), 1.5);
          await Promise.all([c.animar('isaque', 'sim'), c.animar('abraao', 'sim')]);
          s.audio.musica('gloria');
          await c.dialogo([narrador('Gn 22:14')]);
          await c.cameraVoltar(1.5);
        });
        c.memoria('jeovaJire');
        s.cristo('cordeiro');
      },
    },
    {
      id: 'promessa',
      objetivo: '',
      async executar(c) {
        const s = sv();
        await c.cena(async () => {
          await animarCeu(c, 'gloria', 0.5, 1.5);
          await c.dialogo([
            anjo('Gn 22:16', 'Por mim mesmo jurei, diz o Senhor, pois porque tu fizeste tal coisa, e não negaste teu filho, teu único filho;'),
            anjo('Gn 22:17'),
            anjo('Gn 22:18'),
          ]);
          await animarCeu(c, 'gloria', 0, 1.5);
        });
        s.cristo('semente'); // a Semente prometida (Gl 3:16) se completa
        c.versiculo('Hb 11:17');
        await c.dialogo([narrador('Gn 22:19')]);
        await removerAnimal('jumento', false);
        // créditos do MVP
        await c.cena(async () => {
          await c.fade(true, 2);
          await c.titulo('Continua…', 'Era 3 — José');
        });
        await s.creditos();
      },
    },
  ],
};

/** B1–B5, na ordem. B5 não tem `proxima`: depois dos créditos, o orquestrador volta ao menu. */
export const MISSOES_ABRAAO: DefMissao[] = [B1, B2, B3, B4, B5];

export function missaoAbraao(id: string): DefMissao {
  const m = MISSOES_ABRAAO.find((x) => x.id === id);
  if (!m) throw new Error(`Missão desconhecida na era de Abraão: ${id}`);
  return m;
}

/** Todas as etapas, como "missao.etapa". */
export function etapasAbraao(): { missao: string; etapa: DefEtapa }[] {
  return MISSOES_ABRAAO.flatMap((m) => m.etapas.map((etapa) => ({ missao: m.id, etapa })));
}

/** Para os testes: esquece os animais e rebanhos de cena (um mundo novo). */
export function limparCenaAbraao() {
  animaisCena.clear();
  rebanhosB2 = null;
  criandoRebanhos = null;
  mecanica = null;
}
