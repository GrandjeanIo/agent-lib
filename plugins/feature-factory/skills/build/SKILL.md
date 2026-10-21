---
name: build
description: Build one intent in this repo — stage 4 of the intent → plan → tickets → build flow. Works the frontier of the intent's Linear tickets with parallel implementer subagents on an integration branch, reviews the result with mattpocock-skills:code-review, hands small issues back for fixing, then opens one PR with a short "Review these first" list for a person to merge. Use when someone asks to build an intent by number or slug ("build intent 007", "/feature-factory:build 007"). Not for implementing an ad-hoc plan from the current conversation, or a single ticket outside an intent.
---

# Build

Read `docs/agents/project.md` first. `LINEAR_TEAM` (`T` below),
`REPO_LABEL`, `INTENT_HOME`, `SETUP`, `VERIFY` and `UNTESTED` come
from there. Linear operations follow `docs/agents/issue-tracker.md`.

The goal: every ticket of one intent that belongs to this repo,
implemented on one **integration branch**, reviewed, and opened as one
PR. A person merges it. You never merge to main.

Run one `build` per repo at a time. It is safe to re-run: the branch
name and the ticket states are the progress record, so a crashed run
resumes where it stopped.

## 1. Load the intent

The caller passes an intent number, slug or plan URL. With nothing
passed, take the oldest Linear project in team `T` that has Todo
tickets with `REPO_LABEL` and none In Progress, and confirm it.

Read `plan.md` in full, and `intent.md` beside it. When `INTENT_HOME`
is another repo, read them with
`gh api repos/<owner>/<repo>/contents/<path> -H "Accept: application/vnd.github.raw"`.

List the intent's tickets: its Linear project, filtered by
`REPO_LABEL`. Note each ticket's blockers.

## 2. Create or resume the integration branch

Work in a worktree of your own, so the user's checkout is never
switched. Under `$TMPDIR`: checking out tracked `.mcp.json` or
`.vscode/` inside the project tree can be sandbox-denied.

```
git fetch origin
git worktree add "$TMPDIR/intent-<NNN-slug>" intent/<NNN-slug> 2>/dev/null \
  || git worktree add -b intent/<NNN-slug> --no-track "$TMPDIR/intent-<NNN-slug>" origin/main
cd "$TMPDIR/intent-<NNN-slug>" && git push origin HEAD
```

Call that path `<wt>` and start every later git, `SETUP` and `VERIFY`
command with `cd <wt> && `. Remove it after step 5 with
`git worktree remove <wt>`.

A ticket whose `T-<n>:` commit is already on the branch is done for
this run, whatever its Linear state.

## 3. Work the frontier

The **frontier** is every ticket not yet on the branch whose blockers
are Done in Linear or already on the branch. A blocker in another repo
that is not Done keeps its ticket off the frontier: report it as
`waiting on <repo> T-<b>`.

Spawn up to 3 `feature-factory:implementer` agents at once, in a
single message, with `isolation: "worktree"` and `run_in_background:
true`. Move each ticket to In Progress. Prompt with pointers only:

```
Ticket T-<n>. Plan: <plan URL>. Base: intent/<NNN-slug> at <sha>.
```

When an implementer returns its branch:

1. `git merge --no-ff <branch>` (its local branch; worktrees share
   refs) into the integration branch, then
   `SETUP` and `VERIFY`.
2. Conflict or red gate → `git merge --abort` (or reset to the
   previous tip), and send the implementer back with SendMessage:
   rebase onto the new tip and re-run `VERIFY`. Twice failing → leave
   the ticket out and put it on the human list (step 5).
3. Green → `git push origin HEAD`, delete the ticket branch, and
   refill the frontier.

Repeat until the frontier is empty.

## 4. Review and fix

Call the Skill tool for `mattpocock-skills:code-review` with fixed
point `origin/main` and the plan URL as the spec. Sort every finding:

- **Hand back**: a concrete failure path, a spec miss, an acceptance
  criterion with no test that fails on revert, behaviour the plan
  doesn't include (validation, retries, fallbacks, options), a broken
  documented rule, an unsafe input reaching a query, shell, path, HTML
  sink or prompt, a secret in code.
- **For the human**: a call the plan left open that the implementer
  made, any change to auth, access control, payments or a data
  migration, judgement-call smells, anything still open after round 2.

Hand-back findings go to one `implementer`, on the integration branch,
in one prompt (`Fix on intent/<NNN-slug> round <r>: <findings, each
with its cause>`). Merge and gate its branch as in step 3. At most 2
rounds; then run `VERIFY` once more.

## 5. Open the PR

Write the body to a file, then:

```
gh pr create --base main --head intent/<NNN-slug> --title "<intent name>" --body-file <file>
```

```markdown
Intent: <plan URL>
Closes T-<n>
Closes T-<m>
Depends on: <owner/repo#pr>          <!-- only when another repo's PR must merge first -->

## Review these first

1. <file:line or area>: <why it is risky>. Check: <one concrete thing to look at or try>
2. ...

## What changed

- T-<n>: <one line>

<details><summary>Review notes (non-blocking)</summary>

- <notes, and what each fix round resolved>

</details>
```

"Review these first" holds at most 7 items, most important first. Take
them from the human findings, the plan's Risks, tickets left out, and
`UNTESTED` where the diff depends on it. Auth, access control and data
migrations always get an item. Nothing worth a look → write `Nothing
stands out; the gate and review passed.`

List every ticket that is on the branch under `Closes`. Move them to
In Review and comment the PR URL on each.

## 6. Report

The PR URL, tickets built, tickets left out and why, and tickets
waiting on another repo.
