#!/usr/bin/env bash
# WPC9 test double for the agy CLI: emits the stream-json events the
# cli-workers adapter parses (init / step_update / result). Behavior is
# controlled through env: FAKE_AGY_MODE / FAKE_AGY_MODE_FILE (NORMAL|HANG),
# FAKE_AGY_DELAY_MS / FAKE_AGY_DELAY_FILE (ms before the result event),
# FAKE_AGY_CAPTURE (if set, the inherited DSH_CREW_ORIGIN_CHAIN / _DEPTH are
# written next to it so tests can assert env propagation).
mode="${FAKE_AGY_MODE:-NORMAL}"
[ -n "${FAKE_AGY_MODE_FILE:-}" ] && mode="$(cat "$FAKE_AGY_MODE_FILE")"
delay_ms="${FAKE_AGY_DELAY_MS:-150}"
[ -n "${FAKE_AGY_DELAY_FILE:-}" ] && delay_ms="$(cat "$FAKE_AGY_DELAY_FILE")"
if [ -n "${FAKE_AGY_CAPTURE:-}" ]; then
  printf '%s' "${DSH_CREW_ORIGIN_CHAIN:-}" > "$FAKE_AGY_CAPTURE"
  printf '%s' "${DSH_CREW_DEPTH:-}" > "$FAKE_AGY_CAPTURE.depth"
fi
printf '%s\n' '{"event":"init","init":{"permission_mode":"acceptEdits","tools":[]}}'
sleep 0.05
printf '%s\n' '{"event":"step_update","step_update":{"step_index":0,"step_type":"agent_response","text_delta":"working","usage":{"input_tokens":12,"output_tokens":4}}}'
if [ "$mode" = "HANG" ]; then
  while :; do sleep 5; done
fi
sleep "$(awk -v ms="$delay_ms" 'BEGIN{printf "%.3f", ms/1000}')"
printf '%s\n' '{"event":"result","result":{"status":"SUCCESS","response":"ok"}}'
