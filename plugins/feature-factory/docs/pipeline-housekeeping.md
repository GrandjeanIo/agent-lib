# Pipeline housekeeping

Four sweeps and two checks, all cheap and idempotent. Sweeps rather
than side effects of one merge: a sweep catches what an earlier tick
missed.

| Sweep or check | Owner | Runs |
| --- | --- | --- |
| Stale claims (tickets, `wip`) | `/next-ticket` | before claiming the tick's batch |
| Stale review claims | `/next-pr` | before the spawn pre-check |
| Review-loop watchdog | `/next-ticket` | after the stale-claim sweep |
| Spawn pre-check | `/next-ticket`, `/next-pr` | right before spawning |
| Completed intents | `/next-pr` | after the tick's reviewers ran, else about hourly |
| Merged PRs, open tickets | `/next-pr` | after the completed-intents sweep |

`T` is `LINEAR_TEAM` from `docs/agents/project.md`.

## Stale claims

Assigning a ticket is how a session claims a lane. A session that
crashes between claiming and opening its PR holds that lane forever.

A claim is **stale** when all three hold:

- the issue is open, in the agent queue, and has an assignee;
- no open PR closes it: no `Closes T-<n>` in any PR body and no
  `feat/<t>-<n>-*` head branch;
- its `updatedAt` is more than **3 hours** old.

Three hours is generous on purpose. Releasing a live claim costs one
wasted tick; leaving a dead one blocks a lane until a person notices.

Release it, and say so: comment `Claim released by the stale-claim
sweep: assigned since <when>, no open PR. Returning it to the queue.`,
then unassign and move it back to Todo. The comment is what lets the
next session tell a crash from a decision.

### `wip` on a fix PR

A session that crashes while fixing a `changes-requested` PR leaves
`wip` on it, and the fix queue skips it forever. A `wip` label is
**stale** when the PR is open, still `changes-requested`, and its
latest `wip` label event is more than **3 hours** old:

```
gh api "repos/{owner}/{repo}/issues/<n>/events" --paginate \
  --jq '[.[] | select(.event=="labeled" and .label.name=="wip")] | last | .created_at'
```

Release it: comment `Fix claim released by the stale-claim sweep: wip
since <when>. Returning it to the fix queue.`, then
`gh pr edit <n> --remove-label wip`.

## Stale review claims

Requesting itself as reviewer is how the review loop claims a PR. A
reviewer that crashes, or stops because the gate can't run, leaves that
request behind, and `/next-pr` never takes a PR that has one.

A review claim is **stale** when all of these hold:

- the PR is open and still `needs-review`;
- this loop's login (`gh api user -q .login`) is a requested reviewer;
  never touch a request for anyone else;
- the latest `review_requested` event for that login is more than
  **1 hour** old:

```
gh api "repos/{owner}/{repo}/issues/<n>/events" --paginate \
  --jq '[.[] | select(.event=="review_requested" and .requested_reviewer.login=="<login>")] | last | .created_at'
```

A healthy review takes minutes. Release it: comment `Review claim
released by the stale-claim sweep: claimed <when>, no review. Returning
it to the review queue.`, then
`gh pr edit <n> --remove-reviewer <login>`.

## Review-loop watchdog

The review loop can die without anyone noticing: reviewers stalled at
a usage limit, or the loop running as the PR author's account, which
GitHub won't let review. The review loop can't report its own death,
so the implementation loop checks for it.

A `needs-review` PR is **stuck** when it is not held (`pr-reviewer`
step 1) and its latest `needs-review` label is more than **1 hour**
old. A healthy review takes minutes.

```
gh api "repos/{owner}/{repo}/issues/<n>/events" --paginate \
  --jq '[.[] | select(.event=="labeled" and .label.name=="needs-review")] | last | .created_at'
```

For each stuck PR with no comment starting `Review loop alarm:`,
comment `Review loop alarm: needs-review since <when>, not reviewed.
Check that the /feature-factory:next-pr loop is running and
authenticated as the reviewer account (feature-factory plugin,
docs/review-identity.md).` and send a push
notification with the PR number. The comment is the dedupe: one alarm
per PR, never one per tick. Touch no labels.

## Spawn pre-check

A spawned agent costs a full session even when it ends with "nothing to
do". Decide that first, from reads only. The pre-check never claims;
`/next-ticket` re-fetches and claims the batch itself before spawning,
and `pr-reviewer` re-checks, so a stale snapshot costs at most one tick
either way.

**`/next-ticket`** spawns only if one of these holds:

- the caller passed a ticket id;
- an open `changes-requested` PR has no `wip` label;
- the in-flight count is below `MAX_IN_FLIGHT`, no in-flight item
  counts as `**` (declared, no `## Touches` block, or colliding with
  `PIPELINE_PATHS`), and at least one unassigned, unblocked
  `ready-for-agent` ticket exists.

In flight and unblocked are defined in `../agents/task-implementer.md` and
`issue-tracker.md`. Reuse the PR list and the Linear queue listing the
sweeps already read. If the listing doesn't show blockers, count the
ticket as unblocked and let the implementer decide.

**`/next-pr`** spawns only if an open PR is labelled `needs-review`,
has no reviewer requested, and is not held.

Otherwise don't spawn. Report one line, `Skipped spawn: <the condition
that failed>`.

## Completed intents

An intent lives at `SPEC_DIR` while its tickets are open and moves to
the project's completed folder (`implemented/` or `shipped/`; `SPEC_DIR`
in `project.md` says which) once all close. Numbers are never reused.

Read intents from `origin/main`, never the working tree: the loop's
checkout is not kept current and can be dozens of merges behind. Run
`git fetch origin`, list directories with `git ls-tree --name-only
origin/main <dir>/`, and read files with `git show
origin/main:<path>`.

Detection is mechanical. For each intent directory, skipping the
template and the completed folder: read `## Tickets` in `plan.md`,
extract every `T-<n>` (match the id, not the layout), read each from
Linear. All `completed` or `canceled` means the intent is done.

The sweep **reports** completed intents; the move itself is a ticket,
since it rewrites references and must pass the gate.

## Merged PRs, open tickets

A ticket closes when its PR merges: `Closes T-<n>` moves it to Done
through Linear's GitHub integration, and `pr-reviewer` closes it by
hand if that didn't happen. A PR that a person merged, such as a
`needs-human-review` escalation, has no reviewer behind it to check. If
the integration didn't fire, that ticket stays open and holds its lane
with no PR behind it.

Detect it: `gh pr list --state merged --limit 100 --json
number,url,body,mergedAt`, keeping those with `mergedAt` in the last 7
days. Filter locally, not with `--search "merged:>=…"`: that goes
through GitHub's search API, which can return `[]` silently. Take every `Closes T-<n>` from the
bodies (ignore `Part of T-<n>`) and read each ticket's state from
Linear.

Close each one that isn't `completed` or `canceled`: move it to Done
with the comment `Merged in <PR URL>. Closed by the merged-PR sweep.`.
A merged `Closes` line is a closing decision whoever wrote it. Seven
days is enough because the sweep runs at least hourly while the
`/next-pr` loop is up.
