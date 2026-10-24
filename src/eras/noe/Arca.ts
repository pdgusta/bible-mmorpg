import * as THREE from 'three';
import { Construtor, CORES } from '../../entidades/Construtor';
import type { Mundo } from '../../mundo/Mundo';
import type { Colisor, OpcoesColisor } from '../../mundo/Colisao';
import { aplicarPatch } from '../../render/Shaders';

/**
 * A arca (Gn 6:14-16): 300 × 50 × 30 côvados ≈ 135 × 22,5 × 13,5 m, três andares,
 * uma porta na lateral e uma abertura de um côvado sob o teto.
 * Eixo longo em x local; frente da porta em +z. Origem no centro da quilha.
 */
export const ARCA = {
  comprimento: 135,
  largura: 22.5,
  altura: 13.5,
  conveses: [0.6, 4.9, 9.2],
  portaX: 20,
  portaLargura: 4.2,
  portaAltura: 4.0,
};

export type EstagioArca = 0 | 1 | 2 | 3 | 4 | 5 | 6;
// 0 quilha · 1 cavernas · 2 viga mestra · 3 casco até a metade · 4 pronta e betumada
// 5 porta aberta com rampa (animais entrando) · 6 porta fechada pelo Senhor (Gn 7:16)

const BETUME = '#3b2d24';
const BETUME2 = '#46362a';

function meiaLargura(x: number) {
  const L = ARCA.comprimento / 2;
  const t = Math.max(0, (Math.abs(x) - (L - 12)) / 12);
  return (ARCA.largura / 2) * (1 - t * t * 0.55);
}

export class Arca {
  readonly grupo = new THREE.Group();
  private exterior: THREE.Mesh | null = null;
  private interior: THREE.Mesh | null = null;
  private porta: THREE.Group;
  private mundo: Mundo;
  private colisoresExt: Colisor[] = [];
  private colisoresInt: Colisor[] = [];
  private colisorPorta: Colisor | null = null;
  estagio: EstagioArca = 0;
  portaAberta = false;
  interiorVisivel = false;
  readonly origem = new THREE.Vector3();
  yaw = 0;

  constructor(mundo: Mundo, x: number, y: number, z: number) {
    this.mundo = mundo;
    this.origem.set(x, y, z);
    this.grupo.name = 'arca';
    this.grupo.position.copy(this.origem);
    this.porta = this.criarPorta();
    this.grupo.add(this.porta);
    mundo.estruturas.add(this.grupo);
  }

  /** Converte coordenadas locais da arca para o mundo. */
  mundoDe(lx: number, ly: number, lz: number): THREE.Vector3 {
    return new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).add(this.grupo.position);
  }

  definirEstagio(e: EstagioArca) {
    this.estagio = e;
    if (this.exterior) {
      this.grupo.remove(this.exterior);
      this.exterior.geometry.dispose();
    }
    for (const c of this.colisoresExt) this.mundo.colisoes.remover(c);
    this.colisoresExt = [];
    const { malha, colisores } = this.construirExterior(e);
    this.exterior = malha;
    if (malha) {
      patchear(malha);
      this.grupo.add(malha);
    }
    this.colisoresExt = colisores.map((c) => this.mundo.colisoes.adicionar(this.paraMundo(c)));
    this.porta.visible = e >= 4;
    this.definirPorta(e === 5);
    if (e >= 4 && !this.interior) this.construirInterior();
    this.atualizarInteriorVisivel(this.interiorVisivel);
  }

  /** Abre/fecha a porta (e a passagem). */
  definirPorta(aberta: boolean) {
    this.portaAberta = aberta;
    this.porta.rotation.x = aberta ? Math.PI / 2 - 0.05 : 0;
    if (this.colisorPorta) {
      this.mundo.colisoes.remover(this.colisorPorta);
      this.colisorPorta = null;
    }
    if (!aberta && this.estagio >= 4) {
      this.colisorPorta = this.mundo.colisoes.adicionar(this.paraMundo({ x: ARCA.portaX, z: ARCA.largura / 2, hx: ARCA.portaLargura / 2 + 0.2, hz: 0.5, y0: -1, y1: ARCA.portaAltura + 1, tag: 'arca' }));
    }
  }

  atualizarInteriorVisivel(v: boolean) {
    this.interiorVisivel = v;
    if (this.interior) this.interior.visible = v || this.portaAberta;
  }

  /** Move a arca inteira (flutuar, repousar no monte), levando os colisores juntos. */
  mover(x: number, y: number, z: number, yaw = this.yaw) {
    const dx = x - this.grupo.position.x;
    const dy = y - this.grupo.position.y;
    const dz = z - this.grupo.position.z;
    const dyaw = yaw - this.yaw;
    this.grupo.position.set(x, y, z);
    this.yaw = yaw;
    this.grupo.rotation.y = yaw;
    const todos = [...this.colisoresExt, ...this.colisoresInt, ...(this.colisorPorta ? [this.colisorPorta] : [])];
    const centro = new THREE.Vector3(x - dx, 0, z - dz);
    for (const c of todos) {
      const p = new THREE.Vector3(c.x - centro.x, 0, c.z - centro.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), dyaw);
      this.mundo.colisoes.mover(c, centro.x + p.x + dx, centro.z + p.z + dz, c.yaw + dyaw, c.y0 + dy, c.y1 + dy);
      if (c.topoDe !== undefined) c.topoDe += dy;
      if (c.topoAte !== undefined) c.topoAte += dy;
    }
  }

  private paraMundo(c: OpcoesColisor): OpcoesColisor {
    const p = this.mundoDe(c.x, 0, c.z);
    const y = this.grupo.position.y;
    return { ...c, x: p.x, z: p.z, yaw: (c.yaw ?? 0) + this.yaw, y0: c.y0 + y, y1: c.y1 + y, topoDe: c.topoDe !== undefined ? c.topoDe + y : undefined, topoAte: c.topoAte !== undefined ? c.topoAte + y : undefined, tag: c.tag ?? 'arca' };
  }

  private criarPorta(): THREE.Group {
    const g = new THREE.Group();
    const c = new Construtor(9);
    c.caixa(0, 0, 0, ARCA.portaLargura, ARCA.portaAltura, 0.3, BETUME2, { raio: 0.05, ao: 0 });
    for (let i = 0; i < 5; i++) c.caixa(-ARCA.portaLargura / 2 + 0.42 + i * 0.84, 0.05, 0.16, 0.12, ARCA.portaAltura - 0.1, 0.06, BETUME, { raio: 0.02, ao: 0 });
    const { malha } = c.construir('porta');
    if (malha) {
      malha.position.set(0, 0, 0);
      g.add(malha);
      patchear(malha);
    }
    // a porta gira na base (vira rampa quando aberta)
    g.position.set(ARCA.portaX, ARCA.conveses[0] - 0.4, ARCA.largura / 2 + 0.2);
    return g;
  }

  private construirExterior(e: EstagioArca) {
    const c = new Construtor(1906);
    const L = ARCA.comprimento / 2;
    const H = ARCA.altura;
    // blocos de apoio e quilha
    for (let x = -L + 6; x <= L - 6; x += 9) c.caixa(x, -0.3, 0, 1.2, 0.6, 6, CORES.pedraEscura, { raio: 0.1 });
    c.caixa(0, 0, 0, ARCA.comprimento - 6, 0.7, 1.2, e >= 4 ? BETUME : CORES.madeiraEscura, { raio: 0.1 });
    const colisores: OpcoesColisor[] = [];
    colisores.push({ x: 0, z: 0, hx: L - 3, hz: 0.7, y0: -1, y1: 0.7, piso: true });

    if (e >= 1 && e <= 3) {
      // cavernas (costelas) em U
      for (let x = -L + 4; x <= L - 4; x += 4.5) {
        const w = meiaLargura(x);
        const cor = (Math.round(x) % 2 === 0) ? CORES.madeira : CORES.madeiraClara;
        c.caixa(x, 0.4, 0, 0.5, 0.5, w * 2, cor, { raio: 0.06 });
        for (const s of [-1, 1]) {
          c.caixa(x, 0.4, s * (w - 0.25), 0.5, H - 0.5, 0.5, cor, { raio: 0.06 });
        }
      }
      // longarinas baixas
      for (const s of [-1, 1]) c.caixa(0, 3.6, s * (ARCA.largura / 2 - 0.3), ARCA.comprimento - 10, 0.45, 0.45, CORES.madeiraEscura, { raio: 0.05 });
    }
    if (e >= 2 && e <= 3) {
      // a viga mestra no alto e as vigas dos conveses
      for (const s of [-1, 1]) c.caixa(0, H - 0.6, s * (ARCA.largura / 2 - 0.3), ARCA.comprimento - 10, 0.55, 0.55, CORES.madeiraEscura, { raio: 0.05 });
      c.caixa(0, ARCA.conveses[1] - 0.3, 0, ARCA.comprimento - 10, 0.3, 0.4, CORES.madeira, { raio: 0.04 });
    }
    if (e === 3) {
      // casco até a metade, tábua por tábua
      for (let y = 0.6; y < H * 0.5; y += 0.55) {
        for (const s of [-1, 1]) {
          c.caixa(0, y, s * (ARCA.largura / 2 - 0.05), ARCA.comprimento - 8, 0.52, 0.18, y < 2.3 ? BETUME2 : (Math.round(y * 10) % 2 ? CORES.madeira : CORES.madeiraClara), { raio: 0.03, variacao: 0.08 });
        }
      }
    }
    if (e >= 4) {
      // casco completo, betumado por dentro e por fora (Gn 6:14)
      const fileiras = Math.floor((H - 0.9) / 0.55);
      for (let k = 0; k < fileiras; k++) {
        const y = 0.5 + k * 0.55;
        const cor = k % 2 ? BETUME : BETUME2;
        for (const s of [-1, 1]) {
          // lado da porta: deixa o vão
          if (s === 1 && y < ARCA.conveses[0] + ARCA.portaAltura - 0.2 && y + 0.55 > ARCA.conveses[0] - 0.2) {
            const a = ARCA.portaX - ARCA.portaLargura / 2;
            const b = ARCA.portaX + ARCA.portaLargura / 2;
            c.caixa((-L + 6 + a) / 2, y, s * (ARCA.largura / 2), a - (-L + 6), 0.53, 0.3, cor, { raio: 0.02, variacao: 0.05 });
            c.caixa((b + L - 6) / 2, y, s * (ARCA.largura / 2), L - 6 - b, 0.53, 0.3, cor, { raio: 0.02, variacao: 0.05 });
          } else {
            c.caixa(0, y, s * (ARCA.largura / 2), ARCA.comprimento - 12, 0.53, 0.3, cor, { raio: 0.02, variacao: 0.05 });
          }
        }
      }
      // proa e popa afiladas
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          const x = s * (L - 6 + k);
          const w = meiaLargura(x);
          c.caixa(x, 0.5, 0, 1.05, H - 0.9, w * 2, k % 2 ? BETUME : BETUME2, { raio: 0.3 - k * 0.03 });
        }
      }
      // faixa da abertura de um côvado sob o teto (Gn 6:16)
      c.caixa(0, H - 0.45, 0, ARCA.comprimento - 10, 0.45, ARCA.largura - 0.6, '#16110d', { raio: 0.02, ao: 0 });
      for (let x = -L + 8; x <= L - 8; x += 3) for (const s of [-1, 1]) c.caixa(x, H - 0.45, s * (ARCA.largura / 2 - 0.1), 0.2, 0.45, 0.2, BETUME, { raio: 0.02, ao: 0 });
      // teto em duas águas
      for (const s of [-1, 1]) {
        c.caixa(0, H, s * ARCA.largura / 4, ARCA.comprimento - 6, 0.35, ARCA.largura / 2 + 1.2, '#4a3828', { raio: 0.08, rx: s * -0.12, ao: 0 });
      }
      c.caixa(0, H + 1.2, 0, ARCA.comprimento - 6, 0.3, 0.8, '#3a2c20', { raio: 0.1 });
      // batentes da porta
      for (const s of [-1, 1]) c.caixa(ARCA.portaX + s * (ARCA.portaLargura / 2 + 0.2), ARCA.conveses[0] - 0.4, ARCA.largura / 2 + 0.2, 0.4, ARCA.portaAltura + 0.6, 0.4, '#2a2018', { raio: 0.04 });
      // colisores do casco (com o vão da porta)
      const a = ARCA.portaX - ARCA.portaLargura / 2;
      const b = ARCA.portaX + ARCA.portaLargura / 2;
      colisores.push(
        { x: 0, z: -ARCA.largura / 2, hx: L, hz: 0.4, y0: -1, y1: H + 1.5, piso: false },
        { x: (-L + a) / 2, z: ARCA.largura / 2, hx: (a + L) / 2, hz: 0.4, y0: -1, y1: H + 1.5, piso: false },
        { x: (b + L) / 2, z: ARCA.largura / 2, hx: (L - b) / 2, hz: 0.4, y0: -1, y1: H + 1.5, piso: false },
        { x: ARCA.portaX, z: ARCA.largura / 2, hx: ARCA.portaLargura / 2 + 0.6, hz: 0.4, y0: ARCA.conveses[0] + ARCA.portaAltura, y1: H + 1.5, piso: false },
        { x: -L + 2, z: 0, hx: 2.5, hz: ARCA.largura / 2, y0: -1, y1: H + 1.5, piso: false },
        { x: L - 2, z: 0, hx: 2.5, hz: ARCA.largura / 2, y0: -1, y1: H + 1.5, piso: false },
        { x: 0, z: 0, hx: L, hz: ARCA.largura / 2, y0: H - 0.2, y1: H + 1.6, piso: true },
      );
    } else if (e >= 1) {
      colisores.push({ x: 0, z: 0, hx: L - 3, hz: ARCA.largura / 2, y0: 0.4, y1: e >= 2 ? H : H, piso: false, solido: true });
    }
    if (e === 5) {
      // rampa até a porta
      c.caixa(ARCA.portaX, 0, ARCA.largura / 2 + 3.2, ARCA.portaLargura + 0.6, 0.3, 6, CORES.madeira, { raio: 0.05, rx: -0.09 });
    }
    const { malha } = c.construir('arca_ext');
    if (e === 5) colisores.push({ tipo: 'rampa', x: ARCA.portaX, z: ARCA.largura / 2 + 3.0, hx: ARCA.portaLargura / 2 + 0.3, hz: 3.4, y0: -1, y1: ARCA.conveses[0], topoDe: ARCA.conveses[0], topoAte: 0.05, piso: true, solido: false });
    return { malha, colisores };
  }

  /** Três conveses com compartimentos, rampas e a área da família no alto. */
  private construirInterior() {
    const c = new Construtor(77);
    const col: OpcoesColisor[] = [];
    const L = ARCA.comprimento / 2 - 4;
    const W = ARCA.largura / 2 - 0.4;
    const [d1, d2, d3] = ARCA.conveses;
    for (const [k, y] of [[0, d1], [1, d2], [2, d3]] as const) {
      c.caixa(0, y - 0.3, 0, ARCA.comprimento - 8, 0.3, ARCA.largura - 0.8, k === 0 ? '#5c4632' : '#7a5a3c', { raio: 0, ao: 0, variacao: 0.03 });
      col.push({ x: 0, z: 0, hx: L, hz: W, y0: y - 0.3, y1: y, piso: true, solido: false, tag: 'arca' });
      // tábuas do piso (linhas)
      for (let z = -W + 0.6; z < W; z += 1.2) c.caixa(0, y, z, ARCA.comprimento - 9, 0.02, 0.05, '#4a3626', { raio: 0, ao: 0 });
      // pilares centrais
      for (let x = -L + 6; x <= L - 6; x += 9) for (const s of [-1, 1]) {
        c.cilindro(x, y, s * 2.4, 0.22, 0.25, 4.2, '#6a4a30', 7);
        col.push({ tipo: 'cilindro', x, z: s * 2.4, r: 0.3, y0: y, y1: y + 4.2, piso: false, tag: 'arca' });
      }
      // compartimentos ("ninhos", Gn 6:14) dos dois lados do corredor
      for (let x = -L + 3; x <= L - 6; x += 6) {
        for (const s of [-1, 1]) {
          if (k === 0 && s === 1 && Math.abs(x - ARCA.portaX) < 6) continue; // entrada
          if (k === 2 && Math.abs(x) < 16) continue; // área da família
          c.caixa(x, y, s * 5.4, 0.18, 1.3, 5.6, '#8a6a46', { raio: 0.02 });
          c.caixa(x + 3, y + 1.1, s * 2.7, 5.6, 0.12, 0.12, '#8a6a46', { raio: 0.02 });
          col.push({ x, z: s * 5.4, hx: 0.12, hz: 2.8, y0: y, y1: y + 1.3, piso: false, tag: 'arca' });
          // feno
          c.esfera(x + 3, y + 0.15, s * 6.5, 1.2, '#d8c078', 1.6, 0.25, 1.2, 1);
        }
      }
    }
    // rampas internas entre conveses
    const rampa = (x: number, yA: number, yB: number, z: number) => {
      const comp = 9;
      const ang = Math.atan2(yB - yA, comp);
      c.caixa(x, yA + (yB - yA) / 2 - 0.2, z, 3.0, 0.25, comp + 0.6, '#7a5a3a', { raio: 0.02, rx: -ang });
      col.push({ tipo: 'rampa', x, z, hx: 1.5, hz: comp / 2, y0: yA - 0.3, y1: yB, topoDe: yA, topoAte: yB, piso: true, solido: false, tag: 'arca' });
      // recorte no piso de cima: o colisor de piso de cima ainda cobre; deixamos a rampa chegar à borda
    };
    rampa(-28, d1, d2, 0);
    rampa(26, d2, d3, 0);
    const { malha } = c.construir('arca_int');
    this.interior = malha;
    if (malha) {
      patchear(malha);
      this.grupo.add(malha);
    }
    this.colisoresInt = col.map((k) => this.mundo.colisoes.adicionar(this.paraMundo(k)));
    // aberturas nos pisos onde as rampas sobem (pisos divididos)
    this.recortarPiso(1, -28, 0);
    this.recortarPiso(2, 26, 0);
  }

  /** Divide o piso de um convés para abrir passagem à rampa que chega de baixo. */
  private recortarPiso(convés: number, xRampa: number, zRampa: number) {
    const y = ARCA.conveses[convés];
    const alvo = this.colisoresInt.find((c) => c.piso && !c.solido && c.tipo === 'caixa' && Math.abs(c.y1 - (y + this.grupo.position.y)) < 0.01);
    if (!alvo) return;
    this.mundo.colisoes.remover(alvo);
    this.colisoresInt = this.colisoresInt.filter((c) => c !== alvo);
    const L = ARCA.comprimento / 2 - 4;
    const W = ARCA.largura / 2 - 0.4;
    const x0 = xRampa - 5;
    const x1 = xRampa + 5;
    const pedacos: OpcoesColisor[] = [
      { x: (-L + x0) / 2, z: 0, hx: (x0 + L) / 2, hz: W, y0: y - 0.3, y1: y, piso: true, solido: false },
      { x: (x1 + L) / 2, z: 0, hx: (L - x1) / 2, hz: W, y0: y - 0.3, y1: y, piso: true, solido: false },
      { x: xRampa, z: (zRampa - 1.6 - W) / 2, hx: 5, hz: (W + zRampa - 1.6) / 2, y0: y - 0.3, y1: y, piso: true, solido: false },
      { x: xRampa, z: (zRampa + 1.6 + W) / 2, hx: 5, hz: (W - zRampa - 1.6) / 2, y0: y - 0.3, y1: y, piso: true, solido: false },
    ];
    for (const p of pedacos) this.colisoresInt.push(this.mundo.colisoes.adicionar(this.paraMundo(p)));
  }
}

function patchear(m: THREE.Mesh) {
  const mat = m.material as THREE.Material;
  if (!mat.userData.patch) {
    aplicarPatch(mat, { revelar: true });
    mat.userData.patch = true;
  }
}
