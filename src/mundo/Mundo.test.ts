import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Mundo, type DefMapa } from './Mundo';

const MAPA: DefMapa = {
  nome: 'teste',
  tamanho: 120,
  semente: 1,
  altura: () => 0,
  cor: (_x, _z, _h, _i, out) => out.set(0.4, 0.5, 0.3),
  densidadeGrama: () => 0,
  corGrama: (_x, _z, out) => out.set(0.3, 0.6, 0.2),
  pontos: {},
};

/** Mundo plano numa cena com neblina até `far` m (70 no interior da arca) e a câmera em (0, 5, 0). */
function cenario(far = 70) {
  const cena = new THREE.Scene();
  cena.fog = new THREE.Fog('#000000', 4, far);
  const mundo = new Mundo(MAPA, new THREE.Group());
  cena.add(mundo.grupo);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 5, 0);
  const caixa = (nome: string, x: number, z: number, altura = 10, material: THREE.Material = new THREE.MeshLambertMaterial(), sombra = false) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(20, altura, 20), material);
    m.name = nome;
    m.castShadow = sombra;
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
  /** Sol como o do Ceu: sombra ortográfica de ±45 m e 260 m, a 120 m do foco na direção `dir` (para a luz). */
  const sol = (foco: THREE.Vector3, dir: THREE.Vector3) => {
    const luz = new THREE.DirectionalLight('#ffffff', 2);
    luz.castShadow = true;
    const c = luz.shadow.camera;
    c.near = 1;
    c.far = 260;
    c.left = c.bottom = -45;
    c.right = c.top = 45;
    luz.target.position.copy(foco);
    luz.position.copy(foco).addScaledVector(dir.clone().normalize(), 120);
    mundo.luzSombra = luz;
  };
  return { mundo, camera, caixa, olhar, desenhada, sol };
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

  it('quem projeta sombra no volume de sombra do sol fica: a sombra cai num chão que ainda está na tela', () => {
    // o caso da revisão: neblina a 75 m, sol baixo vindo de -z; a parede (80 a 100 m) sombreia o chão a 30 m
    const { caixa, olhar, desenhada, sol } = cenario(75);
    sol(new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0.3, -1));
    const parede = caixa('parede', 0, -90, 20, new THREE.MeshLambertMaterial(), true);
    const semSombra = caixa('semSombra', 30, -90, 20);
    const foraDoVolume = caixa('foraDoVolume', 0, -300, 20, new THREE.MeshLambertMaterial(), true);
    olhar(0, -100);
    expect(desenhada(parede)).toBe(true);
    expect(desenhada(semSombra)).toBe(false);
    expect(desenhada(foraDoVolume)).toBe(false);
  });
});
