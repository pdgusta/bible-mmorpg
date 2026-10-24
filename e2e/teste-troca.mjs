// Teste automático da troca de personagem, postos, escalada e comandos (Playwright headless).
// Uso: node e2e/teste-troca.mjs [pastaFotos] [--era]
//  - sem --era: troca Noé → Cam (posto no guincho) → Jafé (anda e escala) e verifica que quem
//    ficou para trás continuou parado / no posto;
//  - com --era: roda a transição entre eras para um segundo vale e tira 3 fotos.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }

const args = process.argv.slice(2);
const era = args.includes('--era');
const pasta = args.find((a) => !a.startsWith('--')) ?? null;
if (pasta) mkdirSync(pasta, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:5173';
const W = 640;
const H = 360;

const nav = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pag = await nav.newPage({ viewport: { width: W, height: H } });
// sem HMR: outros editores salvando arquivos não recarregam a página no meio do teste
await pag.routeWebSocket(/./, () => {});
const erros = [];
pag.on('pageerror', (e) => { erros.push(e.message); console.log('pageerror:', e.message); });
pag.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });

let falhas = 0;
function verificar(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FALHOU'} ${msg}`);
  if (!cond) falhas++;
}
async function foto(nome) {
  if (!pasta) return;
  // dois quadros do laço (em modo manual ele só renderiza)
  await pag.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await pag.screenshot({ path: `${pasta}/${nome}.png` });
  console.log(`foto: ${pasta}/${nome}.png`);
}
const av = (s) => pag.evaluate((s) => window.jogo.avancar(s), s);
const tecla = async (acao, segurar = 1 / 30) => {
  await pag.evaluate((a) => window.jogo.entrada.simular(a, true), acao);
  await av(segurar);
  await pag.evaluate((a) => window.jogo.entrada.simular(a, false), acao);
  await av(1 / 30);
};
const estado = () => pag.evaluate(() => {
  const j = window.jogo;
  const r = {};
  for (const p of j.mundo.personagens.values()) {
    r[p.id] = { x: p.posicao.x, y: p.posicao.y, z: p.posicao.z, posto: p.posto?.id ?? null, controlado: p.controlado, escalando: !!p.escalada, ordem: p.ia.ordem.tipo };
  }
  return { ativo: j.ativo?.id, emAndamento: j.troca.emAndamento, prompt: j.controle.prompt, p: r };
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

if (!era) {
  await pag.goto(`${base}/?q=baixo&teste=troca&hora=10`);
  await pag.waitForFunction(() => window.pronto, null, { timeout: 240000 });
  await pag.evaluate(() => { window.jogo.manual = true; });
  let e0 = await estado();
  verificar(e0.ativo === 'noe', 'começa com Noé');

  // 1) tecla 3 → Cam (troca aérea)
  await tecla('troca3');
  let e = await estado();
  verificar(e.emAndamento, 'troca em andamento após a tecla 3');
  await av(1.1);
  await foto('troca-ceu');
  await av(0.9);
  await foto('troca-descida');
  await av(1.0);
  e = await estado();
  verificar(e.ativo === 'cam' && !e.emAndamento, `controla Cam ao pousar (ativo=${e.ativo})`);
  verificar(!e.p.noe.controlado && e.p.noe.ordem === 'esperar', 'Noé voltou à IA (esperar)');
  verificar(dist(e.p.noe, e0.p.noe) < 0.3, `Noé ficou parado (${dist(e.p.noe, e0.p.noe).toFixed(2)} m)`);

  // 2) Cam entra no posto do guincho
  await pag.evaluate(() => { const c = window.jogo.personagem('cam'); c.teleportar(31, c.posicao.y, 35.2, Math.PI); });
  await av(0.2);
  e = await estado();
  verificar(e.prompt?.texto === 'Segurar o guincho' && e.prompt.pode, `prompt do guincho (${JSON.stringify(e.prompt)})`);
  await tecla('interagir');
  await av(0.3);
  e = await estado();
  verificar(e.p.cam.posto === 'teste_guincho', 'Cam entrou no posto');
  verificar(e.prompt?.texto === 'Soltar', 'prompt "Soltar" no posto');
  const camNoPosto = e.p.cam;

  // 3) troca para Jafé pela API; Cam continua segurando
  const promessa = pag.evaluate(() => window.jogo.troca.trocarPara('jafe').then(() => 'pousou'));
  await av(2.8);
  verificar((await promessa) === 'pousou', 'trocarPara resolve ao pousar');
  e = await estado();
  verificar(e.ativo === 'jafe', 'controla Jafé');
  verificar(e.p.cam.posto === 'teste_guincho' && dist(e.p.cam, camNoPosto) < 0.05, 'Cam continua no posto depois da troca');

  // 4) Jafé anda; os outros não
  const antes = e;
  await tecla('frente', 1.0);
  e = await estado();
  verificar(dist(e.p.jafe, antes.p.jafe) > 1.5, `Jafé andou (${dist(e.p.jafe, antes.p.jafe).toFixed(2)} m)`);
  verificar(dist(e.p.cam, antes.p.cam) < 0.05 && e.p.cam.posto === 'teste_guincho', 'Cam não se mexeu');
  verificar(dist(e.p.noe, antes.p.noe) < 0.05, 'Noé não se mexeu');

  // 5) escalada: Jafé sobe a parede de 4 m
  await pag.evaluate(() => { const j = window.jogo.personagem('jafe'); j.teleportar(14, j.posicao.y, 54.9, Math.PI); });
  await av(0.3);
  e = await estado();
  verificar(e.prompt?.texto === 'Escalar' && e.prompt.pode, `prompt "Escalar" (${JSON.stringify(e.prompt)})`);
  const yBase = e.p.jafe.y;
  await tecla('interagir');
  e = await estado();
  verificar(e.p.jafe.escalando, 'Jafé está escalando');
  await pag.evaluate(() => window.jogo.entrada.simular('frente', true));
  await av(1.2);
  await pag.evaluate(() => { const j = window.jogo; j.cam.yaw = 0.45; j.cam.pitch = 0.2; });
  await av(0.05);
  await foto('escalada');
  // continua subindo até sair no topo (e solta o W logo em seguida, para não cair da borda)
  for (let i = 0; i < 30 && (await estado()).p.jafe.escalando; i++) await av(0.2);
  await pag.evaluate(() => window.jogo.entrada.simular('frente', false));
  await av(0.5);
  e = await estado();
  verificar(!e.p.jafe.escalando && e.p.jafe.y > yBase + 3.5, `Jafé chegou ao topo (Δy=${(e.p.jafe.y - yBase).toFixed(2)} m)`);

  // 6) Noé não sabe escalar: dica
  await tecla('troca1');
  await av(3);
  e = await estado();
  verificar(e.ativo === 'noe', 'tecla 1 → Noé');
  await pag.evaluate(() => { const n = window.jogo.personagem('noe'); n.teleportar(14, n.posicao.y, 55.0, Math.PI); });
  await av(0.3);
  e = await estado();
  verificar(e.prompt && !e.prompt.pode && /Jafé pode escalar/.test(e.prompt.dica ?? ''), `dica para quem não pode (${e.prompt?.dica})`);

  // 7) bloqueio: diálogo impede a troca
  await pag.evaluate(() => window.jogo.eventos.emit('dialogo:inicio'));
  await tecla('troca2');
  e = await estado();
  verificar(!e.emAndamento && e.ativo === 'noe', 'não troca durante diálogo');
  await pag.evaluate(() => window.jogo.eventos.emit('dialogo:fim'));

  // 8) F: Noé chama Sem? (longe) → ninguém; chama Jafé de perto
  await pag.evaluate(() => { const n = window.jogo.personagem('noe'); const j = window.jogo.personagem('jafe'); n.teleportar(j.posicao.x + 1.5, j.posicao.y, j.posicao.z + 1, 0); });
  await av(0.2);
  await tecla('comando');
  e = await estado();
  verificar(e.p.jafe.ordem === 'seguir', 'F: Jafé segue Noé');
  await tecla('comando');
  e = await estado();
  verificar(e.p.jafe.ordem === 'esperar', 'F de novo: Jafé espera');

  // 9) Tab sem UI: soltar passa ao próximo disponível; depois volta a Cam e solta o guincho
  await tecla('roda', 0.2);
  await av(3);
  e = await estado();
  verificar(e.ativo === 'sem', `Tab (sem UI) → próximo: ${e.ativo}`);
  await tecla('troca3');
  await av(3);
  e = await estado();
  verificar(e.ativo === 'cam' && e.prompt?.texto === 'Soltar', 'de volta a Cam, no posto');
  await tecla('interagir');
  e = await estado();
  verificar(e.p.cam.posto === null, 'E solta o guincho');

  // 10) cinemática: vai e volta; durante ela não se troca
  const cin = pag.evaluate(() => {
    const j = window.jogo;
    const p = j.ativo.posicao;
    return j.cinematica.para([p.x + 12, p.y + 6, p.z + 12], [p.x, p.y + 1, p.z], 1).then(() => 'chegou');
  });
  await av(0.5);
  verificar(await pag.evaluate(() => window.jogo.cinematica.ativa && !window.jogo.podeTrocar), 'cinemática ativa bloqueia a troca');
  await av(0.7);
  verificar((await cin) === 'chegou', 'cinematica.para resolve');
  const volta = pag.evaluate(() => window.jogo.cinematica.voltar(0.8).then(() => 'voltou'));
  await av(1.0);
  verificar((await volta) === 'voltou' && (await pag.evaluate(() => !window.jogo.cam.externo && window.jogo.podeTrocar)), 'cinematica.voltar devolve a câmera');
} else {
  await pag.goto(`${base}/?q=baixo&teste=era&hora=9&pos=30,60`);
  await pag.waitForFunction(() => window.pronto, null, { timeout: 240000 });
  await pag.evaluate(() => {
    window.jogo.manual = true;
    window.nomes = [];
    window.fimEra = false;
    window.jogo.eventos.on('era:transicao', (d) => (window.eraEvento = d));
    window.testeEra().then(() => (window.fimEra = true), (e) => (window.erroEra = String(e)));
  });
  await av(5.6);
  await foto('era-1-close-dourado');
  // espera o novo mundo ser construído e os nomes passarem
  for (let i = 0; i < 60; i++) {
    const ok = await pag.evaluate(() => window.jogo.mundo?.personagens.has('abraao'));
    if (ok) break;
    await av(0.5);
  }
  await av(0.6);
  await av(1.6);
  await foto('era-2-revelacao');
  for (let i = 0; i < 40 && !(await pag.evaluate(() => window.fimEra || window.erroEra)); i++) await av(0.5);
  await av(0.5);
  await foto('era-3-novo-mundo');
  const r = await pag.evaluate(() => ({ fim: window.fimEra, erro: window.erroEra ?? null, ativo: window.jogo.ativo?.id, ev: window.eraEvento, ext: window.jogo.cam.externo, trans: window.jogo.transicao }));
  verificar(r.fim && !r.erro, `transição terminou (${r.erro ?? 'sem erro'})`);
  verificar(r.ativo === 'abraao', `controla o novo protagonista (${r.ativo})`);
  verificar(!r.ext && !r.trans, 'câmera e controle devolvidos');
  verificar(r.ev?.para === 'abraao', 'evento era:transicao');
}

verificar(erros.length === 0, `sem erros na página (${erros.length})`);
await nav.close();
console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntodas as verificações passaram');
process.exit(falhas ? 1 : 0);
