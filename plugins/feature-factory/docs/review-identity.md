# Reviewer identity

`pr-reviewer` (the review loop) must be authenticated as a different
GitHub account than `task-implementer` (the implementation loop).
GitHub blocks self-review: a PR's author can't be added as its reviewer
or approve it. If both loops run as the same account,
`gh pr edit --add-reviewer "$(gh api user -q .login)"` and
`gh pr review --approve` fail on every ticket (`gh` does not resolve
`@me` for `--add-reviewer`), and the pipeline's independent-approval gate does nothing.

## Setup

1. A second GitHub account (a bot or service account) with write access
   to this repo. Reviewing and merging both need write access.
2. Log that account in to `gh` once, in its own config folder:

   ```
   GH_CONFIG_DIR=~/.config/gh-reviewer gh auth login
   ```

   `gh` keeps that login in the OS keychain, like the default one.
3. Before starting the review-loop session, point that terminal at the
   folder, then launch Claude from this repo's root:

   ```
   export GH_CONFIG_DIR=~/.config/gh-reviewer
   claude
   /loop 10m /feature-factory:next-pr
   ```

4. Leave the implementation-loop terminal on the default `gh auth login`
   identity. Don't export `GH_CONFIG_DIR` there.

`GH_CONFIG_DIR` selects `gh`'s login for every `gh` call made in that
process tree, including the worktrees `pr-reviewer` makes under
`.worktrees/`, so the two loops stay on separate identities on one
machine. Use `GH_CONFIG_DIR`, not `gh auth switch`: switch flips a
single global active account and would race if both loops run at once.

Set `REVIEWER_LOGIN` in `project.md` to the account's login. `next-pr`
then checks the session's login before each tick and stops if it is
another account, for example after exporting the wrong folder.

### More than one reviewer account

One account can review every repo it has write access to, so one folder
is usually enough. When a repo needs another account (a work org that
requires its own account, or a private bot that should not reach work
repos), give that account its own folder, named after it:

```
GH_CONFIG_DIR=~/.config/gh-reviewer-<account> gh auth login
```

Then export that folder in that repo's review terminal, and set the
repo's `REVIEWER_LOGIN` to that account.

## Keep the gate away from the reviewer login

`pr-reviewer` runs `VERIFY` on the PR's code while logged in as the
reviewer account. Code that runs with access to that login can read
it (`gh auth token`) and approve and merge itself. So `VERIFY` must run
the code sandboxed, without the reviewer's `gh` config or keychain,
for example in a container built from `git archive`. `project.md` says
how the repo's `VERIFY` does this.

## Fail closed

`pr-reviewer` stops and reports if claiming or approving a PR fails for
any reason, including a same-account collision. It never merges without
a recorded independent approval. A review run that reports this means
the setup above isn't in place or has drifted, not that it is safe to
proceed.
