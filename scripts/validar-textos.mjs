// Confere o texto bíblico usado no jogo contra src/data/biblia/versiculos.json:
//   1. toda referência citada em src/** e docs/** existe no arquivo (intervalos verso a verso);
//   2. strings que parecem referência têm o formato certo ("Gn 6:14", "Gn 6:14-16") e livro conhecido;
//   3. todo `trecho` é substring EXATA do texto BKJ: em objetos literais com `ref` e `trecho`
//      e em chamadas auxiliares cujos 2 primeiros argumentos são ('Ref', 'trecho');
//   4. avisa problemas de qualidade das fontes (ex.: "A/naxade" em Gn 11:10).
// Com fontes/ presente (fora do git), também diz se o versículo ausente existe na BKJ e se o
// versiculos.json está desatualizado; sem fontes/, essa parte é pulada (CI).
//
// Uso: npm run validar [-- pastas...]   Código de saída 1 se houver erro (avisos não falham).
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, SAIDA, FONTES, ABREVIACOES, REF_REGEX, expandirRef, normalizarTipografia } from './biblia-comum.mjs';

// Pastas a varrer (padrão: src e docs). Outras podem ser passadas na linha de comando.
const PASTAS = process.argv.length > 2 ? process.argv.slice(2) : ['src', 'docs'];
const EXT_CODIGO = new Set(['.ts', '.tsx', '.js', '.mjs']);
const EXT_TEXTO = new Set(['.md', '.json']);
const ABREV = new Set(ABREVIACOES);
const REF_ESTRITA = /^(\S+) (\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;
// Parece uma referência (para pegar formatos errados: "Gn 6.14", "Gen 6:14", "Gn 6:14–16")
const PARECE_REF = /^([1-3]?[A-Za-zÀ-ÿ]{1,6})\.? ?(\d{1,3})\s*[:.,]\s*(\d{1,3})(?:\s*[-–—]\s*\d{1,3})?$/;

const erros = [];
const avisos = [];
const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

// ------------------------------------------------------------------ dados

if (!fs.existsSync(SAIDA)) {
  console.error(`✗ ${rel(SAIDA)} não existe. Rode "npm run versiculos" (precisa de fontes/).`);
  process.exit(1);
}
const dados = JSON.parse(fs.readFileSync(SAIDA, 'utf8'));
const versos = dados.versiculos ?? {};

let fontes = null;
// SEM_FONTES=1 simula o CI (checkout limpo, sem fontes/).
if (!process.env.SEM_FONTES && fs.existsSync(path.join(FONTES, 'KJF.json'))) {
  try {
    const kjf = JSON.parse(fs.readFileSync(path.join(FONTES, 'KJF.json'), 'utf8'));
    fontes = { kjf, indice: Object.fromEntries(kjf.map((l, i) => [l.abbrev, i])) };
  } catch (e) {
    avisos.push(`fontes/KJF.json ilegível (${e.message}); conferência com a fonte completa pulada.`);
  }
}

function textoFonte(ref) {
  if (!fontes) return undefined;
  const m = /^(\S+) (\d+):(\d+)$/.exec(ref);
  const i = fontes.indice[m[1]];
  const t = i === undefined ? undefined : fontes.kjf[i].chapters[Number(m[2]) - 1]?.[Number(m[3]) - 1];
  return t ? normalizarTipografia(t) : null;
}

/** Problemas de uma referência (formato, livro, versos ausentes). */
function problemasRef(ref) {
  const m = REF_ESTRITA.exec(ref);
  if (!m) return [`referência malformada "${ref}" (use "Gn 6:14" ou "Gn 6:14-16")`];
  if (!ABREV.has(m[1])) return [`livro desconhecido "${m[1]}" em "${ref}"`];
  if (m[4] && Number(m[4]) < Number(m[3])) return [`intervalo invertido "${ref}"`];
  const faltam = expandirRef(ref).filter((r) => !(r in versos));
  if (!faltam.length) return [];
  return faltam.map((r) => {
    const f = textoFonte(r);
    if (f === undefined) return `${r} não está em versiculos.json (rode "npm run versiculos")`;
    if (f === null) return `${r} não existe na BKJ`;
    return `${r} não está em versiculos.json, mas existe na BKJ: rode "npm run versiculos"`;
  });
}

function textoBKJ(ref) {
  return expandirRef(ref).map((r) => versos[r].bkj).join(' ');
}

// ------------------------------------------------------------------ varredura

function listar(dir) {
  const out = [];
  const visitar = (p) => {
    if (!fs.existsSync(p)) return;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const f of fs.readdirSync(p).sort()) visitar(path.join(p, f));
      return;
    }
    const ext = path.extname(p);
    if (p === SAIDA || !(EXT_CODIGO.has(ext) || EXT_TEXTO.has(ext))) return;
    out.push(p);
  };
  visitar(dir);
  return out;
}

function inicioLinhas(texto) {
  const v = [0];
  for (let i = 0; i < texto.length; i++) if (texto.charCodeAt(i) === 10) v.push(i + 1);
  return v;
}
function linhaDe(inicios, pos) {
  let a = 0;
  let b = inicios.length - 1;
  while (a < b) {
    const m = (a + b + 1) >> 1;
    if (inicios[m] <= pos) a = m;
    else b = m - 1;
  }
  return a + 1;
}

// ------------------------------------------------------------------ mini-analisador de JS/TS
// Só o necessário: strings (com escapes), templates, comentários, regex e a pilha de { [ (
// para achar propriedades `chave: 'texto'` de objetos literais.

const ANTES_DE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const PALAVRAS_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

function lerString(src, i) {
  const q = src[i];
  let out = '';
  i++;
  while (i < src.length && src[i] !== q) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      if (n === 'n') out += '\n';
      else if (n === 't') out += '\t';
      else if (n === 'r') out += '\r';
      else if (n === 'u') {
        if (src[i + 2] === '{') {
          const f = src.indexOf('}', i);
          out += String.fromCodePoint(parseInt(src.slice(i + 3, f), 16));
          i = f + 1;
          continue;
        }
        out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      } else if (n === 'x') {
        out += String.fromCharCode(parseInt(src.slice(i + 2, i + 4), 16));
        i += 4;
        continue;
      } else if (n === '\n') {
        // continuação de linha
      } else out += n;
      i += 2;
      continue;
    }
    if (c === '\n' && q !== '`') break; // string não terminada
    out += c;
    i++;
  }
  return { valor: out, fim: i + 1 };
}

/** Pula um template literal; devolve o fim e o texto (null se tiver ${...}). */
function lerTemplate(src, i) {
  let out = '';
  let temExpr = false;
  i++;
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') {
      out += src[i + 1];
      i += 2;
      continue;
    }
    if (src[i] === '$' && src[i + 1] === '{') {
      temExpr = true;
      i = pularExpressao(src, i + 2);
      continue;
    }
    out += src[i++];
  }
  return { valor: temExpr ? null : out, fim: i + 1 };
}

/** Pula até o "}" que fecha um ${ (com chaves, strings e templates aninhados). */
function pularExpressao(src, i) {
  let prof = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "'" || c === '"') i = lerString(src, i).fim;
    else if (c === '`') i = lerTemplate(src, i).fim;
    else if (c === '{') { prof++; i++; }
    else if (c === '}') { if (--prof === 0) return i + 1; i++; }
    else i++;
  }
  return i;
}

function tokenizar(src) {
  const toks = [];
  let i = 0;
  let anterior = null;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const f = src.indexOf('\n', i); i = f < 0 ? src.length : f; continue; }
    if (c === '/' && src[i + 1] === '*') { const f = src.indexOf('*/', i + 2); i = f < 0 ? src.length : f + 2; continue; }
    let t;
    if (c === "'" || c === '"') {
      const s = lerString(src, i);
      t = { tipo: 'str', valor: s.valor, pos: i };
      i = s.fim;
    } else if (c === '`') {
      const s = lerTemplate(src, i);
      t = s.valor === null ? { tipo: 'tpl', pos: i } : { tipo: 'str', valor: s.valor, pos: i };
      i = s.fim;
    } else if (/[A-Za-z_$À-ÿ]/.test(c)) {
      let f = i + 1;
      while (f < src.length && /[\w$À-ÿ]/.test(src[f])) f++;
      t = { tipo: 'id', valor: src.slice(i, f), pos: i };
      i = f;
    } else if (/\d/.test(c)) {
      let f = i + 1;
      while (f < src.length && /[\w.]/.test(src[f])) f++;
      t = { tipo: 'num', valor: src.slice(i, f), pos: i };
      i = f;
    } else if (c === '/' && (!anterior || (anterior.tipo === 'punc' && ANTES_DE_REGEX.has(anterior.valor)) || (anterior.tipo === 'id' && PALAVRAS_REGEX.has(anterior.valor)))) {
      let f = i + 1;
      let classe = false;
      while (f < src.length && src[f] !== '\n') {
        if (src[f] === '\\') { f += 2; continue; }
        if (src[f] === '[') classe = true;
        else if (src[f] === ']') classe = false;
        else if (src[f] === '/' && !classe) break;
        f++;
      }
      f++;
      while (f < src.length && /[a-z]/.test(src[f])) f++;
      t = { tipo: 'regex', pos: i };
      i = f;
    } else {
      t = { tipo: 'punc', valor: c, pos: i };
      i++;
    }
    toks.push(t);
    anterior = t;
  }
  return toks;
}

/** Objetos literais com as propriedades de valor simples (string literal ou "outro"). */
function objetosLiterais(toks) {
  const objetos = [];
  const pilha = [];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.tipo === 'punc' && (t.valor === '{' || t.valor === '[' || t.valor === '(')) {
      pilha.push({ abre: t.valor, props: {}, pos: t.pos });
      continue;
    }
    if (t.tipo === 'punc' && (t.valor === '}' || t.valor === ']' || t.valor === ')')) {
      const f = pilha.pop();
      if (f && f.abre === '{' && Object.keys(f.props).length) objetos.push(f);
      continue;
    }
    const topo = pilha[pilha.length - 1];
    if (!topo || topo.abre !== '{') continue;
    if ((t.tipo === 'id' || t.tipo === 'str') && toks[k + 1]?.tipo === 'punc' && toks[k + 1].valor === ':') {
      const prev = toks[k - 1];
      if (prev && !(prev.tipo === 'punc' && (prev.valor === '{' || prev.valor === ','))) continue;
      const v = toks[k + 2];
      const depois = toks[k + 3];
      const simples = v && v.tipo === 'str' && depois && depois.tipo === 'punc' && (depois.valor === ',' || depois.valor === '}');
      topo.props[t.valor] = simples ? { tipo: 'str', valor: v.valor, pos: v.pos } : { tipo: 'outro', pos: v?.pos ?? t.pos };
    }
  }
  return objetos;
}

// ------------------------------------------------------------------ conferência

const usadas = new Map(); // ref unitária → primeiro uso (arquivo:linha) em src
let nRefs = 0;
let nTrechos = 0;
let nArquivos = 0;

function divergencia(trecho, texto) {
  let a = 0;
  let b = trecho.length;
  while (a < b) {
    const m = (a + b + 1) >> 1;
    if (texto.includes(trecho.slice(0, m))) a = m;
    else b = m - 1;
  }
  if (a === 0) return 'nenhuma parte bate';
  const ok = trecho.slice(Math.max(0, a - 25), a);
  return `bate até «…${ok}» e diverge em «${trecho.slice(a, a + 25)}…»`;
}

function conferirTrecho(ref, trecho, local) {
  nTrechos++;
  const bkj = textoBKJ(ref);
  if (!trecho) erros.push(`${local}  trecho vazio em ${ref} (omita "trecho" para usar o versículo inteiro).`);
  else if (!bkj.includes(trecho)) erros.push(`${local}  trecho não é substring exata de ${ref} (BKJ): ${divergencia(trecho, bkj)}`);
  else if (/[A-Za-zÀ-ÿ]\/[A-Za-zÀ-ÿ]|[A-Za-zÀ-ÿ]- [a-zà-ÿ]/.test(trecho)) avisos.push(`${local}  trecho de ${ref} contém um defeito da fonte digital (barra ou hífen solto).`);
}

for (const pasta of PASTAS) {
  for (const arq of listar(path.resolve(RAIZ, pasta))) {
    nArquivos++;
    const texto = fs.readFileSync(arq, 'utf8');
    const inicios = inicioLinhas(texto);
    const onde = (pos) => `${rel(arq)}:${linhaDe(inicios, pos)}`;
    const ehSrc = !rel(arq).startsWith('docs/');

    // 1. referências citadas (texto livre, comentários, strings)
    const vistas = new Set();
    for (const m of texto.matchAll(REF_REGEX)) {
      const ref = m[4] ? `${m[1]} ${m[2]}:${m[3]}-${m[4]}` : `${m[1]} ${m[2]}:${m[3]}`;
      nRefs++;
      for (const p of problemasRef(ref)) {
        const chave = `${p}@${rel(arq)}`;
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        erros.push(`${onde(m.index)}  ${p}`);
      }
      if (ehSrc) for (const r of expandirRef(ref)) if (!usadas.has(r)) usadas.set(r, onde(m.index));
    }

    if (!EXT_CODIGO.has(path.extname(arq))) continue;
    let toks;
    try {
      toks = tokenizar(texto);
    } catch (e) {
      avisos.push(`${rel(arq)}: não consegui analisar o código (${e.message}); trechos não conferidos.`);
      continue;
    }

    // 2. strings que parecem referência mas estão fora do formato
    for (const t of toks) {
      if (t.tipo !== 'str') continue;
      const s = t.valor.trim();
      if (!PARECE_REF.test(s) || REF_ESTRITA.test(s) && ABREV.has(s.split(' ')[0])) continue;
      const livro = PARECE_REF.exec(s)[1];
      // só reclama de algo que é claramente uma referência bíblica
      if (ABREV.has(livro) || REF_ESTRITA.test(s) || /^[1-3]?[A-ZÊÓ][a-zêó]{1,5}$/.test(livro)) {
        for (const p of problemasRef(s).filter((x) => /malformada|desconhecido|invertido/.test(x)).concat(REF_ESTRITA.test(s) ? [] : [`referência malformada "${s}" (use "Gn 6:14" ou "Gn 6:14-16")`]).slice(0, 1)) {
          erros.push(`${onde(t.pos)}  ${p}`);
        }
      }
    }

    // 3. trechos: em chamadas auxiliares do tipo deus('Gn 6:13', 'trecho') ...
    for (let k = 0; k + 5 < toks.length; k++) {
      const [f, abre, r, virg, t, fecha] = toks.slice(k, k + 6);
      if (f.tipo !== 'id' || abre.valor !== '(' || r.tipo !== 'str' || virg.valor !== ',' || t.tipo !== 'str') continue;
      if (fecha.tipo !== 'punc' || (fecha.valor !== ')' && fecha.valor !== ',')) continue;
      if (!REF_ESTRITA.test(r.valor) || REF_ESTRITA.test(t.valor) || problemasRef(r.valor).length) continue;
      conferirTrecho(r.valor, t.valor, onde(t.pos));
    }
    // ... e em objetos literais { ref: 'Gn 6:13', trecho: '…' }
    for (const o of objetosLiterais(toks)) {
      const { ref, trecho } = o.props;
      if (!trecho) continue;
      if (!ref) continue;
      if (ref.tipo !== 'str') {
        avisos.push(`${onde(trecho.pos)}  trecho com referência não literal: não conferido.`);
        continue;
      }
      if (trecho.tipo !== 'str') {
        avisos.push(`${onde(trecho.pos)}  trecho não literal em ${ref.valor}: não conferido.`);
        continue;
      }
      if (problemasRef(ref.valor).length) continue; // já contado acima
      conferirTrecho(ref.valor, trecho.valor, onde(trecho.pos));
    }
  }
}

// ------------------------------------------------------------------ qualidade das fontes

const DEFEITOS = [
  [/[A-Za-zÀ-ÿ]\/[A-Za-zÀ-ÿ]/, 'barra dentro de palavra'],
  [/[A-Za-zÀ-ÿ]- [a-zà-ÿ]/, 'palavra partida por hífen e espaço'],
  [/\s{2,}/, 'espaços duplos'],
  [/�/, 'caractere inválido (�)'],
  [/[<>{}[\]_*#@|\\~^]/, 'caractere estranho'],
  [/ [,.;:!?]/, 'espaço antes de pontuação'],
];
const defeitosBKJ = [...DEFEITOS, [/\d/, 'algarismo no texto (número de verso vazado?)']];

const qualidade = [];
for (const [ref, v] of Object.entries(versos)) {
  for (const [campo, lista] of [['bkj', defeitosBKJ], ['nvt', DEFEITOS]]) {
    const t = v[campo];
    if (!t) continue;
    for (const [re, nome] of lista) {
      const m = re.exec(t);
      if (!m) continue;
      const a = Math.max(0, m.index - 12);
      const trechoRuim = t.slice(a, m.index + m[0].length + 12);
      qualidade.push({ ref, campo, nome, trecho: trechoRuim, uso: usadas.get(ref) });
    }
  }
}
qualidade.sort((x, y) => (x.uso ? 0 : 1) - (y.uso ? 0 : 1));
for (const q of qualidade) {
  const dica = q.nome === 'barra dentro de palavra' ? ' — não use o texto do versículo para nomes próprios' : '';
  avisos.push(`fonte ${q.ref} (${q.campo.toUpperCase()}): ${q.nome} em «${q.trecho}»${dica}${q.uso ? ` (citado em ${q.uso})` : ''}`);
}

const semNvt = Object.values(versos).filter((v) => !v.nvt).length;
const semKjv = Object.values(versos).filter((v) => !v.kjv).length;
if (semNvt) avisos.push(`${semNvt} versículo(s) sem NVT (o "Entender melhor" mostra só a BKJ).`);
if (semKjv) avisos.push(`${semKjv} versículo(s) sem KJV.`);

// ------------------------------------------------------------------ versiculos.json x fontes

let notaFontes;
if (fontes) {
  let desatualizados = 0;
  for (const [ref, v] of Object.entries(versos)) {
    const f = textoFonte(ref);
    if (f && f !== v.bkj) {
      desatualizados++;
      if (desatualizados <= 3) avisos.push(`versiculos.json difere da fonte em ${ref}: rode "npm run versiculos".`);
    }
  }
  if (desatualizados > 3) avisos.push(`… e mais ${desatualizados - 3} versículo(s) diferentes da fonte.`);
  notaFontes = 'fontes/ presente: versiculos.json conferido com a BKJ completa.';
} else {
  notaFontes = 'fontes/ ausente: conferência com as Bíblias completas pulada (normal no CI).';
}

// ------------------------------------------------------------------ relatório

console.log('Validação do texto bíblico');
console.log(`  ${nArquivos} arquivos lidos em ${PASTAS.join(', ')}; ${Object.keys(versos).length} versículos em ${rel(SAIDA)}.`);
console.log(`  ${nRefs} citações de referência e ${nTrechos} trechos conferidos.`);
console.log(`  ${notaFontes}`);
if (avisos.length) {
  console.log(`\nAvisos (${avisos.length}):`);
  for (const a of avisos) console.log(`  ! ${a}`);
}
if (erros.length) {
  console.error(`\nErros (${erros.length}):`);
  for (const e of erros) console.error(`  ✗ ${e}`);
  console.error(`\n✗ Falhou: ${erros.length} erro(s).`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ OK: nenhuma referência ausente e nenhum trecho divergente${avisos.length ? ` (${avisos.length} aviso(s))` : ''}.`);
}
