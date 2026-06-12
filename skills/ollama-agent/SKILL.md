---
name: ollama-agent
description: Delegate a task to the Ollama model running on the local network. Use this when the user asks to use the local model, offload a lightweight task, or explicitly mentions Ollama.
permissions:
  - network:outbound        # HTTP requests to the Ollama server (required if the Ollama instance is running on another machine)
  - env                     # reads OLLAMA_HOST to locate the server
---

# Ollama Sub-Agent

> **Always invoke this skill by spawning a sub-agent via the `Agent` tool.** Never run the script inline in the main conversation — sub-agent nesting keeps the conversation clean and lets the agent manage multi-turn exchanges independently.

## Invocation (inside the sub-agent)

**Locating the script:** This skill's script is always at `scripts/ollama-agent.py` relative to this `SKILL.md` file. When loading this skill, take the path you read this file from, strip the filename, and use that directory as `<skill-root>`. Pass the resolved absolute path to the sub-agent so it doesn't need to search.

```bash
python3 <skill-root>/scripts/ollama-agent.py \
  --model <model> \
  --prompt "<prompt>" \
  [--host <host>] \
  [--system "<system prompt>"] \
  [--timeout <seconds>] \
  [--stream] \
  [--history '<json array>'] \
  [--json-output]
```

## Parameters

| Flag | Default | Description |
|---|---|---|
| `--model` | `qwen3.6` | Ollama model name (e.g. `llama3.2`, `mistral`, `codellama`) |
| `--prompt` | *(required)* | The message to send |
| `--host` | `OLLAMA_HOST` env → `192.0.0.1:11434` | Override the Ollama server host |
| `--system` | — | System prompt to set persona/behavior |
| `--timeout` | `600` | Seconds to wait (default 10 min — local LLM can be slow) |
| `--stream` | off | Print tokens to stdout as they arrive (ignored when `--json-output` is set) |
| `--history` | — | JSON array of prior `{role, content}` messages (inline) |
| `--json-output` | off | Emit `{"reply": "...", "history": [...]}` for chaining turns (suppresses `--stream`) |

**Host resolution order:** `--host` flag → `OLLAMA_HOST` env var → `192.0.0.1:11434`

---

## Examples

### Single-turn with streaming
```bash
python3 <skill-root>/scripts/ollama-agent.py \
  --stream \
  --prompt "Explain event loops in JavaScript."
```

### Single-turn with system prompt
```bash
python3 <skill-root>/scripts/ollama-agent.py \
  --system "You are a concise code reviewer. Reply with bullet points only." \
  --prompt "Review this function for obvious bugs: def add(a, b): return a - b"
```

### Multi-turn using inline JSON
```bash
# Turn 1
TURN1=$(python3 <skill-root>/scripts/ollama-agent.py \
  --json-output --prompt "What is dependency injection?")

HISTORY=$(echo "$TURN1" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)['history']))")

# Turn 2 — pass history forward
python3 <skill-root>/scripts/ollama-agent.py \
  --history "$HISTORY" \
  --prompt "Show me a simple Python example."
```

---

## When to use

- User asks to "use the local model" or "ask Ollama"
- Lightweight classification, summarization, or drafting tasks
- Any task where speed or privacy matters more than maximum quality
- Follow-up questions where the model needs prior context — use `--history-file` for clean session management
