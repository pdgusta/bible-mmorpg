// Ligação da era 2 (Abraão, Gn 12–22): monta Canaã (MundoCanaa), cria a família, os pastores,
// os servos e os aliados, implementa os ServicosAbraao que as missões usam (Canaã, céu, áudio,
// animais e rebanhos, câmera, entrada, Cristo, NPCs de cena, créditos), reconstrói Canaã pelas
// flags e informa o áudio de área.
import { MundoCanaa } from '../../eras/abraao/construir';
import { CANAA } from '../../eras/abraao/mapa';
import {
  ERA_ABRAAO, CRISTO_ABRAAO, INICIO_ABRAAO, JOGAVEIS_ABRAAO, NPCS_ABRAAO, MEMORIAS_ABRAAO, MISSOES_ABRAAO, IDS_JOGAVEIS_ABRAAO,
  jogarEraAbraao, ligarServicosAbraao, type AmbienteAtalhosAbraao, type AnimalAbraao, type OpcoesAnimalAbraao,
  type RebanhoAbraao, type ServicosAbraao,
} from '../../eras/abraao';
import { Animal, criarAnimal, ESPECIES, type Especie } from '../../entidades/Animal';
import { Rebanho } from '../../entidades/Rebanho';
import type { ContextoEra, DefEra, EraAtiva, OpcoesAtalhos, VistaTitulo } from '../eras';
import type { AmbienteEra, Superficie } from './audio';
import { desvio, estadoMissaoAtual, reiniciarPessoa, removerPersonagem } from './comum';

/** Todos os personagens da era que vivem em Canaã (jogáveis primeiro). */
const TODOS = [...JOGAVEIS_ABRAAO, ...NPCS_ABRAAO];

class EraAbraao implements EraAtiva {
  readonly def = ERA_ABRAAO_JOGO;
  readonly canaa: MundoCanaa;
  readonly servicos: ServicosAbraao;
  sujo = false;
  private desligar_: (() => void)[] = [];

  constructor(private ctx: ContextoEra) {
    this.canaa = new MundoCanaa(ctx.jogo.natureza);
    this.canaa.ceu = ctx.jogo.ceu;
    this.servicos = this.criarServicos();
  }

  get mundo() {
    return this.canaa.mundo;
  }

  private criarServicos(): ServicosAbraao {
    const { jogo, s, audio } = this.ctx;
    const canaa = this.canaa;
    return {
      canaa,
      ceu: jogo.ceu,
      audio: {
        ambiente: (nome, i) => audio.ambiente(nome, i),
        musica: (nome) => audio.musica(nome),
        efeito: (nome) => audio.efeito(nome),
      },
      animais: {
        criar: async (especie: string, x: number, z: number, o: OpcoesAnimalAbraao = {}): Promise<AnimalAbraao> => {
          let e = especie as Especie;
          if (!(e in ESPECIES)) {
            console.warn(`[era abraao] espécie desconhecida "${especie}": usando ovelha`);
            e = 'ovelha';
          }
          return criarAnimal(e, canaa.mundo, x, z, { ativos: jogo.ativos, y: o.y, yaw: o.yaw, sexo: o.sexo, tom: o.tom });
        },
        rebanho: (animais: AnimalAbraao[]): RebanhoAbraao => {
          const r = new Rebanho(animais as Animal[]);
          canaa.mundo.atualizaveis.add(r);
          return r as unknown as RebanhoAbraao;
        },
        soltarRebanho: (r: RebanhoAbraao) => {
          canaa.mundo.atualizaveis.delete(r as unknown as Rebanho);
        },
      },
      progresso: s.progresso,
      camera: {
        tremer: (i, seg) => jogo.cam.tremer(i, seg),
      },
      entrada: jogo.entrada,
      aCadaQuadro: (fn) => jogo.aCadaQuadro(fn),
      cristo: (id) => this.ctx.cristo(id),
      controlar: (id) => {
        const p = canaa.mundo.personagens.get(id);
        if (!p || jogo.ativo === p) return;
        jogo.controlar(p);
        if (!jogo.cam.externo) jogo.cam.encaixar(p.posicao, p.yaw, canaa.mundo.fisica);
      },
      liberarPosto: (idPosto) => {
        const p = jogo.controle.ocupante(idPosto);
        if (p) jogo.controle.liberarPosto(p);
      },
      emitir: (evento, dados) => jogo.eventos.emit(evento, dados),
      criarPersonagem: (def, x, z, yaw) => jogo.criarPersonagem(def, x, z, yaw ?? 0),
      removerPersonagem: (id) => removerPersonagem(jogo, canaa.mundo, id),
      creditos: () => this.ctx.creditos(),
    };
  }

  private inicio(id: string, i: number): [number, number, number] {
    const ini = INICIO_ABRAAO[id];
    const [x, z] = this.mundo.pontos.get(ini?.lugar ?? 'chegada') ?? CANAA.more;
    const [dx, dz] = desvio(i);
    return [x + dx, z + dz, ini?.yaw ?? 0];
  }

  /** Índice de quem começa no mesmo lugar (para espalhar). */
  private ordemNoLugar(): Map<string, number> {
    const contagem = new Map<string, number>();
    const out = new Map<string, number>();
    for (const d of TODOS) {
      const lugar = INICIO_ABRAAO[d.id]?.lugar ?? 'chegada';
      const n = contagem.get(lugar) ?? 0;
      contagem.set(lugar, n + 1);
      out.set(d.id, n);
    }
    return out;
  }

  criarPersonagens() {
    const { jogo } = this.ctx;
    const ordem = this.ordemNoLugar();
    for (const d of TODOS) {
      if (this.mundo.personagens.has(d.id)) continue;
      const [x, z, yaw] = this.inicio(d.id, ordem.get(d.id) ?? 0);
      jogo.criarPersonagem(d, x, z, yaw);
    }
    jogo.troca.ordem = [...IDS_JOGAVEIS_ABRAAO];
  }

  posicoesIniciais() {
    const { jogo } = this.ctx;
    const ordem = this.ordemNoLugar();
    for (const p of this.mundo.personagens.values()) {
      reiniciarPessoa(jogo, p);
      const [x, z, yaw] = this.inicio(p.id, ordem.get(p.id) ?? 0);
      p.teleportar(x, this.mundo.chao(x, z), z, yaw);
    }
    // quem foi removido volta
    this.criarPersonagens();
  }

  ligar() {
    const { jogo } = this.ctx;
    ERA_ABRAAO.ligarServicos(this.servicos);
    this.desligar_.push(ERA_ABRAAO.registrarSegredos(this.mundo, this.servicos, jogo.flags));
    // o mundo deixa de ser "limpo" assim que alguma missão roda nele
    this.desligar_.push(jogo.eventos.on('missao:etapa', () => (this.sujo = true)));
  }

  reconstruir() {
    const { jogo } = this.ctx;
    const ceu = jogo.ceu;
    // brilhos e tempestade que a era anterior ou uma missão abortada possam ter deixado
    ceu.tempestade = 0;
    ceu.arco = 0;
    ceu.gloria = 0;
    jogo.cam.balanco(0);
    ERA_ABRAAO.reconstruir(this.servicos, this.mundo, jogo.flags);
  }

  vistaTitulo(): VistaTitulo {
    const [x, z] = CANAA.acampamentoBetel;
    return { centro: [x, 8, z], raio: 120, altura: 46, hora: 6.3 };
  }

  ambiente(): AmbienteEra {
    const h = this.ctx.jogo.ceu.hora;
    const noite = h >= 19.5 || h < 5;
    return {
      ambientes: { canaa: noite ? 0 : 0.6, noite: noite ? 0.6 : 0 },
      superficie: (): Superficie => 'terra',
    };
  }

  desligar() {
    for (const f of this.desligar_.splice(0)) f();
    // o mundo vai ser descartado: os animais dele saem de Animal.todos (senão entram na
    // separação dos animais da era seguinte) e as missões esquecem animais, rebanhos e a
    // mecânica de cena
    Animal.descartar(this.mundo);
    ligarServicosAbraao(null);
    ERA_ABRAAO.limparCena();
  }

  atalhos(op: OpcoesAtalhos) {
    const { jogo, s } = this.ctx;
    const amb: AmbienteAtalhosAbraao = {
      mundo: this.mundo,
      servicos: this.servicos,
      emitir: (e, d) => jogo.eventos.emit(e, d),
      usar: (p, id) => jogo.controle.usar(p, id),
      ativo: () => {
        const a = jogo.ativo;
        if (!a) throw new Error('atalho: ninguém sob controle');
        return a;
      },
      emProva: () => s.provas.emProva,
      resolverProva: () => op.resolverProva(),
      estado: () => estadoMissaoAtual(s),
      flags: jogo.flags,
      esperar: (seg) => op.esperar(seg),
      limite: op.limite,
    };
    return {
      jogar: (o: { ate?: string; aoEtapa?: (m: string, e: string) => void } = {}) => jogarEraAbraao(amb, o),
    };
  }
}

/** A era de Abraão no registro de eras (src/jogo/eras.ts). Última era do MVP: sem `seguinte`. */
export const ERA_ABRAAO_JOGO: DefEra = {
  id: ERA_ABRAAO.id,
  nome: ERA_ABRAAO.nome,
  sub: ERA_ABRAAO.sub,
  protagonista: ERA_ABRAAO.protagonista,
  missaoInicial: ERA_ABRAAO.missaoInicial,
  jogaveis: JOGAVEIS_ABRAAO,
  npcs: NPCS_ABRAAO,
  missoes: MISSOES_ABRAAO,
  memorias: MEMORIAS_ABRAAO,
  cristo: CRISTO_ABRAAO,
  textoCarregamento: 'Erguendo Canaã…',
  horaChegada: 16.5,
  criar: (ctx) => new EraAbraao(ctx),
};
