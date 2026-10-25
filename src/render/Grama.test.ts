import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Grama } from './Grama';
import { Relevo } from '../mundo/Relevo';

/** Grama cheia (densidade 1) num relevo ondulado (ou plano), com o foco fora do centro da grade de 4 m. */
function gramaDeTeste(plano = false) {
  const relevo = new Relevo(200, 1, (x, z) => (plano ? 0 : 0.05 * x + Math.sin(z * 0.1) * 2));
  const grama = new Grama(relevo, () => 1, (_x, _z, out) => out.set(0.3, 0.6, 0.2));
  const foco = new THREE.Vector3(3.1, relevo.altura(3.1, -2.7), -2.7);
  grama.atualizar(foco);
  const malhas = grama.malha.children as THREE.InstancedMesh[];
  return { grama, foco, malhas };
}

/** Câmera de 3ª pessoa: 6 m atrás do foco, olhando para `alvo`. */
function camera(foco: THREE.Vector3, alvo: THREE.Vector3) {
  const c = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  c.position.set(foco.x, foco.y + 2.5, foco.z + 6);
  c.lookAt(alvo);
  return c;
}

/** Posições (arredondadas a mm) das instâncias desenhadas agora. */
function desenhadas(im: THREE.InstancedMesh) {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const out = new Map<string, THREE.Vector3>();
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m);
    p.setFromMatrixPosition(m);
    out.set(`${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`, p.clone());
  }
  return out;
}

describe('Grama com culling por blocos', () => {
  it('sem câmera, desenha tudo, em 2 InstancedMesh e dentro da capacidade', () => {
    const { malhas } = gramaDeTeste();
    expect(malhas.map((im) => im.name)).toEqual(['grama', 'gramaLonge']);
    for (const im of malhas) {
      expect(im.count).toBeGreaterThan(1000);
      expect(im.count).toBeLessThan(im.instanceMatrix.count);
      expect(im.visible).toBe(true);
    }
  });

  it('olhando o céu num campo plano não desenha grama; olhando o chão à frente, só parte dela', () => {
    // no plano: num morro, a caixa de um bloco morro acima pode passar da altura da câmera
    const { grama, foco, malhas } = gramaDeTeste(true);
    const total = malhas.map((im) => im.count);
    grama.atualizar(foco, camera(foco, new THREE.Vector3(foco.x, foco.y + 100, foco.z + 5.5)));
    expect(malhas.map((im) => im.count)).toEqual([0, 0]);
    expect(malhas.every((im) => !im.visible)).toBe(true);
    grama.atualizar(foco, camera(foco, new THREE.Vector3(foco.x, foco.y, foco.z - 20)));
    malhas.forEach((im, k) => {
      expect(im.count).toBeGreaterThan(0);
      expect(im.count).toBeLessThan(total[k] * 0.8);
    });
  });

  it('toda lâmina que a câmera vê é desenhada, e voltar sem câmera devolve tudo', () => {
    const { grama, foco, malhas } = gramaDeTeste();
    const todas = malhas.map(desenhadas);
    const cam = camera(foco, new THREE.Vector3(foco.x + 15, foco.y - 1, foco.z - 10));
    grama.atualizar(foco, cam);
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let vistas = 0;
    malhas.forEach((im, k) => {
      const agora = desenhadas(im);
      expect(agora.size).toBeLessThan(todas[k].size);
      for (const [chave, p] of todas[k]) {
        const topo = p.clone().setY(p.y + 1.4);
        if (!f.containsPoint(p) && !f.containsPoint(topo)) continue;
        vistas++;
        expect(agora.has(chave)).toBe(true);
      }
    });
    expect(vistas).toBeGreaterThan(500);
    grama.atualizar(foco);
    malhas.forEach((im, k) => expect(desenhadas(im).size).toBe(todas[k].size));
  });
});
