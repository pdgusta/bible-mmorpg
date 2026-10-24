// Atalhos de depuração da era de Noé: resolvem cada etapa pelas mesmas APIs do jogo
// (teleportar, usar interativos — que emitem 'interacao' {id, personagem} —, resolver provas
// com `resolverAutomaticamente()`), para o e2e jogar do início ao fim. Diálogos e
// cinemáticas não são resolvidos aqui: o e2e precisa avançá-los (ou pulá-los).
import type { EstadoMissao } from '../../jogo/contratos';
import type { Personagem } from '../../jogo/Personagem';
import { Interativos, type Interativo } from '../../jogo/Interacoes';
import {
  PARES_A4, PAR_PERDIDO, idAcalmar, resolverLugar, type LugarNoe, type MundoBase,
} from './interativos';
import { missaoNoe } from './missoes';
import { IDS_JOGAVEIS_NOE } from './personagens';
import type { ServicosNoe } from './servicos';

export interface AmbienteAtalhosNoe {
  mundo: MundoBase;
  servicos: Pick<ServicosNoe, 'vale' | 'controlar'>;
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
export class AtalhosNoe {
  constructor(readonly a: AmbienteAtalhosNoe) {}

  personagem(id: string): Personagem {
    const p = this.a.mundo.personagens.get(id);
    if (!p) throw new Error(`atalho: personagem ausente: ${id}`);
    return p;
  }

  flag(nome: string): boolean {
    return !!this.a.flags[nome];
  }

  contador(nome: string): number {
    return this.a.estado()?.contadores[nome] ?? 0;
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

  private disponivel(id: string): boolean {
    const i = this.interativo(id);
    return !!i && Interativos.ativo(i);
  }

  /** Retrato do estado para saber se uma ação teve efeito. */
  private foto(id: string): string {
    const e = this.a.estado();
    const pessoas = IDS_JOGAVEIS_NOE.map((pid) => {
      const p = this.a.mundo.personagens.get(pid);
      return p ? `${pid}:${p.carregando ?? ''}:${p.posto?.id ?? ''}` : pid;
    });
    return JSON.stringify([e?.id, e?.etapa, e?.status, e?.contadores, this.a.flags, pessoas, this.disponivel(id), this.a.emProva()]);
  }

  /** Leva alguém até um lugar (teleporte). 'ativo' = quem o jogador controla. */
  chegar(quem: string, l: LugarNoe) {
    const p = quem === 'ativo' ? this.a.ativo() : this.personagem(quem);
    if (p.escalada) p.sairEscalada('aqui');
    const v = resolverLugar(this.a.mundo, this.a.servicos, l);
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
  async manterAte(quem: string, l: LugarNoe, cond: () => boolean, oque: string, limite = this.a.limite ?? 300) {
    let t = 0;
    while (!cond()) {
      if (t > limite) throw new Error(`atalho: tempo esgotado esperando ${oque}`);
      this.chegar(quem, l);
      await this.a.esperar(0.5);
      t += 0.5;
    }
  }

  /** Mantém alguém num lugar por alguns segundos. */
  async manterPor(quem: string, l: LugarNoe, segundos: number) {
    for (let t = 0; t < segundos; t += 0.5) {
      this.chegar(quem, l);
      await this.a.esperar(0.5);
    }
  }

  /** Usa um interativo com um personagem (espera ele aparecer e repete se o uso se perder). */
  async usar(id: string, quem: string) {
    await this.esperarAte(() => this.disponivel(id), `o interativo ${id}`);
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const i = this.interativo(id);
      if (!i || !Interativos.ativo(i)) return;
      const p = this.personagem(quem);
      if (p.escalada) p.sairEscalada('aqui');
      if (p.posto && p.posto.id !== id) p.sairPosto();
      p.teleportar(i.pos.x + 0.5, i.pos.y + 0.05, i.pos.z + 0.5);
      const antes = this.foto(id);
      if (this.a.usar) await this.a.usar(p, id);
      else {
        if (i.posto) p.entrarPosto(id, i.posto.clipe ?? 'segurar', i.posto.yaw ?? p.yaw, i.posto.descricao);
        await i.aoInteragir(p);
        this.a.emitir('interacao', { id, personagem: p });
      }
      for (let k = 0; k < 15; k++) {
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
}

type Atalho = (t: AtalhosNoe) => Promise<void>;
const nada: Atalho = async () => {};

async function acalmarPares(t: AtalhosNoe) {
  for (const par of PARES_A4) {
    if (!par.agitado || t.flag(`a4Calmo_${par.especie}`) || t.flag(`a4Par_${par.especie}`)) continue;
    await t.usar(idAcalmar(par.especie), 'sem');
  }
}

async function mantimento(t: AtalhosNoe) {
  const fontes: [string, string][] = [['saco1', 'cam'], ['saco2', 'cam'], ['saco3', 'cam'], ['saco4', 'cam'], ['fruta1', 'jafe'], ['fruta2', 'jafe']];
  for (const [id, quem] of fontes) {
    if (t.flag(`a4Entregue_${id}`)) continue;
    const p = t.personagem(quem);
    if (p.carregando) await t.usar('entregaArca', quem);
    await t.usar(id, quem);
    await t.usar('entregaArca', quem);
  }
}

/** Atalho de cada etapa, por missão. */
export const ATALHOS_NOE: Record<string, Record<string, Atalho>> = {
  prologo: { cinematica: nada },
  a1: {
    async orar(t) {
      t.controlar('noe');
      await t.manterPor('noe', 'orarMonte', 1);
      await t.usar('orarMonte', 'noe');
    },
    async madeira(t) {
      await t.manterAte('ativo', { personagem: 'cam' }, t.etapaMudou(), 'a conversa com Cam');
    },
    async troncos(t) {
      while (t.contador('troncos') < 4 && t.a.estado()?.id === 'a1') {
        const cam = t.personagem('cam');
        if (cam.carregando !== 'tronco') await t.usar('pilhaBosque', 'cam');
        await t.usar('entregaTroncos', 'cam');
      }
    },
    async quilha(t) {
      await t.usar('quilha', 'noe');
    },
  },
  a2: {
    async planejar(t) {
      await t.manterAte('ativo', 'guincho', t.etapaMudou(), 'a conversa no estaleiro');
    },
    async erguer(t) {
      if (!t.flag('vigaAmarrada')) {
        await t.usar('guincho', 'cam');
        await t.usar('ancoraCorda', 'jafe');
      }
      if (!t.flag('a2Encaixe1')) await t.usar('encaixeViga1', 'noe');
      if (!t.flag('a2Encaixe2')) await t.usar('encaixeViga2', 'noe');
    },
    async betume(t) {
      if (t.personagem('noe').carregando !== 'balde') await t.usar('caldeirao', 'noe');
      for (const id of ['betumarCasco1', 'betumarCasco2', 'betumarCasco3']) if (!t.flag(`a2_${id}`)) await t.usar(id, 'noe');
    },
    anos: nada,
  },
  a3: {
    async ir(t) {
      t.controlar('noe');
      const fim = t.etapaMudou();
      await t.manterPor('noe', 'entradaCidade', 1.5);
      await t.manterAte('noe', 'praca', fim, 'a praça');
    },
    async pregar(t) {
      for (const [id, flag] of [['pregarPraca', 'a3Praca'], ['pregarMercado', 'a3Mercado'], ['pregarTorre', 'a3Torre']]) {
        if (t.flag(flag)) continue;
        await t.usar(id, 'noe');
        await t.prova();
      }
    },
    async tentacao(t) {
      const fim = t.etapaMudou();
      await t.manterAte('noe', 'torre', () => t.a.emProva() || fim(), 'a tentação junto à torre');
      if (!fim()) await t.prova();
    },
  },
  a4: {
    chamado: nada,
    async animais(t) {
      await Promise.all([acalmarPares(t), mantimento(t)]);
    },
    mantimento,
    async parPerdido(t) {
      if (!t.flag('a4AchouPar')) await t.usar('gruta', 'jafe');
      const fim = t.etapaMudou();
      await t.usar(idAcalmar(PAR_PERDIDO), 'sem');
      await t.manterAte('sem', 'portaArca', fim, 'o par perdido na arca');
    },
    async entrar(t) {
      await t.manterAte('ativo', { arca: 'porta' }, t.etapaMudou(), 'a família na arca');
    },
  },
  a5: {
    porta: nada,
    async fontes(t) {
      if (t.flag('a5Fontes')) return;
      await t.usar('bomba', 'cam');
      while (!t.flag('a5Fontes') && t.a.estado()?.id === 'a5') {
        for (let n = 1; n <= 4; n++) {
          const i = t.a.mundo.interativos.obter(`vazamento${n}`);
          if (i && Interativos.ativo(i)) await t.usar(`vazamento${n}`, 'noe');
        }
        await t.a.esperar(0.5);
      }
    },
    async inquietos(t) {
      for (const id of ['baia1', 'baia2', 'baia3']) if (!t.flag(`a5_${id}`)) await t.usar(id, 'sem');
      for (const id of ['rede1', 'rede2']) if (!t.flag(`a5_${id}`)) await t.usar(id, 'jafe');
    },
    async medo(t) {
      if (t.flag('a5Medo')) return;
      t.controlar('noe');
      const fim = t.etapaMudou();
      await t.manterAte('noe', { arca: 'familia' }, () => t.a.emProva() || fim(), 'a prova do medo');
      if (!fim()) await t.prova();
    },
    async janela(t) {
      if (!t.flag('janelaAberta')) await t.usar('janela', 'jafe');
      if (!t.flag('a5Corvo')) await t.usar('soltarCorvo', 'noe');
      for (const [flag, volta] of [['a5Pomba1', true], ['a5Pomba2', true], ['a5Pomba3', false]] as const) {
        if (t.flag(flag)) continue;
        await t.usar('soltarPomba', 'noe');
        if (volta) await t.usar('receberPomba', 'noe');
        await t.esperarAte(() => t.flag(flag), flag);
      }
    },
    saida: nada,
  },
  a6: {
    sair: nada,
    async altar(t) {
      for (let n = 1; n <= 6; n++) if (!t.flag(`a6_pedraAltar${n}`)) await t.usar(`pedraAltar${n}`, 'noe');
      if (!t.flag('a6Altar')) await t.usar('altarPlato', 'noe');
    },
    bencao: nada,
    async explorar(t) {
      await t.usar('falarSem', 'noe');
    },
    transicao: nada,
  },
};

/** Resolve uma etapa (missão e etapa pelos ids). */
export async function resolverEtapaNoe(a: AmbienteAtalhosNoe, missao: string, etapa: string) {
  const f = ATALHOS_NOE[missao]?.[etapa];
  if (!f) throw new Error(`atalho: etapa desconhecida ${missao}.${etapa}`);
  await f(new AtalhosNoe(a));
}

/**
 * Joga a era de Noé a partir da missão atual até a transição de era (ou até `ate`, um id de
 * missão): para cada etapa, roda o atalho e espera o motor de missões avançar.
 */
export async function jogarEraNoe(a: AmbienteAtalhosNoe, opts: { ate?: string; aoEtapa?: (missao: string, etapa: string) => void } = {}) {
  const t = new AtalhosNoe(a);
  for (;;) {
    const e = a.estado();
    if (!e || !ATALHOS_NOE[e.id]) return;
    if (opts.ate && e.id === opts.ate) return;
    // o motor pode mudar o mesmo objeto de estado: guarda os valores de agora
    const id = e.id;
    const indice = e.etapa;
    const m = missaoNoe(id);
    const etapa = m.etapas[indice];
    if (e.status === 'concluida' || !etapa) {
      if (!m.proxima) return;
      await t.esperarAte(() => a.estado()?.id !== id, `a missão seguinte a ${id}`);
      continue;
    }
    opts.aoEtapa?.(id, etapa.id);
    await ATALHOS_NOE[id][etapa.id](t);
    await t.esperarAte(() => {
      const x = a.estado();
      return !x || x.id !== id || x.etapa !== indice || x.status === 'concluida';
    }, `o fim da etapa ${id}.${etapa.id}`);
  }
}
