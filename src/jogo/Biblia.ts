// Texto bíblico do jogo. Toda citação vem de src/data/biblia/versiculos.json (gerado por
// scripts/extrair-versiculos.mjs): o código só guarda referências ("Gn 6:14", "Gn 6:14-16").
// O arquivo é carregado sob demanda (import dinâmico) para não pesar no primeiro quadro.
import type { LinhaBiblica, Ref, Versiculo } from './contratos';

interface TextoVersiculo {
  bkj: string;
  nvt: string | null;
  kjv: string | null;
}

export interface DadosBiblia {
  fontes?: Record<string, string>;
  livros: Record<string, { nome: string; en: string | null }>;
  leitura: { livro: string; capitulo: number; versos: number }[];
  versiculos: Record<string, TextoVersiculo>;
}

export interface CapituloLeitura {
  livro: string;
  capitulo: number;
  versos: number;
  /** "Gênesis 6" */
  titulo: string;
}

export interface VersoCapitulo extends TextoVersiculo {
  numero: number;
  ref: Ref;
}

/** Referência decomposta. */
export interface RefPartes {
  livro: string;
  capitulo: number;
  inicio: number;
  fim: number;
}

/** Nomes por extenso (iguais aos de versiculos.json), para `extenso()` funcionar antes do carregamento. */
const NOMES_LIVROS: Record<string, string> = {
  Gn: 'Gênesis', Êx: 'Êxodo', Lv: 'Levítico', Nm: 'Números', Dt: 'Deuteronômio', Js: 'Josué', Jz: 'Juízes', Rt: 'Rute',
  '1Sm': '1 Samuel', '2Sm': '2 Samuel', '1Rs': '1 Reis', '2Rs': '2 Reis', '1Cr': '1 Crônicas', '2Cr': '2 Crônicas',
  Ed: 'Esdras', Ne: 'Neemias', Et: 'Ester', Jó: 'Jó', Sl: 'Salmos', Pv: 'Provérbios', Ec: 'Eclesiastes', Ct: 'Cânticos',
  Is: 'Isaías', Jr: 'Jeremias', Lm: 'Lamentações de Jeremias', Ez: 'Ezequiel', Dn: 'Daniel', Os: 'Oséias', Jl: 'Joel',
  Am: 'Amós', Ob: 'Obadias', Jn: 'Jonas', Mq: 'Miquéias', Na: 'Naum', Hc: 'Habacuque', Sf: 'Sofonias', Ag: 'Ageu',
  Zc: 'Zacarias', Ml: 'Malaquias', Mt: 'Mateus', Mc: 'Marcos', Lc: 'Lucas', Jo: 'João', At: 'Atos', Rm: 'Romanos',
  '1Co': '1 Coríntios', '2Co': '2 Coríntios', Gl: 'Gálatas', Ef: 'Efésios', Fp: 'Filipenses', Cl: 'Colossenses',
  '1Ts': '1 Tessalonicenses', '2Ts': '2 Tessalonicenses', '1Tm': '1 Timóteo', '2Tm': '2 Timóteo', Tt: 'Tito', Fm: 'Filemom',
  Hb: 'Hebreus', Tg: 'Tiago', '1Pe': '1 Pedro', '2Pe': '2 Pedro', '1Jo': '1 João', '2Jo': '2 João', '3Jo': '3 João',
  Jd: 'Judas', Ap: 'Apocalipse',
};

const REF_RE = /^(\S+) (\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/;

let dados: DadosBiblia | null = null;
let carregando: Promise<DadosBiblia> | null = null;
const cache = new Map<Ref, Versiculo>();

function emDesenvolvimento(): boolean {
  try {
    return !!import.meta.env?.DEV;
  } catch {
    return false;
  }
}

/** Carrega versiculos.json (uma vez). Chame no início do jogo, antes das missões. */
export function carregarBiblia(): Promise<DadosBiblia> {
  if (dados) return Promise.resolve(dados);
  if (!carregando) {
    carregando = import('../data/biblia/versiculos.json')
      .then((m) => {
        dados = ((m as { default?: unknown }).default ?? m) as DadosBiblia;
        cache.clear();
        return dados;
      })
      .catch((e) => {
        carregando = null;
        throw e;
      });
  }
  return carregando;
}

/** Usa dados já carregados (testes, ferramentas). */
export function definirDadosBiblia(d: DadosBiblia | null) {
  dados = d;
  carregando = d ? Promise.resolve(d) : null;
  cache.clear();
}

export function bibliaCarregada(): boolean {
  return dados !== null;
}

function exigirDados(): DadosBiblia {
  if (!dados) throw new Error('Texto bíblico ainda não carregado: chame carregarBiblia() antes.');
  return dados;
}

/** Decompõe "Gn 6:14-16". Lança se o formato for inválido. */
export function partesRef(ref: Ref): RefPartes {
  const m = REF_RE.exec(ref.trim());
  if (!m) throw new Error(`Referência inválida: "${ref}" (use o formato "Gn 6:14" ou "Gn 6:14-16")`);
  const inicio = Number(m[3]);
  const fim = m[4] ? Number(m[4]) : inicio;
  if (fim < inicio) throw new Error(`Intervalo invertido: "${ref}"`);
  return { livro: m[1], capitulo: Number(m[2]), inicio, fim };
}

/** "Gn 6:14-16" → ["Gn 6:14", "Gn 6:15", "Gn 6:16"]. */
export function expandirRef(ref: Ref): Ref[] {
  const p = partesRef(ref);
  const out: Ref[] = [];
  for (let v = p.inicio; v <= p.fim; v++) out.push(`${p.livro} ${p.capitulo}:${v}`);
  return out;
}

export function nomeLivro(abrev: string): string {
  return dados?.livros[abrev]?.nome ?? NOMES_LIVROS[abrev] ?? abrev;
}

/** "Gn 6:14" → "Gênesis 6:14"; "Gn 6:14-16" → "Gênesis 6:14-16". */
export function extenso(ref: Ref): string {
  const p = partesRef(ref);
  const vers = p.fim > p.inicio ? `${p.inicio}-${p.fim}` : `${p.inicio}`;
  return `${nomeLivro(p.livro)} ${p.capitulo}:${vers}`;
}

/** A referência existe no texto carregado? (todas as partes de um intervalo). */
export function existe(ref: Ref): boolean {
  const d = exigirDados();
  try {
    return expandirRef(ref).every((r) => r in d.versiculos);
  } catch {
    return false;
  }
}

/** Versículo (ou intervalo, com os versos juntados por espaço). Lança se não existir. */
export function versiculo(ref: Ref): Versiculo {
  const c = cache.get(ref);
  if (c) return c;
  const d = exigirDados();
  const partes = expandirRef(ref).map((r) => {
    const t = d.versiculos[r];
    if (!t) throw new Error(`Versículo ausente em versiculos.json: ${r} (rode "npm run versiculos")`);
    return t;
  });
  const juntar = (k: 'nvt' | 'kjv') => (partes.every((t) => t[k]) ? partes.map((t) => t[k]).join(' ') : null);
  const v: Versiculo = {
    ref,
    referenciaExtenso: extenso(ref),
    bkj: partes.map((t) => t.bkj).join(' '),
    nvt: juntar('nvt'),
    kjv: juntar('kjv'),
  };
  cache.set(ref, v);
  return v;
}

/** Carrega (se preciso) e devolve o versículo. */
export async function obterVersiculo(ref: Ref): Promise<Versiculo> {
  await carregarBiblia();
  return versiculo(ref);
}

/**
 * Trecho citado de um versículo. Precisa ser substring EXATA do texto BKJ.
 * Em desenvolvimento lança erro; em produção avisa e devolve o versículo inteiro
 * (nunca mostra como bíblico um texto que não está na fonte).
 */
export function trecho(ref: Ref, parte?: string): string {
  const v = versiculo(ref);
  if (parte === undefined || parte === '') return v.bkj;
  if (v.bkj.includes(parte)) return parte;
  const msg = `Trecho não encontrado em ${ref} (BKJ): "${parte}"`;
  if (emDesenvolvimento()) throw new Error(msg);
  console.warn(msg);
  return v.bkj;
}

/** Texto a mostrar para uma fala bíblica (o trecho validado ou o versículo inteiro). */
export function textoLinha(l: LinhaBiblica): string {
  return trecho(l.ref, l.trecho);
}

/** Capítulos disponíveis para leitura e meditação no Diário. */
export function capitulosLeitura(): CapituloLeitura[] {
  return exigirDados().leitura.map((c) => ({ ...c, titulo: `${nomeLivro(c.livro)} ${c.capitulo}` }));
}

/** Texto completo de um capítulo de leitura (vazio se não estiver disponível). */
export function textoCapitulo(livro: string, capitulo: number): VersoCapitulo[] {
  const d = exigirDados();
  const info = d.leitura.find((c) => c.livro === livro && c.capitulo === capitulo);
  const out: VersoCapitulo[] = [];
  const max = info?.versos ?? 200;
  for (let n = 1; n <= max; n++) {
    const ref = `${livro} ${capitulo}:${n}`;
    const t = d.versiculos[ref];
    if (!t) {
      if (info) continue;
      break;
    }
    out.push({ numero: n, ref, ...t });
  }
  return out;
}

/** Créditos das traduções (para a tela de créditos / Diário). */
export function fontesBiblia(): Record<string, string> {
  return { ...(exigirDados().fontes ?? {}) };
}
