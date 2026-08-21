---
description: Show or set this session's DSH worker defaults (tier / effort / mode / timeout / on-off)
---

User input: $ARGUMENTS

Parse the input into key=value pairs. Accepted keys: `enabled=true|false`, `tier=flash|pro`, `effort=off|high|max`, `mode=auto|hub|standalone`, `timeout=<seconds>`, `policy=auto|flash-only|pro-only`, `escalate=true|false`, `reset`. Map them onto the `dsh-crew__dsh_worker_config` tool arguments (tier→default_tier, effort→default_effort, timeout→default_timeout_seconds, policy→tier_policy, escalate→escalate_on_failure) and call it. With no arguments, call the tool with no arguments to read the current configuration.

Then show the returned configuration (including `hub_reachable`) as one compact table, and name the fields that changed if anything did. Reply in the language the user is writing in. Do nothing else.
