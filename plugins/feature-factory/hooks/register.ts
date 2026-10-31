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
// continues the line; a `#` that starts a word comments out the rest of the line.
const simpleCommands = (command: string): string[][] => {
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
    } else if (c === '#' && word === undefined) {
      while (i + 1 < command.length && command[i + 1] !== '\n') i++
    } else if (/[;&|()\n]/.test(c)) endCommand()
    else if (/\s/.test(c)) endWord()
    else word = (word ?? '') + c
  }
  endCommand()
  return commands
}

// The words after any `VAR=value` assignments and `command`/`env`/`exec` prefixes.
const withoutPrefixes = (words: string[]) => {
  let i = 0
  while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]) || /^(command|env|exec)$/.test(words[i]))) i++
  return words.slice(i)
}

// Each simple command in `command`, as the words of the program it runs.
export const parse = (command: string) => simpleCommands(command).map(withoutPrefixes)

// The arguments of a `gh pr create`/`gh pr new`, past any `-R`/`--repo` before `pr`; else undefined.
const prCreateArgs = (w: string[]) => {
  if (w[0] !== 'gh') return undefined
  let i = 1
  for (;;) {
    if (w[i] === '-R' || w[i] === '--repo') i += 2
    else if (/^(-R.|--repo=)/.test(w[i] ?? '')) i++
    else break
  }
  return w[i] === 'pr' && (w[i + 1] === 'create' || w[i + 1] === 'new') ? w.slice(i + 2) : undefined
}

// The values given to `--label`/`-l`: `-l x`, `-lx`, `--label x`, `--label=x`, each a comma list.
const labels = (args: string[]) =>
  args.flatMap((a, i) => {
    const value = a === '--label' || a === '-l' ? args[i + 1] : a.match(/^(?:--label=|-l)(.+)$/)?.[1]
    return value === undefined ? [] : value.split(',').map(l => l.trim())
  })

// True when one of the `parse`d commands opens a PR and no `--label`/`-l` value names the label.
export const missingLabel = (commands: string[][]) =>
  commands.some(w => {
    const args = prCreateArgs(w)
    return args !== undefined && !labels(args).includes(LABEL)
  })

// The directories the `parse`d commands change into with `cd`, in order.
const cdTargets = (commands: string[][]) => commands.filter(w => w[0] === 'cd' && w[1] !== undefined).map(w => w[1])

const resolve = (base: string, path: string) => (path.startsWith('/') ? path : `${base}/${path}`)
const parent = (dir: string) => dir.replace(/\/+[^/]*\/*$/, '') || '/'

export const register: Register = on => {
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const commands = parse(e.command)
    if (!missingLabel(commands)) return next(e)
    // A factory repo is any directory, or a parent of it, holding the marker: the session's
    // directory, or one the command changes into (a `cd ~/x` is not followed).
    const cwd = await $.session.cwd()
    const starts = [cwd, ...cdTargets(commands).filter(d => !d.startsWith('~')).map(d => resolve(cwd, d))]
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
