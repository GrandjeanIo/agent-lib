---
name: to-plan
description: Turn docs/intent/<slug>/intent.md into docs/intent/<slug>/plan.md — stage 2 of the intent → plan → tickets → build flow. Resolves the intent's open questions, settles the design and the test seams, and gets human approval before writing. Not yet broken into tickets.
disable-model-invocation: true
---

<!-- Adapted from Matt Pocock's [`to-spec`](https://github.com/mattpocock/skills) (MIT): the testing-seams step and the plan template. -->

# To Plan

Reads one `intent.md`, settles the design, and gets the user's
approval before writing anything. `/feature-factory:to-tickets` later
slices the plan into tracer-bullet tickets. Intents live in
`docs/intent/` of the repo `INTENT_HOME` names
(`docs/agents/project.md`). Run this there.

## Process

### 1. Find the intent

If the user passed a slug or number, use that directory. Otherwise
take the newest intent directory that has an `intent.md` and no
`plan.md`, and confirm it. Read `intent.md` in full.

### 2. Resolve open questions — don't re-interview

If `intent.md` has `## Open questions`, ask exactly those. Otherwise
synthesize from the intent, the conversation and the codebase.

### 3. Explore the codebase

Read the glossary and the ADRs in the area you're touching; flag a
contradiction rather than picking a side. When the plan spans repos,
explore each one it changes.

Identify the modules and files this touches. Sketch the seams at which
this will be tested: prefer existing seams; the fewer the better,
ideally one. Confirm them with the user: implementers treat them as
agreed and won't ask again.

### 4. Draft the plan

- **Solution** — the change from the user's perspective.
- **Decisions** — modules touched, interfaces changed, schema changes,
  API contracts. No code snippets, except one that encodes a decision
  more precisely than prose (state machine, schema shape).
- **Files that change** — concrete paths, new or modified, prefixed by
  repo when there are several. The one place paths belong.
- **Order of work** — numbered sequence of concrete steps.
- **Testing seams** — where the tests bite (external behaviour, not
  internals), which modules get tested, prior art in the codebase.
- **Risks** — what could break, rate-limit or surprise. `build` copies
  these into the PR's review list.
- **Out of scope** — including any open question this plan didn't
  resolve.

### 5. Get approval

Present the draft before writing it. This is the human-approval gate.
Iterate until the user is happy with the decisions, files, sequencing
and risks.

### 6. Write and land the file

Write `docs/intent/<NNN-slug>/plan.md`:

```markdown
# Plan: <name> (from intent.md <date>)

## Solution

## Decisions

## Files that change

## Order of work
1. ...

## Testing seams

## Risks

## Out of scope

## Tickets
<!-- filled by /to-tickets -->
```

Keep it terse: a working document read repeatedly by agents, not a
deliverable. Then get `intent.md` and `plan.md` onto main (commit, or
a small docs PR the user merges): ticket footers link to them there.

### 7. Report

Tell the user the path, and that `/feature-factory:to-tickets` is next
once the plan is on main.
