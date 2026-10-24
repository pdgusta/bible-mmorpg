// Planilha de revisão das falas e textos de uma era (ver docs/tecnico/revisao.md).
//
// Lê os arquivos de conteúdo de src/eras/<era>/ e lista, na ordem do código (que segue a ordem
// de jogo dentro de missoes.ts), cada fala bíblica (com o texto BKJ resolvido de
// versiculos.json), fala de ficção, mentira/zombaria, objetivo, dica, aviso, título, rótulo,
// descrição, memória e nota "Aponta para Cristo". Marca automaticamente:
//   ERRO  referência ausente no JSON, `trecho` que não é substring exata da BKJ,
//         fala de ficção atribuída a Deus ou a Jesus (eles só falam com versículos);
//   aviso ficção longa (> 160 caracteres), "..." em vez de "…", espaço duplo.
// O resto (falante certo, sentido do trecho, fidelidade da ficção, tom) é revisão humana.
//
// Uso: node scripts/planilha-falas.mjs <era> [saida-sem-extensao]
//   sem saída: imprime a vista em texto; com saída: grava <saida>.tsv e <saida>.txt.
//   Código de saída 1 se houver ERRO.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, SAIDA } from './biblia-comum.mjs';

const [era, saida] = process.argv.slice(2);
if (!era) {
  console.error('uso: node scripts/planilha-falas.mjs <era> [saida-sem-extensao]');
  process.exit(2);
}
const pasta = path.join(RAIZ, 'src', 'eras', era);
if (!fs.existsSync(pasta)) {
  console.error(`era desconhecida: ${pasta}`);
  process.exit(2);
}
const versos = JSON.parse(fs.readFileSync(SAIDA, 'utf8')).versiculos;

// Ordem: missões primeiro (ordem de jogo), depois o resto do conteúdo.
const ORDEM = ['missoes', 'memorias', 'cristo', 'personagens', 'interativos', 'mecanicas', 'atalhos'];
const arquivos = ORDEM.map((n) => `${n}.ts`).filter((f) => fs.existsSync(path.join(pasta, f)));

const REF = String.raw`(?:[1-3]?[A-ZÊÁÉÍÓÚ][a-zêáéíóúó]{0,2}) \d{1,3}:\d{1,3}(?:-\d{1,3})?`;
const S = String.raw`'([^'\n]*)'`; // os arquivos de conteúdo não usam \'
const SB = String.raw`(?:'([^'\n]*)'|` + '`([^`\\n]*)`)';
const ESPECIAIS = new Set(['versiculo', 'receberVersiculo', 'temVersiculo', 'expandirRef', 'extenso', 'trecho']);

function bkj(ref) {
  const m = /^(\S+) (\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) return null;
  const partes = [];
  for (let v = +m[3]; v <= +(m[4] ?? m[3]); v++) {
    const t = versos[`${m[1]} ${m[2]}:${v}`]?.bkj;
    if (t === undefined) return null;
    partes.push(t);
  }
  return partes.join(' ');
}

/** Junta literais concatenados em várias linhas ('a' +\n 'b') guardando o mapa para a linha original. */
function juntar(src) {
  const re = /'\s*\+\s*\n\s*'/g;
  let out = '';
  const mapa = [];
  let i = 0;
  for (const m of src.matchAll(re)) {
    for (let k = i; k < m.index; k++) mapa.push(k);
    out += src.slice(i, m.index);
    i = m.index + m[0].length;
  }
  for (let k = i; k < src.length; k++) mapa.push(k);
  out += src.slice(i);
  return { texto: out, mapa };
}

const PADROES = [
  // { quem: 'x', ref: 'Gn 1:1', trecho: '...' } e { quem: 'x', texto: '...' }
  ['bíblica', new RegExp(String.raw`\{\s*quem: ${S},\s*ref: '(${REF})'(?:,\s*trecho: ${S})?`, 'g'), (m) => ({ quem: m[1], ref: m[2], trecho: m[3] })],
  ['ficção', new RegExp(String.raw`\{\s*quem: ${S},\s*texto: ${S}(?:,\s*emocao: ${S})?`, 'g'), (m) => ({ quem: m[1], texto: m[2], emocao: m[3] })],
  // auxiliares: narrador('Gn 6:5'), deus('Gn 6:13', 'trecho'), anjo(...)
  ['bíblica', new RegExp(String.raw`\b(\w+)\(\s*'(${REF})'(?:,\s*${S})?\s*\)`, 'g'), (m) => (ESPECIAIS.has(m[1]) ? null : { quem: m[1], ref: m[2], trecho: m[3] })],
  // auxiliar de fala bíblica com falante: biblica('lo', 'Gn 13:10', 'trecho')
  ['bíblica', new RegExp(String.raw`\b(\w+)\(\s*${S},\s*'(${REF})'(?:,\s*${S})?\s*\)`, 'g'), (m) => ({ quem: m[2], ref: m[3], trecho: m[4] })],
  ['ficção', new RegExp(String.raw`\bficcao\(\s*${S},\s*${S}(?:,\s*${S})?\s*\)`, 'g'), (m) => ({ quem: m[1], texto: m[2], emocao: m[3] })],
  ['banner', new RegExp(String.raw`\.versiculo\(\s*'(${REF})'\s*\)`, 'g'), (m) => ({ ref: m[1] })],
  ['recebe', new RegExp(String.raw`\.receberVersiculo\(\s*'(${REF})'\s*\)`, 'g'), (m) => ({ ref: m[1] })],
  ['objetivo', new RegExp(String.raw`(?:\.objetivo\(|\bobjetivo: )${SB}`, 'g'), (m) => ({ texto: m[1] ?? m[2] })],
  ['dica', new RegExp(String.raw`(?:\.dica\(|\bdica: )${SB}`, 'g'), (m) => ({ texto: m[1] ?? m[2] })],
  ['aviso', new RegExp(String.raw`\.aviso\(${SB}`, 'g'), (m) => ({ texto: m[1] ?? m[2] })],
  ['título', new RegExp(String.raw`\.titulo\(${S}(?:,\s*${S})?`, 'g'), (m) => ({ texto: m[1] + (m[2] ? ` | ${m[2]}` : '') })],
  ['título', new RegExp(String.raw`\btitulo: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['resumo', new RegExp(String.raw`\bresumo: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['instrução', new RegExp(String.raw`\binstrucao: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['rótulo', new RegExp(String.raw`\b(?:rotulo|rotuloSair): ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['descrição', new RegExp(String.raw`\bdescricao: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['arco', new RegExp(String.raw`\barco: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['frase', new RegExp(String.raw`\bfrase: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['nota', new RegExp(String.raw`\btexto:\s*${S}`, 'g'), (m) => ({ texto: m[1] })],
  ['ref', new RegExp(String.raw`\bref: '(${REF})'`, 'g'), (m) => ({ ref: m[1] })],
  ['refs', /\brefs: \[([^\]]*)\]/g, (m) => ({ texto: m[1].replace(/'/g, '') })],
  ['nome', new RegExp(String.raw`\bnome: ${S}`, 'g'), (m) => ({ texto: m[1] })],
  // listas de mentiras/zombarias/sussurros: const MENTIRAS_A3 = [...] ou mentiras: [...]
  ['mentiras', /(?:const (\w+)(?::[^=\n]+)? = |\b(mentiras): )\[([^\]]*)\]/g, (m) => ({ lista: m[1] ?? m[2], corpo: m[3] })],
];

const linhas = [];
for (const arq of arquivos) {
  const original = fs.readFileSync(path.join(pasta, arq), 'utf8');
  const { texto, mapa } = juntar(original);
  const inicios = [0];
  for (let i = 0; i < original.length; i++) if (original[i] === '\n') inicios.push(i + 1);
  const linhaDe = (pos) => {
    const o = mapa[pos] ?? original.length;
    let a = 0, b = inicios.length - 1;
    while (a < b) { const m = (a + b + 1) >> 1; if (inicios[m] <= o) a = m; else b = m - 1; }
    return a + 1;
  };
  // contexto: missão (const X: DefMissao / id: 'x', era:), etapa (linha "id: 'x'," sozinha) ou declaração
  const marcos = [];
  for (const m of texto.matchAll(/^(?:export )?(?:async )?(?:function\*? |const |let |class )(\w+)(:\s*DefMissao)?/gm))
    marcos.push({ pos: m.index, missao: m[2] ? m[1] : `(${m[1]})`, etapa: '' });
  for (const m of texto.matchAll(/^\s*id: '(\w+)', era:/gm)) marcos.push({ pos: m.index, missao: m[1], etapa: '' });
  for (const m of texto.matchAll(/^\s*id: '(\w+)',\s*$/gm)) marcos.push({ pos: m.index, etapa: m[1] });
  marcos.sort((a, b) => a.pos - b.pos);
  const contexto = (pos) => {
    let missao = '', etapa = '';
    for (const k of marcos) {
      if (k.pos > pos) break;
      if (k.missao !== undefined) { missao = k.missao; etapa = ''; }
      if (k.etapa) etapa = k.etapa;
    }
    return etapa ? `${missao}.${etapa}` : missao;
  };
  const achados = [];
  const ocupado = []; // evita contar o mesmo trecho por dois padrões
  for (const [tipo, re, f] of PADROES) {
    for (const m of texto.matchAll(re)) {
      if (ocupado.some(([a, b]) => m.index >= a && m.index < b)) continue;
      const d = f(m);
      if (!d) continue;
      ocupado.push([m.index, m.index + m[0].length]);
      if (tipo === 'mentiras') {
        if (!/MENTIRA|ZOMBAR|SUSSURR|PROVOC|ACUSA|GENEALOGIA|^mentiras$/i.test(d.lista)) continue;
        for (const s of d.corpo.matchAll(/'([^'\n]*)'/g))
          achados.push({ pos: m.index + m[0].indexOf(s[0]), tipo: /GENEALOGIA/i.test(d.lista) ? `nomes (${d.lista})` : `ficção (${d.lista})`, quem: /MENTIRA|SUSSURR|ACUSA|^mentiras$/i.test(d.lista) ? 'satanas?' : '', texto: s[1] });
        continue;
      }
      achados.push({ pos: m.index, tipo, ...d });
    }
  }
  achados.sort((a, b) => a.pos - b.pos);
  for (const x of achados) {
    const r = { onde: `${arq}:${linhaDe(x.pos)}`, contexto: contexto(x.pos), tipo: x.tipo, quem: x.quem ?? '', ref: x.ref ?? '', texto: x.texto ?? '', problema: '' };
    if (x.ref) {
      const t = bkj(x.ref);
      if (t === null) r.problema = 'ERRO: referência ausente em versiculos.json';
      else if (x.trecho !== undefined) {
        if (!t.includes(x.trecho)) r.problema = 'ERRO: trecho não é substring exata da BKJ';
        r.texto = `«${x.trecho}»  ⟨versículo: ${t}⟩`;
      } else r.texto = t;
    }
    if (x.tipo === 'ficção' && /^(deus|jesus|senhor)$/i.test(x.quem)) r.problema = 'ERRO: Deus/Jesus só falam com versículos';
    if (x.tipo.startsWith('ficção') && r.texto.length > 160) r.problema ||= 'aviso: ficção longa';
    if (/\.\.\./.test(r.texto) && !x.ref) r.problema ||= 'aviso: use "…"';
    if (/ {2}/.test(x.texto ?? '')) r.problema ||= 'aviso: espaço duplo';
    if (x.emocao) r.quem += ` (${x.emocao})`;
    linhas.push(r);
  }
}

linhas.forEach((r, i) => (r.n = i + 1));
const erros = linhas.filter((r) => r.problema.startsWith('ERRO'));
const cab = ['#', 'onde', 'contexto', 'tipo', 'quem', 'ref', 'texto (BKJ resolvida nas falas bíblicas)', 'problema'];
const limpo = (v) => String(v).replace(/[\t\n]/g, ' ');
const tsv = [cab.join('\t'), ...linhas.map((r) => [r.n, r.onde, r.contexto, r.tipo, r.quem, r.ref, r.texto, r.problema].map(limpo).join('\t'))].join('\n') + '\n';
const txt = linhas
  .map((r) => `${String(r.n).padStart(4)} ${r.onde.padEnd(20)} ${r.contexto.padEnd(24)} ${r.tipo.padEnd(14)} ${r.quem.padEnd(16)} ${r.ref.padEnd(11)} ${r.texto}${r.problema ? `   [${r.problema}]` : ''}`)
  .join('\n') + '\n';
if (saida) {
  fs.writeFileSync(`${saida}.tsv`, tsv);
  fs.writeFileSync(`${saida}.txt`, txt);
  console.log(`${linhas.length} linhas → ${saida}.tsv e ${saida}.txt`);
} else process.stdout.write(txt);
if (erros.length) {
  console.error(`\n✗ ${erros.length} erro(s):`);
  for (const e of erros) console.error(`  ${e.onde} ${e.problema}: ${e.ref || e.texto}`);
  process.exit(1);
}
console.error(`✓ ${linhas.length} linhas; nenhum erro automático (a revisão humana continua necessária).`);
