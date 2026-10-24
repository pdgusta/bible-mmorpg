import * as THREE from 'three';
import type { CorpoBase } from './CorpoBase';
import type { Mao } from './Humano';

export type NomeAderecos =
  | 'cajado' | 'machado' | 'martelo' | 'tocha' | 'lanterna' | 'escudo' | 'espada' | 'funda'
  | 'tronco' | 'feixe' | 'cesto' | 'jarro' | 'pomba' | 'corda' | 'balde' | 'saco' | 'pao' | 'fogo';

const mats = new Map<string, THREE.Material>();
function mat(cor: string, emissivo?: string): THREE.Material {
  const k = cor + (emissivo ?? '');
  let m = mats.get(k);
  if (!m) {
    m = emissivo
      ? new THREE.MeshBasicMaterial({ color: emissivo })
      : new THREE.MeshLambertMaterial({ color: cor });
    mats.set(k, m);
  }
  return m;
}

const MADEIRA = '#8a5a34';
const MADEIRA_CLARA = '#b98a5a';
const FERRO = '#7b8088';

function malha(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const me = new THREE.Mesh(g, m);
  me.position.set(x, y, z);
  me.rotation.set(rx, ry, rz);
  me.castShadow = true;
  return me;
}

/** Geometria do objeto em metros, com o ponto de pegada na origem e o cabo ao longo de +Y. */
function construir(nome: NomeAderecos): THREE.Group {
  const g = new THREE.Group();
  g.name = nome;
  switch (nome) {
    case 'cajado': {
      g.add(malha(new THREE.CylinderGeometry(0.022, 0.026, 1.75, 7), mat(MADEIRA), 0, -0.1, 0));
      g.add(malha(new THREE.TorusGeometry(0.07, 0.022, 6, 10, Math.PI * 1.2), mat(MADEIRA), 0.06, 0.8, 0, 0, 0, Math.PI * 0.1));
      break;
    }
    case 'machado': {
      g.add(malha(new THREE.CylinderGeometry(0.02, 0.024, 0.75, 7), mat(MADEIRA_CLARA), 0, 0.28, 0));
      const lam = new THREE.BoxGeometry(0.04, 0.14, 0.17);
      g.add(malha(lam, mat(FERRO), 0, 0.6, 0.07));
      break;
    }
    case 'martelo': {
      g.add(malha(new THREE.CylinderGeometry(0.016, 0.018, 0.36, 6), mat(MADEIRA_CLARA), 0, 0.12, 0));
      g.add(malha(new THREE.BoxGeometry(0.06, 0.06, 0.15), mat('#6d6a64'), 0, 0.3, 0));
      break;
    }
    case 'tocha': {
      g.add(malha(new THREE.CylinderGeometry(0.022, 0.03, 0.55, 6), mat(MADEIRA), 0, 0.15, 0));
      g.add(malha(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 6), mat('#3d2a1a'), 0, 0.43, 0));
      const chama = malha(new THREE.ConeGeometry(0.07, 0.22, 7), mat('#ff9a3c', '#ffb347'), 0, 0.58, 0);
      chama.name = 'chama';
      chama.castShadow = false;
      g.add(chama);
      break;
    }
    case 'fogo': {
      // vaso de brasas (Gn 22:6: "tomou o fogo em sua mão")
      g.add(malha(new THREE.CylinderGeometry(0.08, 0.06, 0.11, 8), mat('#7a4a2c'), 0, -0.02, 0));
      const brasa = malha(new THREE.ConeGeometry(0.06, 0.12, 7), mat('#ff8a3c', '#ffa040'), 0, 0.09, 0);
      brasa.name = 'chama';
      brasa.castShadow = false;
      g.add(brasa);
      break;
    }
    case 'lanterna': {
      g.add(malha(new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI), mat('#4a3a2a'), 0, 0.02, 0));
      g.add(malha(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 8), mat('#9a6a3a'), 0, -0.1, 0));
      const luz = malha(new THREE.SphereGeometry(0.045, 8, 6), mat('#ffd27a', '#ffd88a'), 0, -0.1, 0);
      luz.name = 'chama';
      luz.castShadow = false;
      g.add(luz);
      break;
    }
    case 'escudo': {
      g.add(malha(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16), mat('#8a6238'), 0, 0, 0, Math.PI / 2, 0, 0));
      g.add(malha(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10), mat(FERRO), 0, 0, 0.02, Math.PI / 2, 0, 0));
      g.add(malha(new THREE.TorusGeometry(0.31, 0.018, 5, 18), mat('#5c3e22'), 0, 0, 0.0));
      break;
    }
    case 'espada': {
      g.add(malha(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), mat('#4a3020'), 0, 0, 0));
      g.add(malha(new THREE.BoxGeometry(0.16, 0.025, 0.04), mat('#8a7a5a'), 0, 0.09, 0));
      g.add(malha(new THREE.BoxGeometry(0.05, 0.62, 0.012), mat('#b8bcc4'), 0, 0.41, 0));
      break;
    }
    case 'funda': {
      g.add(malha(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), mat('#c8b08a'), 0, -0.25, 0));
      g.add(malha(new THREE.SphereGeometry(0.035, 6, 5), mat('#8a6a4a'), 0, -0.5, 0));
      break;
    }
    case 'tronco': {
      const t = malha(new THREE.CylinderGeometry(0.12, 0.135, 1.5, 9), mat('#7a5a3a'), 0, 0, 0, 0, 0, Math.PI / 2);
      g.add(t);
      for (const s of [1, -1]) g.add(malha(new THREE.CircleGeometry(0.12, 9), mat('#d8b88a'), 0.751 * s, 0, 0, 0, (Math.PI / 2) * s, 0));
      break;
    }
    case 'feixe': {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(malha(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 6), mat(i % 2 ? MADEIRA : '#9a6a40'), Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07));
      }
      g.add(malha(new THREE.TorusGeometry(0.12, 0.012, 4, 12), mat('#c8b08a'), 0, 0.2, 0, Math.PI / 2, 0, 0));
      g.add(malha(new THREE.TorusGeometry(0.12, 0.012, 4, 12), mat('#c8b08a'), 0, -0.2, 0, Math.PI / 2, 0, 0));
      break;
    }
    case 'cesto': {
      g.add(malha(new THREE.CylinderGeometry(0.17, 0.12, 0.18, 10, 1, true), mat('#b88c4a'), 0, -0.14, 0));
      g.add(malha(new THREE.CircleGeometry(0.12, 10), mat('#9a7038'), 0, -0.23, 0, -Math.PI / 2, 0, 0));
      g.add(malha(new THREE.TorusGeometry(0.15, 0.012, 4, 12, Math.PI), mat('#8a6030'), 0, -0.05, 0));
      for (let i = 0; i < 5; i++) g.add(malha(new THREE.SphereGeometry(0.045, 6, 5), mat(i % 2 ? '#c84a3a' : '#e8a040'), Math.cos(i) * 0.08, -0.07, Math.sin(i) * 0.08));
      break;
    }
    case 'jarro': {
      const pts = [0, 0.06, 0.1, 0.11, 0.09, 0.05, 0.045, 0.06].map((r, i) => new THREE.Vector2(r, i * 0.045));
      g.add(malha(new THREE.LatheGeometry(pts, 10), mat('#c07848'), 0, -0.15, 0));
      break;
    }
    case 'pomba': {
      g.add(malha(new THREE.SphereGeometry(0.07, 8, 6), mat('#f4f2ee'), 0, 0.06, 0, 0, 0, 0));
      g.add(malha(new THREE.SphereGeometry(0.04, 8, 6), mat('#f8f6f2'), 0, 0.11, 0.06));
      g.add(malha(new THREE.ConeGeometry(0.012, 0.03, 5), mat('#e0a060'), 0, 0.105, 0.105, Math.PI / 2, 0, 0));
      break;
    }
    case 'corda': {
      g.add(malha(new THREE.TorusGeometry(0.16, 0.03, 6, 16), mat('#c8a878'), 0, 0, 0));
      break;
    }
    case 'balde': {
      g.add(malha(new THREE.CylinderGeometry(0.12, 0.1, 0.2, 10), mat('#5a3e28'), 0, -0.14, 0));
      g.add(malha(new THREE.CircleGeometry(0.11, 10), mat('#1c1612'), 0, -0.045, 0, -Math.PI / 2, 0, 0));
      g.add(malha(new THREE.TorusGeometry(0.11, 0.008, 4, 12, Math.PI), mat('#3a2a1a'), 0, -0.04, 0));
      break;
    }
    case 'saco': {
      const s = malha(new THREE.SphereGeometry(0.2, 10, 8), mat('#cdb48a'), 0, 0, 0);
      s.scale.set(1.1, 0.75, 0.9);
      g.add(s);
      break;
    }
    case 'pao': {
      const p = malha(new THREE.SphereGeometry(0.07, 8, 6), mat('#d8a060'), 0, 0, 0);
      p.scale.set(1, 0.45, 1);
      g.add(p);
      break;
    }
  }
  return g;
}

/**
 * Cria o objeto e diz onde ele fica no espaço de ligação (T-pose) do corpo base.
 * Na T-pose a mão direita aponta para -x com a palma para baixo; a esquerda, para +x.
 */
export function criarAderecos(nome: NomeAderecos, mao: Mao, base: CorpoBase) {
  const objeto = construir(nome);
  const lado = mao === 'esquerda' ? 1 : -1;
  const ossoMao = mao === 'esquerda' ? 'hand_l' : 'hand_r';
  const h = base.junta(ossoMao);
  const pegada = new THREE.Vector3(h.x + 0.075 * lado, h.y - 0.012, h.z + 0.01);
  let posicao = pegada;
  let rotacao = new THREE.Euler(Math.PI / 2, 0, 0); // cabo para a frente na T-pose
  let osso: string = ossoMao;

  switch (nome) {
    case 'escudo':
      posicao = new THREE.Vector3(h.x - 0.12 * lado, h.y - 0.02, h.z - 0.06);
      rotacao = new THREE.Euler(0, Math.PI / 2, 0);
      break;
    case 'lanterna':
    case 'cesto':
    case 'balde':
      rotacao = new THREE.Euler(0, 0, 0);
      posicao = pegada.clone().add(new THREE.Vector3(0, -0.03, 0));
      break;
    case 'funda':
      rotacao = new THREE.Euler(0, 0, 0);
      break;
    case 'pomba':
    case 'pao':
      rotacao = new THREE.Euler(Math.PI, 0, 0);
      posicao = pegada.clone().add(new THREE.Vector3(0, -0.06, 0));
      break;
    case 'tronco':
    case 'saco':
    case 'jarro': {
      osso = 'spine_03';
      const s = base.junta('spine_03');
      posicao = new THREE.Vector3(0, s.y + 0.02, s.z + 0.32);
      rotacao = new THREE.Euler(0, 0, 0);
      break;
    }
    case 'feixe':
    case 'corda': {
      osso = 'spine_03';
      const s = base.junta('spine_03');
      posicao = new THREE.Vector3(0.02, s.y + 0.02, s.z - 0.2);
      rotacao = new THREE.Euler(0.15, 0, nome === 'feixe' ? 0.5 : 0.2);
      break;
    }
  }
  if (mao === 'costas' && nome !== 'feixe' && nome !== 'corda') {
    osso = 'spine_03';
    const s = base.junta('spine_03');
    posicao = new THREE.Vector3(0.05, s.y, s.z - 0.17);
    rotacao = new THREE.Euler(0.1, 0, 0.6);
  }
  return { objeto, posicao, rotacao, osso };
}
