---
name: tdd-implement
description: Implement one ticket test-first from its acceptance criteria and loaded intent/plan context, at the seams the plan agreed. Ends with the verify gate green and the work committed on the current branch. Does not open a PR — the caller does.
---

# TDD Implement

Implement the work the ticket describes, on the current branch, inside
its `## Touches` set. `VERIFY` and `SETUP` come from
`docs/agents/project.md`.

1. For each acceptance criterion, write a failing test at the seam
   `plan.md`'s Testing seams named (`spec.md` in older intents), then
   the least code that passes it. A criterion with no test that would
   fail on revert is not done. A repo with no test runner (`project.md`
   says) has nothing to make red: implement from the criteria and rely
   on `VERIFY`.
2. Run type checks, lint and the single test file often; the full
   suite once at the end.
3. Run `VERIFY`. Commit first if the gate reads committed content
   only (`project.md` says). It passes only when it exits 0 **and**, if
   `project.md` names a pass line (for example `gate: PASS <sha>`), that
   line is printed with the SHA from `git rev-parse HEAD`. A pass for
   another SHA proves another tree. Fix and re-run until it passes.
   Never weaken the gate.
4. Review the diff the way `pr-reviewer` will (steps 5 and 7 there): a
   test per criterion that fails on revert, no behaviour beyond
   `plan.md`, no files outside `## Touches`, the security pass, and
   `REVIEW.md` if the repo has one. Fix every blocking finding.
5. Commit with a message naming the ticket (`T-<n>: <summary>`) and
   stop. Report which criterion each test covers, and anything you had
   to touch outside `## Touches`. The caller opens the PR.
