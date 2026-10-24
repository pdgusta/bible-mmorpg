// Mecânicas em tempo real da era de Abraão, usadas pelas missões e testáveis sem navegador:
// - Furtividade (B3, "dividiu-se contra eles à noite", Gn 14:15): sentinelas com tochas rondam o
//   acampamento; cada tocha é um cone que gira. Ser visto devolve o grupo ao último ponto seguro.
// - Batalha (B3): aparar (botão direito) e golpear com o cajado (clique). Ninguém morre nem
//   sangra: um inimigo desarmado cai, levanta-se e foge para o norte (Gn 14:15, "os perseguiu").
// - Juntos (B5, "foram os dois juntos", Gn 22:6, 22:8): pai e filho não se separam na subida.
// Tudo anda por `atualizar(dt)`, chamado a cada quadro pela missão (servicos.aCadaQuadro).
import { wrapAngle } from '../../core/util';
import type { Personagem } from '../../jogo/Personagem';
import type { EntradaAbraao } from './servicos';

export type Ponto2 = [number, number];

const dist2 = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const distP = (a: { x: number; z: number }, p: Ponto2) => Math.hypot(a.x - p[0], a.z - p[1]);
/** Yaw que olha de `de` para `para` (frente do personagem = (sen yaw, cos yaw)). */
const yawPara = (de: { x: number; z: number }, para: { x: number; z: number }) => Math.atan2(para.x - de.x, para.z - de.z);

/** Promessa que ninguém espera: nunca vira rejeição solta. */
function soltar(p: Promise<unknown> | void) {
  if (p) p.catch(() => {});
}

// ================================================================================ furtividade

export const CONE = {
  /** Alcance da tocha (m) de pé e agachado. */
  alcance: 11,
  alcanceAgachado: 6,
  /** Meia-abertura do cone (rad). */
  abertura: 0.5,
  /** Quanto a tocha gira para cada lado (rad) e em quanto tempo (s). */
  varredura: 0.55,
  periodo: 4.5,
  /** Perto de um abrigo (os flancos, atrás de pedras) ninguém é visto. */
  raioAbrigo: 3.4,
  /** Depois de recuar, alguns segundos sem ser visto de novo. */
  imunidade: 2.5,
  velocidade: 1.1,
  /** Distância para contar um ponto da rota como alcançado (ponto seguro). */
  raioSeguro: 4,
};

/** O alvo está dentro do cone de luz (origem, direção `yaw`)? */
export function noCone(o: { x: number; z: number; yaw: number }, alvo: { x: number; z: number }, alcance: number, abertura = CONE.abertura): boolean {
  const d = dist2(o, alvo);
  if (d > alcance) return false;
  if (d < 1.2) return true;
  return Math.abs(wrapAngle(yawPara(o, alvo) - o.yaw)) <= abertura;
}

export interface SentinelaRonda {
  p: Personagem;
  rota: Ponto2[];
  /** A rota fecha (laço) ou vai e volta. */
  laco: boolean;
  /** Fase da varredura da tocha (s). */
  fase: number;
}

export interface GrupoFurtivo {
  lider: Personagem;
  seguidores: Personagem[];
  /** Caminho coberto até o flanco; o último ponto é o flanco (um abrigo). */
  rota: Ponto2[];
  /** Índice do último ponto seguro alcançado. */
  seguro: number;
  imune: number;
}

export class Furtividade {
  private t = 0;
  private ativa = false;

  constructor(
    readonly sentinelas: SentinelaRonda[],
    readonly grupos: GrupoFurtivo[],
    private readonly chao: (x: number, z: number) => number,
    private readonly aoSerVisto: (g: GrupoFurtivo, s: SentinelaRonda) => void,
    /** Lugares onde ninguém é visto (os flancos). */
    private readonly abrigos: Ponto2[] = grupos.map((g) => g.rota[g.rota.length - 1]),
  ) {}

  /** Acende as tochas e põe as sentinelas a rondar. */
  iniciar() {
    if (this.ativa) return;
    this.ativa = true;
    for (const s of this.sentinelas) {
      s.p.emCena = true;
      s.p.humano.segurar('tocha', 'direita');
      s.p.humano.animador.superior = 'tocha';
      this.rondar(s, 0, 1);
    }
  }

  private rondar(s: SentinelaRonda, i: number, dir: 1 | -1) {
    if (!this.ativa) return;
    const [x, z] = s.rota[i];
    soltar(s.p.ia.moverCena(x, z, CONE.velocidade).then(() => {
      const n = s.rota.length;
      if (s.laco) return this.rondar(s, (i + 1) % n, 1);
      let d = dir;
      if (i + d >= n || i + d < 0) d = (-d) as 1 | -1;
      this.rondar(s, i + d, d);
    }));
  }

  /** Direção atual da tocha de uma sentinela. */
  yawTocha(s: SentinelaRonda): number {
    return s.p.yaw + Math.sin(((this.t + s.fase) * Math.PI * 2) / CONE.periodo) * CONE.varredura;
  }

  agachado(g: GrupoFurtivo): boolean {
    const l = g.lider;
    return l.controlado ? !!l.humano.animador.agachado : l.humano.animador.atividade === 'agachado';
  }

  abrigado(p: { x: number; z: number }): boolean {
    return this.abrigos.some((a) => distP(p, a) <= CONE.raioAbrigo);
  }

  noFlanco(g: GrupoFurtivo): boolean {
    return distP(g.lider.posicao, g.rota[g.rota.length - 1]) <= CONE.raioAbrigo;
  }

  get todosNosFlancos(): boolean {
    return this.grupos.every((g) => this.noFlanco(g));
  }

  atualizar(dt: number) {
    if (!this.ativa) return;
    this.t += dt;
    for (const g of this.grupos) {
      // pontos seguros: o mais adiantado já alcançado na rota coberta
      for (let k = g.seguro + 1; k < g.rota.length; k++) if (distP(g.lider.posicao, g.rota[k]) < CONE.raioSeguro) g.seguro = k;
      // quem espera (não controlado) fica agachado
      if (!g.lider.controlado && !g.lider.emCena) g.lider.humano.animador.atividade = 'agachado';
      g.imune = Math.max(0, g.imune - dt);
      if (g.imune > 0) continue;
      const alcance = this.agachado(g) ? CONE.alcanceAgachado : CONE.alcance;
      let visto: SentinelaRonda | null = null;
      for (const p of [g.lider, ...g.seguidores]) {
        if (this.abrigado(p.posicao)) continue;
        for (const s of this.sentinelas) {
          if (noCone({ x: s.p.posicao.x, z: s.p.posicao.z, yaw: this.yawTocha(s) }, p.posicao, alcance)) {
            visto = s;
            break;
          }
        }
        if (visto) break;
      }
      if (visto) this.recuar(g, visto);
    }
  }

  /** "Fomos vistos! Recuem.": o grupo volta ao último ponto seguro. */
  private recuar(g: GrupoFurtivo, s: SentinelaRonda) {
    g.imune = CONE.imunidade;
    this.levar(g, g.rota[g.seguro]);
    this.aoSerVisto(g, s);
  }

  private levar(g: GrupoFurtivo, [x, z]: Ponto2) {
    if (g.lider.escalada) g.lider.sairEscalada('aqui');
    g.lider.teleportar(x, this.chao(x, z) + 0.05, z);
    g.seguidores.forEach((p, i) => {
      const a = (i + 1) * 2.2;
      const px = x + Math.cos(a) * 1.4;
      const pz = z + Math.sin(a) * 1.4;
      p.teleportar(px, this.chao(px, pz) + 0.05, pz);
    });
  }

  /** Atalho de depuração: cada grupo já no seu flanco. */
  resolverAutomaticamente() {
    for (const g of this.grupos) {
      g.seguro = g.rota.length - 1;
      g.imune = CONE.imunidade;
      this.levar(g, g.rota[g.seguro]);
    }
  }

  /** Cones de luz no quadro atual (para quem quiser desenhá-los). */
  cones(): { x: number; z: number; yaw: number; alcance: number; abertura: number }[] {
    return this.sentinelas.map((s) => ({ x: s.p.posicao.x, z: s.p.posicao.z, yaw: this.yawTocha(s), alcance: CONE.alcance, abertura: CONE.abertura }));
  }

  parar() {
    this.ativa = false;
    for (const g of this.grupos) if (!g.lider.controlado && g.lider.humano.animador.atividade === 'agachado') g.lider.humano.animador.atividade = null;
  }
}

// ================================================================================ batalha

export const BATALHA = {
  /** Distância do golpe (m) e meia-abertura à frente de quem golpeia. */
  alcance: 2.5,
  abertura: 1.05,
  /** Tempo de preparo do golpe inimigo (s); com o discernimento, mais lento. */
  preparo: 1.1,
  fatorDiscernir: 1.6,
  duracaoDiscernir: 6,
  /** Inimigo aparado fica aberto (s). */
  atordoado: 1.6,
  recuo: 0.9,
  /** No máximo quantos atacam ao mesmo tempo; os outros cercam. */
  atacantes: 2,
  raioCerco: 3.6,
  /** Recarga do golpe do jogador e do aliado (s). */
  recargaJogador: 0.55,
  recargaAliado: 1.3,
  /** Fôlego perdido ao levar um golpe. */
  dano: 20,
  /** Segundos fugindo até sair de cena. */
  fuga: 6,
};

type EstadoInimigo = 'aproximar' | 'preparar' | 'atordoado' | 'recuar' | 'fugindo';

export interface Inimigo {
  p: Personagem;
  estado: EstadoInimigo;
  t: number;
  alvo: Personagem | null;
  /** Desequilíbrio acumulado pelos golpes bloqueados: em 1, perde a arma. */
  equilibrio: number;
  mover: number;
  saiu: boolean;
}

export interface OpcoesBatalha {
  inimigos: Personagem[];
  /** Quem luta do lado de Abrão (o controlado e o aliado guiado pela IA). */
  aliados: Personagem[];
  entrada: EntradaAbraao;
  /** Para onde os desarmados fogem. */
  fuga: Ponto2;
  /** Sorteio 0..1 (aparar do aliado guiado pela IA). */
  aleatorio?: () => number;
  aoDesarmar?(p: Personagem): void;
  aoSair?(p: Personagem): void;
  aoGolpe?(alvo: Personagem, aparado: boolean): void;
}

export class Batalha {
  readonly inimigos: Inimigo[];
  private recargas = new Map<Personagem, number>();
  private alvoAliado = new Map<Personagem, Personagem | null>();
  private discernido = 0;
  private aleatorio: () => number;

  constructor(private readonly o: OpcoesBatalha) {
    this.inimigos = o.inimigos.map((p) => ({ p, estado: 'aproximar', t: 0, alvo: null, equilibrio: 0, mover: 0, saiu: false }));
    let s = 7;
    this.aleatorio = o.aleatorio ?? (() => ((s = (s * 16807) % 2147483647) / 2147483647));
  }

  /** Arma os inimigos (o acampamento acorda). */
  iniciar() {
    for (const e of this.inimigos) {
      e.p.emCena = true;
      e.p.humano.segurar('espada', 'direita');
      e.p.humano.animador.superior = 'espada';
    }
    for (const a of this.o.aliados) {
      a.humano.segurar('cajado', 'direita');
      if (!a.controlado) a.humano.animador.atividade = null;
    }
  }

  get desarmados(): number {
    return this.inimigos.filter((e) => e.estado === 'fugindo').length;
  }

  get terminou(): boolean {
    return this.inimigos.every((e) => e.estado === 'fugindo');
  }

  /** Todos os que fugiram já saíram de cena. */
  get encerrada(): boolean {
    return this.inimigos.every((e) => e.saiu);
  }

  /** Discernir (Q do profeta): os golpes ficam mais lentos e o próximo atacante aparece. */
  discernir() {
    this.discernido = BATALHA.duracaoDiscernir;
  }

  get discernindo(): boolean {
    return this.discernido > 0;
  }

  /** De onde vem o próximo golpe. */
  proximoAtacante(): Personagem | null {
    let melhor: Inimigo | null = null;
    for (const e of this.inimigos) {
      if (e.estado === 'preparar' && (!melhor || melhor.estado !== 'preparar' || e.t < melhor.t)) melhor = e;
      else if (!melhor && e.estado === 'aproximar') melhor = e;
    }
    return melhor?.p ?? null;
  }

  private vivos(): Inimigo[] {
    return this.inimigos.filter((e) => e.estado !== 'fugindo');
  }

  private maisPerto(de: { x: number; z: number }, lista: Personagem[]): Personagem | null {
    let melhor: Personagem | null = null;
    let md = Infinity;
    for (const p of lista) {
      const d = dist2(de, p.posicao);
      if (d < md) {
        md = d;
        melhor = p;
      }
    }
    return melhor;
  }

  atualizar(dt: number) {
    this.discernido = Math.max(0, this.discernido - dt);
    for (const [p, r] of this.recargas) this.recargas.set(p, Math.max(0, r - dt));
    const atacando = this.inimigos.filter((e) => e.estado === 'preparar').length;
    for (const e of this.inimigos) this.atualizarInimigo(e, dt, atacando);
    // o jogador golpeia
    const ativo = this.o.aliados.find((a) => a.controlado) ?? null;
    if (ativo && this.o.entrada.pressionou('acao') && (this.recargas.get(ativo) ?? 0) <= 0) {
      this.recargas.set(ativo, BATALHA.recargaJogador);
      this.golpear(ativo, true);
    }
    // o aliado guiado pela IA luta sozinho
    for (const a of this.o.aliados) {
      if (a.controlado || a.posto) continue;
      const vivos = this.vivos().map((e) => e.p);
      const alvo = this.maisPerto(a.posicao, vivos);
      if (alvo !== (this.alvoAliado.get(a) ?? null)) {
        this.alvoAliado.set(a, alvo);
        if (alvo) a.ia.seguir(alvo, 1.6);
        else a.ia.esperar();
      }
      if (alvo && dist2(a.posicao, alvo.posicao) <= BATALHA.alcance && (this.recargas.get(a) ?? 0) <= 0) {
        this.recargas.set(a, BATALHA.recargaAliado);
        a.yaw = yawPara(a.posicao, alvo.posicao);
        this.golpear(a, false);
      }
    }
  }

  private atualizarInimigo(e: Inimigo, dt: number, atacando: number) {
    const p = e.p;
    e.t -= dt;
    e.mover -= dt;
    if (e.estado === 'fugindo') {
      if (!e.saiu && e.t <= 0) {
        e.saiu = true;
        this.o.aoSair?.(p);
      }
      return;
    }
    const alvo = this.maisPerto(p.posicao, this.o.aliados.filter((a) => !a.escalada));
    e.alvo = alvo;
    if (!alvo) return;
    const d = dist2(p.posicao, alvo.posicao);
    switch (e.estado) {
      case 'aproximar': {
        if (d <= BATALHA.alcance - 0.3 && atacando < BATALHA.atacantes) {
          e.estado = 'preparar';
          e.t = BATALHA.preparo * (this.discernido > 0 ? BATALHA.fatorDiscernir : 1);
          p.yaw = yawPara(p.posicao, alvo.posicao);
          break;
        }
        if (e.mover <= 0) {
          e.mover = 0.35;
          // perto do alvo (ou em volta dele, se já há atacantes demais)
          const r = atacando >= BATALHA.atacantes ? BATALHA.raioCerco : 1.4;
          const ang = Math.atan2(p.posicao.x - alvo.posicao.x, p.posicao.z - alvo.posicao.z);
          soltar(p.ia.moverCena(alvo.posicao.x + Math.sin(ang) * r, alvo.posicao.z + Math.cos(ang) * r, 3));
        }
        break;
      }
      case 'preparar': {
        p.yaw = yawPara(p.posicao, alvo.posicao);
        if (e.t > 0) break;
        soltar(p.humano.animador.tocar('atacar', 'superior'));
        if (d <= BATALHA.alcance + 0.4) this.golpeInimigo(e, alvo);
        else {
          e.estado = 'aproximar';
          e.mover = 0;
        }
        break;
      }
      case 'atordoado':
      case 'recuar':
        if (e.t <= 0) {
          e.estado = 'aproximar';
          e.mover = 0;
        }
        break;
    }
  }

  /** O golpe do inimigo chega: aparado (o atacante fica aberto) ou acerta (fôlego). */
  private golpeInimigo(e: Inimigo, alvo: Personagem) {
    const frente = Math.abs(wrapAngle(yawPara(alvo.posicao, e.p.posicao) - alvo.yaw)) < 1.25;
    const aparado = alvo.controlado
      ? this.o.entrada.ativa('escudo') && frente
      : this.aleatorio() < 0.35 + (alvo.ficha?.atributos.agilidade ?? 4) * 0.04;
    if (aparado) {
      e.estado = 'atordoado';
      e.t = BATALHA.atordoado;
      soltar(alvo.humano.animador.tocar('bloquear', 'superior'));
      soltar(e.p.humano.animador.tocar('atingido'));
    } else {
      e.estado = 'recuar';
      e.t = BATALHA.recuo;
      soltar(alvo.humano.animador.tocar('atingido'));
      if (alvo.ficha) alvo.ficha.folego = Math.max(0, alvo.ficha.folego - BATALHA.dano);
      const ang = yawPara(alvo.posicao, e.p.posicao);
      soltar(e.p.ia.moverCena(e.p.posicao.x + Math.sin(ang) * 1.8, e.p.posicao.z + Math.cos(ang) * 1.8, 2));
    }
    this.o.aoGolpe?.(alvo, aparado);
  }

  /** Golpe com o cajado: desarma quem está aberto; nos outros, desequilibra. */
  private golpear(a: Personagem, frontal: boolean) {
    soltar(a.humano.animador.tocar('golpe', 'superior'));
    let alvo: Inimigo | null = null;
    let md = Infinity;
    for (const e of this.vivos()) {
      const d = dist2(a.posicao, e.p.posicao);
      if (d > BATALHA.alcance) continue;
      if (frontal && d > 1.2 && Math.abs(wrapAngle(yawPara(a.posicao, e.p.posicao) - a.yaw)) > BATALHA.abertura) continue;
      // prefere quem está aberto
      const nota = d - (e.estado === 'atordoado' ? 10 : 0);
      if (nota < md) {
        md = nota;
        alvo = e;
      }
    }
    if (!alvo) return;
    if (alvo.estado === 'atordoado') {
      this.desarmar(alvo);
      return;
    }
    soltar(alvo.p.humano.animador.tocar('bloquear', 'superior'));
    alvo.equilibrio += Math.max(0.25, (a.ficha?.atributos.forca ?? 4) / 12);
    if (alvo.equilibrio >= 1 - 1e-6) this.desarmar(alvo);
  }

  /** Perde a arma, cai, levanta-se e foge para o norte. */
  desarmar(e: Inimigo) {
    if (e.estado === 'fugindo') return;
    e.estado = 'fugindo';
    e.t = BATALHA.fuga;
    const p = e.p;
    p.humano.segurar(null, 'direita');
    p.humano.animador.superior = null;
    const [fx, fz] = this.o.fuga;
    soltar((async () => {
      await p.humano.animador.tocar('derrubado');
      await p.humano.animador.tocar('levantarDoChao');
      await p.ia.moverCena(fx, fz, 5);
    })());
    this.o.aoDesarmar?.(p);
  }

  /** Atalho de depuração: todos desarmados e fora de cena. */
  resolverAutomaticamente() {
    for (const e of this.inimigos) this.desarmar(e);
    for (const e of this.inimigos) e.t = 0;
  }

  parar() {
    for (const a of this.o.aliados) {
      if (!a.controlado) a.ia.esperar();
      a.humano.segurar(null, 'direita');
    }
  }
}

// ================================================================================ juntos

/**
 * "Foram os dois juntos" (Gn 22:6, 22:8): quem não é controlado segue o outro; se o controlado
 * se adiantar mais de `distancia` metros, anda devagar e a dica lembra.
 */
export class Juntos {
  private seguindo: Personagem | null = null;
  private tDica = 0;
  private lento: Personagem | null = null;

  constructor(
    private readonly a: Personagem,
    private readonly b: Personagem,
    private readonly dica: (texto: string) => void,
    private readonly distancia = 12,
  ) {}

  get separados(): boolean {
    return dist2(this.a.posicao, this.b.posicao) > this.distancia;
  }

  atualizar(dt: number) {
    this.tDica = Math.max(0, this.tDica - dt);
    const ctrl = this.a.controlado ? this.a : this.b.controlado ? this.b : null;
    if (!ctrl) return;
    const outro = ctrl === this.a ? this.b : this.a;
    if (this.seguindo !== outro && !outro.posto && !outro.escalada && !outro.emCena) {
      outro.ia.seguir(ctrl, 2.4);
      this.seguindo = outro;
    }
    const d = dist2(ctrl.posicao, outro.posicao);
    if (d > this.distancia) {
      if (this.lento !== ctrl) {
        this.liberar();
        this.lento = ctrl;
      }
      ctrl.modVelocidade = 0.3;
      if (this.tDica <= 0) {
        this.tDica = 12;
        this.dica(`Subam juntos: espere por ${outro.nome}.`);
      }
    } else if (d < this.distancia - 2) this.liberar();
  }

  private liberar() {
    if (this.lento) this.lento.modVelocidade = 1;
    this.lento = null;
  }

  parar() {
    this.liberar();
    this.a.modVelocidade = 1;
    this.b.modVelocidade = 1;
    this.seguindo = null;
  }
}
