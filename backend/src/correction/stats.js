// Aproximação de Abramowitz & Stegun (7.1.26) para a função erro.
function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function zScore(rawScore, mean, sd, direction) {
  if (sd === 0) return null;
  return direction === "lower_better" ? (mean - rawScore) / sd : (rawScore - mean) / sd;
}

export function scaledScore(z, scaleMean, scaleSd) {
  return z * scaleSd + scaleMean;
}

export function percentileFromZ(z) {
  return normalCdf(z) * 100;
}

// Sistema de classificação de Guilmette et al. (2020) — American Academy of Clinical
// Neuropsychology consensus conference statement on uniform labeling of performance test scores,
// The Clinical Neuropsychologist, 34:3, 437-453.
export function classify(z) {
  if (z >= 2) return "Muito Superior";
  if (z >= 1.333) return "Superior";
  if (z >= 0.666) return "Média Superior";
  if (z >= -0.666) return "Média";
  if (z >= -1.333) return "Média Inferior";
  if (z >= -2) return "Limítrofe";
  return "Deficitário";
}
