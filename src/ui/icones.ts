// Ícones da interface em SVG inline (traço arredondado, cor = currentColor). Strings estáticas
// do próprio código: nunca recebem texto de fora.
import type { NomeClasse } from '../jogo/Classes';
import type { PecaArmadura } from '../jogo/contratos';

const P: Record<string, string> = {
  // classes
  construtor: '<path d="M13.5 3.5l7 7-2.6 2.6-7-7z"/><path d="M12.2 8.8L3.9 17.1a2 2 0 0 0 2.9 2.9l8.3-8.3"/>',
  guerreiro: '<path d="M12 3l7.5 3v5.2c0 4.6-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5.2-7.5-9.8V6z"/><path d="M12 7v10M8.5 11h7"/>',
  batedor: '<path d="M2.5 20.5l6.5-11 4 6 2.4-3.5 6.1 8.5z"/><path d="M9 9.5V3.5l4.5 1.6L9 6.8"/>',
  sacerdote: '<path d="M12 3c3 3.4 5 6 5 9.2a5 5 0 0 1-10 0c0-2 1.1-3.6 2.6-5 .3 1.6 1 2.6 2 3.1.5-2.4.5-4.5.4-7.3z"/><path d="M5 21h14"/>',
  profeta: '<path d="M8 4h10.5a2 2 0 0 1 0 4H8"/><path d="M8 4a2 2 0 0 0-2 2v12a2 2 0 0 1-2 2h11.5a2 2 0 0 0 2-2V8"/><path d="M9.5 11.5h5.5M9.5 14.5h5.5M9.5 17.5h3"/>',
  pastor: '<path d="M9 21V8.5a4 4 0 1 1 8 0v1.2"/><circle cx="17" cy="11.6" r=".9"/>',
  hospitaleiro: '<path d="M3.5 13a8.5 5.5 0 0 1 17 0v5.5h-17z"/><path d="M8 10.5l1 3M12 9.8v3.6M16 10.5l-1 3"/>',
  conselheiro: '<path d="M12 4v16M7 20h10M4.5 7h15"/><path d="M4.5 7L2 13a2.6 2.6 0 0 0 5 0zM19.5 7L17 13a2.6 2.6 0 0 0 5 0z"/>',
  // armadura de Deus
  cinturao: '<rect x="2.5" y="9" width="19" height="6" rx="2"/><rect x="9.5" y="8" width="5" height="8" rx="1"/><path d="M12 10.5v3"/>',
  couraca: '<path d="M7 3.5l5 2 5-2 2.5 3-1.5 5.5V19c-2 1.4-4 2-6 2s-4-.6-6-2v-7L4.5 6.5z"/><path d="M12 6v14M8 10.5c1.3.8 2.6 1.2 4 1.2s2.7-.4 4-1.2"/>',
  calcado: '<path d="M5 4.5c1.5 0 2.5 1 2.8 3l1 6.2c2.4.5 6 1.3 9.2 2.6 1.3.5 2 1.4 2 2.4V20H4.5L3.6 7.6C3.5 5.7 4 4.5 5 4.5z"/><path d="M8.5 11h3M9 14l2.5-.8"/>',
  escudo: '<path d="M12 3l7.5 3v5.2c0 4.6-3.2 8.2-7.5 9.8-4.3-1.6-7.5-5.2-7.5-9.8V6z"/><circle cx="12" cy="11.5" r="2.6"/>',
  capacete: '<path d="M4 15a8 8 0 0 1 16 0v3h-5.2v-3.6a2.8 2.8 0 0 0-5.6 0V18H4z"/><path d="M12 3.2V7M8 4.5c1.2-.9 2.5-1.3 4-1.3s2.8.4 4 1.3"/>',
  espada: '<path d="M14.5 3.5H20.5V9.5L10 20l-3-3z"/><path d="M5 14.5l4.5 4.5M3.5 20.5l2.5-2.5"/>',
  // interface
  estrela: '<path d="M12 2.5l2.1 7.4 7.4 2.1-7.4 2.1L12 21.5l-2.1-7.4L2.5 12l7.4-2.1z" fill="currentColor"/>',
  brilho: '<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" fill="currentColor"/><path d="M18.5 15.5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" fill="currentColor"/>',
  subir: '<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>',
  nivel: '<path d="M6 14l6-6 6 6M6 19l6-6 6 6"/>',
  unidade: '<circle cx="8.5" cy="14" r="4.5"/><circle cx="15.5" cy="14" r="4.5"/><circle cx="12" cy="8" r="4.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  lua: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  livro: '<path d="M12 6.5C10 5 7.5 4.5 3.5 4.5v14c4 0 6.5.5 8.5 2 2-1.5 4.5-2 8.5-2v-14c-4 0-6.5.5-8.5 2z"/><path d="M12 6.5v14"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  voltar: '<path d="M15 5l-7 7 7 7"/>',
  folha: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l8-8"/>',
  semente: '<path d="M12 20.5v-8.5"/><path d="M12 13.5C7.6 13.5 5 11 5 6.6c4.4 0 7 2.5 7 6.9z"/><path d="M12 11.5c0-4.2 2.5-6.8 7-6.8 0 4.2-2.6 6.8-7 6.8z"/><path d="M7.5 20.5h9"/>',
  mouseDireito: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v7.5M6 10.5h12"/><path d="M12.6 3.6c2.6.4 4.8 2.6 4.8 5.4v1H12.6z" fill="currentColor" stroke="none"/>',
  cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pessoa: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.8-4 3.5-6 7-6s6.2 2 7 6"/>',
  alvo: '<path d="M12 3l9 9-9 9-9-9z"/>',
  mao: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 6.5-6 6.5-2.5 0-4-1.2-5.3-3.2L3.5 14c-.8-1.3.9-2.6 2-1.6L8 14.5"/>',
  baixar: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  enviar: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  coracao: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.4 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  fogo: '<path d="M12 3c3 3.4 5 6 5 9.2a5 5 0 0 1-10 0c0-2 1.1-3.6 2.6-5 .3 1.6 1 2.6 2 3.1.5-2.4.5-4.5.4-7.3z"/>',
};

/** SVG de um ícone (string estática). */
export function svg(nome: string, cls = 'ico'): string {
  const corpo = P[nome] ?? P.info;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
}

/** Elemento <span> com o ícone. */
export function icone(nome: string, cls = 'ico'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'ico-caixa';
  s.innerHTML = svg(nome, cls);
  return s;
}

const NOMES_CLASSE: Record<string, NomeClasse> = {
  construtor: 'construtor', guerreiro: 'guerreiro', batedor: 'batedor', sacerdote: 'sacerdote',
  profeta: 'profeta', pastor: 'pastor', hospitaleiro: 'hospitaleiro', conselheiro: 'conselheiro',
  'servo hospitaleiro': 'hospitaleiro',
};

/** Reconhece uma classe pelo id ou pelo nome exibido ("Construtor"). */
export function classeConhecida(c: string | null | undefined): NomeClasse | null {
  if (!c) return null;
  return NOMES_CLASSE[c.toLowerCase()] ?? null;
}

/** Ícone de classe; se a classe não for conhecida, usa o texto/emoji recebido. */
export function iconeClasse(classe: string | null | undefined, reserva = ''): HTMLSpanElement {
  const c = classeConhecida(classe);
  if (c) return icone(c, 'ico ico-classe');
  const s = document.createElement('span');
  s.className = 'ico-caixa ico-texto';
  s.textContent = reserva;
  return s;
}

export function iconeArmadura(p: PecaArmadura): HTMLSpanElement {
  return icone(p, 'ico ico-armadura');
}

/** Cor do retrato por classe (tons de linho/terra, legíveis com ícone claro). */
export const COR_CLASSE: Record<NomeClasse, string> = {
  construtor: '#9a6a3a',
  guerreiro: '#8a4b3c',
  batedor: '#5f7f3e',
  sacerdote: '#a07c2e',
  profeta: '#4f6a8a',
  pastor: '#6f7f4a',
  hospitaleiro: '#a35f4a',
  conselheiro: '#6b5a8a',
};
