import * as THREE from 'three';
import { clamp, damp } from '../core/util';
import { Aleatorio } from '../core/aleatorio';
import type { Animal } from './Animal';

/**
 * Área para contagens: círculo, retângulo alinhado aos eixos ou função.
 * (Mesma forma das áreas do Mundo: { x, z, raio }.)
 */
export type AreaRebanho =
  | { x: number; z: number; raio: number }
  | { x0: number; z0: number; x1: number; z1: number }
  | ((x: number, z: number) => boolean);

export function dentroArea(a: AreaRebanho, x: number, z: number): boolean {
  if (typeof a === 'function') return a(x, z);
  if ('raio' in a) return (x - a.x) ** 2 + (z - a.z) ** 2 <= a.raio * a.raio;
  return x >= Math.min(a.x0, a.x1) && x <= Math.max(a.x0, a.x1) && z >= Math.min(a.z0, a.z1) && z <= Math.max(a.z0, a.z1);
}

export interface OpcoesRebanho {
  /** Raio em que o pastor assusta (m). */
  raioMedo?: number;
  /** Raio de vizinhança dos boids (m). */
  vizinhanca?: number;
  /** Distância mínima entre animais (m). */
  separacao?: number;
  /** Velocidade pastando e fugindo (m/s; padrão vem da espécie). */
  velPastar?: number;
  velFuga?: number;
  pesoCoesao?: number;
  pesoAlinhamento?: number;
  pesoSeparacao?: number;
  pesoMedo?: number;
  semente?: number;
}

/**
 * Rebanho (boids): coesão, separação e alinhamento, mais fuga de um "pastor" (Gn 13: os
 * rebanhos de Abrão e Ló). O medo se propaga pelos vizinhos, então o bando foge junto e pode
 * ser conduzido andando atrás dele. `juntar()` é o assobio do pastor (o bando se aperta e os
 * desgarrados voltam). `conduzirPara(x, z)` faz o bando caminhar sozinho até um ponto e
 * `seguirLider(lider)` faz o bando acompanhar alguém (Ló partindo com seus rebanhos, Gn 13:11).
 *
 * Registre o rebanho em `mundo.atualizaveis` (ou chame `atualizar(dt)` a cada quadro). Os animais
 * continuam registrados individualmente: o rebanho só escreve o `desejo` de cada um.
 */
export class Rebanho {
  readonly animais: Animal[] = [];
  /** Posição de quem conduz (null = ninguém). Pode ser a posição de um Personagem (referência viva). */
  pastor: THREE.Vector3 | null = null;
  /** Outras ameaças (cães, lobos, pastores extras). */
  readonly ameacas: THREE.Vector3[] = [];
  readonly op: Required<OpcoesRebanho>;
  /** Ponto para onde o bando caminha sozinho (ou null). */
  destino: THREE.Vector3 | null = null;
  private lider: { posicao: THREE.Vector3 } | null = null;
  private distLider = 3;
  private tJuntar = 0;
  private rnd: Aleatorio;
  private vagar = new Map<Animal, { dir: number; t: number; parado: boolean }>();
  private centroCache = new THREE.Vector3();

  constructor(animais: Animal[] = [], op: OpcoesRebanho = {}) {
    const ref = animais[0]?.info;
    this.op = {
      raioMedo: op.raioMedo ?? 6.5,
      vizinhanca: op.vizinhanca ?? 4.5,
      separacao: op.separacao ?? (ref ? ref.raio * 2.6 : 1),
      velPastar: op.velPastar ?? (ref ? ref.velAndar * 0.45 : 0.35),
      velFuga: op.velFuga ?? (ref ? ref.velCorrer * 0.85 : 2.4),
      pesoCoesao: op.pesoCoesao ?? 0.6,
      pesoAlinhamento: op.pesoAlinhamento ?? 0.8,
      pesoSeparacao: op.pesoSeparacao ?? 2.2,
      pesoMedo: op.pesoMedo ?? 3.2,
      semente: op.semente ?? 7,
    };
    this.rnd = new Aleatorio(this.op.semente);
    for (const a of animais) this.adicionar(a);
  }

  adicionar(a: Animal) {
    if (this.animais.includes(a)) return;
    this.animais.push(a);
    a.rebanho = this;
    a.parar();
    a.estado = 'rebanho';
    this.vagar.set(a, { dir: this.rnd.entre(-Math.PI, Math.PI), t: this.rnd.entre(0, 4), parado: this.rnd.chance(0.6) });
  }

  remover(a: Animal) {
    const i = this.animais.indexOf(a);
    if (i < 0) return;
    this.animais.splice(i, 1);
    this.vagar.delete(a);
    if (a.rebanho === this) a.rebanho = null;
    if (a.estado === 'rebanho') a.parar();
  }

  /** Assobio do pastor: o bando se junta por alguns segundos. */
  juntar(segundos = 4) {
    this.tJuntar = Math.max(this.tJuntar, segundos);
    for (const a of this.animais) a.alarme = Math.min(a.alarme, 0.3);
  }

  /** O bando caminha sozinho até um ponto (null cancela). */
  conduzirPara(x: number | null, z = 0) {
    this.destino = x === null ? null : new THREE.Vector3(x, 0, z);
  }

  /** O bando acompanha alguém (null cancela). */
  seguirLider(lider: { posicao: THREE.Vector3 } | null, distancia = 3) {
    this.lider = lider;
    this.distLider = distancia;
  }

  /** Centro do bando (só animais visíveis em estado de rebanho). */
  centro(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(0, 0, 0);
    let n = 0;
    for (const a of this.animais) {
      if (!a.visivel) continue;
      out.add(a.posicao);
      n++;
    }
    return n ? out.multiplyScalar(1 / n) : out;
  }

  /** Quantos animais (que passam no filtro) estão dentro da área. */
  dentroDe(area: AreaRebanho, filtro?: (a: Animal) => boolean): number {
    return this.animaisDentro(area, filtro).length;
  }

  animaisDentro(area: AreaRebanho, filtro?: (a: Animal) => boolean): Animal[] {
    return this.animais.filter((a) => a.visivel && (!filtro || filtro(a)) && dentroArea(area, a.posicao.x, a.posicao.z));
  }

  /** Raio que contém o bando (útil para câmera e para saber se está espalhado). */
  espalhamento(): number {
    const c = this.centro(this.centroCache);
    let r = 0;
    for (const a of this.animais) if (a.visivel) r = Math.max(r, Math.hypot(a.posicao.x - c.x, a.posicao.z - c.z));
    return r;
  }

  atualizar(dt: number) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.tJuntar = Math.max(0, this.tJuntar - dt);
    const o = this.op;
    const lista = this.animais.filter((a) => a.estado === 'rebanho' && a.visivel);
    if (!lista.length) return;
    const centro = this.centro(this.centroCache);
    const ameacas = this.pastor ? [this.pastor, ...this.ameacas] : this.ameacas;
    const viz2 = o.vizinhanca * o.vizinhanca;
    const coes = new THREE.Vector3();
    const alin = new THREE.Vector3();
    const sep = new THREE.Vector3();
    const medo = new THREE.Vector3();
    const des = new THREE.Vector3();
    // 1) medo direto das ameaças
    for (const a of lista) {
      let m = 0;
      for (const p of ameacas) {
        const d = Math.hypot(a.posicao.x - p.x, a.posicao.z - p.z);
        if (d < o.raioMedo) m = Math.max(m, 1 - d / o.raioMedo);
      }
      a.dados._medo = m;
    }
    // 2) boids
    for (const a of lista) {
      const pa = a.posicao;
      coes.set(0, 0, 0);
      alin.set(0, 0, 0);
      sep.set(0, 0, 0);
      medo.set(0, 0, 0);
      let n = 0;
      let alarmeViz = 0;
      for (const b of lista) {
        if (b === a) continue;
        const dx = b.posicao.x - pa.x;
        const dz = b.posicao.z - pa.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > viz2) continue;
        n++;
        coes.x += dx;
        coes.z += dz;
        alin.x += b.desejo.x;
        alin.z += b.desejo.z;
        alarmeViz = Math.max(alarmeViz, b.alarme);
        const s = o.separacao;
        if (d2 < s * s && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          sep.x -= (dx / d) * (s - d) / s;
          sep.z -= (dz / d) * (s - d) / s;
        }
      }
      const medoProprio = a.dados._medo as number;
      for (const p of ameacas) {
        const dx = pa.x - p.x;
        const dz = pa.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < o.raioMedo && d > 1e-4) {
          const k = 1 - d / o.raioMedo;
          medo.x += (dx / d) * k * k * 1.5 + (dx / d) * k;
          medo.z += (dz / d) * k * k * 1.5 + (dz / d) * k;
        }
      }
      // alarme: próprio ou propagado pelos vizinhos, decai devagar
      const alvoAlarme = Math.max(medoProprio, alarmeViz * 0.82);
      a.alarme = alvoAlarme > a.alarme ? damp(a.alarme, alvoAlarme, 10, dt) : damp(a.alarme, alvoAlarme, 0.9, dt);
      const al = a.alarme;
      const juntando = this.tJuntar > 0 ? 1 : 0;
      des.set(0, 0, 0);
      if (n) {
        coes.multiplyScalar(1 / n);
        // a coesão só puxa quem está longe do grupo local; o alinhamento cresce com o alarme
        const lc = coes.length();
        if (lc > o.separacao * 1.4) des.addScaledVector(coes.normalize(), o.pesoCoesao * (0.4 + al + juntando * 2));
        if (alin.lengthSq() > 1e-6) des.addScaledVector(alin.normalize(), o.pesoAlinhamento * (0.15 + al));
      }
      des.addScaledVector(sep, o.pesoSeparacao);
      des.addScaledVector(medo, o.pesoMedo);
      // desgarrado ou assobio: volta para o centro do bando
      const dc = Math.hypot(centro.x - pa.x, centro.z - pa.z);
      if ((juntando && dc > o.separacao * 2) || dc > 14) {
        des.x += ((centro.x - pa.x) / dc) * (0.8 + juntando);
        des.z += ((centro.z - pa.z) / dc) * (0.8 + juntando);
      }
      // destino ou líder
      const alvo = this.lider ? this.lider.posicao : this.destino;
      let conduzido = false;
      if (alvo) {
        const dx = alvo.x - pa.x;
        const dz = alvo.z - pa.z;
        const d = Math.hypot(dx, dz);
        const longe = this.lider ? d > this.distLider + 1 : d > 1.5;
        if (longe && d > 1e-4) {
          des.x += (dx / d) * 1.2;
          des.z += (dz / d) * 1.2;
          conduzido = true;
        }
      }
      // pastar: passeio lento com paradas quando calmo
      const vg = this.vagar.get(a)!;
      vg.t -= dt;
      if (vg.t <= 0) {
        vg.parado = this.rnd.chance(0.55);
        vg.dir += this.rnd.entre(-1.4, 1.4);
        vg.t = vg.parado ? this.rnd.entre(2, 6) : this.rnd.entre(1.5, 4);
      }
      const calmo = al < 0.15 && !juntando && !conduzido;
      if (calmo && !vg.parado) {
        des.x += Math.sin(vg.dir) * 0.6;
        des.z += Math.cos(vg.dir) * 0.6;
      }
      // velocidade: pastando devagar; com alarme, até a fuga
      const vel = conduzido && al < 0.3 ? a.info.velAndar : o.velPastar + (o.velFuga - o.velPastar) * clamp(al * 1.2, 0, 1);
      const len = des.length();
      if (calmo && vg.parado && len < 0.6) {
        a.desejo.set(0, 0, 0);
        continue;
      }
      if (len > 1e-4) des.multiplyScalar(Math.min(1, len) * vel / len);
      a.desejo.x = damp(a.desejo.x, des.x, 3, dt);
      a.desejo.z = damp(a.desejo.z, des.z, 3, dt);
    }
  }
}
