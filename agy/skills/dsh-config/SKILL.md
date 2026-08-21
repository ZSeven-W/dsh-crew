---
name: dsh-config
description: Show or set this session's DSH worker defaults (tier / effort / mode / timeout / on-off)
---

Parse the arguments given after this command into key=value pairs: `enabled=true|false`, `tier=flash|pro`, `effort=off|high|max`, `mode=auto|hub|standalone`, `timeout=<seconds>`, `policy=auto|flash-only|pro-only`, `escalate=true|false`, `reset`. Map them onto the `dsh_worker_config` tool arguments (tier→default_tier, effort→default_effort, timeout→default_timeout_seconds, policy→tier_policy, escalate→escalate_on_failure) and call it; with no arguments, call the tool with no arguments to read the current configuration. Then show the returned configuration (including `hub_reachable`) as one compact table and name the fields that changed. Reply in the language the user is writing in. Do nothing else.
