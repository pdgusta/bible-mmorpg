// Utilidades das ligações de era (sem dependências entre elas).
import type { Jogo } from '../Jogo';
import type { SistemasHistoria } from '../Missoes';
import type { EstadoMissao } from '../contratos';
import type { Personagem } from '../Personagem';
import type { Mundo } from '../../mundo/Mundo';

/** Estado da missão atual nos sistemas (ou null). Usado pelos atalhos. */
export function estadoMissaoAtual(s: SistemasHistoria): EstadoMissao | null {
  const id = s.missoes.missaoAtual;
  return id ? s.missoes.estado(id) ?? null : null;
}

/** Espera `segundos` de tempo de jogo (para junto com o jogo pausado). */
export function esperarJogo(jogo: Jogo, segundos: number): Promise<void> {
  return new Promise((r) => {
    let t = 0;
    const off = jogo.aCadaQuadro((dt) => {
      t += dt;
      if (t >= segundos - 1e-6) {
        off();
        r();
      }
    });
  });
}

/** Tira um personagem do mundo (some da cena, da troca e das rotinas). */
export function removerPersonagem(jogo: Jogo, m: Mundo, id: string) {
  const p = m.personagens.get(id);
  if (!p) return;
  if (p === jogo.ativo) return; // nunca some com quem o jogador controla
  if (p.posto) jogo.controle.liberarPosto(p);
  p.humano.raiz.removeFromParent();
  m.personagens.delete(id);
  p.dispose();
}

/** Desvio determinístico para quem começa no mesmo ponto (não nascer um dentro do outro). */
export function desvio(i: number): [number, number] {
  if (i === 0) return [0, 0];
  const a = i * 2.39996;
  const r = 1.4 + 0.5 * Math.sqrt(i);
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** Põe alguém de volta ao estado de começo de jogo (mãos vazias, fora de postos, rotina). */
export function reiniciarPessoa(jogo: Jogo, p: Personagem) {
  if (p.posto) jogo.controle.liberarPosto(p);
  if (p.escalada) p.sairEscalada('aqui');
  p.carregar(null);
  p.emCena = false;
  p.disponivel = true;
  p.humano.olharPara = null;
  p.humano.oracao = 0;
  p.humano.animador.atividade = null;
  p.ia.voltarARotina();
}
