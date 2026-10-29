// The reviewer only picks up PRs labelled `needs-review`, so a PR an agent opens without it is
// never reviewed. This guard refuses `gh pr create` until the command carries the label.
import type { Register } from 'claude-code'

export const LABEL = 'needs-review'

const PR_CREATE = /\bgh\s+pr\s+create\b/

export const DENY =
  `feature-factory: every PR must carry the "${LABEL}" label so the agent reviewer picks it up. ` +
  `Re-run the command with --label ${LABEL}. If the repo lacks the label, create it first: ` +
  `gh label create ${LABEL} --color FBCA04 --description "Waiting for the agent reviewer" --force`

// A substring check, not a flag parser: `--label needs-review`, `-l needs-review`,
// `--label "bug,needs-review"` and `--label=needs-review` all pass.
export const missingLabel = (command: string) => PR_CREATE.test(command) && !command.includes(LABEL)

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, ($, e, next) => (missingLabel(e.command) ? { deny: DENY } : next(e))).catch(
    ($, e, next) => (next.called ? next(e) : { deny: `${$.plugin.name}: its needs-review guard failed.` }),
  )
}
