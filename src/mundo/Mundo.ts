import * as THREE from 'three';
import { Relevo } from './Relevo';
import { Colisoes, type OpcoesColisor } from './Colisao';
import { MundoFisico } from './Fisica';
import { Navegacao } from './Navegacao';
import { Terreno, type FuncaoCor } from '../render/Terreno';
import { Natureza } from '../render/Natureza';
import { Grama, type FuncaoCorGrama, type FuncaoDensidade } from '../render/Grama';
import { Agua } from '../render/Agua';
import { Ruido, Aleatorio } from '../core/aleatorio';
import { Interativos } from '../jogo/Interacoes';
import type { Personagem } from '../jogo/Personagem';
import { aplicarPatch } from '../render/Shaders';

export interface DefMapa {
  nome: string;
  tamanho: number;
  semente: number;
  altura(x: number, z: number, r: Ruido): number;
  cor(x: number, z: number, h: number, inclinacao: number, out: THREE.Color, r: Ruido): void;
  densidadeGrama: FuncaoDensidade;
  corGrama: FuncaoCorGrama;
  nivelAgua?: number;
  pontos: Record<string, [number, number]>;
  /** Quanto a grama copia a cor do chão onde nasce (0..1, padrão 0,7): evita emendas. */
  gramaDoChao?: number;
}

export interface Area {
  id: string;
  x: number;
  z: number;
  raio: number;
  /** Altura mínima/máxima (para interiores em andares). */
  yMin?: number;
  yMax?: number;
  dentro: Set<string>;
  aoEntrar?(p: Personagem): void;
  aoSair?(p: Personagem): void;
}

/** Superfície escalável (andaimes, cordas, escadas, paredes de pedra) usada pelo Batedor. */
export interface Escalada {
  id: string;
  /** Pé da escalada (no chão) e saída no topo (já sobre a plataforma). */
  base: THREE.Vector3;
  topo: THREE.Vector3;
  /** Direção para a qual o personagem fica virado enquanto escala. */
  yaw: number;
  largura?: number;
  ativa: boolean;
}

/**
 * O mundo de uma era: relevo, física, navegação, vegetação, grama, água, estruturas,
 * pontos nomeados, interativos e áreas de gatilho.
 */
export class Mundo {
  readonly grupo = new THREE.Group();
  readonly def: DefMapa;
  readonly ruido: Ruido;
  readonly relevo: Relevo;
  readonly colisoes = new Colisoes();
  readonly fisica: MundoFisico;
  nav!: Navegacao;
  readonly terreno: Terreno;
  readonly natureza: Natureza;
  readonly grama: Grama;
  agua: Agua | null = null;
  readonly estruturas = new THREE.Group();
  readonly interativos = new Interativos();
  readonly areas = new Map<string, Area>();
  readonly pontos = new Map<string, [number, number]>();
  readonly escaladas = new Map<string, Escalada>();
  readonly personagens = new Map<string, Personagem>();
  readonly aleatorio: Aleatorio;
  /** Objetos atualizados todo quadro (animais, partículas, portões...). */
  readonly atualizaveis = new Set<{ atualizar(dt: number, t: number): void }>();
  /** Atualizações que precisam da câmera (chuva, luzes que seguem o foco...). */
  readonly aoAtualizar = new Set<(dt: number, t: number, camera: THREE.Camera, foco: THREE.Vector3) => void>();

  constructor(def: DefMapa, cenaNatureza: THREE.Object3D) {
    this.def = def;
    this.ruido = new Ruido(def.semente);
    this.aleatorio = new Aleatorio(def.semente * 31 + 1);
    const r = this.ruido;
    this.relevo = new Relevo(def.tamanho, 1, (x, z) => def.altura(x, z, r));
    this.fisica = new MundoFisico(this.relevo, this.colisoes);
    const cor: FuncaoCor = (x, z, h, inc, out) => def.cor(x, z, h, inc, out, r);
    this.terreno = new Terreno(this.relevo, cor);
    this.natureza = new Natureza(cenaNatureza);
    const mixChao = def.gramaDoChao ?? 0.7;
    const tmp = new THREE.Color();
    const corGrama = (x: number, z: number, out: THREE.Color) => {
      def.corGrama(x, z, out);
      if (mixChao > 0) {
        this.terreno.corEm(x, z, tmp).multiplyScalar(1.05);
        out.lerp(tmp, mixChao);
      }
    };
    this.grama = new Grama(this.relevo, def.densidadeGrama, corGrama);
    if (def.nivelAgua !== undefined) {
      this.agua = new Agua(this.relevo, def.nivelAgua);
      this.fisica.nivelAgua = def.nivelAgua;
      this.grama.nivelAgua = def.nivelAgua;
      this.grupo.add(this.agua.malha);
    }
    for (const [k, v] of Object.entries(def.pontos)) this.pontos.set(k, v);
    this.estruturas.name = 'estruturas';
    this.grupo.add(this.terreno.grupo, this.natureza.grupo, this.grama.malha, this.estruturas);
    this.grupo.name = `mundo_${def.nome}`;
  }

  /** Altura do chão em (x,z) considerando estruturas abaixo de yMax. */
  chao(x: number, z: number, yMax = 1e6) {
    return this.fisica.chao(x, z, yMax).y;
  }

  ponto(nome: string): [number, number] {
    const p = this.pontos.get(nome);
    if (!p) throw new Error(`Ponto desconhecido: ${nome}`);
    return p;
  }

  ponto3(nome: string, dy = 0): THREE.Vector3 {
    const [x, z] = this.ponto(nome);
    return new THREE.Vector3(x, this.relevo.altura(x, z) + dy, z);
  }

  /** Adiciona um objeto às estruturas, com materiais preparados para a transição de era. */
  adicionar(obj: THREE.Object3D, colisores: OpcoesColisor[] = []) {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) if (!mat.userData.patch) {
        aplicarPatch(mat, { revelar: true });
        mat.userData.patch = true;
      }
    });
    this.estruturas.add(obj);
    return colisores.map((c) => this.colisoes.adicionar(c));
  }

  adicionarArea(a: Omit<Area, 'dentro'>) {
    const area: Area = { ...a, dentro: new Set() };
    this.areas.set(a.id, area);
    return area;
  }

  /** Finaliza a construção: colisões dos troncos de árvores e grade de navegação. */
  finalizar() {
    this.colisoesArvores();
    this.natureza.construir();
    this.nav = new Navegacao(this.fisica, 1);
  }

  /** (Re)cria os colisores dos troncos a partir da vegetação atual (tag 'arvore'). */
  colisoesArvores() {
    this.colisoes.removerTag('arvore');
    for (const t of this.natureza.troncos()) {
      const y = this.relevo.altura(t.x, t.z);
      this.colisoes.adicionar({ tipo: 'cilindro', x: t.x, z: t.z, r: t.r, y0: y - 1, y1: y + 4, piso: false, tag: 'arvore' });
    }
  }

  /** Ponto nomeado em 3D, sobre o chão ou sobre a estrutura mais alta abaixo de `yMax`. */
  ponto3Chao(nome: string, yMax = 1e6): THREE.Vector3 {
    const [x, z] = this.ponto(nome);
    return new THREE.Vector3(x, this.chao(x, z, yMax), z);
  }

  atualizar(dt: number, t: number, camera: THREE.Camera, foco: THREE.Vector3) {
    this.terreno.atualizar(camera.position);
    this.natureza.atualizar(dt, camera, camera.position);
    this.grama.atualizar(foco);
    for (const a of this.atualizaveis) a.atualizar(dt, t);
    for (const f of this.aoAtualizar) f(dt, t, camera, foco);
  }

  /** Verifica áreas de gatilho para um personagem. */
  verificarAreas(p: Personagem) {
    const pos = p.posicao;
    for (const a of this.areas.values()) {
      const d = Math.hypot(pos.x - a.x, pos.z - a.z);
      const dentroY = (a.yMin === undefined || pos.y >= a.yMin) && (a.yMax === undefined || pos.y <= a.yMax);
      const dentro = d <= a.raio && dentroY;
      const estava = a.dentro.has(p.id);
      if (dentro && !estava) {
        a.dentro.add(p.id);
        a.aoEntrar?.(p);
      } else if (!dentro && estava) {
        a.dentro.delete(p.id);
        a.aoSair?.(p);
      }
    }
  }

  dispose() {
    this.terreno.dispose();
    this.natureza.dispose();
    this.grama.dispose();
    this.agua?.dispose();
    this.estruturas.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    for (const p of this.personagens.values()) p.dispose();
  }
}
