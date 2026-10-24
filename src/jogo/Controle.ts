import * as THREE from 'three';
import type { Jogo } from './Jogo';
import type { Personagem } from './Personagem';
import { Interativos, textoAcao, type Interativo } from './Interacoes';
import { NOMES_VERBOS, type Verbo } from './Classes';
import type { NomeClipe } from '../entidades/humano/Animador';
import type { Escalada } from '../mundo/Mundo';

export interface InfoPrompt {
  texto: string;
  tecla: string;
  pode: boolean;
  dica?: string;
  progresso?: number;
}

/** Animação padrão enquanto segura E, por verbo (o Interativo pode trocar com `animacao`). */
const ANIM_VERBO: Partial<Record<Verbo, NomeClipe>> = {
  construir: 'consertar', reparar: 'consertar', amarrar: 'consertar', construirAltar: 'consertar',
  cortar: 'cortar', empurrar: 'empurrar', segurar: 'segurar', preparar: 'consertar', cuidar: 'estenderMao',
  acalmar: 'estenderMao', abencoar: 'estenderMao', interceder: 'estenderMao', proclamar: 'gesto', servir: 'interagir',
};

/** Clipe de toque rápido (E sem segurar), por verbo. */
const TOQUE_VERBO: Partial<Record<Verbo, NomeClipe>> = {
  pegar: 'pegar', carregar: 'pegar', carregarPesado: 'pegar', falar: 'sim', olhar: 'interagir',
};

/** Frase da dica "X pode … isto" por verbo. */
const DICA_VERBO: Partial<Record<Verbo, string>> = {
  carregarPesado: 'carregar isto', escalar: 'escalar isto', construir: 'construir isto', reparar: 'consertar isto',
  cortar: 'cortar isto', segurar: 'segurar isto', empurrar: 'empurrar isto', amarrar: 'amarrar isto',
  equilibrar: 'atravessar isto', acalmar: 'acalmar isto', construirAltar: 'erguer um altar aqui',
};

/** Alcance para pegar uma escalada pela base / pelo topo. */
const ALCANCE_BASE = 1.4;
const ALCANCE_TOPO = 1.3;

interface Segurando {
  p: Personagem;
  i: Interativo;
  t: number;
  dur: number;
}

type Alvo =
  | { tipo: 'interativo'; i: Interativo; pode: boolean; d: number }
  | { tipo: 'escalada'; e: Escalada; pode: boolean; d: number; peloTopo: boolean };

/**
 * Controle por quadro do personagem do jogador: prompt de interação (E: tocar ou segurar com
 * progresso), postos de cooperação, escalada (W/S), oração (R), habilidade de classe (Q) e
 * comando ao companheiro mais próximo (F: seguir/esperar).
 */
export class Controle {
  /** Neste quadro o personagem não anda (segurando E, orando). Lido pelo Jogo. */
  prendeMovimento = false;
  /** Último prompt mostrado (também enviado a `ui.prompt`). */
  prompt: InfoPrompt | null = null;
  /** Distância máxima do comando F. */
  alcanceComando = 15;
  private segurando: Segurando | null = null;
  private chavePrompt = '';
  private orando: Personagem | null = null;
  private recargaHabilidade = 0;
  private ocupado = false;
  private eixoSubir = 0;

  constructor(private jogo: Jogo) {}

  /** Esquece estados de quadro (troca de personagem, troca de mundo). */
  reiniciar() {
    this.cancelarSegurar();
    this.pararOracao();
    this.mostrar(null);
    this.ocupado = false;
  }

  /** Quem está no posto `id` (ou null). */
  ocupante(id: string): Personagem | null {
    const m = this.jogo.mundo;
    if (!m) return null;
    for (const p of m.personagens.values()) if (p.posto?.id === id) return p;
    return null;
  }

  /** Tira alguém do posto (o interativo recebe `aoSairPosto`). */
  liberarPosto(p: Personagem) {
    const id = p.posto?.id;
    if (!id) return;
    p.sairPosto();
    this.jogo.mundo?.interativos.obter(id)?.aoSairPosto?.(p);
    this.jogo.eventos.emit('posto', { id, personagem: p, entrou: false });
  }

  /**
   * Usa um interativo (ou escalada) como se o jogador tivesse apertado/segurado E, sem esperar
   * o tempo de segurar. Para atalhos de teste e scripts.
   */
  async usar(p: Personagem, id: string): Promise<void> {
    const m = this.jogo.mundo;
    if (!m) return;
    const e = m.escaladas.get(id);
    if (e) {
      this.jogo.eventos.emit('interacao', { id, personagem: p });
      this.jogo.eventos.emit('escalada', { id, personagem: p, fase: 'inicio' });
      p.teleportar(e.topo.x, e.topo.y + 0.05, e.topo.z, e.yaw);
      this.jogo.eventos.emit('escalada', { id, personagem: p, fase: 'topo' });
      return;
    }
    const i = m.interativos.obter(id);
    if (!i) throw new Error(`interativo ausente: ${id}`);
    if (i.segurar) i.aoProgresso?.(p, 1);
    await this.executar(p, i);
  }

  // ------------------------------------------------------------------------------------

  /** Antes do movimento: entrada de E/Q/R/F e o prompt. */
  atualizar(dt: number) {
    const j = this.jogo;
    const p = j.ativo;
    const e = j.entrada;
    this.prendeMovimento = false;
    this.recargaHabilidade = Math.max(0, this.recargaHabilidade - dt);
    this.eixoSubir = (e.ativa('frente') ? 1 : 0) - (e.ativa('tras') ? 1 : 0) - e.eixoMovY;
    if (!p || !j.mundo || !p.controlado || p.emCena || !j.controleLivre || j.troca.emAndamento || j.transicao || (j.ui?.menuAberto() ?? false)) {
      this.cancelarSegurar();
      this.pararOracao();
      this.mostrar(null);
      return;
    }
    const prova = j.prova;

    // R: orar (pose enquanto segura; o evento só fora das provas)
    if (e.ativa('orar') && !p.escalada && !this.segurando) {
      if (this.orando !== p) {
        this.pararOracao();
        this.orando = p;
        if (!prova) j.eventos.emit('oracao', { personagem: p.id });
      }
      p.humano.oracao = 1;
      this.prendeMovimento = true;
    } else this.pararOracao();

    // Q: habilidade de classe (fora das provas: lá o Q é "Está escrito")
    if (e.pressionou('habilidade') && !prova && p.classe && this.recargaHabilidade <= 0 && !p.escalada) {
      this.recargaHabilidade = 1;
      j.eventos.emit('habilidade', { personagem: p.id, classe: p.classe });
      if (!p.posto && !p.carregando) void p.humano.animador.tocar('gesto', 'superior', 1.2);
    }

    // F: comando ao companheiro jogável mais próximo
    if (e.pressionou('comando') && !prova) this.comandar(p);

    // nas provas que prendem o jogador, E fica com a prova
    if (prova && !prova.livre) {
      this.cancelarSegurar();
      this.mostrar(null);
      return;
    }
    if (this.orando) {
      this.mostrar(null);
      return;
    }

    if (p.escalada) {
      this.atualizarEscalada(p);
      return;
    }
    if (p.posto) {
      const i = j.mundo.interativos.obter(p.posto.id);
      this.mostrar({ texto: i?.posto?.rotuloSair ?? 'Soltar', tecla: 'E', pode: true });
      if (e.pressionou('interagir')) this.liberarPosto(p);
      return;
    }
    if (this.ocupado) {
      this.mostrar(null);
      return;
    }

    const alvo = this.alvo(p);
    if (this.segurando) {
      const s = this.segurando;
      // continua valendo enquanto o interativo segurado estiver ativo e ao alcance (mesmo que
      // outro fique "mais perto" ao virar o corpo)
      const dx = s.i.pos.x - p.posicao.x;
      const dz = s.i.pos.z - p.posicao.z;
      const mesmo = Interativos.ativo(s.i) && Math.hypot(dx, dz) <= s.i.raio + 0.5;
      if (!e.ativa('interagir') || !mesmo || s.p !== p) {
        this.cancelarSegurar();
      } else {
        this.prendeMovimento = true;
        s.t += dt;
        const k = Math.min(1, s.t / s.dur);
        s.i.aoProgresso?.(p, k);
        this.virarPara(p, s.i.pos);
        this.mostrar({ texto: textoAcao(s.i), tecla: 'E', pode: true, progresso: k });
        if (k >= 1) {
          const i = s.i;
          this.segurando = null;
          this.restaurarPose(p, i);
          void this.executar(p, i);
        }
        return;
      }
    }

    if (!alvo) {
      this.mostrar(null);
      return;
    }
    if (alvo.tipo === 'escalada') {
      const texto = alvo.peloTopo ? 'Descer' : 'Escalar';
      if (!alvo.pode) {
        this.mostrar({ texto, tecla: 'E', pode: false, dica: this.dicaVerbo('escalar') });
        if (e.pressionou('interagir')) j.ui?.dica(this.dicaVerbo('escalar'));
        return;
      }
      this.mostrar({ texto, tecla: 'E', pode: true });
      if (e.pressionou('interagir')) this.comecarEscalada(p, alvo.e, alvo.peloTopo);
      return;
    }
    const i = alvo.i;
    if (!alvo.pode) {
      const dica = i.dica ?? this.dicaVerbo(i.verbo);
      this.mostrar({ texto: textoAcao(i), tecla: 'E', pode: false, dica });
      if (e.pressionou('interagir')) j.ui?.dica(dica);
      return;
    }
    this.mostrar({ texto: textoAcao(i), tecla: 'E', pode: true, progresso: i.segurar ? 0 : undefined });
    if (e.pressionou('interagir')) {
      if (i.segurar && i.segurar > 0) {
        this.segurando = { p, i, t: 0, dur: i.segurar / this.ritmo(p, i.verbo) };
        this.prendeMovimento = true;
        this.aplicarPose(p, i);
      } else {
        this.virarPara(p, i.pos);
        const toque = i.animacao ?? TOQUE_VERBO[i.verbo] ?? 'interagir';
        if (!i.posto && !p.carregando) void p.humano.animador.tocar(toque, 'todo', 1.3);
        void this.executar(p, i);
      }
    }
  }

  /** Depois do movimento: saída da escalada no topo/base. */
  depoisDoMovimento(_dt: number) {
    const p = this.jogo.ativo;
    if (!p || !p.controlado || !p.escalada) return;
    const s = p.escalada;
    if (s.t >= 1 && this.eixoSubir > 0.3) this.terminarEscalada(p, 'topo');
    else if (s.t <= 0 && this.eixoSubir < -0.3) this.terminarEscalada(p, 'base');
  }

  // ------------------------------------------------------------------------------------

  private atualizarEscalada(p: Personagem) {
    const s = p.escalada!;
    const e = this.jogo.entrada;
    if (s.t >= 0.85) {
      this.mostrar({ texto: 'Subir para a plataforma', tecla: 'W', pode: true });
      if (e.pressionou('interagir')) this.terminarEscalada(p, 'topo');
    } else if (s.t <= 0.15) {
      this.mostrar({ texto: 'Soltar', tecla: 'E', pode: true });
      if (e.pressionou('interagir')) this.terminarEscalada(p, 'base');
    } else this.mostrar({ texto: 'Subir / descer', tecla: 'W/S', pode: true });
  }

  private comecarEscalada(p: Personagem, e: Escalada, peloTopo: boolean) {
    this.cancelarSegurar();
    p.velocidadeEscalada = 1.5 * this.ritmo(p, 'escalar');
    p.iniciarEscalada(e, peloTopo);
    this.jogo.eventos.emit('interacao', { id: e.id, personagem: p });
    this.jogo.eventos.emit('escalada', { id: e.id, personagem: p, fase: 'inicio' });
  }

  private terminarEscalada(p: Personagem, onde: 'topo' | 'base') {
    const id = p.escalada?.e.id;
    p.sairEscalada(onde);
    if (id) this.jogo.eventos.emit('escalada', { id, personagem: p, fase: onde });
  }

  /** Dons que aceleram ações (Construtor "Mãos firmes", Batedor "Pés leves"). */
  private ritmo(p: Personagem, v: Verbo) {
    const nivel = p.ficha?.nivel ?? 1;
    if (p.classe === 'construtor' && nivel >= 2 && (v === 'construir' || v === 'reparar' || v === 'construirAltar')) return 1.25;
    if (p.classe === 'batedor' && nivel >= 2 && v === 'escalar') return 1.25;
    return 1;
  }

  /** Interativo ou escalada mais perto do personagem. */
  private alvo(p: Personagem): Alvo | null {
    const m = this.jogo.mundo!;
    let melhor: Alvo | null = null;
    const r = m.interativos.maisProximo(p, (i) => {
      if (!i.posto) return false;
      const o = this.ocupante(i.id);
      return !!o && o !== p;
    });
    if (r) melhor = { tipo: 'interativo', i: r.i, pode: r.pode, d: r.distancia };
    const pos = p.posicao;
    const podeEscalar = p.pode('escalar');
    for (const e of m.escaladas.values()) {
      if (!e.ativa) continue;
      const larg = (e.largura ?? 1) / 2;
      const db = Math.hypot(e.base.x - pos.x, e.base.z - pos.z);
      if (db <= ALCANCE_BASE + larg && Math.abs(e.base.y - pos.y) < 1.2 && (!melhor || db < melhor.d)) {
        melhor = { tipo: 'escalada', e, pode: podeEscalar, d: db, peloTopo: false };
      }
      const dt = Math.hypot(e.topo.x - pos.x, e.topo.z - pos.z);
      if (dt <= ALCANCE_TOPO + larg && Math.abs(e.topo.y - pos.y) < 1.0 && (!melhor || dt < melhor.d)) {
        melhor = { tipo: 'escalada', e, pode: podeEscalar, d: dt, peloTopo: true };
      }
    }
    return melhor;
  }

  /** "Jafé pode escalar isto" (ou "Cam ou Noé pode …"), a partir dos jogáveis do mundo. */
  dicaVerbo(v: Verbo): string {
    const m = this.jogo.mundo;
    const nomes = m ? [...m.personagens.values()].filter((q) => q.def.jogavel && q.pode(v)).map((q) => q.nome) : [];
    const acao = DICA_VERBO[v] ?? `${NOMES_VERBOS[v].toLowerCase()} isto`;
    if (!nomes.length) return 'Ninguém aqui sabe fazer isto ainda.';
    const quem = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} ou ${nomes[nomes.length - 1]}`;
    return `${quem} pode ${acao}`;
  }

  /** Executa a interação: posto (se houver), aoInteragir e o evento 'interacao'. */
  private async executar(p: Personagem, i: Interativo) {
    const j = this.jogo;
    if (i.posto) {
      const d = i.posto;
      const m = j.mundo!;
      if (d.pos) p.teleportar(d.pos.x, m.chao(d.pos.x, d.pos.z, d.pos.y + 1), d.pos.z);
      const yaw = d.yaw ?? Math.atan2(i.pos.x - p.posicao.x, i.pos.z - p.posicao.z);
      p.corpo.vel.set(0, 0, 0);
      p.entrarPosto(i.id, d.clipe ?? 'segurar', yaw, d.descricao);
    }
    this.ocupado = true;
    try {
      const r = i.aoInteragir(p);
      if (r && typeof (r as Promise<void>).then === 'function') await r;
    } finally {
      this.ocupado = false;
    }
    j.eventos.emit('interacao', { id: i.id, personagem: p });
    if (i.posto) j.eventos.emit('posto', { id: i.id, personagem: p, entrou: true });
  }

  private aplicarPose(p: Personagem, i: Interativo) {
    this.virarPara(p, i.pos);
    if (i.verbo === 'orar' && !i.animacao) {
      p.humano.oracao = 1;
      return;
    }
    const clipe = i.animacao ?? ANIM_VERBO[i.verbo] ?? 'interagir';
    p.humano.animador.atividade = clipe;
  }

  private restaurarPose(p: Personagem, i: Interativo) {
    if (i.verbo === 'orar' && !i.animacao) p.humano.oracao = 0;
    if (!p.posto) p.humano.animador.atividade = null;
  }

  private cancelarSegurar() {
    const s = this.segurando;
    if (!s) return;
    this.segurando = null;
    s.i.aoProgresso?.(s.p, 0);
    this.restaurarPose(s.p, s.i);
  }

  private pararOracao() {
    if (!this.orando) return;
    this.orando.humano.oracao = 0;
    this.orando = null;
  }

  private virarPara(p: Personagem, alvo: THREE.Vector3) {
    if (p.posto) return;
    const dx = alvo.x - p.posicao.x;
    const dz = alvo.z - p.posicao.z;
    if (dx * dx + dz * dz > 0.04) p.yaw = Math.atan2(dx, dz);
  }

  private comandar(p: Personagem) {
    const j = this.jogo;
    const m = j.mundo!;
    let melhor: Personagem | null = null;
    let md = this.alcanceComando;
    for (const q of m.personagens.values()) {
      if (q === p || !q.def.jogavel || !q.disponivel || q.emCena || q.posto || q.escalada) continue;
      const d = q.posicao.distanceTo(p.posicao);
      if (d < md) {
        md = d;
        melhor = q;
      }
    }
    if (!melhor) {
      j.ui?.aviso('Ninguém por perto para chamar.', 'info');
      return;
    }
    const seguindo = melhor.ia.ordem.tipo === 'seguir';
    if (seguindo) melhor.ia.esperar();
    else melhor.ia.seguir(p);
    const ordem = seguindo ? 'esperar' : 'seguir';
    j.ui?.aviso(seguindo ? `${melhor.nome} vai esperar aqui.` : `${melhor.nome} vai seguir você.`, 'info');
    j.eventos.emit('comando', { personagem: melhor, ordem });
    if (!p.posto && !p.carregando) void p.humano.animador.tocar('gesto', 'superior', 1.4);
  }

  private mostrar(info: InfoPrompt | null) {
    const chave = info ? `${info.texto}|${info.tecla}|${info.pode}|${info.dica ?? ''}|${info.progresso === undefined ? '' : info.progresso.toFixed(2)}` : '';
    if (chave === this.chavePrompt) return;
    this.chavePrompt = chave;
    this.prompt = info;
    this.jogo.ui?.prompt(info);
  }
}
