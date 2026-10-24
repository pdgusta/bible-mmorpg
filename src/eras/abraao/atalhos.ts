// Atalhos de depuração da era de Abraão: resolvem cada etapa pelas mesmas APIs do jogo
// (teleportar, usar interativos — que emitem 'interacao' {id, personagem} —, resolver provas
// com `resolverAutomaticamente()` e as mecânicas em tempo real com `mecanicaAbraao()`), para o
// e2e jogar do início ao fim. Diálogos, escolhas e cinemáticas não são resolvidos aqui: o e2e
// precisa avançá-los (ou pulá-los).
import type { EstadoMissao } from '../../jogo/contratos';
import type { Personagem } from '../../jogo/Personagem';
import { Interativos, type Interativo } from '../../jogo/Interacoes';
import { ID_AMARRAR_CORDA, resolverLugar, type LugarAbraao, type MundoBase } from './interativos';
import { mecanicaAbraao, missaoAbraao, type MecanicaAbraao } from './missoes';
import { IDS_JOGAVEIS_ABRAAO } from './personagens';
import type { ServicosAbraao } from './servicos';

export interface AmbienteAtalhosAbraao {
  mundo: MundoBase;
  servicos: Pick<ServicosAbraao, 'controlar'>;
  /** Barramento do jogo (jogo.eventos.emit). */
  emitir(evento: string, dados: unknown): void;
  /**
   * `Controle.usar(p, id)`: executa a interação como se fosse o jogador (postos e progresso
   * instantâneo). Sem ele, o atalho imita o Controle: entra no posto, chama aoInteragir e
   * emite 'interacao'.
   */
  usar?(p: Personagem, id: string): unknown;
  ativo(): Personagem;
  /** Há prova em andamento? (`Provas.emProva`) */
  emProva(): boolean;
  /** `Provas.resolverAutomaticamente()` */
  resolverProva(): boolean;
  /** Estado da missão atual (do motor de missões), ou null. */
  estado(): EstadoMissao | null;
  flags: Record<string, unknown>;
  /** Espera tempo de jogo. */
  esperar(segundos: number): Promise<void>;
  /** Quanto esperar (s) por algo aparecer antes de desistir. Padrão 300. */
  limite?: number;
}

/** Ações de alto nível usadas pelos atalhos. */
export class AtalhosAbraao {
  constructor(readonly a: AmbienteAtalhosAbraao) {}

  personagem(id: string): Personagem {
    const p = this.a.mundo.personagens.get(id);
    if (!p) throw new Error(`atalho: personagem ausente: ${id}`);
    return p;
  }

  flag(nome: string): boolean {
    return !!this.a.flags[nome];
  }

  controlar(id: string) {
    this.a.servicos.controlar(id);
  }

  async esperarAte(cond: () => boolean, oque: string, limite = this.a.limite ?? 300) {
    let t = 0;
    while (!cond()) {
      if (t > limite) throw new Error(`atalho: tempo esgotado esperando ${oque}`);
      await this.a.esperar(0.1);
      t += 0.1;
    }
  }

  private interativo(id: string): Interativo | undefined {
    return this.a.mundo.interativos.obter(id);
  }

  /** O interativo existe e está ativo agora? */
  disponivel(id: string): boolean {
    const i = this.interativo(id);
    return !!i && Interativos.ativo(i);
  }

  /** Retrato do estado para saber se uma ação teve efeito. */
  private foto(id: string): string {
    const e = this.a.estado();
    const pessoas = IDS_JOGAVEIS_ABRAAO.map((pid) => {
      const p = this.a.mundo.personagens.get(pid);
      return p ? `${pid}:${p.carregando ?? ''}:${p.posto?.id ?? ''}` : pid;
    });
    return JSON.stringify([e?.id, e?.etapa, e?.status, e?.contadores, this.a.flags, pessoas, this.disponivel(id), this.a.emProva()]);
  }

  /** Leva alguém até um lugar (teleporte). 'ativo' = quem o jogador controla. */
  chegar(quem: string, l: LugarAbraao) {
    const p = quem === 'ativo' ? this.a.ativo() : this.personagem(quem);
    if (p.escalada) p.sairEscalada('aqui');
    const v = resolverLugar(this.a.mundo, l);
    p.teleportar(v.x + 0.4, v.y + 0.05, v.z + 0.4);
  }

  /** Função que diz se a etapa atual (de agora) já terminou. */
  etapaMudou(): () => boolean {
    const e = this.a.estado();
    const id = e?.id;
    const etapa = e?.etapa;
    return () => {
      const x = this.a.estado();
      return !x || x.id !== id || x.etapa !== etapa || x.status === 'concluida';
    };
  }

  /**
   * Leva alguém a um lugar e o mantém lá até a condição (o começo da etapa pode reposicionar
   * as pessoas depois do primeiro teleporte).
   */
  async manterAte(quem: string, l: LugarAbraao, cond: () => boolean, oque: string, limite = this.a.limite ?? 300) {
    let t = 0;
    while (!cond()) {
      if (t > limite) throw new Error(`atalho: tempo esgotado esperando ${oque}`);
      this.chegar(quem, l);
      await this.a.esperar(0.5);
      t += 0.5;
    }
  }

  /**
   * Usa um interativo com um personagem (espera ele aparecer e repete se o uso se perder, por
   * exemplo durante uma cinemática). Só teleporta quem está fora do raio: o sinal de B3 fica
   * no próprio Abrão.
   */
  async usar(id: string, quem: string) {
    await this.esperarAte(() => this.disponivel(id), `o interativo ${id}`);
    const limite = this.a.limite ?? 300;
    for (let t = 0; t <= limite; ) {
      const i = this.interativo(id);
      if (!i || !Interativos.ativo(i)) return;
      const p = this.personagem(quem);
      if (p.escalada) p.sairEscalada('aqui');
      if (p.posto && p.posto.id !== id) p.sairPosto();
      if (p.posicao.distanceTo(i.pos) > i.raio) p.teleportar(i.pos.x + 0.5, i.pos.y + 0.05, i.pos.z + 0.5);
      const antes = this.foto(id);
      if (this.a.usar) await this.a.usar(p, id);
      else {
        if (i.posto) p.entrarPosto(id, i.posto.clipe ?? 'segurar', i.posto.yaw ?? p.yaw, i.posto.descricao);
        await i.aoInteragir(p);
        this.a.emitir('interacao', { id, personagem: p });
      }
      for (let k = 0; k < 15; k++, t += 0.1) {
        await this.a.esperar(0.1);
        if (this.foto(id) !== antes) return;
      }
    }
    throw new Error(`atalho: usar ${id} (${quem}) não teve efeito`);
  }

  /** Espera a prova começar e a vence na hora. */
  async prova() {
    await this.esperarAte(() => this.a.emProva(), 'a prova');
    this.a.resolverProva();
    await this.esperarAte(() => !this.a.emProva(), 'o fim da prova');
  }

  /**
   * Resolve a mecânica em tempo real da etapa (rebanhos, furtividade, batalha) até a condição
   * (ou até a etapa terminar).
   */
  async mecanica(nome: MecanicaAbraao['nome'], cond: () => boolean) {
    const fim = this.etapaMudou();
    const pronto = () => cond() || fim();
    await this.esperarAte(() => mecanicaAbraao()?.nome === nome || pronto(), `a mecânica ${nome}`);
    while (!pronto()) {
      const m = mecanicaAbraao();
      if (m?.nome === nome) m.resolverAutomaticamente();
      await this.a.esperar(0.5);
    }
  }
}

type Atalho = (t: AtalhosAbraao) => Promise<void>;
const nada: Atalho = async () => {};

/** Atalho de cada etapa, por missão. */
export const ATALHOS_ABRAAO: Record<string, Record<string, Atalho>> = {
  b1: {
    chegada: nada,
    async altarMore(t) {
      t.controlar('abraao');
      if (!t.flag('b1PromessaTerra')) await t.manterAte('abraao', 'more', () => t.flag('b1PromessaTerra'), 'a promessa em Moré');
      if (!t.flag('b1AltarMore')) await t.usar('altarMore', 'abraao');
    },
    async acampar(t) {
      t.controlar('abraao');
      if (!t.flag('b1NoMonte')) await t.manterAte('abraao', 'acampamentoBetel', () => t.flag('b1NoMonte'), 'a chegada ao monte');
      for (const [n, tenda] of [[1, 'tendaAbrao'], [2, 'tendaSara']] as const) {
        if (t.flag(`tendaMontada_${tenda}`)) continue;
        await t.usar(`mastroTenda${n}`, 'eliezer');
        await t.usar(`amarrarTenda${n}`, 'sara');
      }
    },
    async invocar(t) {
      if (!t.flag('b1AltarBetel')) await t.usar('altarBetel', 'abraao');
      await t.usar('orarBetel', 'abraao');
    },
  },
  b2: {
    muitos: nada,
    async separar(t) {
      t.controlar('lo');
      await t.mecanica('rebanhos', () => t.flag('b2Separados'));
    },
    async pastores(t) {
      t.controlar('abraao');
      await t.usar('falarPastores', 'abraao');
    },
    async abraoELo(t) {
      t.controlar('abraao');
      await t.manterAte('abraao', 'miranteJordao', () => t.flag('loPartiu'), 'Ló no mirante');
    },
    async percorrer(t) {
      for (const id of ['miranteNorte', 'miranteSul', 'miranteLeste', 'miranteOeste']) if (!t.flag(`b2_${id}`)) await t.usar(id, 'abraao');
    },
    async manre(t) {
      t.controlar('abraao');
      if (!t.flag('emManre')) await t.manterAte('abraao', 'acampamentoManre', () => t.flag('emManre'), 'a mudança para Manre');
      if (!t.flag('b2AltarManre')) await t.usar('altarManre', 'abraao');
    },
  },
  b3: {
    noticia: nada,
    async dividir(t) {
      if (t.flag('b3Sinal')) return;
      await t.mecanica('furtividade', () => t.disponivel('sinal'));
      await t.usar('sinal', 'abraao');
    },
    async ataque(t) {
      await t.mecanica('batalha', () => t.flag('b3Batalha'));
    },
    async libertar(t) {
      for (let n = 1; n <= 4; n++) if (!t.flag(`b3_cativo${n}`)) await t.usar(`cativo${n}`, 'eliezer');
      if (!t.flag('b3_cativo5')) await t.usar('cativo5', 'abraao');
    },
    async melquisedeque(t) {
      if (!t.flag('b3Dizimo')) await t.usar('dizimo', 'abraao');
    },
    async nemUmFio(t) {
      if (!t.flag('b3NemUmFio')) await t.prova();
    },
  },
  b4: {
    visao: nada,
    async fora(t) {
      t.controlar('abraao');
      await t.manterAte('abraao', 'ceuEstrelas', t.etapaMudou(), 'Abrão fora da tenda');
    },
    async duvida(t) {
      if (!t.flag('b4Duvida')) await t.prova();
    },
    creu: nada,
  },
  b5: {
    nomes: nada,
    prova: nada,
    async pe(t) {
      t.controlar('abraao');
      if (!t.flag('b5Pe')) await t.manterAte('abraao', 'peMoria', () => t.flag('b5Pe'), 'o pé do Moriá');
    },
    async subida(t) {
      t.controlar('abraao');
      if (!t.flag('b5Corda')) await t.usar(ID_AMARRAR_CORDA, 'isaque');
      if (!t.flag('b5Parede')) await t.manterAte('abraao', 'cordaMoria', () => t.flag('b5Parede'), 'a subida pela corda');
      if (!t.flag('b5Fosso')) await t.manterAte('ativo', 'estreitoFim', () => t.flag('b5Fosso'), 'a passagem estreita');
      if (!t.flag('b5Pergunta')) await t.manterAte('ativo', 'patamarMoria', () => t.flag('b5Pergunta'), 'a pergunta no patamar');
      if (!t.flag('b5Medo')) {
        await t.manterAte('ativo', 'subidaFinal', () => t.a.emProva() || t.flag('b5Medo'), 'a prova do medo');
        if (!t.flag('b5Medo')) await t.prova();
      }
      await t.manterAte('abraao', 'topoMoria', () => t.flag('b5Topo'), 'o topo do Moriá');
    },
    async altar(t) {
      if (!t.flag('b5AltarFeito')) await t.usar('altarMoria', 'abraao');
    },
    async carneiro(t) {
      if (!t.flag('b5Carneiro')) await t.usar('carneiro', 'abraao');
    },
    promessa: nada,
  },
};

/** Resolve uma etapa (missão e etapa pelos ids). */
export async function resolverEtapaAbraao(a: AmbienteAtalhosAbraao, missao: string, etapa: string) {
  const f = ATALHOS_ABRAAO[missao]?.[etapa];
  if (!f) throw new Error(`atalho: etapa desconhecida ${missao}.${etapa}`);
  await f(new AtalhosAbraao(a));
}

/**
 * Joga a era de Abraão a partir da missão atual até o fim de B5 (ou até `ate`, um id de
 * missão): para cada etapa, roda o atalho e espera o motor de missões avançar.
 */
export async function jogarEraAbraao(a: AmbienteAtalhosAbraao, opts: { ate?: string; aoEtapa?: (missao: string, etapa: string) => void } = {}) {
  const t = new AtalhosAbraao(a);
  for (;;) {
    const e = a.estado();
    if (!e || !ATALHOS_ABRAAO[e.id]) return;
    if (opts.ate && e.id === opts.ate) return;
    // o motor pode mudar o mesmo objeto de estado: guarda os valores de agora
    const id = e.id;
    const indice = e.etapa;
    const m = missaoAbraao(id);
    const etapa = m.etapas[indice];
    if (e.status === 'concluida' || !etapa) {
      if (!m.proxima) return;
      await t.esperarAte(() => a.estado()?.id !== id, `a missão seguinte a ${id}`);
      continue;
    }
    opts.aoEtapa?.(id, etapa.id);
    await ATALHOS_ABRAAO[id][etapa.id](t);
    await t.esperarAte(() => {
      const x = a.estado();
      return !x || x.id !== id || x.etapa !== indice || x.status === 'concluida';
    }, `o fim da etapa ${id}.${etapa.id}`);
  }
}
