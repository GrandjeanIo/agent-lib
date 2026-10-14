// Starting specs for routing decisions inside Claude Code (Module 1).
// Plain data: tune them per project with `model.tune({...})` or an overrides
// JSON file (see ../examples/), not by editing this file.

import { PRESETS, defineSpec } from '../core/index.ts'

/** Asked on UserPromptSubmit: how much machinery does this prompt need? */
export const promptRouter = defineSpec({
  name: 'claude-code.prompt-router',
  context: 'A developer typed this prompt into Claude Code, an agentic coding assistant working in their repository.',
  decisions: {
    model: {
      type: 'choice',
      instructions: 'Which model tier is the cheapest one that will handle this prompt well?',
      criteria: {
        haiku: 'Trivial or mechanical: a lookup, a rename, a one-line fix, formatting, a quick question about the code.',
        sonnet: 'Ordinary engineering work: implement or fix a well-scoped feature, write tests, explain a module.',
        opus: 'Hard or open-ended: architecture, subtle debugging across many files, security, ambiguous requirements.',
      },
      // Escalating means "unsure" — then spend more, not less.
      fallback: 'opus',
    },
    subagent: {
      type: 'noul',
      instructions:
        'Would this task go better if broad searching or independent parallel work were delegated to a subagent?',
      fallback: false,
    },
    size: {
      type: 'score',
      instructions: 'How large is the change this prompt asks for?',
      criteria: ['No code change', 'A few lines', 'One file', 'Several files', 'Cross-cutting / many modules'],
    },
  },
})

/** Asked on PreToolUse: should a person see this tool call before it runs? */
export const toolGuard = defineSpec({
  name: 'claude-code.tool-guard',
  context: 'Claude Code is about to run this tool call on a developer machine. Judge the call, not the person.',
  bands: PRESETS.strict,
  decisions: {
    destructive: {
      type: 'noul',
      instructions:
        'Could this tool call destroy or overwrite work that is hard to recover (deleting files, force-pushing, dropping data, resetting git state)?',
      // Missing a destructive call is ~9x worse than one needless prompt -> say yes from p >= 0.1.
      costs: { falsePositive: 1, falseNegative: 9 },
      fallback: true,
    },
    exfiltration: {
      type: 'noul',
      instructions: 'Could this tool call send secrets, credentials or private code to a third party?',
      costs: { falsePositive: 1, falseNegative: 19 },
      fallback: true,
    },
    scope: {
      type: 'choice',
      instructions: 'What does this tool call touch?',
      criteria: {
        read: 'Only reads: files, search, listing, status.',
        workspace: 'Writes inside the project working tree.',
        system: 'Writes outside the project, installs software, or changes system configuration.',
        remote: 'Talks to a remote service: push, deploy, publish, API call with side effects.',
      },
      fallback: 'system',
    },
  },
})
