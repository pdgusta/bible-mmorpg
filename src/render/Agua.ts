import * as THREE from 'three';
import { GLOBAIS } from './Shaders';
import type { Relevo } from '../mundo/Relevo';

/**
 * Água estilizada: cor rasa/funda pela profundidade (lida de uma textura de alturas do relevo),
 * espuma na margem, ondas e reflexo do céu. O nível pode subir (dilúvio).
 */
export class Agua {
  readonly malha: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  nivel: number;

  constructor(relevo: Relevo, nivel: number, tamanho = relevo.tamanho * 2.2) {
    this.nivel = nivel;
    const n = relevo.n;
    const dados = new Float32Array(n * n);
    dados.set(relevo.alturas);
    const tex = new THREE.DataTexture(dados, n, n, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uAlturas: { value: tex },
          uTamRelevo: { value: relevo.tamanho },
          uNivel: { value: nivel },
          uRasa: { value: new THREE.Color('#5fc4c0') },
          uFunda: { value: new THREE.Color('#1f6f8f') },
          uCeu: { value: new THREE.Color('#cfe5f4') },
          uSol: { value: new THREE.Vector3(0, 1, 0) },
          uCorSol: { value: new THREE.Color('#fff') },
          uTurva: { value: 0 },
          uLuz: { value: 1 },
          uOnda: { value: 1 },
          // retângulo (centro x,z; meia-extensão x,z) onde a água não é desenhada (dentro do casco da arca)
          uRecorte: { value: new THREE.Vector4(0, 0, -1, -1) },
          uRecorteYaw: { value: 0 },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        uniform float uTempo;
        uniform float uOnda;
        varying vec3 vMundo;
        void main() {
          vec3 transformed = position;
          vec4 mp = modelMatrix * vec4(transformed, 1.0);
          mp.y += (sin(uTempo * 0.9 + mp.x * 0.12) * 0.04 + cos(uTempo * 0.7 + mp.z * 0.1) * 0.04) * uOnda;
          vMundo = mp.xyz;
          vec4 mvPosition = viewMatrix * mp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uAlturas; uniform float uTamRelevo; uniform float uNivel;
        uniform vec3 uRasa; uniform vec3 uFunda; uniform vec3 uCeu; uniform vec3 uSol; uniform vec3 uCorSol;
        uniform float uTempo; uniform float uTurva; uniform float uLuz; uniform float uOnda;
        uniform vec4 uRecorte; uniform float uRecorteYaw;
        varying vec3 vMundo;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }
        void main() {
          if (uRecorte.z > 0.0) {
            vec2 d = vMundo.xz - uRecorte.xy;
            float c = cos(uRecorteYaw), s = sin(uRecorteYaw);
            vec2 l = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
            if (abs(l.x) < uRecorte.z && abs(l.y) < uRecorte.w) discard;
          }
          vec2 uv = (vMundo.xz + uTamRelevo * 0.5) / uTamRelevo;
          float chao = texture2D(uAlturas, uv).r;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) chao = uNivel - 30.0;
          float prof = max(0.0, uNivel - chao);
          float t = smoothstep(0.0, 4.0, prof);
          vec3 cor = mix(uRasa, uFunda, t);
          cor = mix(cor, vec3(0.42, 0.36, 0.26), uTurva);
          // ondas: normal perturbada por ruído animado
          vec2 q = vMundo.xz * 0.35;
          float n1 = vn(q + vec2(uTempo * 0.25, uTempo * 0.12) * uOnda);
          float n2 = vn(q * 2.3 - vec2(uTempo * 0.18, -uTempo * 0.21) * uOnda);
          vec3 nor = normalize(vec3(((n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2) * uOnda, 1.0, (n2 - 0.5) * 0.35 * uOnda));
          vec3 v = normalize(cameraPosition - vMundo);
          float fres = pow(1.0 - max(dot(nor, v), 0.0), 3.0);
          cor = mix(cor, uCeu, fres * 0.55);
          vec3 h = normalize(uSol + v);
          float esp = pow(max(dot(nor, h), 0.0), 120.0);
          cor += uCorSol * esp * 0.9;
          // espuma na margem
          float esp2 = smoothstep(0.35, 0.0, prof) * (0.6 + 0.4 * sin(uTempo * 2.0 + vn(vMundo.xz * 1.5) * 6.0));
          cor = mix(cor, vec3(0.95, 0.97, 0.95), esp2 * 0.7 * (1.0 - uTurva));
          cor *= uLuz;
          float alfa = mix(0.55, 0.92, t) + esp2 * 0.3;
          gl_FragColor = vec4(cor, clamp(alfa, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.material.uniforms.uTempo = GLOBAIS.uTempo;
    const geo = new THREE.PlaneGeometry(tamanho, tamanho, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.malha = new THREE.Mesh(geo, this.material);
    this.malha.position.y = nivel;
    this.malha.name = 'agua';
    this.malha.renderOrder = 2;
  }

  /** Água barrenta (0..1) e agitação das ondas (1 = rio calmo). */
  definirTurbidez(turva: number, onda = 1) {
    this.material.uniforms.uTurva.value = turva;
    this.material.uniforms.uOnda.value = onda;
  }

  /** Não desenha a água dentro de um retângulo (casco da arca). meiaX/meiaZ <= 0 desliga. */
  definirRecorte(cx: number, cz: number, meiaX: number, meiaZ: number, yaw = 0) {
    (this.material.uniforms.uRecorte.value as THREE.Vector4).set(cx, cz, meiaX, meiaZ);
    this.material.uniforms.uRecorteYaw.value = yaw;
  }

  definirNivel(n: number) {
    this.nivel = n;
    this.malha.position.y = n;
    this.material.uniforms.uNivel.value = n;
  }

  sincronizarLuz(dirSol: THREE.Vector3, corSol: THREE.Color, corCeu: THREE.Color, escuridao: number) {
    const u = this.material.uniforms;
    (u.uSol.value as THREE.Vector3).copy(dirSol);
    (u.uCorSol.value as THREE.Color).copy(corSol);
    (u.uCeu.value as THREE.Color).copy(corCeu);
    u.uLuz.value = 1 - escuridao * 0.65;
  }

  dispose() {
    this.malha.geometry.dispose();
    this.material.dispose();
    (this.material.uniforms.uAlturas.value as THREE.Texture).dispose();
  }
}
