// Wire types for TypeSafe's Jev "System One" endpoint (POST /v1/systemone).
// Shapes follow https://docs.typesafe.ai — keep them in sync with the API,
// everything above this file (policy, decision model) depends only on these.

/** Yes/no question. Answer is a single probability that the answer is "yes". */
export type NoulQuestion = {
  type: 'noul'
  instructions: string
}

/** Pick one option. `criteria` maps option key -> description (or null). Max 255 options. */
export type ChoiceQuestion = {
  type: 'choice'
  instructions: string
  criteria: Record<string, string | null>
}

/** Ordered rubric, lowest level first. Max 10 levels. */
export type ScoreQuestion = {
  type: 'score'
  instructions: string
  criteria: string[]
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion
export type QuestionType = Question['type']

/** Jev accepts text state as a string, an object, or a list of strings. */
export type State = string | string[] | Record<string, unknown>

export type SystemOneRequest = {
  model: string
  state: State
  questions: Record<string, Question>
}

export type NoulAnswer = { type: 'noul'; noul: number }

export type ChoiceAnswer = {
  type: 'choice'
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

export type ScoreAnswer = {
  type: 'score'
  /** Probability-weighted position on the scale; can be fractional. */
  score: number
  /** Level index (as string) -> level label. */
  legend: Record<string, string>
  probabilities: Record<string, number>
  confidence: number
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer

export type Usage = { input_tokens: number; output_tokens: number }

export type SystemOneResponse = {
  /** Versioned model that answered, e.g. "jev-1.13.0". */
  model: string
  answers: Record<string, Answer>
  usage?: Usage
}

/**
 * The one seam to the network. Shaped like the Claude Code mod API's
 * `$.http.fetch` (resolves once the body is read), so a mod can pass that in
 * directly; `fetchTransport()` adapts the standard `fetch` for Node/Bun.
 */
export type Transport = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; ok: boolean; text: string; headers?: Record<string, string> }>
