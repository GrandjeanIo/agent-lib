// Policy: turns one raw Jev answer into a decision the workflow can act on.
// Pure functions over plain data, so every knob can live in a JSON file and
// be tuned per context without touching code.

import { noulConfidence, thresholdFromCosts } from './confidence.ts'
import type { Answer, ChoiceQuestion, NoulQuestion, ScoreQuestion } from './types.ts'

/**
 * confidence >= act      -> "act"      (do it, don't bother the person)
 * confidence >= confirm  -> "confirm"  (do it, but surface it / ask)
 * otherwise              -> "escalate" (hand to System 2: Claude or a human)
 */
export type Bands = { act: number; confirm: number }
export type Band = 'act' | 'confirm' | 'escalate' | 'skipped'

export const DEFAULT_BANDS: Bands = { act: 0.75, confirm: 0.4 }

/** Ready-made band sets. Raise thresholds as actions get harder to undo. */
export const PRESETS = {
  /** Read-only / cheap to be wrong. */
  relaxed: { act: 0.6, confirm: 0.25 },
  balanced: DEFAULT_BANDS,
  /** Writes, money, anything a person would want to know about. */
  strict: { act: 0.9, confirm: 0.6 },
} as const satisfies Record<string, Bands>

type PolicyKnobs = {
  /** Overrides the model-level bands for this one decision. */
  bands?: Partial<Bands>
  /** Value to use when the decision escalates or is skipped. */
  fallback?: unknown
  /** false = don't ask Jev; the decision resolves to `fallback`, band "skipped". */
  enabled?: boolean
}

export type NoulSpec = NoulQuestion &
  PolicyKnobs & {
    /** Say "yes" when p >= yesAt. Default 0.5. */
    yesAt?: number
    /** Alternative to yesAt: derive the cut-off from what each mistake costs. */
    costs?: { falsePositive: number; falseNegative: number }
    fallback?: boolean
  }

export type ChoiceSpec = ChoiceQuestion & PolicyKnobs & { fallback?: string }
export type ScoreSpec = ScoreQuestion & PolicyKnobs & { fallback?: number }

export type DecisionSpec = NoulSpec | ChoiceSpec | ScoreSpec

export type Decision<V = unknown> = {
  id: string
  type: DecisionSpec['type']
  /** What the workflow should use: the answer on act/confirm, else the fallback. */
  value: V | undefined
  /** What Jev picked, regardless of band. undefined when not asked or on error. */
  answer: V | undefined
  /** 0..1, comparable across question types. */
  confidence: number
  band: Band
  /** One line, human-readable — what a mod shows the person. */
  reason: string
  /** Score only: the label of the nearest level. */
  label?: string
  /** Noul: { yes: p }. Choice/score: per option / per level. */
  probabilities?: Record<string, number>
}

export function resolveBands(spec: DecisionSpec, modelBands?: Partial<Bands>): Bands {
  return { ...DEFAULT_BANDS, ...modelBands, ...spec.bands }
}

export function bandFor(confidence: number, bands: Bands): Exclude<Band, 'skipped'> {
  if (confidence >= bands.act) return 'act'
  if (confidence >= bands.confirm) return 'confirm'
  return 'escalate'
}

export function yesThreshold(spec: NoulSpec): number {
  if (spec.yesAt !== undefined) return spec.yesAt
  if (spec.costs) return thresholdFromCosts(spec.costs)
  return 0.5
}

/**
 * Confidence of a noul decision relative to its cut-off t: how far p sits from
 * t, scaled to the room on that side. Equals |2p - 1| when t = 0.5, and keeps
 * a low cut-off (e.g. "flag anything 10%+ likely dangerous") from reading
 * p = 0.3 as an unsure coin flip.
 */
export function noulDecisionConfidence(p: number, t: number): number {
  if (t === 0.5) return noulConfidence(p)
  return p >= t ? (p - t) / (1 - t) : (t - p) / t
}

export function interpret(id: string, spec: DecisionSpec, answer: Answer, modelBands?: Partial<Bands>): Decision {
  const bands = resolveBands(spec, modelBands)
  const fmt = (x: number) => x.toFixed(2)

  if (spec.type === 'noul' && answer.type === 'noul') {
    const t = yesThreshold(spec)
    const pick = answer.noul >= t
    const confidence = noulDecisionConfidence(answer.noul, t)
    const band = bandFor(confidence, bands)
    const yes = fmt(answer.noul)
    const cutOff = fmt(t)
    const direction = pick ? 'yes' : 'no'
    const conf = fmt(confidence)
    return finish(id, spec, band, pick, confidence, {
      reason: `p(yes)=${yes} vs cut-off ${cutOff} -> ${direction}, conf ${conf} -> ${band}`,
      probabilities: { yes: answer.noul },
    })
  }

  if (spec.type === 'choice' && answer.type === 'choice') {
    const band = bandFor(answer.confidence, bands)
    const choice = answer.choice
    const p = fmt(answer.probabilities[choice] ?? 0)
    const conf = fmt(answer.confidence)
    return finish(id, spec, band, choice, answer.confidence, {
      reason: `${choice} (p=${p}), conf ${conf} -> ${band}`,
      probabilities: answer.probabilities,
    })
  }

  if (spec.type === 'score' && answer.type === 'score') {
    const band = bandFor(answer.confidence, bands)
    const label = answer.legend[String(Math.round(answer.score))] ?? spec.criteria[Math.round(answer.score)]
    const score = fmt(answer.score)
    const conf = fmt(answer.confidence)
    return {
      ...finish(id, spec, band, answer.score, answer.confidence, {
        reason: `${score} ~ "${label}", conf ${conf} -> ${band}`,
        probabilities: answer.probabilities,
      }),
      label,
    }
  }

  throw new TypeError(`answer type "${answer.type}" does not match question "${id}" of type "${spec.type}"`)
}

/** A decision that never reached Jev: disabled, or Jev was unavailable. */
export function unanswered(id: string, spec: DecisionSpec, band: 'skipped' | 'escalate', reason: string): Decision {
  return { id, type: spec.type, value: spec.fallback, answer: undefined, confidence: 0, band, reason }
}

function finish(
  id: string,
  spec: DecisionSpec,
  band: Exclude<Band, 'skipped'>,
  answer: unknown,
  confidence: number,
  extra: { reason: string; probabilities?: Record<string, number> },
): Decision {
  const value = band === 'escalate' ? spec.fallback : answer
  return { id, type: spec.type, value, answer, confidence, band, ...extra }
}
