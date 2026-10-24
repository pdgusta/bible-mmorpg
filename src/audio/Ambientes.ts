// Ambientes sintetizados em camadas: vento, pássaros, água, chuva, trovões, cidade, fogueira,
// grilos e o casco da arca. Os nomes pedidos pelo jogo ('vale', 'tempestade', 'interiorArca'...)
// são misturas dessas camadas.
import { estalo, ligar, sino, tocarEfeito, type CtxSom } from './Efeitos';

export type NomeCamada = 'vento' | 'passaros' | 'agua' | 'chuva' | 'chuvaAbafada' | 'trovoes' | 'cidade' | 'fogueira' | 'grilos' | 'rangido';

/** Ambientes que o jogo pode pedir, como misturas de camadas. */
export const MISTURAS: Record<string, Partial<Record<NomeCamada, number>>> = {
  vale: { vento: 0.35, passaros: 0.75 },
  canaa: { vento: 0.5, passaros: 0.4, grilos: 0.08 },
  vento: { vento: 1 },
  passaros: { passaros: 1 },
  agua: { agua: 1 },
  rio: { agua: 1 },
  chuva: { chuva: 1 },
  tempestade: { chuva: 1, vento: 0.9, trovoes: 1 },
  cidade: { cidade: 1 },
  fogueira: { fogueira: 1 },
  noite: { grilos: 1, vento: 0.15 },
  interiorArca: { rangido: 1, chuvaAbafada: 0.9, trovoes: 0.45 },
  arca: { rangido: 1, chuvaAbafada: 0.9, trovoes: 0.45 },
  monte: { vento: 0.85 },
};

interface Montada {
  parar(t: number): void;
}

/** Uma camada contínua (nós em laço) com eventos aleatórios agendados. */
export class Camada {
  readonly nome: NomeCamada;
  readonly saida: GainNode;
  intensidade = 0;
  private c: CtxSom;
  private montada: Montada | null = null;
  private desligarEm = 0;
  private proximo = 0;
  private vozes: GainNode[] = [];

  constructor(nome: NomeCamada, c: CtxSom, destino: AudioNode) {
    this.nome = nome;
    this.c = c;
    this.saida = c.ctx.createGain();
    this.saida.gain.value = 0;
    this.saida.connect(destino);
  }

  definir(i: number, t: number, transicao = 1.5) {
    this.intensidade = i;
    if (i > 0.001 && !this.montada) {
      this.montada = this.montar(t);
      this.proximo = t;
    }
    this.saida.gain.setTargetAtTime(i, t, transicao / 3);
    this.desligarEm = i <= 0.001 ? t + transicao * 2 + 0.5 : 0;
  }

  /** Agenda eventos aleatórios até `ate` e desliga a camada quando o fade termina. */
  agendar(agora: number, ate: number) {
    if (!this.montada) return;
    if (this.desligarEm && agora > this.desligarEm) {
      this.montada.parar(agora);
      this.montada = null;
      return;
    }
    if (this.intensidade <= 0.001) return;
    while (this.proximo < ate) {
      const t = Math.max(this.proximo, agora);
      this.proximo = t + this.evento(t);
    }
  }

  private g(v: number, destino: AudioNode | AudioParam = this.saida) {
    const n = this.c.ctx.createGain();
    n.gain.value = v;
    ligar(n, destino);
    return n;
  }

  private fonte(tipo: 'branco' | 'rosa' | 'marrom', t: number, destino: AudioNode, taxa = 1) {
    const s = this.c.ctx.createBufferSource();
    s.buffer = this.c.ruido[tipo];
    s.loop = true;
    s.playbackRate.value = taxa;
    s.connect(destino);
    s.start(t, this.c.rnd() * 2);
    return s;
  }

  private filtro(tipo: BiquadFilterType, f: number, q: number, destino: AudioNode) {
    const b = this.c.ctx.createBiquadFilter();
    b.type = tipo;
    b.frequency.value = f;
    b.Q.value = q;
    b.connect(destino);
    return b;
  }

  private lfo(f: number, prof: number, alvo: AudioParam, t: number) {
    const o = this.c.ctx.createOscillator();
    o.frequency.value = f;
    o.connect(this.g(prof, alvo));
    o.start(t);
    return o;
  }

  /** Cria os nós contínuos da camada. */
  private montar(t: number): Montada {
    const fontes: (AudioScheduledSourceNode)[] = [];
    const add = <T extends AudioScheduledSourceNode>(n: T) => (fontes.push(n), n);
    switch (this.nome) {
      case 'vento': {
        const ga = this.g(0.55);
        const bp = this.filtro('bandpass', 420, 0.6, ga);
        add(this.fonte('marrom', t, bp, 1.4));
        add(this.lfo(0.055, 260, bp.frequency, t));
        add(this.lfo(0.12, 0.3, ga.gain, t));
        add(this.fonte('rosa', t, this.filtro('highpass', 2600, 0.5, this.g(0.05))));
        break;
      }
      case 'agua': {
        add(this.fonte('rosa', t, this.filtro('highpass', 300, 0.5, this.filtro('lowpass', 2300, 0.5, this.g(0.32)))));
        add(this.fonte('marrom', t, this.filtro('lowpass', 500, 0.6, this.g(0.35))));
        break;
      }
      case 'chuva': {
        add(this.fonte('branco', t, this.filtro('highpass', 900, 0.5, this.filtro('lowpass', 8000, 0.5, this.g(0.22)))));
        add(this.fonte('rosa', t, this.filtro('lowpass', 650, 0.5, this.g(0.3))));
        break;
      }
      case 'chuvaAbafada': {
        add(this.fonte('rosa', t, this.filtro('lowpass', 650, 0.5, this.g(0.45))));
        const ga = this.g(0.35);
        add(this.fonte('marrom', t, this.filtro('lowpass', 260, 0.7, ga)));
        add(this.lfo(0.13, 0.25, ga.gain, t));
        break;
      }
      case 'cidade': {
        add(this.fonte('rosa', t, this.filtro('lowpass', 420, 0.5, this.g(0.12))));
        this.vozes = [];
        for (const f of [520, 1150, 2300]) {
          const gv = this.g(0.05);
          add(this.fonte('branco', t, this.filtro('bandpass', f, 4, gv)));
          this.vozes.push(gv);
        }
        break;
      }
      case 'fogueira': {
        add(this.fonte('marrom', t, this.filtro('lowpass', 240, 0.6, this.g(0.35))));
        add(this.fonte('rosa', t, this.filtro('bandpass', 1300, 0.8, this.g(0.04))));
        break;
      }
      case 'rangido': {
        const ga = this.g(0.25);
        add(this.fonte('marrom', t, this.filtro('lowpass', 320, 0.7, ga)));
        add(this.lfo(0.09, 0.2, ga.gain, t));
        break;
      }
      default:
        break; // camadas só de eventos: pássaros, trovões, grilos
    }
    return {
      parar: (tp: number) => {
        for (const f of fontes) {
          try {
            f.stop(tp + 0.05);
          } catch {
            /* já parado */
          }
        }
      },
    };
  }

  /** Um evento aleatório da camada; devolve o intervalo até o próximo. */
  private evento(t: number): number {
    const c = this.c;
    const r = c.rnd;
    const i = this.intensidade;
    const pan = (destino: AudioNode) => {
      const p = c.ctx.createStereoPanner();
      p.pan.value = r() * 1.6 - 0.8;
      p.connect(destino);
      return p;
    };
    switch (this.nome) {
      case 'passaros': {
        // frase de 2 a 6 trinados
        const n = 2 + Math.floor(r() * 5);
        const base = 2400 + r() * 2200;
        const destino = pan(this.saida);
        for (let k = 0; k < n; k++) {
          const tk = t + k * (0.07 + r() * 0.09);
          const ga = this.g(0, destino);
          ga.gain.setValueAtTime(0.0001, tk);
          ga.gain.linearRampToValueAtTime(0.05 + r() * 0.05, tk + 0.01);
          ga.gain.exponentialRampToValueAtTime(0.0001, tk + 0.07 + r() * 0.05);
          const o = c.ctx.createOscillator();
          o.type = 'sine';
          const f0 = base * (0.85 + r() * 0.3);
          o.frequency.setValueAtTime(f0, tk);
          o.frequency.exponentialRampToValueAtTime(f0 * (r() < 0.5 ? 1.35 : 0.75), tk + 0.06);
          o.connect(ga);
          o.start(tk);
          o.stop(tk + 0.15);
        }
        return (0.5 + r() * 3) / (0.4 + i);
      }
      case 'agua': {
        const ga = this.g(0);
        ga.gain.setValueAtTime(0.0001, t);
        ga.gain.linearRampToValueAtTime(0.04, t + 0.004);
        ga.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        const o = c.ctx.createOscillator();
        o.frequency.setValueAtTime(300 + r() * 500, t);
        o.frequency.exponentialRampToValueAtTime(900 + r() * 600, t + 0.04);
        o.connect(ga);
        o.start(t);
        o.stop(t + 0.07);
        return 0.08 + r() * 0.4;
      }
      case 'chuva': {
        estalo(c, t, 0.02 + r() * 0.04, pan(this.saida));
        return (0.01 + r() * 0.06) / (0.3 + i);
      }
      case 'trovoes': {
        tocarEfeito('trovao', { ...c, saida: this.saida }, t, { distancia: 0.25 + r() * 0.75 });
        return (7 + r() * 12) / (0.4 + i * 0.6);
      }
      case 'cidade': {
        // sílabas do burburinho: cada formante abre e fecha
        for (const v of this.vozes) v.gain.setTargetAtTime(0.01 + r() * 0.07, t, 0.04);
        if (r() < 0.03) sino({ ...c, saida: this.saida }, 1800 + r() * 1400, t, 0.6, 0.25, pan(this.saida), 0.2);
        if (r() < 0.02) tocarEfeito('martelo', { ...c, saida: this.g(0.25, pan(this.saida)) }, t, {});
        if (r() < 0.006) tocarEfeito(r() < 0.5 ? 'balido' : 'zurro', { ...c, saida: this.g(0.2, pan(this.saida)) }, t, {});
        return 0.1 + r() * 0.15;
      }
      case 'fogueira': {
        estalo(c, t, 0.05 + r() * 0.25, pan(this.saida));
        return (0.03 + r() * 0.3) / (0.4 + i);
      }
      case 'grilos': {
        const f = 4200 + r() * 600;
        const destino = pan(this.saida);
        for (let k = 0; k < 3; k++) {
          const tk = t + k * 0.035;
          const ga = this.g(0, destino);
          ga.gain.setValueAtTime(0.0001, tk);
          ga.gain.linearRampToValueAtTime(0.03, tk + 0.004);
          ga.gain.exponentialRampToValueAtTime(0.0001, tk + 0.022);
          const o = c.ctx.createOscillator();
          o.frequency.value = f;
          o.connect(ga);
          o.start(tk);
          o.stop(tk + 0.03);
        }
        return (0.25 + r() * 0.9) / (0.5 + i);
      }
      case 'rangido': {
        tocarEfeito('rangido', { ...c, saida: this.saida }, t, { volume: 0.8 + r() * 0.6 });
        return 1.8 + r() * 4;
      }
      default:
        return 5;
    }
  }
}
