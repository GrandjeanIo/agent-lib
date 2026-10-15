---
name: setup
description: Set up or check a repo for the feature-factory pipeline. Audits what is missing or stale, asks for the config values, writes docs/agents/project.md, and fixes .gitignore, permissions, labels and .mcp.json with your approval.
disable-model-invocation: true
---

# Setup

Makes the repo in the current directory ready for the pipeline, or
re-checks one that already is. Four phases: **audit**, **ask**,
**apply**, **re-audit**. The audit is read-only; nothing is written
before the user approves the change list in phase 3.

`${CLAUDE_PLUGIN_ROOT}/docs/pipeline.md` is the map of the pipeline.
`${CLAUDE_PLUGIN_ROOT}/templates/project.md` defines every config key;
it is the source of truth for what each key means.

## 1. Audit

Run from the repo root. Confirm it is a git repo with a GitHub remote
(`gh repo view --json nameWithOwner`); if not, stop and say so.

Check every row below and record each as **ok**, **missing**,
**stale** or **unknown**, with the evidence (the file and line, or the
command output). Done when every row has a status.

| # | Check | How |
| --- | --- | --- |
| 1 | Plugin enabled for the repo | `.claude/settings.json` → `enabledPlugins` has a `feature-factory@…` entry. A session started with `--plugin-dir` doesn't count; say so. |
| 2 | `docs/agents/project.md` | Exists, and has a row for every key in the template. A key with `—` is ok when the template marks it optional or allows `—`. |
| 3 | Linear MCP server | `.mcp.json` has a server named `LINEAR_MCP`. Load `mcp__<LINEAR_MCP>__*` with ToolSearch and list teams: `LINEAR_TEAM` must be one of them. If the tools fail to connect, the row is **unknown**: the user runs `/mcp` to authenticate. |
| 4 | `SETUP` and `VERIFY` | Each command's target exists (the Makefile target, the script, the package.json script). Don't run them here. |
| 5 | `VERIFY` sandboxed | `project.md` or the gate script shows that `VERIFY` runs the code without the reviewer's `gh` login (a container, a VM, a CI-style runner). If you can't tell, **unknown**, and ask in phase 2. Reason: `${CLAUDE_PLUGIN_ROOT}/docs/review-identity.md` § Keep the gate away from the reviewer login. |
| 6 | `SPEC_DIR` | The directory and its completed folder exist. |
| 7 | GitHub labels | `gh label list --limit 200 --json name` has `needs-review`, `changes-requested`, `wip`, `needs-human-review`. `gh pr edit --add-label` fails on a missing one. |
| 8 | Reviewer account | `REVIEWER_LOGIN` is set. Ask which `GH_CONFIG_DIR` folder holds that login (default `~/.config/gh-reviewer`), then `GH_CONFIG_DIR=<folder> gh api user -q .login` must print `REVIEWER_LOGIN`, and `GH_CONFIG_DIR=<folder> gh api repos/<owner>/<repo> -q .permissions.push` must print `true`. It must differ from `gh api user -q .login` (the implementer). |
| 9 | Worktrees ignored | `git check-ignore -q .worktrees/x` exits 0. Both agents create worktrees under `.worktrees/`; unignored, each shows up as untracked. |
| 10 | Unattended permissions | See **Permissions** below. |
| 11 | Optional files | `REVIEW.md`, `CONTEXT.md`, `docs/adr/`. Report presence only; missing is fine. |

### Permissions

The loops run with nobody at the keyboard, so any tool call that needs
approval stalls the tick. The allow rules can live in
`.claude/settings.json` (shared) or `.claude/settings.local.json`
(this machine only). A rule in either counts. Each item below must be
covered by an `allow` rule and hit by no `deny` rule:

- `Bash(git *)`
- `gh`: `gh pr`, `gh api`, `gh repo view`, `gh label` (one `Bash(gh *)`
  covers all four)
- `Bash(jq *)`: the reviewer filters PR lists with it
- the exact `SETUP`, `VERIFY` and `RECREATE` commands from
  `project.md`, as written there (`Bash(scripts/gate.sh *)` for
  `scripts/gate.sh HEAD`)
- `mcp__<LINEAR_MCP>__*`

Report each item as covered (name the rule) or not.

## 2. Ask

Show the audit as one table: check, status, evidence. Then gather what
is missing, in as few rounds as possible (AskUserQuestion, up to four
questions per call).

For each missing `project.md` key, propose a value from the repo
before asking:

- `SETUP`, `VERIFY`, `RECREATE`: Makefile targets, `package.json`
  scripts, `scripts/`.
- `SPEC_DIR`: an existing `docs/intent/` or similar folder.
- `SHARED_GLOBS`: lockfiles, `docs/adr/**`, numbered folders.
- `PIPELINE_PATHS`: `Makefile`, `.github/**`, `.claude/**`,
  `docs/agents/**`, `scripts/**`, the gate's files, root tool config.
- `LINEAR_TEAM`: the team list from check 3.

`SENSITIVE_PATHS` and `UNTESTED` are judgement calls about the
product: propose candidates with the reason for each (payments, AI
prompts, public API, safety content), and let the user decide. Never
fill them silently.

Done when every key has a value or an explicit `—`, and every
**unknown** row is resolved or handed to the user.

## 3. Apply

Present the change list: each file, and the exact lines added or
changed. Apply only after the user approves it, and only the items they
approve.

| Fix | Change |
| --- | --- |
| `project.md` missing or incomplete | Write it from the template, with the agreed values, keeping any existing rows and project rules. |
| Linear server missing | Add it to `.mcp.json`, named after the workspace (`${CLAUDE_PLUGIN_ROOT}/docs/issue-tracker.md` § Workspaces). |
| `SPEC_DIR` missing | Create the folder and its completed folder. |
| Labels missing | `gh label create <name>` for each. This writes to GitHub; name the repo when asking. |
| Worktrees not ignored | Append `.worktrees/` to `.gitignore`. |
| Permissions missing | Add the missing `allow` rules. Ask which file: `.claude/settings.json` (shared with the team) or `.claude/settings.local.json` (this machine). Merge into the existing JSON; keep every other key. |

Some fixes need the user. List them as a to-do, with the exact command:

- No reviewer account, or no login folder: create the account, give it
  write access, then
  `GH_CONFIG_DIR=~/.config/gh-reviewer gh auth login`.
- Linear not authenticated: `/mcp`.
- `VERIFY` not sandboxed: change the gate. This is the repo's code,
  not setup.
- Plugin not enabled: `/plugin install feature-factory@agent-lib`,
  project scope.

Leave committing to the user. Most of these files are under
`PIPELINE_PATHS`.

## 4. Re-audit

Run phase 1 again. Report the final table, then the user's to-do list,
then how to start the loops (`${CLAUDE_PLUGIN_ROOT}/docs/pipeline.md`
§ The two loops). Done when every row is **ok** or on the to-do list.
