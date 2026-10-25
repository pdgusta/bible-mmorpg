import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Grama } from './Grama';
import { Relevo } from '../mundo/Relevo';
import { GLOBAIS } from './Shaders';

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

  it('a lâmina deformada pelo shader (vento de tempestade, dobra) que entra na tela é desenhada', () => {
    const { grama, foco, malhas } = gramaDeTeste(true);
    const ventoAntes = GLOBAIS.uVento.value;
    try {
      // o caso da revisão (vento 1) e câmeras rasantes, de lado e por cima, com o vento de tempestade
      const casos: [number, THREE.PerspectiveCamera][] = [];
      const rasante = (fov: number, p: THREE.Vector3, dir: THREE.Vector3) => {
        const c = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 500);
        c.position.copy(p);
        c.lookAt(p.clone().add(dir));
        return c;
      };
      const t = Math.tan((27.5 * Math.PI) / 180) * (16 / 9);
      casos.push([1, rasante(55, new THREE.Vector3(-17.4, 1.03809, -20), new THREE.Vector3(t, 0, 1))]);
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * Math.PI * 2;
        const p = new THREE.Vector3(foco.x + Math.cos(ang) * 20, k % 2 ? 0.6 : 3, foco.z + Math.sin(ang) * 20);
        casos.push([2.4, rasante(50, p, new THREE.Vector3(-Math.sin(ang), -0.05, Math.cos(ang)))]);
      }
      const todas = malhas.map((im) => {
        const m = new THREE.Matrix4();
        return Array.from({ length: im.count }, (_, i) => (im.getMatrixAt(i, m), m.clone()));
      });
      /** Lâminas com algum vértice na tela que não foram desenhadas. */
      const faltam: string[] = [];
      for (const [vento, cam] of casos) {
        GLOBAIS.uVento.value = vento;
        grama.atualizar(foco, cam);
        cam.updateMatrixWorld(true);
        const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        malhas.forEach((im, k) => {
          const agora = new Set([...desenhadas(im).keys()]);
          const pos = im.geometry.attributes.position;
          const v = new THREE.Vector3();
          const base = new THREE.Vector3();
          for (const m of todas[k]) {
            base.setFromMatrixPosition(m);
            const chave = `${base.x.toFixed(3)},${base.y.toFixed(3)},${base.z.toFixed(3)}`;
            if (agora.has(chave)) continue;
            // o shader da grama: vento (onda até ±0,7 em x, ±1 em z) e a dobra junto do foco
            const dl = Math.hypot(base.x - foco.x, base.z - foco.z);
            for (let i = 0; i < pos.count; i++) {
              const h = pos.getY(i);
              for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                v.set(pos.getX(i) + sx * 0.7 * 0.12 * vento * h * 2.5, h, pos.getZ(i) + sz * 0.06 * vento * h * 2.5);
                if (dl < 1) {
                  const d = new THREE.Vector2(base.x - foco.x + 0.001, base.z - foco.z + 0.001).normalize().multiplyScalar((1 - dl) * h * 0.8);
                  v.x += d.x;
                  v.z += d.y;
                }
                v.applyMatrix4(m);
                if (f.containsPoint(v)) faltam.push(`lâmina em ${chave} (vento ${vento})`);
              }
              if (faltam.length) break;
            }
          }
        });
      }
      expect(faltam.slice(0, 3)).toEqual([]);
    } finally {
      GLOBAIS.uVento.value = ventoAntes;
    }
  });
});

