---
name: to-intent
description: Capture a new situation or goal as a durable docs/intent/<NNN-slug>/intent.md — stage 1 of the intent → plan → tickets → build flow. Use when starting new work that doesn't have an intent.md yet.
---

Adapted in part from Matt Pocock's [`to-spec`](https://github.com/mattpocock/skills) (MIT).

# Intent

Turn a situation or goal — whatever's already been said, plus a short
follow-up — into `docs/intent/<NNN-slug>/intent.md`, the first durable
artifact in the chain (`to-intent → to-plan → to-tickets → build`).
Intents live in the repo `INTENT_HOME` names
(`docs/agents/project.md`), also when the work spans several repos.
Run this there.

## Process

### 1. Work from what's already known

Don't re-ask anything already covered in the conversation. If the user
just described a situation or goal in plain text, that is the draft.

### 2. Fill the gaps

Ask only for what's missing:

- **Problem** — what's wrong or missing, from the user's perspective.
- **Proposed outcome** — what changes once this is done.
- **Affected users and systems** — including which repos. "None,
  development only" is valid.
- **Constraints** — anything that limits the solution space.
- **Open questions** — unresolved things `to-plan` must close. Omit the
  section if there are none; don't manufacture questions.

Keep it terse: one or two sentences per section. Check the glossary and
ADRs for existing vocabulary and prior decisions; flag a contradiction
rather than picking a side.

### 3. Number and slug

List `docs/intent/`, take the highest `NNN` plus one, zero-padded.
Numbers are never reused. Derive a short kebab-case slug from the
outcome (`002-claim-status-portal`). Confirm it if not obvious.

### 4. Write the file

```markdown
# Intent: <short name>

Author: <user's name>

## Problem

## Proposed outcome

## Affected users and systems

## Constraints

## Open questions
```

No status field: an intent with no `plan.md` beside it is a draft; the
Linear project says when it is done.

### 5. Report

Tell the user the path, and that `/feature-factory:to-plan` is next.
