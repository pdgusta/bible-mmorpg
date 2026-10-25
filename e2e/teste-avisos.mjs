// e2e da pilha de avisos: nenhum cartão encosta em outro nem na dica, com textos curtos e longos
// (que passam de duas linhas e agrupam ×n), em três tamanhos de tela. Os avisos são mandados depois
// de a página ficar pronta, pelo `window.ui` do lab: no SwiftShader a carga demora mais que a vida
// de um aviso. Uso: node e2e/teste-avisos.mjs (com o `npm run dev` no ar; BASE muda o endereço)
import { abrir, BASE, pasta, verificador } from './utilidades.mjs';

const DICA = 'Pressione **Tab** (segure) ou **2** para trocar de personagem. Cada um tem sua força.';
const CURTOS = [
  ['+60 XP — Cooperação', 'xp'],
  ['Perseverança +1 (Noé)', 'atributo'],
  ['Memória guardada: Achou graça', 'memoria'],
  ['Espada do Espírito — a Palavra', 'armadura'],
  ['Noé chegou ao nível 3', 'nivel'],
  ['Unidade +6', 'unidade'],
];
// o caso da revisão do T-012: memória e xp que passam de duas linhas a 640×360; o xp repetido agrupa
const LONGOS = [
  ['Memória guardada: Contigo estabelecerei o meu pacto', 'memoria'],
  ['+72 XP para Eliézer — Construir e restaurar (Unidade +20%)', 'xp'],
  ['+72 XP para Eliézer — Construir e restaurar (Unidade +20%)', 'xp'],
  ['Abraão chegou ao nível 4 e ganhou um ponto de atributo para distribuir', 'nivel'],
  ['Perseverança +1 (Abraão) — a fé que espera a promessa', 'atributo'],
];

const v = verificador();
const saida = pasta('e2e/saida/avisos');
const casos = [
  { nome: 'longos', avisos: LONGOS, largura: 640, altura: 360 },
  { nome: 'longos', avisos: LONGOS, largura: 960, altura: 540 },
  { nome: 'longos', avisos: LONGOS, largura: 1280, altura: 720 },
  { nome: 'curtos', avisos: CURTOS, largura: 640, altura: 360 },
  { nome: 'curtos', avisos: CURTOS, largura: 960, altura: 540 },
  { nome: 'curtos', avisos: CURTOS, largura: 1280, altura: 720 },
];

/** As caixas dos avisos que ocupam a pilha (os que estão saindo não contam) e a da dica. */
const medir = (pag) =>
  pag.evaluate(() => {
    const caixa = (e) => {
      const b = e.getBoundingClientRect();
      return { topo: b.top, base: b.bottom, altura: b.height, texto: e.textContent.slice(0, 24) };
    };
    return {
      avisos: [...document.querySelectorAll('.aviso:not(.saindo)')].map(caixa),
      dica: caixa(document.querySelector('.dica-tutorial')),
    };
  });

for (const { nome, avisos, largura, altura } of casos) {
  const { nav, pag, erros } = await abrir({ largura, altura });
  await pag.goto(`${BASE}/?lab=ui&tela=hud`);
  await pag.waitForFunction(() => window.pronto, null, { timeout: 180000 });
  // o lab do HUD manda os avisos dele: espera a pilha esvaziar
  await pag.waitForFunction(() => !document.querySelector('.aviso'), null, { timeout: 60000 });
  await pag.evaluate(({ dica, avisos }) => {
    window.ui.dica(dica);
    for (const [texto, tipo] of avisos) window.ui.aviso(texto, tipo);
  }, { dica: DICA, avisos });
  const rotulo = `${nome} ${largura}×${altura}`;
  // logo depois de postos e depois das transições de entrada (0,35 s)
  for (const espera of [50, 500]) {
    await pag.waitForTimeout(espera);
    const r = await medir(pag);
    const ultimo = r.avisos.at(-1);
    v(r.avisos.length >= 1, `${rotulo} +${espera}ms: ${r.avisos.map((a) => `${a.texto} (${a.altura.toFixed(0)}px)`).join(' | ')}`);
    v(r.avisos.every((a, i) => i === 0 || a.topo >= r.avisos[i - 1].base), `${rotulo} +${espera}ms: um abaixo do outro`);
    v(!ultimo || ultimo.base <= r.dica.topo, `${rotulo} +${espera}ms: pilha termina em ${ultimo?.base.toFixed(1)}, dica começa em ${r.dica.topo.toFixed(1)}`);
  }
  v(erros.length === 0, `${rotulo}: sem erros no console`);
  await pag.screenshot({ path: `${saida}/${nome}-${largura}x${altura}.png` });
  await nav.close();
}

console.log(v.falhas() ? `${v.falhas()} falha(s)` : 'tudo certo');
process.exit(v.falhas() ? 1 : 0);
