# ollama-agent

Delegates prompts to an [Ollama](https://ollama.com) instance running on the local network. Useful for offloading lightweight tasks (summarization, classification, drafting) to a local model when speed, privacy, or cost matters more than maximum quality. Supports single-turn and multi-turn conversations via inline history or a history file.

The skill always runs as a sub-agent (spawned via the `Agent` tool) so it keeps the main conversation clean.

---

## Security scan results (skillspector 2.1.3)

Last scanned: 2026-06-12. Score: 58 / HIGH.

| ID | Severity | Status | Notes |
|---|---|---|---|
| LP4 | LOW | Cannot fix — false positive | Scanner does not recognise Python `open()` as a `filesystem:read` capability. The permission is correct and used at `ollama-agent.py:62–66`. Removing it would make the declaration less accurate, not more. |
| RA2 | MEDIUM | Cannot fix — false positive | Scanner pattern-matches the word "persist" in comments as a "Session Persistence" rogue-agent signal. The `--history-file` flag is an explicit user opt-in; no autonomous persistence occurs. The only actionable remediation would be removing a legitimate feature or sanitising comment wording to fool the pattern — neither is appropriate. |

### Why the remaining findings cannot be fixed

**LP4 — `filesystem:read`:** skillspector detects write operations via `open(..., "w")` but does not detect reads via plain `open(file)`. The code at line 62 opens the history file for reading when `--history-file` is passed. Removing the `filesystem:read` declaration would be incorrect; the fix belongs in the scanner's Python capability-detection rules.

**RA2 — Session Persistence:** The scanner triggers on any skill that writes files across invocations, regardless of whether that behaviour is user-initiated. Here it is always opt-in: the history file is only written when the caller explicitly passes `--history-file`. Suppressing the finding would require either removing the multi-turn feature or rewording comments to avoid trigger keywords — both are superficial workarounds. The correct resolution is a scanner allowlist for user-gated persistence patterns.
