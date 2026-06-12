---
name: ollama-agent
description: Delegate a task to the Ollama model running at 192.168.0.92. Use this when the user asks to use the local model, offload a lightweight task, or explicitly mentions Ollama.
---

# Ollama Sub-Agent

> **Always invoke this skill by spawning a sub-agent via the `Agent` tool.** Never run the script inline in the main conversation — sub-agent nesting keeps the conversation clean and lets the agent manage multi-turn exchanges independently.

## Invocation (inside the sub-agent)

```bash
python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --model <model> \
  --prompt "<prompt>" \
  [--host <host>] \
  [--system "<system prompt>"] \
  [--timeout <seconds>] \
  [--stream] \
  [--history '<json array>'] \
  [--history-file <path>] \
  [--json-output]
```

## Parameters

| Flag | Default | Description |
|---|---|---|
| `--model` | `qwen3.6` | Ollama model name (e.g. `llama3.2`, `mistral`, `codellama`) |
| `--prompt` | *(required)* | The message to send |
| `--host` | `OLLAMA_HOST` env → `192.168.0.92:11434` | Override the Ollama server host |
| `--system` | — | System prompt to set persona/behavior |
| `--timeout` | `660` | Seconds to wait (default 11 min — local LLM can be slow) |
| `--stream` | off | Print tokens to stdout as they arrive (ignored when `--json-output` is set) |
| `--history` | — | JSON array of prior `{role, content}` messages (inline, single-use) |
| `--history-file` | — | Path to JSON file — loads history if exists, saves updated history after every reply |
| `--json-output` | off | Emit `{"reply": "...", "history": [...]}` for chaining turns (suppresses `--stream`) |

**Host resolution order:** `--host` flag → `OLLAMA_HOST` env var → `192.168.0.92:11434`

---

## Examples

### Single-turn with streaming
```bash
python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --stream \
  --prompt "Explain event loops in JavaScript."
```

### Single-turn with system prompt
```bash
python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --system "You are a concise code reviewer. Reply with bullet points only." \
  --prompt "Review this function for obvious bugs: def add(a, b): return a - b"
```

### Multi-turn using a history file (recommended for persistent sessions)
```bash
# Turn 1 — file is created automatically
python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --history-file /tmp/my-session.json \
  --prompt "What is dependency injection?"

# Turn 2 — file is loaded; model remembers the prior exchange
python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --history-file /tmp/my-session.json \
  --prompt "Show me a simple Python example."
```

### Multi-turn using inline JSON (for single-agent chaining)
```bash
# Turn 1
TURN1=$(python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --json-output --prompt "What is dependency injection?")

HISTORY=$(echo "$TURN1" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['history']))")

# Turn 2 — pass history forward
python3 ~/.claude/skills/ollama-agent/scripts/ollama-agent.py \
  --history "$HISTORY" \
  --prompt "Show me a simple Python example."
```

---

## When to use

- User asks to "use the local model" or "ask Ollama"
- Lightweight classification, summarization, or drafting tasks
- Any task where speed or privacy matters more than maximum quality
- Follow-up questions where the model needs prior context — use `--history-file` for clean session management
