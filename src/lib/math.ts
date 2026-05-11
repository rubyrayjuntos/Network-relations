export type Complex = { r: number; i: number };

export const cAdd = (a: Complex, b: Complex): Complex => ({ r: a.r + b.r, i: a.i + b.i });
export const cSub = (a: Complex, b: Complex): Complex => ({ r: a.r - b.r, i: a.i - b.i });
export const cMult = (a: Complex, b: Complex): Complex => ({ r: a.r * b.r - a.i * b.i, i: a.r * b.i + a.i * b.r });
export const cConj = (a: Complex): Complex => ({ r: a.r, i: -a.i });
export const cDiv = (a: Complex, b: Complex): Complex => {
  const denom = b.r * b.r + b.i * b.i;
  return { r: (a.r * b.r + a.i * b.i) / denom, i: (a.i * b.r - a.r * b.i) / denom };
};
export const cAbs = (a: Complex): number => Math.sqrt(a.r * a.r + a.i * a.i);
export const cExp = (r: number, theta: number): Complex => ({ r: r * Math.cos(theta), i: r * Math.sin(theta) });

export function poincareTranslation(z_parent: Complex, z_local: Complex): Complex {
  const denom = cAdd({ r: 1, i: 0 }, cMult(cConj(z_parent), z_local));
  const num = cAdd(z_parent, z_local);
  if (cAbs(denom) > 1e-12) {
    return cDiv(num, denom);
  }
  return z_local;
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
