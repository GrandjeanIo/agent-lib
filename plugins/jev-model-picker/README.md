# jev-model-picker

A Claude Code mod that lets JEV pick the model once per context: at session start and after
`/clear`. Mid-session prompts never change the model, so the cache stays warm.

- **Session start:** the pick runs on your first prompt of a new session. The mod needs the prompt
  text to classify it, so nothing is picked before you type.
- **After `/clear`:** the next prompt you submit is picked again, as a fresh context.
- **Every other prompt:** the model is left alone.

```
first prompt (or first after /clear) ──► JEV prompt-router (haiku | sonnet | opus) ──► /config model row
                                                                                       status line: "jev → sonnet"
```

The pick writes the `/config` model row and applies to that first turn. The transcript gets a
line with the result, so you see the pick before the cache grows and can still `/model` up cheaply:

```
jev → haiku (0.97) for this session, was sonnet · /model to change
jev → sonnet (haiku 0.82 is under the 0.90 bar) for this session · /model to change
jev → sonnet (0.75, confirm: <JEV's reason>) for this session · /model to change
jev → opus (0.10, escalate: <JEV's reason>) for this session · /model to change
```

- **act**: JEV is sure. The line shows its confidence.
- **confirm**: the line adds JEV's reason.
- **escalate** (JEV is unsure or unreachable): the preset's fallback, `opus`, plus the reason.
- **Haiku has a higher bar.** A wrong downgrade costs more than a wrong upgrade, so Haiku needs
  confidence ≥ `haikuConfidence` (default 0.9). Below that the session gets Sonnet.

## Install

```
/plugin marketplace add GrandjeanIo/agent-lib
/plugin install jev-model-picker@agent-lib
```

Pick a scope. The install screen asks for the options below.

**Privacy: routing is on by default when a TypeSafe key is set.** The first prompt of each new
session (and after `/clear`) is sent to the TypeSafe API. To keep prompts local, leave the key empty
and don't set `TYPESAFE_API_KEY`, or set `JEV_MOCK=1`. See [Data and privacy](#data-and-privacy).

## Options

| Option | Default | |
| --- | --- | --- |
| TypeSafe API key (`apiKey`) | empty | Kept in secure storage, never in settings.json. When empty, the mod reads `TYPESAFE_API_KEY` from the environment. |
| Route down to Haiku (`allowHaiku`) | on | Turn it off and JEV picks only between Sonnet and Opus (the claude-jev approach). |
| Haiku confidence bar (`haikuConfidence`) | 0.9 | How sure JEV must be before downgrading to Haiku. |

Change the API key later in `/plugin` → jev-model-picker → configure. The other two options are rows in `/config`.

## Develop

Run from the agent-lib repo root:

```sh
export TYPESAFE_API_KEY=...       # or JEV_MOCK=1 for the offline keyword mock
claude --plugin-dir plugins/jev-model-picker

claude plugin validate .                     # marketplace + manifest + module
claude plugin test plugins/jev-model-picker
```

`npx tsc --noEmit` type-checks against `.claude-plugin/types/`. That folder is gitignored and
written locally by Claude Code, so a fresh clone fails with TS5083 until it exists. `validate` and
`test` don't need it. The repo has no TypeScript dependency; use TypeScript 5.4 or newer.

`hooks/jev/` is the JEV decision model. It is first-party code in this repo, edited here like the rest
of the plugin. Tune the decision in `hooks/register.ts` with `.tune({...})`.

## Data and privacy

**Routing is on by default when a TypeSafe key is set.** With a key (the plugin option or
`TYPESAFE_API_KEY`), the mod sends the **first prompt** of each new session, and of the first prompt
after `/clear`, to the TypeSafe JEV API at `https://api.typesafe.ai/v1/systemone`. Each request holds:

- the prompt text, verbatim,
- fixed instructions: a sentence saying the prompt came from Claude Code, the model-tier question
  (haiku, sonnet or opus, with a criterion for each), and a size question (five levels, from
  "No code change" to "Cross-cutting / many modules"),
- the model name, `jev-latest`.

Not sent: the working directory, file contents, transcript or session history, and any prompt after
the first. Mid-session prompts are not sent. The API key goes to the same endpoint as a bearer token.
The endpoint is fixed (the mod ignores `TYPESAFE_BASE_URL` and `JEV_MODEL`). The retention policy
belongs to TypeSafe; check their terms before you use it on private code.

**To turn it off:**

- Leave the key empty and don't set `TYPESAFE_API_KEY`. Nothing is sent, the model stays unchanged,
  and the session log says there is no key.
- Or set `JEV_MOCK=1`. A local keyword heuristic answers instead, with no network calls. It is used
  even when a key is set.

## Security scan

[NVIDIA Skillspector](https://github.com/nvidia/skillspector) v2.12.0 with the `claude_cli` LLM
provider (all LLM analyzer calls succeeded). The scan covered the shipped files only: the tracked
and non-ignored files under `plugins/jev-model-picker/`, exported to a clean folder. Scanning the
working folder directly also reads the gitignored `.claude-plugin/types/` declarations, which are
not shipped, so it is not used as the result.

| Result | Value |
|---|---|
| Risk score | 12/100 |
| Severity | LOW |
| Recommendation | CAUTION |
| Issues | 2 MEDIUM: `RP1` (`npx tsc` cited without a pinned version, in this README's Develop section) and `E1` (external transmission, the intended "Data and privacy" disclosure) |
| Coverage | 94.1%: 16 of 17 files fully inspected, 1 partial |
| Degraded analyzers | `bundled_execution_surface` |

**The scan is not complete.** The one partial file is `hooks/hooks.json`. The analyzer reports its
contents as opaque because it does not model the `modules` key that Claude Code uses to load the
hook module (`hooks/register.ts`). The file contains only that one key, and the scan reads it as
complete when it is scanned alone. The format is required by the plugin harness, so it stays as is.
The degraded analyzer is for the same file. Treat the result as a near-complete review, not a clean
bill of health.

The earlier scan's finding (`SQP-2`, the first prompt sent to a third-party API without disclosure)
is addressed by the "Data and privacy" section. The remaining `E1` finding flags that section's
description of the transmission, which is intended.
