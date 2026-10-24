// Conversor de assets executado num Chromium headless (ver converter.mjs).
// - Redireciona (retarget) as animações da Universal Animation Library 1 (rig "DEF-")
//   para o esqueleto da Universal Animation Library 2 (rig estilo UE), gerando um
//   único GLB humano com todas as animações que o jogo usa.
// - Converte animais em FBX para GLB, normalizando escala e materiais.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const san = (n) => THREE.PropertyBinding.sanitizeNodeName(n);

function mapaOssos() {
  const m = {
    'DEF-hips': 'pelvis', 'DEF-spine.001': 'spine_01', 'DEF-spine.002': 'spine_02', 'DEF-spine.003': 'spine_03',
    'DEF-neck': 'neck_01', 'DEF-head': 'Head',
  };
  for (const [l, u] of [['L', 'l'], ['R', 'r']]) {
    Object.assign(m, {
      [`DEF-shoulder.${l}`]: `clavicle_${u}`, [`DEF-upper_arm.${l}`]: `upperarm_${u}`,
      [`DEF-forearm.${l}`]: `lowerarm_${u}`, [`DEF-hand.${l}`]: `hand_${u}`,
      [`DEF-thigh.${l}`]: `thigh_${u}`, [`DEF-shin.${l}`]: `calf_${u}`, [`DEF-foot.${l}`]: `foot_${u}`,
      [`DEF-toe.${l}`]: `ball_${u}`,
    });
    for (const dedo of ['index', 'middle', 'pinky', 'ring']) {
      for (const i of [1, 2, 3]) m[`DEF-f_${dedo}.0${i}.${l}`] = `${dedo}_0${i}_${u}`;
    }
    for (const i of [1, 2, 3]) m[`DEF-thumb.0${i}.${l}`] = `thumb_0${i}_${u}`;
  }
  return Object.fromEntries(Object.entries(m).map(([a, b]) => [san(a), san(b)]));
}

function ossos(raiz) {
  const lista = [];
  raiz.traverse((o) => { if (o.isBone) lista.push(o); });
  return lista;
}

function aplicarPoseInicial(raiz, clip) {
  const mixer = new THREE.AnimationMixer(raiz);
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  raiz.updateMatrixWorld(true);
  mixer.stopAllAction();
  return mixer;
}

/**
 * Retarget por delta de rotação em espaço de mundo a partir de uma pose de referência
 * comum (A_TPose nas duas bibliotecas): Wt = Ws · Rs_ref⁻¹ · Rt_ref.
 */
function redirecionarClip(clip, src, tgt, refSrc, refTgt, mapa, fps = 30) {
  const ossosTgt = ossos(tgt.cena);
  const porNomeSrc = Object.fromEntries(ossos(src.cena).map((b) => [b.name, b]));
  const mixer = new THREE.AnimationMixer(src.cena);
  const acao = mixer.clipAction(clip);
  acao.play();
  const n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const tempos = new Float32Array(n);
  const valores = new Map(ossosTgt.map((b) => [b, new Float32Array(n * 4)]));
  const posPelvis = new Float32Array(n * 3);
  const pelvisT = ossosTgt.find((b) => b.name === 'pelvis');
  const quadrilSrc = porNomeSrc[san('DEF-hips')];
  const escala = refTgt.alturaQuadril / refSrc.alturaQuadril;

  const qWs = new THREE.Quaternion();
  const qPai = new THREE.Quaternion();
  const mundoT = new Map();
  const tmpV = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, i / fps);
    tempos[i] = t;
    mixer.setTime(t);
    src.cena.updateMatrixWorld(true);
    mundoT.clear();
    for (const b of ossosTgt) {
      // ossosTgt está em ordem de travessia (pais antes de filhos).
      const pai = b.parent;
      if (mundoT.has(pai)) qPai.copy(mundoT.get(pai));
      else qPai.copy(refTgt.mundoPai.get(b) ?? new THREE.Quaternion());
      const nomeSrc = mapa.inverso[b.name];
      let Wt;
      if (nomeSrc && porNomeSrc[nomeSrc]) {
        porNomeSrc[nomeSrc].getWorldQuaternion(qWs);
        Wt = qWs.clone().multiply(refSrc.rotInv.get(nomeSrc)).multiply(refTgt.rot.get(b.name));
      } else {
        Wt = qPai.clone().multiply(refTgt.local.get(b.name));
      }
      mundoT.set(b, Wt);
      const local = qPai.clone().invert().multiply(Wt);
      valores.get(b).set([local.x, local.y, local.z, local.w], i * 4);
    }
    if (pelvisT && quadrilSrc) {
      quadrilSrc.getWorldPosition(tmpV);
      tmpV.sub(refSrc.posQuadril).multiplyScalar(escala).add(refTgt.posQuadril);
      // converte para o espaço local do pai do pélvis (estático nas animações sem root motion)
      const local = refTgt.paiPelvisInv.clone();
      tmpV.applyMatrix4(local);
      posPelvis.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
    }
  }
  mixer.stopAllAction();
  const trilhas = [];
  for (const b of ossosTgt) {
    if (!mapa.inverso[b.name]) continue;
    trilhas.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, tempos, valores.get(b)));
  }
  if (pelvisT) trilhas.push(new THREE.VectorKeyframeTrack(`${pelvisT.name}.position`, tempos, posPelvis));
  return new THREE.AnimationClip(clip.name, clip.duration, trilhas);
}

function referencia(cena, clipRef, nomeQuadril) {
  aplicarPoseInicial(cena, clipRef);
  const rot = new Map(), rotInv = new Map(), local = new Map(), mundoPai = new Map();
  for (const b of ossos(cena)) {
    const q = b.getWorldQuaternion(new THREE.Quaternion());
    rot.set(b.name, q);
    rotInv.set(b.name, q.clone().invert());
    local.set(b.name, b.quaternion.clone());
    mundoPai.set(b, b.parent.getWorldQuaternion(new THREE.Quaternion()));
  }
  const quadril = cena.getObjectByName(nomeQuadril);
  const posQuadril = quadril.getWorldPosition(new THREE.Vector3());
  const paiPelvisInv = quadril.parent.matrixWorld.clone().invert();
  return { rot, rotInv, local, mundoPai, posQuadril, alturaQuadril: posQuadril.y, paiPelvisInv };
}

async function paraBase64(objeto, animacoes) {
  const exp = new GLTFExporter();
  const buf = await exp.parseAsync(objeto, { binary: true, animations: animacoes, onlyVisible: false });
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

window.converterHumano = async ({ ual1, ual2, feminino, clipsUal1, clipsUal2 }) => {
  const loader = new GLTFLoader();
  const [g1, g2, gf] = await Promise.all([ual1, ual2, feminino].map((u) => loader.loadAsync(u)));
  const src = { cena: g1.scene, clips: g1.animations };
  const tgt = { cena: g2.scene, clips: g2.animations };
  const pares = mapaOssos();
  const mapa = { direto: pares, inverso: Object.fromEntries(Object.entries(pares).map(([a, b]) => [b, a])) };

  const refSrc = referencia(src.cena, src.clips.find((c) => c.name === 'A_TPose'), san('DEF-hips'));
  const refTgt = referencia(tgt.cena, tgt.clips.find((c) => c.name === 'A_TPose'), 'pelvis');

  const relatorio = { faltando: [] };
  const finais = [];
  for (const nome of clipsUal1) {
    const c = src.clips.find((x) => x.name === nome);
    if (!c) { relatorio.faltando.push(nome); continue; }
    finais.push(redirecionarClip(c, src, tgt, refSrc, refTgt, mapa));
  }
  for (const nome of clipsUal2) {
    const c = tgt.clips.find((x) => x.name === nome);
    if (!c) { relatorio.faltando.push(nome); continue; }
    finais.push(c);
  }
  // volta o alvo à pose de ligação antes de exportar
  tgt.cena.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  relatorio.clips = finais.map((c) => `${c.name} (${c.duration.toFixed(2)}s)`);
  const masc = await paraBase64(tgt.cena, finais);
  const fem = await paraBase64(gf.scene, []);
  return { masc, fem, relatorio };
};

/** Converte um animal FBX em GLB com altura normalizada (metros) e material flat. */
window.converterAnimal = async ({ url, altura, renomear = {}, cor }) => {
  const obj = await new FBXLoader().loadAsync(url);
  const caixa = new THREE.Box3().setFromObject(obj);
  const tam = caixa.getSize(new THREE.Vector3());
  const raiz = new THREE.Group();
  raiz.name = 'animal';
  obj.scale.multiplyScalar(altura / tam.y);
  obj.position.y = -caixa.min.y * (altura / tam.y);
  raiz.add(obj);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const novos = mats.map((m) => new THREE.MeshStandardMaterial({
      name: m.name, color: cor && m.color.getHex() === 0xffffff ? new THREE.Color(cor) : m.color.clone(),
      roughness: 0.9, metalness: 0, flatShading: true, vertexColors: !!o.geometry.attributes.color,
    }));
    o.material = Array.isArray(o.material) ? novos : novos[0];
  });
  const clips = obj.animations.map((c) => {
    const limpo = c.name.replace(/^.*\|/, '');
    const k = c.clone();
    k.name = renomear[limpo] ?? limpo;
    return k;
  });
  return { glb: await paraBase64(raiz, clips), clips: clips.map((c) => c.name), tamanho: tam.toArray() };
};

window.pronto = true;
