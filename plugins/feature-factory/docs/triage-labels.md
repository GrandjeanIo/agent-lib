# Labels

## Triage (Linear)

| Label             | Meaning                                       |
| ----------------- | --------------------------------------------- |
| `needs-triage`    | Maintainer needs to evaluate this issue       |
| `needs-info`      | Waiting on reporter for more information      |
| `ready-for-agent` | Fully specified, ready for an autonomous agent |
| `ready-for-human` | Requires human implementation                 |
| `wontfix`         | Will not be actioned                          |

When a skill names a triage role ("apply the AFK-ready label"), use the
string above. `REPO_LABEL` from `project.md` sits alongside these.

## Pipeline (GitHub PRs)

| Label                | Meaning                                              |
| -------------------- | ---------------------------------------------------- |
| `needs-review`       | Implementer is done; `pr-reviewer` polls for this    |
| `changes-requested`  | Reviewer sent it back; `task-implementer` fixes first |
| `wip`                | A session is fixing a `changes-requested` PR now     |
| `needs-human-review` | Escalated; holds its lane until a person clears it   |
