# feature-factory

An intent-to-PR pipeline for repos that track work in Linear and ship through GitHub PRs.
People scope the work and merge it. Agents build and review it in between.

```
to-intent ─► intent.md ─► to-plan ─► plan.md ─► to-tickets ─► Linear project + tickets
                                                                     │
          you merge ◄─ PR "Review these first: 1..n" ◄─ review + fix ◄─ build (per repo)
```

| Stage | Skill | Who | Output |
| --- | --- | --- | --- |
| 1 | `/feature-factory:to-intent` | you + Claude | `docs/intent/<NNN-slug>/intent.md` |
| 2 | `/feature-factory:to-plan` | you + Claude | `plan.md`, approved by you, on main |
| 3 | `/feature-factory:to-tickets` | you + Claude | Linear project with tickets and blocking relations |
| 4 | `/feature-factory:build <NNN>` | agents | One PR per repo, with a short review list |

**`build`** creates the integration branch `intent/<NNN-slug>` and works the ticket frontier
(tickets whose blockers are done) with up to three `implementer` subagents at once, each in its
own worktree, each test-first via `mattpocock-skills:tdd`. It merges each one into the integration
branch and runs your gate. When all tickets are in, it runs `mattpocock-skills:code-review`
against the plan, hands concrete issues back to an implementer (at most two rounds), and opens
a PR whose body starts with **Review these first**: at most seven numbered items saying where to
look, why, and what to check. Re-running `build` resumes where it stopped.

Two tickets run in parallel when neither blocks the other, so `to-tickets` adds a blocker edge
between slices that edit the same files.

## Cross-repo work

An intent lives in one home repo (`INTENT_HOME`). `to-tickets` puts all its tickets in one
Linear project, labels each with the repo it changes (`REPO_LABEL`), and links the plan by
GitHub URL in each ticket's `Source:` footer. Run `build` in each repo: it reads the plan from
the home repo with `gh api`, builds only its own tickets, reports tickets waiting on another
repo, and adds `Depends on:` to its PR.

## Install

```
/plugin marketplace add GrandjeanIo/agent-lib
/plugin install feature-factory@agent-lib
/plugin install mattpocock-skills@claude-plugins-official
```

Tested with mattpocock-skills 1.3.1. Install both at project scope in each repo.

## Set up a repo

Run `/feature-factory:setup`. It reads the repo, checks the Linear team, states and labels, and
writes `docs/agents/project.md` and `docs/agents/issue-tracker.md` from [`templates/`](templates/).
`SETUP` and `VERIFY` are inferred from the repo, and `VERIFY` is run once before it's written.
It also lists the permissions unattended `build` runs need (`Bash(git *)`, `Bash(gh *)`, the Linear
MCP tools, your `SETUP` and `VERIFY` commands) and adds them to `.claude/settings.json` if you say so.

You don't need `/setup-matt-pocock-skills`: feature-factory reads only the two files above.

## What it does to your repo, GitHub and Linear

`build` creates branches and worktrees, pushes `intent/*` and `feat/*` branches, opens PRs, and
moves, comments on and labels Linear tickets. It never pushes to main, approves or merges: a
person merges each PR, and its `Closes` lines move the tickets to Done. It talks only to GitHub
(through your `gh` login) and Linear (through your MCP server).

## Security scan

[NVIDIA Skillspector](https://github.com/nvidia/skillspector) v2.12.0 with the `claude_cli` LLM
provider (all LLM calls succeeded). The scan covered the shipped files only: the 8 files under
`plugins/feature-factory/`, exported to a clean folder without `.DS_Store`.

| Result | Value |
|---|---|
| Risk score | 0/100 |
| Severity | LOW |
| Recommendation | SAFE |
| Issues | None |
| Coverage | 100%: 8 of 8 files fully inspected |
| Degraded analyzers | None |

An earlier scan of this version flagged two issues, both fixed before this run: `TM1` (HIGH,
the implementer pushed its branch; it now never pushes) and `SQP-1` (MEDIUM, `build` triggered
on generic phrases like "implement the plan"; it now triggers only on building a named intent).

The plugin ships no hooks or scripts. The real risk is the one in
[What it does to your repo, GitHub and Linear](#what-it-does-to-your-repo-github-and-linear):
`build` pushes branches, opens PRs and moves Linear tickets without a person present.

## Credits

`mattpocock-skills` by [Matt Pocock](https://github.com/mattpocock/skills) (MIT) supplies `tdd` and
`code-review`. The shape of `templates/issue-tracker.md` and the `setup` skill's explore, confirm,
write flow are adapted from his `setup-matt-pocock-skills`.
