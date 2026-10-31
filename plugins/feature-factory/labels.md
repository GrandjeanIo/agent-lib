# Review labels

The GitHub labels the review flow uses, defined once here. `setup`, `build` and `review` point to
this file. `LABEL` in `hooks/register.ts` must match the `needs-review` row: change both
together.

| Label | Colour | Description | Set by |
|---|---|---|---|
| `needs-review` | `FBCA04` | Waiting for the agent reviewer | `build` on every PR it opens; a person asking for another review |
| `agent-reviewed` | `0E8A16` | Reviewed by the agent reviewer | `review` after it posts |

Create a label only when it is missing, so a colour or description someone changed is kept:

```
gh label list --search <name> --json name --jq '.[].name' | grep -qx '<name>' \
  || gh label create <name> --color <colour> --description "<description>"
```
