// Servidor estático mínimo usado pelo conversor de assets (navegador headless).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from '../biblia-comum.mjs';

const MAPA = [
  ['/three/', path.join(RAIZ, 'node_modules/three/')],
  ['/fontes/', path.join(RAIZ, 'fontes/assets/')],
  ['/public/', path.join(RAIZ, 'public/')],
  ['/', path.join(RAIZ, 'scripts/assets/pagina/')],
];
const TIPOS = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

export function servir(porta) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      for (const [prefixo, dir] of MAPA) {
        if (!url.startsWith(prefixo)) continue;
        const arq = path.join(dir, url.slice(prefixo.length));
        if (arq.startsWith(dir) && fs.existsSync(arq) && fs.statSync(arq).isFile()) {
          res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' });
          fs.createReadStream(arq).pipe(res);
          return;
        }
      }
      res.writeHead(404);
      res.end('não encontrado: ' + url);
    });
    s.listen(porta, () => resolve(s));
  });
}
