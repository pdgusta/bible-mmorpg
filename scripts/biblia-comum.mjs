// Utilidades compartilhadas pelos scripts de texto bíblico.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FONTES = path.join(RAIZ, 'fontes');
export const SAIDA = path.join(RAIZ, 'src', 'data', 'biblia', 'versiculos.json');

// Abreviações aceitas nas referências do jogo (mesmas da BKJ Fiel 1611 fornecida).
export const ABREVIACOES = [
  'Gn', 'Êx', 'Lv', 'Nm', 'Dt', 'Js', 'Jz', 'Rt', '1Sm', '2Sm', '1Rs', '2Rs', '1Cr', '2Cr', 'Ed', 'Ne', 'Et', 'Jó',
  'Sl', 'Pv', 'Ec', 'Ct', 'Is', 'Jr', 'Lm', 'Ez', 'Dn', 'Os', 'Jl', 'Am', 'Ob', 'Jn', 'Mq', 'Na', 'Hc', 'Sf', 'Ag',
  'Zc', 'Ml', 'Mt', 'Mc', 'Lc', 'Jo', 'At', 'Rm', '1Co', '2Co', 'Gl', 'Ef', 'Fp', 'Cl', '1Ts', '2Ts', '1Tm', '2Tm',
  'Tt', 'Fm', 'Hb', 'Tg', '1Pe', '2Pe', '1Jo', '2Jo', '3Jo', 'Jd', 'Ap',
];

// Referência: "Gn 6:14", "Gn 6:14-16" ou "Ec 4:9-10".
const abrevRegex = ABREVIACOES.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
export const REF_REGEX = new RegExp(`(?<![\\wÀ-ÿ])(${abrevRegex}) (\\d{1,3}):(\\d{1,3})(?:-(\\d{1,3}))?(?![\\d])`, 'g');

/** Expande "Gn 6:14-16" em ["Gn 6:14","Gn 6:15","Gn 6:16"]. */
export function expandirRef(ref) {
  const m = /^(\S+) (\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`Referência inválida: ${ref}`);
  const [, livro, cap, ini, fim] = m;
  const a = Number(ini);
  const b = fim ? Number(fim) : a;
  const out = [];
  for (let v = a; v <= b; v++) out.push(`${livro} ${cap}:${v}`);
  return out;
}

/** Procura referências bíblicas em todos os arquivos de texto de uma pasta. */
export function coletarReferencias(pastas, extensoes = ['.ts', '.md', '.json']) {
  const refs = new Set();
  const visitar = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p)) visitar(path.join(p, f));
      return;
    }
    if (!extensoes.includes(path.extname(p))) return;
    if (p === SAIDA) return;
    const texto = fs.readFileSync(p, 'utf8');
    for (const m of texto.matchAll(REF_REGEX)) {
      const ref = m[4] ? `${m[1]} ${m[2]}:${m[3]}-${m[4]}` : `${m[1]} ${m[2]}:${m[3]}`;
      refs.add(ref);
    }
  };
  for (const p of pastas) visitar(p);
  return [...refs].sort();
}

export function carregarFontesPT() {
  const kjf = JSON.parse(fs.readFileSync(path.join(FONTES, 'KJF.json'), 'utf8'));
  const nvt = JSON.parse(fs.readFileSync(path.join(FONTES, 'NVT.json'), 'utf8'));
  return { kjf, nvt };
}

/** Lê o repositório kjv-markdown (arleym/kjv-markdown): um arquivo por livro, em ordem canônica. */
export function carregarKJV() {
  const dir = path.join(FONTES, 'kjv-markdown');
  if (!fs.existsSync(dir)) return null;
  const arquivos = fs.readdirSync(dir).filter((f) => /^\d\d - .* - KJV\.md$/.test(f)).sort();
  return arquivos.map((arq) => {
    const nome = arq.replace(/^\d\d - /, '').replace(/ - KJV\.md$/, '');
    const capitulos = [];
    let atual = null;
    for (const linha of fs.readFileSync(path.join(dir, arq), 'utf8').split(/\r?\n/)) {
      const c = /^## .* Chapter (\d+)\s*$/.exec(linha);
      if (c) {
        atual = [];
        capitulos[Number(c[1]) - 1] = atual;
        continue;
      }
      const v = /^(\d+) (.*)$/.exec(linha);
      if (v && atual) atual[Number(v[1]) - 1] = v[2].trim();
    }
    return { nome, capitulos };
  });
}

/**
 * Normalização tipográfica mínima: a fonte digital separa pronomes enclíticos com
 * hífen + espaço ("multiplicai- vos"). Juntamos o hífen sem tocar nas palavras.
 */
export function normalizarTipografia(texto) {
  let t = texto;
  for (const [errado, certo] of CORRECOES_FONTE) t = t.split(errado).join(certo);
  return t
    // palavras compostas e ênclises separadas por "hífen + espaço" ("Todo- Poderoso", "multiplicai- vos")
    .replace(/([A-Za-zÀ-ÿ])- ([A-Za-zÀ-ÿ])/g, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Defeitos de digitalização da fonte BKJ conferidos um a um (nunca mudam o sentido do texto):
 * "A/naxade" aparece 10 vezes e nunca "Arfaxade" (o nome em Gn 10–11, 1 Cr 1 e Lc 3:36);
 * algumas palavras foram partidas por hifenização de linha.
 */
export const CORRECOES_FONTE = [
  ['A/naxade', 'Arfaxade'],
  ['des- truirás', 'destruirás'],
  ['encan- tamentos', 'encantamentos'],
];
