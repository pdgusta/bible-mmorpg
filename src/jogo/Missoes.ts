// Motor de missões: implementa o CtxMissao entregue aos scripts de etapa das eras.
// Roda as etapas em sequência, com um AbortController por execução (todas as esperas
// rejeitam com AbortError quando a missão é abortada), autosave nas fronteiras de etapa,
// eventos 'missao:*', retomada da etapa atual depois de carregar um save, recompensa ao
// concluir e início automático da `proxima`. Todos os serviços são injetados (os testes
// usam falsos): jogo/mundo/personagens/flags/eventos, UI, cinemática, Progresso, Provas e
// Diálogo. `criarSistemas()` no fim do arquivo liga tudo a partir do Jogo.
import * as THREE from 'three';
import type { FonteXP, NomeAtributo } from './Atributos';
import { carregarBiblia, versiculo } from './Biblia';
import type {
  Alvo, CtxMissao, DadosSave, DefMissao, DefProva, EstadoMissao, InterfaceUI, Linha, MarcadorTela, OpcaoEscolha,
  PecaArmadura, Ref, ResultadoProva, TipoMissao,
} from './contratos';
import { Dialogo } from './Dialogo';
import type { Personagem } from './Personagem';
import { Progresso } from './Progresso';
import { Provas, type EntradaProva } from './Provas';
import { aplicarPersonagens, personagensParaSave, restaurarFlags, Salvamento, type AdaptadorArmazenamento } from './Salvamento';
import type { Mundo } from '../mundo/Mundo';
import type { NomeClipe } from '../entidades/humano/Animador';

export type Vec3 = THREE.Vector3 | [number, number, number];

/** Câmera de cinemática (implementada em src/camera/Cinematica.ts). */
export interface ServicoCinematica {
  para(pos: Vec3, alvo: Vec3, duracao: number): Promise<void>;
  voltar(duracao?: number): Promise<void>;
}

export interface BarramentoEventos {
  on(nome: string, fn: (dados: any) => void): () => void;
  emit(nome: string, dados?: unknown): void;
}

/** O que o motor usa do Jogo (Jogo satisfaz). */
export interface AcessoJogo {
  readonly mundo: Mundo | null;
  readonly flags: Record<string, unknown>;
  readonly eventos: BarramentoEventos;
  readonly ativo: Personagem | null;
  controleLivre: boolean;
  personagem(id: string): Personagem;
  aCadaQuadro(fn: (dt: number) => void): () => void;
}

export interface DepsMissoes {
  jogo: AcessoJogo;
  ui: InterfaceUI;
  cinematica: ServicoCinematica;
  progresso: Progresso;
  provas: { iniciar(def: DefProva): Promise<ResultadoProva>; cancelar(): void };
  dialogo: Pick<Dialogo, 'falar' | 'escolha' | 'cancelar'>;
  /** Gancho de autosave: chamado no começo de cada etapa e ao concluir a última missão. */
  autosave?(motivo: string): unknown;
  /** Yaw da câmera: se vier, o motor envia ui.marcadores a cada quadro. */
  yawCamera?(): number;
}

export interface ItemDiarioMissao {
  id: string;
  titulo: string;
  era: string;
  resumo: string;
  refs: Ref[];
  tipos: TipoMissao[];
  status: 'ativa' | 'concluida';
  etapa: number;
  totalEtapas: number;
  /** Objetivo atual (null quando concluída). */
  objetivo: string | null;
}

/** Erro lançado nas esperas quando a missão é abortada. */
export function erroAbortado(): Error {
  const e = new Error('Missão abortada');
  e.name = 'AbortError';
  return e;
}

export function ehAbortado(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';
}

/** Liga uma flag global e avisa o barramento ('flag'). */
export function definirFlag(jogo: Pick<AcessoJogo, 'flags' | 'eventos'>, nome: string, valor: unknown = true) {
  jogo.flags[nome] = valor;
  jogo.eventos.emit('flag', { nome, valor });
}

interface AlvoResolvido {
  pos: THREE.Vector3;
  /** A altura conta para "chegar" (pontos dentro da arca, objetos sobre plataformas). */
  usarY: boolean;
  rotulo?: string;
}

interface Execucao {
  def: DefMissao;
  estado: EstadoMissao;
  controlador: AbortController;
  ctx: CtxMissao;
  /** Encerrada (concluída, abortada ou com erro): as limpezas tardias não fazem nada. */
  encerrada: boolean;
  profundidadeCena: number;
  controleAntes: boolean;
  cameraMovida: boolean;
  emCena: Set<Personagem>;
  objetivo: { texto: string; alvos: Alvo[] };
  emProva: boolean;
  promessa: Promise<void>;
}

const RAIO_CHEGAR = 3;
const VEL_CENA = 1.5;

export class Missoes {
  private readonly deps: DepsMissoes;
  private readonly defs = new Map<string, DefMissao>();
  private readonly estados = new Map<string, EstadoMissao>();
  private readonly resolvedores: ((nome: string) => THREE.Vector3 | null)[] = [];
  private atual: Execucao | null = null;
  private idAtual: string | null = null;

  constructor(deps: DepsMissoes) {
    this.deps = deps;
    const yaw = deps.yawCamera;
    if (yaw) deps.jogo.aCadaQuadro(() => deps.ui.marcadores(this.marcadores(), yaw()));
  }

  private get jogo() {
    return this.deps.jogo;
  }

  // ------------------------------------------------------------------ registro

  registrar(defs: DefMissao | DefMissao[]) {
    for (const d of Array.isArray(defs) ? defs : [defs]) {
      if (!d.etapas.length) throw new Error(`Missão "${d.id}" sem etapas`);
      const ids = new Set<string>();
      for (const e of d.etapas) {
        if (ids.has(e.id)) throw new Error(`Missão "${d.id}": etapa repetida "${e.id}"`);
        ids.add(e.id);
      }
      this.defs.set(d.id, d);
    }
  }

  definicao(id: string): DefMissao | undefined {
    return this.defs.get(id);
  }

  /** Pontos nomeados extras (ex.: MundoNoe.pontoArca). Consultados antes de mundo.pontos. */
  registrarPontos(fn: (nome: string) => THREE.Vector3 | null): () => void {
    this.resolvedores.push(fn);
    return () => {
      const i = this.resolvedores.indexOf(fn);
      if (i >= 0) this.resolvedores.splice(i, 1);
    };
  }

  // ------------------------------------------------------------------ consulta

  /** Missão em execução agora. */
  ativa(): { def: DefMissao; estado: EstadoMissao; objetivo: string } | null {
    const ex = this.atual;
    return ex ? { def: ex.def, estado: ex.estado, objetivo: ex.objetivo.texto } : null;
  }

  /** Id da missão atual (também depois de carregar, antes de retomar). */
  get missaoAtual(): string | null {
    return this.idAtual;
  }

  /** Promessa da execução atual (resolve ao concluir ou abortar). */
  get rodando(): Promise<void> | null {
    return this.atual?.promessa ?? null;
  }

  estado(id: string): EstadoMissao | undefined {
    return this.estados.get(id);
  }

  concluida(id: string): boolean {
    return this.estados.get(id)?.status === 'concluida';
  }

  /** Missões iniciadas e concluídas, na ordem em que começaram (Diário). */
  listaDiario(): ItemDiarioMissao[] {
    const out: ItemDiarioMissao[] = [];
    for (const e of this.estados.values()) {
      const d = this.defs.get(e.id);
      if (!d) continue;
      const concluida = e.status === 'concluida';
      const objetivo = concluida
        ? null
        : this.atual?.def.id === e.id
          ? this.atual.objetivo.texto
          : d.etapas[Math.min(e.etapa, d.etapas.length - 1)].objetivo;
      out.push({
        id: d.id, titulo: d.titulo, era: d.era, resumo: d.resumo, refs: [...d.refs], tipos: [...d.tipos],
        status: e.status, etapa: e.etapa, totalEtapas: d.etapas.length, objetivo,
      });
    }
    return out;
  }

  /** Marcadores dos alvos do objetivo atual (para ui.marcadores). */
  marcadores(): MarcadorTela[] {
    const ex = this.atual;
    if (!ex || !ex.objetivo.alvos.length) return [];
    const out: MarcadorTela[] = [];
    ex.objetivo.alvos.forEach((a, i) => {
      const r = this.tentarResolver(a);
      if (!r) return;
      const ehPersonagem = typeof a === 'object' && !Array.isArray(a) && 'personagem' in a;
      out.push({ id: `${ex.def.id}:${i}`, pos: r.pos, rotulo: r.rotulo ?? ex.objetivo.texto, tipo: ehPersonagem ? 'personagem' : 'objetivo' });
    });
    return out;
  }

  // ------------------------------------------------------------------ alvos

  /** Converte um Alvo em posição de mundo. Lança se for desconhecido. */
  resolverAlvo(alvo: Alvo): AlvoResolvido {
    const r = this.tentarResolver(alvo);
    if (!r) throw new Error(`Alvo desconhecido: ${JSON.stringify(alvo)}`);
    return r;
  }

  private tentarResolver(alvo: Alvo): AlvoResolvido | null {
    const m = this.jogo.mundo;
    if (typeof alvo === 'string') {
      for (const r of this.resolvedores) {
        const v = r(alvo);
        if (v) return { pos: v, usarY: true };
      }
      const p = m?.pontos.get(alvo);
      if (p) return { pos: new THREE.Vector3(p[0], m!.chao(p[0], p[1]), p[1]), usarY: false };
      const i = m?.interativos.obter(alvo);
      if (i) return { pos: i.pos, usarY: true, rotulo: i.rotulo };
      const pers = m?.personagens.get(alvo);
      if (pers) return { pos: pers.posicao, usarY: false, rotulo: pers.nome };
      return null;
    }
    if (Array.isArray(alvo)) {
      const y = m ? m.chao(alvo[0], alvo[1]) : 0;
      return { pos: new THREE.Vector3(alvo[0], y, alvo[1]), usarY: false };
    }
    if ('personagem' in alvo) {
      const p = m?.personagens.get(alvo.personagem);
      return p ? { pos: p.posicao, usarY: false, rotulo: p.nome } : null;
    }
    return { pos: new THREE.Vector3(alvo.x, alvo.y, alvo.z), usarY: true };
  }

  // ------------------------------------------------------------------ ciclo de vida

  /**
   * Inicia (ou continua, se já estava ativa) uma missão. Aborta a execução atual, se houver.
   * Resolve quando esta missão termina ou é abortada (a `proxima` segue sozinha).
   */
  iniciar(id: string, opcoes: { reiniciar?: boolean } = {}): Promise<void> {
    const def = this.defs.get(id);
    if (!def) return Promise.reject(new Error(`Missão desconhecida: ${id}`));
    if (this.atual) this.abortar();
    let estado = this.estados.get(id);
    if (estado?.status === 'concluida' && !opcoes.reiniciar) {
      console.warn(`Missão "${id}" já concluída.`);
      return Promise.resolve();
    }
    const nova = !estado || !!opcoes.reiniciar;
    if (nova) {
      estado = { id, etapa: 0, status: 'ativa', contadores: {} };
      this.estados.delete(id);
      this.estados.set(id, estado);
    }
    return this.executar(def, estado!, nova, false);
  }

  /** Depois de restaurar(): roda de novo, do começo, a etapa atual da missão atual. */
  retomar(): Promise<void> | null {
    const id = this.idAtual;
    if (!id) return null;
    const def = this.defs.get(id);
    const estado = this.estados.get(id);
    if (!def || !estado || estado.status === 'concluida') return null;
    if (this.atual) this.abortar();
    return this.executar(def, estado, false, true);
  }

  private executar(def: DefMissao, estado: EstadoMissao, nova: boolean, retomada: boolean): Promise<void> {
    estado.status = 'ativa';
    this.idAtual = def.id;
    const ex: Execucao = {
      def,
      estado,
      controlador: new AbortController(),
      ctx: null as unknown as CtxMissao,
      encerrada: false,
      profundidadeCena: 0,
      controleAntes: true,
      cameraMovida: false,
      emCena: new Set(),
      objetivo: { texto: '', alvos: [] },
      emProva: false,
      promessa: Promise.resolve(),
    };
    ex.ctx = this.criarCtx(ex);
    this.atual = ex;
    if (nova) this.jogo.eventos.emit('missao:iniciada', { id: def.id });
    ex.promessa = this.rodar(ex, retomada);
    return ex.promessa;
  }

  private async rodar(ex: Execucao, retomada: boolean): Promise<void> {
    const { def, estado } = ex;
    let proxima: string | undefined;
    try {
      await carregarBiblia();
      this.verificar(ex);
      while (estado.etapa < def.etapas.length) {
        const etapa = def.etapas[estado.etapa];
        if (!retomada) this.deps.autosave?.(`${def.id}:${etapa.id}`);
        retomada = false;
        this.jogo.eventos.emit('missao:etapa', { id: def.id, etapa: estado.etapa });
        ex.objetivo = { texto: etapa.objetivo, alvos: [] };
        this.deps.ui.objetivo(def.titulo, etapa.objetivo);
        await etapa.executar(ex.ctx);
        this.verificar(ex);
        await this.fimDeEtapa(ex);
        this.verificar(ex);
        estado.etapa++;
      }
      proxima = this.concluir(ex);
    } catch (e) {
      if (ex.controlador.signal.aborted || ehAbortado(e)) return;
      console.error(`Missão "${def.id}", etapa ${estado.etapa} (${def.etapas[estado.etapa]?.id}):`, e);
      this.jogo.eventos.emit('missao:erro', { id: def.id, etapa: estado.etapa, erro: String((e as Error)?.message ?? e) });
      this.encerrar(ex);
      return;
    }
    this.encerrar(ex);
    if (proxima) {
      if (this.defs.has(proxima)) void this.iniciar(proxima);
      else console.error(`Missão seguinte desconhecida: ${proxima}`);
    } else {
      this.deps.autosave?.(`fim:${def.id}`);
    }
  }

  /** Lança AbortError se a execução foi abortada. */
  private verificar(ex: Execucao) {
    if (ex.controlador.signal.aborted || ex.encerrada) throw erroAbortado();
  }

  private async fimDeEtapa(ex: Execucao) {
    for (const p of ex.emCena) p.emCena = false;
    ex.emCena.clear();
    if (ex.cameraMovida) {
      ex.cameraMovida = false;
      await this.deps.cinematica.voltar();
    }
  }

  private concluir(ex: Execucao): string | undefined {
    const { def, estado } = ex;
    estado.status = 'concluida';
    this.deps.ui.objetivo(null, null);
    const r = def.recompensa;
    const p = this.deps.progresso;
    if (r?.xp) p.ganharXP('grupo', 'missao', r.xp);
    if (r?.memoria) p.memoria(r.memoria);
    if (r?.armadura) p.receberArmadura(r.armadura);
    p.contar('missoes');
    this.deps.ui.aviso(`Missão concluída: ${def.titulo}`, 'info');
    this.jogo.eventos.emit('missao:concluida', { id: def.id });
    this.idAtual = def.proxima ?? null;
    return def.proxima;
  }

  /** Desfaz o que a execução deixou ligado (cena, personagens em cena, prova, diálogo). */
  private encerrar(ex: Execucao) {
    if (ex.encerrada) return;
    ex.encerrada = true;
    if (ex.profundidadeCena > 0) {
      ex.profundidadeCena = 0;
      this.jogo.controleLivre = ex.controleAntes;
      this.deps.ui.modoCinema(false);
    }
    for (const p of ex.emCena) p.emCena = false;
    ex.emCena.clear();
    if (ex.cameraMovida) {
      ex.cameraMovida = false;
      this.deps.cinematica.voltar().catch(() => undefined);
    }
    if (this.atual === ex) this.atual = null;
  }

  /** Aborta a execução atual (carregar save, transição de era, depuração). O estado fica onde estava. */
  abortar() {
    const ex = this.atual;
    if (!ex) return;
    ex.controlador.abort();
    if (ex.emProva) {
      ex.emProva = false;
      this.deps.provas.cancelar();
    }
    this.deps.dialogo.cancelar();
    this.encerrar(ex);
  }

  /** Depuração: abandona a etapa atual e começa a seguinte. */
  pularEtapa() {
    const ex = this.atual;
    if (!ex) return;
    this.abortar();
    ex.estado.etapa++;
    if (ex.estado.etapa >= ex.def.etapas.length) ex.estado.etapa = ex.def.etapas.length - 1;
    void this.executar(ex.def, ex.estado, false, false);
  }

  // ------------------------------------------------------------------ save

  serializar(): { missoes: Record<string, EstadoMissao>; missaoAtual: string | null } {
    const missoes: Record<string, EstadoMissao> = {};
    for (const [id, e] of this.estados) missoes[id] = { ...e, contadores: { ...e.contadores } };
    return { missoes, missaoAtual: this.idAtual };
  }

  /** Restaura os estados (sem rodar nada). Depois de reconstruir o mundo, chame retomar(). */
  restaurar(missoes: Record<string, EstadoMissao>, missaoAtual: string | null) {
    this.abortar();
    this.estados.clear();
    for (const [id, e] of Object.entries(missoes)) this.estados.set(id, { ...e, id, contadores: { ...e.contadores } });
    this.idAtual = missaoAtual;
  }

  /** Novo jogo. */
  reiniciar() {
    this.abortar();
    this.estados.clear();
    this.idAtual = null;
  }

  // ------------------------------------------------------------------ esperas

  /**
   * Espera algo que resolve por callback. `iniciar` devolve a limpeza (desinscrever eventos,
   * parar o quadro a quadro), chamada ao resolver, falhar ou abortar.
   */
  private aguardar<T>(ex: Execucao, iniciar: (ok: (v: T) => void, falha: (e: unknown) => void) => (() => void) | void): Promise<T> {
    const sinal = ex.controlador.signal;
    if (sinal.aborted || ex.encerrada) return Promise.reject(erroAbortado());
    return new Promise<T>((resolver, rejeitar) => {
      let limpar: (() => void) | void;
      let feito = false;
      const fim = () => {
        feito = true;
        sinal.removeEventListener('abort', aoAbortar);
        if (limpar) limpar();
      };
      const aoAbortar = () => {
        if (feito) return;
        fim();
        rejeitar(erroAbortado());
      };
      sinal.addEventListener('abort', aoAbortar);
      limpar = iniciar(
        (v) => {
          if (feito) return;
          fim();
          resolver(v);
        },
        (e) => {
          if (feito) return;
          fim();
          rejeitar(e);
        },
      );
      if (feito && limpar) limpar();
    });
  }

  /** Corre uma promessa externa contra o abort. */
  private correr<T>(ex: Execucao, p: () => Promise<T>): Promise<T> {
    return this.aguardar<T>(ex, (ok, falha) => {
      p().then(ok, falha);
    });
  }

  private personagemDe(quem: string): Personagem {
    if (quem === 'ativo') {
      const a = this.jogo.ativo;
      if (!a) throw new Error('Nenhum personagem ativo');
      return a;
    }
    return this.jogo.personagem(quem);
  }

  private perto(p: Personagem, r: AlvoResolvido, raio: number): boolean {
    const a = p.posicao;
    const dx = a.x - r.pos.x;
    const dz = a.z - r.pos.z;
    if (dx * dx + dz * dz > raio * raio) return false;
    return !r.usarY || Math.abs(a.y - r.pos.y) <= Math.max(2.5, raio);
  }

  private vec(v: Vec3): THREE.Vector3 {
    return Array.isArray(v) ? new THREE.Vector3(v[0], v[1], v[2]) : v;
  }

  // ------------------------------------------------------------------ contexto

  private criarCtx(ex: Execucao): CtxMissao {
    const self = this;
    const jogo = this.jogo;
    const deps = this.deps;
    const ctx: CtxMissao = {
      get missao() {
        return ex.def;
      },
      get estado() {
        return ex.estado;
      },
      get sinal() {
        return ex.controlador.signal;
      },
      get mundo() {
        const m = jogo.mundo;
        if (!m) throw new Error('Sem mundo carregado');
        return m;
      },
      get flags() {
        return jogo.flags;
      },
      personagem: (id: string) => jogo.personagem(id),
      ativo: () => self.personagemDe('ativo'),

      // rastreamento
      objetivo(texto: string, alvos?: Alvo[]) {
        ex.objetivo = { texto, alvos: alvos ?? [] };
        deps.ui.objetivo(ex.def.titulo, texto);
      },
      contador(nome: string, valor?: number) {
        if (valor !== undefined) ex.estado.contadores[nome] = valor;
        return ex.estado.contadores[nome] ?? 0;
      },

      // esperas
      esperar(segundos: number) {
        return self.aguardar<void>(ex, (ok) => {
          if (segundos <= 0) {
            ok();
            return;
          }
          let t = 0;
          return jogo.aCadaQuadro((dt) => {
            t += dt;
            if (t >= segundos - 1e-6) ok();
          });
        });
      },
      esperarFlag(nome: string) {
        return self.aguardar<void>(ex, (ok) => {
          if (jogo.flags[nome]) {
            ok();
            return;
          }
          const off1 = jogo.eventos.on('flag', (d: { nome?: string; valor?: unknown }) => {
            if (d?.nome === nome && d.valor) ok();
          });
          const off2 = jogo.aCadaQuadro(() => {
            if (jogo.flags[nome]) ok();
          });
          return () => {
            off1();
            off2();
          };
        });
      },
      esperarEvento<T = unknown>(nome: string, filtro?: (dados: T) => boolean) {
        return self.aguardar<T>(ex, (ok, falha) =>
          jogo.eventos.on(nome, (d: T) => {
            try {
              if (!filtro || filtro(d)) ok(d);
            } catch (e) {
              falha(e);
            }
          }),
        );
      },
      chegar(quem: string, alvo: Alvo, raio = RAIO_CHEGAR) {
        return self.aguardar<void>(ex, (ok, falha) => {
          const checar = () => {
            const p = quem === 'ativo' ? jogo.ativo : jogo.mundo?.personagens.get(quem);
            if (!p) return;
            const r = self.tentarResolver(alvo);
            if (r && self.perto(p, r, raio)) ok();
          };
          try {
            self.resolverAlvo(alvo);
            if (quem !== 'ativo') self.personagemDe(quem);
          } catch (e) {
            falha(e);
            return;
          }
          checar();
          return jogo.aCadaQuadro(checar);
        });
      },
      interacao(id: string) {
        return self.aguardar<Personagem>(ex, (ok) =>
          jogo.eventos.on('interacao', (d: { id?: string; personagem?: Personagem }) => {
            if (d?.id === id && d.personagem) ok(d.personagem);
          }),
        );
      },

      // fala e texto
      dialogo(linhas: Linha[]) {
        return self.correr(ex, () => deps.dialogo.falar(linhas));
      },
      escolha(pergunta: Linha | null, opcoes: OpcaoEscolha[]) {
        return self.correr(ex, () => deps.dialogo.escolha(pergunta, opcoes));
      },
      versiculo(ref: Ref) {
        deps.progresso.receberVersiculo(ref);
        deps.ui.bannerVersiculo(versiculo(ref));
      },
      dica(texto: string) {
        deps.ui.dica(texto);
      },
      aviso(texto: string) {
        deps.ui.aviso(texto, 'info');
      },

      // cinemática
      async cena<T>(fn: () => Promise<T>): Promise<T> {
        self.verificar(ex);
        if (ex.profundidadeCena++ === 0) {
          ex.controleAntes = jogo.controleLivre;
          jogo.controleLivre = false;
          deps.ui.modoCinema(true);
        }
        try {
          return await fn();
        } finally {
          if (!ex.encerrada && --ex.profundidadeCena === 0) {
            for (const p of ex.emCena) p.emCena = false;
            ex.emCena.clear();
            if (ex.cameraMovida) {
              ex.cameraMovida = false;
              await deps.cinematica.voltar().catch((e) => console.warn('cinemática:', e));
            }
            jogo.controleLivre = ex.controleAntes;
            deps.ui.modoCinema(false);
          }
        }
      },
      camera(pos: Vec3, alvo: Vec3, duracao: number) {
        ex.cameraMovida = true;
        return self.correr(ex, () => deps.cinematica.para(self.vec(pos), self.vec(alvo), duracao));
      },
      cameraVoltar(duracao?: number) {
        ex.cameraMovida = false;
        return self.correr(ex, () => deps.cinematica.voltar(duracao));
      },
      async mover(quem: string, alvo: Alvo, velocidade?: number) {
        self.verificar(ex);
        const p = self.personagemDe(quem);
        const destino = self.resolverAlvo(alvo).pos.clone();
        p.emCena = true;
        ex.emCena.add(p);
        const vel = velocidade ?? VEL_CENA;
        const limite = Math.hypot(destino.x - p.posicao.x, destino.z - p.posicao.z) / Math.max(0.3, vel) * 2 + 4;
        await self.aguardar<void>(ex, (ok) => {
          p.ia.moverCena(destino.x, destino.z, vel).then(() => ok());
          let t = 0;
          return jogo.aCadaQuadro((dt) => {
            t += dt;
            if (t > limite) {
              // preso no caminho: reposiciona (o roteiro não pode travar)
              const y = jogo.mundo ? jogo.mundo.chao(destino.x, destino.z, destino.y + 2) : destino.y;
              p.teleportar(destino.x, y, destino.z);
              ok();
            }
          });
        });
        if (ex.profundidadeCena === 0) {
          p.emCena = false;
          ex.emCena.delete(p);
        }
      },
      animar(quem: string, clipe: NomeClipe, corpo: 'todo' | 'superior' = 'todo') {
        const p = self.personagemDe(quem);
        return self.correr(ex, () => p.humano.animador.tocar(clipe, corpo));
      },
      fade(paraPreto: boolean, duracao = 1) {
        return self.correr(ex, () => deps.ui.fade(paraPreto, duracao));
      },
      titulo(texto: string, sub?: string) {
        return self.correr(ex, () => deps.ui.titulo(texto, sub));
      },

      // progresso
      xp(alvo: string, fonte: FonteXP, qtd?: number) {
        deps.progresso.ganharXP(alvo, fonte, qtd);
      },
      treinar(personagem: string, atributo: NomeAtributo, qtd: number) {
        deps.progresso.treinar(personagem, atributo, qtd);
      },
      memoria(id: string) {
        deps.progresso.memoria(id);
      },
      armadura(peca: PecaArmadura) {
        deps.progresso.receberArmadura(peca);
      },
      unidade(delta: number) {
        deps.progresso.alterarUnidade(delta);
      },
      receberVersiculo(ref: Ref) {
        deps.progresso.receberVersiculo(ref);
      },
      definirFlag(nome: string, valor: unknown = true) {
        definirFlag(jogo, nome, valor);
      },
      disponivel(personagem: string, sim: boolean) {
        jogo.personagem(personagem).disponivel = sim;
      },

      // espiritual
      async prova(def: DefProva) {
        self.verificar(ex);
        const livre = def.tipo === 'medo';
        const antes = jogo.controleLivre;
        if (!livre) jogo.controleLivre = false;
        ex.emProva = true;
        try {
          return await self.correr(ex, () => deps.provas.iniciar(def));
        } finally {
          ex.emProva = false;
          if (!livre && !ex.encerrada) jogo.controleLivre = antes;
        }
      },
    };
    return ctx;
  }
}

// =====================================================================================
// Ligação com o Jogo
// =====================================================================================

/** O que criarSistemas() usa do Jogo (Jogo satisfaz). */
export interface JogoSistemas extends AcessoJogo {
  readonly entrada: EntradaProva;
  readonly cam?: { yaw: number };
  readonly ceu?: { hora: number };
}

export interface SistemasHistoria {
  progresso: Progresso;
  dialogo: Dialogo;
  provas: Provas;
  missoes: Missoes;
  salvamento: Salvamento;
  /**
   * Aplica um save carregado: flags (no mesmo objeto), Progresso, estados das missões,
   * posição/ficha/disponibilidade dos personagens já criados e a hora. Não reconstrói o mundo
   * nem retoma a missão: depois de reconstruir pelas flags, chame missoes.retomar().
   */
  aplicar(d: DadosSave): void;
  /** Novo jogo: zera flags, Progresso, missões e a data de criação do save. */
  novoJogo(): void;
}

/**
 * Cria e liga Progresso, Diálogo, Provas, Missões e Salvamento a um Jogo:
 * avisos → ui.aviso, provas e tempo jogado a cada quadro, autosave nas fronteiras de etapa,
 * marcadores de objetivo a cada quadro. `era()` diz a era atual para o save.
 */
export function criarSistemas(
  jogo: JogoSistemas,
  ui: InterfaceUI,
  cinematica: ServicoCinematica,
  opcoes: { armazenamento: AdaptadorArmazenamento; era: () => string; nomesEras?: Record<string, string> },
): SistemasHistoria {
  const nomesEras = opcoes.nomesEras ?? { noe: 'Era 1 — Noé', abraao: 'Era 2 — Abraão' };
  const eventos = jogo.eventos;
  const pers = (id: string) => jogo.mundo?.personagens.get(id) ?? null;
  const progresso = new Progresso({
    eventos,
    ficha: (id) => pers(id)?.ficha ?? null,
    grupo: () => [...(jogo.mundo?.personagens.values() ?? [])].filter((p) => p.ficha && p.disponivel).map((p) => p.id),
    ativo: () => jogo.ativo?.id ?? null,
    nome: (id) => pers(id)?.nome ?? id,
    avisar: (texto, tipo) => ui.aviso(texto, tipo),
  });
  const dialogo = new Dialogo({
    ui,
    eventos,
    progresso,
    ativo: () => jogo.ativo,
    definirFlag: (nome, valor) => definirFlag(jogo, nome, valor),
  });
  const provas = new Provas({
    ui,
    entrada: jogo.entrada,
    eventos,
    progresso,
    personagem: (id) => (id ? pers(id) : jogo.ativo),
  });
  const missoes = new Missoes({
    jogo,
    ui,
    cinematica,
    progresso,
    provas,
    dialogo,
    autosave: (motivo) => salvamento.autosave(motivo),
    yawCamera: jogo.cam ? () => jogo.cam!.yaw : undefined,
  });
  const salvamento: Salvamento = new Salvamento(opcoes.armazenamento, {
    progresso,
    missoes,
    flags: () => jogo.flags,
    personagens: () => personagensParaSave(jogo.mundo?.personagens.values() ?? []),
    era: opcoes.era,
    hora: () => jogo.ceu?.hora ?? 9,
    ativo: () => jogo.ativo?.id ?? '',
    eventos,
    nomeEra: (id) => nomesEras[id] ?? id,
    nomeMissao: (id) => missoes.definicao(id)?.titulo ?? id,
    nomePersonagem: (id) => pers(id)?.nome ?? id,
  });
  jogo.aCadaQuadro((dt) => {
    provas.atualizar(dt);
    progresso.atualizar(dt);
  });
  const ceu = jogo.ceu;
  return {
    progresso, dialogo, provas, missoes, salvamento,
    aplicar(d: DadosSave) {
      missoes.abortar();
      provas.cancelar();
      dialogo.cancelar();
      restaurarFlags(jogo.flags, d.flags);
      progresso.restaurar(d);
      missoes.restaurar(d.missoes, d.missaoAtual);
      aplicarPersonagens(d.personagens, (id) => pers(id));
      if (ceu) ceu.hora = d.hora;
      salvamento.criadoEm = d.criadoEm;
    },
    novoJogo() {
      missoes.reiniciar();
      provas.cancelar();
      dialogo.cancelar();
      restaurarFlags(jogo.flags, {});
      progresso.reiniciar();
      salvamento.novoJogo();
    },
  };
}
