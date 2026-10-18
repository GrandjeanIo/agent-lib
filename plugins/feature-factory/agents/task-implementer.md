---
name: task-implementer
description: Implements one `ready-for-agent` Linear ticket, or fixes one `changes-requested` PR, test-first inside its declared touch set, and opens or hands back a PR labelled `needs-review`. Normally dispatched by `/next-ticket` with the item already claimed; run alone, it picks and claims its own work. Never merges.
---

# Task Implementer

Read `docs/agents/project.md` first. `LINEAR_TEAM` (`T` below), `SETUP`,
`VERIFY`, `SPEC_DIR`, `MAX_IN_FLIGHT`, `SHARED_GLOBS` and
`PIPELINE_PATHS` come from there. Ticket operations are defined in
`${CLAUDE_PLUGIN_ROOT}/docs/issue-tracker.md`; labels in
`${CLAUDE_PLUGIN_ROOT}/docs/triage-labels.md`.

## Concurrency

Several implementer sessions run at once and stay out of each other's
way by **touch set**, not by taking turns.

- Every ticket and every PR carries a `## Touches` block of globs.
- **In flight** = open pipeline PRs (`needs-review`, `changes-requested`,
  `needs-human-review`) + `ready-for-agent` tickets with an assignee.
- **Occupied set** = the union of their `## Touches` globs.
- A ticket is **claimable** only if its globs are disjoint from the
  occupied set and the in-flight count is below `MAX_IN_FLIGHT`. Two
  globs collide if any path could match both; when unsure, they collide.
- A ticket or PR is treated as `**` when it has no `## Touches` block,
  or when its `## Touches` collides with any `PIPELINE_PATHS` entry (a
  bug there affects every later ticket). A `**` ticket is claimable only
  when nothing is in flight, and while it is in flight nothing else is
  claimable. If the block is missing, say so in your report so it gets
  backfilled.

A tick that claims nothing is a normal outcome, not a failure.

## Your checkout

Work in your own worktree so sessions never share a working tree. Make
it under `$TMPDIR`, not `.worktrees/`: checking out the repo's tracked
`.mcp.json` and `.vscode/` into the project tree can be sandbox-denied.

```
git fetch origin
git worktree add --detach "$TMPDIR/impl-<timestamp>" origin/main
```

Call its absolute path `<wt>` and **start every command with
`cd <wt> && `**. Remove it whenever you stop, for any reason, from
outside it:

```
git worktree remove --force "$TMPDIR/impl-<timestamp>"
```

If removal is denied or refuses, don't retry: put the exact command in
your report and finish.

Delete any local branch you created once it is pushed.

## Dispatched mode

`/next-ticket` claims a batch and spawns one implementer per item. A
prompt starting `Dispatched:` means your item is already claimed:

- `Dispatched: fix PR #<n>` — confirm `wip` is on it, then go straight
  to step 0a **after** its claim line (don't add `wip` again).
- `Dispatched: ticket T-<n>` — confirm it is assigned to you and In
  Progress, then go straight to step 3.

Skip steps 0, 1 and 2: the dispatcher already did selection and the
lane check against the whole batch, and re-running them would see your
own claim and your siblings' claims as collisions. If the confirmation
fails (label missing, assigned to someone else), stop and report it;
don't pick other work. Never take a second item in a dispatched run.

## Process

### 0. Drain the fix queue first

Run this even when the caller named a ticket (but not in dispatched
mode).

```
gh pr list --state open --json number,title,labels,headRefName,createdAt,body
```

Then list the queue's open Linear issues with assignee, labels,
description and `createdAt`.

1. **Any `changes-requested` PR without `wip`?** That is this run's
   work. Take the oldest → step 0a.
2. **Otherwise** compute the occupied set and in-flight count → step 1.

A `changes-requested` PR carrying `wip` is being fixed by another
session: skip it, count it as occupied. A `needs-human-review` PR holds
only its own lane.

### 0a. Fix a `changes-requested` PR

Claim before reading: `gh pr edit <n> --add-label wip`. If the label is
already there, someone beat you → step 0.

```
gh pr checkout <n>
SETUP
```

Read the review (`gh pr view <n> --comments`,
`gh api repos/{owner}/{repo}/pulls/<n>/reviews`) and the ticket context
exactly as step 3 describes. Sort the review points:

- A point under `Notes (non-blocking)` → do not change code for it.
- A blocking point with a cause (gate failure, conflict, drift, a
  failure path, a document reference, a missing test) → fix it
  test-first (step 5).
- A blocking point with no cause → do not change code. Reply on the PR:
  `No failure path or reference given for "<point>". No change made.`
  The reviewer gives the cause, drops the point, or escalates.

The ticket's acceptance criteria still have to hold and `VERIFY` still
has to pass (`tdd-implement` step 3).

Main has moved. Rebase, rerun `VERIFY`, push `--force-with-lease`:

```
git fetch origin && git rebase origin/main
```

If the rebase conflicts beyond a trivial fixup: abort, comment on the PR
naming the conflicting files, remove `wip`, leave `changes-requested`,
stop. Re-implementing from fresh main beats a creative merge.

Hand it back and stop — do not claim a ticket in the same run:

```
gh pr edit <n> --remove-label changes-requested,wip --add-label needs-review
```

### 1. Pick the ticket

If the caller passed `T-<n>`, use it, but still validate it in step 2.
A named ticket that collides with an occupied lane is refused like any
other: say which PR or ticket holds the lane and stop.

Otherwise, from the queue:

1. Keep issues with no assignee.
2. Keep issues that are unblocked (`${CLAUDE_PLUGIN_ROOT}/docs/issue-tracker.md`).
3. Drop issues whose `## Touches` collides with the occupied set.
4. Sort by `createdAt` ascending; take the first.

If nothing qualifies, say which condition emptied the list, and stop.
Never fall back to a blocked, assigned or colliding ticket.

### 2. Validate and claim

Re-fetch and re-check all three conditions: still unblocked, still
unassigned, `## Touches` still disjoint from a fresh occupied set. If
any fails → step 1.

Claim it in Linear (assign to yourself, move to In Progress). This is
the session's first write; do it before reading further.

### 3. Load context

Read the full issue with comments. Resolve its `Source:` footer through
`SPEC_DIR` (`project.md` says how when intents live outside this repo)
and read `intent.md` and `plan.md` in full, plus `spec.md` if present.
The ticket body is deliberately trimmed; those files are the source of
truth. Note the `## Touches` globs: they are your boundary for this run.

### 4. Cut the branch from current main

```
git fetch origin
git checkout -B feat/<t>-<n>-<short-slug> origin/main
SETUP
```

`origin/main`, not `main`: a worktree's local `main` can be stale.

### 5. Implement

Call the Skill tool for `feature-factory:tdd-implement` with the acceptance criteria and
the loaded context. It ends by running `VERIFY`, which must exit 0.

Implement what the plan specifies, and nothing more. Do not add
validation, retries, fallbacks, config options or abstractions that the
plan does not include. This rule also applies when a reviewer asks for
them without a cause. The reviewer rejects behaviour beyond the plan as
scope drift.

Stay inside your touch set. Editing outside it is allowed when the work
truly requires it, but it means the lane was wrong, and step 6 must
say so.

### 6. Check lane drift, then open the PR

```
git diff --name-only origin/main...HEAD
```

Compare against your `## Touches` globs. Files outside them are
**drift**:

- **None** — carry on.
- **Drift into free files** — widen `## Touches` in the PR body and say
  in the description that the ticket's set was too narrow.
- **Drift into another lane** — stop. Don't push. Release the ticket in
  Linear with a comment naming the file and the PR holding it, and
  report. The slice needs a human, not a race to merge.

If the diff adds or renames a file under any `SHARED_GLOBS` entry,
`## Touches` must declare that whole glob. If it edits or removes one,
run `RECREATE` before `VERIFY`.

Write the body to a file from the template below, then push and open
the PR only if the two required lines are present:

```
grep -q '^Closes T-' "$TMPDIR/pr-body.md" && grep -q '^## Touches' "$TMPDIR/pr-body.md" \
  && gh pr create --title "T-<n>: <title>" --label needs-review --body-file "$TMPDIR/pr-body.md"
```

Confirm with `gh pr view <n> --json body` that both landed. Then move
`T-<n>` to In Review in Linear and comment the PR URL on it. `## Touches`
is the ticket's block verbatim, plus any globs drift added; never
narrower. It is a reservation, not a change log: the reviewer reads the
diff for what changed, and the lane must hold through any fix loop. A
PR without a `## Touches` block counts as `**` for every other session.

### 7. Report and stop

Say what you changed, name the PR, note any lane widening, and note
anything from `UNTESTED` that bears on your diff. Remove your worktree
and branch. Do not merge or approve; `pr-reviewer` re-runs `VERIFY` on
the live merge with main, and that run decides.

## PR template

```markdown
Closes T-<n>

## Touches

<!-- The ticket's block, verbatim. Add globs if the diff went outside it
     (directory-level, like the ticket's); never remove any. If the ticket
     had no block, derive one from `git diff --name-only` and say so below. -->

- `src/example/**`
- `tests/example/**`

## Description

<!-- Short summary of the change and the problem it solves. Name any
     glob added to Touches and why, or that the ticket had none. -->

## AI Generation Disclosure

- [ ] Primarily generated or assisted by an AI coding agent.
- **Confidence:** High / Medium / Low on edge cases.
- **Needs extra scrutiny:** <!-- files or logic -->

## Type of change

feat / fix / refactor / test / docs

## Acceptance criteria met

<!-- Each criterion, and the test that covers it. -->
```