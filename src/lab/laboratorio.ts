// Laboratório de desenvolvimento: renderiza personagens e poses para inspeção visual.
// Acesse com ?lab=personagens&pose=parado
import * as THREE from 'three';
import { Ativos } from '../render/Ativos';
import { CorpoBase } from '../entidades/humano/CorpoBase';
import { Humano } from '../entidades/humano/Humano';
import type { Aparencia } from '../entidades/humano/Vestimenta';
import { CLIPES, type NomeClipe } from '../entidades/humano/Animador';
import type { NomeAderecos } from '../entidades/humano/Aderecos';

export async function laboratorio(canvas: HTMLCanvasElement, aparencias: Record<string, Aparencia>) {
  const P = new URLSearchParams(location.search);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setSize(window.innerWidth, window.innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#bcd8e8');
  cena.add(new THREE.HemisphereLight('#d6e6f4', '#7e7254', 1.2));
  const sol = new THREE.DirectionalLight('#fff2dc', 2.6);
  sol.position.set(4, 8, 6);
  sol.castShadow = true;
  sol.shadow.normalBias = 0.03;
  sol.shadow.bias = -0.0005;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.camera.left = -8; sol.shadow.camera.right = 8; sol.shadow.camera.top = 8; sol.shadow.camera.bottom = -8;
  cena.add(sol);
  const chao = new THREE.Mesh(new THREE.CircleGeometry(30, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#8fae5a' }));
  chao.receiveShadow = true;
  cena.add(chao);

  const ativos = new Ativos();
  const [gm, gf] = await Promise.all([ativos.carregar('personagens/humano.glb'), ativos.carregar('personagens/humana.glb')]);
  const masc = new CorpoBase(gm, gm.animations);
  const fem = new CorpoBase(gf, gm.animations);
  const pose = (P.get('pose') ?? 'parado') as NomeClipe;
  const t = Number(P.get('t') ?? 0.4);
  const item = P.get('item') as NomeAderecos | null;
  const nomes = (P.get('quem') ?? Object.keys(aparencias).join(',')).split(',');
  const humanos: Humano[] = [];
  nomes.forEach((n, i) => {
    const ap = aparencias[n];
    if (!ap) return;
    const h = new Humano(ap.corpo === 'fem' ? fem : masc, ap);
    h.raiz.position.x = (i - (nomes.length - 1) / 2) * 1.2;
    h.raiz.rotation.y = Number(P.get('giro') ?? 0);
    if (P.get('orar')) h.oracao = 1;
    if (item) h.segurar(item, (P.get('mao') as any) ?? 'direita');
    if (pose in CLIPES) h.animador.atividade = pose;
    cena.add(h.raiz);
    humanos.push(h);
  });
  for (const h of humanos) {
    h.animador.atualizar(0);
    for (let k = 0; k < 10; k++) h.atualizar(t / 10);
  }
  const cam = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 200);
  const dist = Number(P.get('dist') ?? 4 + nomes.length * 0.9);
  const alt = Number(P.get('alt') ?? 1.1);
  cam.position.set(Number(P.get('cx') ?? 0), alt + 0.3, dist);
  cam.lookAt(Number(P.get('cx') ?? 0), alt, 0);
  r.render(cena, cam);
  (window as any).humanos = humanos;
  (window as any).pronto = true;
}

// depuração: direção mundial do braço esquerdo depois da pose
(window as any).dirBraco = (h: any) => {
  const a = h.posicaoOsso('upperarm_l');
  const b = h.posicaoOsso('lowerarm_l');
  const c = h.posicaoOsso('hand_l');
  return [b.clone().sub(a).normalize().toArray().map((v: number) => +v.toFixed(2)), c.clone().sub(b).normalize().toArray().map((v: number) => +v.toFixed(2))];
};
