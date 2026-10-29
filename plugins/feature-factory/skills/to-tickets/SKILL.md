---
name: to-tickets
description: Break docs/intent/<slug>/plan.md into tracer-bullet Linear issues in one Linear project, wired with real blocking relations — stage 3 of the intent → plan → tickets → build flow, and the last human gate.
disable-model-invocation: true
---

Adapted from Matt Pocock's [`to-tickets`](https://github.com/mattpocock/skills) (MIT): tracer-bullet slices and the expand–contract handling of wide refactors.

# To Tickets

Turns a plan into Linear issues that `/feature-factory:build` can work
with no human present. The one question it must answer from the
tracker is **what is unblocked?**, so the blocking relations decided
here also decide what runs in parallel.

Read `docs/agents/project.md` (`LINEAR_TEAM` = `T`, `REPO_LABEL`,
`INTENT_HOME`) and `docs/agents/issue-tracker.md` first.

## Process

### 1. Gather context

If the user passed a slug or number, use that directory. Otherwise
take the newest `plan.md` whose `## Tickets` section is empty, and
confirm it. Read `plan.md` in full, plus `intent.md`. No `plan.md` →
use `intent.md` and tell the user they're skipping the design stage
for a small change.

The plan must be on `INTENT_HOME`'s main, so the `Source:` URL
resolves for every repo. If it isn't, stop and say so.

### 2. Verify against the codebase

Confirm the plan's file list still matches the code. Respect ADRs in
the area.

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets:

- Each slice cuts a narrow but complete path through every layer it
  touches — vertical, not one layer.
- A completed slice is demoable or verifiable on its own.
- Each slice fits in a single fresh context window.
- Any prefactoring comes first.

Give each ticket its **blockers**: tickets that must complete before
it can start. **Two slices that will edit the same files get a blocker
edge between them**, even when neither needs the other's behaviour:
unblocked tickets run in parallel.

**Wide refactors** — one mechanical change whose blast radius spans
the codebase — are the exception. Sequence as expand–contract: expand
(add the new form beside the old), migrate (call sites in batches, one
ticket each, blocked by expand), contract (delete the old form,
blocked by every batch).

**Several repos.** A slice stays inside one repo and carries that
repo's label (`REPO_LABEL` in each repo's `project.md`). A plan whose
files span two repos yields one ticket per repo; block the dependent
one on the other and say in its body what it waits for.

### 4. Review with the user

Present a numbered list. Per ticket: **Title**, **Repo** (if several),
**Blocked by**, **What it delivers** (the thing you'd demo). Then one
line: ticket count, widest set that can run at once, critical-path
length. If nothing can run in parallel, say so and ask whether any can
be split.

Ask: granularity right? Blocking edges correct, including same-file
edges? Iterate until approved. Nothing is published before this.

### 5. Publish, one ticket at a time, in dependency order

Create a Linear project named `<NNN-slug>` (once; reuse it on re-run).
Then walk the tickets topologically so blockers exist before edges are
wired. For each ticket, finish all three before the next:

1. Create the issue in team `T`, in the project, with the template
   below, labelled `ready-for-agent` plus its repo label.
2. Append `T-<n>` and its URL to `## Tickets` in `plan.md`.
3. Add its "blocked by" relations in Linear. Prose isn't enough;
   `build` reads the relations.

Per-ticket rather than in phases, so an interrupted run leaves a
consistent state. On re-run, skip tickets already in `## Tickets`.
Commit the updated `plan.md` to `INTENT_HOME` at the end.

<issue-template>

## What to build

The end-to-end behaviour this ticket makes work, from the user's
perspective.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

---

Source: https://github.com/<owner>/<repo>/blob/main/docs/intent/<NNN-slug>/plan.md

</issue-template>

Each criterion must be checkable without the plan in hand: a command
the gate runs, or an observable behaviour. Keep file paths and code
out of the ticket.

### 6. Report

Tell the user how many tickets exist, how many are unblocked now, and
that `/feature-factory:build <NNN>` in each repo builds them.
