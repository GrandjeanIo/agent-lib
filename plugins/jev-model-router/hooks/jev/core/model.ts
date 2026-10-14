// A decision model = a named set of questions + a policy, asked of Jev in one
// call. The spec is plain data (JSON-safe), so the same model can be tuned per
// context — a project, a hook, a workshop demo — with `tune()` or an overrides
// file, and the code that consumes it doesn't change.

import { JevClient } from './client.ts'
import {
  type Bands,
  type ChoiceSpec,
  type Decision,
  type DecisionSpec,
  type NoulSpec,
  type ScoreSpec,
  interpret,
  unanswered,
} from './policy.ts'
import type { Question, State, Usage } from './types.ts'

export type DecisionModelSpec = {
  name: string
  /** Prepended to every state: who is deciding, for what. Tune per context. */
  context?: string
  /** Default bands for every decision in this model. */
  bands?: Partial<Bands>
  decisions: Record<string, DecisionSpec>
}

/**
 * Recursive partial for overrides. `criteria` (options / levels) is replaced
 * whole, never merged. Turn a decision off with `enabled: false`.
 */
export type Overrides<T> = T extends unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: K extends 'criteria' ? T[K] : Overrides<T[K]> }
    : T

type ValueOf<S> = S extends NoulSpec
  ? boolean
  : S extends ChoiceSpec
    ? Extract<keyof S['criteria'], string>
    : S extends ScoreSpec
      ? number
      : never

export type Decisions<S extends DecisionModelSpec> = {
  [K in keyof S['decisions']]: Decision<ValueOf<S['decisions'][K]>>
}

export type DecisionResult<S extends DecisionModelSpec = DecisionModelSpec> = {
  model: string
  decisions: Decisions<S>
  /** True when any asked decision fell below its confirm band. */
  escalate: boolean
  /** Decisions a person should see (confirm + escalate), most uncertain first. */
  attention: Decision[]
  latencyMs: number
  usage?: Usage
  /** Set when Jev was unreachable and onError is "escalate". */
  error?: string
}

export type DecisionModelOptions = {
  client: JevClient
  /** "escalate" (default): Jev failing never blocks — every decision escalates. */
  onError?: 'escalate' | 'throw'
  /** Called with every result: logging, telemetry, a mod's UI. */
  onResult?: (result: DecisionResult) => void
}

export type DecisionModel<S extends DecisionModelSpec> = {
  readonly spec: S
  decide(state: State): Promise<DecisionResult<S>>
  /** Same model, adjusted for a context. Returns a new model; this one is untouched. */
  tune(overrides: Overrides<DecisionModelSpec>): DecisionModel<S>
  /** The questions as sent to Jev — handy for debugging and docs. */
  questions(): Record<string, Question>
}

/** Identity with inference: keeps choice option keys as literal types. */
export function defineSpec<const S extends DecisionModelSpec>(spec: S): S {
  return spec
}

export function createDecisionModel<const S extends DecisionModelSpec>(
  spec: S,
  options: DecisionModelOptions,
): DecisionModel<S> {
  validateSpec(spec)
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

  const questions = () => {
    const out: Record<string, Question> = {}
    for (const [id, d] of Object.entries(spec.decisions)) {
      if (d.enabled === false) continue
      out[id] = toQuestion(d)
    }
    return out
  }

  return {
    spec,
    questions,
    tune: overrides => createDecisionModel(merge(spec, overrides) as S, options),

    async decide(state) {
      const asked = questions()
      const started = now()
      const decisions: Record<string, Decision> = {}
      let result: DecisionResult

      for (const [id, d] of Object.entries(spec.decisions)) {
        if (d.enabled === false) decisions[id] = unanswered(id, d, 'skipped', 'disabled in this context')
      }

      if (Object.keys(asked).length === 0) {
        result = summarize(spec.name, decisions, started, now())
      } else {
        try {
          const res = await options.client.evaluate(withContext(spec.context, state), asked)
          for (const id of Object.keys(asked)) {
            const answer = res.answers[id]
            decisions[id] = answer
              ? interpret(id, spec.decisions[id]!, answer, spec.bands)
              : unanswered(id, spec.decisions[id]!, 'escalate', 'Jev returned no answer for this question')
          }
          result = { ...summarize(res.model, decisions, started, now()), usage: res.usage }
        } catch (error) {
          if (options.onError === 'throw') throw error
          const message = error instanceof Error ? error.message : String(error)
          for (const id of Object.keys(asked)) {
            decisions[id] = unanswered(id, spec.decisions[id]!, 'escalate', `Jev unavailable: ${message}`)
          }
          result = { ...summarize(spec.name, decisions, started, now()), error: message }
        }
      }

      // Keep the spec's order, whatever order decisions were filled in.
      result.decisions = Object.fromEntries(Object.keys(spec.decisions).map(id => [id, decisions[id]!])) as DecisionResult['decisions']
      options.onResult?.(result)
      return result as DecisionResult<S>
    },
  }
}

function summarize(model: string, decisions: Record<string, Decision>, start: number, end: number): DecisionResult {
  const all = Object.values(decisions)
  const attention = all
    .filter(d => d.band === 'confirm' || d.band === 'escalate')
    .sort((a, b) => a.confidence - b.confidence)
  return {
    model,
    decisions: decisions as DecisionResult['decisions'],
    escalate: all.some(d => d.band === 'escalate'),
    attention,
    latencyMs: Math.round(end - start),
  }
}

/** Strip policy knobs; Jev only sees the question. */
export function toQuestion(d: DecisionSpec): Question {
  switch (d.type) {
    case 'noul':
      return { type: 'noul', instructions: d.instructions }
    case 'choice':
      return { type: 'choice', instructions: d.instructions, criteria: d.criteria }
    case 'score':
      return { type: 'score', instructions: d.instructions, criteria: d.criteria }
  }
}

export function withContext(context: string | undefined, state: State): State {
  if (!context) return state
  if (typeof state === 'string') return `${context}\n\n${state}`
  if (Array.isArray(state)) return [context, ...state]
  return { context, ...state }
}

/** A spec or overrides that cannot be used. Thrown before any call to Jev. */
export class SpecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpecError'
  }
}

export function validateSpec(spec: DecisionModelSpec): void {
  const problems: string[] = []
  const checkBands = (where: string, b?: Partial<Bands>) => {
    if (!b) return
    for (const [k, v] of Object.entries(b)) {
      if (v !== undefined && (v < 0 || v > 1)) problems.push(`${where}: bands.${k} must be within 0..1`)
    }
    if (b.act !== undefined && b.confirm !== undefined && b.confirm > b.act) {
      problems.push(`${where}: bands.confirm must not exceed bands.act`)
    }
  }
  checkBands(spec.name, spec.bands)

  for (const [id, d] of Object.entries(spec.decisions)) {
    const name = spec.name
    const where = `${name}.${id}`
    if (!d.instructions?.trim()) problems.push(`${where}: instructions are empty`)
    checkBands(where, d.bands)
    if (d.type === 'choice') {
      const n = Object.keys(d.criteria).length
      const fallback = d.fallback
      if (n < 2 || n > 255) problems.push(`${where}: choice needs 2..255 options, has ${n}`)
      if (fallback !== undefined && !(fallback in d.criteria)) {
        problems.push(`${where}: fallback "${fallback}" is not one of the options`)
      }
    }
    if (d.type === 'score' && (d.criteria.length < 2 || d.criteria.length > 10)) {
      const levels = d.criteria.length
      problems.push(`${where}: score needs 2..10 levels, has ${levels}`)
    }
    if (d.type === 'noul' && d.yesAt !== undefined && (d.yesAt <= 0 || d.yesAt >= 1)) {
      problems.push(`${where}: yesAt must be strictly between 0 and 1`)
    }
  }
  if (problems.length) throw new SpecError(`Invalid decision model:\n  ${problems.join('\n  ')}`)
}

/** Deep merge for plain objects; arrays, scalars and `criteria` replace. */
export function merge<T>(base: T, overrides: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) return (overrides === undefined ? base : overrides) as T
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) continue
    out[k] = k === 'criteria' ? v : merge(out[k], v)
  }
  return out as T
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
