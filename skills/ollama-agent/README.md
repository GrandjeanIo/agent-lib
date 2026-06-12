# ollama-agent

Delegates prompts to an [Ollama](https://ollama.com) instance running on the local network.

## Setup

1. (Skip if the model is already running) Install Ollama and pull a model — see the [official quickstart](https://ollama.com/download).
2. After installing the skill, make the script executable:
   ```bash
   chmod +x <skill-root>/scripts/ollama-agent.py
   ```
3. Set `OLLAMA_HOST` to your server's address if it's not running on the default `192.0.0.1:11434` or if it's running on a different machine:
   ```bash
   export OLLAMA_HOST=192.168.1.10:11434
   # Add to zshrc
   echo 
   ```
4. Confirm the server is reachable: `curl http://$OLLAMA_HOST/api/tags`

--- Useful for offloading lightweight tasks (summarization, classification, drafting) to a local model when speed, privacy, or cost matters more than maximum quality. Supports single-turn and multi-turn conversations via inline history (`--history` / `--json-output`).

The skill always runs as a sub-agent (spawned via the `Agent` tool) so it keeps the main conversation clean.
