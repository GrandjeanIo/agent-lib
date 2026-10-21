---
name: setup
description: Set up this repo for the feature factory by writing docs/agents/project.md and docs/agents/issue-tracker.md and checking the Linear team, states and labels they name. Run once per repo before the first /feature-factory:to-intent.
disable-model-invocation: true
---

# Setup

Write `docs/agents/project.md` and `docs/agents/issue-tracker.md` from this plugin's `templates/`.
Infer what you can from the repo and ask only about the rest. If a file exists, update it in
place and keep the user's edits.

## Process

1. **Explore.** Find out, from whatever the repo uses:
   - the install command and the gate CI runs, from its CI config, task runner or build files,
     and from `README.md`, `CLAUDE.md` or `AGENTS.md`. Take the root command in a monorepo, and
     ask which one when several candidates exist.
   - whether the remote is GitHub and `gh auth status` passes. `build` opens PRs through `gh`.
   - whether `docs/agents/` and `docs/intent/` already exist, and what `.claude/settings.json`
     already allows.
   - whether the Linear MCP server is connected. Stop and say so if it isn't.

2. **Check Linear** through the MCP server. Confirm the team key. Check the team has the states
   Todo, In Progress, In Review and Done, and say so if one is missing. Check the labels
   `ready-for-agent` and the repo label exist, and create a missing one only after the user agrees.

3. **Fill the keys** in `templates/project.md`, saying where each value came from:
   - `REPO_LABEL`: propose `repo:<repo-name>`, even for a single repo. `to-tickets` and `build`
     filter by it.
   - `INTENT_HOME`: `this repo` unless the user says otherwise.
   - `SETUP`: the install command. It must be idempotent and must not write `.git/config` or
     `.git/hooks`.
   - `VERIFY`: the gate. Run it once and confirm it exits 0 before writing it.
   - `UNTESTED`: what `VERIFY` can't reach, or `—`.

4. **Confirm and write.** Show both files, let the user edit, then write them. Don't commit.

5. **Permissions.** List the entries still missing from `permissions.allow` in
   `.claude/settings.json` that unattended `build` needs (`Bash(git *)`, `Bash(gh *)`, the Linear
   MCP tools, and the `SETUP` and `VERIFY` commands). Write them only if the user says so.

6. **Report** what was written and what is still missing. `/feature-factory:to-intent` is next.
