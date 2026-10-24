// Utilidades dos testes de navegador (Playwright headless com SwiftShader).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require('/opt/node-tools/node_modules/playwright');
}

export const BASE = process.env.BASE ?? 'http://localhost:5173';

/**
 * Abre o Chromium headless numa página do tamanho pedido. O WebSocket do Vite é bloqueado:
 * outros editores salvando arquivos não recarregam a página no meio do teste.
 */
export async function abrir({ largura = 640, altura = 360 } = {}) {
  const nav = await pw.chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  });
  const pag = await nav.newPage({ viewport: { width: largura, height: altura } });
  await pag.routeWebSocket(/./, () => {});
  const erros = [];
  const avisos = new Map();
  pag.on('pageerror', (e) => {
    erros.push(`pageerror: ${e.message}`);
    console.log('pageerror:', e.message);
  });
  pag.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') {
      erros.push(`console.error: ${t.slice(0, 400)}`);
      console.log('console.error:', t.slice(0, 400));
    } else if (m.type() === 'warning') {
      const k = t.slice(0, 160);
      const n = (avisos.get(k) ?? 0) + 1;
      avisos.set(k, n);
      if (n === 1) console.log('console.warning:', t.slice(0, 300));
    }
  });
  return { nav, pag, erros, avisos };
}

/** Pasta de saída (criada se preciso). */
export function pasta(caminho) {
  mkdirSync(caminho, { recursive: true });
  return caminho;
}

/** Espera dois quadros do navegador (o laço renderiza) e salva a foto. */
export async function foto(pag, arquivo) {
  await pag.evaluate(() => {
    window.jogo.renderizarManual = true;
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
  });
  await pag.screenshot({ path: arquivo });
  await pag.evaluate(() => (window.jogo.renderizarManual = false));
  console.log(`foto: ${arquivo}`);
}

/** Registro de verificações (ok/FALHOU) com contagem de falhas. */
export function verificador() {
  let falhas = 0;
  const v = (cond, msg) => {
    console.log(`${cond ? 'ok    ' : 'FALHOU'} ${msg}`);
    if (!cond) falhas++;
    return !!cond;
  };
  v.falhas = () => falhas;
  return v;
}

export const segundos = (ms) => (ms / 1000).toFixed(1);
