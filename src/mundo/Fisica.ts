import * as THREE from 'three';
import { Colisoes, type Colisor } from './Colisao';
import type { Relevo } from './Relevo';
import { clamp } from '../core/util';

/** Consulta física do mundo: relevo + colisores + água. */
export class MundoFisico {
  relevo: Relevo;
  colisoes: Colisoes;
  /** Nível da água para rios/lagos (bloqueia a passagem quando fundo). */
  nivelAgua = -1e9;
  profundidadeMax = 1.0;
  margemMapa = 6;
  private tmp: Colisor[] = [];

  constructor(relevo: Relevo, colisoes: Colisoes) {
    this.relevo = relevo;
    this.colisoes = colisoes;
  }

  /**
   * Altura do chão em (x,z) considerando superfícies de colisores cujo topo está abaixo de
   * yMax (os pés + degrau). Retorna também o colisor usado como piso, se houver.
   */
  chao(x: number, z: number, yMax: number, raio = 0.25): { y: number; colisor: Colisor | null } {
    let y = this.relevo.altura(x, z);
    let colisor: Colisor | null = null;
    for (const c of this.colisoes.perto(x, z, 1, this.tmp)) {
      if (!c.piso) continue;
      if (!Colisoes.contem(c, x, z, raio * 0.6)) continue;
      const t = Colisoes.topo(c, x, z);
      if (t <= yMax && t > y) {
        y = t;
        colisor = c;
      }
    }
    return { y, colisor };
  }

  profundidade(x: number, z: number): number {
    return this.nivelAgua - this.relevo.altura(x, z);
  }

  /** Ponto livre para ficar de pé (usado para teleportes e posicionamento de NPCs). */
  livre(x: number, z: number, yPes: number, raio = 0.35, altura = 1.7): boolean {
    for (const c of this.colisoes.perto(x, z, raio + 1, this.tmp)) {
      if (!c.solido) continue;
      const topo = Colisoes.topo(c, x, z);
      if (topo <= yPes + 0.45 || c.y0 >= yPes + altura) continue;
      if (Colisoes.empurrar(c, x, z, raio)) return false;
    }
    return true;
  }

  /** Raio para a câmera: relevo + colisores sólidos. */
  raio(origem: THREE.Vector3, dir: THREE.Vector3, max: number, ignorarTag?: string): number {
    const a = this.relevo.raio(origem, dir, max, 0.4);
    const b = this.colisoes.raio(origem, dir, max, ignorarTag);
    if (a < 0) return b;
    if (b < 0) return a;
    return Math.min(a, b);
  }
}

/** Corpo cinemático em forma de cápsula (aproximada por cilindro) para personagens e animais. */
export class CorpoFisico {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  raio: number;
  altura: number;
  passo = 0.45;
  gravidade = 22;
  noChao = false;
  chaoColisor: Colisor | null = null;
  /** Ignora colisões (cinemáticas, teleportes de script). */
  fantasma = false;
  /** Desativa a gravidade (escalando, sentado em posto). */
  semGravidade = false;
  tempoNoAr = 0;
  private tmp: Colisor[] = [];
  colidiuParede = false;

  constructor(raio = 0.35, altura = 1.7) {
    this.raio = raio;
    this.altura = altura;
  }

  /**
   * Integra o movimento: velocidade horizontal desejada (já em m/s), pulo e gravidade.
   * Resolve paredes, degraus, rampas, água funda e limites do mapa.
   */
  mover(m: MundoFisico, dt: number, vx: number, vz: number, aceleracao = 14) {
    const k = 1 - Math.exp(-aceleracao * dt);
    this.vel.x += (vx - this.vel.x) * k;
    this.vel.z += (vz - this.vel.z) * k;
    if (!this.semGravidade) this.vel.y -= this.gravidade * dt;
    else this.vel.y = 0;

    const antX = this.pos.x;
    const antZ = this.pos.z;
    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z + this.vel.z * dt;
    let ny = this.pos.y + this.vel.y * dt;
    this.colidiuParede = false;

    if (!this.fantasma) {
      // paredes: duas passadas de empurrão
      for (let it = 0; it < 2; it++) {
        for (const c of m.colisoes.perto(nx, nz, this.raio + 1.5, this.tmp)) {
          if (!c.solido) continue;
          const topo = Colisoes.topo(c, nx, nz);
          // degraus e pisos baixos não são paredes
          if (topo <= ny + this.passo || c.y0 >= ny + this.altura) continue;
          const e = Colisoes.empurrar(c, nx, nz, this.raio);
          if (e) {
            nx += e[0];
            nz += e[1];
            this.colidiuParede = true;
          }
        }
      }
      // limites do mapa
      const lim = m.relevo.meio - m.margemMapa;
      nx = clamp(nx, -lim, lim);
      nz = clamp(nz, -lim, lim);
      // água funda: não entra
      if (m.profundidade(nx, nz) > m.profundidadeMax && m.profundidade(nx, nz) > m.profundidade(antX, antZ)) {
        nx = antX;
        nz = antZ;
        this.vel.x = 0;
        this.vel.z = 0;
      }
      // encosta íngreme demais (só no terreno)
      const hAnt = m.relevo.altura(antX, antZ);
      const hNovo = m.relevo.altura(nx, nz);
      if (hNovo - hAnt > 0.35 && m.relevo.inclinacao(nx, nz) > 0.42 && this.pos.y < hNovo - 0.2) {
        nx = antX;
        nz = antZ;
      }
    }

    // chão
    const { y: chao, colisor } = this.fantasma && this.semGravidade
      ? { y: -1e9, colisor: null }
      : m.chao(nx, nz, Math.max(this.pos.y, ny) + this.passo, this.raio);
    const grudar = this.noChao && this.vel.y <= 0 && this.pos.y - chao < 0.6;
    if (ny <= chao || grudar) {
      ny = chao;
      if (this.vel.y < 0) this.vel.y = 0;
      this.noChao = true;
      this.chaoColisor = colisor;
      this.tempoNoAr = 0;
    } else {
      this.noChao = false;
      this.chaoColisor = null;
      this.tempoNoAr += dt;
    }
    // teto (pisos acima da cabeça, ex.: conveses da arca)
    if (!this.fantasma && this.vel.y > 0) {
      for (const c of m.colisoes.perto(nx, nz, 1, this.tmp)) {
        if (!c.piso || !Colisoes.contem(c, nx, nz)) continue;
        if (c.y0 > this.pos.y + 0.5 && c.y0 < ny + this.altura) {
          ny = c.y0 - this.altura;
          this.vel.y = 0;
        }
      }
    }
    this.pos.set(nx, ny, nz);
  }

  pular(forca = 7.2) {
    if (!this.noChao) return false;
    this.vel.y = forca;
    this.noChao = false;
    return true;
  }

  teleportar(x: number, y: number, z: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
  }
}
