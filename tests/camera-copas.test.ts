// A câmera de 3ª pessoa não entra na copa das árvores (os colisores são só os troncos).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CameraTerceira } from '../src/camera/CameraTerceira';
import { CopasCamera, type FonteCopas } from '../src/camera/Copas';
import { Colisoes } from '../src/mundo/Colisao';
import { MundoFisico } from '../src/mundo/Fisica';
import { Relevo } from '../src/mundo/Relevo';
import type { Copa } from '../src/render/Natureza';

/** Vegetação falsa: a lista de copas e a versão que a Natureza muda ao cortar uma árvore. */
function fonte(copas: Copa[]): FonteCopas & { lista: Copa[]; versao: number } {
  return { lista: copas, versao: 0, copas() { return this.lista; } };
}

const fisica = () => new MundoFisico(new Relevo(100, 2, () => 0), new Colisoes());
// personagem na origem, câmera atrás dele em +z (yaw 0) e um pouco acima (pitch 0,32)
const ALVO = new THREE.Vector3(0, 0, 0);
// copa de oliveira a 3,2 m atrás do personagem: de 1,9 a 5,6 m de altura, raio 2,6 m
const COPA: Copa = { x: 0, z: 3.2, y0: 1.9, y1: 5.6, raio: 2.6 };

function pose(cam: CameraTerceira, f: MundoFisico) {
  const pos = new THREE.Vector3();
  cam.calcularPose(ALVO, f, pos, new THREE.Vector3(), 0, 0.32, 6);
  return pos;
}

describe('Câmera: copas das árvores', () => {
  it('sem copas, fica na distância pedida', () => {
    const cam = new CameraTerceira(1);
    const pos = pose(cam, fisica());
    expect(pos.distanceTo(new THREE.Vector3(0, 1.55, 0))).toBeGreaterThan(5.9);
  });

  it('com uma copa atrás do personagem, para antes da folhagem', () => {
    const cam = new CameraTerceira(1);
    const f = fonte([COPA]);
    cam.copas = new CopasCamera(f);
    const pos = pose(cam, fisica());
    const a = COPA.raio * 0.85;
    const b = ((COPA.y1 - COPA.y0) / 2) * 0.85;
    const cy = (COPA.y0 + COPA.y1) / 2;
    const dentro = ((pos.x - COPA.x) / a) ** 2 + ((pos.y - cy) / b) ** 2 + ((pos.z - COPA.z) / a) ** 2;
    expect(dentro).toBeGreaterThan(1);
    expect(pos.distanceTo(new THREE.Vector3(0, 1.55, 0))).toBeLessThan(3);
  });

  it('a árvore cortada (versão nova) deixa de contar', () => {
    const cam = new CameraTerceira(1);
    const f = fonte([COPA]);
    cam.copas = new CopasCamera(f);
    expect(pose(cam, fisica()).z).toBeLessThan(3);
    f.lista = [];
    f.versao++;
    expect(pose(cam, fisica()).z).toBeGreaterThan(5);
  });

  it('debaixo da copa (o pivô dentro dela), a copa não empurra a câmera', () => {
    const cam = new CameraTerceira(1);
    cam.copas = new CopasCamera(fonte([{ x: 0, z: 0, y0: 0.5, y1: 4, raio: 3 }]));
    expect(pose(cam, fisica()).z).toBeGreaterThan(5);
  });
});
