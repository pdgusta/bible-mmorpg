import * as THREE from 'three';
import { GLOBAIS } from './Shaders';

/**
 * Chuva barata: riscos instanciados numa caixa que acompanha a câmera. A posição de cada gota é
 * calculada no shader a partir de um deslocamento fixo e do tempo (nenhum custo de CPU por quadro).
 * Um único draw call; a intensidade controla quantas gotas aparecem.
 */
export class Chuva {
  readonly malha: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  /** 0..1 (fração de gotas visíveis e opacidade). */
  intensidade = 0;
  private alvo = 0;
  private velocidadeTransicao = 0.25;

  constructor(maxGotas = 2600, raio = 26, altura = 22) {
    const base = new THREE.PlaneGeometry(0.05, 1, 1, 1);
    base.translate(0, 0.5, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const off = new Float32Array(maxGotas * 4);
    let s = 1234567;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < maxGotas; i++) {
      off[i * 4] = rnd();
      off[i * 4 + 1] = rnd();
      off[i * 4 + 2] = rnd();
      off[i * 4 + 3] = i / maxGotas; // ordem (para a intensidade)
    }
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    geo.instanceCount = maxGotas;
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uCam: { value: new THREE.Vector3() },
          uRaio: { value: raio },
          uAltura: { value: altura },
          uIntens: { value: 0 },
          uVentoX: { value: 0.35 },
          uCor: { value: new THREE.Color('#c8d2dc') },
        },
      ]),
      vertexShader: /* glsl */ `
        #include <common>
        #include <fog_pars_vertex>
        attribute vec4 aOff;
        uniform vec3 uCam; uniform float uRaio; uniform float uAltura; uniform float uIntens; uniform float uVentoX;
        uniform float uTempo;
        varying float vAlfa; varying float vV;
        void main() {
          float vel = 16.0 + fract(aOff.x * 37.0) * 6.0;
          float y = fract(aOff.y - uTempo * vel / uAltura) * uAltura;
          // caixa de chuva centrada na câmera, "enrolada" no espaço do mundo (não acompanha os giros)
          vec3 base = vec3(aOff.x, 0.0, aOff.z) * vec3(2.0 * uRaio, 0.0, 2.0 * uRaio);
          base.x = mod(base.x - uCam.x, 2.0 * uRaio) - uRaio + uCam.x;
          base.z = mod(base.z - uCam.z, 2.0 * uRaio) - uRaio + uCam.z;
          base.y = uCam.y - uAltura * 0.45 + y;
          float comp = 0.9 + aOff.w * 0.6;
          // risco inclinado pelo vento, voltado para a câmera (billboard cilíndrico)
          vec3 paraCam = normalize(vec3(uCam.x - base.x, 0.0, uCam.z - base.z) + 1e-4);
          vec3 lado = normalize(cross(vec3(0.0, 1.0, 0.0), paraCam));
          vec3 p = base + lado * position.x * 1.0 + vec3(uVentoX * position.y * comp, position.y * comp, 0.0);
          float ativa = step(aOff.w, uIntens);
          float d = length(base.xz - uCam.xz);
          vAlfa = ativa * (1.0 - smoothstep(uRaio * 0.65, uRaio, d)) * smoothstep(0.0, 2.0, y) * smoothstep(uAltura, uAltura - 3.0, y);
          vV = position.y;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <fog_pars_fragment>
        uniform vec3 uCor; uniform float uIntens;
        varying float vAlfa; varying float vV;
        void main() {
          float a = vAlfa * (0.15 + 0.35 * vV) * (0.5 + 0.5 * uIntens);
          if (a < 0.01) discard;
          gl_FragColor = vec4(uCor, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    this.material.uniforms.uTempo = GLOBAIS.uTempo;
    this.malha = new THREE.Mesh(geo, this.material);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 5;
    this.malha.name = 'chuva';
    this.malha.visible = false;
  }

  /** Define a intensidade alvo (0..1); `segundos` = duração da transição. */
  definir(alvo: number, segundos = 4) {
    this.alvo = alvo;
    this.velocidadeTransicao = segundos > 0 ? 1 / segundos : 1e6;
  }

  atualizar(dt: number, camera: THREE.Camera, corLuz?: THREE.Color) {
    const d = this.alvo - this.intensidade;
    this.intensidade += Math.sign(d) * Math.min(Math.abs(d), dt * this.velocidadeTransicao);
    const u = this.material.uniforms;
    u.uIntens.value = this.intensidade;
    (u.uCam.value as THREE.Vector3).copy(camera.position);
    if (corLuz) (u.uCor.value as THREE.Color).copy(corLuz).lerp(new THREE.Color('#d8e0e8'), 0.6);
    this.malha.visible = this.intensidade > 0.005;
  }

  dispose() {
    this.malha.geometry.dispose();
    this.material.dispose();
  }
}
