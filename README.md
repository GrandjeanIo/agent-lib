# agent-lib

A collection of agent tools - check the table for development status before implementing these.

## Contributing

PRs are welcome. Every PR must include a security scan result from [NVIDIA Skillspector](https://github.com/nvidia/skillspector). Paste the scan output (or a summary table like the one in `skills/ollama-agent/README.md`) into your skill's `README.md` before opening the PR. PRs without a scan will not be merged.

## Available skills

| Skill | Description | Status
|---|---|---|
| [ollama-agent](skills/ollama-agent/) | Delegate tasks to a local Ollama model | POC

## Plugins

| Plugin | Description | Status
|---|---|---|
| [jev-model-router](plugins/jev-model-router/) | Picks the session model (haiku/sonnet/opus) from the first prompt of a fresh context, using the JEV decision model | POC

**Privacy:** `jev-model-router` sends the first prompt of each new session to a third-party API (TypeSafe) by default when a TypeSafe key is configured. See [Data and privacy](plugins/jev-model-router/README.md#data-and-privacy).

## Installing

### Plugins via `/plugin`

Add this repo as a marketplace once, then install what you need:

```
/plugin marketplace add GrandjeanIo/agent-lib
/plugin install jev-model-router@agent-lib
/plugin install ollama-agent@agent-lib
```

### Skills

#### Manual installation

Copy the skill directory into `~/.claude/skills/`:

```bash
cp -r skills/<skill-name> ~/.claude/skills/
```

Claude Code picks up skills from `~/.claude/skills/` automatically — no restart required.

#### Via agr

[agr](https://github.com/computerlovetech/agr) is a package manager for Claude Code skills. Install a skill from this repo with:

```bash
agr install GrandjeanIo/agent-lib/<skill-name>
```

To list all available skills in a registry that includes this repo:

```bash
agr search
```

See the [agr documentation](https://github.com/computerlovetech/agr) for registry configuration and more options.
