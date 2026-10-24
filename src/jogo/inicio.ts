import * as THREE from 'three';
import { Jogo } from './Jogo';
import { MundoNoe } from '../eras/noe/construir';
import { NOE } from '../eras/noe/mapa';
import { APARENCIAS_NOE } from '../eras/noe/aparencias';
import { APARENCIAS_ABRAAO } from '../eras/abraao/aparencias';
import { transicaoEra } from '../camera/TransicaoEra';
import type { DefPersonagem } from './Personagem';
import type { Mundo } from '../mundo/Mundo';

/** Genealogia de Sem a Abrão (Gn 11:10-26), com os nomes do jogo. */
export const GENEALOGIA_SEM_ABRAO = ['Sem', 'Arfaxade', 'Selá', 'Éber', 'Pelegue', 'Reú', 'Serugue', 'Naor', 'Terá', 'Abrão'];

/**
 * Entrada do jogo: tela de carregamento, título sobre o vale e o fluxo completo (Partida).
 * Com `?teste=troca|era`, abre o cenário de teste antigo (e2e/teste-troca.mjs).
 */
export async function iniciarJogo(canvas: HTMLCanvasElement, ui: HTMLDivElement) {
  const P = new URLSearchParams(location.search);
  if (P.get('teste')) return iniciarCenarioTeste(canvas);
  const { Partida } = await import('./Partida');
  await Partida.criar(canvas, ui);
}

/**
 * Cenário de teste (sem UI nem missões): o vale de Noé com Noé, Sem, Cam e Jafé e o controle
 * com Noé. Parâmetros:
 * - pos=x,z yaw pitch dist hora arca q: câmera/foto;
 * - teste=troca: um posto e uma escalada de teste perto de Cam e Jafé;
 * - teste=era: expõe window.testeEra() (transição para um segundo vale, com Abrão).
 */
async function iniciarCenarioTeste(canvas: HTMLCanvasElement) {
  const P = new URLSearchParams(location.search);
  const jogo = new Jogo(canvas, (P.get('q') as any) ?? 'medio');
  (window as any).jogo = jogo;
  await jogo.carregarBase();
  const vale = new MundoNoe(jogo.natureza);
  jogo.definirMundo(vale.mundo);
  if (P.get('arca')) vale.arca.definirEstagio(Number(P.get('arca')) as any);
  const defs: DefPersonagem[] = [
    { id: 'noe', nome: 'Noé', classe: 'construtor', aparencia: APARENCIAS_NOE.noe, jogavel: true, protagonista: true },
    { id: 'sem', nome: 'Sem', classe: 'sacerdote', aparencia: APARENCIAS_NOE.sem, jogavel: true },
    { id: 'cam', nome: 'Cam', classe: 'guerreiro', aparencia: APARENCIAS_NOE.cam, jogavel: true },
    { id: 'jafe', nome: 'Jafé', classe: 'batedor', aparencia: APARENCIAS_NOE.jafe, jogavel: true },
  ];
  const [px, pz] = P.get('pos') ? (P.get('pos')!.split(',').map(Number) as [number, number]) : [NOE.casa[0] - 4, NOE.casa[1] + 8];
  const noe = jogo.criarPersonagem(defs[0], px, pz, Math.PI);
  const teste = P.get('teste');
  if (teste === 'troca') {
    const sem = jogo.criarPersonagem(defs[1], 58, 90, 0);
    sem.atividade = 'cuidando dos animais';
    sem.humano.animador.atividade = 'colher';
    sem.ia.esperar();
    const cam = jogo.criarPersonagem(defs[2], 31, 36, Math.PI);
    cam.ia.esperar();
    const jafe = jogo.criarPersonagem(defs[3], 14, 57, Math.PI);
    jafe.ia.esperar();
    montarTesteTroca(jogo.mundo!);
  } else {
    jogo.criarPersonagem(defs[1], px - 2, pz + 1.5, Math.PI);
    jogo.criarPersonagem(defs[2], px + 2, pz + 1, Math.PI);
    jogo.criarPersonagem(defs[3], px + 4, pz + 2.5, Math.PI);
  }
  jogo.troca.ordem = defs.map((d) => d.id);
  jogo.controlar(noe);
  jogo.cam.encaixar(noe.posicao, noe.yaw);
  if (P.get('yaw')) jogo.cam.yaw = Number(P.get('yaw'));
  if (P.get('pitch')) jogo.cam.pitch = Number(P.get('pitch'));
  if (P.get('dist')) jogo.cam.distanciaAlvo = jogo.cam.distancia = Number(P.get('dist'));
  if (P.get('hora')) jogo.ceu.hora = Number(P.get('hora'));
  if (teste === 'era') {
    (window as any).testeEra = () =>
      transicaoEra(jogo, {
        de: jogo.ativo!,
        nomes: GENEALOGIA_SEM_ABRAO,
        eras: { de: 'noe', para: 'abraao' },
        hora: 16.5,
        criarMundo: async () => new MundoNoe(jogo.natureza).mundo,
        criarProtagonista: (m) => {
          const def: DefPersonagem = { id: 'abraao', nome: 'Abrão', classe: 'profeta', aparencia: APARENCIAS_ABRAAO.abraao, jogavel: true, protagonista: true };
          const [x, z] = m.ponto('casa');
          return jogo.criarPersonagem(def, x - 6, z + 10, Math.PI * 0.8);
        },
      });
  }
  jogo.iniciar();
  // espera alguns quadros para tudo assentar antes de sinalizar pronto (fotos automáticas)
  let n = 0;
  const off = jogo.aCadaQuadro(() => {
    if (++n === 30) {
      (window as any).pronto = true;
      off();
    }
  });
}

/** Cenário de teste da troca: um guincho (posto) perto de Cam e uma plataforma escalável perto de Jafé. */
function montarTesteTroca(m: Mundo) {
  // guincho de teste (posto)
  const gx = 31;
  const gz = 33.5;
  const gy = m.relevo.altura(gx, gz);
  const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), new THREE.MeshLambertMaterial({ color: '#8a6a44' }));
  roda.rotation.z = Math.PI / 2;
  roda.position.set(gx, gy + 0.9, gz);
  m.adicionar(roda, [{ tipo: 'caixa', x: gx, z: gz, hx: 0.3, hz: 0.5, y0: gy, y1: gy + 1.4, solido: true }]);
  m.interativos.adicionar({
    id: 'teste_guincho', pos: new THREE.Vector3(gx, gy + 0.9, gz), raio: 2.4, rotulo: 'Segurar o guincho', verbo: 'segurar', ativo: true,
    dica: 'Cam pode segurar o guincho',
    posto: { descricao: 'segurando o guincho', pos: new THREE.Vector3(gx, gy, gz + 1.1) },
    aoInteragir: () => {},
  });
  // plataforma de 4 m com escalada pela face sul (+z)
  const px = 14;
  const pz = 52;
  const h0 = m.relevo.altura(px, pz);
  const alt = 4;
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(4, alt + 1, 4), new THREE.MeshLambertMaterial({ color: '#a58a62' }));
  caixa.position.set(px, h0 + (alt - 1) / 2, pz);
  m.adicionar(caixa, [{ tipo: 'caixa', x: px, z: pz, hx: 2, hz: 2, y0: h0 - 1, y1: h0 + alt, solido: true, piso: true }]);
  const bz = pz + 2 + 0.42;
  m.escaladas.set('teste_parede', {
    id: 'teste_parede',
    base: new THREE.Vector3(px, m.relevo.altura(px, bz), bz),
    topo: new THREE.Vector3(px, h0 + alt, pz + 1.1),
    yaw: Math.PI,
    largura: 1.2,
    ativa: true,
  });
}
