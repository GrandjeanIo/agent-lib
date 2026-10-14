// Building a client from whatever host the code runs in: one rule for every
// host, so a mod, a skill script and a test agree on what the env means.
//
// A Claude Code mod cannot hand `$` to imported code (the engine follows `$`
// only within the hook's own file), so a mod writes the glue itself:
//
//   const client = clientFromEnv(
//     { TYPESAFE_API_KEY: await $.env.get('TYPESAFE_API_KEY'), JEV_MOCK: await $.env.get('JEV_MOCK') },
//     (url, init) => $.http.fetch(url, init),
//   )
import { JevClient, type JevClientOptions } from './client.ts'
import { mockTransport } from './mock.ts'
import type { Transport } from './types.ts'

export const API_KEY_ENV = 'TYPESAFE_API_KEY'
export const BASE_URL_ENV = 'TYPESAFE_BASE_URL'
export const MODEL_ENV = 'JEV_MODEL'
/** Set to "1" to force the offline mock (workshop demos). */
export const MOCK_ENV = 'JEV_MOCK'

export type HostClientOptions = Omit<JevClientOptions, 'transport' | 'apiKey'> & {
  /**
   * What to do when no API key is set. "mock" answers offline (results say
   * model "jev-mock"); "escalate" (default) sends anyway, so every decision
   * escalates with a 401 — never a silent guess.
   */
  withoutKey?: 'mock' | 'escalate'
}

/** One rule for every host: env decides key, base URL, model and mock mode. */
export function clientFromEnv(
  env: Readonly<Record<string, string | undefined>> | ((name: string) => string | undefined),
  transport: Transport,
  options: HostClientOptions = {},
): JevClient {
  const read = typeof env === 'function' ? env : (name: string) => env[name]
  const apiKey = read(API_KEY_ENV) || undefined
  const mock = read(MOCK_ENV) === '1' || (!apiKey && options.withoutKey === 'mock')
  return new JevClient({
    ...options,
    apiKey,
    baseUrl: options.baseUrl ?? (read(BASE_URL_ENV) || undefined),
    model: options.model ?? (read(MODEL_ENV) || undefined),
    transport: mock ? mockTransport() : transport,
  })
}
