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

// Neblina "atmosférica": curva suave (ease-out) entre near e far, mais rala no alto (o ar do vale
// é mais denso que o das cristas). Assim as montanhas do horizonte ficam azuladas mas mantêm o
// relevo, em vez de virarem recortes chapados da cor da neblina.
/** Altitudes (m) entre as quais a neblina afina, e quanto ela afina no topo (0..1). */
const NEBLINA_ALT = { base: 14, topo: 75, alivio: 0.4 };
THREE.ShaderChunk.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
  varying float vFogDepth;
  varying float vFogAlt;
#endif
`;
// altura de mundo sem modelMatrix (serve também para instâncias): a câmera mais o deslocamento
// de vista girado de volta (a parte 3x3 da viewMatrix é ortonormal: inversa = transposta)
THREE.ShaderChunk.fog_vertex = /* glsl */ `
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogAlt = cameraPosition.y + dot( vec3( viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1] ), mvPosition.xyz );
#endif
`;
THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying float vFogAlt;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;
THREE.ShaderChunk.fog_fragment = /* glsl */ `
#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float _tf = clamp( ( vFogDepth - fogNear ) / max( fogFar - fogNear, 0.001 ), 0.0, 1.0 );
    float fogFactor = 1.0 - ( 1.0 - _tf ) * ( 1.0 - _tf );
  #endif
  fogFactor *= 1.0 - ${NEBLINA_ALT.alivio.toFixed(2)} * smoothstep( ${NEBLINA_ALT.base.toFixed(1)}, ${NEBLINA_ALT.topo.toFixed(1)}, vFogAlt );
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
  /** Faces duplas iluminadas como a da frente (folhas, lâminas): sem "verso" escuro. */
  semVerso?: boolean;
  /**
   * Recolorir: usa só a luminância da textura (o desenho), e a cor vem de `material.color`.
   * O valor é a luminância média da textura (vira 1,0). Ver Natureza (corFolha/corSolido).
   */
  luminancia?: number;
}

/**
 * Largura (m) de cada faixa da "revelação" radial (transição entre eras). São duas faixas
 * encadeadas, para que nada flutue:
 * - de uRaio - FAIXA a uRaio, a vegetação, a grama e as instâncias encolhem até sumir;
 * - de uRaio a uRaio + FAIXA, o terreno, as estruturas e a água afundam (ou se apagam), já sem nada em cima.
 */
export const FAIXA_REVELAR = 20;
/** Quanto o terreno e as estruturas afundam fora do raio revelado. */
export const AFUNDAR_REVELAR = 30;

/** GLSL: fator 0..1 de encolher (vegetação, grama) num ponto xz. Precisa de uCentro e uRaio. */
export function glslEncolher(xz: string) {
  return `smoothstep(uRaio - ${FAIXA_REVELAR.toFixed(1)}, uRaio, distance(${xz}, uCentro))`;
}

/** GLSL: fator 0..1 de afundar (terreno, estruturas, água) num ponto xz: começa onde a vegetação já sumiu. */
export function glslAfundar(xz: string) {
  return `smoothstep(uRaio, uRaio + ${FAIXA_REVELAR.toFixed(1)}, distance(${xz}, uCentro))`;
}

/** Trecho GLSL que mantém a normal da frente nas faces de trás (DoubleSide). */
export const GLSL_SEM_VERSO = `#include <normal_fragment_begin>
#ifndef FLAT_SHADED
  normal = normalize( vNormal );
#endif`;

/** Injeta vento e revelação num material padrão do three (Lambert/Standard/Phong). Idempotente. */
export function aplicarPatch(material: THREE.Material, op: OpcoesPatch = {}) {
  // idempotente: materiais compartilhados (ex.: o das estruturas) só recebem o patch uma vez
  if (material.userData.patch) return material;
  material.userData.patch = true;
  const vento = op.vento ?? 0;
  const revelar = op.revelar ?? true;
  const href = op.alturaRef ?? 4;
  const alcance = op.alcance;
  const semVerso = op.semVerso ?? false;
  const lum = op.luminancia ?? 0;
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
      // instâncias (vegetação) encolhem em torno da base; malhas fundidas (estruturas) afundam
      // por vértice, na mesma faixa do terreno (ver FAIXA_REVELAR)
      corpo += /* glsl */ `
      #ifdef USE_INSTANCING
        transformed *= 1.0 - ${glslEncolher('_base.xz')};
      #else
        transformed.y -= ${glslAfundar('_pm.xz')} * ${AFUNDAR_REVELAR.toFixed(1)};
      #endif
      `;
    }
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${corpo}`);
    if (semVerso) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', GLSL_SEM_VERSO);
    if (lum > 0) {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec4 _tex = texture2D( map, vMapUv );
          float _lum = dot( _tex.rgb, vec3( 0.299, 0.587, 0.114 ) ) / ${lum.toFixed(4)};
          diffuseColor *= vec4( vec3( clamp( 0.45 + 0.55 * _lum, 0.0, 1.5 ) ), _tex.a );
        #endif`,
      );
    }
  };
  material.customProgramCacheKey = () => `patch_${vento}_${revelar}_${href}_${alcance ? 'a' : ''}_${semVerso ? 'v' : ''}_${lum.toFixed(3)}`;
  return material;
}

/** Ruído de valor 2D em GLSL (usado no terreno e na grama para variar as cores do chão). */
export const GLSL_RUIDO = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
`;
