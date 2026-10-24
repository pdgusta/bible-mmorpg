// Gera src/data/biblia/versiculos.json com APENAS os versículos que o jogo usa.
//
// Fontes (fora do git, ver README):
//   fontes/KJF.json        Bíblia King James Fiel 1611 (texto base do jogo)
//   fontes/NVT.json        Nova Versão Transformadora (apoio: "Entender melhor")
//   fontes/kjv-markdown/   KJV em inglês (github.com/arleym/kjv-markdown), texto de origem
//
// Uso: npm run versiculos
import fs from 'node:fs';
import path from 'node:path';
import {
  RAIZ, SAIDA, ABREVIACOES, coletarReferencias, expandirRef,
  carregarFontesPT, carregarKJV, normalizarTipografia,
} from './biblia-comum.mjs';

// Capítulos completos disponíveis para leitura/meditação no Diário.
const CAPITULOS_PARA_LEITURA = [];
for (let c = 1; c <= 22; c++) CAPITULOS_PARA_LEITURA.push(['Gn', c]);

const { kjf, nvt } = carregarFontesPT();
const kjv = carregarKJV();
const indice = Object.fromEntries(kjf.map((l, i) => [l.abbrev, i]));
for (const a of ABREVIACOES) if (!(a in indice)) throw new Error(`Livro ${a} ausente na KJF`);

const refs = coletarReferencias([path.join(RAIZ, 'src'), path.join(RAIZ, 'docs')]);
const unitarias = new Set(refs.flatMap(expandirRef));
for (const [livro, cap] of CAPITULOS_PARA_LEITURA) {
  const n = kjf[indice[livro]].chapters[cap - 1].length;
  for (let v = 1; v <= n; v++) unitarias.add(`${livro} ${cap}:${v}`);
}

const versiculos = {};
const problemas = [];
for (const ref of [...unitarias].sort(compararRefs)) {
  const [, livro, cap, ver] = /^(\S+) (\d+):(\d+)$/.exec(ref);
  const i = indice[livro];
  const bkj = kjf[i].chapters[Number(cap) - 1]?.[Number(ver) - 1];
  const nv = nvt[i].chapters[Number(cap) - 1]?.[Number(ver) - 1];
  const en = kjv?.[i]?.capitulos[Number(cap) - 1]?.[Number(ver) - 1];
  if (!bkj) { problemas.push(`${ref}: não existe na BKJ`); continue; }
  versiculos[ref] = {
    bkj: normalizarTipografia(bkj),
    nvt: nv ? normalizarTipografia(nv) : null,
    kjv: en ?? null,
  };
}

const livros = Object.fromEntries(kjf.map((l, i) => [l.abbrev, { nome: l.name, en: kjv?.[i]?.nome ?? null }]));
const leitura = CAPITULOS_PARA_LEITURA.map(([l, c]) => ({ livro: l, capitulo: c, versos: kjf[indice[l]].chapters[c - 1].length }));

const saida = {
  aviso: 'Arquivo gerado por scripts/extrair-versiculos.mjs. Não edite à mão. Textos sob direitos autorais das editoras; uso no MVP sujeito a licença.',
  fontes: {
    bkj: 'Bíblia King James Fiel 1611 (BKJ Fiel 1611)',
    nvt: 'Nova Versão Transformadora (NVT)',
    kjv: 'King James Version 1611 (domínio público), via github.com/arleym/kjv-markdown',
  },
  livros,
  leitura,
  versiculos,
};
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 1) + '\n');
console.log(`${Object.keys(versiculos).length} versículos escritos em ${path.relative(RAIZ, SAIDA)} (${refs.length} referências no código e docs).`);
if (problemas.length) {
  console.error('Problemas:\n  ' + problemas.join('\n  '));
  process.exitCode = 1;
}

function compararRefs(a, b) {
  const pa = /^(\S+) (\d+):(\d+)$/.exec(a);
  const pb = /^(\S+) (\d+):(\d+)$/.exec(b);
  return (indice[pa[1]] - indice[pb[1]]) || (pa[2] - pb[2]) || (pa[3] - pb[3]);
}
