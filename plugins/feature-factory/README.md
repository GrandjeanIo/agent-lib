# feature-factory

An intent-to-PR pipeline for repos that track work in Linear and ship through GitHub PRs.
People scope the work and merge it. Agents build and review it in between.

```
to-intent ─► intent.md ─► to-plan ─► plan.md ─► to-tickets ─► Linear project + tickets
                                                                     │
          you merge ◄─ PR "Review these first: 1..n" ◄─ review + fix ◄─ build (per repo)
                                     │
                         label: needs-review ─► review ─► GitHub review ─► label: agent-reviewed
```

| Stage | Skill | Who | Output |
| --- | --- | --- | --- |
| 1 | `/feature-factory:to-intent` | you + Claude | `docs/intent/<NNN-slug>/intent.md` |
| 2 | `/feature-factory:to-plan` | you + Claude | `plan.md`, approved by you, on main |
| 3 | `/feature-factory:to-tickets` | you + Claude | Linear project with tickets and blocking relations |
| 4 | `/feature-factory:build <NNN>` | agents | One PR per repo, with a short review list, labelled `needs-review` |
| 5 | `/feature-factory:review [PR…]` | agents | One GitHub review per `needs-review` PR; the label moves to `agent-reviewed` |

**`build`** creates the integration branch `intent/<NNN-slug>` and works the ticket frontier
(tickets whose blockers are done) with up to three `implementer` subagents at once, each in its
own worktree, each test-first via `mattpocock-skills:tdd`. It merges each one into the integration
branch and runs your gate. When all tickets are in, it runs `mattpocock-skills:code-review`
against the plan, hands concrete issues back to an implementer (at most two rounds), and opens
a PR whose body starts with **Review these first**: at most seven numbered items saying where to
look, why, and what to check. Re-running `build` resumes where it stopped.

Two tickets run in parallel when neither blocks the other, so `to-tickets` adds a blocker edge
between slices that edit the same files.

## Review PRs labelled needs-review

The `needs-review` label is the review queue. `build` opens every PR with it, and a hook makes
every other agent-opened PR carry it too. `/feature-factory:review` reviews each open PR in the
queue, oldest first, or the PR numbers you pass, labelled or not.

For each PR it checks out the head in a detached worktree under `$TMPDIR` and runs three
`reviewer` agents side by side, each with a fresh context:

- **Standards**: the repo's documented rules (`CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md`, the
  Project rules in `docs/agents/project.md` …, read from the base branch so a PR can't rewrite
  them), plus a baseline of Fowler code smells. The repo's rules override the baseline.
- **Spec**: what the PR was asked to do, from its `Intent:` link, linked GitHub issues, Linear
  tickets, or a spec file. Missing, partial and unrequested behaviour.
- **Correctness**: concrete bugs with the input that triggers them, unsafe input reaching a sink,
  secrets, untested behaviour changes, and anything touching auth, payments or migrations.

Each reviewer holds a high bar: a finding must come from this diff, bite in a realistic case,
and be worth the fix, rated `blocking`, `should-fix`, `nit` or `question` with a confidence. Every
finding is checked against the code, and argued from the author's side, before posting. It posts
one `COMMENT` review that opens with a verdict (**Ready to merge**, **Ready once the blocking items
are fixed** or **Needs your call**) and a **Look at these first** list holding every blocking
finding from any axis. The full list, by axis, sits folded below. Only blocking, should-fix and
question items become inline comments. A re-review gets the earlier findings, your replies and
the diff since: it checks the fixes, closes a finding you declined for a reason that holds, and
doesn't raise old code it could have raised before unless it is blocking. Then the label moves from `needs-review` to `agent-reviewed`; if new commits
landed meanwhile, the label stays so the next run reviews them. To ask for another review after a
fix, add `needs-review` back.

```
/feature-factory:review                 # the whole needs-review queue
/feature-factory:review 42              # one PR, labelled or not
/loop 15m /feature-factory:review       # keep reviewing while this session is open
```

For an unattended reviewer, `/schedule` a cloud routine that runs `/feature-factory:review`. Run
one reviewer per repo at a time. `review` doesn't need `docs/agents/`: it works in any GitHub repo,
and reads `docs/agents/project.md` as a standards source when it exists.

**The label guard.** In a repo set up for the factory (it has `docs/agents/project.md`), a Bash
call to `gh pr create` or `gh pr new` without `needs-review` as a `--label`/`-l` value is refused,
and the refusal tells the agent the fix. The accepted spellings are listed in
[`hooks/register.ts`](hooks/register.ts). In other repos, such as an upstream you can't label, it
stays out of the way. PRs opened in the browser, through the GitHub MCP server or with raw `gh api`
aren't covered: label those by hand. Both labels are defined in [`labels.md`](labels.md).

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

Run `/feature-factory:setup`. It reads the repo, checks the Linear team, states and labels,
checks the repo has the GitHub labels `needs-review` and `agent-reviewed` (and asks before
creating them), and writes `docs/agents/project.md` and `docs/agents/issue-tracker.md` from [`templates/`](templates/).
`SETUP` and `VERIFY` are inferred from the repo, and `VERIFY` is run once before it's written.
It also lists the permissions unattended `build` runs need (`Bash(git *)`, `Bash(gh *)`, the Linear
MCP tools, your `SETUP` and `VERIFY` commands) and adds them to `.claude/settings.json` if you say so.

You don't need `/setup-matt-pocock-skills`: feature-factory reads only the two files above.

## What it does to your repo, GitHub and Linear

`build` creates branches and worktrees, pushes `intent/*` and `feat/*` branches, creates the
`needs-review` label and opens PRs with it (so [`review`](#review-prs-labelled-needs-review) picks them up), and
moves, comments on and labels Linear tickets. It never pushes to main, approves or merges: a
person merges each PR, and its `Closes` lines move the tickets to Done. It talks only to GitHub
(through your `gh` login) and Linear (through your MCP server).

`review` reads PRs, their checks, linked issues and Linear tickets, and files on the base branch.
It writes one review per PR (always `COMMENT`), creates the `agent-reviewed` label if missing, and
swaps the labels. What it never does, and the rules for untrusted PR content, are in
[`skills/review/SKILL.md`](skills/review/SKILL.md) (the intro and step 2). Its reviewer subagents have no shell at all: Read, Grep and Glob only.

## Security scan

[NVIDIA Skillspector](https://github.com/nvidia/skillspector) v2.12.0 with the `claude_cli` LLM
provider (4 of 4 LLM calls succeeded), run on commit `20a5818`. The scan covered the shipped files
only: the 17 tracked files under `plugins/feature-factory/`, exported to a clean folder. Only this
section of the README changed after it.

| Result | Value |
|---|---|
| Risk score | 14/100 |
| Severity | LOW |
| Recommendation | CAUTION |
| Issues | 3, all `AS3` (MEDIUM, LLM review disagreed at 0.93–0.95 confidence) |
| Coverage | 82.4%: 14 of 17 files fully inspected, 3 partially |
| Degraded analyzers | `bundled_execution_surface` (can't read the `modules` form of `hooks/hooks.json`), `static_patterns_tool_misuse` (an expression in `hooks/register.ts` and one in `label.test.ts` exceeded its parser's span limit) |

All three `AS3` ("skill enumeration") findings point at mentions of the plugin's own review skill
in this README: two at the link in
[What it does to your repo, GitHub and Linear](#what-it-does-to-your-repo-github-and-linear), and
one at the previous version of this paragraph, which named that link's path. None is a skill
reading other skills.

The plugin ships one hook, the label guard (`hooks/register.ts`): it reads each Bash command
and refuses a `gh pr create` without `needs-review`, in factory repos. It makes no network calls
and runs nothing; it checks whether `docs/agents/project.md` exists in the session's folder, the
folders a command `cd`s into, and their parents. The static tool-misuse analyzer still inspects
it only partly, so read it yourself: it is about 120 lines.

The real risk is the one in
[What it does to your repo, GitHub and Linear](#what-it-does-to-your-repo-github-and-linear):
`build` pushes branches, opens PRs and moves Linear tickets, and `review` posts reviews and swaps
labels, without a person present.

## Credits

Several skills build on [Matt Pocock's skills](https://github.com/mattpocock/skills) (MIT, see [LICENSE](../../LICENSE)). Thank you, Matt.

| feature-factory | Adapted from |
|---|---|
| `to-intent`, `to-plan` | `to-spec`: testing seams, plan structure |
| `to-tickets` | `to-tickets`: tracer-bullet slices, expand–contract for wide refactors |
| `setup`, `templates/issue-tracker.md` | `setup-matt-pocock-skills`: explore, confirm, write flow and template shape |
| `build`, `implementer` | Call `mattpocock-skills:tdd` and `mattpocock-skills:code-review` at runtime |
| `review`, `reviewer` | [`code-review`](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review): parallel review axes kept separate in the full findings list, spec and standards discovery, the sub-agent briefs, and the Fowler smell baseline, copied with light edits. Added here: a correctness axis, PR discovery by label, a read-only checkout that never runs the PR's code, standards read from the base branch, findings verified before posting, one GitHub review with inline comments, the label hand-off, and the label guard hook |

The adaptations are mine, and any mistakes in them are too. Matt isn't affiliated with this plugin.
