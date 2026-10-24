import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('./Animal', () => ({}));
import { Rebanho, dentroArea } from './Rebanho';
import type { Animal } from './Animal';

/** Animal falso: só o que o Rebanho usa. */
function falso(x: number, z: number): Animal {
  const a = {
    info: { raio: 0.32, velAndar: 0.75, velCorrer: 2.8 },
    posicao: new THREE.Vector3(x, 0, z),
    desejo: new THREE.Vector3(),
    alarme: 0,
    dados: {} as Record<string, unknown>,
    visivel: true,
    estado: 'parado',
    rebanho: null,
    tag: '',
    parar() {
      this.estado = 'parado';
    },
  };
  return a as unknown as Animal;
}

describe('Rebanho', () => {
  it('foge do pastor e o medo se propaga', () => {
    const ovelhas = [falso(0, 0), falso(1, 0), falso(0, 1), falso(1, 1), falso(4, 4)];
    const r = new Rebanho(ovelhas, { semente: 3 });
    r.pastor = new THREE.Vector3(-2, 0, 0.5);
    for (let k = 0; k < 30; k++) {
      r.atualizar(1 / 30);
      for (const a of ovelhas) a.posicao.addScaledVector(a.desejo, 1 / 30);
    }
    for (const a of ovelhas.slice(0, 4)) {
      expect(a.desejo.x).toBeGreaterThan(0); // para longe do pastor (que está a oeste)
      expect(a.alarme).toBeGreaterThan(0.2);
    }
  });

  it('conta animais por área e filtro', () => {
    const ovelhas = [falso(0, 0), falso(10, 0), falso(10, 1)];
    ovelhas[1].tag = 'lo';
    const r = new Rebanho(ovelhas);
    expect(r.dentroDe({ x: 10, z: 0, raio: 2 })).toBe(2);
    expect(r.dentroDe({ x0: 9, z0: -1, x1: 11, z1: 0.5 }, (a) => a.tag === 'lo')).toBe(1);
    expect(dentroArea((x) => x > 5, 6, 0)).toBe(true);
  });
});
