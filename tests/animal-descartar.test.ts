// Troca de era: os animais do mundo que sai não podem ficar em `Animal.todos` (os 8 da A6
// continuavam na era 2 e entravam na separação dos animais de Canaã).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Colisoes } from '../src/mundo/Colisao';
import { MundoFisico } from '../src/mundo/Fisica';
import { Relevo } from '../src/mundo/Relevo';
import { Animal, criarAnimal } from '../src/entidades/Animal';

function mundo() {
  const fisica = new MundoFisico(new Relevo(80, 2, () => 0), new Colisoes());
  return { fisica, grupo: new THREE.Group(), atualizaveis: new Set<{ atualizar(dt: number, t: number): void }>() };
}

describe('Animal.descartar', () => {
  it('tira de Animal.todos, da cena e dos atualizáveis só os animais do mundo descartado', async () => {
    const velho = mundo();
    const novo = mundo();
    const saem = await Promise.all([criarAnimal('leao', velho, 0, 0, { semente: 1 }), criarAnimal('cervo', velho, 3, 0, { semente: 2 })]);
    const fica = await criarAnimal('leao', novo, 0, 0, { semente: 3 });
    // um comando pendente (a procissão da A6 anda com irPara) termina em vez de ficar esperando
    let andou = false;
    void saem[0].irPara(30, 0).then(() => (andou = true));

    expect(Animal.descartar(velho)).toBe(2);
    await Promise.resolve();
    expect(andou).toBe(true);
    for (const a of saem) {
      expect(Animal.todos.has(a)).toBe(false);
      expect(a.raiz.parent).toBeNull();
    }
    expect(velho.atualizaveis.size).toBe(0);
    expect(Animal.todos.has(fica)).toBe(true);
    expect(novo.atualizaveis.has(fica)).toBe(true);
    // descartar de novo não acha mais nada
    expect(Animal.descartar(velho)).toBe(0);
    await fica.remover(false);
  }, 60_000);
});
