// Ligação da era 1 (Noé, Gn 6–9): monta o vale (MundoNoe), cria a família e a cidade,
// implementa os ServicosNoe que as missões usam (vale, céu, áudio, animais, câmera, Cristo,
// transição de era...), reconstrói o vale pelas flags e informa o áudio de área.
import * as THREE from 'three';
import { MundoNoe } from '../../eras/noe/construir';
import { NOE, RIO } from '../../eras/noe/mapa';
import {
  ERA_NOE, CRISTO_NOE, INICIO_NOE, JOGAVEIS_NOE, NPCS_NOE, MEMORIAS_NOE, MISSOES_NOE, GENEALOGIA_NOE,
  jogarEraNoe, ponto2, type AmbienteAtalhosNoe, type AnimalNoe, type OpcoesAnimalNoe, type ServicosNoe,
} from '../../eras/noe';
import { Animal, criarAnimal, ESPECIES, type Especie } from '../../entidades/Animal';
import { distPolilinha } from '../../mundo/Relevo';
import type { Personagem } from '../Personagem';
import type { ContextoEra, DefEra, EraAtiva, OpcoesAtalhos, VistaTitulo } from '../eras';
import type { AmbienteEra, Superficie } from './audio';
import { desvio, estadoMissaoAtual, reiniciarPessoa, removerPersonagem } from './comum';

/** Todos os personagens da era (jogáveis primeiro). */
const TODOS = [...JOGAVEIS_NOE, ...NPCS_NOE];

class EraNoe implements EraAtiva {
  readonly def = ERA_NOE_JOGO;
  readonly vale: MundoNoe;
  readonly servicos: ServicosNoe;
  sujo = false;
  private desligar_: (() => void)[] = [];

  constructor(private ctx: ContextoEra) {
    this.vale = new MundoNoe(ctx.jogo.natureza);
    this.servicos = this.criarServicos();
  }

  get mundo() {
    return this.vale.mundo;
  }

  private criarServicos(): ServicosNoe {
    const { jogo, s, audio } = this.ctx;
    const vale = this.vale;
    return {
      vale,
      ceu: jogo.ceu,
      audio: {
        ambiente: (nome, i) => audio.ambiente(nome, i),
        musica: (nome) => audio.musica(nome),
        efeito: (nome) => audio.efeito(nome),
      },
      animais: {
        criar: async (especie: string, x: number, z: number, o: OpcoesAnimalNoe = {}): Promise<AnimalNoe> => {
          let e = especie as Especie;
          if (!(e in ESPECIES)) {
            console.warn(`[era noe] espécie desconhecida "${especie}": usando ovelha`);
            e = 'ovelha';
          }
          return criarAnimal(e, vale.mundo, x, z, { ativos: jogo.ativos, y: o.y, yaw: o.yaw, sexo: o.sexo });
        },
      },
      progresso: s.progresso,
      camera: {
        tremer: (i, seg) => jogo.cam.tremer(i, seg),
        balanco: (i) => jogo.cam.balanco(i),
      },
      cristo: (id) => this.ctx.cristo(id),
      controlar: (id) => {
        const p = vale.mundo.personagens.get(id);
        if (!p || jogo.ativo === p) return;
        jogo.controlar(p);
        if (!jogo.cam.externo) jogo.cam.encaixar(p.posicao, p.yaw, vale.mundo.fisica);
      },
      liberarPosto: (idPosto) => {
        const p = jogo.controle.ocupante(idPosto);
        if (p) jogo.controle.liberarPosto(p);
      },
      removerPersonagem: (id) => removerPersonagem(jogo, vale.mundo, id),
      transicaoEra: (nomes) => this.ctx.transicaoEra(nomes.length ? nomes : GENEALOGIA_NOE),
    };
  }

  private inicio(id: string, i: number): [number, number, number] {
    const ini = INICIO_NOE[id];
    const [x, z] = ponto2(this.mundo, ini?.lugar ?? 'casa');
    const [dx, dz] = desvio(i);
    return [x + dx, z + dz, ini?.yaw ?? 0];
  }

  /** Índice de quem começa no mesmo lugar (para espalhar). */
  private ordemNoLugar(): Map<string, number> {
    const contagem = new Map<string, number>();
    const out = new Map<string, number>();
    for (const d of TODOS) {
      const lugar = INICIO_NOE[d.id]?.lugar ?? 'casa';
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
    jogo.troca.ordem = JOGAVEIS_NOE.map((d) => d.id);
  }

  posicoesIniciais() {
    const { jogo } = this.ctx;
    const ordem = this.ordemNoLugar();
    for (const p of this.mundo.personagens.values()) {
      reiniciarPessoa(jogo, p);
      const [x, z, yaw] = this.inicio(p.id, ordem.get(p.id) ?? 0);
      p.teleportar(x, this.mundo.chao(x, z), z, yaw);
    }
    // quem foi removido (moradores) volta
    this.criarPersonagens();
  }

  ligar() {
    const { jogo, s } = this.ctx;
    ERA_NOE.ligarServicos(this.servicos);
    this.desligar_.push(ERA_NOE.registrarSegredos(this.mundo, this.servicos, jogo.flags));
    // pontos 3D da arca ('porta', 'conves2'...) como alvos de objetivo; os do mapa têm prioridade
    this.desligar_.push(s.missoes.registrarPontos((nome) => (this.mundo.pontos.has(nome) ? null : this.vale.arca.ponto(nome))));
    // o mundo deixa de ser "limpo" assim que alguma missão roda nele
    this.desligar_.push(jogo.eventos.on('missao:etapa', () => (this.sujo = true)));
  }

  reconstruir() {
    const { jogo } = this.ctx;
    ERA_NOE.reconstruir(this.servicos, this.mundo, jogo.flags);
    if (!jogo.flags.valeEstado || jogo.flags.valeEstado === 'antes') {
      // tempestade e brilhos que uma missão abortada possa ter deixado
      jogo.ceu.tempestade = 0;
      jogo.ceu.gloria = 0;
    }
    if (!jogo.flags.arcoIrisNoCeu) jogo.ceu.arco = 0;
    jogo.cam.balanco(jogo.flags.arcaFlutuando && !jogo.flags.arcaNoPlato ? 0.25 : 0);
  }

  vistaTitulo(): VistaTitulo {
    // o vale ao amanhecer: casa, estaleiro e o monte de oração na órbita
    return { centro: [10, 6, 40], raio: 125, altura: 48, hora: 6.1, velocidade: 0.022 };
  }

  ambiente(): AmbienteEra {
    const { jogo } = this.ctx;
    const f = jogo.flags;
    const estado = (f.valeEstado as string | undefined) ?? 'antes';
    const interior = !!f.interiorArca;
    const ceu = jogo.ceu;
    const h = ceu.hora;
    const noite = h >= 19.5 || h < 5;
    const p = jogo.ativo?.posicao ?? jogo.focoCamera;
    const dist = (pt: [number, number]) => Math.hypot(p.x - pt[0], p.z - pt[1]);
    const perto = (pt: [number, number], r: number) => Math.max(0, 1 - dist(pt) / r);
    const a: Record<string, number> = {
      vale: 0, passaros: 0, noite: 0, cidade: 0, agua: 0, monte: 0, vento: 0,
      chuva: 0, tempestade: 0, interiorArca: 0, fogueira: 0,
    };
    if (interior) {
      a.interiorArca = 0.85;
    } else if (estado === 'diluvio') {
      a.chuva = Math.min(1, ceu.tempestade * 1.1);
      a.tempestade = ceu.tempestade > 0.5 ? (ceu.tempestade - 0.5) * 1.6 : 0;
      a.vento = 0.3 + ceu.tempestade * 0.4;
    } else {
      a.vale = estado === 'antes' && !noite ? 0.6 : 0;
      a.vento = estado === 'depois' ? 0.4 : 0;
      a.passaros = !noite && estado === 'depois' ? 0.35 : 0;
      a.noite = noite ? 0.6 : 0;
      if (estado === 'antes') a.cidade = 0.85 * perto(NOE.cidade, 85);
      const rio = distPolilinha(p.x, p.z, RIO).d;
      a.agua = Math.max(0, 1 - rio / 32) * 0.8;
      a.monte = 0.6 * perto(NOE.monteOracao, 40);
      a.fogueira = (noite && estado === 'antes' ? 0.55 * perto(ponto2(this.mundo, 'fogueiraCasa'), 16) : 0)
        + (f.altarFogo ? 0.6 * perto(ponto2(this.mundo, 'altarPlato'), 18) : 0);
    }
    return { ambientes: a, superficie: (q) => this.superficie(q, estado, interior) };
  }

  private superficie(p: Personagem, estado: string, interior: boolean): Superficie {
    const m = this.mundo;
    const pos = p.posicao;
    if (m.agua && pos.y < m.agua.nivel + 0.25) return 'agua';
    if (interior || pos.y > m.relevo.altura(pos.x, pos.z) + 0.45) return 'madeira';
    if (estado === 'depois') return 'terra';
    return dist2(pos, NOE.cidade) < 60 ? 'pedra' : 'grama';
  }

  desligar() {
    for (const f of this.desligar_.splice(0)) f();
    // o vale vai ser descartado: os animais dele saem de Animal.todos (senão entram na
    // separação dos animais da era seguinte) e as missões os esquecem
    Animal.descartar(this.mundo);
    ERA_NOE.limparCena();
  }

  atalhos(op: OpcoesAtalhos) {
    const { jogo, s } = this.ctx;
    const amb: AmbienteAtalhosNoe = {
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
      jogar: (o: { ate?: string; aoEtapa?: (m: string, e: string) => void } = {}) => jogarEraNoe(amb, o),
    };
  }
}

function dist2(p: THREE.Vector3, pt: [number, number]) {
  return Math.hypot(p.x - pt[0], p.z - pt[1]);
}

/** A era de Noé no registro de eras (src/jogo/eras.ts). */
export const ERA_NOE_JOGO: DefEra = {
  id: ERA_NOE.id,
  nome: ERA_NOE.nome,
  sub: ERA_NOE.sub,
  protagonista: ERA_NOE.protagonista,
  missaoInicial: ERA_NOE.missaoInicial,
  jogaveis: JOGAVEIS_NOE,
  npcs: NPCS_NOE,
  missoes: MISSOES_NOE,
  memorias: MEMORIAS_NOE,
  cristo: CRISTO_NOE,
  seguinte: ERA_NOE.seguinte,
  textoCarregamento: 'Erguendo o vale de Noé…',
  horaChegada: 9,
  criar: (ctx) => new EraNoe(ctx),
};
