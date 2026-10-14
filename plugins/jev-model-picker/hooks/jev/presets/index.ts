// Every preset, by its spec name — what `jev decide --spec <name>` resolves.
import type { DecisionModelSpec } from '../core/index.ts'
import { promptRouter, toolGuard } from './claude-code.ts'

export { promptRouter, toolGuard }

export const PRESET_SPECS: Readonly<Record<string, DecisionModelSpec>> = {
  [promptRouter.name]: promptRouter,
  [toolGuard.name]: toolGuard,
}
