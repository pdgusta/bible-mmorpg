// Funções matemáticas pequenas usadas em todo o jogo.

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const inverseLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = inverseLerp(a, b, v);
  return t * t * (3 - 2 * t);
};

/** Interpolação exponencial independente de taxa de quadros (lambda ~ 1/tempo de resposta). */
export const damp = (atual: number, alvo: number, lambda: number, dt: number) =>
  lerp(atual, alvo, 1 - Math.exp(-lambda * dt));

/** Normaliza ângulo para (-π, π]. */
export function wrapAngle(a: number): number {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

export const dampAngle = (atual: number, alvo: number, lambda: number, dt: number) =>
  atual + wrapAngle(alvo - atual) * (1 - Math.exp(-lambda * dt));

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;

export const dist2 = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
};

export function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function formatarTempo(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
