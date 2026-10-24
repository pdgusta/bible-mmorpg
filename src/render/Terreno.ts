import * as THREE from 'three';
import type { Relevo } from '../mundo/Relevo';
import { GLSL_RUIDO } from './Shaders';

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
  private blocos: THREE.Mesh[] = [];
  private cores: Float32Array;
  private nCor: number;
  private passoCor: number;
  private meio: number;
  /** Uniform para animar a "reconstrução" do mundo na transição de era. */
  readonly uniforms = {
    uRevelar: { value: 1 },
    uCentro: { value: new THREE.Vector2() },
    uRaio: { value: 99999 },
    /** 0 = normal, 1 = vale lamacento com poças (depois do dilúvio). */
    uLama: { value: 0 },
    /** Umidade (chuva): escurece e satura o chão. */
    uMolhado: { value: 0 },
  };

  constructor(relevo: Relevo, cor: FuncaoCor, passoMalha = 2, tamBloco = 64) {
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
           float dc = distance(mp.xz, uCentro);
           float afunda = smoothstep(uRaio - 25.0, uRaio, dc);
           transformed.y -= afunda * 30.0;
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
        const i0 = bi * porBloco;
        const j0 = bj * porBloco;
        const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
        const nor = new Float32Array((nx + 1) * (nz + 1) * 3);
        const col = new Float32Array((nx + 1) * (nz + 1) * 3);
        let k = 0;
        for (let j = 0; j <= nz; j++) {
          for (let i = 0; i <= nx; i++) {
            const x = x0 + i * passoMalha;
            const z = z0 + j * passoMalha;
            const h = relevo.altura(x, z);
            relevo.normal(x, z, n);
            pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
            nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
            const kc = ((j0 + j) * this.nCor + (i0 + i)) * 3;
            col[k] = this.cores[kc]; col[k + 1] = this.cores[kc + 1]; col[k + 2] = this.cores[kc + 2];
            k += 3;
          }
        }
        const idx: number[] = [];
        for (let j = 0; j < nz; j++) {
          for (let i = 0; i < nx; i++) {
            const a = j * (nx + 1) + i;
            const b = a + 1;
            const d = a + (nx + 1);
            const e = d + 1;
            // alterna a diagonal para evitar padrão serrilhado
            if ((i + j) % 2 === 0) idx.push(a, d, b, b, d, e);
            else idx.push(a, d, e, a, e, b);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setIndex(idx);
        g.computeBoundingSphere();
        g.computeBoundingBox();
        const m = new THREE.Mesh(g, this.material);
        m.receiveShadow = true;
        m.name = `terreno_${bi}_${bj}`;
        m.matrixAutoUpdate = false;
        this.grupo.add(m);
        this.blocos.push(m);
      }
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
    for (const b of this.blocos) b.geometry.dispose();
    this.material.dispose();
  }
}
