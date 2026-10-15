---
name: to-plan
description: Turn docs/intent/<slug>/intent.md into docs/intent/<slug>/plan.md — stage 2 of the intent → plan → tickets flow. Resolves the intent's open questions, settles the design and the test seams, and gets human approval before writing. Not yet broken into tickets.
disable-model-invocation: true
---

# To Plan

Reads one `intent.md`, settles the design, and gets the user's
approval before writing anything. `/feature-factory:to-ticket` later slices the plan
into tracer-bullet tickets. `SPEC_DIR` in `docs/agents/project.md`
names the directory and the template.

## Process

### 1. Find the intent

If the user passed a slug or number, use that directory. Otherwise
take the newest intent directory that has an `intent.md` and no
`plan.md`, and confirm it. Read `intent.md` in full. If a `spec.md`
exists (older intents), read it too and build on it rather than
re-deciding.

### 2. Resolve open questions — don't re-interview

If `intent.md` has `## Open questions`, ask exactly those. Otherwise
synthesize from the intent, the conversation and the codebase.

### 3. Explore the codebase

Read the glossary and relevant `docs/adr/` (`${CLAUDE_PLUGIN_ROOT}/docs/domain.md`;
`project.md` says where they are). Respect ADRs in the area you're
touching; flag a contradiction rather than picking a side.

Identify the modules and files this touches. Sketch the seams at which
this will be tested: prefer existing seams; the fewer the better,
ideally one. Confirm them with the user.

### 4. Draft the plan

- **Solution** — the change from the user's perspective.
- **Decisions** — modules touched, interfaces changed, schema changes,
  API contracts. No file paths or code snippets; they go stale.
  Exception: a snippet that encodes a decision more precisely than
  prose (state machine, schema shape), trimmed to the decision-rich
  part.
- **Files that change** — concrete paths, new or modified. This is the
  one place paths belong.
- **Order of work** — numbered sequence of concrete steps.
- **Testing seams** — where the tests bite (external behaviour, not
  internals), which modules get tested, prior art in the codebase.
  Prefer the fewest tests that prove the criteria; if a test-audit
  skill is available, run it over the proposed tests.
- **Risks** — what could break, rate-limit or surprise.
- **Proof** — which tests, which manual check.
- **Out of scope** — including any intent.md open question this plan
  didn't resolve.

### 5. Get approval

Present the draft before writing it. This is the human-approval gate.
Iterate until the user is happy with the decisions, files, sequencing
and risks.

### 6. Write the file

`SPEC_DIR/plan.md`, following the template if present, otherwise:

```markdown
# Plan: <name> (from intent.md <date>)

## Solution

## Decisions

## Files that change

## Order of work
1. ...

## Testing seams

## Risks

## Proof

## Out of scope

## Tickets
<!-- filled by /to-ticket -->
```

Keep it as terse as `intent.md`: a working document read repeatedly by
you and an agent, not a deliverable.

### 7. Report

Tell the user the path, and that `/feature-factory:to-ticket` is next. Nothing to
update in `intent.md`: the presence of `plan.md` is what marks the
intent planned.
