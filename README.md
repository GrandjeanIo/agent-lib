# agent-lib

A collection of agent tools - check the table for development status before implementing these.

## Contributing

PRs are welcome. Every PR must include a security scan result from [NVIDIA Skillspector](https://github.com/nvidia/skillspector). Paste the scan output (or a summary table like the one in `plugins/jev-model-picker/README.md`) into your plugin's or skill's `README.md` before opening the PR. PRs without a scan will not be merged.

## Plugins

| Plugin | Description | Status
|---|---|---|
| [jev-model-picker](plugins/jev-model-picker/) | My name is Jev. I pick your model once, at session start and after /clear. No prompts, no mid-session switches, cache stays warm. | POC
| [feature-factory](plugins/feature-factory/) | Intent-to-PR agent pipeline: scope work into Linear tickets with a person, then build each intent test-first with parallel subagents, review and fix it, and open one PR per repo with a short review list. Requires mattpocock-skills. | POC

**Privacy:** `jev-model-picker` sends the first prompt of each new session to a third-party API (TypeSafe) by default when a TypeSafe key is configured. See [Data and privacy](plugins/jev-model-picker/README.md#data-and-privacy).

## Installing

### Plugins via `/plugin`

Add this repo as a marketplace once, then install what you need:

```
/plugin marketplace add GrandjeanIo/agent-lib
/plugin install jev-model-picker@agent-lib
/plugin install feature-factory@agent-lib
```
