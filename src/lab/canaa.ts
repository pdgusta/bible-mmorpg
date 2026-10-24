// Laboratório do mundo de Canaã (era de Abraão): carrega o mapa e posiciona a câmera por parâmetros.
// Exemplos:
//   ?lab=canaa&ponto=acampamentoBetel&yaw=2.4&pitch=0.25&dist=9&hora=18
//   ?lab=canaa&cam=-20,-60,40&alvo=moria&hora=10            (câmera livre: x,z,altura sobre o chão)
//   ?lab=canaa&ponto=acampamentoInimigo&inimigo=1&hora=22
// Estado: acamp=betel|manre|nenhum  tendas=0  altares=construido|aceso  inimigo=1  porteiras=1
//         corda=1  pedras=1  grupo=1  q=baixo|medio|alto
import * as THREE from 'three';
import { Jogo } from '../jogo/Jogo';
import type { Qualidade } from '../render/Renderizador';
import type { DefPersonagem } from '../jogo/Personagem';
import { APARENCIAS_ABRAAO } from '../eras/abraao/aparencias';
import { MundoCanaa, ALTARES, type EstadoAltar, type LugarAcampamento } from '../eras/abraao/construir';

export async function laboratorioCanaa(canvas: HTMLCanvasElement) {
  const P = new URLSearchParams(location.search);
  const num = (k: string) => (P.get(k) !== null ? Number(P.get(k)) : undefined);
  const jogo = new Jogo(canvas, (P.get('q') as Qualidade) ?? 'medio');
  (window as any).jogo = jogo;
  await jogo.carregarBase();
  const canaa = new MundoCanaa(jogo.natureza);
  canaa.ceu = jogo.ceu;
  (window as any).canaa = canaa;
  jogo.definirMundo(canaa.mundo);
  const m = canaa.mundo;

  // estado do mundo
  const acamp = P.get('acamp');
  if (acamp) canaa.definirAcampamento(acamp === 'nenhum' ? null : (acamp as LugarAcampamento));
  if (P.get('tendas') === '0') {
    canaa.montarTenda('tendaAbrao', false);
    canaa.montarTenda('tendaSara', false);
  }
  const alt = P.get('altares');
  if (alt) for (const a of ALTARES) canaa.definirAltar(a, alt as EstadoAltar);
  if (P.get('inimigo')) canaa.definirAcampamentoInimigo(true);
  if (P.get('porteiras')) {
    canaa.abrirPorteira('porteiraAbrao', true, true);
    canaa.abrirPorteira('porteiraLo', true, true);
  }
  if (P.get('corda')) canaa.amarrarCordaMoria(true);
  if (P.get('pedras')) canaa.revelarPedras(Number(P.get('pedras')));

  // onde ficar: ponto nomeado ou pos=x,z
  const lerXZ = (v: string): [number, number] => (m.pontos.has(v) ? m.ponto(v) : (v.split(',').map(Number) as [number, number]));
  const [px, pz] = P.get('ponto') ? m.ponto(P.get('ponto')!) : P.get('pos') ? lerXZ(P.get('pos')!) : m.ponto('acampamentoBetel');
  const yaw0 = num('yaw') ?? Math.PI;
  const def: DefPersonagem = { id: 'abraao', nome: 'Abrão', nomeAlternativo: { flag: 'nomeAbraao', nome: 'Abraão' }, classe: 'profeta', aparencia: APARENCIAS_ABRAAO.abraao, jogavel: true, protagonista: true };
  const abraao = jogo.criarPersonagem(def, px, pz, yaw0 - Math.PI);
  if (P.get('grupo')) {
    const outros: DefPersonagem[] = [
      { id: 'sara', nome: 'Sarai', classe: 'hospitaleiro', aparencia: APARENCIAS_ABRAAO.sara, jogavel: true },
      { id: 'lo', nome: 'Ló', classe: 'pastor', aparencia: APARENCIAS_ABRAAO.lo, jogavel: true },
      { id: 'eliezer', nome: 'Eliézer', classe: 'guerreiro', aparencia: APARENCIAS_ABRAAO.eliezer, jogavel: true },
    ];
    outros.forEach((d, i) => {
      const p = jogo.criarPersonagem(d, px + (i - 1) * 1.8, pz + 2.2, yaw0 - Math.PI);
      p.ia.esperar();
    });
    const troca = (jogo as any).troca;
    if (troca) troca.ordem = ['abraao', ...outros.map((d) => d.id)];
  }
  jogo.controlar(abraao);
  jogo.cam.encaixar(abraao.posicao, abraao.yaw);
  jogo.cam.yaw = yaw0;
  if (num('pitch') !== undefined) jogo.cam.pitch = num('pitch')!;
  if (num('dist') !== undefined) jogo.cam.distanciaAlvo = jogo.cam.distancia = num('dist')!;
  if (num('hora') !== undefined) {
    jogo.ceu.hora = num('hora')!;
    jogo.ceu.pausado = true;
  }

  // câmera livre: cam=x,z,altura  alvo=x,z,altura | nomeDoPonto
  if (P.get('cam')) {
    const [cx, cz, ch] = P.get('cam')!.split(',').map(Number);
    const camPos = new THREE.Vector3(cx, m.relevo.altura(cx, cz) + (ch ?? 2), cz);
    const a = P.get('alvo') ?? '';
    let alvo: THREE.Vector3;
    if (m.pontos.has(a)) alvo = m.ponto3(a, 1.5);
    else {
      const [ax, az, ah] = a.split(',').map(Number);
      alvo = new THREE.Vector3(ax, m.relevo.altura(ax, az) + (ah ?? 1.5), az);
    }
    jogo.cam.externo = true;
    jogo.cam.camera.position.copy(camPos);
    jogo.cam.camera.lookAt(alvo);
    if ('focoExterno' in jogo) (jogo as any).focoExterno = alvo.clone();
    if (!P.get('ponto') && !P.get('pos')) abraao.teleportar(alvo.x, m.chao(alvo.x, alvo.z), alvo.z, abraao.yaw);
  }

  /** Mede draw calls e triângulos de um quadro (inclui a passada de sombra). */
  (window as any).medir = () => {
    const gl = jogo.render.gl;
    gl.render(jogo.cena, jogo.cam.camera);
    return { calls: gl.info.render.calls, triangulos: gl.info.render.triangles, programas: gl.info.programs?.length ?? 0 };
  };

  jogo.iniciar();
  let n = 0;
  const off = jogo.aCadaQuadro(() => {
    if (++n === 30) {
      (window as any).pronto = true;
      off();
    }
  });
}
