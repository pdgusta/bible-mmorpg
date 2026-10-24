import type { MundoFisico } from './Fisica';
import { Colisoes } from './Colisao';

/**
 * Grade de navegação 2D (1 célula = `passo` m) sobre o relevo, com A* de 8 vizinhos e
 * suavização por linha de visada. Usada pelos coadjuvantes e NPCs ao ar livre.
 */
export class Navegacao {
  readonly passo: number;
  readonly n: number;
  readonly meio: number;
  private andavel: Uint8Array;
  private custoExtra: Uint8Array;
  private m: MundoFisico;

  constructor(m: MundoFisico, passo = 1) {
    this.m = m;
    this.passo = passo;
    this.meio = m.relevo.meio;
    this.n = Math.floor(m.relevo.tamanho / passo);
    this.andavel = new Uint8Array(this.n * this.n);
    this.custoExtra = new Uint8Array(this.n * this.n);
    this.reconstruir();
  }

  reconstruir(x0 = -Infinity, z0 = -Infinity, x1 = Infinity, z1 = Infinity) {
    const { relevo, colisoes } = this.m;
    const tmp: any[] = [];
    const i0 = Math.max(0, this.celula(x0));
    const j0 = Math.max(0, this.celula(z0));
    const i1 = Math.min(this.n - 1, this.celula(x1));
    const j1 = Math.min(this.n - 1, this.celula(z1));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = this.centro(i);
        const z = this.centro(j);
        let ok = relevo.dentro(x, z, this.m.margemMapa + 1) && relevo.inclinacao(x, z) < 0.38;
        if (ok && this.m.profundidade(x, z) > this.m.profundidadeMax * 0.7) ok = false;
        let extra = 0;
        if (ok) {
          const h = relevo.altura(x, z);
          for (const c of colisoes.perto(x, z, 2, tmp)) {
            if (!c.solido) continue;
            const topo = Colisoes.topo(c, x, z);
            if (topo <= h + 0.45 || c.y0 > h + 1.6) continue;
            if (Colisoes.contem(c, x, z, 0.35)) {
              ok = false;
              break;
            }
            if (Colisoes.contem(c, x, z, 0.9)) extra = 3;
          }
          if (this.m.profundidade(x, z) > 0.1) extra = Math.max(extra, 4);
        }
        this.andavel[j * this.n + i] = ok ? 1 : 0;
        this.custoExtra[j * this.n + i] = extra;
      }
    }
  }

  celula(v: number) {
    return Math.floor((v + this.meio) / this.passo);
  }
  centro(i: number) {
    return i * this.passo - this.meio + this.passo / 2;
  }

  pode(x: number, z: number): boolean {
    const i = this.celula(x);
    const j = this.celula(z);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return false;
    return this.andavel[j * this.n + i] === 1;
  }

  /** Célula andável mais próxima (busca em espiral). */
  private maisProxima(i: number, j: number): [number, number] | null {
    for (let r = 0; r < 12; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const a = i + di;
          const b = j + dj;
          if (a >= 0 && b >= 0 && a < this.n && b < this.n && this.andavel[b * this.n + a]) return [a, b];
        }
      }
    }
    return null;
  }

  /** Caminho de (ax,az) a (bx,bz) como lista de pontos [x,z]. null se impossível. */
  caminho(ax: number, az: number, bx: number, bz: number, maxNos = 30000): [number, number][] | null {
    const n = this.n;
    const ini = this.maisProxima(this.celula(ax), this.celula(az));
    const fim = this.maisProxima(this.celula(bx), this.celula(bz));
    if (!ini || !fim) return null;
    const iniIdx = ini[1] * n + ini[0];
    const fimIdx = fim[1] * n + fim[0];
    if (iniIdx === fimIdx) return [[bx, bz]];
    if (this.visada(ax, az, bx, bz)) return [[bx, bz]];

    const g = new Map<number, number>();
    const veio = new Map<number, number>();
    const fechado = new Set<number>();
    const heap = new HeapMin();
    const h = (idx: number) => {
      const dx = Math.abs((idx % n) - fim[0]);
      const dz = Math.abs(Math.floor(idx / n) - fim[1]);
      return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz));
    };
    g.set(iniIdx, 0);
    heap.push(iniIdx, h(iniIdx));
    let nos = 0;
    let achou = false;
    while (heap.tamanho) {
      const atual = heap.pop();
      if (atual === fimIdx) { achou = true; break; }
      if (fechado.has(atual)) continue;
      fechado.add(atual);
      if (++nos > maxNos) break;
      const ci = atual % n;
      const cj = Math.floor(atual / n);
      const ga = g.get(atual)!;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
          const vi = nj * n + ni;
          if (!this.andavel[vi] || fechado.has(vi)) continue;
          if (di && dj && (!this.andavel[cj * n + ni] || !this.andavel[nj * n + ci])) continue;
          const custo = ga + (di && dj ? Math.SQRT2 : 1) + this.custoExtra[vi] * 0.5;
          if (custo < (g.get(vi) ?? Infinity)) {
            g.set(vi, custo);
            veio.set(vi, atual);
            heap.push(vi, custo + h(vi));
          }
        }
      }
    }
    if (!achou) return null;
    const celulas: number[] = [];
    for (let c: number | undefined = fimIdx; c !== undefined; c = veio.get(c)) celulas.push(c);
    celulas.reverse();
    const pts: [number, number][] = celulas.map((c) => [this.centro(c % n), this.centro(Math.floor(c / n))]);
    pts[pts.length - 1] = [bx, bz];
    return this.suavizar([ax, az], pts);
  }

  private suavizar(ini: [number, number], pts: [number, number][]): [number, number][] {
    const out: [number, number][] = [];
    let ancora = ini;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.visada(ancora[0], ancora[1], pts[j][0], pts[j][1])) j--;
      out.push(pts[j]);
      ancora = pts[j];
      i = j + 1;
    }
    return out;
  }

  /** Linha reta andável entre dois pontos. */
  visada(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const passos = Math.ceil(d / (this.passo * 0.5));
    for (let s = 1; s <= passos; s++) {
      const t = s / passos;
      if (!this.pode(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
}

class HeapMin {
  private itens: number[] = [];
  private prior: number[] = [];
  get tamanho() {
    return this.itens.length;
  }
  push(item: number, p: number) {
    this.itens.push(item);
    this.prior.push(p);
    let i = this.itens.length - 1;
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (this.prior[pai] <= this.prior[i]) break;
      this.trocar(i, pai);
      i = pai;
    }
  }
  pop(): number {
    const topo = this.itens[0];
    const ultimo = this.itens.pop()!;
    const up = this.prior.pop()!;
    if (this.itens.length) {
      this.itens[0] = ultimo;
      this.prior[0] = up;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.itens.length && this.prior[l] < this.prior[m]) m = l;
        if (r < this.itens.length && this.prior[r] < this.prior[m]) m = r;
        if (m === i) break;
        this.trocar(i, m);
        i = m;
      }
    }
    return topo;
  }
  private trocar(a: number, b: number) {
    [this.itens[a], this.itens[b]] = [this.itens[b], this.itens[a]];
    [this.prior[a], this.prior[b]] = [this.prior[b], this.prior[a]];
  }
}
