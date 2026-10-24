// Missões da era de Noé (prólogo + A1–A6), conforme docs/ROTEIRO.md.
//
// Regras seguidas aqui:
// - Texto bíblico só por referência (`ref` + `trecho` exato da BKJ); falas de ficção curtas.
// - Deus nunca aparece como figura: voz (falas 'deus') e luz (céu dourado).
// - Cada etapa é idempotente: flags e contadores dizem o que já foi feito, o mundo é
//   reconstruído pelas flags (`reconstruirMundoNoe`) e a etapa recomeça do início pulando o
//   que já está feito.
// - Tudo o que não está no CtxMissao vem de `servicosNoe()` (ver servicos.ts).
import * as THREE from 'three';
import type { Alvo, CtxMissao, DefEtapa, DefMissao, DefProva, Linha } from '../../jogo/contratos';
import type { Personagem } from '../../jogo/Personagem';
import type { NomeClipe } from '../../entidades/humano/Animador';
import { NOE } from './mapa';
import { servicosNoe, type AnimalNoe, type NomePontoArca, type OpcoesAnimalNoe, type ServicosNoe } from './servicos';
import {
  ANIMAIS_BAIAS, CONVERSAS_A6, ENCORAJAVEIS, INTERATIVO_FALAR_SEM, PARES_A4, PAR_PERDIDO, TOTAL_PARES,
  garantirEscalada, idConversa, interativoAcalmar, interativoConversa, interativoEncorajar, ponto2, registrarDefs, registrarEtapa,
  resolverLugar, type AjusteInterativo, type LugarNoe, type MundoBase, type RegistroInterativos,
} from './interativos';
import {
  FLAG_ARCA_PRONTA, FLAG_DENTRO_ARCA, FLAG_DEPOIS, IDS_FAMILIA_NOE, IDS_JOGAVEIS_NOE, IDS_MORADORES_NOE,
} from './personagens';

const ERA = 'noe';
/** A família inteira que entra na arca (Gn 7:7): os quatro jogáveis e as quatro mulheres. */
const FAMILIA = [...IDS_JOGAVEIS_NOE, ...IDS_FAMILIA_NOE];
/** Pose de oração / encolhido (o Animador ainda não tem um clipe próprio de oração). */
export const CLIPE_ORACAO: NomeClipe = 'agachado';
/** Nomes da genealogia de Sem a Abrão (Gn 11:10-26), escritos pelo jogo. */
export const GENEALOGIA_NOE = ['Sem', 'Arfaxade', 'Selá', 'Éber', 'Pelegue', 'Reú', 'Serugue', 'Naor', 'Terá', 'Abrão'];

/** Água e arca durante o dilúvio (m). A origem da arca é o centro da quilha. */
export const DILUVIO = { nivelSubindo: 6, nivelFlutuando: 13, arcaFlutuandoY: 9 };

type EvInteracao = { id: string; personagem: Personagem };

const sv = () => servicosNoe();

// ------------------------------------------------------------------------------ falas

const narrador = (ref: string, trecho?: string): Linha => (trecho ? { quem: 'narrador', ref, trecho } : { quem: 'narrador', ref });
const deus = (ref: string, trecho?: string): Linha => (trecho ? { quem: 'deus', ref, trecho } : { quem: 'deus', ref });
const ficcao = (quem: string, texto: string, emocao?: 'alegre' | 'triste' | 'preocupado' | 'firme' | 'irado' | 'reverente'): Linha =>
  (emocao ? { quem, texto, emocao } : { quem, texto });

/** Zombarias da cidade (ficção) na prova de ira de A3. */
export const ZOMBARIAS_A3 = [
  'Uma arca? No seco? Velho louco!',
  'Chuva? Nunca caiu água do céu assim!',
  'Volte para a sua madeira, carpinteiro.',
  'Se o seu Deus é bom, por que o castigo?',
  'Ninguém aqui vai ouvir você.',
  'Ele constrói há anos e nada acontece!',
];
/** Sussurros do tentador (ficção) em A3. */
export const MENTIRAS_A3 = [
  'Desista. Ninguém te ouve.',
  'Fique na cidade. Aproveite como todos.',
  'Deus te esqueceu nesse vale.',
  'Para que tanto trabalho?',
];
/** Sussurros do medo (ficção) em A5. */
export const MENTIRAS_A5 = [
  'A água vai entrar por todos os lados.',
  'Vocês estão sozinhos no escuro.',
  'Esta caixa de madeira não vai aguentar.',
  'Ninguém sabe que vocês estão aqui.',
];

// ------------------------------------------------------------------------------ utilidades

const feito = (c: CtxMissao, nome: string) => !!c.flags[nome];
const marcar = (c: CtxMissao, nome: string, valor: unknown = true) => c.definirFlag(nome, valor);
const contarFlags = (c: CtxMissao, nomes: string[]) => nomes.filter((n) => feito(c, n)).length;
const lista = (prefixo: string, n: number) => Array.from({ length: n }, (_, i) => `${prefixo}${i + 1}`);

function lugar(c: CtxMissao, l: LugarNoe): THREE.Vector3 {
  return resolverLugar(c.mundo as MundoBase, sv(), l);
}
function arca(nome: NomePontoArca): THREE.Vector3 {
  return sv().vale.pontoArca(nome).clone();
}
function pessoa(c: CtxMissao, id: string): Personagem | undefined {
  return c.mundo.personagens.get(id);
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

async function animarCeu(c: CtxMissao, chave: 'gloria' | 'tempestade' | 'arco', alvo: number, segundos: number) {
  const ceu = sv().ceu;
  const de = ceu[chave];
  await transicao(c, segundos, (t) => (ceu[chave] = de + (alvo - de) * t));
}

/** A voz de Deus: a luz dourada sobe, as falas, a luz volta. */
async function vozDeDeus(c: CtxMissao, linhas: Linha[], luz = 0.55) {
  await animarCeu(c, 'gloria', luz, 1.5);
  await c.dialogo(linhas);
  await animarCeu(c, 'gloria', 0, 1.5);
}

/** Leva alguém até perto de um ponto se estiver longe (carregar save, posições perdidas). */
function aproximarSeLonge(c: CtxMissao, id: string, destino: THREE.Vector3, raio: number, indice = 0): boolean {
  const p = pessoa(c, id);
  if (!p || p.posicao.distanceTo(destino) <= raio) return false;
  const a = indice * 2.1;
  const r = indice ? 1.6 : 0;
  p.teleportar(destino.x + Math.cos(a) * r, destino.y + 0.05, destino.z + Math.sin(a) * r);
  return true;
}

/** Quem não está sendo controlado para e espera (dentro da arca as rotinas não valem). */
function pararRotinas(c: CtxMissao, ids = FAMILIA) {
  for (const id of ids) {
    const p = pessoa(c, id);
    if (p && !p.controlado && !p.posto) p.ia.esperar();
  }
}

function voltarRotinas(c: CtxMissao, ids: string[]) {
  for (const id of ids) {
    const p = pessoa(c, id);
    if (p && !p.controlado && !p.posto) p.ia.voltarARotina();
  }
}

function pose(c: CtxMissao, id: string, clipe: NomeClipe | null) {
  const p = pessoa(c, id);
  if (p && !p.controlado) p.humano.animador.atividade = clipe;
}

function ocupante(c: CtxMissao, idPosto: string): Personagem | null {
  for (const p of c.mundo.personagens.values()) if (p.posto?.id === idPosto) return p;
  return null;
}

function soltarPosto(c: CtxMissao, idPosto: string) {
  if (ocupante(c, idPosto)) sv().liberarPosto(idPosto);
}

function estagioArca(c: CtxMissao, e: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
  const a = sv().vale.arca;
  if (a.estagio !== e) a.definirEstagio(e);
  marcar(c, 'arcaEstagio', e);
}

function estadoVale(c: CtxMissao, e: 'antes' | 'diluvio' | 'depois') {
  sv().vale.definirEstado(e);
  marcar(c, 'valeEstado', e);
}

/** Move a arca (pela função dada) e leva junto quem está dentro, pelo mesmo deslocamento. */
function moverArcaComTodos(c: CtxMissao, mover: (s: ServicosNoe) => void) {
  const s = sv();
  const antes = s.vale.arca.grupo.position.clone();
  mover(s);
  const d = s.vale.arca.grupo.position.clone().sub(antes);
  if (d.lengthSq() < 1e-8) return;
  for (const id of FAMILIA) {
    const p = pessoa(c, id);
    if (p) p.teleportar(p.posicao.x + d.x, p.posicao.y + d.y + 0.05, p.posicao.z + d.z);
  }
}

/** Põe a família num convés (só quem estiver longe: ao carregar um save, por exemplo). */
function posicionarNaArca(c: CtxMissao, conves: NomePontoArca, ids = FAMILIA) {
  const centro = arca(conves);
  ids.forEach((id, i) => aproximarSeLonge(c, id, centro, 60, i));
}

// Animais criados pelas etapas, por chave (recriar a etapa não duplica).
const animaisCena = new Map<string, AnimalNoe>();

async function criarAnimal(chave: string, especie: string, x: number, z: number, opts?: OpcoesAnimalNoe): Promise<AnimalNoe> {
  await removerAnimal(chave, false);
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

/** Promessa que ninguém espera: nunca vira rejeição solta. */
function soltar(p: Promise<unknown>) {
  p.catch(() => {});
}

/** Registra os interativos de uma etapa, roda o corpo e remove ao sair (mesmo se abortada). */
async function comEtapa<T>(c: CtxMissao, chave: string, ajustes: Record<string, AjusteInterativo>, corpo: (r: RegistroInterativos) => Promise<T>): Promise<T> {
  const r = registrarEtapa(c.mundo as MundoBase, sv(), chave, ajustes);
  try {
    return await corpo(r);
  } finally {
    r.remover();
  }
}

/** Sem acalma com E no interativo ou com Q (habilidade de sacerdote) perto do animal. */
async function esperarAcalmar(c: CtxMissao, especie: string, pos: THREE.Vector3): Promise<Personagem> {
  const r = registrarDefs(c.mundo as MundoBase, sv(), [interativoAcalmar(especie, pos)]);
  try {
    const porE = c.interacao(r.ids[0]);
    soltar(porE); // marcada logo: a chamada seguinte pode lançar se a missão for abortada
    const porQ = c
      .esperarEvento<{ personagem: string; classe: string }>('habilidade', (d) => {
        const p = d && d.classe === 'sacerdote' ? pessoa(c, d.personagem) : undefined;
        return !!p && p.posicao.distanceTo(pos) < 7;
      })
      .then((d) => c.personagem(d.personagem));
    soltar(porQ);
    return await Promise.race([porE, porQ]);
  } finally {
    r.remover();
  }
}

// ------------------------------------------------------------------------------ reconstrução

/**
 * Reconstrói o vale a partir das flags (ao carregar um save ou ao entrar na era). O
 * orquestrador chama isto depois de ligar os serviços e antes de retomar a missão atual.
 */
export function reconstruirMundoNoe(s: ServicosNoe, m: MundoBase, flags: Record<string, unknown>) {
  const v = s.vale;
  const estado = (flags.valeEstado as 'antes' | 'diluvio' | 'depois' | undefined) ?? 'antes';
  v.definirEstado(estado);
  v.arca.definirEstagio(((flags.arcaEstagio as number | undefined) ?? 0) as 0);
  v.vigaMestra.definirAltura(flags.vigaEncaixada ? 1 : flags.vigaAmarrada ? 0.6 : 0);
  if (flags.arcaNoPlato) v.repousarArca();
  else if (flags.arcaFlutuando) v.moverArca(NOE.estaleiro[0], DILUVIO.arcaFlutuandoY, NOE.estaleiro[1], 0);
  v.definirInterior(!!flags.interiorArca);
  if (flags.portaArcaAberta) v.arca.definirPorta(true);
  v.arca.definirJanela(!!flags.janelaAberta);
  v.definirAltar((flags.altarPedras as number | undefined) ?? 0, !!flags.altarFogo);
  for (const id of lista('arvoreGofer', 3)) if (flags[`cortada_${id}`]) v.cortarArvore(id);
  if (estado === 'diluvio') {
    soltar(v.animarAgua(flags.arcaNoPlato ? v.arca.grupo.position.y + 1 : flags.arcaFlutuando ? DILUVIO.nivelFlutuando : DILUVIO.nivelSubindo, 0));
    s.ceu.tempestade = flags.arcaNoPlato ? 0 : 1;
  }
  if (estado !== 'antes') for (const id of IDS_MORADORES_NOE) if (m.personagens.has(id)) s.removerPersonagem(id);
  if (flags.arcoIrisNoCeu) s.ceu.arco = 1;
}

// ------------------------------------------------------------------------------ prólogo

const PROLOGO: DefMissao = {
  id: 'prologo', era: ERA, titulo: 'Prólogo', tipos: ['tutorial'],
  resumo: 'No princípio, a criação; depois, a queda e uma promessa. E, numa terra cheia de maldade, um homem achou graça.',
  refs: ['Gn 1:1', 'Gn 3:15', 'Gn 6:5-9'],
  proxima: 'a1',
  etapas: [
    {
      id: 'cinematica',
      objetivo: '',
      async executar(c) {
        const s = sv();
        s.ceu.hora = 5.8;
        s.ceu.pausado = true;
        s.audio.musica('calmo');
        s.audio.ambiente('vale', 0.6);
        try {
          await c.cena(async () => {
            const vista = lugar(c, 'vistaVale').add(new THREE.Vector3(0, 45, 0));
            const centro = lugar(c, 'centroVale').add(new THREE.Vector3(0, 2, 0));
            await c.fade(true, 0);
            await c.camera(vista, centro, 0);
            await c.fade(false, 2.5);
            const casa = lugar(c, 'casa');
            const voo = c.camera(casa.clone().add(new THREE.Vector3(-30, 28, 40)), lugar(c, 'estaleiro').add(new THREE.Vector3(0, 6, 0)), 22);
            soltar(voo);
            await c.dialogo([
              narrador('Gn 1:1'),
              ficcao('narrador', 'Mas o homem desobedeceu, e o pecado entrou no mundo. Ainda assim, Deus fez uma promessa.'),
            ]);
            await vozDeDeus(c, [deus('Gn 3:15')], 0.35);
            s.cristo('semente');
            await c.dialogo([narrador('Gn 6:5'), narrador('Gn 6:8'), narrador('Gn 6:9')]);
            await voo;
            await c.titulo('Era 1 — Noé', 'Gênesis 6–9');
            await c.cameraVoltar(2);
          });
        } finally {
          s.ceu.pausado = false;
        }
      },
    },
  ],
};

// ------------------------------------------------------------------------------ A1

const A1: DefMissao = {
  id: 'a1', era: ERA, titulo: 'Achou graça', tipos: ['tutorial', 'fisico'],
  resumo: 'Noé ora no monte e recebe as medidas da arca. Com Cam, leva a madeira de gofer ao estaleiro e assenta a quilha.',
  refs: ['Gn 6:8', 'Gn 6:13-14', 'Gn 6:22'],
  recompensa: { xp: 100 },
  proxima: 'a2',
  etapas: [
    {
      id: 'orar',
      objetivo: 'Suba ao monte de oração.',
      async executar(c) {
        const s = sv();
        estagioArca(c, 0);
        if (!feito(c, 'a1Comecou')) {
          // um jogo novo começa perto de casa, às 6h
          const ini = lugar(c, 'inicio');
          c.personagem('noe').teleportar(ini.x, ini.y + 0.05, ini.z, Math.PI);
          s.ceu.hora = 6;
          marcar(c, 'a1Comecou');
        }
        if (feito(c, 'a1Orou')) return;
        c.objetivo('Suba ao monte de oração.', ['orarMonte']);
        c.dica('Use W A S D para andar e o mouse para olhar ao redor.');
        let quem: Personagem | null = null;
        await comEtapa(c, 'a1.orar', {}, async () => {
          await c.chegar('ativo', 'orarMonte', 45);
          c.dica('Segure Shift para correr. Correr gasta fôlego.');
          await c.chegar('ativo', 'orarMonte', 10);
          c.dica('Perto das pedras, segure E para orar.');
          quem = await c.interacao('orarMonte');
        });
        await c.cena(async () => {
          s.audio.musica('gloria');
          await vozDeDeus(c, [
            deus('Gn 6:13', 'O fim de toda a carne chegou diante de mim; pois a terra está cheia de violência por meio deles; e eis que eu os destruirei com a terra.'),
            deus('Gn 6:14'),
            deus('Gn 6:15'),
            deus('Gn 6:18'),
          ], 0.7);
          s.audio.musica('calmo');
        });
        c.memoria('graca');
        c.memoria('pacto');
        c.receberVersiculo('Gn 6:18');
        const id = (quem as Personagem | null)?.id ?? 'noe';
        c.xp(id, 'disciplina');
        c.treinar(id, 'comunhao', 0.5);
        marcar(c, 'a1Orou');
      },
    },
    {
      id: 'madeira',
      objetivo: 'Vá até o bosque de gofer, onde Cam corta lenha.',
      async executar(c) {
        const cam = c.personagem('cam');
        aproximarSeLonge(c, 'cam', lugar(c, 'corteLenha'), 40);
        if (!cam.controlado) cam.ia.esperar();
        c.objetivo('Vá até o bosque de gofer, onde Cam corta lenha.', [{ personagem: 'cam' }]);
        await c.chegar('ativo', { personagem: 'cam' }, 6);
        await c.dialogo([ficcao('cam', 'Pai! Já derrubei estas. Mas carregar até o estaleiro é outra história.')]);
        const tecla = IDS_JOGAVEIS_NOE.indexOf('cam') + 1;
        c.dica(`Pressione Tab (segure) ou ${tecla} para trocar de personagem. Cada um tem sua força.`);
      },
    },
    {
      id: 'troncos',
      objetivo: 'Leve 4 troncos ao estaleiro (0/4).',
      async executar(c) {
        const s = sv();
        const TOTAL = 4;
        const arvores = lista('arvoreGofer', 3);
        const objetivo = () => c.objetivo(`Leve ${TOTAL} troncos ao estaleiro (${c.contador('troncos')}/${TOTAL}).`, ['pilhaBosque', 'entregaTroncos']);
        if (c.contador('troncos') >= TOTAL) return;
        objetivo();
        let avisouFolego = false;
        const ajustes: Record<string, AjusteInterativo> = {};
        for (const id of arvores) ajustes[id] = { ativo: () => !feito(c, `cortada_${id}`) };
        await comEtapa(c, 'a1.troncos', ajustes, async (reg) => {
          for (const id of arvores) if (feito(c, `cortada_${id}`)) reg.tirar(id);
          while (c.contador('troncos') < TOTAL) {
            const { id, personagem: p } = await interacaoEntre(c, reg.ids);
            if (id === 'pilhaBosque') {
              if (p.carregando) continue;
              p.carregar('tronco');
              s.audio.efeito('clique');
              if (!avisouFolego) {
                avisouFolego = true;
                c.dica('Carregando, o fôlego cai. Sem fôlego, anda-se devagar: descanse à sombra para recuperar mais rápido.');
              }
            } else if (id === 'entregaTroncos') {
              if (p.carregando !== 'tronco') continue;
              p.carregar(null);
              c.contador('troncos', c.contador('troncos') + 1);
              c.treinar(p.id, 'forca', 0.35);
              c.treinar(p.id, 'resistencia', 0.35);
              s.audio.efeito('tranco');
              objetivo();
            } else if (arvores.includes(id) && !feito(c, `cortada_${id}`)) {
              // cada cipreste marcado vira mais um tronco na pilha do bosque
              marcar(c, `cortada_${id}`);
              s.vale.cortarArvore(id);
              s.audio.efeito('machado');
              reg.tirar(id);
              c.xp(p.id, 'construir', 10);
              c.treinar(p.id, 'forca', 0.3);
            }
          }
        });
      },
    },
    {
      id: 'quilha',
      objetivo: 'Como Noé, assente a quilha.',
      async executar(c) {
        const s = sv();
        if (!feito(c, 'a1Quilha')) {
          c.objetivo('Como Noé, assente a quilha.', ['quilha']);
          c.dica('Só Noé sabe construir. Troque para ele e segure E na quilha.');
          const p = await comEtapa(c, 'a1.quilha', {}, () => c.interacao('quilha'));
          estagioArca(c, 1);
          s.audio.efeito('martelo');
          c.xp(p.id, 'construir');
          c.treinar(p.id, 'forca', 0.5);
          marcar(c, 'a1Quilha');
        } else estagioArca(c, 1);
        await c.dialogo([narrador('Gn 6:22')]);
        c.receberVersiculo('Gn 6:22');
        c.versiculo('Hb 11:7');
      },
    },
  ],
};

// ------------------------------------------------------------------------------ A2

const A2: DefMissao = {
  id: 'a2', era: ERA, titulo: 'A viga mestra', tipos: ['cooperativo'],
  resumo: 'Cam segura o guincho, Jafé sobe o andaime e amarra a corda, Noé fixa a viga. Depois, betume por dentro e por fora.',
  refs: ['Gn 6:14-16', 'Ec 4:9-10', 'Ec 4:12'],
  recompensa: { xp: 100 },
  proxima: 'a3',
  etapas: [
    {
      id: 'planejar',
      objetivo: 'Fale com Sem, Cam e Jafé no estaleiro.',
      async executar(c) {
        if (sv().vale.arca.estagio < 1) estagioArca(c, 1);
        const g = lugar(c, 'guincho');
        ['sem', 'cam', 'jafe'].forEach((id, i) => {
          aproximarSeLonge(c, id, g, 50, i + 1);
          const p = pessoa(c, id);
          if (p && !p.controlado) p.ia.esperar();
        });
        c.objetivo('Fale com Sem, Cam e Jafé no estaleiro.', [{ personagem: 'cam' }]);
        await c.chegar('ativo', 'guincho', 9);
        await c.dialogo([
          ficcao('noe', 'A viga mestra precisa subir até o alto das cavernas. Sozinho, ninguém a ergue.', 'firme'),
          ficcao('jafe', 'Eu subo o andaime e amarro a corda lá em cima.', 'alegre'),
          ficcao('cam', 'E eu seguro o guincho. Só não demorem!'),
        ]);
        c.dica('Coloque Cam no guincho, troque para Jafé e suba o andaime. Quem está num posto continua lá quando você troca.');
      },
    },
    {
      id: 'erguer',
      objetivo: 'Erga a viga mestra.',
      async executar(c) {
        const s = sv();
        if (feito(c, 'vigaEncaixada')) {
          estagioArca(c, 2);
          return;
        }
        const est = {
          altura: feito(c, 'vigaAmarrada') ? 0.6 : 0,
          amarrada: feito(c, 'vigaAmarrada'),
          enc: [feito(c, 'a2Encaixe1'), feito(c, 'a2Encaixe2')],
        };
        s.vale.vigaMestra.definirAltura(est.altura);
        // o motor registra a escalada do andaime; esta é só a reserva
        garantirEscalada(c.mundo as MundoBase, 'andaime', 'andaimeBase', 'andaimeTopo');
        const encaixar = (n: 0 | 1) => (p: Personagem) => {
          if (!est.amarrada || est.enc[n]) return;
          est.enc[n] = true;
          marcar(c, `a2Encaixe${n + 1}`);
          s.audio.efeito('martelo');
          c.treinar(p.id, 'perseveranca', 0.4);
        };
        const ajustes: Record<string, AjusteInterativo> = {
          guincho: { ativo: () => !est.amarrada },
          ancoraCorda: {
            ativo: () => !est.amarrada && est.altura >= 0.6 - 1e-6,
            aoInteragir: (p) => {
              if (est.amarrada || est.altura < 0.6 - 1e-6) return;
              est.amarrada = true;
              marcar(c, 'vigaAmarrada');
              s.audio.efeito('corda');
              c.treinar(p.id, 'agilidade', 0.5);
              c.dica('A viga está presa! Cam já pode soltar o guincho (E). Agora Noé fixa as duas pontas.');
            },
          },
          encaixeViga1: { ativo: () => est.amarrada && !est.enc[0], aoInteragir: encaixar(0) },
          encaixeViga2: { ativo: () => est.amarrada && !est.enc[1], aoInteragir: encaixar(1) },
        };
        let fase = -1;
        let avisouGuincho = false;
        try {
          await comEtapa(c, 'a2.erguer', ajustes, async () => {
            const DT = 0.1;
            while (!(est.enc[0] && est.enc[1])) {
              if (!est.amarrada) {
                const segurando = ocupante(c, 'guincho');
                if (segurando && !avisouGuincho) {
                  avisouGuincho = true;
                  c.dica('Cam segura o guincho. Troque para Jafé e suba o andaime.');
                }
                const nova = THREE.MathUtils.clamp(est.altura + (segurando ? 0.1 : -0.02) * DT, 0, 0.6);
                if (nova !== est.altura) {
                  est.altura = nova;
                  s.vale.vigaMestra.definirAltura(nova);
                }
              }
              const f = !est.amarrada ? (est.altura < 0.6 - 1e-6 ? 0 : 1) : 2;
              if (f !== fase) {
                fase = f;
                if (f === 0) c.objetivo('Erga a viga: alguém no guincho, Jafé no alto do andaime.', ['guincho', 'andaimeBase']);
                else if (f === 1) c.objetivo('A viga chegou ao alto: Jafé, amarre a corda!', ['ancoraCorda']);
                else c.objetivo('Noé: fixe as duas pontas da viga.', ['encaixeViga1', 'encaixeViga2']);
              }
              await c.esperar(DT);
            }
          });
        } finally {
          // ninguém fica preso no guincho (nem se a etapa for abortada)
          soltarPosto(c, 'guincho');
        }
        s.vale.vigaMestra.definirAltura(1);
        marcar(c, 'vigaEncaixada');
        estagioArca(c, 2);
        for (const id of ['noe', 'cam', 'jafe']) c.xp(id, 'cooperacao');
        c.treinar('cam', 'forca', 0.6);
        c.treinar('jafe', 'agilidade', 0.6);
        c.treinar('noe', 'perseveranca', 0.6);
        c.unidade(5);
        c.versiculo('Ec 4:9');
        await c.esperar(7);
        c.versiculo('Ec 4:12');
      },
    },
    {
      id: 'betume',
      objetivo: 'Betume por dentro e por fora (Gn 6:14).',
      async executar(c) {
        const s = sv();
        const cascos = lista('betumarCasco', 3);
        const pronto = (id: string) => feito(c, `a2_${id}`);
        if (cascos.every(pronto)) return;
        const objetivo = () =>
          c.objetivo(`Betume por dentro e por fora (Gn 6:14): ${cascos.filter(pronto).length}/3.`, ['caldeirao', ...cascos.filter((id) => !pronto(id))]);
        objetivo();
        c.dica('Encha o balde no caldeirão e passe betume nas marcas do casco.');
        const ajustes: Record<string, AjusteInterativo> = {};
        for (const id of cascos) ajustes[id] = { ativo: () => !pronto(id) };
        const comBalde = new Set<string>();
        try {
          await comEtapa(c, 'a2.betume', ajustes, async () => {
            while (!cascos.every(pronto)) {
              const { id, personagem: p } = await interacaoEntre(c, ['caldeirao', ...cascos]);
              if (id === 'caldeirao') {
                if (p.carregando) continue;
                p.carregar('balde');
                comBalde.add(p.id);
              } else if (!pronto(id) && p.carregando === 'balde') {
                marcar(c, `a2_${id}`);
                c.treinar(p.id, 'perseveranca', 0.25);
                c.xp(p.id, 'construir', 10);
                s.audio.efeito('clique');
                objetivo();
              }
            }
          });
        } finally {
          for (const id of comBalde) {
            const p = pessoa(c, id);
            if (p?.carregando === 'balde') p.carregar(null);
          }
        }
      },
    },
    {
      id: 'anos',
      objetivo: '',
      async executar(c) {
        const s = sv();
        await c.cena(async () => {
          await c.fade(true, 1.5);
          estagioArca(c, 4);
          marcar(c, FLAG_ARCA_PRONTA);
          s.ceu.hora = 17.5;
          await c.titulo('Anos depois…');
          await c.fade(false, 2);
        });
      },
    },
  ],
};

// ------------------------------------------------------------------------------ A3

const LOCAIS_A3 = [
  { id: 'pregarPraca', flag: 'a3Praca', resposta: ficcao('zombador1', 'Ha! Ele ainda acredita nisso.') },
  { id: 'pregarMercado', flag: 'a3Mercado', resposta: ficcao('mercador1', 'Chuva do céu? Vá vender essa história em outro lugar.') },
  { id: 'pregarTorre', flag: 'a3Torre', resposta: ficcao('guarda1', 'Nossa torre é mais alta do que qualquer água.') },
];

function provaIra(local: string, i: number): DefProva {
  return {
    id: `a3_ira_${local}`,
    tipo: 'ira',
    titulo: 'Proclamar com brandura',
    instrucao: 'Segure E para proclamar o aviso. Se a ira subir, segure R para orar em silêncio.',
    mentiras: ZOMBARIAS_A3,
    alvo: 10,
    personagem: 'noe',
    intensidade: 0.35 + i * 0.15,
  };
}

export const PROVA_TENTACAO_A3: DefProva = {
  id: 'a3_tentacao',
  tipo: 'tentacao',
  titulo: 'Desistir?',
  instrucao: 'Responda às mentiras com Q — "Está escrito" —, com a Palavra que Deus já falou.',
  mentiras: MENTIRAS_A3,
  respostas: ['Gn 6:18', 'Gn 6:22'],
  alvo: 5,
  personagem: 'noe',
  intensidade: 0.4,
};

const A3: DefMissao = {
  id: 'a3', era: ERA, titulo: 'Pregoeiro da justiça', tipos: ['espiritual'],
  resumo: 'Noé leva o aviso de Deus à cidade sob zombaria e, na volta, resiste ao sussurro que manda desistir.',
  refs: ['2Pe 2:5', 'Hb 11:7', 'Pv 15:1', 'Gl 6:9', 'Gn 6:18'],
  recompensa: { xp: 100 },
  proxima: 'a4',
  etapas: [
    {
      id: 'ir',
      objetivo: 'Atravesse o vau e vá à praça da cidade.',
      async executar(c) {
        const s = sv();
        if (sv().vale.arca.estagio < 4) estagioArca(c, 4);
        s.controlar('noe');
        c.objetivo('Atravesse o vau e vá à praça da cidade.', ['vau', 'praca']);
        await c.chegar('noe', 'entradaCidade', 14);
        s.audio.ambiente('cidade', 0.8);
        c.versiculo('2Pe 2:5');
        await c.chegar('noe', 'praca', 12);
        // os moradores param e olham
        pararRotinas(c, IDS_MORADORES_NOE);
      },
    },
    {
      id: 'pregar',
      objetivo: 'Proclame o aviso em três lugares (0/3).',
      async executar(c) {
        const s = sv();
        const objetivo = () =>
          c.objetivo(`Proclame o aviso em três lugares (${contarFlags(c, LOCAIS_A3.map((l) => l.flag))}/3).`, LOCAIS_A3.filter((l) => !feito(c, l.flag)).map((l) => l.id));
        const ajustes: Record<string, AjusteInterativo> = {};
        for (const l of LOCAIS_A3) ajustes[l.id] = { ativo: () => !feito(c, l.flag) };
        objetivo();
        try {
          await comEtapa(c, 'a3.pregar', ajustes, async (reg) => {
            for (const l of LOCAIS_A3) if (feito(c, l.flag)) reg.tirar(l.id);
            while (LOCAIS_A3.some((l) => !feito(c, l.flag))) {
              const { id, personagem: p } = await interacaoEntre(c, LOCAIS_A3.filter((l) => !feito(c, l.flag)).map((l) => l.id));
              if (p.id !== 'noe') {
                c.dica('Foi a Noé que Deus avisou. Troque para Noé para proclamar.');
                continue;
              }
              const l = LOCAIS_A3.find((x) => x.id === id)!;
              const n = contarFlags(c, LOCAIS_A3.map((x) => x.flag));
              s.audio.musica('prova');
              await c.prova(provaIra(id, n));
              s.audio.musica('calmo');
              marcar(c, l.flag);
              reg.tirar(id);
              c.contador('pregacoes', n + 1);
              c.xp('noe', 'prova');
              c.treinar('noe', 'dominio', 0.4);
              c.treinar('noe', 'perseveranca', 0.3);
              await c.dialogo([
                ficcao('noe', 'Eu não vim com raiva. Vim avisar. Ainda há tempo de se voltar para Deus.', 'firme'),
                l.resposta,
              ]);
              if (n === 0) c.versiculo('Pv 15:1');
              objetivo();
            }
          });
        } finally {
          voltarRotinas(c, IDS_MORADORES_NOE);
        }
      },
    },
    {
      id: 'tentacao',
      objetivo: 'Na volta, passe junto à torre.',
      async executar(c) {
        const s = sv();
        if (feito(c, 'a3Tentacao')) return;
        c.objetivo('Na volta, passe junto à torre.', ['torre']);
        await c.chegar('noe', 'torre', 16);
        await c.dialogo([ficcao('narrador', 'Junto à torre, um sussurro frio acompanha os passos de Noé.')]);
        c.armadura('espada');
        c.receberVersiculo('Gn 6:18');
        c.receberVersiculo('Gn 6:22');
        c.dica('Pressione Q — Está escrito');
        s.audio.musica('prova');
        const r = await c.prova(PROVA_TENTACAO_A3);
        s.audio.musica('calmo');
        if (r.tentativas === 1) marcar(c, 'a3PrimeiraTentativa');
        c.memoria('pregador');
        c.xp('noe', 'prova');
        c.treinar('noe', 'dominio', 0.6);
        c.treinar('noe', 'perseveranca', 0.6);
        c.versiculo('Gl 6:9');
        marcar(c, 'a3Tentacao');
      },
    },
  ],
};

// ------------------------------------------------------------------------------ A4

const FONTES_MANTIMENTO = [...lista('saco', 4), ...lista('fruta', 2)];
const TOTAL_MANTIMENTO = FONTES_MANTIMENTO.length;
const entregue = (c: CtxMissao, id: string) => feito(c, `a4Entregue_${id}`);
const paresDentro = (c: CtxMissao) => contarFlags(c, [...PARES_A4.map((p) => `a4Par_${p.especie}`), `a4Par_${PAR_PERDIDO}`]);

function objetivoA4(c: CtxMissao) {
  const m = FONTES_MANTIMENTO.filter((id) => entregue(c, id)).length;
  c.objetivo(
    `Ajude os animais a entrar na arca (${paresDentro(c)}/${TOTAL_PARES} pares) e leve mantimento à arca (${m}/${TOTAL_MANTIMENTO}).`,
    ['filaAnimais', 'celeiro', 'entregaArca'],
  );
}

/** Um par chega pela borda do vale, para se estiver agitado e entra pela rampa. */
async function conduzirPar(c: CtxMissao, par: (typeof PARES_A4)[number], indice: number) {
  const s = sv();
  const flag = `a4Par_${par.especie}`;
  if (feito(c, flag)) return;
  await c.esperar(par.atraso);
  const [x, z] = ponto2(c.mundo as MundoBase, par.chegada);
  const macho = await criarAnimal(`par_${par.especie}_m`, par.especie, x, z, { sexo: 'macho' });
  const femea = await criarAnimal(`par_${par.especie}_f`, par.especie, x + 1.6, z + 0.8, { sexo: 'femea' });
  try {
    const fila = lugar(c, 'filaAnimais');
    const lado = (indice % 2 ? 1 : -1) * (2 + (indice % 3) * 2.5);
    await Promise.all([macho.irPara(fila.x + lado, fila.z + 3), femea.irPara(fila.x + lado + 1.2, fila.z + 4)]);
    if (par.agitado && !feito(c, `a4Calmo_${par.especie}`)) {
      macho.agitar();
      femea.agitar();
      s.audio.efeito('sopro');
      if (!feito(c, 'a4DicaAcalmar')) {
        marcar(c, 'a4DicaAcalmar');
        c.dica('Alguns animais chegam agitados e param. Sem pode acalmá-los (Q ou E).');
      }
      const p = await esperarAcalmar(c, par.especie, macho.posicao);
      macho.acalmar();
      femea.acalmar();
      marcar(c, `a4Calmo_${par.especie}`);
      c.treinar(p.id, 'compaixao', 0.5);
      c.xp(p.id, 'servir');
      if (!feito(c, 'a4Pv1210')) {
        marcar(c, 'a4Pv1210');
        c.versiculo('Pv 12:10');
      }
    }
    const rampa = lugar(c, 'entregaArca');
    const porta = arca('porta');
    const caminho: [number, number][] = [[rampa.x, rampa.z], [porta.x, porta.z]];
    await Promise.all([macho.entrar(caminho), femea.entrar(caminho)]);
    marcar(c, flag);
    c.contador('pares', paresDentro(c));
    objetivoA4(c);
  } finally {
    await Promise.all([removerAnimal(`par_${par.especie}_m`, false), removerAnimal(`par_${par.especie}_f`, false)]);
  }
}

/** Sacos de grãos (Cam) e cestos de frutas no alto (Jafé) até a porta da arca (Gn 6:21). */
async function levarMantimento(c: CtxMissao) {
  const s = sv();
  const contar = () => FONTES_MANTIMENTO.filter((id) => entregue(c, id)).length;
  if (contar() >= TOTAL_MANTIMENTO) return;
  const emMaos = new Map<string, string>(); // personagem → fonte
  const naMao = (id: string) => [...emMaos.values()].includes(id);
  const ajustes: Record<string, AjusteInterativo> = {};
  for (const id of FONTES_MANTIMENTO) ajustes[id] = { ativo: () => !entregue(c, id) && !naMao(id) };
  try {
    await comEtapa(c, 'a4.mantimento', ajustes, async () => {
      while (contar() < TOTAL_MANTIMENTO) {
        const { id, personagem: p } = await interacaoEntre(c, [...FONTES_MANTIMENTO, 'entregaArca']);
        if (id === 'entregaArca') {
          const fonte = emMaos.get(p.id);
          if (!fonte || !p.carregando) {
            c.dica('Traga um saco de grãos do celeiro ou um cesto de frutas do pomar.');
            continue;
          }
          p.carregar(null);
          emMaos.delete(p.id);
          marcar(c, `a4Entregue_${fonte}`);
          c.contador('mantimento', contar());
          c.xp(p.id, 'servir');
          c.treinar(p.id, fonte.startsWith('saco') ? 'forca' : 'agilidade', 0.3);
          objetivoA4(c);
        } else {
          if (entregue(c, id) || naMao(id) || p.carregando) continue;
          p.carregar(id.startsWith('saco') ? 'saco' : 'cesto');
          emMaos.set(p.id, id);
          s.audio.efeito('clique');
          if (!feito(c, 'a4DicaMantimento')) {
            marcar(c, 'a4DicaMantimento');
            c.dica('Leve até a porta da arca.');
          }
        }
      }
    });
  } finally {
    for (const pid of emMaos.keys()) pessoa(c, pid)?.carregar(null);
  }
}

const A4: DefMissao = {
  id: 'a4', era: ERA, titulo: 'De dois em dois', tipos: ['servico', 'exploracao'],
  resumo: 'Os animais vêm de dois em dois. Sem acalma os agitados, Cam e Jafé levam o mantimento, e um par perdido espera na gruta.',
  refs: ['Gn 6:19-21', 'Gn 7:1-3', 'Gn 7:9', 'Pv 12:10'],
  recompensa: { xp: 100 },
  proxima: 'a5',
  etapas: [
    {
      id: 'chamado',
      objetivo: '',
      async executar(c) {
        const s = sv();
        if (feito(c, 'a4Chamado')) {
          estagioArca(c, 5);
          return;
        }
        await c.cena(async () => {
          await c.fade(true, 1.2);
          s.ceu.hora = 6;
          estagioArca(c, 5);
          const p = lugar(c, 'portaArca');
          aproximarSeLonge(c, 'noe', p, 30);
          ['sem', 'cam', 'jafe'].forEach((id, i) => aproximarSeLonge(c, id, p, 45, i + 1));
          await c.fade(false, 2);
          await vozDeDeus(c, [
            deus('Gn 7:1', 'Vem tu e toda a tua casa para dentro da arca; pois a ti eu vi como justo diante de mim nesta geração.'),
            deus('Gn 7:2'),
            deus('Gn 7:3'),
            deus('Gn 6:21'),
          ]);
        });
        marcar(c, 'a4Chamado');
      },
    },
    {
      id: 'animais',
      objetivo: 'Os animais estão chegando (Gn 6:20). Ajude-os a entrar na arca.',
      async executar(c) {
        objetivoA4(c);
        c.dica('Os animais estão chegando (Gn 6:20). Ajude-os a entrar na arca e leve mantimento (Gn 6:21).');
        await Promise.all([Promise.all(PARES_A4.map((par, i) => conduzirPar(c, par, i))), levarMantimento(c)]);
      },
    },
    {
      id: 'mantimento',
      objetivo: 'Leve mantimento à arca (Gn 6:21).',
      async executar(c) {
        // corre junto com os animais; aqui só termina o que faltar
        objetivoA4(c);
        await levarMantimento(c);
      },
    },
    {
      id: 'parPerdido',
      objetivo: 'Falta um par: dizem que entrou na gruta a oeste.',
      async executar(c) {
        const s = sv();
        if (feito(c, `a4Par_${PAR_PERDIDO}`)) return;
        c.objetivo('Falta um par: dizem que entrou na gruta a oeste.', ['entradaGruta']);
        const fundo = lugar(c, 'fundoGruta');
        const macho = await criarAnimal('perdido_m', PAR_PERDIDO, fundo.x, fundo.z, { sexo: 'macho' });
        const femea = await criarAnimal('perdido_f', PAR_PERDIDO, fundo.x + 1.2, fundo.z + 0.6, { sexo: 'femea' });
        try {
          macho.agitar();
          femea.agitar();
          if (!feito(c, 'a4AchouPar')) {
            const quem = await comEtapa(c, 'a4.parPerdido', {}, () => c.interacao('gruta'));
            marcar(c, 'a4AchouPar');
            c.xp(quem.id, 'segredo');
          }
          c.objetivo('O par está assustado. Traga Sem para acalmá-los.', [{ personagem: 'sem' }]);
          c.dica('O par está assustado. Traga Sem para acalmá-los.');
          const sem = await esperarAcalmar(c, PAR_PERDIDO, macho.posicao);
          macho.acalmar();
          femea.acalmar();
          c.treinar(sem.id, 'compaixao', 0.5);
          macho.seguir(sem, 2.5);
          femea.seguir(sem, 3.5);
          c.objetivo('Leve o par até a arca.', ['portaArca']);
          await c.chegar(sem.id, 'portaArca', 7);
          const rampa = lugar(c, 'entregaArca');
          const porta = arca('porta');
          const caminho: [number, number][] = [[rampa.x, rampa.z], [porta.x, porta.z]];
          await Promise.all([macho.entrar(caminho), femea.entrar(caminho)]);
          marcar(c, `a4Par_${PAR_PERDIDO}`);
          c.contador('pares', paresDentro(c));
          s.audio.efeito('conquista');
        } finally {
          await Promise.all([removerAnimal('perdido_m', false), removerAnimal('perdido_f', false)]);
        }
      },
    },
    {
      id: 'entrar',
      objetivo: 'Entre na arca com toda a família.',
      async executar(c) {
        if (feito(c, FLAG_DENTRO_ARCA)) return;
        const porta = arca('porta');
        c.objetivo('Entre na arca com toda a família.', [porta]);
        await c.dialogo([narrador('Gn 7:9')]);
        await c.chegar('ativo', porta, 3);
        await c.cena(async () => {
          const ativo = c.ativo().id;
          const outros = FAMILIA.filter((id) => id !== ativo && pessoa(c, id));
          await c.dialogo([narrador('Gn 7:7')]);
          await Promise.all(outros.map((id, i) => {
            const a = (i / Math.max(1, outros.length)) * Math.PI * 2;
            return c.mover(id, { x: porta.x + Math.cos(a) * 2.2, y: porta.y, z: porta.z + Math.sin(a) * 1.4 });
          }));
        });
        pararRotinas(c);
        marcar(c, FLAG_DENTRO_ARCA);
      },
    },
  ],
};

// ------------------------------------------------------------------------------ A5

export const PROVA_MEDO_A5: DefProva = {
  id: 'a5_medo',
  tipo: 'medo',
  titulo: 'Quarenta dias',
  instrucao: 'Segure R para orar. Encoraje cada pessoa da família (E). Fique firme.',
  mentiras: MENTIRAS_A5,
  alvo: 25,
  personagem: 'noe',
  intensidade: 0.5,
};

/** Convés 1: as fontes do grande abismo. Devolve quando os 4 vazamentos estão tapados. */
async function etapaFontes(c: CtxMissao) {
  const s = sv();
  const DT = 0.25;
  const TAXA = 0.011; // por vazamento aberto, por segundo
  const INTERVALO = 20;
  const est = { abertos: new Set<number>(), tapados: new Set<number>(), nivel: 0 };
  const ajustes: Record<string, AjusteInterativo> = {};
  for (let n = 1; n <= 4; n++) {
    ajustes[`vazamento${n}`] = {
      ativo: () => est.abertos.has(n) && !est.tapados.has(n),
      aoInteragir: (p) => {
        if (!est.abertos.has(n) || est.tapados.has(n)) return;
        est.tapados.add(n);
        s.vale.definirVazamento(n, false);
        s.audio.efeito('martelo');
        c.treinar(p.id, 'perseveranca', 0.25);
      },
    };
  }
  const reiniciar = () => {
    est.abertos.clear();
    est.tapados.clear();
    est.nivel = 0;
    for (let n = 1; n <= 4; n++) s.vale.definirVazamento(n, false);
    s.vale.definirAguaInterna(0);
  };
  const lentidao = (nivel: number) => {
    for (const id of FAMILIA) {
      const p = pessoa(c, id);
      if (p) p.modVelocidade = 1 - 0.45 * nivel;
    }
  };
  reiniciar();
  c.dica('Coloque Cam na bomba (E) e troque para Noé para tapar os vazamentos.');
  try {
    await comEtapa(c, 'a5.fontes', ajustes, async () => {
      for (;;) {
        let t = 0;
        let proxima = 0;
        let texto = '';
        let falhou = false;
        while (est.tapados.size < 4) {
          if (est.abertos.size < 4 && t >= proxima) {
            const n = est.abertos.size + 1;
            est.abertos.add(n);
            s.vale.definirVazamento(n, true);
            s.audio.efeito('agua');
            if (n === 1) c.dica('A água está entrando! Noé pode tapar o vazamento: segure E.');
            proxima += INTERVALO;
          }
          const vazando = est.abertos.size - est.tapados.size;
          const bombeando = !!ocupante(c, 'bomba');
          const sobe = vazando * TAXA * (bombeando ? 0.3 : 1);
          const desce = bombeando && vazando === 0 ? 0.02 : 0;
          est.nivel = THREE.MathUtils.clamp(est.nivel + (sobe - desce) * DT, 0, 1);
          s.vale.definirAguaInterna(est.nivel);
          lentidao(est.nivel);
          const novo = `As fontes do grande abismo: tape os vazamentos (${est.tapados.size}/4). Água: ${Math.round(est.nivel * 10) * 10}%.`;
          if (novo !== texto) {
            texto = novo;
            const alvos: Alvo[] = [...est.abertos].filter((n) => !est.tapados.has(n)).map((n) => arca(`vazamento${n}` as NomePontoArca));
            if (!bombeando) alvos.push(arca('bomba'));
            c.objetivo(novo, alvos);
          }
          if (est.nivel >= 1) {
            falhou = true;
            break;
          }
          await c.esperar(DT);
          t += DT;
        }
        if (!falhou) break;
        await c.cena(async () => {
          await c.fade(true, 0.8);
          c.aviso('A água subiu demais. Tentem de novo, juntos.');
          reiniciar();
          lentidao(0);
          for (const id of IDS_JOGAVEIS_NOE) c.treinar(id, 'perseveranca', 0.1);
          await c.fade(false, 0.8);
        });
      }
    });
  } finally {
    soltarPosto(c, 'bomba');
    lentidao(0);
  }
  reiniciar();
}

const A5: DefMissao = {
  id: 'a5', era: ERA, titulo: 'Quarenta dias', tipos: ['masmorra', 'cooperativo', 'espiritual'],
  resumo: 'A porta se fecha e as águas sobem. Dentro da arca, a família enfrenta vazamentos, animais inquietos e o medo da tempestade, até a pomba voltar com a folha de oliveira.',
  refs: ['Gn 7:11-24', 'Gn 8:1-16', 'Sl 56:3', '1Pe 3:20'],
  recompensa: { xp: 100 },
  proxima: 'a6',
  etapas: [
    {
      id: 'porta',
      objetivo: '',
      async executar(c) {
        const s = sv();
        if (feito(c, 'a5Porta')) return;
        await c.cena(async () => {
          posicionarNaArca(c, 'conves1');
          pararRotinas(c);
          const fora = lugar(c, 'portaArca');
          const porta = arca('porta');
          await c.camera(fora.clone().add(new THREE.Vector3(-6, 5, 16)), porta.clone().add(new THREE.Vector3(0, 2, 0)), 1.5);
          await animarCeu(c, 'gloria', 0.4, 1);
          estagioArca(c, 6);
          s.audio.efeito('portaArca');
          s.camera.tremer(0.3, 0.4);
          await c.dialogo([narrador('Gn 7:16', 'e o Senhor fechou por fora.')]);
          await animarCeu(c, 'gloria', 0, 1);
          c.memoria('portaFechada');
          s.cristo('arca');
          estadoVale(c, 'diluvio');
          s.audio.musica('silencio');
          s.audio.ambiente('chuva', 1);
          soltar(s.vale.animarAgua(DILUVIO.nivelSubindo, 30));
          await animarCeu(c, 'tempestade', 1, 3);
          await c.dialogo([narrador('Gn 7:11'), narrador('Gn 7:12')]);
          // a cidade não volta depois do dilúvio (sem mostrar ninguém perecendo)
          for (const id of IDS_MORADORES_NOE) if (pessoa(c, id)) s.removerPersonagem(id);
          await c.fade(true, 1);
          s.vale.definirInterior(true);
          marcar(c, 'interiorArca');
          s.audio.ambiente('interiorArca', 0.8);
          await c.cameraVoltar(0);
          await c.fade(false, 1);
        });
        marcar(c, 'a5Porta');
      },
    },
    {
      id: 'fontes',
      objetivo: 'As fontes do grande abismo: tape os vazamentos.',
      async executar(c) {
        const s = sv();
        if (!feito(c, 'a5Fontes')) {
          posicionarNaArca(c, 'conves1');
          pararRotinas(c);
          await etapaFontes(c);
          marcar(c, 'a5Fontes');
          c.xp('grupo', 'cooperacao');
          c.unidade(5);
        }
        if (!feito(c, 'arcaFlutuando')) {
          await c.cena(async () => {
            await c.fade(true, 1);
            soltar(s.vale.animarAgua(DILUVIO.nivelFlutuando, 0));
            moverArcaComTodos(c, (sx) => sx.vale.moverArca(NOE.estaleiro[0], DILUVIO.arcaFlutuandoY, NOE.estaleiro[1], 0));
            marcar(c, 'arcaFlutuando');
            s.camera.balanco(0.25);
            await c.fade(false, 1);
            await c.dialogo([narrador('Gn 7:17')]);
          });
        }
      },
    },
    {
      id: 'inquietos',
      objetivo: 'Acalme os animais e prenda as redes de carga.',
      async executar(c) {
        const s = sv();
        const baias = lista('baia', 3);
        const redes = lista('rede', 2);
        const ok = (id: string) => feito(c, `a5_${id}`);
        if ([...baias, ...redes].every(ok)) return;
        posicionarNaArca(c, 'conves2');
        pararRotinas(c);
        s.camera.balanco(0.6);
        s.vale.definirCaixasSoltas(!redes.every(ok));
        const animais: AnimalNoe[] = [];
        for (let i = 0; i < baias.length; i++) {
          const p = arca(`baia${i + 1}` as NomePontoArca);
          const a = await criarAnimal(`baia${i + 1}`, ANIMAIS_BAIAS[i], p.x, p.z, { y: p.y });
          if (!ok(baias[i])) a.agitar();
          animais.push(a);
        }
        const objetivo = () => {
          const b = baias.filter(ok).length;
          const r = redes.filter(ok).length;
          c.objetivo(`Convés dos animais: acalme as baias (${b}/3) e prenda as redes de carga (${r}/2).`, [...baias, ...redes].filter((id) => !ok(id)).map((id) => arca(id as NomePontoArca)));
        };
        objetivo();
        c.dica('A arca balança e as caixas deslizam. Sem acalma os animais; Jafé sobe e prende as redes.');
        const ajustes: Record<string, AjusteInterativo> = {};
        for (const id of [...baias, ...redes]) ajustes[id] = { ativo: () => !ok(id) };
        await comEtapa(c, 'a5.inquietos', ajustes, async (reg) => {
          for (const id of [...baias, ...redes]) if (ok(id)) reg.tirar(id);
          while (![...baias, ...redes].every(ok)) {
            const { id, personagem: p } = await interacaoEntre(c, [...baias, ...redes].filter((x) => !ok(x)));
            if (ok(id)) continue;
            marcar(c, `a5_${id}`);
            reg.tirar(id);
            if (id.startsWith('baia')) {
              animais[Number(id.slice(-1)) - 1]?.acalmar();
              c.treinar(p.id, 'compaixao', 0.4);
              c.xp(p.id, 'servir');
            } else {
              s.audio.efeito('corda');
              c.treinar(p.id, 'agilidade', 0.4);
              if (redes.every(ok)) {
                s.vale.definirCaixasSoltas(false);
                c.dica('As redes seguram a carga. O corredor está livre.');
              }
            }
            objetivo();
          }
        });
        c.xp('grupo', 'cooperacao');
        c.dica('A rampa para o convés de cima está livre.');
      },
    },
    {
      id: 'medo',
      objetivo: 'Suba ao convés da família.',
      async executar(c) {
        const s = sv();
        if (!feito(c, 'a5Medo')) {
          s.camera.balanco(0.8);
          s.ceu.tempestade = 1;
          const familia = arca('familia');
          // a família encolhida no convés de cima
          const outros = FAMILIA.filter((id) => id !== 'noe');
          outros.forEach((id, i) => {
            const idx = IDS_FAMILIA_NOE.indexOf(id);
            aproximarSeLonge(c, id, idx >= 0 ? arca(`familia${idx + 1}` as NomePontoArca) : familia, 25, idx >= 0 ? 0 : i + 1);
          });
          pararRotinas(c, outros);
          for (const id of outros) pose(c, id, CLIPE_ORACAO);
          c.objetivo('Suba ao convés da família.', [familia]);
          if (c.ativo().id !== 'noe') c.dica('A família precisa de Noé. Troque para ele.');
          await c.chegar('noe', familia, 7);
          s.audio.efeito('trovao');
          s.camera.tremer(0.6, 0.8);
          await c.dialogo([ficcao('mulherSem', 'Nunca ouvi um vento assim…', 'preocupado')]);
          c.armadura('capacete');
          c.dica('O capacete da salvação: o medo pesa menos.');
          c.objetivo('Fique firme: ore (R) e encoraje cada um da família (E).', outros.map((id) => ({ personagem: id })));
          const encorajados = new Set<string>();
          const reg = registrarDefs(
            c.mundo as MundoBase,
            s,
            ENCORAJAVEIS.filter((id) => pessoa(c, id)).map(interativoEncorajar),
            Object.fromEntries(ENCORAJAVEIS.map((id) => [`encorajar_${id}`, {
              ativo: () => !encorajados.has(id),
              aoInteragir: () => {
                encorajados.add(id);
                pose(c, id, null);
              },
            } satisfies AjusteInterativo])),
          );
          s.audio.musica('prova');
          try {
            await c.prova(PROVA_MEDO_A5);
          } finally {
            reg.remover();
            for (const id of outros) pose(c, id, null);
          }
          s.audio.musica('calmo');
          c.xp('noe', 'prova');
          c.treinar('noe', 'coragem', 0.6);
          c.treinar('noe', 'fe', 0.4);
          marcar(c, 'a5Medo');
        }
        if (!feito(c, 'arcaNoPlato')) {
          await c.cena(async () => {
            await c.dialogo([narrador('Gn 8:1')]);
            c.memoria('deusLembrou');
            c.versiculo('Sl 56:3');
            s.cristo('tempestade');
            await c.dialogo([narrador('Gn 7:24')]);
            await c.fade(true, 1.5);
            await c.titulo('Cento e cinquenta dias depois…');
            s.ceu.tempestade = 0;
            s.audio.ambiente('chuva', 0);
            s.audio.ambiente('vento', 0.5);
            moverArcaComTodos(c, (sx) => sx.vale.repousarArca());
            soltar(s.vale.animarAgua(s.vale.arca.grupo.position.y + 1, 0));
            marcar(c, 'arcaNoPlato');
            s.camera.balanco(0);
            await c.fade(false, 1);
            s.audio.efeito('tranco');
            s.camera.tremer(1, 0.7);
          });
        }
      },
    },
    {
      id: 'janela',
      objetivo: 'A janela (Gn 8:6).',
      async executar(c) {
        const s = sv();
        const pouso = () => arca('pombaPouso');
        const longe = () => pouso().add(new THREE.Vector3(60, 25, 140));
        const soltarAve = async (chave: string, especie: string, volta: boolean) => {
          const p = pouso();
          const ave = await criarAnimal(chave, especie, p.x, p.z, { y: p.y });
          const ida = ave.voarPara(longe().x, longe().y, longe().z);
          if (!volta) {
            soltar(ida.then(() => removerAnimal(chave, true)));
            return null;
          }
          soltar(ida);
          return ave;
        };
        const noeSolta = (id: string) => interacaoDe(c, id, 'noe', 'Quem solta as aves é Noé.');

        if (!feito(c, 'janelaAberta')) {
          posicionarNaArca(c, 'conves3');
          c.objetivo('Jafé: suba a escada e abra a cobertura da janela.', [arca('janela')]);
          c.dica('Jafé pode subir pela escada até a janela.');
          await comEtapa(c, 'a5.janela', {}, () => c.interacao('janela'));
          s.vale.arca.definirJanela(true);
          s.ceu.hora = 10;
          marcar(c, 'janelaAberta');
        }
        if (!feito(c, 'a5Corvo')) {
          c.objetivo('Noé: solte o corvo pela janela.', [arca('escadaJanela')]);
          await comEtapa(c, 'a5.corvo', {}, () => noeSolta('soltarCorvo'));
          s.audio.efeito('corvo');
          await soltarAve('corvo', 'corvo', false);
          await c.dialogo([narrador('Gn 8:7')]);
          marcar(c, 'a5Corvo');
        }
        // a pomba, três vezes (Gn 8:8-12)
        const voltaDaPomba = async (texto: string) => {
          const ave = await soltarAve('pomba', 'pomba', true);
          c.objetivo(texto, [arca('janela')]);
          await c.esperar(10);
          const p = pouso();
          await ave!.voarPara(p.x, p.y, p.z);
          s.audio.efeito('pomba');
          c.objetivo('Noé: estenda a mão e receba a pomba.', [arca('escadaJanela')]);
          await comEtapa(c, 'a5.receberPomba', {}, () => noeSolta('receberPomba'));
          const noe = c.personagem('noe');
          await c.animar('noe', 'estenderMaoInicio', 'superior');
          await removerAnimal('pomba', false);
          noe.carregar('pomba');
        };
        if (!feito(c, 'a5Pomba1')) {
          c.objetivo('Noé: solte a pomba.', [arca('escadaJanela')]);
          await comEtapa(c, 'a5.soltarPomba', {}, () => noeSolta('soltarPomba'));
          await c.dialogo([narrador('Gn 8:8')]);
          await voltaDaPomba('Espere a pomba voltar…');
          await c.dialogo([narrador('Gn 8:9', 'Então, ele estendeu sua mão e a tomou, e a puxou para si para dentro da arca.')]);
          c.personagem('noe').carregar(null);
          marcar(c, 'a5Pomba1');
        }
        if (!feito(c, 'a5Pomba2')) {
          await c.cena(async () => {
            await c.fade(true, 1);
            await c.titulo('Sete dias depois');
            s.ceu.hora = 9;
            await c.fade(false, 1);
          });
          c.objetivo('Noé: solte a pomba de novo.', [arca('escadaJanela')]);
          await comEtapa(c, 'a5.soltarPomba', {}, () => noeSolta('soltarPomba'));
          s.ceu.hora = 17.5; // ela volta à tarde
          await voltaDaPomba('Espere a pomba voltar…');
          await c.dialogo([narrador('Gn 8:11')]);
          c.personagem('noe').carregar(null);
          c.memoria('folhaOliveira');
          marcar(c, 'a5Pomba2');
        }
        if (!feito(c, 'a5Pomba3')) {
          await c.cena(async () => {
            await c.fade(true, 1);
            await c.titulo('Mais sete dias');
            s.ceu.hora = 9;
            await c.fade(false, 1);
          });
          c.objetivo('Noé: solte a pomba mais uma vez.', [arca('escadaJanela')]);
          await comEtapa(c, 'a5.soltarPomba', {}, () => noeSolta('soltarPomba'));
          await soltarAve('pomba', 'pomba', false);
          await c.dialogo([narrador('Gn 8:12')]);
          marcar(c, 'a5Pomba3');
        }
      },
    },
    {
      id: 'saida',
      objetivo: '',
      async executar(c) {
        await c.cena(() => vozDeDeus(c, [deus('Gn 8:16')], 0.6));
      },
    },
  ],
};

// ------------------------------------------------------------------------------ A6

/** Conversas de ficção no vale renovado (A6, opcionais). */
export const CONVERSAS_RECOMECO: Record<string, Linha[]> = {
  cam: [ficcao('cam', 'Pai, a terra está tão quieta. Por onde começamos?'), ficcao('noe', 'Pelo que temos nas mãos: sementes, trabalho e a promessa.', 'firme')],
  jafe: [ficcao('jafe', 'Lá de cima dá para ver o vale inteiro. Tudo começa de novo.', 'alegre')],
  mulherNoe: [ficcao('mulherNoe', 'Guardamos sementes do trigal. Vamos plantar de novo.', 'alegre')],
  mulherSem: [ficcao('mulherSem', 'Quando o medo apertou, Deus se lembrou de nós. Não me esqueço disso.', 'reverente')],
  mulherCam: [ficcao('mulherCam', 'Os filhos que vierem vão ouvir esta história.')],
  mulherJafe: [ficcao('mulherJafe', 'Olhe as cores no céu. Nunca vi nada tão bonito.', 'alegre')],
};

const PROCISSAO = ['ovelha', 'cabra', 'boi', 'camelo', 'jumento', 'cavalo', 'leao', 'cervo'];

const A6: DefMissao = {
  id: 'a6', era: ERA, titulo: 'O sinal da aliança', tipos: ['espiritual'],
  resumo: 'A família sai da arca. Noé constrói um altar ao Senhor, e Deus põe o seu arco na nuvem como sinal da aliança.',
  refs: ['Gn 8:18-22', 'Gn 9:1', 'Gn 9:8-17'],
  recompensa: { xp: 100 },
  etapas: [
    {
      id: 'sair',
      objetivo: '',
      async executar(c) {
        const s = sv();
        if (feito(c, 'a6Saida')) return;
        await c.cena(async () => {
          await c.fade(true, 1.2);
          if (!feito(c, 'arcaNoPlato')) {
            moverArcaComTodos(c, (sx) => sx.vale.repousarArca());
            marcar(c, 'arcaNoPlato');
          }
          estadoVale(c, 'depois');
          s.vale.definirInterior(false);
          marcar(c, 'interiorArca', false);
          marcar(c, FLAG_DENTRO_ARCA, false);
          marcar(c, FLAG_DEPOIS);
          s.ceu.tempestade = 0;
          s.ceu.hora = 8;
          s.camera.balanco(0);
          soltar(s.vale.animarAgua(NOE.nivelAgua, 0));
          s.vale.arca.definirPorta(true);
          marcar(c, 'portaArcaAberta');
          posicionarNaArca(c, 'conves1');
          s.audio.ambiente('interiorArca', 0);
          s.audio.ambiente('vento', 0.4);
          s.audio.musica('calmo');
          const saida = lugar(c, 'saidaArca');
          const porta = arca('porta');
          await c.camera(saida.clone().add(new THREE.Vector3(-10, 6, 14)), porta.clone().add(new THREE.Vector3(0, 1.5, 0)), 0);
          await c.fade(false, 1.5);
          const andar = Promise.all(FAMILIA.filter((id) => pessoa(c, id)).map((id, i) => {
            const a = (i / FAMILIA.length) * Math.PI - Math.PI / 2;
            return c.mover(id, { x: saida.x + Math.cos(a) * 4, y: saida.y, z: saida.z + 3 + Math.sin(a) * 2 });
          }));
          await c.dialogo([narrador('Gn 8:18')]);
          await andar;
          // os animais das baias saem com os outros, em procissão, e se espalham pelo vale
          await Promise.all(ANIMAIS_BAIAS.map((_, i) => removerAnimal(`baia${i + 1}`, false)));
          const fila = await Promise.all(PROCISSAO.map((especie, i) =>
            criarAnimal(`saida_${especie}`, especie, porta.x - i * 2.2, porta.z - 1.5, { y: porta.y })));
          fila.forEach((a, i) => {
            soltar((async () => {
              await a.irPara(saida.x + (i % 2 ? 6 : -6), saida.z + 6 + i * 1.5);
              const ang = (i / PROCISSAO.length) * Math.PI * 2;
              await a.irPara(saida.x + Math.cos(ang) * 40, saida.z + 30 + Math.sin(ang) * 25);
              a.vagar(12);
            })());
          });
          await c.dialogo([narrador('Gn 8:19')]);
          // o vale lavado, lamacento e silencioso
          const centro = lugar(c, 'centroVale');
          await c.camera(saida.clone().add(new THREE.Vector3(0, 30, 10)), centro.add(new THREE.Vector3(0, 2, 0)), 5);
          await c.esperar(2);
          await c.cameraVoltar(2);
        });
        marcar(c, 'a6Saida');
      },
    },
    {
      id: 'altar',
      objetivo: 'Construa um altar ao Senhor (Gn 8:20).',
      async executar(c) {
        const s = sv();
        const noe = c.personagem('noe');
        if (!noe.aprendidos.includes('construirAltar')) {
          noe.aprendidos.push('construirAltar');
          c.aviso('Noé aprendeu a construir altares.');
        }
        marcar(c, 'aprendeuAltar');
        if (feito(c, 'a6Altar')) return;
        const pedrasIds = lista('pedraAltar', 6);
        const pedras = () => contarFlags(c, pedrasIds.map((id) => `a6_${id}`));
        s.vale.definirAltar(pedras(), false);
        const objetivo = () =>
          pedras() < 6
            ? c.objetivo(`Construa um altar ao Senhor (Gn 8:20). Junte pedras pelo platô (${pedras()}/6).`, pedrasIds.filter((id) => !feito(c, `a6_${id}`)))
            : c.objetivo('Noé: construa o altar.', ['altarPlato']);
        objetivo();
        const ajustes: Record<string, AjusteInterativo> = { altarPlato: { ativo: () => pedras() >= 6 } };
        for (const id of pedrasIds) ajustes[id] = { ativo: () => !feito(c, `a6_${id}`) };
        await comEtapa(c, 'a6.altar', ajustes, async (reg) => {
          for (const id of pedrasIds) if (feito(c, `a6_${id}`)) reg.tirar(id);
          for (;;) {
            const { id, personagem: p } = await interacaoEntre(c, [...pedrasIds, 'altarPlato']);
            if (id === 'altarPlato') {
              if (pedras() >= 6) break;
              continue;
            }
            if (feito(c, `a6_${id}`)) continue;
            marcar(c, `a6_${id}`);
            reg.tirar(id);
            marcar(c, 'altarPedras', pedras());
            s.vale.definirAltar(pedras(), false);
            c.contador('pedras', pedras());
            c.treinar(p.id, 'forca', 0.15);
            objetivo();
          }
        });
        c.xp('noe', 'construir');
        await c.cena(async () => {
          const altar = lugar(c, 'altarPlato');
          s.vale.definirAltar(6, true);
          marcar(c, 'altarFogo');
          s.audio.efeito('fogo');
          s.audio.ambiente('fogueira', 0.6);
          await c.camera(altar.clone().add(new THREE.Vector3(7, 4, 8)), altar.clone().add(new THREE.Vector3(0, 1.2, 0)), 2);
          await c.mover('sem', { x: altar.x + 1.8, y: altar.y, z: altar.z + 1.4 });
          pose(c, 'sem', CLIPE_ORACAO);
          await c.dialogo([narrador('Gn 8:20')]);
          await vozDeDeus(c, [
            deus('Gn 8:21', 'Eu não amaldiçoarei novamente a terra por causa do homem;'),
            deus('Gn 8:22'),
          ], 0.45);
          pose(c, 'sem', null);
          await c.cameraVoltar(1.5);
        });
        c.xp('grupo', 'disciplina');
        c.treinar('noe', 'comunhao', 0.6);
        c.treinar('sem', 'comunhao', 0.6);
        marcar(c, 'a6Altar');
      },
    },
    {
      id: 'bencao',
      objetivo: '',
      async executar(c) {
        const s = sv();
        if (feito(c, 'a6Bencao')) return;
        await c.cena(async () => {
          await vozDeDeus(c, [
            deus('Gn 9:1', 'Sede frutíferos e multiplicai-vos, e enchei a terra.'),
            deus('Gn 9:9'),
            deus('Gn 9:11'),
          ], 0.4);
          s.audio.musica('gloria');
          const noe = c.personagem('noe').posicao;
          await c.camera(noe.clone().add(new THREE.Vector3(0, 3, -7)), noe.clone().add(new THREE.Vector3(0, 30, 90)), 2.5);
          await animarCeu(c, 'arco', 1, 4);
          marcar(c, 'arcoIrisNoCeu');
          await c.dialogo([
            deus('Gn 9:12', 'Este é o sinal do pacto que fiz entre mim e vós, e toda criatura vivente que está convosco, para as gerações perpétuas.'),
            deus('Gn 9:13'),
          ]);
          await c.cameraVoltar(2);
        });
        c.memoria('arcoIris');
        c.aviso('Esta memória atravessará as gerações.');
        c.versiculo('Gn 9:16');
        marcar(c, 'a6Bencao');
      },
    },
    {
      id: 'explorar',
      objetivo: 'Antes de partir, caminhe pelo vale renovado.',
      async executar(c) {
        const s = sv();
        const altar = lugar(c, 'altarPlato');
        aproximarSeLonge(c, 'sem', altar.clone().add(new THREE.Vector3(2, 0, 2)), 12);
        const sem = c.personagem('sem');
        if (!sem.controlado) sem.ia.esperar();
        c.objetivo('Antes de partir, caminhe pelo vale renovado. Para seguir, fale com Sem junto do altar.', [{ personagem: 'sem' }]);
        const conversados = new Set<string>();
        const presentes = CONVERSAS_A6.filter((id) => pessoa(c, id));
        const ajustes: Record<string, AjusteInterativo> = {};
        for (const id of presentes) ajustes[idConversa(id)] = { ativo: () => !conversados.has(id) && c.ativo().id !== id };
        const reg = registrarDefs(c.mundo as MundoBase, s, [...presentes.map(interativoConversa), INTERATIVO_FALAR_SEM], ajustes);
        try {
          for (;;) {
            const { id } = await interacaoEntre(c, reg.ids);
            if (id === INTERATIVO_FALAR_SEM.id) break;
            const quem = id.slice('conversa_'.length);
            if (conversados.has(quem)) continue;
            conversados.add(quem);
            reg.tirar(id);
            await c.dialogo(CONVERSAS_RECOMECO[quem] ?? []);
          }
        } finally {
          reg.remover();
        }
      },
    },
    {
      id: 'transicao',
      objetivo: '',
      async executar(c) {
        const s = sv();
        await c.cena(async () => {
          await c.dialogo([
            ficcao('sem', 'Pai, de nós sairão todas as famílias da terra?'),
            ficcao('noe', 'Deus prometeu uma Semente. Guardemos a promessa, de geração em geração.', 'reverente'),
          ]);
          await s.transicaoEra(GENEALOGIA_NOE);
          s.cristo('linhagem');
          await c.titulo('Era 2 — Abraão', 'Gênesis 12–22');
        });
      },
    },
  ],
};

/** Prólogo + A1–A6, na ordem. A6 não tem `proxima`: a era 2 começa pela transição (ver ERA_NOE.seguinte). */
export const MISSOES_NOE: DefMissao[] = [PROLOGO, A1, A2, A3, A4, A5, A6];

export function missaoNoe(id: string): DefMissao {
  const m = MISSOES_NOE.find((x) => x.id === id);
  if (!m) throw new Error(`Missão desconhecida na era de Noé: ${id}`);
  return m;
}

/** Todas as etapas, como "missao.etapa". */
export function etapasNoe(): { missao: string; etapa: DefEtapa }[] {
  return MISSOES_NOE.flatMap((m) => m.etapas.map((etapa) => ({ missao: m.id, etapa })));
}
