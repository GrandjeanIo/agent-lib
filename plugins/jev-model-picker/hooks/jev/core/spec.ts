// Runtime checks for specs and overrides that arrive as JSON (a skill's spec
// file, a project's overrides file). TypeScript can't see those, so the shape
// is checked here before `validateSpec` checks the limits.

import type { DecisionModelSpec, Overrides } from './model.ts'
import { SpecError, validateSpec } from './model.ts'

const TYPES = ['noul', 'choice', 'score']

export function parseSpec(input: unknown, source = 'spec'): DecisionModelSpec {
  const problems: string[] = []
  if (!isObject(input)) throw new SpecError(`${source}: expected a JSON object`)
  if (typeof input.name !== 'string' || !input.name) problems.push('name: required string')
  if (input.context !== undefined && typeof input.context !== 'string') problems.push('context: must be a string')
  checkBands('bands', input.bands, problems)

  if (!isObject(input.decisions) || Object.keys(input.decisions).length === 0) {
    problems.push('decisions: required, at least one')
  } else {
    for (const [id, d] of Object.entries(input.decisions)) checkDecision(`decisions.${id}`, d, problems, true)
  }
  if (problems.length) throw new SpecError(`${source} is not a valid decision model:\n  ${problems.join('\n  ')}`)

  const spec = input as DecisionModelSpec
  validateSpec(spec)
  return spec
}

/** Overrides are checked for shape only; the merged result is validated by `tune()`. */
export function parseOverrides(input: unknown, source = 'overrides'): Overrides<DecisionModelSpec> {
  const problems: string[] = []
  if (!isObject(input)) throw new SpecError(`${source}: expected a JSON object`)
  if (input.name !== undefined) problems.push('name: cannot be overridden')
  if (input.context !== undefined && typeof input.context !== 'string') problems.push('context: must be a string')
  checkBands('bands', input.bands, problems)
  if (input.decisions !== undefined) {
    if (!isObject(input.decisions)) problems.push('decisions: must be an object')
    else for (const [id, d] of Object.entries(input.decisions)) checkDecision(`decisions.${id}`, d, problems, false)
  }
  if (problems.length) throw new SpecError(`${source} are not valid overrides:\n  ${problems.join('\n  ')}`)
  return input as Overrides<DecisionModelSpec>
}

function checkDecision(where: string, d: unknown, problems: string[], complete: boolean): void {
  if (!isObject(d)) return void problems.push(`${where}: must be an object`)
  if (complete || d.type !== undefined) {
    if (!TYPES.includes(d.type as string)) problems.push(`${where}.type: one of ${TYPES.join(', ')}`)
  }
  if ((complete || d.instructions !== undefined) && typeof d.instructions !== 'string') {
    problems.push(`${where}.instructions: required string`)
  }
  if (complete || d.criteria !== undefined) {
    const c = d.criteria
    if (d.type === 'score' || Array.isArray(c)) {
      if (!Array.isArray(c) || !c.every(x => typeof x === 'string')) problems.push(`${where}.criteria: list of level labels`)
    } else if (d.type === 'choice' || isObject(c)) {
      if (!isObject(c) || !Object.values(c).every(x => x === null || typeof x === 'string')) {
        problems.push(`${where}.criteria: { option: description | null }`)
      }
    }
  }
  checkBands(`${where}.bands`, d.bands, problems)
  for (const k of ['yesAt'] as const) {
    if (d[k] !== undefined && typeof d[k] !== 'number') problems.push(`${where}.${k}: must be a number`)
  }
  if (d.enabled !== undefined && typeof d.enabled !== 'boolean') problems.push(`${where}.enabled: must be a boolean`)
  if (d.costs !== undefined) {
    const c = d.costs
    if (!isObject(c) || typeof c.falsePositive !== 'number' || typeof c.falseNegative !== 'number') {
      problems.push(`${where}.costs: { falsePositive: number, falseNegative: number }`)
    }
  }
}

function checkBands(where: string, b: unknown, problems: string[]): void {
  if (b === undefined) return
  if (!isObject(b)) return void problems.push(`${where}: { act?: number, confirm?: number }`)
  for (const k of ['act', 'confirm']) {
    if (b[k] !== undefined && typeof b[k] !== 'number') problems.push(`${where}.${k}: must be a number`)
  }
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}
