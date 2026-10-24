// A arca refaz a grade de navegação quando troca de estágio: um bicho que segue o caminho
// da navegação contorna o casco e chega à porta (era o leão preso na ponta oeste em A4).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Arca } from '../src/eras/noe/Arca';
import { Colisoes } from '../src/mundo/Colisao';
import { CorpoFisico, MundoFisico } from '../src/mundo/Fisica';
import { Navegacao } from '../src/mundo/Navegacao';
import { Relevo } from '../src/mundo/Relevo';
import type { Mundo } from '../src/mundo/Mundo';

/** Vale plano com a arca no centro e a navegação montada com ela no estágio 0. */
function montar() {
  const fisica = new MundoFisico(new Relevo(260, 2, () => 0), new Colisoes());
  const mundo = {
    fisica,
    colisoes: fisica.colisoes,
    estruturas: new THREE.Group(),
    atualizaveis: new Set(),
    escaladas: new Map(),
  } as unknown as Mundo;
  const arca = new Arca(mundo, 0, 0, 0);
  arca.definirEstagio(0);
  mundo.nav = new Navegacao(fisica, 1);
  return { fisica, mundo, arca };
}

/** Segue o caminho da navegação a 4 m/s, como `Animal.irPara`; devolve a distância final ao alvo. */
function seguir(m: ReturnType<typeof montar>, de: [number, number], ate: [number, number], segundos = 120) {
  const caminho = m.mundo.nav.caminho(de[0], de[1], ate[0], ate[1]);
  expect(caminho).not.toBeNull();
  const corpo = new CorpoFisico();
  corpo.teleportar(de[0], 0, de[1]);
  const dt = 1 / 30;
  let k = 0;
  for (let t = 0; t < segundos && k < caminho!.length; t += dt) {
    const [px, pz] = caminho![k];
    const dx = px - corpo.pos.x;
    const dz = pz - corpo.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.6) {
      k++;
      continue;
    }
    corpo.mover(m.fisica, dt, (dx / d) * 4, (dz / d) * 4);
  }
  return Math.hypot(ate[0] - corpo.pos.x, ate[1] - corpo.pos.z);
}

// posições do leão e da porta em A4, relativas ao centro da arca no estaleiro
const LEAO: [number, number] = [-105, -65];
const PORTA: [number, number] = [15.5, 32];

describe('Arca: navegação por estágio', () => {
  it('com a arca no estágio 5, o leão contorna o casco e chega à porta', () => {
    const m = montar();
    m.arca.definirEstagio(5);
    expect(seguir(m, LEAO, PORTA)).toBeLessThan(1.5);
  }, 60_000);

  it('o casco do estágio 5 fica fora da grade (e ficava dentro sem refazer)', () => {
    const m = montar();
    // junto à ponta oeste, entre a quilha e o costado: livre no estágio 0, casco no 5
    const ponta: [number, number] = [-60, 8];
    expect(m.mundo.nav.pode(...ponta)).toBe(true);
    m.arca.definirEstagio(5);
    expect(m.mundo.nav.pode(...ponta)).toBe(false);
  }, 60_000);
});
