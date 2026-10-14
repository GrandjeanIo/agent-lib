// JEV picks the model tier from the first prompt of a fresh context.
// `./jev/` is the JEV decision model, owned by this repo.
import type { Register } from 'claude-code'
import { clientFromEnv, createDecisionModel } from './jev/core/index.ts'
import { promptRouter } from './jev/presets/claude-code.ts'

export const register: Register = (on, options) => {
  const apiKey = typeof options.apiKey === 'string' ? options.apiKey.trim() : ''
  const allowHaiku = options.allowHaiku !== false
  // A bar outside 0..1 (or NaN) can't be met or is meaningless, so clamp it, and fall back to the default when it isn't a number at all.
  const haikuBar =
    typeof options.haikuConfidence === 'number' && Number.isFinite(options.haikuConfidence)
      ? Math.min(1, Math.max(0, options.haikuConfidence))
      : 0.9

  // The turn has already resolved its model when the prompt is submitted, so the /config
  // switch only lands from the next prompt on. The first turn's requests are rewritten here.
  let pending: string | undefined
  let firstTurn: string | undefined
  // After /clear, turns() is already 1 (the /clear record opens the new transcript), so the
  // clear itself is what marks the next prompt as the first of a fresh context.
  let cleared = false

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') cleared = true
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // Mid-session: leave the model alone. Only a new session or a /clear routes again.
    if (!e.text.trim()) return next(e)
    if (!cleared && (await $.session.turns()) > 0) return next(e)
    cleared = false

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
    const client = clientFromEnv({ TYPESAFE_API_KEY: key, JEV_MOCK: mock }, (url, init) => $.http.fetch(url, init), {
      maxRetries: 0,
    })
    // Only the model question matters here; size is kept for the notice.
    const { haiku: _, ...upTiers } = promptRouter.decisions.model.criteria
    const router = createDecisionModel(promptRouter, { client }).tune({
      decisions: { subagent: { enabled: false }, ...(allowHaiku ? {} : { model: { criteria: upTiers } }) },
    })
    const r = await router.decide(e.text)
    const { value, confidence, band, reason } = r.decisions.model
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
    pending = await $.session.model()

    // The transcript line stays put, so the switch is visible before the cache grows and
    // /model is still cheap; the toast is the moment it happens.
    const from = row?.value
    const was = from && from !== model ? `, was ${from}` : ''
    $.ui.log(`jev → ${model} (${why}) for this session${was} · /model to change`)
    $.ui.toast(`jev → ${model} (${why})${was}`, { timeoutMs: 6000 })
    $.ui.status(`jev → ${model}`)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    if (pending && e.index === 0) firstTurn = e.turnId
    if (e.turnId !== firstTurn || !pending) return yield* next(e)
    return yield* next({ ...e, model: pending })
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && e.turnId === firstTurn) pending = firstTurn = undefined
    return next(e)
  })
}
