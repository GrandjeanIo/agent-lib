---
name: setup
description: Set up this repo for the feature factory. Checks the Linear team, labels and states, proves the agent can install, test and work in a git worktree inside its sandbox, then writes docs/agents/project.md and docs/agents/issue-tracker.md. Run once per repo before the first /feature-factory:to-intent.
disable-model-invocation: true
---

<!-- Adapted from Matt Pocock's [`setup-matt-pocock-skills`](https://github.com/mattpocock/skills) (MIT): the explore, confirm, write flow. -->

# Setup

Check that Linear and the local environment can carry an unattended `build`, then write
`docs/agents/project.md` and `docs/agents/issue-tracker.md` from this plugin's `templates/`.

Explore first, then work through the sections below in order. For each one, show what you found
and lead with your recommended answer so the user can accept it in a word. Skip a section the
exploration already settled.

Ask before changing anything in Linear, settings, git or `docs/agents/`. When something is
broken, propose the fix and wait; don't work around it yourself, for example by adding a project
rule. If a file in `docs/agents/` already exists, update it in place and keep the user's edits.

Setup is done when every check passes. Fix problems as you find them. The report's open list is
only for what the user declined or has to do outside the agent.

## 1. Explore

- The install command and the gate CI runs, from the repo's CI config, task runner or build files,
  and from `README.md`, `CLAUDE.md` or `AGENTS.md`. In a monorepo take the root command, and ask
  when several candidates exist.
- The remote is GitHub and `gh auth status` passes. `build` pushes and opens PRs through `gh`.
- The Linear MCP server is connected. If it isn't, stop and say so.
- What already exists: `docs/agents/`, `docs/intent/`, `.claude/settings.json`.

## 2. Linear team

List the teams, propose the one that matches this repo, and get the user to confirm it, since
every ticket, label and project lands there. The skills create one Linear project per intent
later, so there is no project to pick now. Ask whether intents live in this repo (`INTENT_HOME`)
or in another one.

## 3. Labels

The factory needs `ready-for-agent` and a repo label, because `to-tickets` and `build` filter by
both. Propose `repo:<repo-name>` for the repo label, even in a single-repo setup. List the labels
the team lacks and ask whether to create them.

## 4. States

The skills move tickets through four roles. Map each to a state in the team's workflow:

| Role | Must be of Linear type |
| --- | --- |
| Todo | unstarted |
| In Progress | started |
| In Review | started |
| Done | completed |

Match by name first, then by type, and show the mapping. If a role has no state, two roles share
one, or a state has the wrong type, say which and ask how to correct it: map the role to another
existing state, or have the user add the state in Linear's team settings and re-check. Record the
final mapping in `issue-tracker.md`.

Then ask whether Linear's GitHub integration is on for this repo, and get an answer. Without it, a
merged PR's `Closes` lines don't move tickets to Done, so blocked tickets never reach the
frontier. If it's off, the user turns it on in Linear's settings and you re-check, or it goes on
the open list.

## 5. Sandbox and worktrees

Prove, with the proposed `SETUP` and `VERIFY` commands and without bypassing the sandbox, that the
agent can do what `build` and the implementers do. Tell the user up front that the check pushes a
throwaway branch and then deletes it.

1. Implementers run in `.claude/worktrees/` (`isolation: "worktree"`), so check there:
   `git worktree add -b ff-setup-check --no-track .claude/worktrees/ff-setup-check HEAD`.
   Confirm `.claude/worktrees/` is gitignored.
2. In that worktree, run `SETUP`, then `VERIFY`. `VERIFY` must exit 0 on this clean checkout,
   because a gate that already fails blocks every PR.
3. Confirm `SETUP` didn't write `.git/config` or `.git/hooks`. If it did, propose a variant that
   doesn't, for example one that skips a `prepare` hook installer.
4. Remove that worktree. `build` itself works under `$TMPDIR`, so run
   `git worktree add "$TMPDIR/ff-setup-check" ff-setup-check` and, in it, run the remote commands
   exactly as `build` writes them: `git fetch origin`, `git push origin HEAD`,
   `gh pr list --limit 1`, then `git push origin --delete ff-setup-check`.
5. Remove the worktree and delete the local `ff-setup-check` branch.

Look at what `VERIFY` skips: skipped tests, and CI jobs that `VERIFY` leaves out. For each, ask
whether `VERIFY` should cover it. A test skipped for lack of a service or a secret can usually be
reached with a local service, an env var in the settings `env`, or the untracked file listed in
`.worktreeinclude`. Fix what the user wants covered and re-run. Whatever stays out goes into
`UNTESTED`.

When a step fails, find the cause and report it as one of these:

- a sandbox block (a network domain, or a write outside the repo such as `$TMPDIR` or a package
  cache): propose the sandbox setting that allows it;
- a missing permission prompt: propose the `permissions.allow` entry;
- a file the worktree lacks because it's untracked (`.env`, local config): propose listing it in
  `.worktreeinclude`, or say what `VERIFY` must stop depending on;
- a broken command: ask for the right one.

Re-run the check after each fix the user accepts.

Next, list the entries unattended runs need that `.claude/settings.json` doesn't allow yet:
`Bash(git *)`, `Bash(gh *)`, the Linear MCP tools, and the `SETUP` and `VERIFY` commands. Write
settings only when the user says so.

Finally, list worktrees and `ff-*`, `intent/*` and ticket branches left over from earlier runs
(`git worktree list`, `git worktree prune --dry-run`). Offer to remove the ones with no
uncommitted changes and no commits missing from `origin`, and name any you'd keep and why.

## 6. Write

Show both files with every key filled in and where each value came from. `UNTESTED` lists what
`VERIFY` still doesn't reach after §5, or `—`. Let the user edit, then write:

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

Don't repeat `UNTESTED`; it's already in `project.md`. End by saying that
`/feature-factory:to-intent` is next.
