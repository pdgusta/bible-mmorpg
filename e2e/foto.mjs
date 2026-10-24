// Ferramenta de desenvolvimento: abre uma URL do jogo no Chromium headless e salva um screenshot.
// Uso: node e2e/foto.mjs "<caminho e query>" saida.png [largura] [altura]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const [rota, saida, w = '1280', h = '720'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:5173';
const nav = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pag = await nav.newPage({ viewport: { width: Number(w), height: Number(h) } });
pag.on('pageerror', (e) => console.log('pageerror:', e.message));
pag.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log(`console.${m.type()}:`, m.text().slice(0, 400)); });
await pag.goto(base + rota);
await pag.waitForFunction(() => window.pronto, null, { timeout: 180000 });
await pag.screenshot({ path: saida });
await nav.close();
