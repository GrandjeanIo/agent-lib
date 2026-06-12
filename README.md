# agent-lib

A collection of agent tools - check the table for development status before implementing these.

## Contributing

PRs are welcome. Every PR must include a security scan result from [NVIDIA Skillspector](https://github.com/nvidia/skillspector). Paste the scan output (or a summary table like the one in `skills/ollama-agent/README.md`) into your skill's `README.md` before opening the PR. PRs without a scan will not be merged.

## Available skills

| Skill | Description | Status
|---|---|---|
| [ollama-agent](skills/ollama-agent/) | Delegate tasks to a local Ollama model | POC

## Installing skills

### Manual installation

Copy the skill directory into `~/.claude/skills/`:

```bash
cp -r skills/<skill-name> ~/.claude/skills/<skill-name>
```

Claude Code picks up skills from `~/.claude/skills/` automatically — no restart required.

### Via agr

[agr](https://github.com/computerlovetech/agr) is a package manager for Claude Code skills. Install a skill from this repo with:

```bash
agr install <skill-name>
```

To list all available skills in a registry that includes this repo:

```bash
agr search
```

See the [agr documentation](https://github.com/computerlovetech/agr) for registry configuration and more options.
