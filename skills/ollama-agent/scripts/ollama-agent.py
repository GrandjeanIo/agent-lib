#!/usr/bin/env python3
"""CLI to delegate a prompt to a remote Ollama instance. Supports multi-turn conversations."""

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description="Send a prompt to remote Ollama")
parser.add_argument("--model", default="qwen3.6", help="Ollama model name")
parser.add_argument("--prompt", required=True, help="User prompt to append")
parser.add_argument("--system", default="", help="Optional system prompt")
parser.add_argument(
    "--host",
    default="",
    help="Ollama host (overrides OLLAMA_HOST env var, default: 192.0.0.1:11434)",
)
parser.add_argument(
    "--history",
    default="",
    help="JSON array of prior messages [{role, content}] for multi-turn conversations",
)
parser.add_argument(
    "--json-output",
    action="store_true",
    help="Output {reply, history} JSON — suppresses streaming tokens, for chaining turns",
)
parser.add_argument(
    "--stream",
    action="store_true",
    help="Stream tokens to stdout as they arrive (ignored when --json-output is set)",
)
parser.add_argument(
    "--timeout",
    type=int,
    default=660,
    help="Request timeout in seconds (default: 600 / 10 min)",
)
args = parser.parse_args()

host = args.host or os.environ.get("OLLAMA_HOST", "192.0.0.1:11434")
OLLAMA_URL = f"http://{host}/v1/chat/completions"

# --json-output suppresses streaming so sub-agents can parse clean JSON
stream = args.stream and not args.json_output

messages = []
if args.system:
    messages.append({"role": "system", "content": args.system})

if args.history:
    try:
        messages.extend(json.loads(args.history))
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid --history JSON: {e}", file=sys.stderr)
        sys.exit(1)

messages.append({"role": "user", "content": args.prompt})

body = json.dumps({"model": args.model, "messages": messages, "stream": stream}).encode()
req = Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})

try:
    with urlopen(req, timeout=args.timeout) as resp:
        if stream:
            reply_parts = []
            for raw_line in resp:
                line = raw_line.decode().strip()
                if not line.startswith("data:"):
                    continue
                payload = line[len("data:"):].strip()
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                    token = chunk["choices"][0]["delta"].get("content", "")
                    if token:
                        print(token, end="", flush=True)
                        reply_parts.append(token)
                except (json.JSONDecodeError, KeyError):
                    continue
            print()  # final newline
            reply = "".join(reply_parts)
        else:
            data = json.loads(resp.read())
            reply = data["choices"][0]["message"]["content"]

        if args.json_output:
            history_out = messages if messages[-1]["role"] == "assistant" else messages + [{"role": "assistant", "content": reply}]
            print(json.dumps({"reply": reply, "history": history_out}))
        elif not stream:
            print(reply)

except HTTPError as e:
    print(f"ERROR: Ollama HTTP {e.code}: {e.read().decode()}", file=sys.stderr)
    sys.exit(1)
except URLError as e:
    print(f"ERROR: Could not reach Ollama at {host} — {e.reason}", file=sys.stderr)
    sys.exit(1)
