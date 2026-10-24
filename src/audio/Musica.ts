// Música generativa: pad harmônico + lira (Karplus-Strong) em escalas modais, com tambor de
// moldura leve. Cada estado tem tônica, modo, andamento, progressão e textura próprios; a troca
// de estado acontece no próximo compasso, com cruzamento suave.
import { acorde, grau, midiParaHz, type Modo } from './sintese';
import { sino, type CtxSom } from './Efeitos';

export type EstadoMusica = 'calmo' | 'aventura' | 'prova' | 'gloria' | 'batalha' | 'silencio';

interface ConfigEstado {
  tonica: number;
  modo: Modo;
  bpm: number;
  /** Graus dos acordes e quantos compassos (de 8 colcheias) dura cada um. */
  progressao: number[];
  compassos: number;
  pad: { vol: number; corte: number; tipo: OscillatorType; notas: number };
  lira: { vol: number; densidade: number; registro: [number, number]; brilho: number; padrao?: number[] };
  drone?: number;
  /** Tambor por colcheia: D = grave (dum), t = agudo (tek), d = grave fraco, . = pausa. */
  tambor?: { padrao: string; vol: number };
  /** Chance de um sino agudo por compasso. */
  sinos?: number;
}

export const ESTADOS_MUSICA: Record<Exclude<EstadoMusica, 'silencio'>, ConfigEstado> = {
  calmo: {
    tonica: 50, modo: 'dorico', bpm: 66, progressao: [0, 3, 0, 6], compassos: 2,
    pad: { vol: 0.1, corte: 950, tipo: 'sawtooth', notas: 3 },
    lira: { vol: 0.42, densidade: 0.3, registro: [7, 15], brilho: 0.5 },
  },
  aventura: {
    tonica: 50, modo: 'dorico', bpm: 96, progressao: [0, 6, 3, 0], compassos: 1,
    pad: { vol: 0.07, corte: 1500, tipo: 'sawtooth', notas: 3 },
    lira: { vol: 0.38, densidade: 0.85, registro: [7, 16], brilho: 0.65, padrao: [0, 2, 1, 2, 0, 2, 1, 3] },
    tambor: { padrao: 'D..tD.t.', vol: 0.32 },
  },
  prova: {
    tonica: 52, modo: 'frigioDominante', bpm: 70, progressao: [0, 1, 0, 6], compassos: 2,
    pad: { vol: 0.08, corte: 620, tipo: 'sawtooth', notas: 3 },
    lira: { vol: 0.36, densidade: 0.17, registro: [0, 9], brilho: 0.35 },
    drone: 0.09,
    tambor: { padrao: 'D...d...', vol: 0.3 },
  },
  gloria: {
    tonica: 50, modo: 'lidio', bpm: 78, progressao: [0, 1, 4, 0], compassos: 2,
    pad: { vol: 0.12, corte: 2300, tipo: 'sawtooth', notas: 4 },
    lira: { vol: 0.4, densidade: 0.92, registro: [7, 18], brilho: 0.7, padrao: [0, 1, 2, 3, 4, 3, 2, 1] },
    sinos: 0.45,
  },
  // urgente sem ser agressiva: ré eólio, progressão heroica (i–VI–VII–i), arpejo firme e tambor
  // mais cheio que o da aventura, com bordão grave por baixo
  batalha: {
    tonica: 50, modo: 'eolio', bpm: 108, progressao: [0, 5, 6, 0], compassos: 1,
    pad: { vol: 0.07, corte: 1300, tipo: 'sawtooth', notas: 3 },
    lira: { vol: 0.34, densidade: 0.9, registro: [7, 15], brilho: 0.55, padrao: [0, 1, 2, 1, 0, 1, 2, 3] },
    drone: 0.06,
    tambor: { padrao: 'D.tdD.tt', vol: 0.3 },
  },
};

interface VozPad {
  oscs: OscillatorNode[];
  ganho: GainNode;
}

export class Musica {
  estado: EstadoMusica = 'silencio';
  private c: CtxSom;
  private saida: GainNode;
  private cfg: ConfigEstado | null = null;
  private proximo = 0;
  private passo = 0;
  private pad: VozPad[] = [];
  private drone: VozPad | null = null;
  private ultimaNota = 10;
  private mudar = false;

  constructor(c: CtxSom, destino: AudioNode) {
    this.c = c;
    this.saida = c.ctx.createGain();
    this.saida.gain.value = 0;
    this.saida.connect(destino);
  }

  definir(estado: EstadoMusica, agora: number) {
    if (estado === this.estado) return;
    this.estado = estado;
    const g = this.saida.gain;
    g.cancelScheduledValues(agora);
    g.setValueAtTime(Math.max(0.0001, g.value), agora);
    if (estado === 'silencio') {
      g.setTargetAtTime(0, agora, 1.2);
      this.soltarPad(agora + 0.5, 3);
      this.soltarDrone(agora, 3);
      this.cfg = null;
      return;
    }
    const antes = this.cfg;
    this.cfg = ESTADOS_MUSICA[estado];
    // cruzamento: abaixa um pouco e volta no próximo compasso com a nova textura
    g.setTargetAtTime(antes ? 0.45 : 0.0001, agora, 0.4);
    g.setTargetAtTime(1, agora + (antes ? 1.2 : 0.1), 1.2);
    if (!antes || this.proximo < agora) this.proximo = agora + 0.1;
    this.mudar = true;
    if (!this.cfg.drone) this.soltarDrone(agora, 3);
  }

  /** Agenda as colcheias até o tempo `ate`. */
  agendar(agora: number, ate: number) {
    const cfg = this.cfg;
    if (!cfg) return;
    if (this.proximo < agora) this.proximo = agora + 0.05;
    const colcheia = 60 / cfg.bpm / 2;
    while (this.proximo < ate) {
      const t = this.proximo;
      // troca de estado: recomeça no início de um compasso
      if (this.mudar && this.passo % 8 !== 0) this.passo += 8 - (this.passo % 8);
      const porAcorde = 8 * cfg.compassos;
      const iAcorde = Math.floor(this.passo / porAcorde) % cfg.progressao.length;
      const notasAcorde = acorde(cfg.tonica, cfg.modo, cfg.progressao[iAcorde], 4);
      if (this.passo % porAcorde === 0 || this.mudar) {
        this.mudar = false;
        this.novoAcorde(t, cfg, cfg.progressao[iAcorde]);
        if (cfg.drone && !this.drone) this.drone = this.voz([cfg.tonica - 12, cfg.tonica - 5], t, 'sawtooth', 420, cfg.drone, 3);
        if (cfg.sinos && this.c.rnd() < cfg.sinos) {
          sino(this.c, midiParaHz(notasAcorde[Math.floor(this.c.rnd() * 3)] + 24), t, 3, 0.35, this.saida, 0.9);
        }
      }
      this.lira(t, cfg, notasAcorde);
      if (cfg.tambor) this.tambor(t, cfg.tambor.padrao[this.passo % cfg.tambor.padrao.length], cfg.tambor.vol);
      this.passo++;
      this.proximo += colcheia * (this.passo % 2 === 1 ? 1.04 : 0.96); // leve balanço
    }
  }

  private novoAcorde(t: number, cfg: ConfigEstado, g: number) {
    this.soltarPad(t, 2.5);
    const notas = acorde(cfg.tonica, cfg.modo, g, cfg.pad.notas).map((m) => {
      // mantém o pad numa região média (fá2 a dó4)
      while (m > 62) m -= 12;
      while (m < 45) m += 12;
      return m;
    });
    // baixo na fundamental
    notas.push(grau(cfg.tonica, cfg.modo, g) - 12);
    this.pad = [this.voz(notas, t, cfg.pad.tipo, cfg.pad.corte, cfg.pad.vol, 2.2)];
  }

  private voz(notas: number[], t: number, tipo: OscillatorType, corte: number, vol: number, ataque: number): VozPad {
    const ctx = this.c.ctx;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.linearRampToValueAtTime(vol, t + ataque);
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = corte;
    filtro.Q.value = 0.4;
    filtro.connect(ganho);
    ganho.connect(this.saida);
    const eco = ctx.createGain();
    eco.gain.value = 0.7;
    ganho.connect(eco);
    eco.connect(this.c.eco);
    const oscs: OscillatorNode[] = [];
    for (const m of notas) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = tipo;
        o.frequency.value = midiParaHz(m);
        o.detune.value = det + (this.c.rnd() - 0.5) * 4;
        const gn = ctx.createGain();
        gn.gain.value = 1 / notas.length;
        o.connect(gn);
        gn.connect(filtro);
        o.start(t);
        oscs.push(o);
      }
    }
    return { oscs, ganho };
  }

  private soltar(v: VozPad, t: number, rel: number) {
    v.ganho.gain.cancelScheduledValues(t);
    v.ganho.gain.setTargetAtTime(0, t, rel / 3);
    for (const o of v.oscs) o.stop(t + rel + 0.5);
  }

  private soltarPad(t: number, rel: number) {
    for (const v of this.pad) this.soltar(v, t, rel);
    this.pad = [];
  }

  private soltarDrone(t: number, rel: number) {
    if (this.drone) this.soltar(this.drone, t, rel);
    this.drone = null;
  }

  private lira(t: number, cfg: ConfigEstado, notasAcorde: number[]) {
    const r = this.c.rnd;
    const L = cfg.lira;
    let midi: number;
    if (L.padrao) {
      const idx = L.padrao[this.passo % L.padrao.length];
      if (idx < 0 || r() > L.densidade) return;
      midi = notasAcorde[idx % notasAcorde.length] + 12 * (1 + Math.floor(idx / notasAcorde.length));
      while (midi < grau(cfg.tonica, cfg.modo, L.registro[0])) midi += 12;
      while (midi > grau(cfg.tonica, cfg.modo, L.registro[1])) midi -= 12;
    } else {
      const forte = this.passo % 4 === 0;
      if (r() > L.densidade * (forte ? 1.5 : 0.7)) return;
      // passeio pela escala, puxado para as notas do acorde
      let g = this.ultimaNota + Math.round((r() - 0.5) * 4);
      g = Math.max(L.registro[0], Math.min(L.registro[1], g));
      midi = grau(cfg.tonica, cfg.modo, g);
      if (forte) {
        const pc = (m: number) => ((m % 12) + 12) % 12;
        const perto = notasAcorde.map((n) => n + 12 * Math.round((midi - n) / 12)).sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi))[0];
        if (!notasAcorde.some((n) => pc(n) === pc(midi))) midi = perto;
      }
      this.ultimaNota = g;
    }
    this.tocarCorda(midi, t, L.vol * (0.7 + r() * 0.3), L.brilho);
    // às vezes uma segunda nota (dedilhado)
    if (!L.padrao && r() < 0.15) this.tocarCorda(midi + (r() < 0.5 ? 7 : 12), t + 0.06, L.vol * 0.5, L.brilho);
  }

  private tocarCorda(midi: number, t: number, vol: number, brilho: number) {
    const ctx = this.c.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.c.corda(midi, Math.round(brilho * 10) / 10);
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = (this.c.rnd() - 0.5) * 0.6;
    s.connect(g);
    g.connect(p);
    p.connect(this.saida);
    const e = ctx.createGain();
    e.gain.value = 0.55;
    p.connect(e);
    e.connect(this.c.eco);
    s.start(t);
  }

  private tambor(t: number, golpe: string, vol: number) {
    if (golpe === '.' || !golpe) return;
    const ctx = this.c.ctx;
    const g = ctx.createGain();
    g.connect(this.saida);
    if (golpe === 'D' || golpe === 'd') {
      const v = golpe === 'D' ? vol : vol * 0.55;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.3);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.5);
    } else {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol * 0.35, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      const s = ctx.createBufferSource();
      s.buffer = this.c.ruido.branco;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2600;
      f.Q.value = 1.5;
      s.connect(f);
      f.connect(g);
      s.start(t, this.c.rnd());
      s.stop(t + 0.09);
    }
  }
}
