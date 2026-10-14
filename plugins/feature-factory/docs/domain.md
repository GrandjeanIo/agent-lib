# Domain docs

Before exploring, read the glossary and decision log for the area you
are working in. By convention:

| What | Where |
| --- | --- |
| Glossary | `CONTEXT.md` at the repo root |
| Decisions | `docs/adr/` |

If the repo keeps them elsewhere, `project.md` says where.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor
proposal, a test name), use the term as the glossary defines it. If the
concept isn't there, either you are inventing language the project
doesn't use, or there is a real gap to flag.

## Flag ADR conflicts

If your output contradicts an existing ADR, say so rather than silently
overriding it:

> _Contradicts ADR-0010 (<title>), but worth reopening because…_
