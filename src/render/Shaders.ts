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

// Neblina "atmosférica": curva suave (ease-out) entre near e far. Com o far bem além do alcance
// da vegetação, as montanhas do horizonte ficam azuladas mas mantêm o relevo (não viram recortes chapados).
THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float _tf = clamp( ( vFogDepth - fogNear ) / max( fogFar - fogNear, 0.001 ), 0.0, 1.0 );
    float fogFactor = 1.0 - ( 1.0 - _tf ) * ( 1.0 - _tf );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;

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
  /** Alcance de desenho (m): a instância encolhe suavemente nos últimos 15% (sem "pop"). */
  alcance?: { value: number };
}

/** Injeta vento e revelação num material padrão do three (Lambert/Standard/Phong). */
export function aplicarPatch(material: THREE.Material, op: OpcoesPatch = {}) {
  const vento = op.vento ?? 0;
  const revelar = op.revelar ?? true;
  const href = op.alturaRef ?? 4;
  const alcance = op.alcance;
  const anterior = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    anterior?.call(material, sh, r);
    Object.assign(sh.uniforms, GLOBAIS);
    if (alcance) sh.uniforms.uAlcance = alcance;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n${CABECALHO}${alcance ? 'uniform float uAlcance;\n' : ''}`);
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
    if (alcance) {
      corpo += /* glsl */ `
      float _dcam = distance(_base.xz, cameraPosition.xz);
      transformed *= 1.0 - smoothstep(uAlcance * 0.85, uAlcance, _dcam);
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
  material.customProgramCacheKey = () => `patch_${vento}_${revelar}_${href}_${alcance ? 'a' : ''}`;
  return material;
}

/** Ruído de valor 2D em GLSL (usado no terreno e na grama para variar as cores do chão). */
export const GLSL_RUIDO = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
`;
