# Project config

<!-- Copy to docs/agents/project.md in the repo and fill every row.
     Write `—` for a key that does not apply. The feature-factory
     skills and agents read this file first. -->

| Key | Value | Notes |
| --- | --- | --- |
| `LINEAR_TEAM` | `ABC` | Linear team key. Tickets are `ABC-<n>`, branches `feat/abc-<n>-<slug>`. |
| `REPO_LABEL` | `repo:web` | Linear label for this repo's tickets. Needed when one intent spans several repos. |
| `INTENT_HOME` | `this repo` | Where `docs/intent/` lives: `this repo`, or `owner/repo` for a shared home. |
| `SETUP` | `make install` | Installs dependencies in a fresh worktree. Idempotent; must not write `.git/config` or `.git/hooks`. |
| `VERIFY` | `make verify` | The gate. Passes only on exit 0. |
| `UNTESTED` | — | Optional. What `VERIFY` can't reach (e2e, live third-party calls). Lands in the PR's review list when the diff depends on it. |

## Project rules

<!-- Repo-specific rules for implementers and the review. -->
