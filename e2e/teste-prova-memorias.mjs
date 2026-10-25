// e2e da lista de memórias da prova de dúvida (B4, "Conta as estrelas"): com 13 memórias só as
// cinco da vez viram botão (teclas 1–5), as lembradas viram estrelas e o resto fica em "+N para
// depois"; a coluna cabe na tela, na lateral direita, sem cobrir o céu do centro nem os painéis.
// Uso: node e2e/teste-prova-memorias.mjs (com o `npm run dev` no ar; BASE muda o endereço)
import { abrir, BASE, pasta, verificador } from './utilidades.mjs';

const v = verificador();
const cruza = (a, b) => a.esq < b.dir && b.esq < a.dir && a.topo < b.base && b.topo < a.base;
const saida = pasta('e2e/saida/prova-memorias');
const telas = [
  [640, 360],
  [960, 540],
  [1920, 1080],
];
const casos = [
  { mems: 13, usadas: 0, depois: 8 },
  { mems: 13, usadas: 3, depois: 5 },
  { mems: 4, usadas: 1, depois: 0 },
  // as cinco da vez com os títulos mais longos (duas linhas na tela pequena)
  { mems: 14, usadas: 8, depois: 1 },
];

for (const [largura, altura] of telas) {
  for (const { mems, usadas, depois } of casos) {
    const { nav, pag, erros } = await abrir({ largura, altura });
    await pag.goto(`${BASE}/?lab=ui&tela=prova&tipo=duvida&mems=${mems}&usadas=${usadas}`);
    await pag.waitForFunction(() => window.pronto, null, { timeout: 180000 });
    const r = await pag.evaluate(() => {
      const caixa = (e) => {
        const b = e.getBoundingClientRect();
        return { esq: b.left, dir: b.right, topo: b.top, base: b.bottom };
      };
      const lista = document.querySelector('.prova-memorias');
      return {
        lista: caixa(lista),
        rolagem: lista.scrollHeight - lista.clientHeight,
        teclas: [...lista.querySelectorAll('.prova-memoria .tecla')].map((t) => t.textContent),
        estrelas: lista.querySelectorAll('.prova-memorias-acesas .prova-memoria-acesa').length,
        depois: lista.querySelector('.prova-memorias-depois')?.textContent ?? '',
        paineis: ['.prova-topo', '.prova-acoes', '.prova-firmeza'].map((s) => caixa(document.querySelector(s))),
      };
    });
    const nome = `${largura}×${altura} ${mems} memórias, ${usadas} lembradas`;
    const livres = Math.min(5, mems - usadas);
    v(r.teclas.join(',') === Array.from({ length: livres }, (_, i) => i + 1).join(','), `${nome}: teclas ${r.teclas.join(',')}`);
    v(r.estrelas === usadas, `${nome}: ${r.estrelas} estrela(s) acesa(s)`);
    v(r.depois === (depois ? `+${depois} para depois` : ''), `${nome}: "${r.depois}"`);
    v(r.lista.topo >= 0 && r.lista.base <= altura && r.lista.dir <= largura, `${nome}: coluna dentro da tela (y ${r.lista.topo.toFixed(0)}..${r.lista.base.toFixed(0)})`);
    v(r.rolagem <= 1, `${nome}: nada cortado pelo teto da coluna (sobra ${r.rolagem}px)`);
    v(r.lista.esq >= largura * 0.62, `${nome}: fora do céu do centro (começa em x ${r.lista.esq.toFixed(0)} de ${largura})`);
    const nomes = ['topo', 'ações', 'firmeza'];
    const encosta = nomes.filter((_, i) => cruza(r.lista, r.paineis[i]));
    v(!encosta.length, `${nome}: não encosta nos painéis${encosta.length ? ` (encosta: ${encosta.join(', ')})` : ''}`);
    // a faixa de versículo, na prova, não cobre a lista
    const faixa = await pag.evaluate(async () => {
      const t = window.ui.servicos.versiculo('Hb 11:7');
      window.ui.bannerVersiculo({ ref: 'Hb 11:7', referenciaExtenso: t.extenso, bkj: t.texto, nvt: t.nvt, kjv: t.kjv });
      await new Promise((r) => setTimeout(r, 900));
      const caixa = (e) => {
        const b = e.getBoundingClientRect();
        return { esq: b.left, dir: b.right, topo: b.top, base: b.bottom };
      };
      return { faixa: caixa(document.querySelector('.faixa-versiculo')), lista: caixa(document.querySelector('.prova-memorias')) };
    });
    v(!cruza(faixa.faixa, faixa.lista), `${nome}: a faixa de versículo não cobre a lista (faixa x ${faixa.faixa.esq.toFixed(0)}..${faixa.faixa.dir.toFixed(0)}, y ..${faixa.faixa.base.toFixed(0)}; lista x ${faixa.lista.esq.toFixed(0)}.., y ${faixa.lista.topo.toFixed(0)}..)`);
    v(faixa.faixa.esq >= 0 && faixa.faixa.dir <= largura, `${nome}: a faixa cabe na tela`);
    v(erros.length === 0, `${nome}: sem erros no console`);
    await pag.screenshot({ path: `${saida}/${largura}x${altura}-${mems}m-${usadas}u.png`, timeout: 180000 });
    await nav.close();
  }
}

console.log(v.falhas() ? `${v.falhas()} falha(s)` : 'tudo certo');
process.exit(v.falhas() ? 1 : 0);
