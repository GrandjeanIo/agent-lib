---
name: to-intent
description: Capture a new situation or goal as a durable docs/intent/<NNN-slug>/intent.md — stage 1 of the intent → plan → tickets flow. Use when starting new work that doesn't have an intent.md yet.
---

# Intent

Turn a situation or goal — whatever's already been said, plus a short
follow-up — into `SPEC_DIR/intent.md`, the first durable artifact in
the build chain (`to-intent → to-plan → to-ticket`). `SPEC_DIR` in
`docs/agents/project.md` names the directory, the template and the
completed folder.

## Process

### 1. Work from what's already known

Don't re-ask anything already covered in the conversation. If the user
just described a situation or goal in plain text, that is the draft.

### 2. Fill the gaps

Ask only for what's missing:

- **Problem** — what's wrong or missing, from the user's perspective.
- **Proposed outcome** — what changes once this is done.
- **Affected users and systems** — "none, development only" is valid.
- **Constraints** — anything that limits the solution space.
- **Open questions** — unresolved things `to-plan` must close. Omit the
  section if there are none; don't manufacture questions.

Keep it terse: one or two sentences per section. Check the glossary and
`docs/adr/` (`${CLAUDE_PLUGIN_ROOT}/docs/domain.md`) for existing vocabulary and
prior decisions; flag a contradiction rather than picking a side.

### 3. Number and slug

List `SPEC_DIR`'s parent **and its completed folder** (`implemented/`
or `shipped/`), ignore the template, take the highest `NNN` plus one,
zero-padded. Numbers are never reused: an intent keeps its number after
it ships, so a scan of the top level alone hands out a number already
taken. Derive a short kebab-case slug from the outcome
(`002-claim-status-portal`). Confirm it if not obvious.

### 4. Write the file

`SPEC_DIR/intent.md`, following the template if present, otherwise:

```markdown
# Intent: <short name>

Author: <user's name>

## Problem

## Proposed outcome

## Affected users and systems

## Constraints

## Open questions
```

No status field: an intent with no `plan.md` beside it is a draft.

### 5. Report

Tell the user the path, and that `/feature-factory:to-plan` is next.
