import * as THREE from 'three';

/**
 * Uniforms globais compartilhados pelos materiais do mundo:
 * - tempo e vento (folhagem balançando);
 * - "revelação" radial usada na transição entre eras (o mundo afunda/encolhe fora do raio).
 */
export const GLOBAIS = {
  uTempo: { value: 0 },
  uVento: { value: 1 },
  uCentro: { value: new THREE.Vector2() },
  uRaio: { value: 1e6 },
};

const CABECALHO = /* glsl */ `
uniform float uTempo;
uniform float uVento;
uniform vec2 uCentro;
uniform float uRaio;
`;

function posicaoMundo() {
  return /* glsl */ `
  #ifdef USE_INSTANCING
    vec4 _pm = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    vec4 _base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #else
    vec4 _pm = modelMatrix * vec4(transformed, 1.0);
    vec4 _base = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  #endif
  `;
}

export interface OpcoesPatch {
  vento?: number; // amplitude do vento (0 = sem)
  revelar?: boolean;
  alturaRef?: number; // altura em que o vento atinge a amplitude total
}

/** Injeta vento e revelação num material padrão do three (Lambert/Standard/Phong). */
export function aplicarPatch(material: THREE.Material, op: OpcoesPatch = {}) {
  const vento = op.vento ?? 0;
  const revelar = op.revelar ?? true;
  const href = op.alturaRef ?? 4;
  const anterior = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    anterior?.call(material, sh, r);
    Object.assign(sh.uniforms, GLOBAIS);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${CABECALHO}`);
    let corpo = posicaoMundo();
    if (vento > 0) {
      corpo += /* glsl */ `
      float _h = clamp(transformed.y / ${href.toFixed(2)}, 0.0, 1.5);
      float _fase = dot(_base.xz, vec2(0.13, 0.17));
      float _s = sin(uTempo * 1.7 + _fase + _pm.x * 0.35) * 0.6 + sin(uTempo * 3.1 + _pm.z * 0.5) * 0.25;
      transformed.x += _s * ${vento.toFixed(3)} * uVento * _h * _h;
      transformed.z += cos(uTempo * 1.3 + _fase) * ${(vento * 0.5).toFixed(3)} * uVento * _h * _h;
      `;
    }
    if (revelar) {
      corpo += /* glsl */ `
      float _dc = distance(_base.xz, uCentro);
      float _enc = 1.0 - smoothstep(uRaio - 20.0, uRaio, _dc);
      transformed *= _enc;
      `;
    }
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${corpo}`);
  };
  material.customProgramCacheKey = () => `patch_${vento}_${revelar}_${href}`;
  return material;
}
