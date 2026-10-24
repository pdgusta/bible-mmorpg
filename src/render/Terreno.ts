import * as THREE from 'three';
import type { Relevo } from '../mundo/Relevo';
import { GLSL_RUIDO, GLOBAIS, AFUNDAR_REVELAR, glslAfundar } from './Shaders';

export type FuncaoCor = (x: number, z: number, h: number, inclinacao: number, out: THREE.Color) => void;

/**
 * Malha do terreno em blocos (para culling por frustum), com cores por vértice e um detalhe
 * de ruído no shader que quebra a monotonia das cores chapadas.
 * Guarda também a grade de cores (a grama copia a cor do chão onde nasce) e tem um modo
 * "lama" (depois do dilúvio) com poças.
 */
export class Terreno {
  readonly grupo = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private blocos: { malha: THREE.Mesh; perto: THREE.BufferGeometry; longe: THREE.BufferGeometry; caixa: THREE.Box3 }[] = [];
  /** Até esta distância (m) da borda de um bloco ele usa a malha cheia; depois, a de meia resolução. */
  distanciaPerto = 60;
  private cores: Float32Array;
  private nCor: number;
  private passoCor: number;
  private meio: number;
  /**
   * Uniforms do terreno. uCentro/uRaio são os mesmos objetos de GLOBAIS (a "revelação" da
   * transição de era move terreno, estruturas, vegetação, grama e água juntos). O chão afunda
   * na faixa externa (de uRaio a uRaio + FAIXA_REVELAR), depois de a vegetação sumir.
   */
  readonly uniforms = {
    uRevelar: { value: 1 },
    uCentro: GLOBAIS.uCentro,
    uRaio: GLOBAIS.uRaio,
    /** 0 = normal, 1 = vale lamacento com poças (depois do dilúvio). */
    uLama: { value: 0 },
    /** Umidade (chuva): escurece e satura o chão. */
    uMolhado: { value: 0 },
  };

  constructor(relevo: Relevo, cor: FuncaoCor, passoMalha = 2, tamBloco = 96) {
    this.grupo.name = 'terreno';
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const u = this.uniforms;
    this.material.onBeforeCompile = (sh) => {
      sh.uniforms.uRevelar = u.uRevelar;
      sh.uniforms.uCentro = u.uCentro;
      sh.uniforms.uRaio = u.uRaio;
      sh.uniforms.uLama = u.uLama;
      sh.uniforms.uMolhado = u.uMolhado;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nvarying float vNy;\nuniform vec2 uCentro;\nuniform float uRaio;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 mp = modelMatrix * vec4(transformed, 1.0);
           transformed.y -= ${glslAfundar('mp.xz')} * ${AFUNDAR_REVELAR.toFixed(1)};
           vNy = normal.y;`,
        )
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vMundo;
           varying float vNy;
           uniform float uLama;
           uniform float uMolhado;
           ${GLSL_RUIDO}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float d1 = vnoise(vMundo.xz * 0.35);
           float d2 = vnoise(vMundo.xz * 1.7);
           float d3 = vnoise(vMundo.xz * 0.045);
           diffuseColor.rgb *= 0.86 + 0.16 * d1 + 0.07 * d2;
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.03, 0.92), d3 * 0.6);
           if (uLama > 0.001) {
             float rocha = smoothstep(0.8, 0.6, vNy);
             vec3 lama = mix(vec3(0.33, 0.26, 0.19), vec3(0.47, 0.38, 0.27), d1 * 0.7 + d3 * 0.3);
             diffuseColor.rgb = mix(diffuseColor.rgb, lama, uLama * (0.82 - rocha * 0.5) * (0.8 + 0.2 * d2));
             // poças nas partes planas
             float poca = smoothstep(0.6, 0.67, vnoise(vMundo.xz * 0.07 + 13.0) * 0.8 + d1 * 0.2) * smoothstep(0.97, 0.995, vNy);
             diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.47, 0.52), poca * uLama * 0.9);
           }
           diffuseColor.rgb *= 1.0 - uMolhado * 0.25;`,
        );
    };

    // grade de cores (uma por vértice da malha)
    this.meio = relevo.tamanho / 2;
    this.passoCor = passoMalha;
    this.nCor = Math.round(relevo.tamanho / passoMalha) + 1;
    this.cores = new Float32Array(this.nCor * this.nCor * 3);
    const c = new THREE.Color();
    const n = new THREE.Vector3();
    for (let j = 0; j < this.nCor; j++) {
      for (let i = 0; i < this.nCor; i++) {
        const x = -this.meio + i * passoMalha;
        const z = -this.meio + j * passoMalha;
        const h = relevo.altura(x, z);
        relevo.normal(x, z, n);
        cor(x, z, h, 1 - n.y, c);
        const k = (j * this.nCor + i) * 3;
        this.cores[k] = c.r; this.cores[k + 1] = c.g; this.cores[k + 2] = c.b;
      }
    }

    const meio = this.meio;
    const porBloco = Math.round(tamBloco / passoMalha);
    const nb = Math.ceil(relevo.tamanho / tamBloco);
    for (let bj = 0; bj < nb; bj++) {
      for (let bi = 0; bi < nb; bi++) {
        const x0 = -meio + bi * tamBloco;
        const z0 = -meio + bj * tamBloco;
        const nx = Math.min(porBloco, Math.round((meio - x0) / passoMalha));
        const nz = Math.min(porBloco, Math.round((meio - z0) / passoMalha));
        if (nx <= 0 || nz <= 0) continue;
        const bloco = { i0: bi * porBloco, j0: bj * porBloco, nx, nz, x0, z0, passo: passoMalha };
        const perto = this.geometriaBloco(relevo, bloco, 1);
        const longe = this.geometriaBloco(relevo, bloco, 2);
        const m = new THREE.Mesh(perto, this.material);
        m.receiveShadow = true;
        m.name = `terreno_${bi}_${bj}`;
        m.matrixAutoUpdate = false;
        this.grupo.add(m);
        this.blocos.push({ malha: m, perto, longe, caixa: perto.boundingBox! });
      }
    }
  }

  /**
   * Geometria de um bloco com um vértice a cada `salto` vértices da grade (1 = malha cheia,
   * 2 = metade da resolução, para longe) e uma saia de 3 m em volta: onde um bloco cheio encosta
   * num reduzido, a saia tampa a fresta entre as bordas.
   */
  private geometriaBloco(
    relevo: Relevo,
    b: { i0: number; j0: number; nx: number; nz: number; x0: number; z0: number; passo: number },
    salto: number,
  ): THREE.BufferGeometry {
    const linha = (n: number) => {
      const v: number[] = [];
      for (let i = 0; i < n; i += salto) v.push(i);
      v.push(n);
      return v;
    };
    const is = linha(b.nx);
    const js = linha(b.nz);
    const ni = is.length;
    const nj = js.length;
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const n = new THREE.Vector3();
    const vertice = (i: number, j: number, dy: number) => {
      const x = b.x0 + i * b.passo;
      const z = b.z0 + j * b.passo;
      relevo.normal(x, z, n);
      pos.push(x, relevo.altura(x, z) + dy, z);
      nor.push(n.x, n.y, n.z);
      const kc = ((b.j0 + j) * this.nCor + (b.i0 + i)) * 3;
      col.push(this.cores[kc], this.cores[kc + 1], this.cores[kc + 2]);
      return pos.length / 3 - 1;
    };
    for (const j of js) for (const i of is) vertice(i, j, 0);
    const idx: number[] = [];
    for (let j = 0; j < nj - 1; j++) {
      for (let i = 0; i < ni - 1; i++) {
        const a = j * ni + i;
        const c = a + 1;
        const d = a + ni;
        const e = d + 1;
        // alterna a diagonal para evitar padrão serrilhado
        if ((i + j) % 2 === 0) idx.push(a, d, c, c, d, e);
        else idx.push(a, d, e, a, e, c);
      }
    }
    // saia: a borda repetida 3 m abaixo, com as duas faces (vista de dentro ou de fora do bloco)
    const borda: number[] = [];
    for (let i = 0; i < ni; i++) borda.push(i);
    for (let j = 1; j < nj; j++) borda.push(j * ni + ni - 1);
    for (let i = ni - 2; i >= 0; i--) borda.push((nj - 1) * ni + i);
    for (let j = nj - 2; j >= 0; j--) borda.push(j * ni);
    const baixo = borda.map((v) => vertice(is[v % ni], js[Math.floor(v / ni)], -3));
    for (let k = 0; k < borda.length - 1; k++) {
      const a = borda[k], c = borda[k + 1], d = baixo[k], e = baixo[k + 1];
      idx.push(a, d, c, c, d, e, a, c, d, c, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  /**
   * Escolhe a resolução de cada bloco pela distância da câmera (malha cheia até `distanciaPerto`
   * da borda do bloco). Barato: chamar a cada quadro.
   */
  atualizar(camera: THREE.Vector3) {
    const d2 = this.distanciaPerto * this.distanciaPerto;
    for (const b of this.blocos) {
      const dx = Math.max(b.caixa.min.x - camera.x, 0, camera.x - b.caixa.max.x);
      const dz = Math.max(b.caixa.min.z - camera.z, 0, camera.z - b.caixa.max.z);
      b.malha.geometry = dx * dx + dz * dz < d2 ? b.perto : b.longe;
    }
  }

  /** Cor do chão em (x,z) (interpolação bilinear da grade de vértices). */
  corEm(x: number, z: number, out: THREE.Color): THREE.Color {
    const fx = Math.min(this.nCor - 1.001, Math.max(0, (x + this.meio) / this.passoCor));
    const fz = Math.min(this.nCor - 1.001, Math.max(0, (z + this.meio) / this.passoCor));
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const n = this.nCor;
    const c = this.cores;
    const a = (j * n + i) * 3;
    const b = a + 3;
    const d = a + n * 3;
    const e = d + 3;
    const w0 = (1 - tx) * (1 - tz), w1 = tx * (1 - tz), w2 = (1 - tx) * tz, w3 = tx * tz;
    return out.setRGB(
      c[a] * w0 + c[b] * w1 + c[d] * w2 + c[e] * w3,
      c[a + 1] * w0 + c[b + 1] * w1 + c[d + 1] * w2 + c[e + 1] * w3,
      c[a + 2] * w0 + c[b + 2] * w1 + c[d + 2] * w2 + c[e + 2] * w3,
    );
  }

  dispose() {
    for (const b of this.blocos) { b.perto.dispose(); b.longe.dispose(); }
    this.material.dispose();
  }
}
