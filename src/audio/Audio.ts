// Áudio do jogo, todo sintetizado com Web Audio (nenhum arquivo): ambientes em camadas,
// efeitos, vozes dos animais e música generativa (pad + lira Karplus-Strong em modos).
//
// Uso:
//   import { Audio } from '../audio/Audio';
//   Audio.iniciarNoPrimeiroGesto();          // ou: await Audio.iniciar() dentro de um clique/tecla
//   Audio.ambiente('vale', 0.8);             // 'vale','canaa','vento','passaros','agua','chuva','tempestade',
//                                            // 'cidade','fogueira','noite','interiorArca','monte' (0..1)
//   Audio.ambiente('agua', 1, { pos: [x, y, z], alcance: 40 }); // fonte posicional simples
//   Audio.musica('calmo');                   // 'calmo'|'aventura'|'prova'|'gloria'|'silencio'
//   Audio.efeito('passo', { superficie: 'madeira', pos });
//   Audio.efeito('conquista', { tipo: 'memoria' });
//   Audio.volume({ musica: 0.6, efeitos: 0.9 });
//   Audio.posicaoOuvinte(camera.position, yawCamera);   // a cada quadro
// Tudo é seguro antes de iniciar: pedidos de ambiente/música ficam guardados; efeitos são ignorados.
import { MISTURAS, Camada, type NomeCamada } from './Ambientes';
import { Musica, type EstadoMusica } from './Musica';
import { criarCacheCordas, tocarEfeito, VOZES, type CtxSom, type OpcoesEfeito } from './Efeitos';
import { aleatorio, emLaco, respostaImpulso, ruidoBranco, ruidoMarrom, ruidoRosa } from './sintese';

export type { EstadoMusica, OpcoesEfeito };

type P3 = { x: number; y: number; z: number } | [number, number, number];

export interface OpcoesSom extends OpcoesEfeito {
  /** Posição da fonte (atenuação pela distância ao ouvinte e panorâmica). */
  pos?: P3;
  /** Distância em que o som some (padrão 35 m). */
  alcance?: number;
  /** Atraso em segundos. */
  atraso?: number;
}

export interface OpcoesAmbiente {
  pos?: P3;
  alcance?: number;
  /** Tempo da transição (s). */
  transicao?: number;
}

export interface Volumes {
  geral: number;
  musica: number;
  efeitos: number;
}

/** Efeitos conhecidos (para menus de teste e validação). */
export const EFEITOS = [
  'passo', 'clique', 'abrir', 'fechar', 'pegar', 'sopro', 'brilho', 'sino', 'conquista', 'memoria', 'armadura', 'nivel', 'versiculo', 'xp',
  'trovao', 'agua', 'fogo', 'asas', 'martelo', 'machado', 'corda', 'portaArca', 'tranco', 'rangido', 'sussurro', 'coracao', ...VOZES,
];

const CHAVE_VOLUME = 'aSemente.audio';

function xyz(p: P3): [number, number, number] {
  return Array.isArray(p) ? p : [p.x, p.y, p.z];
}

export class SistemaAudio {
  ctx: BaseAudioContext | null = null;
  private real: AudioContext | null = null;
  private cEfeitos: CtxSom | null = null;
  private cAmbiente: CtxSom | null = null;
  private mestre: GainNode | null = null;
  private busMusica: GainNode | null = null;
  private busEfeitos: GainNode | null = null;
  private trilha: Musica | null = null;
  private camadas = new Map<NomeCamada, Camada>();
  private pedidos = new Map<string, { i: number; pos?: [number, number, number]; alcance: number; transicao: number }>();
  private estadoMusica: EstadoMusica = 'silencio';
  private vol: Volumes = { geral: 1, musica: 0.65, efeitos: 0.9 };
  private mudo = false;
  private ouvinte: [number, number, number] = [0, 0, 0];
  private yaw: number | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private iniciando: Promise<void> | null = null;
  private ultimoAmb = new Map<NomeCamada, number>();
  erro: string | null = null;

  constructor() {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE_VOLUME) ?? 'null');
      if (v && typeof v === 'object') this.vol = { ...this.vol, ...v };
    } catch {
      /* sem armazenamento */
    }
  }

  /** O contexto existe e está tocando. */
  get ativo(): boolean {
    return !!this.ctx && (!this.real || this.real.state === 'running');
  }

  get estado(): string {
    return this.real?.state ?? (this.ctx ? 'offline' : 'parado');
  }

  /** Cria o contexto (chame dentro de um gesto do usuário). Idempotente. */
  iniciar(): Promise<void> {
    if (this.iniciando) return this.iniciando.then(() => this.real?.resume());
    this.iniciando = (async () => {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor({ latencyHint: 'interactive' });
        this.real = ctx;
        this.montar(ctx);
        await ctx.resume();
        this.relogio = setInterval(() => this.tique(), 100);
        this.tique();
      } catch (e) {
        this.erro = String(e);
        console.warn('Áudio indisponível:', e);
      }
    })();
    return this.iniciando;
  }

  /** Inicia no primeiro clique/tecla/toque (política de autoplay dos navegadores). */
  iniciarNoPrimeiroGesto() {
    const ir = () => {
      window.removeEventListener('pointerdown', ir, true);
      window.removeEventListener('keydown', ir, true);
      window.removeEventListener('touchstart', ir, true);
      void this.iniciar();
    };
    window.addEventListener('pointerdown', ir, true);
    window.addEventListener('keydown', ir, true);
    window.addEventListener('touchstart', ir, true);
  }

  /** Monta o grafo num contexto qualquer (também usado com OfflineAudioContext nos testes). */
  montar(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const taxa = ctx.sampleRate;
    const buf = (dados: Float32Array) => {
      const b = ctx.createBuffer(1, dados.length, taxa);
      b.copyToChannel(dados as Float32Array<ArrayBuffer>, 0);
      return b;
    };
    const n = Math.floor(taxa * 4);
    const ruido = {
      branco: buf(emLaco(ruidoBranco(n + 2048, 11))),
      rosa: buf(emLaco(ruidoRosa(n + 2048, 12))),
      marrom: buf(emLaco(ruidoMarrom(n + 2048, 13))),
    };
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -10;
    limitador.knee.value = 8;
    limitador.ratio.value = 6;
    limitador.attack.value = 0.005;
    limitador.release.value = 0.25;
    limitador.connect(ctx.destination);
    this.mestre = ctx.createGain();
    this.mestre.connect(limitador);
    this.busMusica = ctx.createGain();
    this.busEfeitos = ctx.createGain();
    this.busMusica.connect(this.mestre);
    this.busEfeitos.connect(this.mestre);
    const busAmbiente = ctx.createGain();
    busAmbiente.gain.value = 0.8;
    busAmbiente.connect(this.busEfeitos);
    const eco = (destino: AudioNode, seg: number) => {
      const cv = ctx.createConvolver();
      const [l, d] = respostaImpulso(taxa, seg, 2.6);
      const b = ctx.createBuffer(2, l.length, taxa);
      b.copyToChannel(l as Float32Array<ArrayBuffer>, 0);
      b.copyToChannel(d as Float32Array<ArrayBuffer>, 1);
      cv.buffer = b;
      const entrada = ctx.createGain();
      entrada.gain.value = 0.5;
      entrada.connect(cv);
      cv.connect(destino);
      return entrada;
    };
    const ecoMusica = eco(this.busMusica, 2.8);
    const ecoEfeitos = eco(this.busEfeitos, 1.8);
    const rnd = aleatorio(Math.floor(Math.random() * 1e9));
    const corda = criarCacheCordas(ctx);
    this.cEfeitos = { ctx, saida: this.busEfeitos, eco: ecoEfeitos, ruido, rnd, corda };
    this.cAmbiente = { ctx, saida: busAmbiente, eco: ecoEfeitos, ruido, rnd, corda };
    const cMusica: CtxSom = { ctx, saida: this.busMusica, eco: ecoMusica, ruido, rnd, corda };
    this.trilha = new Musica(cMusica, this.busMusica);
    for (const nome of ['vento', 'passaros', 'agua', 'chuva', 'chuvaAbafada', 'trovoes', 'cidade', 'fogueira', 'grilos', 'rangido'] as NomeCamada[]) {
      this.camadas.set(nome, new Camada(nome, this.cAmbiente, busAmbiente));
    }
    this.aplicarVolumes(0);
    // pedidos feitos antes de iniciar
    const est = this.estadoMusica;
    this.estadoMusica = 'silencio';
    this.musica(est);
    this.atualizarAmbientes(true);
  }

  // ------------------------------------------------------------------ API ------------

  /** Liga/ajusta um ambiente (0 desliga). Misturas: ver MISTURAS em Ambientes.ts. */
  ambiente(nome: string, intensidade: number, op: OpcoesAmbiente = {}) {
    if (!MISTURAS[nome]) {
      console.warn(`Ambiente desconhecido: ${nome}`);
      return;
    }
    const i = Math.max(0, Math.min(1, intensidade));
    if (i <= 0) this.pedidos.set(nome, { i: 0, alcance: 1, transicao: op.transicao ?? 2 });
    else this.pedidos.set(nome, { i, pos: op.pos ? xyz(op.pos) : undefined, alcance: op.alcance ?? 40, transicao: op.transicao ?? 2 });
    this.atualizarAmbientes(true);
  }

  /** Desliga todos os ambientes. */
  silenciarAmbientes(transicao = 2) {
    for (const k of this.pedidos.keys()) this.pedidos.set(k, { i: 0, alcance: 1, transicao });
    this.atualizarAmbientes(true);
  }

  /** Estado da música generativa ('silencio' para parar), com transição suave. */
  musica(estado: EstadoMusica) {
    this.estadoMusica = estado;
    if (this.trilha && this.ctx) this.trilha.definir(estado, this.ctx.currentTime);
  }

  get estadoDaMusica(): EstadoMusica {
    return this.estadoMusica;
  }

  /** Toca um efeito. Retorna false se o áudio não estiver ativo ou o som estiver longe/desconhecido. */
  efeito(nome: string, op: OpcoesSom = {}): boolean {
    const c = this.cEfeitos;
    if (!c || !this.ctx || this.mudo) return false;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01 + (op.atraso ?? 0);
    let ganho = op.volume ?? 1;
    let pan = 0;
    if (op.pos) {
      const [x, y, z] = xyz(op.pos);
      const dx = x - this.ouvinte[0];
      const dy = y - this.ouvinte[1];
      const dz = z - this.ouvinte[2];
      const d = Math.hypot(dx, dy, dz);
      const alcance = op.alcance ?? 35;
      const a = Math.max(0, 1 - d / alcance);
      ganho *= Math.pow(a, 1.6);
      if (ganho < 0.01) return false;
      if (this.yaw !== null && d > 0.5) {
        // direita do ouvinte = (-cos yaw, sin yaw) no plano XZ
        pan = Math.max(-0.85, Math.min(0.85, (dx * -Math.cos(this.yaw) + dz * Math.sin(this.yaw)) / Math.hypot(dx, dz)));
      }
    }
    const g = ctx.createGain();
    g.gain.value = ganho;
    let saida: AudioNode = g;
    if (pan !== 0) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(c.saida);
      g.connect(p);
    } else g.connect(c.saida);
    saida = g;
    const ecoG = ctx.createGain();
    ecoG.gain.value = ganho;
    ecoG.connect(c.eco);
    const ok = tocarEfeito(nome, { ...c, saida, eco: ecoG }, t, op);
    if (!ok) console.warn(`Efeito desconhecido: ${nome}`);
    // desconecta depois que o som acabar (evita acumular nós)
    setTimeout(() => {
      g.disconnect();
      ecoG.disconnect();
    }, 9000 + (op.atraso ?? 0) * 1000);
    return ok;
  }

  /** Ajusta volumes (0..1) e guarda a preferência. */
  volume(v: Partial<Volumes>) {
    this.vol = { ...this.vol, ...v };
    try {
      localStorage.setItem(CHAVE_VOLUME, JSON.stringify(this.vol));
    } catch {
      /* sem armazenamento */
    }
    this.aplicarVolumes(0.15);
  }

  get volumes(): Volumes {
    return { ...this.vol };
  }

  /** Silencia tudo (ex.: jogo pausado em segundo plano). */
  silenciar(sim: boolean) {
    this.mudo = sim;
    this.aplicarVolumes(0.3);
  }

  /** Posição (e direção, em yaw) de quem ouve — normalmente a câmera. */
  posicaoOuvinte(pos: P3, yaw?: number) {
    this.ouvinte = xyz(pos).slice() as [number, number, number];
    if (yaw !== undefined) this.yaw = yaw;
  }

  /** Fecha o contexto (o próximo `iniciar` cria outro). */
  async encerrar() {
    if (this.relogio) clearInterval(this.relogio);
    this.relogio = null;
    await this.real?.close();
    this.real = null;
    this.ctx = null;
    this.cEfeitos = this.cAmbiente = null;
    this.trilha = null;
    this.camadas.clear();
    this.ultimoAmb.clear();
    this.iniciando = null;
  }

  /** Agenda música e ambientes até `ate` (testes com OfflineAudioContext). */
  agendarAte(ate: number) {
    const agora = this.ctx?.currentTime ?? 0;
    this.trilha?.agendar(agora, ate);
    for (const c of this.camadas.values()) c.agendar(agora, ate);
  }

  // ------------------------------------------------------------------ interno --------

  private aplicarVolumes(tempo: number) {
    if (!this.ctx || !this.mestre || !this.busMusica || !this.busEfeitos) return;
    const t = this.ctx.currentTime;
    const alvo = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(t);
      if (tempo > 0) p.setTargetAtTime(v, t, tempo / 3);
      else p.setValueAtTime(v, t);
    };
    alvo(this.mestre.gain, this.mudo ? 0 : this.vol.geral);
    alvo(this.busMusica.gain, this.vol.musica * 0.8);
    alvo(this.busEfeitos.gain, this.vol.efeitos);
  }

  /** Intensidade de cada camada = máximo pedido pelas misturas (com atenuação posicional). */
  private atualizarAmbientes(forcar = false) {
    if (!this.ctx) return;
    const alvo = new Map<NomeCamada, { i: number; transicao: number }>();
    for (const [nome, p] of this.pedidos) {
      let i = p.i;
      if (p.pos && i > 0) {
        const d = Math.hypot(p.pos[0] - this.ouvinte[0], p.pos[1] - this.ouvinte[1], p.pos[2] - this.ouvinte[2]);
        i *= Math.pow(Math.max(0, 1 - Math.max(0, d - p.alcance * 0.15) / p.alcance), 1.5);
      }
      for (const [camada, k] of Object.entries(MISTURAS[nome]) as [NomeCamada, number][]) {
        const atual = alvo.get(camada);
        const v = i * k;
        if (!atual || v > atual.i) alvo.set(camada, { i: v, transicao: p.transicao });
      }
    }
    const t = this.ctx.currentTime;
    for (const [nome, camada] of this.camadas) {
      const a = alvo.get(nome) ?? { i: 0, transicao: 2 };
      const ant = this.ultimoAmb.get(nome) ?? 0;
      if (forcar ? Math.abs(a.i - ant) > 1e-4 : Math.abs(a.i - ant) > 0.02) {
        camada.definir(a.i, t, forcar ? a.transicao : 0.3);
        this.ultimoAmb.set(nome, a.i);
      }
    }
    // limpa pedidos desligados
    for (const [k, p] of this.pedidos) if (p.i <= 0) this.pedidos.delete(k);
  }

  private tique() {
    if (!this.ctx) return;
    const agora = this.ctx.currentTime;
    const oculto = typeof document !== 'undefined' && document.hidden;
    this.atualizarAmbientes(false);
    const ate = agora + (oculto ? 1.6 : 0.35);
    this.trilha?.agendar(agora, ate);
    for (const c of this.camadas.values()) c.agendar(agora, ate);
  }
}

/** O sistema de áudio do jogo (único). */
export const Audio = new SistemaAudio();
export default Audio;
