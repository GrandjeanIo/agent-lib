// The reviewer only picks up PRs labelled `needs-review`, so a PR an agent opens without it is
// never reviewed. This guard refuses `gh pr create` until the command carries the label, in repos
// set up for the factory only: elsewhere (an upstream you can't label) it stays out of the way.
// The labels are defined once, in labels.md; keep DENY's command in step with it.
import type { Register } from 'claude-code'

const LABEL = 'needs-review'
const PLUGIN = 'feature-factory'

// The file `/feature-factory:setup` writes; a repo with it is a factory repo.
export const FACTORY_MARKER = 'docs/agents/project.md'

// `gh pr create` or its alias `gh pr new` where a command starts: at the beginning, or after
// `&&`, `||`, `;`, `|`, `(` or a newline. Inside a quoted message it is not a command.
const PR_CREATE = /(?:^|[;&|(\n])\s*gh\s+pr\s+(?:create|new)\b/

// A `--label`/`-l` flag and its value: `-l x`, `--label x`, `--label=x`, `--label "a, x"`, `-l 'a,x'`.
const LABEL_FLAG = /(?:^|\s)(?:--label|-l)(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s;&|]+))/g

export const DENY =
  `${PLUGIN}: every PR must carry the "${LABEL}" label so the agent reviewer picks it up. ` +
  `Re-run the command with --label ${LABEL}. If the repo lacks the label, create it first: ` +
  `gh label create ${LABEL} --color FBCA04 --description "Waiting for the agent reviewer"`

// The arguments of the `gh pr create` in `command`, up to the next command separator.
const prCreateArgs = (command: string) => {
  const at = command.match(PR_CREATE)
  if (at?.index === undefined) return undefined
  return command.slice(at.index + at[0].length).split(/&&|\|\||;|\n/)[0]
}

// True when `command` opens a PR and no `--label`/`-l` value names the label.
export const missingLabel = (command: string) => {
  const args = prCreateArgs(command)
  if (args === undefined) return false
  for (const m of args.matchAll(LABEL_FLAG)) {
    const value = m[1] ?? m[2] ?? m[3] ?? ''
    if (value.split(',').some(l => l.trim() === LABEL)) return false
  }
  return true
}

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!missingLabel(e.command)) return next(e)
    const factoryRepo = await $.fs.exists(`${await $.session.cwd()}/${FACTORY_MARKER}`)
    return factoryRepo ? { deny: DENY } : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${PLUGIN}: its ${LABEL} guard failed.` }))
}
