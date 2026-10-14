#!/bin/sh
# Adds pipeline context to a session in a repo that has opted in
# with docs/agents/project.md. Prints nothing anywhere else.
[ -f "${CLAUDE_PROJECT_DIR:-.}/docs/agents/project.md" ] || exit 0
cat <<MSG
This repo uses the feature-factory agent pipeline. Its config is
docs/agents/project.md; read it first. The flow, the stages and a map of
every pipeline file are in ${CLAUDE_PLUGIN_ROOT}/docs/pipeline.md.
MSG
