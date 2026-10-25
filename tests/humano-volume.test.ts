import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CorpoBase } from '../src/entidades/humano/CorpoBase';
import { Humano } from '../src/entidades/humano/Humano';
import { CLIPES, type NomeClipe } from '../src/entidades/humano/Animador';
import type { Aparencia } from '../src/entidades/humano/Vestimenta';
import { APARENCIAS_NOE } from '../src/eras/noe/aparencias';
import { APARENCIAS_ABRAAO } from '../src/eras/abraao/aparencias';

/** Lê o GLB do disco (o tsconfig não tem os tipos do node: o jogo roda no navegador). */
async function carregar(arquivo: string) {
  const fs = 'node:fs';
  const { readFileSync } = (await import(/* @vite-ignore */ fs)) as { readFileSync(caminho: string): Uint8Array };
  const buf = readFileSync(`public/modelos/personagens/${arquivo}`);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '');
}

let masc: CorpoBase;
let fem: CorpoBase;
beforeAll(async () => {
  const gm = await carregar('humano.glb');
  const gf = await carregar('humana.glb');
  masc = new CorpoBase(gm, gm.animations);
  fem = new CorpoBase(gf, gm.animations);
}, 60000);

function criar(ap: Aparencia) {
  const h = new Humano(ap.corpo === 'fem' ? fem : masc, ap);
  const cena = new THREE.Scene();
  cena.add(h.raiz);
  h.raiz.position.set(12, 3, -40);
  h.raiz.rotation.y = 0.7;
  return { h, cena };
}

/**
 * Confere que todos os vértices animados (o mesmo cálculo do shader de skinning) estão dentro
 * do volume do corpo, no espaço da malha. Junta as falhas e faz um `expect` só.
 */
function foraDoVolume(h: Humano, rotulo: string, falhas: string[]) {
  const m = h.malha;
  m.updateMatrixWorld(true);
  const s = m.boundingSphere;
  if (!s) {
    falhas.push(`${rotulo}: sem volume`);
    return;
  }
  const n = m.geometry.attributes.position.count;
  const v = new THREE.Vector3();
  let pior = 0;
  for (let i = 0; i < n; i++) {
    m.getVertexPosition(i, v);
    pior = Math.max(pior, v.distanceTo(s.center) - s.radius);
  }
  if (pior > 1e-4) falhas.push(`${rotulo}: vértice ${pior.toFixed(3)} fora`);
}

describe('volume do corpo do humano (culling)', () => {
  it('a malha faz culling, também na sombra', () => {
    const { h } = criar(APARENCIAS_NOE.noe);
    expect(h.malha.frustumCulled).toBe(true);
    expect(h.malha.castShadow).toBe(true);
    expect(h.malha.boundingSphere).not.toBeNull();
  });

  it('contém o corpo animado em todos os clipes e nas poses procedurais', () => {
    const falhas: string[] = [];
    const aps = [APARENCIAS_NOE.noe, APARENCIAS_ABRAAO.abraao, APARENCIAS_ABRAAO.sara];
    for (const ap of aps) {
      const { h, cena } = criar(ap);
      const nome = `${ap.corpo}/${ap.altura}`;
      for (const clipe of Object.keys(CLIPES) as NomeClipe[]) {
        h.animador.atividade = clipe;
        for (let k = 0; k < 3; k++) {
          for (let p = 0; p < 4; p++) h.atualizar(0.12, 3);
          cena.updateMatrixWorld(true);
          foraDoVolume(h, `${nome} ${clipe} ${k}`, falhas);
        }
      }
      h.animador.atividade = null;
      // braços e pernas fora do lugar de repouso: oração, escalada e o olhar
      h.oracao = 1;
      h.olharPara = new THREE.Vector3(20, 10, -30);
      for (let p = 0; p < 20; p++) h.atualizar(0.1, 3);
      foraDoVolume(h, `${nome} oração`, falhas);
      h.oracao = 0;
      h.escalando = true;
      h.animador.velocidade = 1;
      for (let k = 0; k < 6; k++) {
        for (let p = 0; p < 3; p++) h.atualizar(0.1, 3);
        foraDoVolume(h, `${nome} escalada ${k}`, falhas);
      }
      h.dispose();
    }
    expect(falhas).toEqual([]);
  }, 120000);

  it('acompanha a raiz sem refazer o volume e não é folgado demais', () => {
    const { h, cena } = criar(APARENCIAS_NOE.noe);
    h.animador.atividade = 'parado';
    h.atualizar(0.1, 3);
    const raio = h.malha.boundingSphere!.radius * h.malha.matrixWorld.getMaxScaleOnAxis();
    // um homem de 1,78 m de pé cabe numa esfera de ~0,9 m; o volume pode sobrar um pouco
    expect(raio).toBeGreaterThan(0.85);
    expect(raio).toBeLessThan(1.25);
    // a raiz anda depois da última atualização (o jogo move a raiz antes de atualizar, mas o
    // volume fica no espaço da malha e a matriz de mundo o leva junto)
    h.raiz.position.x += 30;
    cena.updateMatrixWorld(true);
    const falhas: string[] = [];
    foraDoVolume(h, 'raiz movida', falhas);
    expect(falhas).toEqual([]);
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
    cam.position.set(h.raiz.position.x, 1.5, h.raiz.position.z + 8);
    cam.lookAt(h.raiz.position.x, 1, h.raiz.position.z);
    cam.updateMatrixWorld();
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    expect(f.intersectsObject(h.malha)).toBe(true);
    cam.lookAt(h.raiz.position.x, 1, h.raiz.position.z + 20);
    cam.updateMatrixWorld();
    f.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    expect(f.intersectsObject(h.malha)).toBe(false);
  });
});
