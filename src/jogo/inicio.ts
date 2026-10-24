import { Jogo } from './Jogo';
import { MundoNoe } from '../eras/noe/construir';
import { NOE } from '../eras/noe/mapa';
import { APARENCIAS_NOE } from '../eras/noe/aparencias';
import type { DefPersonagem } from './Personagem';

/** Ponto de entrada provisório: carrega o vale de Noé e entrega o controle a Noé. */
export async function iniciarJogo(canvas: HTMLCanvasElement, _ui: HTMLDivElement) {
  const P = new URLSearchParams(location.search);
  const jogo = new Jogo(canvas, (P.get('q') as any) ?? 'medio');
  (window as any).jogo = jogo;
  await jogo.carregarBase();
  const vale = new MundoNoe(jogo.natureza);
  jogo.definirMundo(vale.mundo);
  if (P.get('arca')) vale.arca.definirEstagio(Number(P.get('arca')) as any);
  const def: DefPersonagem = { id: 'noe', nome: 'Noé', classe: 'construtor', aparencia: APARENCIAS_NOE.noe, jogavel: true, protagonista: true };
  const defCam: DefPersonagem = { id: 'cam', nome: 'Cam', classe: 'guerreiro', aparencia: APARENCIAS_NOE.cam, jogavel: true };
  const [px, pz] = P.get('pos') ? (P.get('pos')!.split(',').map(Number) as [number, number]) : [NOE.casa[0] - 4, NOE.casa[1] + 8];
  const noe = jogo.criarPersonagem(def, px, pz, Math.PI);
  jogo.criarPersonagem(defCam, px + 2, pz + 1, Math.PI);
  jogo.controlar(noe);
  jogo.cam.encaixar(noe.posicao, noe.yaw);
  if (P.get('yaw')) jogo.cam.yaw = Number(P.get('yaw'));
  if (P.get('pitch')) jogo.cam.pitch = Number(P.get('pitch'));
  if (P.get('dist')) jogo.cam.distanciaAlvo = jogo.cam.distancia = Number(P.get('dist'));
  if (P.get('hora')) jogo.ceu.hora = Number(P.get('hora'));
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
