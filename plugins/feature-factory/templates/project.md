# Project config

<!-- Copy to docs/agents/project.md in the repo and fill every row.
     Write `—` for a key that does not apply; don't delete the row.
     The feature-factory skills and agents read this file first. -->

| Key | Value | Notes |
| --- | --- | --- |
| `LINEAR_MCP` | `linear-work` | Name of the Linear MCP server in this repo's `.mcp.json`. Name it after the workspace, not `linear-server`. |
| `LINEAR_TEAM` | `ABC` | Linear team key. Tickets are `ABC-<n>`, branches `feat/abc-<n>-<slug>`. |
| `REPO_LABEL` | — | Linear label that scopes the queue to this repo, when a team spans several repos. List each label when the project spans repos, and say which repo depends on which. |
| `SETUP` | `make install` | Installs dependencies in a fresh worktree. Must be idempotent. |
| `VERIFY` | `make verify` | The gate. Passes only on exit 0. It runs the PR's code, so it must run sandboxed, without the reviewer's `gh` login (`review-identity.md`). Say whether it reads committed content only (then commit first) and name its pass line if it prints one, for example `gate: PASS <sha>`. |
| `SPEC_DIR` | `docs/intent/<NNN-slug>/` | Where intents live: `intent.md`, `plan.md`, optional `spec.md`. Name the template folder and the completed folder (`implemented/` or `shipped/`). If intents live outside this repo, say how a ticket's `Source:` path maps onto this checkout. |
| `REVIEWER_LOGIN` | — | Optional. GitHub login of the review-loop account (`review-identity.md`). When set, `next-pr` stops before doing anything if the session is logged in as another account. |
| `MAX_IN_FLIGHT` | `3` | Open pipeline PRs plus assigned `ready-for-agent` tickets. |
| `MAX_SPAWN` | — | Optional. Per-tick cap on implementers spawned by `next-ticket`. Default: no cap beyond `MAX_IN_FLIGHT`. |
| `MAX_REVIEW_SPAWN` | — | Optional. Per-tick cap on reviewers spawned by `next-pr`. Default: no cap. |
| `SHARED_GLOBS` | `docs/adr/**`, `docs/intent/**`, lockfiles | Numbered sequences and lockfiles. A diff that adds or renames a file under one must declare the whole glob in `## Touches`. |
| `PIPELINE_PATHS` | `Makefile`, `.github/**`, `.claude/**`, `docs/agents/**`, `scripts/**` | Build, gate and pipeline config. A ticket touching these counts as `**` (runs alone) and its PR is flagged for manual review. |
| `SENSITIVE_PATHS` | `src/billing/**` | A behaviour change here is flagged for manual review. Tests, comments, formatting and docs are not. Auth is covered by its own rule and need not be listed. |
| `RECREATE` | — | Command that rebuilds state derived from `SHARED_GLOBS` (for example test databases), run when a diff edits or removes such a file. |
| `UNTESTED` | — | What `VERIFY` cannot reach (CI-only checks, e2e, live third-party calls). Never blocks a merge by itself. |

## Project rules

<!-- Repo-specific rules for implementers and reviewers, for example when
     an intent doc is mandatory. -->

Also read: `REVIEW.md` at the repo root (review standards, optional),
`docs/agents/*.md` files named above (for example `gate.md`).
