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
| 4 | `SETUP` and `VERIFY` | Each command's target exists (the Makefile target, the script, the package.json script). Don't run them here. Read the `SETUP` recipe: **stale** if it runs `git config`, sets `core.hooksPath` or installs hooks (`pre-commit install`, `husky`, `lefthook install`). The sandbox protects `.git/config` and `.git/hooks`, so that step fails in every implementer and reviewer worktree. |
| 5 | `VERIFY` sandboxed | `project.md` or the gate script shows that `VERIFY` runs the code without the reviewer's `gh` login (a container, a VM, a CI-style runner). If you can't tell, **unknown**, and ask in phase 2. Reason: `${CLAUDE_PLUGIN_ROOT}/docs/review-identity.md` § Keep the gate away from the reviewer login. |
| 6 | `SPEC_DIR` | The directory and its completed folder exist. |
| 7 | GitHub labels | `gh label list --limit 200 --json name` has `needs-review`, `changes-requested`, `wip`, `needs-human-review`. `gh pr edit --add-label` fails on a missing one. |
| 8 | Reviewer account | `REVIEWER_LOGIN` is set. Ask which `GH_CONFIG_DIR` folder holds that login (default `~/.config/gh-reviewer`), then `GH_CONFIG_DIR=<folder> gh api user -q .login` must print `REVIEWER_LOGIN`, and `GH_CONFIG_DIR=<folder> gh api repos/<owner>/<repo> -q .permissions.push` must print `true`. It must differ from `gh api user -q .login` (the implementer). |
| 9 | Unattended permissions | See **Permissions** below. |
| 10 | Optional files | `REVIEW.md`, `CONTEXT.md`, `docs/adr/`. Report presence only; missing is fine. |

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
- `gh pr merge`: **required**, and the one most likely to stall a
  tick. A single `Bash(gh *)` covers it, as does `Bash(gh pr merge *)`.
  Flag it to the developer as a **required fix** (not just "not
  covered") if no allow rule matches, or if the command is also under
  `ask` or `deny`. Flags before the subcommand (`gh -R x pr merge`)
  don't match; the reviewer doesn't use them.
- **Auto-mode trust entry for the merge**: also required when
  `permissions.defaultMode` is `auto`. The allow rule is not enough:
  the classifier inspects a merge anyway, can't see the reviewer's
  approval (tool results are stripped from what it reads), and denies
  a bare `gh pr merge` as "Merge Without Review". Check with
  `claude auto-mode config`: its `allow` list must contain an entry
  naming the pipeline's merge (see **Auto mode** below). Missing →
  **required fix**, on the user's to-do list: Claude can't write it
  (the classifier blocks a session editing its own permissions as
  Self-Modification).
- `Bash(git worktree *)`: the implementer always makes its own
  worktree; the reviewer only on standalone runs (dispatched runs use
  the harness worktree)
- the exact `SETUP`, `VERIFY` and `RECREATE` commands from
  `project.md`, as written there (`Bash(scripts/gate.sh *)` for
  `scripts/gate.sh HEAD`)
- `mcp__<LINEAR_MCP>__*`

Report each item as covered (name the rule) or not.

### Auto mode

`autoMode` entries (the classifier's own prose rules) are read only from
the user's own settings, managed settings and `--settings`, never from
the repo's `.claude/settings*.json`. Don't write them into the repo, and
don't write them at all: the user adds the entry, in `/permissions` →
Auto mode, or in `~/.claude/settings.json`:

```json
"autoMode": {
  "allow": [
    "$defaults",
    "`gh pr merge <n> --squash --match-head-commit <sha>` run by the feature-factory pr-reviewer agent under the dedicated reviewer login (GH_CONFIG_DIR), after it posted its own approving review and the verify gate passed on the merge result: allowed. The gate run on the merge result is the review; this is not merging without review."
  ]
}
```

`$defaults` must stay, or the entry replaces the built-in allow list
instead of extending it. Afterwards `claude auto-mode critique` checks
the wording and `claude auto-mode config` shows it loaded.

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
| Permissions missing | Add the missing `allow` rules. Ask which file: `.claude/settings.json` (shared with the team) or `.claude/settings.local.json` (this machine). Merge into the existing JSON; keep every other key. |

Some fixes need the user. List them as a to-do, with the exact command:

- No reviewer account, or no login folder: create the account, give it
  write access, then
  `GH_CONFIG_DIR=~/.config/gh-reviewer gh auth login`.
- Linear not authenticated: `/mcp`.
- `VERIFY` not sandboxed: change the gate. This is the repo's code,
  not setup.
- `SETUP` writes git config or hooks: move that step to its own target
  that people run. Also the repo's code, not setup.
- No auto-mode trust entry for the merge: add the entry from
  **Auto mode** above to the user's own settings. Until it exists,
  every review ends in `Merge blocked`.
- Plugin not enabled: `/plugin install feature-factory@agent-lib`,
  project scope.

Leave committing to the user. Most of these files are under
`PIPELINE_PATHS`.

## 4. Re-audit

Run phase 1 again. Report the final table, then the user's to-do list,
then how to start the loops (`${CLAUDE_PLUGIN_ROOT}/docs/pipeline.md`
§ The two loops). Done when every row is **ok** or on the to-do list.
