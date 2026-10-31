// The reviewer only picks up PRs labelled `needs-review`, so a PR an agent opens without it is
// never reviewed. This guard refuses `gh pr create` until the command carries the label, in repos
// set up for the factory only: elsewhere (an upstream you can't label) it stays out of the way.
// The labels themselves (colour, description, how to create one) are defined in labels.md.
import type { Register } from 'claude-code'

const LABEL = 'needs-review'
const PLUGIN = 'feature-factory'

// The file `/feature-factory:setup` writes; a repo with it is a factory repo.
export const FACTORY_MARKER = 'docs/agents/project.md'

export const DENY =
  `${PLUGIN}: every PR must carry the "${LABEL}" label so the agent reviewer picks it up. ` +
  `Re-run the command with --label ${LABEL}. If the repo lacks the label, create it first ` +
  `as labels.md in the ${PLUGIN} plugin shows.`

// Splits a shell command into simple commands, each a list of words with the quotes removed.
// Separators (`;`, `&`, `|`, `(`, `)`, newline) count only outside quotes; a backslash-newline
// continues the line.
export const simpleCommands = (command: string): string[][] => {
  const commands: string[][] = []
  let words: string[] = []
  let word: string | undefined
  const endWord = () => {
    if (word !== undefined) words.push(word)
    word = undefined
  }
  const endCommand = () => {
    endWord()
    if (words.length) commands.push(words)
    words = []
  }
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (c === '\\') {
      if (command[i + 1] === '\n') i++
      else word = (word ?? '') + (command[++i] ?? '')
    } else if (c === "'") {
      const end = command.indexOf("'", i + 1)
      const stop = end === -1 ? command.length : end
      word = (word ?? '') + command.slice(i + 1, stop)
      i = stop
    } else if (c === '"') {
      word = word ?? ''
      for (i++; i < command.length && command[i] !== '"'; i++) {
        if (command[i] === '\\' && /["\\$`\n]/.test(command[i + 1] ?? '')) i++
        word += command[i]
      }
    } else if (/[;&|()\n]/.test(c)) endCommand()
    else if (/\s/.test(c)) endWord()
    else word = (word ?? '') + c
  }
  endCommand()
  return commands
}

// The words after any `VAR=value` assignments and `command`/`env`/`exec` prefixes.
const program = (words: string[]) => {
  let i = 0
  while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]) || /^(command|env|exec)$/.test(words[i]))) i++
  return words.slice(i)
}

const isPrCreate = (w: string[]) => w[0] === 'gh' && w[1] === 'pr' && (w[2] === 'create' || w[2] === 'new')

// The values given to `--label`/`-l`: `-l x`, `-lx`, `--label x`, `--label=x`, each a comma list.
const labels = (args: string[]) =>
  args.flatMap((a, i) => {
    const value = a === '--label' || a === '-l' ? args[i + 1] : a.match(/^(?:--label=|-l)(.+)$/)?.[1]
    return value === undefined ? [] : value.split(',').map(l => l.trim())
  })

// True when `command` opens a PR and no `--label`/`-l` value names the label.
export const missingLabel = (command: string) =>
  simpleCommands(command)
    .map(program)
    .some(w => isPrCreate(w) && !labels(w.slice(3)).includes(LABEL))

// The directories `command` changes into with `cd`, in order.
const cdTargets = (command: string) =>
  simpleCommands(command)
    .map(program)
    .filter(w => w[0] === 'cd' && w[1] !== undefined)
    .map(w => w[1])

const resolve = (base: string, path: string) => (path.startsWith('/') ? path : `${base}/${path}`)
const parent = (dir: string) => dir.replace(/\/+[^/]*\/*$/, '') || '/'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (!missingLabel(e.command)) return next(e)
    // A factory repo is any directory, or a parent of it, holding the marker: the session's
    // directory, or one the command changes into (a `cd ~/x` is not followed).
    const cwd = await $.session.cwd()
    const starts = [cwd, ...cdTargets(e.command).filter(d => !d.startsWith('~')).map(d => resolve(cwd, d))]
    for (const start of starts) {
      for (let dir = start; ; dir = parent(dir)) {
        if (await $.fs.exists(`${dir === '/' ? '' : dir}/${FACTORY_MARKER}`)) return { deny: DENY }
        if (dir === '/') break
      }
    }
    return next(e)
    // In a catch `next` is replay-safe: once called, `next(e)` settles to what the first call
    // settled to and runs nothing beneath again, so a failure beneath is passed on, not retried.
  }).catch(($, e, next) => (next.called ? next(e) : { deny: `${PLUGIN}: its ${LABEL} guard failed.` }))
}
