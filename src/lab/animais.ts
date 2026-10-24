// Laboratório de animais: todas as espécies lado a lado, um rebanho com pastor, uma ovelha
// agitada, a pomba pousando na mão de Noé e o carneiro preso no arbusto.
// Acesse com ?lab=animais&vista=todos|grandes|pequenos|rebanho|aves|carneiro&t=4&rotulos=1&andar=0.8
import * as THREE from 'three';
import { Ativos } from '../render/Ativos';
import { Relevo } from '../mundo/Relevo';
import { Colisoes } from '../mundo/Colisao';
import { MundoFisico } from '../mundo/Fisica';
import { Animal, criarAnimal, type Especie, type MundoAnimais } from '../entidades/Animal';
import { Rebanho } from '../entidades/Rebanho';
import { poseVazia } from '../entidades/animais/Marcha';
import { Audio } from '../audio/Audio';

interface Exposto {
  animal: Animal;
  rotulo: string;
}

export async function labAnimais(canvas: HTMLCanvasElement) {
  const P = new URLSearchParams(location.search);
  const vista = P.get('vista') ?? 'todos';
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
  r.setSize(window.innerWidth, window.innerHeight);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#cfe2ec');
  cena.fog = new THREE.Fog('#cfe2ec', 60, 160);
  cena.add(new THREE.HemisphereLight('#e2eef8', '#8a7a58', 1.25));
  const sol = new THREE.DirectionalLight('#fff0d8', 2.5);
  sol.position.set(14, 24, 18);
  sol.castShadow = true;
  sol.shadow.normalBias = 0.03;
  sol.shadow.bias = -0.0004;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.far = 80;
  cena.add(sol, sol.target);

  // chão plano com leve ondulação de cor
  const relevo = new Relevo(200, 1, () => 0);
  const mundo: MundoAnimais = { fisica: new MundoFisico(relevo, new Colisoes()), grupo: cena, atualizaveis: new Set() };
  const chao = new THREE.Mesh(new THREE.CircleGeometry(120, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#a3b46c' }));
  chao.receiveShadow = true;
  cena.add(chao);

  const ativos = new Ativos();
  const expostos: Exposto[] = [];
  const andar = Number(P.get('andar') ?? 0);
  const exibir = async (e: Especie, x: number, z: number, sexo: 'macho' | 'femea' = 'macho', rotulo?: string, yaw = 0.5) => {
    const a = await criarAnimal(e, mundo, x, z, { ativos, sexo, yaw, registrar: false, semente: expostos.length * 13 + 1 });
    cena.add(a.raiz);
    expostos.push({ animal: a, rotulo: rotulo ?? a.info.nome + (sexo === 'femea' ? ' ♀' : '') });
    return a;
  };

  // fileira de trás: grandes; fileira da frente: pequenos
  const grandes: [Especie, 'macho' | 'femea'][] = [
    ['elefante', 'macho'], ['girafa', 'macho'], ['camelo', 'macho'], ['camelo', 'femea'], ['cavalo', 'macho'], ['boi', 'macho'],
    ['vaca', 'femea'], ['zebra', 'macho'], ['lhama', 'macho'], ['urso', 'macho'], ['leao', 'macho'], ['leao', 'femea'],
    ['cervo', 'macho'], ['cervo', 'femea'], ['jumento', 'macho'], ['avestruz', 'macho'],
  ];
  const pequenos: [Especie, 'macho' | 'femea'][] = [
    ['carneiro', 'macho'], ['carneiro', 'femea'], ['ovelha', 'femea'], ['cabra', 'macho'], ['cabra', 'femea'], ['porco', 'macho'],
    ['cao', 'macho'], ['lobo', 'macho'], ['gato', 'macho'], ['pato', 'macho'], ['pato', 'femea'], ['pomba', 'macho'],
    ['corvo', 'macho'], ['aguia', 'macho'],
  ];
  const larg = (e: Especie) => (e === 'elefante' ? 3.4 : e === 'girafa' ? 2.0 : larguraExibicao(e));
  // ?so=especie: só o par dessa espécie, em retrato
  const so = P.get('so') as Especie | null;
  if (so) {
    grandes.length = 0;
    pequenos.length = 0;
    grandes.push([so, 'macho'], [so, 'femea']);
  }
  let x = -((grandes.reduce((s, [e]) => s + larg(e), 0)) / 2);
  for (const [e, s] of grandes) {
    const w = larg(e);
    await exibir(e, x + w / 2, -4, s);
    x += w;
  }
  x = -((pequenos.reduce((s, [e]) => s + larg(e) * 0.55, 0)) / 2);
  for (const [e, s] of pequenos) {
    const w = larg(e) * 0.55;
    await exibir(e, x + w / 2, 0.5, s);
    x += w;
  }

  // rebanho de 8 (4 claras de Abrão, 4 escuras de Ló) com o pastor, à direita
  const cx = 26;
  const cz = 2;
  const ovelhas: Animal[] = [];
  for (let i = 0; i < 8; i++) {
    const a = await criarAnimal('ovelha', mundo, cx + (i % 4) * 1.3 - 2, cz + Math.floor(i / 4) * 1.4 - 0.7, {
      ativos, semente: 100 + i, tom: i < 4 ? undefined : '#7d6a5a', tag: i < 4 ? 'abrao' : 'lo', sexo: i % 3 ? 'femea' : 'macho',
    });
    ovelhas.push(a);
  }
  const rebanho = new Rebanho(ovelhas);
  mundo.atualizaveis!.add(rebanho);
  const pastor = new THREE.Vector3(cx - 7, 0, cz + 3);
  rebanho.pastor = pastor;
  // figura do pastor: Ló com cajado (ou um marcador simples)
  const figuraPastor = await criarPastor(ativos);
  cena.add(figuraPastor.raiz);
  // ovelha agitada
  const agitada = await criarAnimal('ovelha', mundo, cx + 4, cz - 7, { ativos, semente: 300, sexo: 'femea' });
  agitada.agitar({ raio: 2.5 });
  expostos.push({ animal: agitada, rotulo: 'agitada' });

  // aves: Noé com a mão estendida, a pomba pousa; o corvo vai e volta
  const ax = -26;
  const az = 3;
  const noe = await criarNoe(ativos);
  if (noe) {
    noe.raiz.position.set(ax, 0, az);
    noe.raiz.rotation.y = 0.6;
    cena.add(noe.raiz);
  }
  const mao = () => (noe ? noe.mao() : new THREE.Vector3(ax, 1.3, az));
  const pombaVoo = await criarAnimal('pomba', mundo, ax + 6, az - 6, { ativos, semente: 400 });
  const corvoVoo = await criarAnimal('corvo', mundo, ax - 4, az - 3, { ativos, semente: 401 });
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2, 6), new THREE.MeshLambertMaterial({ color: '#8a6040' }));
  poste.position.set(ax + 5, 1, az - 5);
  poste.castShadow = true;
  cena.add(poste);
  (async () => {
    await pombaVoo.voarPara(new THREE.Vector3(ax + 5, 2.0, az - 5));
    for (;;) {
      await pombaVoo.voarPara(mao, { altura: 3 });
      await esperarSim(3);
      await pombaVoo.voarPara(new THREE.Vector3(ax + 5, 2.0, az - 5), { altura: 2 });
      await esperarSim(2);
    }
  })();
  corvoVoo.voarPor([
    new THREE.Vector3(ax - 6, 5, az - 8), new THREE.Vector3(ax + 8, 7, az - 10), new THREE.Vector3(ax + 10, 6, az + 6),
    new THREE.Vector3(ax - 8, 5, az + 6),
  ], { pousar: false, velocidade: 6 });

  // carneiro preso no arbusto (Gn 22:13)
  const kx = 14;
  const kz = 12;
  const carneiro = await criarAnimal('carneiro', mundo, kx, kz, { ativos, yaw: -0.4, semente: 500 });
  carneiro.prender();
  cena.add(arbusto(kx - 0.55, kz + 1.05, 0.8));

  // pastor anda num vaivém atrás do rebanho
  let tSim = 0;
  const esperas: { t: number; r: () => void }[] = [];
  function esperarSim(s: number) {
    return new Promise<void>((res) => esperas.push({ t: tSim + s, r: res }));
  }
  const pose = poseVazia();
  const passo = (dt: number) => {
    tSim += dt;
    for (let i = esperas.length - 1; i >= 0; i--) if (esperas[i].t <= tSim) esperas.splice(i, 1)[0].r();
    // pastor: circula em volta do bando empurrando-o devagar
    const ang = tSim * 0.25;
    const c = rebanho.centro();
    pastor.set(c.x - Math.cos(ang) * 5, 0, c.z - Math.sin(ang) * 5);
    figuraPastor.colocar(pastor, Math.atan2(c.x - pastor.x, c.z - pastor.z), dt);
    for (const u of mundo.atualizaveis!) u.atualizar(dt, tSim);
    noe?.atualizar(dt);
    pose.t = tSim;
    pose.vel = andar;
    for (const ex of expostos) if (ex.animal !== agitada) ex.animal.corpo.atualizar(dt, pose);
  };

  // câmera por vista
  const cam = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 300);
  const vistas: Record<string, [V, V]> = {
    todos: [[0, 14, 30], [0, 0.6, -1.5]],
    grandes: [[-9, 4.5, 11], [-9, 1.2, -4]],
    grandes2: [[9, 4.5, 11], [9, 1.2, -4]],
    pequenos: [[0, 2.6, 8.5], [0, 0.4, 0.5]],
    rebanho: [[cx - 2, 9, cz + 14], [cx, 0.4, cz - 1]],
    aves: [[ax + 4, 3.2, az + 7], [ax + 1, 1.4, az - 1]],
    carneiro: [[kx + 2.6, 1.4, kz + 2.2], [kx - 0.15, 0.75, kz + 0.45]],
  };
  let [cp, ca] = vistas[vista] ?? vistas.todos;
  if (so) {
    const h = expostos[0].animal.info.altura;
    const ang = Number(P.get('ang') ?? 0.5);
    const d = Math.max(2.2, h * 3) * Number(P.get('zoom') ?? 1);
    ca = [0, h * 0.5, -4];
    cp = [Math.sin(ang) * d, h * 0.65 + d * 0.18, -4 + Math.cos(ang) * d];
  }
  // ?foco=especie: close de um animal exposto (ângulo ?ang=, distância relativa ?zoom=)
  const foco = P.get('foco');
  const alvoFoco = foco ? expostos.find((e) => e.animal.especie === foco && (!P.get('sexo') || e.animal.sexo === P.get('sexo'))) : null;
  if (alvoFoco) {
    const a = alvoFoco.animal;
    const h = a.info.altura * a.escala;
    const ang = a.yaw + Number(P.get('ang') ?? 0.7);
    const d = Math.max(1.2, h * 2.2) * Number(P.get('zoom') ?? 1);
    ca = [a.posicao.x, h * 0.55, a.posicao.z];
    cp = [a.posicao.x + Math.sin(ang) * d, h * 0.75 + d * 0.15, a.posicao.z + Math.cos(ang) * d];
  }
  cam.position.set(...cp);
  cam.lookAt(...ca);
  sol.target.position.set(ca[0], 0, ca[2]);
  sol.position.set(ca[0] + 14, 24, ca[2] + 18);

  // rótulos
  const camada = document.createElement('div');
  camada.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:600 11px Nunito,sans-serif;color:#3b2f22';
  document.body.appendChild(camada);
  const rotulos = P.get('rotulos') !== '0' ? expostos.map((e) => {
    const d = document.createElement('div');
    d.textContent = e.rotulo;
    d.style.cssText = 'position:absolute;transform:translate(-50%,-100%);background:#fff8ecd0;padding:1px 5px;border-radius:6px;white-space:nowrap';
    camada.appendChild(d);
    return d;
  }) : [];
  const _p = new THREE.Vector3();
  const desenhar = () => {
    r.render(cena, cam);
    expostos.forEach((e, i) => {
      if (!rotulos[i]) return;
      e.animal.topo(_p).project(cam);
      const vis = _p.z < 1 && Math.abs(_p.x) < 1.1 && Math.abs(_p.y) < 1.1;
      rotulos[i].style.display = vis ? 'block' : 'none';
      rotulos[i].style.left = `${((_p.x + 1) / 2) * window.innerWidth}px`;
      rotulos[i].style.top = `${((1 - _p.y) / 2) * window.innerHeight}px`;
    });
  };

  // simulação antes da foto
  const T = Number(P.get('t') ?? 4);
  for (let k = 0; k < T * 30; k++) passo(1 / 30);
  Animal.camera = cam;
  desenhar();
  // informações para depuração/teste
  const info = {
    triangulos: Object.fromEntries(expostos.map((e) => [e.rotulo, triangulos(e.animal)])),
    rebanho: { centro: rebanho.centro().toArray().map((v) => +v.toFixed(2)), espalhamento: +rebanho.espalhamento().toFixed(2), claras: rebanho.dentroDe((_x, _z) => true, (a) => a.tag === 'abrao') },
    pomba: pombaVoo.estado,
    agitada: agitada.estado,
  };
  (window as any).infoAnimais = info;
  (window as any).animais = { expostos, rebanho, pombaVoo, corvoVoo, carneiro, agitada, Animal };
  (window as any).pronto = true;

  // áudio: só com gesto (clique) — testa o contexto
  const testarAudio = async () => {
    await Audio.iniciar();
    Audio.ambiente('vale', 0.6);
    Audio.musica('calmo');
  };
  window.addEventListener('pointerdown', testarAudio, { once: true });

  let ultimo = performance.now();
  const laco = () => {
    const agora = performance.now();
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    passo(dt);
    Audio.posicaoOuvinte(cam.position, Math.atan2(ca[0] - cp[0], ca[2] - cp[2]));
    desenhar();
    requestAnimationFrame(laco);
  };
  if (P.get('parar') !== '1') requestAnimationFrame(laco);
}

type V = [number, number, number];

function larguraExibicao(e: Especie) {
  const m: Partial<Record<Especie, number>> = {
    camelo: 1.9, cavalo: 1.6, boi: 1.6, vaca: 1.6, zebra: 1.5, lhama: 1.3, urso: 1.7, leao: 1.6, cervo: 1.3, jumento: 1.4,
    avestruz: 1.5, carneiro: 1.4, ovelha: 1.4, cabra: 1.2, porco: 1.6, cao: 1.6, lobo: 2.0, gato: 1.0, pato: 0.9, pomba: 0.8, corvo: 1.0, aguia: 1.4,
  };
  return m[e] ?? 1.5;
}

function triangulos(a: Animal) {
  const g = a.corpo.malha.geometry;
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/** Arbusto baixo e espinhoso para o carneiro preso. */
function arbusto(x: number, z: number, escala = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#6f7d3c', flatShading: true });
  const galho = new THREE.MeshLambertMaterial({ color: '#6b4a2e' });
  const bolas: [number, number, number, number][] = [[0, 0.45, 0, 0.55], [0.45, 0.35, 0.1, 0.4], [-0.45, 0.35, 0.15, 0.42], [0.1, 0.75, 0.15, 0.35], [-0.2, 0.3, 0.45, 0.3]];
  for (const [bx, by, bz, br] of bolas) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(br, 0), mat);
    m.position.set(bx, by, bz);
    m.castShadow = true;
    g.add(m);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.8, 4), galho);
    m.position.set(Math.cos(a) * 0.35, 0.55, Math.sin(a) * 0.35 - 0.2);
    m.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9);
    g.add(m);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(escala);
  return g;
}

interface Figura {
  raiz: THREE.Object3D;
  colocar(p: THREE.Vector3, yaw: number, dt: number): void;
}

/** Ló com cajado (humano procedural); se falhar, um marcador simples. */
async function criarPastor(ativos: Ativos): Promise<Figura> {
  try {
    const [{ CorpoBase }, { Humano }, { APARENCIAS_ABRAAO }] = await Promise.all([
      import('../entidades/humano/CorpoBase'), import('../entidades/humano/Humano'), import('../eras/abraao/aparencias'),
    ]);
    const gm = await ativos.carregar('personagens/humano.glb');
    const h = new Humano(new CorpoBase(gm, gm.animations), APARENCIAS_ABRAAO.lo);
    h.segurar('cajado', 'direita');
    const ant = new THREE.Vector3();
    return {
      raiz: h.raiz,
      colocar(p, yaw, dt) {
        const v = ant.distanceTo(p) / Math.max(1e-3, dt);
        ant.copy(p);
        h.raiz.position.copy(p);
        h.raiz.rotation.y = yaw;
        h.animador.velocidade = Math.min(1.6, v);
        h.atualizar(dt);
      },
    };
  } catch (e) {
    console.warn('pastor simples', e);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.1, 2, 8), new THREE.MeshLambertMaterial({ color: '#7a5a3a' }));
    m.position.y = 0.8;
    const g = new THREE.Group();
    g.add(m);
    return { raiz: g, colocar: (p, yaw) => { g.position.copy(p); g.rotation.y = yaw; } };
  }
}

/** Noé com a mão estendida (para a pomba pousar). */
async function criarNoe(ativos: Ativos) {
  try {
    const [{ CorpoBase }, { Humano }, { APARENCIAS_NOE }] = await Promise.all([
      import('../entidades/humano/CorpoBase'), import('../entidades/humano/Humano'), import('../eras/noe/aparencias'),
    ]);
    const gm = await ativos.carregar('personagens/humano.glb');
    const h = new Humano(new CorpoBase(gm, gm.animations), APARENCIAS_NOE.noe);
    h.animador.atividade = 'estenderMao';
    const out = new THREE.Vector3();
    return {
      raiz: h.raiz,
      atualizar: (dt: number) => h.atualizar(dt),
      mao: () => h.posicaoOsso('hand_r', out).add(new THREE.Vector3(0, 0.06, 0)),
    };
  } catch (e) {
    console.warn('sem Noé', e);
    return null;
  }
}
