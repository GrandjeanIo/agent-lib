import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import { toAnswer, type Question, type SystemOneRequest } from './hooks/jev/core/index.ts'

// Answers the mod's $.http.fetch the way Jev would, from fixed probabilities over the tiers,
// once `gate` (when given) opens.
function jev(on: On, tiers: Record<string, number>, gate?: Promise<void>) {
  const sent: (SystemOneRequest & { authorization?: string })[] = []
  on('http.fetch', async (_$, e) => {
    const req = JSON.parse(e.init?.body ?? '{}') as SystemOneRequest
    sent.push({ ...req, authorization: e.init?.headers?.authorization })
    await gate
    const raw = (id: string, q: Question) => (id === 'model' ? tiers : q.type === 'score' ? [0.9, 0.05, 0.05, 0, 0] : 0.5)
    const answers = Object.fromEntries(Object.entries(req.questions).map(([id, q]) => [id, toAnswer(q, raw(id, q))]))
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ model: 'jev-1.13.0', answers }) } }
  })
  return sent
}

// A session that has seen `turns` prompts, with a /config model row that records what it was set to.
function session(on: On, turns: number, current = 'sonnet') {
  const set: unknown[] = []
  const state = { turns }
  on('session.turns', async () => ({ value: state.turns }))
  on('session.model', async () => ({ value: 'claude-haiku-5-5' }))
  on('config.list', async () => ({
    value: [{ key: 'model', label: 'Model', kind: 'choice', value: current, provider: { plugin: 'engine', tier: 'core' } }] as never,
  }))
  on('config.set', async (_$, e) => (set.push(e.value), { value: e.value }) as never)
  const lines: string[] = []
  on('ui.log', async (_$, e) => (lines.push(e.text), { value: undefined }))
  on('ui.status', async () => ({ value: undefined }))
  const toasts: string[] = []
  on('ui.toast', async (_$, e) => (toasts.push(e.text), { value: undefined }))
  on('prompt.submit', async (_$, e) => ({ text: e.text }) as never)
  return { set, lines, toasts, state }
}

// A prompt the person typed, unless `more` says otherwise (a command, a meta prompt, another origin).
const submit = (text: string, more: object = {}) => ({ text, wait: false, origin: { kind: 'composer' }, ...more }) as never

test('first prompt of a fresh context: jev picks the tier and the session model is set', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set, lines, toasts } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar in utils.ts'))

  expect(sent.length).toBe(1)
  expect(Object.keys(sent[0]!.questions)).toEqual(['model'])
  expect(set).toEqual(['haiku'])
  expect(lines).toEqual(['jev → haiku (0.97), was sonnet · /model to change'])
  expect(toasts).toEqual(['jev → haiku (0.97), was sonnet'])
})

test('mid-session prompt: no Jev call, model left alone', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set } = session(on, 3)

  await $.prompt.submit(submit('now just fix the typo'))

  expect(sent.length).toBe(0)
  expect(set).toEqual([])
})

test('Jev unsure: falls back to opus and says why', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.3, sonnet: 0.4, opus: 0.3 })
  const { set, lines } = session(on, 0)

  await $.prompt.submit(submit('make it better'))

  expect(set).toEqual(['opus'])
  expect(lines[0]).toMatch(/^jev → opus \(0\.10, escalate: .*\), was sonnet/)
})

test('Jev unreachable: falls back to opus and says why', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  on('http.fetch', async () => {
    throw new Error('network down')
  })
  const { set, lines } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(set).toEqual(['opus'])
  expect(lines[0]).toMatch(/^jev → opus \(0\.00, escalate: Jev unavailable: .+\), was sonnet/)
})

test('Jev answers HTTP 500: falls back to opus and says why', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  on('http.fetch', async () => ({ value: { status: 500, ok: false, headers: {}, text: 'boom' } }))
  const { set, lines } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(set).toEqual(['opus'])
  expect(lines[0]).toMatch(/^jev → opus \(0\.00, escalate: Jev unavailable: Jev returned 500\), was sonnet/)
})

test('no key in the environment: says so plainly, no Jev call, model left alone', async ($, on) => {
  mock.env(on, {})
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set, lines } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(sent.length).toBe(0)
  expect(set).toEqual([])
  expect(lines[0]).toContain('jev: no API key, model unchanged')
})

test('after /clear: the next prompt routes again even though turns() is already 1, the one after does not', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set } = session(on, 1)
  on('session.end', async (_$, e) => ({ sessionId: e.sessionId }) as never)

  await $.session.end({ reason: 'clear', sessionId: 'old', resume: { id: 'old' } } as never)
  await $.prompt.submit(submit('rename foo to bar'))
  await $.prompt.submit(submit('and the tests too'))

  expect(sent.length).toBe(1)
  expect(set).toEqual(['haiku'])
})

test('already on the right model: still says so', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { lines } = session(on, 0, 'haiku')

  await $.prompt.submit(submit('rename foo to bar'))

  expect(lines).toEqual(['jev → haiku (0.97) · /model to change'])
})

test('haiku under its higher bar: steps up to sonnet, not all the way to opus', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  // conf (0.88 - 1/3) / (2/3) = 0.82: above the 0.75 act band, under the 0.9 haiku bar.
  jev(on, { haiku: 0.88, sonnet: 0.08, opus: 0.04 })
  const { set, lines } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(set).toEqual(['sonnet'])
  expect(lines[0]).toBe('jev → sonnet (haiku 0.82 is under the 0.90 bar) · /model to change')
})

test('the haiku bar is an option', { options: { haikuConfidence: 0.8 } }, async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.88, sonnet: 0.08, opus: 0.04 })
  const { set } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(set).toEqual(['haiku'])
})

test('haiku off: jev is only asked about sonnet and opus', { options: { allowHaiku: false } }, async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = jev(on, { sonnet: 0.95, opus: 0.05 })
  const { set } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(Object.keys((sent[0]!.questions.model as { criteria: object }).criteria)).toEqual(['sonnet', 'opus'])
  expect(set).toEqual(['sonnet'])
})

test('API key from the plugin option: no env needed, sent as the bearer token', { options: { apiKey: 'from-option' } }, async ($, on) => {
  mock.env(on, {})
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(sent.map(r => r.authorization)).toEqual(['Bearer from-option'])
  expect(set).toEqual(['haiku'])
})

test('Jev hangs: the clock ends the wait and the model is left as it was', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const clock = mock.clock(on)
  on('http.fetch', () => new Promise(() => {}))
  const { set, lines } = session(on, 0, 'opus')

  const done = $.prompt.submit(submit('rename foo to bar'))
  await clock.settle()
  await clock.advance(5000)
  await done

  expect(set).toEqual([])
  expect(lines).toEqual(['jev: no answer within 5s, model unchanged'])
})

test('Jev rejects the key (401): model left alone, not escalated to opus', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'typo' })
  on('http.fetch', async () => ({ value: { status: 401, ok: false, headers: {}, text: 'unauthorized' } }))
  const { set, lines } = session(on, 0)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(set).toEqual([])
  expect(lines[0]).toMatch(/^jev: Jev returned 401, model unchanged/)
})

test('a slash command as the first input: not sent to Jev, and the prompt after it does not route', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set } = session(on, 0)

  await $.prompt.submit(submit('/model opus', { command: { name: 'model', args: 'opus' } }))
  await $.prompt.submit(submit('rename foo to bar'))

  expect(sent.length).toBe(0)
  expect(set).toEqual([])
})

for (const [what, more] of [
  ['a meta prompt', { isMeta: true }],
  ["another plugin's prompt", { origin: { kind: 'plugin', name: 'other' } }],
  ["a peer session's message", { origin: { kind: 'peer' } }],
] as const) {
  test(`${what} as the first input: not sent to Jev`, async ($, on) => {
    mock.env(on, { TYPESAFE_API_KEY: 'k' })
    const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
    const { set } = session(on, 0)

    await $.prompt.submit(submit('rename foo to bar', more))

    expect(sent.length).toBe(0)
    expect(set).toEqual([])
  })
}

test('after /clear, an attachment-only first prompt ends the claim: the next prompt does not route', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set } = session(on, 1)
  on('session.end', async (_$, e) => ({ sessionId: e.sessionId }) as never)

  await $.session.end({ reason: 'clear', sessionId: 'old', resume: { id: 'old' } } as never)
  await $.prompt.submit(submit('', { attachments: [{ type: 'image', mediaType: 'image/png' }] }))
  await $.prompt.submit(submit('what is in this screenshot?'))

  expect(sent.length).toBe(0)
  expect(set).toEqual([])
})

test('a prompt queued while Jev is still answering the first: only the first is sent', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  let release!: () => void
  const gate = new Promise<void>(resolve => (release = resolve))
  const sent = jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 }, gate)
  const { set } = session(on, 0)

  const first = $.prompt.submit(submit('rename foo to bar'))
  const second = $.prompt.submit(submit('and the tests too'))
  release()
  await Promise.all([first, second])

  expect(sent.length).toBe(1)
  expect(set).toEqual(['haiku'])
})

test("a first-turn step the engine moved to a fallback model keeps the fallback", async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.3, sonnet: 0.4, opus: 0.3 })
  session(on, 0)
  const names: string[] = []
  on('turn.step', async function* (_$, e) {
    names.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.prompt.submit(submit('make it better'))
  for await (const _ of $.turn.step({ turnId: 'turn-1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1 })) void _
  for await (const _ of $.turn.step({ turnId: 'turn-1', index: 1, model: 'claude-haiku-5-5', messageCount: 3 })) void _

  expect(names).toEqual(['claude-opus-5-5', 'claude-haiku-5-5'])
})

test('the person changes the model: the jev status line is cleared', async ($, on) => {
  const statuses: (string | undefined)[] = []
  on('ui.status', async (_$, e) => (statuses.push(e.text), { value: undefined }))
  on('config.set', async (_$, e) => ({ value: e.value }) as never)
  on('command.run', async () => ({ text: '' }) as never)

  await $.config.set({ key: 'model', value: 'opus', previous: 'haiku', origin: { kind: 'composer' } } as never)
  await $.command.run({ command: 'model', args: 'sonnet' } as never)

  expect(statuses).toEqual([undefined, undefined])
})

test('a throw in the routing: the prompt goes through, model unchanged, and it says so', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const lines: string[] = []
  on('session.turns', async () => ({ value: 0 }))
  on('config.list', async () => {
    throw new Error('config gone')
  })
  on('ui.log', async (_$, e) => (lines.push(e.text), { value: undefined }))
  on('prompt.submit', async (_$, e) => ({ text: e.text }) as never)

  await $.prompt.submit(submit('rename foo to bar'))

  expect(lines).toEqual(['jev: routing failed, model unchanged'])
})

test('the first turn after the pick names the picked model, not the one from before the switch', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  session(on, 0)
  const names: string[] = []
  on('turn.step', async function* (_$, e) {
    names.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.prompt.submit(submit('rename foo to bar'))
  for await (const _ of $.turn.step({ turnId: 'turn-1', index: 0, model: 'claude-sonnet-5-5', messageCount: 1 })) void _

  expect(names).toEqual(['claude-haiku-5-5'])
})

test('a model id the mod does not know (another provider, a newer release): the first turn keeps it', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { set } = session(on, 0)
  const names: string[] = []
  on('turn.step', async function* (_$, e) {
    names.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.prompt.submit(submit('rename foo to bar'))
  const bedrock = 'us.anthropic.claude-sonnet-5-5-v1:0'
  for await (const _ of $.turn.step({ turnId: 'turn-1', index: 0, model: bedrock, messageCount: 1 })) void _

  expect(set).toEqual(['haiku'])
  expect(names).toEqual([bedrock])
})

test('an interrupted first turn does not hand its pick to the next turn', async ($, on) => {
  mock.env(on, { TYPESAFE_API_KEY: 'k' })
  jev(on, { haiku: 0.98, sonnet: 0.01, opus: 0.01 })
  const { state } = session(on, 0)
  const names: string[] = []
  on('turn.step', async function* (_$, e) {
    names.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  // The first turn is interrupted before its first step, so no turn.step ever claims it.
  await $.prompt.submit(submit('rename foo to bar'))
  state.turns = 1
  await $.prompt.submit(submit('now something else'))
  for await (const _ of $.turn.step({ turnId: 'turn-2', index: 0, model: 'claude-sonnet-5-5', messageCount: 1 })) void _

  expect(names).toEqual(['claude-sonnet-5-5'])
})
