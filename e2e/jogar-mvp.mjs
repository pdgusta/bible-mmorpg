// Joga o MVP inteiro (Playwright headless): título → Novo jogo → era 1 (Noé) pelos atalhos →
// transição → era 2 (Abraão) pelos atalhos → fim de B5 → resumo da jornada → créditos → título.
// Uso: npm run e2e  ou  node e2e/jogar-mvp.mjs [pastaFotos]   (padrão: e2e/saida/mvp)
// Ambiente: BASE (servidor), Q (preset, padrão medio), LARGURA × ALTURA (padrão 960 × 540).
// Para no primeiro erro de missão, de atalho ou de console (com uma foto "erro").
// Em cada momento-chave tira uma foto e mede jogo.render.gl.info.render (draw calls e
// triângulos, com a passada de sombra); no fim imprime a tabela e aponta o que passa do
// orçamento (150 draw calls, 600 mil triângulos).
// A lógica corre em modo manual (partida.dev.avancar); só as fotos renderizam.
import { abrir, pasta, verificador, segundos, BASE } from './utilidades.mjs';

const saida = pasta(process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'e2e/saida/mvp');
const Q = process.env.Q ?? 'medio';
const W = Number(process.env.LARGURA ?? 960);
const H = Number(process.env.ALTURA ?? 540);
const LIMITE_CALLS = 150;
const LIMITE_TRI = 600_000;
const v = verificador();
const t0 = Date.now();
const log = (msg) => console.log(`[${segundos(Date.now() - t0)} s] ${msg}`);

const { nav, pag, erros } = await abrir({ largura: W, altura: H });

/** Medidas de cada vista: {era, vista, missao, calls, triangulos, animais}. */
const medidas = [];
let numFoto = 0;

/** Animais vivos no mundo (Animal.todos; o Vite serve o mesmo módulo que o jogo usa). */
const animais = () => pag.evaluate(async () => (await import('/src/entidades/Animal.ts')).Animal.todos.size).catch(() => -1);

/**
 * Renderiza um quadro, lê as draw calls e os triângulos dele e salva a foto. `medir: false`
 * para telas só de interface (resumo e créditos sobre o preto). Devolve a medida (ou null).
 */
async function foto(nome, { medir = true, arquivo } = {}) {
  const info = await pag.evaluate(() => new Promise((r) => requestAnimationFrame(() => {
    const j = window.jogo;
    j.renderizar();
    const i = j.render.gl.info.render;
    const m = { calls: i.calls, triangulos: i.triangles };
    requestAnimationFrame(() => r(m));
  })));
  const arq = `${saida}/${arquivo ?? `${String(++numFoto).padStart(2, '0')}-${nome}`}.png`;
  await pag.screenshot({ path: arq, timeout: 180000 });
  if (!medir) {
    log(`foto: ${arq}`);
    return null;
  }
  const ctx = await pag.evaluate(() => ({ era: window.partida.eraId, missao: window.partida.s.missoes.missaoAtual }));
  const m = { era: ctx.era, vista: nome, missao: ctx.missao ?? '-', ...info, animais: await animais() };
  log(`foto: ${arq} · ${m.calls} draw calls · ${Math.round(m.triangulos / 1000)} mil triângulos · ${m.animais} animais`);
  return m;
}

async function fotoMedida(nome) {
  const m = await foto(nome);
  medidas.push(m);
  return m;
}

/** Erros de missão, de atalho e de console até aqui (para parar no primeiro). */
const errosAgora = async () => {
  const p = await pag.evaluate(() => ({ missao: [...window.partida.errosMissao], atalho: window.partida.dev.erro }));
  return [...p.missao.map((e) => `missão ${e}`), ...(p.atalho ? [`atalho: ${p.atalho}`] : []), ...erros];
};

async function encerrar(codigo) {
  imprimirTabela();
  await nav.close();
  log(codigo ? `${v.falhas()} falha(s)` : 'tudo ok');
  process.exit(codigo);
}

async function pararSeErro(onde) {
  const lista = await errosAgora();
  if (!lista.length) return;
  v(false, `erro em ${onde}: ${lista[0]}`);
  for (const e of lista.slice(1, 10)) console.log('  ', e);
  try {
    await foto('erro', { medir: false, arquivo: 'erro' });
  } catch { /* a página pode ter quebrado */ }
  await encerrar(1);
}

function imprimirTabela() {
  if (!medidas.length) return;
  const mil = (n) => `${Math.round(n / 1000)} mil`;
  console.log(`\nOrçamento no preset ${Q} (${W} × ${H}; as draw calls contam a passada de sombra):`);
  console.log('| Era | Vista | Missão | Draw calls | Triângulos | Animais | |');
  console.log('|---|---|---|---|---|---|---|');
  for (const m of medidas) {
    const acima = [m.calls > LIMITE_CALLS && `> ${LIMITE_CALLS} calls`, m.triangulos > LIMITE_TRI && `> ${mil(LIMITE_TRI)} triângulos`].filter(Boolean);
    console.log(`| ${m.era} | ${m.vista} | ${m.missao} | ${m.calls} | ${mil(m.triangulos)} | ${m.animais} | ${acima.length ? `ACIMA: ${acima.join(', ')}` : 'ok'} |`);
  }
  const acima = medidas.filter((m) => m.calls > LIMITE_CALLS || m.triangulos > LIMITE_TRI);
  console.log(acima.length ? `\n${acima.length} vista(s) acima do orçamento: ${acima.map((m) => m.vista).join(', ')}` : '\nTodas as vistas dentro do orçamento.');
}

// ------------------------------------------------------------------ carregamento e título
await pag.goto(`${BASE}/?q=${Q}`);
let ultimo = '';
const relogio = setInterval(async () => {
  try {
    const txt = await pag.evaluate(() => document.querySelector('.carregamento')?.textContent?.trim() ?? '');
    if (txt && txt !== ultimo) log(`carregando: ${(ultimo = txt).slice(0, 80)}`);
  } catch { /* página ocupada */ }
}, 5000);
await pag.waitForFunction(() => window.pronto, null, { timeout: 900000, polling: 2000 });
clearInterval(relogio);
log('pronto');
await pag.evaluate(() => {
  window.jogo.manual = true;
  window.jogo.renderizarManual = false;
});
const preset = await pag.evaluate(() => window.jogo.render.qualidade);
v(preset === Q, `preset ${preset}`);
v(await pag.evaluate(() => window.partida.modo === 'titulo'), 'começa no título');
await pag.evaluate(() => window.jogo.avancar(2));
await fotoMedida('titulo');
await pararSeErro('título');

// ------------------------------------------------------------------ preparo da página
// - o resumo da jornada ("Fim da jornada") fica fixo na tela até a foto;
// - os créditos não são fechados pela depuração antes da foto;
// - momentos de foto da era 2 (a depuração só tem os da era 1).
await pag.evaluate(() => {
  const p = window.partida;
  const ui = p.ui;
  window.mvp = { resumo: null, liberarResumo: null, fotoCreditos: false, genealogia: [] };
  const titulo = ui.titulo.bind(ui);
  ui.titulo = async (texto, sub) => {
    if (texto !== 'Fim da jornada') return titulo(texto, sub);
    ui.avisosC.tituloFixo(texto, sub);
    window.mvp.resumo = `${texto} · ${sub ?? ''}`;
    await new Promise((r) => (window.mvp.liberarResumo = r));
    ui.avisosC.tituloFixo(null);
    await new Promise((r) => setTimeout(r, 1100));
  };
  const passarFala = p.dev.passarFala.bind(p.dev);
  p.dev.passarFala = () => {
    if (ui.menusC.topo() === 'creditos' && !window.mvp.fotoCreditos) return;
    passarFala();
  };
  const gen = ui.genealogia.bind(ui);
  ui.genealogia = (n, i) => {
    window.mvp.genealogia.push(n === null ? null : `${i}:${n}`);
    return gen(n, i);
  };
});

// ------------------------------------------------------------------ novo jogo
await pag.getByRole('button', { name: 'Novo jogo' }).click();
v(await pag.waitForFunction(() => window.partida.modo === 'jogo', null, { timeout: 120000 }).then(() => true, () => false), 'Novo jogo entra no modo jogo');
// a missão inicial começa depois de um quadro: sem ela os atalhos não têm o que jogar
for (let i = 0; i < 50 && !(await pag.evaluate(() => window.partida.s.missoes.missaoAtual)); i++) await pag.evaluate(() => window.jogo.avancar(0.1));
v(await pag.evaluate(() => window.partida.s.missoes.missaoAtual === 'prologo'), 'prólogo começou');
await pararSeErro('Novo jogo');

/**
 * Momentos de foto além das capturas da depuração: [nome, condição na página, atraso em s de
 * jogo depois que a condição fica verdadeira]. A condição roda a cada 2 s de jogo (e não na
 * volta de uma captura, para não medir o mesmo quadro duas vezes).
 */
const MOMENTOS = [
  ['a4-animais', () => window.partida.dev.etapaAtual() === 'a4.animais', 0],
  ['b1-canaa', () => window.partida.dev.etapaAtual() === 'b1.altarMore', 1],
  ['b2-manre', () => window.partida.dev.etapaAtual() === 'b2.manre', 0],
  ['b3-ataque', () => window.partida.dev.etapaAtual() === 'b3.ataque', 2],
  ['b4-estrelas', () => window.partida.dev.etapaAtual() === 'b4.duvida', 0],
  ['b5-moria', () => window.partida.dev.etapaAtual() === 'b5.altar', 0],
];
const feitos = new Set();
const vistos = new Map();
// na A4 os animais vão chegando: a cada 5 animais a mais, mede de novo com a câmera virada
// para eles; a tabela fica com a medida de mais draw calls
let a4 = null;
let a4Animais = 0;

/** Joga a era atual pelos atalhos até eles acabarem; fotos nas capturas e nos momentos. */
async function jogarEra(eraId, limiteMin) {
  await pag.evaluate(() => window.partida.dev.jogar());
  const limite = Date.now() + limiteMin * 60 * 1000;
  let etapas = 0;
  for (;;) {
    if (Date.now() > limite) {
      v(false, `era ${eraId}: tempo esgotado (${limiteMin} min)`);
      await pararSeErro(`era ${eraId}`);
      await encerrar(1);
    }
    const r = await pag.evaluate(() => window.partida.dev.avancar(2, 0.1));
    const novas = await pag.evaluate((n) => window.partida.dev.etapas.slice(n), etapas);
    etapas += novas.length;
    for (const e of novas) log(`etapa: ${e}`);
    await pararSeErro(`era ${eraId}`);
    if (r.captura) {
      await fotoMedida(r.captura);
      await pag.evaluate(() => window.partida.dev.liberar());
    }
    const tempo = await pag.evaluate(() => window.jogo.tempo);
    for (const [nome, cond, atraso] of r.captura ? [] : MOMENTOS) {
      if (feitos.has(nome)) continue;
      if (!vistos.has(nome)) {
        if (await pag.evaluate(cond)) vistos.set(nome, tempo);
        else continue;
      }
      if (tempo - vistos.get(nome) < atraso) continue;
      feitos.add(nome);
      const m = await fotoMedida(nome);
      if (nome === 'a4-animais') {
        a4 = m;
        a4Animais = m.animais;
      }
    }
    if (a4 && (await pag.evaluate(() => window.partida.s.missoes.missaoAtual)) === 'a4') {
      const n = await animais();
      if (n >= a4Animais + 5) {
        a4Animais = n;
        // o pior caso: a câmera virada para o centro dos animais (e devolvida depois)
        const yaw = await pag.evaluate(async () => {
          const { Animal } = await import('/src/entidades/Animal.ts');
          const cam = window.jogo.cam;
          const antes = cam.yaw;
          let x = 0;
          let z = 0;
          for (const a of Animal.todos) {
            x += a.raiz.position.x;
            z += a.raiz.position.z;
          }
          const p = window.jogo.ativo.posicao;
          // a frente da câmera é (-sen yaw, -cos yaw)
          cam.yaw = Math.atan2(-(x / Animal.todos.size - p.x), -(z / Animal.todos.size - p.z));
          await window.jogo.avancar(0.1);
          return antes;
        });
        const m = await foto('a4-animais', { arquivo: `a4-animais-${n}` });
        if (m.calls > a4.calls || (m.calls === a4.calls && m.triangulos > a4.triangulos)) {
          Object.assign(a4, m, { vista: `a4-animais (pico; câmera para os animais; foto a4-animais-${n})` });
        }
        await pag.evaluate((y) => (window.jogo.cam.yaw = y), yaw);
      }
    }
    if (await pag.evaluate(() => !!window.mvp.resumo && !!window.mvp.liberarResumo)) {
      const resumo = await pag.evaluate(() => window.mvp.resumo);
      v(/Memórias: \d+ de \d+ · Segredos: \d+ · Tempo de jornada/.test(resumo), `resumo da jornada: "${resumo}"`);
      await pag.waitForTimeout(1300); // o título aparece com transição de 1,1 s
      await foto('resumo', { medir: false });
      await pag.evaluate(() => {
        window.mvp.liberarResumo();
        window.mvp.liberarResumo = null;
      });
    }
    if (await pag.evaluate(() => window.partida.ui.menusC.topo() === 'creditos' && !window.mvp.fotoCreditos)) {
      await pag.waitForTimeout(400);
      await foto('creditos', { medir: false });
      await pag.evaluate(() => (window.mvp.fotoCreditos = true));
    }
    if (r.fim) return;
  }
}

// ------------------------------------------------------------------ era 1
await pag.evaluate(() => window.partida.dev.ligarCapturas());
await jogarEra('noe', 60);
const transicao = await pag.evaluate(() => ({ era: window.partida.eraId, transicao: !!window.jogo.transicao, gen: window.mvp.genealogia }));
v(transicao.era === 'abraao' && !transicao.transicao, `era 1 terminou na transição para Canaã (era ${transicao.era})`);
const nomes = transicao.gen.filter((x) => x !== null);
v(nomes.length >= 2 && transicao.gen.at(-1) === null, `genealogia mostrada e limpa: ${nomes.join(', ')}`);
if (transicao.era !== 'abraao') await encerrar(1);

// B1 começa sozinha depois de A6 (a depuração parou ao fim da era 1: passa as falas aqui)
for (let i = 0; i < 300 && (await pag.evaluate(() => window.partida.s.missoes.missaoAtual)) !== 'b1'; i++) {
  await pag.evaluate(async () => {
    const ui = window.partida.ui;
    if (ui.dialogoAberto() && !ui.dialogoC.emEscolha()) ui.avancarDialogo();
    await window.jogo.avancar(0.1);
  });
}
v(await pag.evaluate(() => window.partida.s.missoes.missaoAtual === 'b1'), 'B1 começou');
await pararSeErro('início de B1');

// ------------------------------------------------------------------ era 2
await jogarEra('abraao', 60);
v(feitos.has('b5-moria'), 'chegou ao altar do Moriá (B5)');
v(await pag.evaluate(() => window.mvp.fotoCreditos && !!window.mvp.resumo), 'resumo da jornada e créditos na tela');

// depois dos créditos a Partida volta ao título (1,5 s de tempo real depois de B5)
const titulo = await pag.waitForFunction(() => window.partida.modo === 'titulo', null, { timeout: 30000 }).then(() => true, () => false);
v(titulo, 'depois dos créditos, volta ao título');
await pag.waitForTimeout(1500);
await pag.evaluate(() => window.jogo.avancar(1));
await foto('fim-titulo', { medir: false });
await pararSeErro('fim');

v(erros.length === 0, `sem erros no console (${erros.length})`);
await encerrar(v.falhas() ? 1 : 0);
