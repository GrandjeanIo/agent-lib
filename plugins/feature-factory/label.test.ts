import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { DENY, FACTORY_MARKER, missingLabel } from './hooks/register.ts'

// Stands for the engine: records each Bash command that got past the plugin, and answers
// whether the session's repo is set up for the factory.
function bash(on: On, factoryRepo = true) {
  const ran: string[] = []
  on('session.cwd', async () => ({ value: '/repo' }))
  on('fs.exists', async (_$, e) => ({ value: factoryRepo && e.path === `/repo/${FACTORY_MARKER}` }))
  on('tool.call', async (_$, e) => {
    if (e.tool === 'Bash') ran.push(e.command)
    return { result: {} } as never
  })
  return ran
}

test('gh pr create without the label is refused, with the fix in the reason', async ($, on) => {
  const ran = bash(on)

  const res = await $.tool.call({ tool: 'Bash', command: 'gh pr create --base main --title "x" --body-file b.md' })

  expect(ran).toEqual([])
  expect(res.deny).toBe(DENY)
})

test('outside a factory repo, gh pr create without the label runs', async ($, on) => {
  const ran = bash(on, false)
  const command = 'gh pr create --repo upstream/x --fill'

  await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual([command])
})

test('gh pr create with the label, in any flag spelling, runs', async ($, on) => {
  const ran = bash(on)
  const commands = [
    'gh pr create --title x --body-file b.md --label needs-review',
    'gh pr create -l needs-review --fill',
    'gh pr create --label "bug,needs-review" --fill',
    "gh pr create --label 'bug, needs-review' --fill",
    'cd /tmp/wt && gh pr create --label=needs-review --fill',
    'gh pr new -l needs-review --fill',
  ]

  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('other gh and Bash commands are left alone', async ($, on) => {
  const ran = bash(on)
  const commands = [
    'gh pr list --label needs-review',
    'gh pr view 12',
    'git push origin HEAD',
    'git commit -m "docs: run gh pr create with the label"',
  ]

  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('the label only counts as the value of --label or -l', () => {
  expect(missingLabel('gh pr create --title "fix needs-review guard" --fill')).toBe(true)
  expect(missingLabel('gh pr create --head needs-review --fill')).toBe(true)
  expect(missingLabel('gh pr create --label bug --fill && echo needs-review')).toBe(true)
  expect(missingLabel('gh pr new --fill')).toBe(true)
  expect(missingLabel('git status; gh pr create --fill')).toBe(true)
  expect(missingLabel('gh pr create --label needs-reviewed --fill')).toBe(true)
  expect(missingLabel('gh pr create --label needs-review --fill')).toBe(false)
})
