// Starting specs for routing decisions inside Claude Code (Module 1).
// Plain data: tune them per project with `model.tune({...})`, not by editing this file.

import { defineSpec } from '../core/index.ts'

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
