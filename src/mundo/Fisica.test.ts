import { describe, expect, it } from 'vitest';
import { Colisoes } from './Colisao';
import { CorpoFisico, MundoFisico } from './Fisica';
import { Relevo } from './Relevo';

/** Rampa ao longo de +x a partir de x = 0, com a inclinação dada (tangente). */
function mundoRampa(tg: number) {
  const relevo = new Relevo(200, 2, (x) => Math.max(0, x) * tg);
  return new MundoFisico(relevo, new Colisoes());
}

/** Anda em +x por alguns segundos e devolve o corpo. */
function andar(m: MundoFisico, x0: number, segundos: number, vx = 4, vz = 0) {
  const c = new CorpoFisico();
  c.teleportar(x0, m.relevo.altura(x0, 0), 0);
  const dt = 1 / 60;
  for (let t = 0; t < segundos; t += dt) c.mover(m, dt, vx, vz);
  return c;
}

describe('CorpoFisico: inclinação máxima', () => {
  it('sobe uma encosta suave (~20°)', () => {
    const m = mundoRampa(Math.tan((20 * Math.PI) / 180));
    const c = andar(m, -4, 5);
    expect(c.pos.x).toBeGreaterThan(10);
    expect(c.pos.y).toBeGreaterThan(3);
  });

  it('não sobe uma encosta íngreme (~60°)', () => {
    const m = mundoRampa(Math.tan((60 * Math.PI) / 180));
    const c = andar(m, -4, 5);
    // a normal do relevo é amostrada a ±1 passo (2 m): o pé da encosta fica um pouco suavizado
    expect(c.pos.y).toBeLessThan(2);
    expect(c.pos.x).toBeLessThan(1.2);  });

  it('desce a encosta íngreme', () => {
    const m = mundoRampa(Math.tan((60 * Math.PI) / 180));
    const c = andar(m, 6, 3, -4);
    expect(c.pos.x).toBeLessThan(0);
  });

  it('anda ao longo do pé da encosta íngreme', () => {
    const m = mundoRampa(Math.tan((60 * Math.PI) / 180));
    const c = andar(m, -2, 3, 0, 4);
    expect(c.pos.z).toBeGreaterThan(8);
  });

  it('pular contra a encosta íngreme não serve de escada', () => {
    const m = mundoRampa(Math.tan((60 * Math.PI) / 180));
    const c = new CorpoFisico();
    c.teleportar(-1, 0, 0);
    const dt = 1 / 60;
    for (let t = 0; t < 6; t += dt) {
      if (c.noChao) c.pular();
      c.mover(m, dt, 4, 0);
    }
    expect(c.pos.y).toBeLessThan(2.5);
  });
});
