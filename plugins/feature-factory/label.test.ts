import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { DENY, FACTORY_MARKER, missingLabel } from './hooks/register.ts'

// Stands in for the engine beneath the plugin: the session runs in `cwd`, the factory repos are
// `factoryRoots`, and each Bash command that gets past the plugin is recorded and returned.
function fakeEngine(on: On, { cwd = '/repo', factoryRoots = ['/repo'], fail = false } = {}) {
  const ran: string[] = []
  on('session.cwd', async () => ({ value: cwd }))
  on('fs.exists', async (_$, e) => ({ value: factoryRoots.some(r => e.path === `${r}/${FACTORY_MARKER}`) }))
  on('tool.call', async (_$, e) => {
    if (e.tool === 'Bash') ran.push(e.command)
    if (fail) throw new Error('Bash failed')
    return { result: {} } as never
  })
  return ran
}

test('gh pr create without the label is refused, with the fix in the reason', async ($, on) => {
  const ran = fakeEngine(on)

  const res = await $.tool.call({ tool: 'Bash', command: 'gh pr create --base main --title "x" --body-file b.md' })

  expect(ran).toEqual([])
  expect(res.deny).toBe(DENY)
})

test('outside a factory repo, gh pr create without the label runs', async ($, on) => {
  const ran = fakeEngine(on, { factoryRoots: [] })
  const command = 'gh pr create --repo upstream/x --fill'

  await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual([command])
})

test('a session in a subfolder of a factory repo is guarded', async ($, on) => {
  const ran = fakeEngine(on, { cwd: '/repo/src/app' })

  const res = await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' })

  expect(ran).toEqual([])
  expect(res.deny).toBe(DENY)
})

test('a cd into a factory repo is guarded, from a session elsewhere', async ($, on) => {
  const ran = fakeEngine(on, { cwd: '/other', factoryRoots: ['/factory'] })

  for (const command of ['cd /factory && gh pr create --fill', 'cd ../factory/sub && gh pr create --fill']) {
    const res = await $.tool.call({ tool: 'Bash', command })
    expect(res.deny).toBe(DENY)
  }
  expect(ran).toEqual([])
})

test('gh pr create with the label, in any flag spelling, runs', async ($, on) => {
  const ran = fakeEngine(on)
  const commands = [
    'gh pr create --title x --body-file b.md --label needs-review',
    'gh pr create -l needs-review --fill',
    'gh pr create --label "bug,needs-review" --fill',
    "gh pr create --label 'bug, needs-review' --fill",
    'cd /tmp/wt && gh pr create --label=needs-review --fill',
    'gh pr new -l needs-review --fill',
    'gh pr create --body "adds A; fixes B && C" --label needs-review',
    'gh pr create --title x \\\n  --label needs-review',
  ]

  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('other gh and Bash commands are left alone', async ($, on) => {
  const ran = fakeEngine(on)
  const commands = [
    'gh pr list --label needs-review',
    'gh pr view 12',
    'git push origin HEAD',
    'git commit -m "docs: run gh pr create with the label"',
    'git commit -m "x; gh pr create later"',
  ]

  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('a failure beneath the guard is passed on, and the command runs once', async ($, on) => {
  const ran = fakeEngine(on, { fail: true })
  const command = 'gh pr create --label needs-review --fill'

  await $.tool.call({ tool: 'Bash', command }).catch(() => undefined)

  expect(ran).toEqual([command])
})

test('the label only counts as the value of --label or -l', () => {
  expect(missingLabel('gh pr create --title "fix needs-review guard" --fill')).toBe(true)
  expect(missingLabel('gh pr create --head needs-review --fill')).toBe(true)
  expect(missingLabel('gh pr create --label bug --fill && echo needs-review')).toBe(true)
  expect(missingLabel('gh pr new --fill')).toBe(true)
  expect(missingLabel('git status; gh pr create --fill')).toBe(true)
  expect(missingLabel('gh pr create --label needs-reviewed --fill')).toBe(true)
  expect(missingLabel('GH_REPO=o/r gh pr create --fill')).toBe(true)
  expect(missingLabel('command gh pr create --fill')).toBe(true)
  expect(missingLabel('(cd wt && gh pr create --fill)')).toBe(true)
  expect(missingLabel('gh pr create --label needs-review --fill')).toBe(false)
  expect(missingLabel('gh pr create -lneeds-review --fill')).toBe(false)
})
