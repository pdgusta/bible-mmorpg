import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Mundo, type DefMapa } from './Mundo';

const MAPA: DefMapa = {
  nome: 'teste',
  tamanho: 400,
  semente: 1,
  altura: () => 0,
  cor: (_x, _z, _h, _i, out) => out.set(0.4, 0.5, 0.3),
  densidadeGrama: () => 0,
  corGrama: (_x, _z, out) => out.set(0.3, 0.6, 0.2),
  pontos: {},
};

/** Mundo plano numa cena com neblina até 70 m (como no interior da arca) e a câmera em (0, 5, 0). */
function cenario() {
  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog('#000000', 4, 70);
  const mundo = new Mundo(MAPA, new THREE.Group());
  cena.add(mundo.grupo);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 5, 0);
  const caixa = (nome: string, x: number, z: number, altura = 10, material: THREE.Material = new THREE.MeshLambertMaterial()) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(20, altura, 20), material);
    m.name = nome;
    m.position.set(x, altura / 2, z);
    const g = new THREE.Group();
    g.add(m);
    mundo.adicionar(g);
    return m;
  };
  const olhar = (x: number, z: number) => {
    camera.lookAt(x, 5, z);
    camera.updateMatrixWorld(true);
    mundo.atualizar(0.016, 0, camera, camera.position);
  };
  const desenhada = (m: THREE.Object3D) => m.layers.test(camera.layers);
  return { mundo, camera, caixa, olhar, desenhada };
}

describe('Mundo: estruturas além da neblina', () => {
  it('a estrutura inteira além do far sai do desenho, e volta quando a câmera se vira', () => {
    const { caixa, olhar, desenhada } = cenario();
    const longe = caixa('longe', 0, -150);
    const perto = caixa('perto', 0, -40);
    olhar(0, -100);
    expect(desenhada(longe)).toBe(false);
    expect(desenhada(perto)).toBe(true);
    olhar(0, 100);
    expect(desenhada(longe)).toBe(true);
  });

  it('mede pela profundidade de vista, como a neblina: longe de lado, mas raso, fica', () => {
    const { caixa, olhar, desenhada } = cenario();
    // a 134 m da câmera, mas a 60 m de profundidade (a neblina pinta pela profundidade)
    const deLado = caixa('deLado', 120, -60);
    olhar(0, -100);
    expect(desenhada(deLado)).toBe(true);
  });

  it('o que sobe acima de ALTURA_NEBLINA_CHEIA fica (o alívio da neblina no alto deixa ver)', () => {
    const { caixa, olhar, desenhada } = cenario();
    const torre = caixa('torre', 0, -150, 40);
    olhar(0, -100);
    expect(desenhada(torre)).toBe(true);
  });

  it('o que tem material sem neblina (fog: false, ex.: chamas) fica', () => {
    const { caixa, olhar, desenhada } = cenario();
    const chama = caixa('chama', 0, -150, 10, new THREE.MeshBasicMaterial({ fog: false }));
    olhar(0, -100);
    expect(desenhada(chama)).toBe(true);
  });

  it('a estrutura escondida que sai do mundo volta à camada 0', () => {
    const { mundo, caixa, olhar, desenhada } = cenario();
    const longe = caixa('longe', 0, -150);
    olhar(0, -100);
    expect(desenhada(longe)).toBe(false);
    mundo.estruturas.remove(longe.parent!);
    olhar(0, -100);
    expect(desenhada(longe)).toBe(true);
  });
});
