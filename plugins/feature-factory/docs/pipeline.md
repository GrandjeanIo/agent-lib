# Agent pipeline

The intent-to-merge flow that every repo with a
`docs/agents/project.md` uses. This file is the entry point: it says
what runs, in which order, and where each file lives. The mechanics
ship in the `feature-factory` plugin. Each repo supplies its config,
its domain and its standards.

Plugin skills and agents are namespaced: the slash command is
`/feature-factory:<skill>` and the subagent type is
`feature-factory:<agent>`. Elsewhere in these docs the short names
(`next-ticket`, `pr-reviewer`) mean the same thing.

## Stages

Humans scope the work. Agents build and review it.

| # | Step | Who | Input | Output |
| --- | --- | --- | --- | --- |
| 1 | `/feature-factory:to-intent` | human + Claude | a situation or a goal | `<SPEC_DIR>/intent.md` |
| 2 | `/feature-factory:to-plan` | human + Claude | `intent.md` | `plan.md`, approved by a human: design, files, test seams |
| 3 | `/feature-factory:to-ticket` | human + Claude | `plan.md` | Linear issues with blocking relations, `## Touches` and a `Source:` footer, labelled `ready-for-agent` |
| 4 | `/feature-factory:next-ticket` loop | agents | `ready-for-agent` tickets, `changes-requested` PRs | PRs labelled `needs-review` |
| 5 | `/feature-factory:next-pr` loop | agents | `needs-review` PRs | merged PR + ticket Done, `changes-requested`, or `needs-human-review` |

A ticket is fully specified before an agent builds it unattended. If
steps 1 to 3 leave a material question open, the agent does not decide
it; the reviewer escalates it.

## The two loops

Run both from the repo root, in two terminals:

```
# Terminal A: implementation loop, default `gh auth login` identity
claude
/loop 10m /feature-factory:next-ticket

# Terminal B: review loop, second GitHub account
export GH_CONFIG_DIR=~/.config/gh-reviewer
claude
/loop 10m /feature-factory:next-pr
```

The second account is required. See `review-identity.md`.

Each tick, a dispatcher selects and claims a batch, then spawns one
worker per claim, in parallel, each in its own worktree:

| Dispatcher (skill) | Worker (agent) | Worker calls |
| --- | --- | --- |
| `next-ticket` | `task-implementer` | `tdd-implement` |
| `next-pr` | `pr-reviewer` | — |

The loops never call each other. They share state only through PR
labels (`triage-labels.md`) and Linear ticket state
(`issue-tracker.md`). Parallel work stays safe through touch sets
(`../agents/task-implementer.md` § Concurrency). Crashed or stuck work is
recovered by the sweeps in `pipeline-housekeeping.md`.

## Where the files are

In the plugin, relative to its root (the parent of this `docs/`
folder). The same for every repo. Nothing project-specific goes here.

| File | Role |
| --- | --- |
| `docs/pipeline.md` | This file. Entry point and map. |
| `skills/next-ticket` | Dispatcher, implementation loop |
| `skills/next-pr` | Dispatcher, review loop |
| `skills/tdd-implement` | Test-first implementation, called by `task-implementer` |
| `skills/to-intent`, `to-plan`, `to-ticket` | Human-in-the-loop scoping steps 1 to 3 |
| `skills/setup` | Sets up or re-checks a repo for the pipeline |
| `agents/task-implementer.md` | Worker: ticket or fix → PR. Defines the concurrency model. |
| `agents/pr-reviewer.md` | Worker: PR → merge, changes or escalation |
| `docs/pipeline-housekeeping.md` | Sweeps and checks run by the dispatchers |
| `docs/issue-tracker.md` | Linear operations, the agent queue, PR naming |
| `docs/triage-labels.md` | Linear triage labels and GitHub pipeline labels |
| `docs/review-identity.md` | Second GitHub account for the review loop |
| `docs/domain.md` | How to use the glossary and the ADRs |
| `templates/project.md` | Template for a repo's `docs/agents/project.md` |
| `hooks/session-start.sh` | Points a session at this file when the repo has `docs/agents/project.md` |

Per repo. Required unless marked optional.

| File | Role |
| --- | --- |
| `docs/agents/project.md` | Written by `/feature-factory:setup` from `templates/project.md`. All config keys (`LINEAR_TEAM`, `SETUP`, `VERIFY`, `SPEC_DIR`, lanes, escalation paths) and project rules. Read it first. |
| `CONTEXT.md` | Glossary. `project.md` says if it lives elsewhere. |
| `docs/adr/` | Decisions. Reviewers cite them in findings. |
| `<SPEC_DIR>` | Intents: `intent.md`, `plan.md`, optional `spec.md`, a `template/` and a completed folder |
| `REVIEW.md` | Optional. Repo-specific review rules, read by `tdd-implement` and `pr-reviewer`. |
| `.mcp.json` | The Linear server named by `LINEAR_MCP` |
| `docs/agents/*.md` | Optional. Anything `project.md` points to, for example `gate.md` |

## Reading order for an agent

1. `docs/agents/project.md` in the repo.
2. This file, if you need the overall flow.
3. The skill or agent file you were invoked as. It names the other
   files it needs.
