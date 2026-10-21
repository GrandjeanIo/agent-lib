---
name: setup
description: Set up this repo for the feature factory. Checks the Linear team, labels and states, proves the agent can install, test and work in a git worktree inside its sandbox, then writes docs/agents/project.md and docs/agents/issue-tracker.md. Run once per repo before the first /feature-factory:to-intent.
disable-model-invocation: true
---

# Setup

Write `docs/agents/project.md` and `docs/agents/issue-tracker.md` from this plugin's `templates/`,
after checking that Linear and the local environment can carry an unattended `build`.

Explore first, then take the sections below one at a time: present what you found, lead with the
recommended answer so the user can accept it in a word, and skip a section the exploration already
settled. Change nothing in Linear, settings, git or `docs/agents/` without a yes, and never work
around a problem on your own (for example by adding a project rule): propose the fix instead. If a
file in `docs/agents/` exists, update it in place and keep the user's edits.

Setup is done when every check passes. A problem found is something to fix now, not a note for the
report: the report's open list holds only what the user declined or must do outside the agent.

## 1. Explore

- The install command and the gate CI runs, from the repo's CI config, task runner or build files,
  and from `README.md`, `CLAUDE.md` or `AGENTS.md`. In a monorepo take the root command, and ask
  when several candidates exist.
- The remote is GitHub and `gh auth status` passes. `build` pushes and opens PRs through `gh`.
- The Linear MCP server is connected. If it isn't, stop and say so.
- What already exists: `docs/agents/`, `docs/intent/`, `.claude/settings.json`.

## 2. Linear team

List the teams and propose the one matching this repo. Confirm it: every ticket, label and project
lands there. The skills create one Linear project per intent later, so there is no project to pick
now. Ask whether intents live in this repo (`INTENT_HOME`) or in another one.

## 3. Labels

The factory needs `ready-for-agent` and the repo label, proposed as `repo:<repo-name>` even for a
single repo, because `to-tickets` and `build` filter by it. List the ones the team lacks and ask
whether to create them.

## 4. States

The skills move tickets through four roles. Map each to a state in the team's workflow:

| Role | Must be of Linear type |
| --- | --- |
| Todo | unstarted |
| In Progress | started |
| In Review | started |
| Done | completed |

Match by name first, then by type. Show the mapping. When a role has no state, two roles share one,
or a state has the wrong type, say which and ask how to correct it: map it to another existing
state, or have the user add the state in Linear's team settings and re-check. Record the final
mapping in `issue-tracker.md`.

Then get a yes or no on Linear's GitHub integration for this repo; don't leave it unasked.
Without it, a merged PR's `Closes` lines don't move tickets to Done, and blocked tickets never
reach the frontier. On a no, the user turns it on in Linear's settings and you re-check, or it
goes on the open list.

## 5. Sandbox and worktrees

Prove the agent can do what `build` and the implementers do, using the proposed `SETUP` and
`VERIFY` commands, without bypassing the sandbox. Say up front that the check pushes a throwaway
branch and deletes it again.

1. Implementers run in `.claude/worktrees/` (`isolation: "worktree"`), so check there:
   `git worktree add -b ff-setup-check --no-track .claude/worktrees/ff-setup-check HEAD`.
   Confirm `.claude/worktrees/` is gitignored.
2. In it, run `SETUP`, then `VERIFY`. Confirm `VERIFY` exits 0 on this clean checkout; a gate that
   already fails blocks every PR.
3. Confirm `SETUP` didn't write `.git/config` or `.git/hooks`. If it did, propose a variant that
   doesn't (for example, skipping a `prepare` hook installer).
4. Remove that worktree. `build` itself works under `$TMPDIR`, so add
   `git worktree add "$TMPDIR/ff-setup-check" ff-setup-check` and, in it, run the commands `build`
   runs against the remote, exactly as it writes them: `git fetch origin`,
   `git push origin HEAD`, `gh pr list --limit 1`, then `git push origin --delete ff-setup-check`.
5. Remove the worktree and delete the local `ff-setup-check` branch.

Read what `VERIFY` skips: skipped tests, jobs CI runs that `VERIFY` leaves out. For each, ask
whether `VERIFY` should reach it. A test skipped for want of a service or a secret usually can
be reached: a local service, an env var in the settings `env`, or the untracked file in
`.worktreeinclude`. Fix what the user wants covered and re-run. What stays out goes into
`UNTESTED`.

When a step fails, find out why and report it as one of:
- a sandbox block (a network domain, or a write outside the repo such as `$TMPDIR` or a package
  cache): propose the sandbox setting that allows it;
- a missing permission prompt: propose the `permissions.allow` entry;
- a file the worktree lacks because it's untracked (`.env`, local config): propose listing it in
  `.worktreeinclude`, or say what `VERIFY` must stop depending on;
- a broken command: ask for the right one.

Re-run the check after each fix the user accepts.

Then list the entries unattended runs need that `.claude/settings.json` doesn't allow yet:
`Bash(git *)`, `Bash(gh *)`, the Linear MCP tools, and the `SETUP` and `VERIFY` commands. Write
settings only when the user says so.

Last, list the worktrees and `ff-*`, `intent/*` and ticket branches left over from earlier runs
(`git worktree list`, `git worktree prune --dry-run`). Offer to remove the ones with no
uncommitted changes and no commits missing from `origin`. Name any you'd keep and why.

## 6. Write

Show both files with every key filled and its source. `UNTESTED` lists what `VERIFY` doesn't
reach after §5, or `—`. Let the user edit, then write:

- `docs/agents/project.md` from `templates/project.md`;
- `docs/agents/issue-tracker.md` from `templates/issue-tracker.md`, with the team and the state
  mapping filled in.

Don't commit.

## 7. Report

Three short lists, one line per item, `—` when empty:

- **Written:** each file in `docs/agents/`.
- **Changed:** everything else you changed: Linear labels or states, settings,
  `.worktreeinclude`, removed worktrees and branches.
- **Needs you:** only what the user declined or must do outside the agent, each with the one
  action that closes it.

`UNTESTED` is already in `project.md`, so don't repeat it. End with: `/feature-factory:to-intent`
is next.
