// JEV picks the model tier from the first prompt of a fresh context.
// `./jev/` is the JEV decision model, owned by this repo.
import type { PromptSubmitInput, Register } from 'claude-code'
import { JevError, clientFromEnv, createDecisionModel, merge } from './jev/core/index.ts'
import { promptRouter } from './jev/presets/claude-code.ts'

// The hook sandbox has no timers, so a hung Jev is bounded by the clock instead. The hook's
// 10s budget counts this wait too, so it has to fire well inside it.
const JEV_WAIT_MS = 5000

// The request names a full model id; the /config row keeps the alias. The mod API can't resolve
// an alias, so these are first-party ids of one release. A step that names any other id (Bedrock,
// Vertex, a gateway, a newer release) is left alone: the /config switch applies from the next prompt.
const MODEL_IDS: Record<string, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
  opus: 'claude-opus-5-5',
}
const KNOWN_IDS = new Set(Object.values(MODEL_IDS))

// Only words the person typed go to Jev: no slash command (a "/model opus" is their own pick), no
// prompt they don't see, and nothing a notification, a peer, a schedule or a plugin queued.
const USER_ORIGINS = new Set<PromptSubmitInput['origin']['kind']>(['composer', 'bridge', 'sdk'])
const routable = (e: PromptSubmitInput) =>
  !!e.text.trim() && !e.command && !e.isMeta && USER_ORIGINS.has(e.origin.kind)

// The work's answer, or undefined once the wait ends first. The loser's promise is left to settle.
async function within<T>(work: Promise<T>, wait: (signal: AbortSignal) => Promise<void>): Promise<T | undefined> {
  const stop = new AbortController()
  // An aborted wait rejects, and must not count as the clock running out.
  const late = wait(stop.signal).then(
    () => ({ late: true as const }),
    () => new Promise<never>(() => {}),
  )
  work.catch(() => undefined)
  try {
    const got = await Promise.race([work.then(value => ({ value })), late])
    return 'late' in got ? undefined : got.value
  } finally {
    stop.abort()
  }
}

export const register: Register = (on, options) => {
  const apiKey = typeof options.apiKey === 'string' ? options.apiKey.trim() : ''
  const allowHaiku = options.allowHaiku !== false
  // A bar outside 0..1 (or NaN) can't be met or is meaningless, so clamp it.
  // A bar that isn't a number at all falls back to the default.
  const haikuBar =
    typeof options.haikuConfidence === 'number' && Number.isFinite(options.haikuConfidence)
      ? Math.min(1, Math.max(0, options.haikuConfidence))
      : 0.9

  // Only the model question is asked. Size was never shown, so it isn't sent.
  const { haiku: _, ...upTiers } = promptRouter.decisions.model.criteria
  const spec = merge(promptRouter, {
    decisions: {
      subagent: { enabled: false },
      size: { enabled: false },
      ...(allowHaiku ? {} : { model: { criteria: upTiers } }),
    },
  })

  // The turn has already resolved its model when the prompt is submitted, so the /config
  // switch only lands from the next prompt on. The first turn's requests are rewritten here.
  let pending: string | undefined
  let firstTurn: string | undefined
  // The model the first turn's opening step named. A later step naming another is a fallback's.
  let firstModel: string | undefined
  // After /clear, turns() is already 1 (the /clear record opens the new transcript), so the
  // clear itself is what marks the next prompt as the first of a fresh context.
  let cleared = false
  // Set before the first await, so a prompt queued while Jev answers can't route a second time.
  let claimed = false

  on('session.end', async ($, e, next) => {
    claimed = false
    if (e.reason === 'clear') cleared = true
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const first = !claimed
    claimed = true
    // Mid-session: leave the model alone. Only a new session or a /clear routes again.
    const fresh = first && (cleared || (await $.session.turns()) === 0)
    // The first prompt of a fresh context ends the claim, whether or not it routes.
    cleared = false
    if (!fresh || !routable(e)) {
      // A first turn that was interrupted before its first step never set firstTurn, so its pick
      // would otherwise land on the next turn. Any later prompt ends that claim, except one typed
      // into the first turn while it runs.
      if (!e.turnId || e.turnId !== firstTurn) pending = firstTurn = firstModel = undefined
      return next(e)
    }

    // The plugin option (secure storage) wins; the environment is the fallback.
    const key = apiKey || (await $.env.get('TYPESAFE_API_KEY'))
    const mock = await $.env.get('JEV_MOCK')
    if (!key && mock !== '1') {
      $.ui.log(
        'jev: no API key, model unchanged. Set "TypeSafe API key" in /plugin → jev-model-picker, or export TYPESAFE_API_KEY before starting claude',
      )
      return next(e)
    }

    // `$` can't cross an import, so the glue lives here: env in, $.http.fetch as the transport.
    // Only the key and mock flag are passed. TYPESAFE_BASE_URL and JEV_MODEL are not read: the
    // endpoint and model are fixed, see README "Data and privacy".
    const client = clientFromEnv({ TYPESAFE_API_KEY: key, JEV_MOCK: mock }, (url, init) => $.http.fetch(url, init), {
      maxRetries: 0,
    })
    const router = createDecisionModel(spec, { client, onError: 'throw' })
    let decision
    try {
      decision = (await within(router.decide(e.text), signal => $.clock.sleep(JEV_WAIT_MS, { signal })))?.decisions.model
    } catch (error) {
      // A 4xx (a mistyped or revoked key) won't fix itself. Escalating would move every session to Opus.
      if (error instanceof JevError && !error.retryable) {
        $.ui.log(`jev: ${error.message}, model unchanged. Check the TypeSafe API key in /plugin → jev-model-picker`)
        return next(e)
      }
      // Unreachable Jev escalates to the fallback, as an unsure one does.
      const message = error instanceof Error ? error.message : String(error)
      const reason = `Jev unavailable: ${message}`
      decision = { value: spec.decisions.model.fallback, confidence: 0, band: 'escalate' as const, reason }
    }
    // A slow Jev changes nothing: no answer is no reason to override the model the person had.
    if (!decision) {
      $.ui.log(`jev: no answer within ${JEV_WAIT_MS / 1000}s, model unchanged`)
      return next(e)
    }
    const { value, confidence, band, reason } = decision
    // Decision.value is typed as possibly undefined, and the model written below is typed from it,
    // so this narrows the type. It can't fire at runtime: an escalation always carries a tier.
    if (!value) return next(e)

    // A wrong downgrade costs more than a wrong upgrade: Haiku needs its own, higher bar.
    // Below it, step up one tier rather than all the way to the fallback.
    const underBar = value === 'haiku' && confidence < haikuBar
    const model = underBar ? 'sonnet' : value
    const conf = confidence.toFixed(2)
    let why = `${conf}, ${band}: ${reason}`
    if (underBar) why = `haiku ${conf} is under the ${haikuBar.toFixed(2)} bar`
    else if (band === 'act') why = conf

    const row = (await $.config.list()).find(row => row.key === 'model')
    const set = row ? await $.config.set({ key: 'model', value: model }) : { deny: 'no model row in /config' }
    if ('deny' in set && set.deny) {
      $.ui.log(`jev: wanted ${model} (${why}), but ${set.deny}`)
      return next(e)
    }
    // session.model() still reports the model from before this switch, so the first turn names the pick directly.
    pending = MODEL_IDS[model]

    // The transcript line stays put, so the switch is visible before the cache grows and
    // /model is still cheap; the toast is the moment it happens.
    const from = row?.value
    const was = from && from !== model ? `, was ${from}` : ''
    $.ui.log(`jev → ${model} (${why})${was} · /model to change`)
    $.ui.toast(`jev → ${model} (${why})${was}`, { timeoutMs: 6000 })
    $.ui.status(`jev → ${model}`)
    return next(e)
  }).catch(($, e, next) => {
    // Throws and budget overruns both land here. Without this the prompt goes through with no log line.
    $.ui.log('jev: routing failed, model unchanged')
    return next(e)
  })

  // The person's own model change makes the jev status stale. This plugin's own config.set isn't seen here.
  on('config.set', { key: 'model' }, async ($, e, next) => {
    $.ui.status(undefined)
    return next(e)
  })
  on('command.run', { command: 'model' }, async ($, e, next) => {
    $.ui.status(undefined)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    if (pending && e.index === 0) {
      firstTurn = e.turnId
      firstModel = e.model
    }
    // Only the model the turn opened on is rewritten. A step the engine moved to a fallback keeps it.
    if (e.turnId !== firstTurn || !pending || e.model !== firstModel || !KNOWN_IDS.has(e.model)) return yield* next(e)
    return yield* next({ ...e, model: pending })
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && e.turnId === firstTurn) pending = firstTurn = firstModel = undefined
    return next(e)
  })
}
