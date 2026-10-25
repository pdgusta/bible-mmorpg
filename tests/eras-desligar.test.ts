// Troca de era: o desligar() de cada era descarta os animais do mundo dela (os 8 da A6
// seguiam na era 2, e os de Canaã iam para a era 1 num jogo novo depois de B5).
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { Colisoes } from '../src/mundo/Colisao';
import { MundoFisico } from '../src/mundo/Fisica';
import { Relevo } from '../src/mundo/Relevo';
import { Animal } from '../src/entidades/Animal';
import { ERA_NOE_JOGO } from '../src/jogo/ligacao/noe';
import { ERA_ABRAAO_JOGO } from '../src/jogo/ligacao/abraao';
import type { ContextoEra, DefEra } from '../src/jogo/eras';

// Montar o vale e Canaã de verdade pede os modelos da natureza: aqui cada era ganha só um
// chão plano, que é o que os animais usam.
vi.mock('../src/eras/noe/construir', async (original) => {
  const m = await original<typeof import('../src/eras/noe/construir')>();
  return { ...m, MundoNoe: class { mundo = mundoPlano(); } };
});
vi.mock('../src/eras/abraao/construir', async (original) => {
  const m = await original<typeof import('../src/eras/abraao/construir')>();
  return { ...m, MundoCanaa: class { mundo = mundoPlano(); ceu: unknown = null; } };
});

function mundoPlano() {
  const fisica = new MundoFisico(new Relevo(80, 2, () => 0), new Colisoes());
  return { fisica, grupo: new THREE.Group(), atualizaveis: new Set<{ atualizar(dt: number, t: number): void }>() };
}

/** Só o que o construtor das eras e o `animais.criar` dos serviços tocam. */
function ctxFalso(): ContextoEra {
  return { jogo: { natureza: new THREE.Group(), ceu: {} }, s: {}, audio: {} } as unknown as ContextoEra;
}

interface ComAnimais {
  servicos: { animais: { criar(especie: string, x: number, z: number): Promise<Animal> } };
  desligar(): void;
}

describe('EraAtiva.desligar descarta os animais da era', () => {
  for (const def of [ERA_NOE_JOGO, ERA_ABRAAO_JOGO] as DefEra[]) {
    it(def.id, async () => {
      const era = (await def.criar(ctxFalso())) as unknown as ComAnimais;
      const outro = (await def.criar(ctxFalso())) as unknown as ComAnimais;
      const a = await era.servicos.animais.criar('leao', 0, 0);
      const b = await era.servicos.animais.criar('cervo', 3, 0);
      const fica = await outro.servicos.animais.criar('leao', 0, 0);
      expect(Animal.todos.has(a) && Animal.todos.has(b)).toBe(true);
      era.desligar();
      expect(Animal.todos.has(a)).toBe(false);
      expect(Animal.todos.has(b)).toBe(false);
      // os animais de outro mundo (a era que entra) ficam
      expect(Animal.todos.has(fica)).toBe(true);
      outro.desligar();
      expect(Animal.todos.has(fica)).toBe(false);
    }, 60_000);
  }
});
