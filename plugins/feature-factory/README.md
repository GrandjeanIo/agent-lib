# feature-factory

An intent-to-merge agent pipeline for repos that track work in Linear and ship through GitHub PRs.
People scope the work. Agents build and review it.

```
/feature-factory:to-intent ─► intent.md ─► /feature-factory:to-plan ─► plan.md ─► /feature-factory:to-ticket ─► Linear tickets
                                                                                                                   │
            merged PR + ticket Done ◄─ /loop 10m /feature-factory:next-pr ◄─ needs-review PR ◄─ /loop 10m /feature-factory:next-ticket
```

- **Stages 1 to 3** run with a person: a goal becomes an `intent.md`, then an approved `plan.md`,
  then Linear tickets with blocking relations and a `## Touches` block of globs.
- **`next-ticket`** claims every ticket the lanes allow and spawns one `task-implementer` per
  claim, each in its own worktree. Each builds its ticket test-first and opens a PR labelled
  `needs-review`.
- **`next-pr`** claims every reviewable PR and spawns one `pr-reviewer` per claim. Each runs the
  repo's gate on the merge result with main, then merges, requests changes, or flags the PR for
  manual review.

Parallel work stays safe through touch sets: two tickets run at once only when their globs are
disjoint. Sweeps release claims left by crashed sessions. The full map is
[`docs/pipeline.md`](docs/pipeline.md).

## Install

```
/plugin marketplace add GrandjeanIo/agent-lib
/plugin install feature-factory@agent-lib
```

Install at project scope in each repo that uses the pipeline.

## Set up a repo

1. Copy [`templates/project.md`](templates/project.md) to `docs/agents/project.md` and fill every
   row. The skills and agents read it first.
2. Add the Linear MCP server named by `LINEAR_MCP` to `.mcp.json`, then run `/mcp` to authenticate.
   See [`docs/issue-tracker.md`](docs/issue-tracker.md).
3. Create a second GitHub account for the review loop. GitHub blocks self-review, so the loops must
   run as different accounts. Set `REVIEWER_LOGIN` to that account so the review loop stops if it
   runs as any other. See [`docs/review-identity.md`](docs/review-identity.md).
4. Optional: add `REVIEW.md` at the repo root with repo-specific review rules, `CONTEXT.md` as a
   glossary, and ADRs in `docs/adr/`.

With `docs/agents/project.md` present, a SessionStart hook tells each session the repo uses the
pipeline and where `pipeline.md` is. No `CLAUDE.md` pointer is needed. In any other repo the hook
prints nothing.

## Run

From the repo root, in two terminals:

```
# Terminal A: implementation loop, default `gh auth login` identity
claude
/loop 10m /feature-factory:next-ticket

# Terminal B: review loop, second GitHub account
export GH_CONFIG_DIR=~/.config/gh-reviewer
claude
/loop 10m /feature-factory:next-pr
```

## Contents

| Path | Kind |
| --- | --- |
| `skills/to-intent`, `to-plan`, `to-ticket` | Scoping stages 1 to 3. `to-plan` and `to-ticket` run only when you type them. |
| `skills/next-ticket`, `next-pr` | Dispatchers, run by `/loop` |
| `skills/tdd-implement` | Test-first implementation, called by `task-implementer` |
| `agents/task-implementer.md`, `agents/pr-reviewer.md` | Workers |
| `docs/` | Reference docs: the pipeline map, housekeeping sweeps, Linear operations, labels, reviewer identity, domain docs |
| `templates/project.md` | The repo config template |
| `hooks/` | SessionStart pointer to `docs/pipeline.md` |

## What it does to your repo, GitHub and Linear

The loops act without a person present. They assign and move Linear tickets, comment on them,
create branches and worktrees (`.worktrees/`), push, open PRs, edit PR labels and reviewers, approve,
squash-merge and delete merged branches. The review loop merges only after its own gate run passes
on the merge result and its account has approved. Changes to auth, `SENSITIVE_PATHS` and
`PIPELINE_PATHS` are flagged for manual review and never merged by an agent.

The plugin talks only to GitHub and Linear, through your `gh` login, the reviewer account's `gh` login
(`GH_CONFIG_DIR`), and the Linear MCP server you configure. It has no other network calls.

## Security scan

[NVIDIA Skillspector](https://github.com/nvidia/skillspector) v2.12.0 with the `claude_cli` LLM
provider (the LLM analyzers completed). The scan covered the shipped files only: the 19 files under
`plugins/feature-factory/`, exported to a clean folder without `.DS_Store`.

| Result | Value |
|---|---|
| Risk score | 9/100 |
| Severity | LOW |
| Recommendation | CAUTION |
| Issues | 1 MEDIUM: `BH1` (the bundled hook) |
| Coverage | 94.7%: 18 of 19 files fully inspected, 1 partial |
| Degraded analyzers | `bundled_execution_surface` |

**The scan is not complete.** The one partial file is `hooks/hooks.json`, for the same reason as in
`jev-model-picker`: the analyzer does not model the plugin hook format. The degraded analyzer is for
the same file.

The finding, checked by hand:

- **`BH1` (MEDIUM), bundled hook**, `hooks/hooks.json`. The SessionStart hook runs
  `hooks/session-start.sh`. The script only checks whether `docs/agents/project.md` exists and
  prints a fixed three-line pointer. It reads no other file and makes no network call.

Treat the result as a near-complete review, not a clean bill of health. The real risk is the one in
[What it does to your repo, GitHub and Linear](#what-it-does-to-your-repo-github-and-linear): the
loops act on your repos and tracker without a person present.
