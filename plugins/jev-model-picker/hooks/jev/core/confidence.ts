// Confidence formulas, as documented at https://docs.typesafe.ai/confidence.
// The API already returns `confidence` for choice and score; these exist so
// noul answers can share thresholds with them, and so the mock transport
// produces answers shaped exactly like the real ones.

/** Noul has no confidence field: |2p - 1| is 0 at p = 0.5 and 1 at p = 0 or 1. */
export function noulConfidence(p: number): number {
  return Math.abs(2 * p - 1)
}

/** (p_max - 1/n) / (1 - 1/n): 0 for an even split, 1 for full certainty. */
export function choiceConfidence(probabilities: number[]): number {
  const n = probabilities.length
  if (n < 2) return 1
  const pMax = Math.max(...probabilities)
  return clamp01((pMax - 1 / n) / (1 - 1 / n))
}

/**
 * 1 - (probability-weighted distance from the most likely level) / (same for
 * an even spread), floored at 0. Mass on a neighbouring level costs less than
 * mass far away.
 */
export function scoreConfidence(probabilities: number[]): number {
  const n = probabilities.length
  if (n < 2) return 1
  const m = probabilities.indexOf(Math.max(...probabilities))
  const spread = probabilities.reduce((sum, p, i) => sum + p * Math.abs(i - m), 0)
  const center = (n - 1) / 2
  const madUniform = probabilities.reduce((sum, _p, i) => sum + Math.abs(i - center), 0) / n
  return clamp01(1 - spread / madUniform)
}

/** Probability-weighted position on a score scale (what the API returns as `score`). */
export function expectedScore(probabilities: number[]): number {
  return probabilities.reduce((sum, p, i) => sum + p * i, 0)
}

/**
 * Bayes-optimal "say yes" cut-off for a noul question, given what each kind of
 * mistake costs. Say yes when p >= C_fp / (C_fp + C_fn).
 * e.g. missing a dangerous command (fn) costs 9x a needless prompt (fp) -> 0.1.
 */
export function thresholdFromCosts(costs: { falsePositive: number; falseNegative: number }): number {
  const { falsePositive, falseNegative } = costs
  if (falsePositive < 0 || falseNegative < 0 || falsePositive + falseNegative === 0) {
    throw new RangeError('costs must be non-negative and not both zero')
  }
  return falsePositive / (falsePositive + falseNegative)
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}
