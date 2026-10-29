import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { DENY } from './hooks/register.ts'

// Stands for the engine: records each Bash command that got past the plugin.
function bash(on: On) {
  const ran: string[] = []
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

test('gh pr create with the label, in any flag spelling, runs', async ($, on) => {
  const ran = bash(on)
  const commands = [
    'gh pr create --title x --body-file b.md --label needs-review',
    'gh pr create -l needs-review --fill',
    'gh pr create --label "bug,needs-review" --fill',
    'cd /tmp/wt && gh pr create --label=needs-review --fill',
  ]

  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})

test('other gh and Bash commands are left alone', async ($, on) => {
  const ran = bash(on)
  const commands = ['gh pr list --label needs-review', 'gh pr view 12', 'git push origin HEAD']

  for (const command of commands) await $.tool.call({ tool: 'Bash', command })

  expect(ran).toEqual(commands)
})
