import type { Question, State, SystemOneResponse, Transport } from './types.ts'

export const DEFAULT_BASE_URL = 'https://api.typesafe.ai'
export const DEFAULT_MODEL = 'jev-latest'

export type JevClientOptions = {
  /** TypeSafe API key (env: TYPESAFE_API_KEY). Optional for a mock transport. */
  apiKey?: string
  transport: Transport
  /** `jev-latest`, `jev-preview`, or a pinned version such as `jev-1.13.0`. */
  model?: string
  /** Override for a gateway (e.g. Zuplo); `/v1/systemone` is appended. */
  baseUrl?: string
  /** Retries on 429 / 5xx / network errors. Default 2. */
  maxRetries?: number
  /** Per-attempt timeout. Default 10s. Ignored where no setTimeout exists. */
  timeoutMs?: number
}

export class JevError extends Error {
  readonly status: number | undefined
  readonly body: string | undefined
  readonly retryable: boolean

  constructor(message: string, opts: { status?: number; body?: string; retryable: boolean }) {
    super(message)
    this.name = 'JevError'
    this.status = opts.status
    this.body = opts.body
    this.retryable = opts.retryable
  }
}

/** Thin client for one endpoint. Knows nothing about thresholds or policy. */
export class JevClient {
  readonly model: string
  private readonly options: JevClientOptions

  constructor(options: JevClientOptions) {
    this.options = options
    this.model = options.model ?? DEFAULT_MODEL
  }

  async evaluate(state: State, questions: Record<string, Question>): Promise<SystemOneResponse> {
    const base = (this.options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    const url = `${base}/v1/systemone`
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (this.options.apiKey) headers.authorization = `Bearer ${this.options.apiKey}`
    const body = JSON.stringify({ model: this.model, state, questions })
    const maxRetries = this.options.maxRetries ?? 2

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.attempt(url, headers, body)
      } catch (error) {
        const retryable = !(error instanceof JevError) || error.retryable
        if (!retryable || attempt >= maxRetries) throw error
        await sleep(250 * 2 ** attempt)
      }
    }
  }

  private async attempt(url: string, headers: Record<string, string>, body: string): Promise<SystemOneResponse> {
    const res = await withTimeout(
      this.options.transport(url, { method: 'POST', headers, body }),
      this.options.timeoutMs ?? 10_000,
    )
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500
      throw new JevError(`Jev returned ${res.status}`, { status: res.status, body: res.text, retryable })
    }
    try {
      return JSON.parse(res.text) as SystemOneResponse
    } catch {
      throw new JevError('Jev returned a body that is not JSON', { status: res.status, body: res.text, retryable: false })
    }
  }
}

/** The slice of the standard `fetch` that `fetchTransport` uses. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>

// Core runs in the mod sandbox too, which has no fetch or timers, so these
// globals are typed as maybe-present rather than taken from DOM/Node lib types.
const host = globalThis as {
  fetch?: FetchLike
  setTimeout?: (fn: () => void, ms: number) => unknown
  clearTimeout?: (timer: unknown) => void
}

/** Adapts the standard `fetch` (Node, Bun, browsers) to a Transport. */
export function fetchTransport(fetchImpl: FetchLike | undefined = host.fetch): Transport {
  if (!fetchImpl) throw new Error('fetchTransport: no global fetch here; pass one in')
  return async (url, init) => {
    const res = await fetchImpl(url, init)
    return { status: res.status, ok: res.ok, text: await res.text() }
  }
}

function sleep(ms: number): Promise<void> {
  if (typeof host.setTimeout !== 'function') return Promise.resolve()
  return new Promise(resolve => host.setTimeout?.(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (typeof host.setTimeout !== 'function') return promise
  let timer: unknown
  const timeout = new Promise<never>((_, reject) => {
    timer = host.setTimeout?.(
      () => reject(new JevError(`Jev did not answer within ${ms}ms`, { retryable: true })),
      ms,
    )
  })
  return Promise.race([promise, timeout]).finally(() => host.clearTimeout?.(timer))
}
