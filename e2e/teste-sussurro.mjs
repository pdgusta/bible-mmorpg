// e2e do sussurro das provas (os "dardos" de mentira): em qualquer ponto em que o jogo o ponha, o
// cartão não cobre o painel do personagem, o de firmeza, o topo da prova, as ações, a hora nem a
// lista de memórias. Uma grade de dardos (com o texto longo da B5) cobre a tela inteira, em
// tentação e em dúvida, a 640×360, 960×540 e 1920×1080.
// Uso: node e2e/teste-sussurro.mjs (com o `npm run dev` no ar; BASE muda o endereço)
import { abrir, BASE, pasta, verificador } from './utilidades.mjs';

const v = verificador();
const saida = pasta('e2e/saida/sussurro');
const telas = [
  [640, 360],
  [960, 540],
  [1920, 1080],
];
const PAINEIS = ['.hud-esquerda', '.hud-tempo', '.prova-topo', '.prova-firmeza', '.prova-acoes', '.prova-memorias'];

for (const [largura, altura] of telas) {
  for (const tipo of ['tentacao', 'duvida']) {
    const { nav, pag, erros } = await abrir({ largura, altura });
    await pag.goto(`${BASE}/?lab=ui&tela=hud`);
    await pag.waitForFunction(() => window.pronto, null, { timeout: 180000 });
    // o lab do HUD manda os avisos dele: espera a pilha esvaziar
    await pag.waitForFunction(() => !document.querySelector('.aviso'), null, { timeout: 60000 });
    await pag.evaluate((tipo) => {
      const ui = window.ui;
      const dardos = [];
      let id = 1;
      for (let gy = 0; gy <= 4; gy++) {
        for (let gx = 0; gx <= 4; gx++) {
          dardos.push({ id: id++, x: 0.05 + gx * 0.225, y: 0.05 + gy * 0.225, texto: 'Com isso você nunca mais precisará de ninguém.', bloqueado: false });
        }
      }
      let tecla = 1;
      const memorias = Array.from({ length: 13 }, (_, i) => (tecla <= 5 ? { id: `m${i}`, titulo: `Memória ${i + 1}`, usada: false, tecla: tecla++ } : { id: `m${i}`, titulo: `Memória ${i + 1}`, usada: false }));
      const v = ui.servicos.versiculo('Gn 14:23');
      const estado = tipo === 'duvida'
        ? { tipo, titulo: 'Conta as estrelas', instrucao: 'Lembre-se do que Deus já fez: cada memória acende estrelas.', progresso: 0.4, firmeza: 0.6, escudo: true, palavra: null, dardos, memorias }
        : { tipo, titulo: 'Nem um fio', instrucao: 'Os despojos brilham e o sussurro insiste. Responda com Q.', progresso: 0.4, firmeza: 0.6, escudo: false, palavra: { ref: 'Gn 14:23', texto: v.texto.split(',')[0], pronta: true }, dardos };
      // o jogo atualiza a prova a cada quadro
      window.__prova = setInterval(() => ui.prova(estado), 16);
    }, tipo);
    await pag.waitForTimeout(1500);
    const r = await pag.evaluate((PAINEIS) => {
      clearInterval(window.__prova);
      const caixa = (e) => {
        const b = e.getBoundingClientRect();
        return { esq: b.left, topo: b.top, dir: b.right, base: b.bottom };
      };
      const paineis = PAINEIS.map((s) => [s, document.querySelector(s)])
        .filter(([, e]) => e && !e.hidden && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
        .map(([s, e]) => ({ s, ...caixa(e) }))
        .filter((p) => p.dir > p.esq && p.base > p.topo);
      const dardos = [...document.querySelectorAll('.dardo')].map((e) => ({ texto: e.textContent, ...caixa(e) }));
      return { paineis, dardos };
    }, PAINEIS);
    const nome = `${tipo} ${largura}×${altura}`;
    const cruza = (a, b) => a.esq < b.dir && b.esq < a.dir && a.topo < b.base && b.topo < a.base;
    v(r.dardos.length === 25, `${nome}: 25 sussurros na tela`);
    v(r.paineis.length >= 4, `${nome}: painéis medidos: ${r.paineis.map((p) => p.s).join(' ')}`);
    const cobertos = new Set();
    let ruins = 0;
    for (const d of r.dardos) {
      const sob = r.paineis.filter((p) => cruza(d, p));
      if (sob.length) ruins++;
      for (const p of sob) cobertos.add(p.s);
    }
    v(ruins === 0, `${nome}: nenhum sussurro sobre painel${ruins ? ` (${ruins} sobre ${[...cobertos].join(', ')})` : ''}`);
    v(r.dardos.every((d) => d.esq >= 0 && d.topo >= 0 && d.dir <= largura && d.base <= altura), `${nome}: todos dentro da tela`);
    v(erros.length === 0, `${nome}: sem erros no console`);
    await pag.screenshot({ path: `${saida}/${tipo}-${largura}x${altura}.png`, timeout: 180000 });
    await nav.close();
  }
}

console.log(v.falhas() ? `${v.falhas()} falha(s)` : 'tudo certo');
process.exit(v.falhas() ? 1 : 0);
