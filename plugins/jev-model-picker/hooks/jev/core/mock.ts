// Offline stand-in for Jev: same wire format, answers from a function you
// supply. For tests, for demos without an API key, and for showing an
// audience what a given probability does to the workflow.

import { choiceConfidence, expectedScore, scoreConfidence } from './confidence.ts'
import type { Answer, Question, State, SystemOneRequest, SystemOneResponse, Transport } from './types.ts'

/**
 * Return raw probabilities for one question:
 *   noul   -> p(yes)
 *   choice -> { option: p }   (normalised for you)
 *   score  -> [p per level]   (normalised for you)
 */
export type Responder = (
  state: State,
  id: string,
  question: Question,
) => number | Record<string, number> | number[]

export function mockTransport(responder: Responder = keywordResponder, model = 'jev-mock'): Transport {
  return async (_url, init) => {
    const req = JSON.parse(init.body) as SystemOneRequest
    const answers: Record<string, Answer> = {}
    for (const [id, q] of Object.entries(req.questions)) {
      answers[id] = toAnswer(q, responder(req.state, id, q))
    }
    const res: SystemOneResponse = {
      model,
      answers,
      usage: { input_tokens: Math.ceil(init.body.length / 4), output_tokens: Object.keys(answers).length },
    }
    return { status: 200, ok: true, text: JSON.stringify(res) }
  }
}

/** Build a well-formed answer (with documented confidence) from raw probabilities. */
export function toAnswer(q: Question, raw: number | Record<string, number> | number[]): Answer {
  if (q.type === 'noul') {
    if (typeof raw !== 'number') throw new TypeError('noul responder must return a number')
    return { type: 'noul', noul: raw }
  }
  if (q.type === 'choice') {
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('choice responder must return { option: p }')
    const keys = Object.keys(q.criteria)
    const probs = normalise(keys.map(k => raw[k] ?? 0))
    const probabilities = Object.fromEntries(keys.map((k, i) => [k, probs[i]!]))
    const choice = keys[probs.indexOf(Math.max(...probs))]!
    return { type: 'choice', choice, probabilities, confidence: choiceConfidence(probs) }
  }
  if (!Array.isArray(raw)) throw new TypeError('score responder must return [p per level]')
  const probs = normalise(q.criteria.map((_, i) => raw[i] ?? 0))
  return {
    type: 'score',
    score: expectedScore(probs),
    legend: Object.fromEntries(q.criteria.map((label, i) => [String(i), label])),
    probabilities: Object.fromEntries(probs.map((p, i) => [String(i), p])),
    confidence: scoreConfidence(probs),
  }
}

/**
 * Generic, deliberately naive fallback: word overlap between the state and
 * each option's key + description. Noul questions get 0.5 — the mock has no
 * opinion, so the policy escalates them. Good enough to drive a demo; never
 * mistake it for the real model.
 */
export const keywordResponder: Responder = (state, _id, q) => {
  const words = tokens(typeof state === 'string' ? state : JSON.stringify(state))
  const overlap = (text: string) => [...tokens(text)].filter(w => words.has(w)).length
  if (q.type === 'noul') return 0.5
  if (q.type === 'choice') {
    return Object.fromEntries(
      Object.entries(q.criteria).map(([k, d]) => [k, Math.exp(overlap(`${k} ${d ?? ''}`))]),
    )
  }
  return q.criteria.map(level => Math.exp(overlap(level)))
}

function tokens(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
}

function normalise(xs: number[]): number[] {
  const sum = xs.reduce((a, b) => a + b, 0)
  return sum > 0 ? xs.map(x => x / sum) : xs.map(() => 1 / xs.length)
}
