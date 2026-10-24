// Ligação da era 2 (Abraão, Gn 12–22). PROVISÓRIA: o conteúdo da era (personagens, missões,
// memórias, serviços) é do agente "era-abraao" e ainda não existe. Por enquanto a era monta
// Canaã (MundoCanaa), cria Abrão, Sarai, Ló e Eliézer na chegada e entrega o controle a
// Abrão — o bastante para a transição de era e para o save. Quando src/eras/abraao/index.ts
// existir (ERA_ABRAAO), troque as definições daqui pelas de lá e implemente os serviços da
// era como em ligacao/noe.ts (veja docs/tecnico/integracao.md, "Nova era").
import { MundoCanaa } from '../../eras/abraao/construir';
import { CANAA } from '../../eras/abraao/mapa';
import { APARENCIAS_ABRAAO } from '../../eras/abraao/aparencias';
import type { DefPersonagem } from '../Personagem';
import type { ContextoEra, DefEra, EraAtiva, VistaTitulo } from '../eras';
import type { AmbienteEra, Superficie } from './audio';
import { desvio, reiniciarPessoa } from './comum';

const P = (d: Omit<DefPersonagem, 'aparencia' | 'jogavel'> & { jogavel?: boolean }): DefPersonagem => ({
  jogavel: true,
  aparencia: APARENCIAS_ABRAAO[d.id],
  ...d,
});

/** Jogáveis provisórios (substituir pelos do agente era-abraao). */
const JOGAVEIS_ABRAAO: DefPersonagem[] = [
  P({ id: 'abraao', nome: 'Abrão', nomeAlternativo: { flag: 'nomeAbraao', nome: 'Abraão' }, classe: 'profeta', protagonista: true, ref: 'Gn 12:1' }),
  P({ id: 'sara', nome: 'Sarai', nomeAlternativo: { flag: 'nomeSara', nome: 'Sara' }, classe: 'hospitaleiro', ref: 'Gn 11:29' }),
  P({ id: 'lo', nome: 'Ló', classe: 'pastor', ref: 'Gn 12:4' }),
  P({ id: 'eliezer', nome: 'Eliézer', classe: 'guerreiro', ref: 'Gn 15:2' }),
];

const INICIO: Record<string, string> = { abraao: 'chegada', sara: 'caravana', lo: 'caravana', eliezer: 'caravana' };

class EraAbraao implements EraAtiva {
  readonly def = ERA_ABRAAO_JOGO;
  readonly canaa: MundoCanaa;
  sujo = false;
  private desligar_: (() => void)[] = [];

  constructor(private ctx: ContextoEra) {
    this.canaa = new MundoCanaa(ctx.jogo.natureza);
    this.canaa.ceu = ctx.jogo.ceu;
  }

  get mundo() {
    return this.canaa.mundo;
  }

  private inicio(id: string, i: number): [number, number] {
    const [x, z] = this.mundo.pontos.get(INICIO[id] ?? 'chegada') ?? CANAA.more;
    const [dx, dz] = desvio(i);
    return [x + dx, z + dz];
  }

  criarPersonagens() {
    const { jogo } = this.ctx;
    JOGAVEIS_ABRAAO.forEach((d, i) => {
      if (this.mundo.personagens.has(d.id)) return;
      const [x, z] = this.inicio(d.id, i);
      jogo.criarPersonagem(d, x, z, Math.PI * 0.8);
    });
    jogo.troca.ordem = JOGAVEIS_ABRAAO.map((d) => d.id);
  }

  posicoesIniciais() {
    const { jogo } = this.ctx;
    JOGAVEIS_ABRAAO.forEach((d, i) => {
      const p = this.mundo.personagens.get(d.id);
      if (!p) return;
      reiniciarPessoa(jogo, p);
      const [x, z] = this.inicio(d.id, i);
      p.teleportar(x, this.mundo.chao(x, z), z, Math.PI * 0.8);
    });
  }

  ligar() {
    this.desligar_.push(this.ctx.jogo.eventos.on('missao:etapa', () => (this.sujo = true)));
  }

  reconstruir() {
    const ceu = this.ctx.jogo.ceu;
    ceu.tempestade = 0;
    ceu.arco = 0;
    ceu.gloria = 0;
    this.ctx.jogo.cam.balanco(0);
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
  }
}

export const ERA_ABRAAO_JOGO: DefEra = {
  id: 'abraao',
  nome: 'Era 2 — Abraão',
  sub: 'Gênesis 12–22',
  protagonista: 'abraao',
  missaoInicial: 'b1',
  jogaveis: JOGAVEIS_ABRAAO,
  npcs: [],
  missoes: [],
  memorias: [],
  cristo: [],
  textoCarregamento: 'Erguendo Canaã…',
  horaChegada: 16.5,
  criar: (ctx) => new EraAbraao(ctx),
};
