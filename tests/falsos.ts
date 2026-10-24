// Serviços falsos para os testes dos sistemas de história (sem navegador, sem WebGL).
import * as THREE from 'three';
import { Eventos } from '../src/core/Eventos';
import type { Acao } from '../src/core/Entrada';
import { Ficha, type Atributos } from '../src/jogo/Atributos';
import type {
  EstadoHUD, EstadoProvaUI, InterfaceUI, ItemRoda, Linha, MarcadorTela, OpcaoEscolha, Versiculo,
} from '../src/jogo/contratos';
import type { AcessoJogo, ServicoCinematica } from '../src/jogo/Missoes';
import type { Personagem } from '../src/jogo/Personagem';
import type { Mundo } from '../src/mundo/Mundo';

/** Deixa as promessas pendentes andarem. */
export const ciclo = () => new Promise<void>((r) => setTimeout(r, 0));

/** Gerador determinístico (LCG) para as provas. */
export function aleatorioFixo(semente = 1): () => number {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class EntradaFalsa {
  ativas = new Set<Acao>();
  pressionadas = new Set<Acao>();
  ativa(a: Acao) {
    return this.ativas.has(a);
  }
  pressionou(a: Acao) {
    return this.pressionadas.has(a);
  }
  segurar(a: Acao, sim = true) {
    if (sim) this.ativas.add(a);
    else this.ativas.delete(a);
  }
  apertar(a: Acao) {
    this.pressionadas.add(a);
  }
  fimDoQuadro() {
    this.pressionadas.clear();
  }
}

export class UIFalsa implements InterfaceUI {
  chamadas: { nome: string; args: unknown[] }[] = [];
  falas: Linha[][] = [];
  avisos: [string, string | undefined][] = [];
  estadosProva: (EstadoProvaUI | null)[] = [];
  objetivos: [string | null, string | null][] = [];
  banners: Versiculo[] = [];
  cinema: boolean[] = [];
  /** Índice escolhido nas escolhas (ou função). */
  escolher: number | ((opcoes: OpcaoEscolha[], pode: (o: OpcaoEscolha) => boolean) => number) = 0;
  /** Se definido, os diálogos ficam pendentes até chamar `avancarDialogo()`. */
  dialogoManual = false;
  private pendentes: (() => void)[] = [];

  private reg(nome: string, ...args: unknown[]) {
    this.chamadas.push({ nome, args });
  }
  dialogo(linhas: Linha[]) {
    this.reg('dialogo', linhas);
    this.falas.push(linhas);
    if (!this.dialogoManual) return Promise.resolve();
    return new Promise<void>((r) => this.pendentes.push(r));
  }
  avancarDialogo() {
    this.pendentes.shift()?.();
  }
  escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[], pode: (o: OpcaoEscolha) => boolean) {
    this.reg('escolha', pergunta, opcoes);
    const i = typeof this.escolher === 'function' ? this.escolher(opcoes, pode) : this.escolher;
    return Promise.resolve(i);
  }
  bannerVersiculo(v: Versiculo) {
    this.banners.push(v);
  }
  objetivo(titulo: string | null, texto: string | null) {
    this.objetivos.push([titulo, texto]);
  }
  prompt() {}
  aviso(texto: string, tipo?: string) {
    this.avisos.push([texto, tipo]);
  }
  dica(texto: string) {
    this.reg('dica', texto);
  }
  titulo(texto: string, sub?: string) {
    this.reg('titulo', texto, sub);
    return Promise.resolve();
  }
  fade(paraPreto: boolean, duracao: number) {
    this.reg('fade', paraPreto, duracao);
    return Promise.resolve();
  }
  modoCinema(ativo: boolean) {
    this.cinema.push(ativo);
  }
  hud(_e: EstadoHUD) {}
  prova(estado: EstadoProvaUI | null) {
    this.estadosProva.push(estado);
  }
  rodaPersonagens(_itens: ItemRoda[]) {
    return Promise.resolve(null);
  }
  fecharRoda() {}
  legendaTroca() {}
  marcadores(_m: MarcadorTela[], _yaw: number) {}
  menuAberto() {
    return false;
  }
  get ultimoEstadoProva() {
    return this.estadosProva[this.estadosProva.length - 1];
  }
}

export class CinematicaFalsa implements ServicoCinematica {
  idas = 0;
  voltas = 0;
  async para() {
    this.idas++;
  }
  async voltar() {
    this.voltas++;
  }
}

/** Personagem falso: posição, ficha, IA de cena que anda a cada quadro do mundo falso. */
export interface PersonagemFalso {
  id: string;
  nome: string;
  posicao: THREE.Vector3;
  yaw: number;
  emCena: boolean;
  disponivel: boolean;
  ficha: Ficha | null;
  classe: string | null;
  modVelocidade: number;
  aprendidos: string[];
  ia: { alvo: { x: number; z: number; vel: number; r: () => void } | null; moverCena(x: number, z: number, vel?: number): Promise<void> };
  teleportar(x: number, y: number, z: number, yaw?: number): void;
  humano: { animador: { tocados: string[]; tocar(clipe: string): Promise<void> } };
}

export function personagemFalso(id: string, x = 0, z = 0, atributos?: Partial<Atributos>, jogavel = true): PersonagemFalso {
  const p: PersonagemFalso = {
    id,
    nome: id[0].toUpperCase() + id.slice(1),
    posicao: new THREE.Vector3(x, 0, z),
    yaw: 0,
    emCena: false,
    disponivel: true,
    ficha: jogavel ? new Ficha(atributos) : null,
    classe: 'construtor',
    modVelocidade: 1,
    aprendidos: [],
    ia: {
      alvo: null,
      moverCena(x2: number, z2: number, vel = 1.5) {
        p.ia.alvo?.r();
        return new Promise<void>((r) => {
          p.ia.alvo = { x: x2, z: z2, vel, r };
        });
      },
    },
    teleportar(x2: number, y: number, z2: number, yaw?: number) {
      p.posicao.set(x2, y, z2);
      if (yaw !== undefined) p.yaw = yaw;
    },
    humano: {
      animador: {
        tocados: [],
        async tocar(clipe: string) {
          p.humano.animador.tocados.push(clipe);
        },
      },
    },
  };
  return p;
}

export interface JogoFalso extends AcessoJogo {
  eventos: Eventos;
  flags: Record<string, unknown>;
  ativo: Personagem | null;
  entrada: EntradaFalsa;
  cam: { yaw: number };
  ceu: { hora: number };
  pers: Map<string, PersonagemFalso>;
  /** Avança `segundos` de jogo em quadros de `dt`, deixando as promessas andarem a cada quadro. */
  avancar(segundos: number, dt?: number): Promise<void>;
  quadro(dt?: number): Promise<void>;
}

export function jogoFalso(lista: PersonagemFalso[] = [], pontos: Record<string, [number, number]> = {}): JogoFalso {
  const quadros = new Set<(dt: number) => void>();
  const pers = new Map(lista.map((p) => [p.id, p]));
  const interativos = new Map<string, { id: string; pos: THREE.Vector3; rotulo: string }>();
  const mundo = {
    pontos: new Map(Object.entries(pontos)),
    personagens: pers,
    interativos: { obter: (id: string) => interativos.get(id) },
    chao: () => 0,
    _interativos: interativos,
  };
  const entrada = new EntradaFalsa();
  const jogo: JogoFalso = {
    mundo: mundo as unknown as Mundo,
    flags: {},
    eventos: new Eventos(),
    ativo: (lista[0] as unknown as Personagem) ?? null,
    controleLivre: true,
    entrada,
    cam: { yaw: 0 },
    ceu: { hora: 9 },
    pers,
    personagem(id: string) {
      const p = pers.get(id);
      if (!p) throw new Error(`personagem ausente: ${id}`);
      return p as unknown as Personagem;
    },
    aCadaQuadro(fn: (dt: number) => void) {
      quadros.add(fn);
      return () => quadros.delete(fn);
    },
    async quadro(dt = 0.1) {
      // IA de cena: anda até o alvo
      for (const p of pers.values()) {
        const a = p.ia.alvo;
        if (!a || !p.emCena) continue;
        const dx = a.x - p.posicao.x;
        const dz = a.z - p.posicao.z;
        const d = Math.hypot(dx, dz);
        const passo = a.vel * dt;
        if (d <= Math.max(0.25, passo)) {
          p.posicao.set(a.x, p.posicao.y, a.z);
          p.ia.alvo = null;
          a.r();
        } else {
          p.posicao.x += (dx / d) * passo;
          p.posicao.z += (dz / d) * passo;
        }
      }
      for (const fn of [...quadros]) fn(dt);
      entrada.fimDoQuadro();
      await ciclo();
    },
    async avancar(segundos: number, dt = 0.1) {
      const n = Math.round(segundos / dt);
      for (let i = 0; i < n; i++) await jogo.quadro(dt);
    },
  };
  return jogo;
}

/** Adiciona um interativo ao mundo falso. */
export function interativoFalso(jogo: JogoFalso, id: string, x: number, y: number, z: number, rotulo = id) {
  (jogo.mundo as unknown as { _interativos: Map<string, unknown> })._interativos.set(id, { id, pos: new THREE.Vector3(x, y, z), rotulo });
}
