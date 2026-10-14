---
name: next-pr
description: Entry point invoked by a polling loop (or a person) to review implementation PRs. Claims every takeable `needs-review` PR this tick (no reviewer requested, not held), then spawns one `pr-reviewer` subagent per claim, all in parallel, each in its own isolated worktree. Each reviewer checks its PR against its ticket's plan and the verify gate on the merge result, then merges it (closing the Linear ticket), sends it back, or escalates. Use when a scheduler checks for PRs on an interval, or someone asks to "review the queue".
---

# Next PR

Dispatcher for the review half of the pipeline; mirrors `next-ticket`.
It decides and claims the whole batch for this tick, serially, then fans
out one `pr-reviewer` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/`) per claim. Review
logic lives in the subagent.

`docs/agents/project.md` may define `MAX_REVIEW_SPAWN` (per-tick cap;
default: no cap) and `REVIEWER_LOGIN`.

## Process

Before step 1, **check the reviewer identity** if `REVIEWER_LOGIN` is
set. Run `gh api user -q .login`. If it differs from `REVIEWER_LOGIN`,
this session is logged in as the wrong account: send a push
notification naming both logins, report `Wrong reviewer login: <login>,
expected <REVIEWER_LOGIN>. See review-identity.md.`, and stop. Run no
sweeps and claim nothing; they would act as the wrong account.

1. **Run the stale review-claim sweep, then the spawn pre-check**
   (`${CLAUDE_PLUGIN_ROOT}/docs/pipeline-housekeeping.md`). A reviewer that crashed
   or stopped leaves its claim behind, and a claimed PR is never taken
   again. A released PR is a candidate for this very tick. If the
   pre-check says don't spawn, skip to step 5.

2. **Plan the batch.** Re-fetch the open PRs exactly as
   `${CLAUDE_PLUGIN_ROOT}/agents/pr-reviewer.md` step 1 does (unfiltered list, labels filtered
   locally, oldest first). The batch is every `needs-review` PR with no
   reviewer requested that is not **held** (same file, step 1). Stop at
   `MAX_REVIEW_SPAWN` if set, keeping the oldest.

   Non-held PRs never overlap each other: a PR whose `## Touches`
   collides with an older pipeline PR is held by definition. So the
   whole batch can be reviewed at once without lane conflicts.

3. **Claim every batch item here, one at a time, before spawning.**

   ```
   gh pr edit <n> --add-reviewer "$(gh api user -q .login)"
   ```

   Re-read the PR first; if it has gained a reviewer or lost
   `needs-review`, another loop got it: drop it. If the claim command
   fails (including GitHub refusing self-review), stop claiming, send a
   push notification with the reason, and spawn nothing for that PR.
   That is the reviewer-identity setup failing
   (`${CLAUDE_PLUGIN_ROOT}/docs/review-identity.md`); every later claim would fail the
   same way, so spawn only what was already claimed.

4. **Spawn one `pr-reviewer` per claimed PR, all in a single message**
   (several Agent tool calls in one response) so they run concurrently.
   Each prompt is `Dispatched: PR #<n>. Already claimed as reviewer by
   the dispatcher.` Use the Agent tool with `subagent_type:
   feature-factory:pr-reviewer`, never the Skill tool: each
   reviewer needs its own isolated worktree to check out and test its
   PR.

   If a reviewer stopped because approving failed, send a push
   notification with the reason, as in step 3.

5. **Decide whether the sweeps run this tick.** They do if any reviewer
   ran in step 4, or if the tick's minute past the hour is under 10
   (about once an hour on a 10-minute loop). Otherwise skip to step 7.
   Both sweeps look back far enough that an hourly run misses nothing,
   and a merge is the only event that gives them new work. Run them
   once, after **all** reviewers have returned.

   **Run the completed-intent sweep** (`${CLAUDE_PLUGIN_ROOT}/docs/pipeline-housekeeping.md`).
   It reports; it does not move anything.

6. **Run the merged-PR sweep** after that (same file). It closes any
   ticket whose `Closes T-<n>` PR has merged but that isn't Done: PRs a
   person merged, and merges where Linear's integration didn't fire.
   Unlike the intent sweep, this one acts.

7. **Report.** If step 1 skipped the spawn, the first line is the
   pre-check's `Skipped spawn: <reason>`, verbatim, then any review
   claims the sweep released. Otherwise one line
   per reviewer, as-is (merged, changes requested, escalated, held),
   then `Reviewed <k>. Left: <m> (<reason: held | MAX_REVIEW_SPAWN |
   claimed elsewhere>).` Then what the sweeps found, or `Sweeps skipped
   this tick.`

## Why the dispatcher claims

Requesting yourself as reviewer is the claim. If several reviewers
picked their own PR, they would all snapshot the queue before any claim
landed and could review the same PR. Selecting and claiming serially in
one place, then spawning, removes that race inside a tick. Across
independent loops the re-read in step 3 is the guard.

Parallel reviewers merge into the same main, so all but the first to
merge will see `BASE-MOVED` in `pr-reviewer` step 7 and re-run the
gate. That is the cost of parallel review, and it is safe: the batch's
lanes are disjoint, so the re-run normally passes. If gate re-runs
dominate, set `MAX_REVIEW_SPAWN`.
