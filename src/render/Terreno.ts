import * as THREE from 'three';
import type { Relevo } from '../mundo/Relevo';

export type FuncaoCor = (x: number, z: number, h: number, inclinacao: number, out: THREE.Color) => void;

/**
 * Malha do terreno em blocos (para culling por frustum), com cores por vértice e um detalhe
 * de ruído no shader que quebra a monotonia das cores chapadas.
 */
export class Terreno {
  readonly grupo = new THREE.Group();
  readonly material: THREE.MeshLambertMaterial;
  private blocos: THREE.Mesh[] = [];
  /** Uniform para animar a "reconstrução" do mundo na transição de era. */
  readonly uniforms = {
    uRevelar: { value: 1 },
    uCentro: { value: new THREE.Vector2() },
    uRaio: { value: 99999 },
  };

  constructor(relevo: Relevo, cor: FuncaoCor, passoMalha = 2, tamBloco = 64) {
    this.grupo.name = 'terreno';
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const u = this.uniforms;
    this.material.onBeforeCompile = (sh) => {
      sh.uniforms.uRevelar = u.uRevelar;
      sh.uniforms.uCentro = u.uCentro;
      sh.uniforms.uRaio = u.uRaio;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;\nuniform vec2 uCentro;\nuniform float uRaio;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vec4 mp = modelMatrix * vec4(transformed, 1.0);
           float dc = distance(mp.xz, uCentro);
           float afunda = smoothstep(uRaio - 25.0, uRaio, dc);
           transformed.y -= afunda * 30.0;`,
        )
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vMundo;
           float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
           float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
             return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float d1 = vnoise(vMundo.xz * 0.35);
           float d2 = vnoise(vMundo.xz * 1.7);
           float d3 = vnoise(vMundo.xz * 0.045);
           diffuseColor.rgb *= 0.86 + 0.16 * d1 + 0.07 * d2;
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.03, 0.92), d3 * 0.6);`,
        );
    };

    const meio = relevo.tamanho / 2;
    const porBloco = Math.round(tamBloco / passoMalha);
    const nb = Math.ceil(relevo.tamanho / tamBloco);
    const c = new THREE.Color();
    for (let bj = 0; bj < nb; bj++) {
      for (let bi = 0; bi < nb; bi++) {
        const x0 = -meio + bi * tamBloco;
        const z0 = -meio + bj * tamBloco;
        const nx = Math.min(porBloco, Math.round((meio - x0) / passoMalha));
        const nz = Math.min(porBloco, Math.round((meio - z0) / passoMalha));
        if (nx <= 0 || nz <= 0) continue;
        const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
        const nor = new Float32Array((nx + 1) * (nz + 1) * 3);
        const col = new Float32Array((nx + 1) * (nz + 1) * 3);
        const n = new THREE.Vector3();
        let k = 0;
        for (let j = 0; j <= nz; j++) {
          for (let i = 0; i <= nx; i++) {
            const x = x0 + i * passoMalha;
            const z = z0 + j * passoMalha;
            const h = relevo.altura(x, z);
            relevo.normal(x, z, n);
            pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
            nor[k] = n.x; nor[k + 1] = n.y; nor[k + 2] = n.z;
            cor(x, z, h, 1 - n.y, c);
            col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
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

  dispose() {
    for (const b of this.blocos) b.geometry.dispose();
    this.material.dispose();
  }
}
