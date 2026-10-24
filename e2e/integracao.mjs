// Teste do jogo integrado, do carregamento até A1 jogável (Playwright headless).
// Uso: node e2e/integracao.mjs [pastaFotos] [--transicao]   (padrão: e2e/saida/integracao)
// Confere: carregamento → título sobre o vale → Novo jogo → prólogo → A1 com Noé no controle,
// HUD, Diário (J), pausa (Esc), salvar num espaço pela pausa e carregar de volta.
// Com --transicao, joga o resto da era 1 pelos atalhos e confere A6, a transição para Canaã
// (genealogia na tela e limpa no fim) e B1 jogável com Abrão.
// A lógica corre em modo manual (partida.dev.avancar); só as fotos renderizam.
import { abrir, pasta, verificador, segundos } from './utilidades.mjs';

const args = process.argv.slice(2);
const comTransicao = args.includes('--transicao');
const saida = pasta(args.find((a) => !a.startsWith('--')) ?? 'e2e/saida/integracao');
const BASE = process.env.BASE ?? 'http://localhost:5173';
const W = Number(process.env.LARGURA ?? 640);
const H = Number(process.env.ALTURA ?? 360);
const v = verificador();
const t0 = Date.now();
const log = (msg) => console.log(`[${segundos(Date.now() - t0)} s] ${msg}`);

const { nav, pag, erros } = await abrir({ largura: W, altura: H });

/** Renderiza um quadro e salva a foto (o laço fica parado entre as fotos: SwiftShader é lento). */
async function foto(nome) {
  await pag.evaluate(() => new Promise((r) => requestAnimationFrame(() => {
    window.jogo.renderizar();
    requestAnimationFrame(() => r());
  })));
  const arq = `${saida}/${nome}.png`;
  await pag.screenshot({ path: arq, timeout: 120000 });
  log(`foto: ${arq}`);
}

/** Avança a lógica (passa as falas sozinho, salvo `manterFala`) até `cond` ou `max` s de jogo. */
async function ate(cond, max, { passo = 0.1, passarFala = true } = {}) {
  let t = 0;
  while (t < max) {
    if (await pag.evaluate(cond)) return true;
    if (passarFala) await pag.evaluate((p) => window.partida.dev.avancar(p, p), passo);
    else await pag.evaluate((p) => window.jogo.avancar(p), passo);
    t += passo;
  }
  return pag.evaluate(cond);
}

const tecla = async (acao) => {
  await pag.evaluate((a) => window.jogo.entrada.simular(a, true), acao);
  await pag.evaluate(() => window.jogo.avancar(1 / 30));
  await pag.evaluate((a) => window.jogo.entrada.simular(a, false), acao);
  await pag.evaluate(() => window.jogo.avancar(1 / 30));
};

// ------------------------------------------------------------------ carregamento e título
await pag.goto(`${BASE}/?q=baixo`);
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

const titulo = await pag.evaluate(() => ({
  modo: window.partida.modo,
  ativo: window.jogo.ativo?.id ?? null,
  externa: window.jogo.cam.externo,
  sobre3D: window.partida.ui.raiz.classList.contains('titulo-3d'),
  botoes: [...document.querySelectorAll('.menus button')].map((b) => b.textContent.trim()),
}));
v(titulo.modo === 'titulo', `modo título (${titulo.modo})`);
v(titulo.sobre3D && titulo.externa, 'título sobre o vale 3D, câmera em órbita');
v(titulo.ativo === null, 'ninguém sob controle no título');
v(titulo.botoes.includes('Novo jogo'), `menu do título: ${titulo.botoes.join(', ')}`);
await pag.evaluate(() => window.jogo.avancar(2));
await foto('1-titulo');

// ------------------------------------------------------------------ novo jogo e prólogo
await pag.getByRole('button', { name: 'Novo jogo' }).click();
v(await pag.waitForFunction(() => window.partida.modo === 'jogo', null, { timeout: 120000 }).then(() => true, () => false), 'Novo jogo entra no modo jogo');
v(await ate(() => window.partida.s.missoes.missaoAtual === 'prologo', 5), 'prólogo começou');
v(await ate(() => window.partida.ui.dialogoAberto(), 30, { passarFala: false }), 'fala do prólogo na tela');
await pag.evaluate(() => window.jogo.avancar(1.5));
await foto('2-prologo');
const chegouA1 = await ate(() => window.partida.s.missoes.missaoAtual === 'a1' && !window.jogo.cinematica.ativa && !window.partida.ui.dialogoAberto() && window.jogo.controleLivre, 240);
v(chegouA1, `prólogo concluído, A1 em andamento (missão ${await pag.evaluate(() => window.partida.s.missoes.missaoAtual)})`);

// ------------------------------------------------------------------ A1 jogável
const a1 = await pag.evaluate(() => {
  const j = window.jogo;
  const hud = document.querySelector('.hud');
  return {
    ativo: j.ativo?.id,
    controlado: !!j.ativo?.controlado,
    hud: !!hud && getComputedStyle(hud).display !== 'none' && !hud.classList.contains('oculto'),
    hudTexto: hud?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
    objetivo: document.querySelector('.hud-objetivo:not(.oculto)')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    pos: j.ativo ? [j.ativo.posicao.x, j.ativo.posicao.z] : null,
  };
});
v(a1.ativo === 'noe' && a1.controlado, `Noé sob controle (${a1.ativo})`);
v(a1.hud, `HUD visível: "${a1.hudTexto}"`);
v(a1.objetivo.length > 0, `objetivo na tela: "${a1.objetivo}"`);
v(await pag.evaluate(() => !window.partida.ui.raiz.querySelector('.carregamento.visivel')), 'sem tela de carregamento por cima de A1');
await pag.evaluate(() => window.jogo.entrada.simular('frente', true));
await pag.evaluate(() => window.jogo.avancar(1.2));
await pag.evaluate(() => window.jogo.entrada.simular('frente', false));
await pag.evaluate(() => window.jogo.avancar(0.3));
const pos2 = await pag.evaluate(() => [window.jogo.ativo.posicao.x, window.jogo.ativo.posicao.z]);
const andou = Math.hypot(pos2[0] - a1.pos[0], pos2[1] - a1.pos[1]);
v(andou > 1, `Noé anda com W (${andou.toFixed(2)} m)`);
await foto('3-a1-hud');

// Diário (J)
await tecla('diario');
const diario = await pag.evaluate(() => window.partida.ui.diarioAberto());
v(diario, 'J abre o Diário');
if (diario) await foto('4-a1-diario');
await pag.keyboard.press('KeyJ');
await pag.evaluate(() => window.jogo.avancar(0.2));
await pag.waitForTimeout(400); // fade do Diário (CSS, tempo real)
v(await pag.evaluate(() => !window.partida.ui.bloqueado()), 'J fecha o Diário');
v(await pag.evaluate(() => getComputedStyle(document.querySelector('.diario-fundo')).visibility === 'hidden'), 'Diário some da tela');

// Pausa (Esc) e salvar no espaço 1
await tecla('pausa');
const pausa = await pag.evaluate(() => ({ aberta: window.partida.ui.menuAberto(), pausado: window.jogo.pausado }));
v(pausa.aberta && pausa.pausado, `Esc abre a pausa e pausa o jogo (${JSON.stringify(pausa)})`);
await pag.waitForTimeout(400);
await foto('5-a1-pausa');
await pag.evaluate(() => (window.jogo.flags.e2eMarca = 'salva'));
await pag.getByRole('button', { name: 'Salvar', exact: true }).click();
await pag.getByRole('button', { name: /Salvar aqui|Sobrescrever/ }).first().click();
await pag.waitForTimeout(500);
if (await pag.getByRole('button', { name: 'Confirmar?' }).count()) await pag.getByRole('button', { name: 'Confirmar?' }).first().click();
await pag.waitForTimeout(1000);
const slots = await pag.evaluate(() => window.partida.s.salvamento.listar());
const s1 = slots.find((s) => s.slot === 1);
v(s1 && !s1.vazio && !s1.erro, `espaço 1 salvo (${s1?.era} · ${s1?.missao} · ${s1?.personagem})`);
v(await pag.evaluate(() => window.partida.temSave), 'Continuar habilitado (temSave)');

// Depois de salvar, muda o que foi salvo (posição de Noé e uma flag), sai para o título pela
// pausa e carrega o espaço 1 pelo menu do título: o carregar tem de restaurar o estado salvo.
const salvo = await pag.evaluate(() => window.partida.s.salvamento.carregar(1));
const posSalva = salvo?.personagens?.noe?.pos;
v(Array.isArray(posSalva) && salvo.flags?.e2eMarca === 'salva', `o save guarda a posição de Noé e a flag de teste (${JSON.stringify(posSalva)})`);
await pag.evaluate(() => {
  const n = window.jogo.ativo;
  const [x, z] = [n.posicao.x + 20, n.posicao.z + 20];
  n.teleportar(x, window.jogo.mundo.chao(x, z), z);
  window.jogo.flags.e2eMarca = 'mudada';
});
await pag.keyboard.press('Escape'); // da tela de salvar de volta à pausa
await pag.getByRole('button', { name: 'Sair para o título' }).click();
await pag.getByRole('button', { name: 'Sair', exact: true }).click();
await pag.waitForTimeout(400);
const noTitulo = await pag.evaluate(() => {
  const n = window.jogo.personagem('noe');
  return { modo: window.partida.modo, ativo: window.jogo.ativo?.id ?? null, pos: [n.posicao.x, n.posicao.z] };
});
v(noTitulo.modo === 'titulo' && noTitulo.ativo === null, `"Sair para o título" volta ao título (${noTitulo.modo})`);
v(Math.hypot(noTitulo.pos[0] - posSalva[0], noTitulo.pos[1] - posSalva[2]) > 15, 'antes de carregar, Noé está longe do ponto salvo');
await pag.getByRole('button', { name: 'Carregar', exact: true }).click();
await pag.locator('.slot', { hasText: 'Espaço 1' }).getByRole('button', { name: 'Carregar', exact: true }).click();
const carregado = await ate(() => window.partida.modo === 'jogo' && window.jogo.ativo?.id === 'noe', 20, { passarFala: false });
const depois = await pag.evaluate(() => ({
  missao: window.partida.s.missoes.missaoAtual,
  marca: window.jogo.flags.e2eMarca,
  pos: [window.jogo.ativo?.posicao.x, window.jogo.ativo?.posicao.z],
}));
const erroPos = Math.hypot(depois.pos[0] - posSalva[0], depois.pos[1] - posSalva[2]);
v(carregado && depois.missao === 'a1', `carregar pelo título entra no jogo em A1 com Noé (${depois.missao})`);
v(erroPos < 1, `carregar restaura a posição salva de Noé (${erroPos.toFixed(2)} m)`);
v(depois.marca === 'salva', `carregar restaura as flags salvas (e2eMarca=${depois.marca})`);

// ------------------------------------------------------------------ A6 → transição → B1
if (comTransicao) {
  await pag.evaluate(() => {
    const p = window.partida;
    window.registro = { genealogia: [], avisos: [] };
    const gen = p.ui.genealogia.bind(p.ui);
    p.ui.genealogia = (n, i) => {
      window.registro.genealogia.push(n === null ? null : `${i}:${n}`);
      return gen(n, i);
    };
    const aviso = p.ui.aviso.bind(p.ui);
    p.ui.aviso = (t, tipo) => {
      window.registro.avisos.push(t);
      return aviso(t, tipo);
    };
    p.dev.ligarCapturas(['a6-arco', 'transicao']);
    p.dev.jogar();
  });
  const fotos = { 'a6-arco': '6-a6-arco-iris', transicao: '7-transicao-genealogia' };
  const limite = Date.now() + 40 * 60 * 1000;
  let ultimaMissao = '';
  while (Date.now() < limite) {
    const r = await pag.evaluate(() => window.partida.dev.avancar(2, 0.1));
    const missao = await pag.evaluate(() => window.partida.s.missoes.missaoAtual);
    if (missao && missao !== ultimaMissao) log(`missão: ${(ultimaMissao = missao)}`);
    if (r.captura) {
      await foto(fotos[r.captura] ?? r.captura);
      await pag.evaluate(() => window.partida.dev.liberar());
    }
    if (r.fim) break;
  }
  const fim = await pag.evaluate(() => ({
    erro: window.partida.dev.erro, era: window.partida.eraId, transicao: !!window.jogo.transicao, ...window.registro,
  }));
  v(!fim.erro, `atalhos da era 1 sem erro ${fim.erro ?? ''}`);
  v(fim.era === 'abraao' && !fim.transicao, `transição terminou em Canaã (era ${fim.era})`);
  const nomes = fim.genealogia.filter((x) => x !== null);
  v(nomes.length >= 2, `genealogia mostrada: ${nomes.join(', ')}`);
  v(fim.genealogia.at(-1) === null, 'genealogia limpa no fim (ui.genealogia(null))');

  // B1 começa sozinha depois de A6; passa as falas até o jogador ter o controle
  const b1Jogavel = () => {
    const p = window.partida;
    const j = window.jogo;
    return p.s.missoes.missaoAtual === 'b1' && j.ativo?.id === 'abraao' && j.ativo.controlado && j.controleLivre
      && !j.cinematica.ativa && !p.ui.dialogoAberto() && !p.ui.menuAberto() && !j.transicao;
  };
  let jogavel = false;
  for (let t = 0; t < 180 && !jogavel; t += 1) {
    jogavel = await pag.evaluate(b1Jogavel);
    if (jogavel) break;
    await pag.evaluate(async () => {
      const ui = window.partida.ui;
      for (let k = 0; k < 10; k++) {
        if (ui.dialogoAberto()) {
          if (ui.dialogoC.emEscolha()) {
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true }));
            window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1', key: '1', bubbles: true }));
          } else ui.avancarDialogo();
        }
        await window.jogo.avancar(0.1);
      }
    });
  }
  const b1 = await pag.evaluate(() => ({
    missao: window.partida.s.missoes.missaoAtual,
    ativo: window.jogo.ativo?.id,
    hud: !document.querySelector('.hud')?.classList.contains('oculto'),
    objetivo: document.querySelector('.hud-objetivo:not(.oculto)')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    pos: window.jogo.ativo ? [window.jogo.ativo.posicao.x, window.jogo.ativo.posicao.z] : null,
  }));
  v(jogavel, `B1 jogável depois da transição (missão ${b1.missao}, ativo ${b1.ativo})`);
  v(jogavel && b1.hud && b1.objetivo.length > 0, `HUD e objetivo de B1: "${b1.objetivo}"`);
  v(await pag.evaluate(() => !window.partida.ui.raiz.querySelector('.carregamento.visivel')), 'sem tela de carregamento por cima de B1');
  if (jogavel) {
    await pag.evaluate(() => window.jogo.entrada.simular('frente', true));
    await pag.evaluate(() => window.jogo.avancar(1.2));
    await pag.evaluate(() => window.jogo.entrada.simular('frente', false));
    await pag.evaluate(() => window.jogo.avancar(0.3));
    const pos = await pag.evaluate(() => [window.jogo.ativo.posicao.x, window.jogo.ativo.posicao.z]);
    const andou = Math.hypot(pos[0] - b1.pos[0], pos[1] - b1.pos[1]);
    v(andou > 1, `Abrão anda com W em Canaã (${andou.toFixed(2)} m)`);
  }
  await foto('8-b1-canaa');
}

// ------------------------------------------------------------------ créditos (fim de B5)
// A B5 deixa a tela em preto (fade) antes de chamar os créditos: o resumo da jornada tem de
// aparecer por cima do preto, e depois a tela de créditos.
{
  await pag.evaluate(async () => {
    await window.partida.ui.fade(true, 0);
    window.fimCreditos = false;
    window.partida.creditos().then(() => (window.fimCreditos = true));
  });
  await pag.waitForFunction(() => document.querySelector('.titulo-capitulo.visivel')?.textContent?.includes('Memórias'), null, { timeout: 10000 }).catch(() => {});
  await pag.waitForTimeout(1300); // o título aparece com transição de 1,1 s
  const resumo = await pag.evaluate(() => {
    const t = document.querySelector('.titulo-capitulo');
    const f = document.querySelector('.fade-preto');
    const z = (e) => Number(getComputedStyle(e).zIndex);
    return {
      texto: t?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      visivel: !!t && getComputedStyle(t).opacity === '1',
      acimaDoFade: !!t && !!f && z(t) > z(f),
      fadeAtivo: !!f && getComputedStyle(f).opacity === '1',
    };
  });
  v(resumo.fadeAtivo && resumo.visivel && resumo.acimaDoFade && /Memórias: \d+ de \d+ · Segredos: \d+ · Tempo de jornada/.test(resumo.texto),
    `resumo da jornada visível por cima do fade preto: "${resumo.texto}"`);
  await foto('9-creditos-resumo');
  const abriu = await pag.waitForFunction(() => window.partida.ui.menusC.topo() === 'creditos', null, { timeout: 15000 }).then(() => true, () => false);
  v(abriu, 'depois do resumo, a tela de créditos abre');
  await pag.waitForTimeout(400);
  await foto('10-creditos');
  await pag.locator('button.btn.principal', { hasText: 'Voltar' }).click();
  v(await pag.waitForFunction(() => window.fimCreditos, null, { timeout: 5000 }).then(() => true, () => false), 'fechar os créditos resolve creditos()');
  await pag.evaluate(() => window.partida.ui.fade(false, 0));
}

const erroMissao = await pag.evaluate(() => window.partida.errosMissao);
v(erroMissao.length === 0, `sem erros de missão ${erroMissao.join(' | ')}`);
v(erros.length === 0, `sem erros no console (${erros.length})`);
for (const e of erros.slice(0, 10)) console.log('  ', e);

await nav.close();
log(`${v.falhas() ? `${v.falhas()} falha(s)` : 'tudo ok'}`);
process.exit(v.falhas() ? 1 : 0);
