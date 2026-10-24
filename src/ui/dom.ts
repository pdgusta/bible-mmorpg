// Utilitários de DOM da interface: criação de elementos sem innerHTML para texto dinâmico.
import type { Ref } from '../jogo/contratos';

type Filho = Node | string | null | undefined | false;

/** Cria um elemento com classes e filhos. Texto entra sempre como nó de texto (seguro). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, ...filhos: Filho[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const f of filhos) if (f !== null && f !== undefined && f !== false) e.append(f);
  return e;
}

export function botao(texto: string | Node, cls = 'btn', aoClicar?: (ev: MouseEvent) => void): HTMLButtonElement {
  const b = el('button', cls, texto);
  b.type = 'button';
  if (aoClicar) b.addEventListener('click', aoClicar);
  return b;
}

export function limpar(e: Element) {
  while (e.firstChild) e.removeChild(e.firstChild);
}

/** Tecla desenhada como "keycap". */
export function tecla(t: string, cls = ''): HTMLElement {
  return el('kbd', `tecla ${cls}`.trim(), t);
}

/**
 * Texto com marcação mínima: **negrito**. Um negrito curto (até 6 letras, ex.: **Tab**, **Q**)
 * vira uma tecla desenhada.
 */
export function textoMarcado(texto: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const partes = texto.split(/\*\*(.+?)\*\*/g);
  partes.forEach((p, i) => {
    if (!p) return;
    if (i % 2 === 0) frag.append(p);
    else if (p.length <= 6 && !p.includes(' ')) frag.append(tecla(p));
    else frag.append(el('strong', null, p));
  });
  return frag;
}

/** Chip de referência bíblica: hover mostra o versículo; clique abre "Entender melhor". */
export function chipRef(ref: Ref, rotulo?: string): HTMLButtonElement {
  const b = el('button', 'chip-ref', rotulo ?? ref);
  b.type = 'button';
  b.dataset.ref = ref;
  b.setAttribute('aria-label', `Referência ${rotulo ?? ref}: entender melhor`);
  return b;
}

export function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Espera n milissegundos (para animações de UI). */
export function esperarMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Dois quadros de animação (para transições CSS a partir de um estado recém-inserido). */
export function proximoQuadro(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/** "1h 05min" */
export function formatarTempo(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}min`;
  return `${m} min`;
}

/** "24/10/2026, 14:05" */
export function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Expande "Gn 6:14-16" em refs de um verso (sem depender do texto carregado). */
export function expandirRefSimples(ref: Ref): Ref[] {
  const m = /^(\S+) (\d+):(\d+)(?:-(\d+))?$/.exec(ref.trim());
  if (!m) return [ref];
  const a = Number(m[3]);
  const b = m[4] ? Number(m[4]) : a;
  const out: Ref[] = [];
  for (let v = a; v <= b && out.length < 200; v++) out.push(`${m[1]} ${m[2]}:${v}`);
  return out;
}

/** As duas referências compartilham algum verso? */
export function refsSeTocam(a: Ref, b: Ref): boolean {
  const ea = expandirRefSimples(a);
  return expandirRefSimples(b).some((r) => ea.includes(r));
}
