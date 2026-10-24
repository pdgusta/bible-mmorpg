import * as THREE from 'three';
import { clamp } from '../core/util';

export type Qualidade = 'baixo' | 'medio' | 'alto';

export interface PresetQualidade {
  sombra: number;
  antialias: boolean;
  densidadeGrama: number;
  distancia: number;
  pixelMax: number;
}

export const PRESETS: Record<Qualidade, PresetQualidade> = {
  baixo: { sombra: 1024, antialias: false, densidadeGrama: 0.45, distancia: 170, pixelMax: 1 },
  medio: { sombra: 2048, antialias: true, densidadeGrama: 0.75, distancia: 230, pixelMax: 1.25 },
  alto: { sombra: 2048, antialias: true, densidadeGrama: 1, distancia: 300, pixelMax: 1.5 },
};

/**
 * Envolve o WebGLRenderer: cores, sombras, presets de qualidade e escala dinâmica de resolução
 * para manter ~60 fps em vídeo integrado.
 */
export class Renderizador {
  readonly gl: THREE.WebGLRenderer;
  qualidade: Qualidade;
  preset: PresetQualidade;
  escalaDinamica = 1;
  escalaAutomatica = true;
  private acumulado = 0;
  private quadros = 0;
  private tempoJanela = 0;
  fpsMedio = 60;
  msMedio = 16;

  constructor(canvas: HTMLCanvasElement, qualidade: Qualidade) {
    this.qualidade = qualidade;
    this.preset = PRESETS[qualidade];
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: this.preset.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap; // o r186 removeu o PCFSoftShadowMap (caía neste com aviso)
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
  }

  definirQualidade(q: Qualidade) {
    this.qualidade = q;
    this.preset = PRESETS[q];
    this.escalaDinamica = 1;
    this.redimensionar();
  }

  redimensionar() {
    const ratio = Math.min(window.devicePixelRatio || 1, this.preset.pixelMax) * this.escalaDinamica;
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(window.innerWidth, window.innerHeight, false);
  }

  /** Registra a duração do quadro e ajusta a resolução interna quando o FPS cai. */
  medir(dt: number) {
    this.acumulado += dt;
    this.quadros++;
    this.tempoJanela += dt;
    if (this.tempoJanela < 1.5) return;
    this.msMedio = (this.acumulado / this.quadros) * 1000;
    this.fpsMedio = 1000 / this.msMedio;
    this.acumulado = 0;
    this.quadros = 0;
    this.tempoJanela = 0;
    if (!this.escalaAutomatica) return;
    const anterior = this.escalaDinamica;
    if (this.msMedio > 19) this.escalaDinamica = clamp(this.escalaDinamica - 0.1, 0.6, 1);
    else if (this.msMedio < 14.5) this.escalaDinamica = clamp(this.escalaDinamica + 0.05, 0.6, 1);
    if (anterior !== this.escalaDinamica) this.redimensionar();
  }

  get aspecto() {
    return window.innerWidth / window.innerHeight;
  }
}
