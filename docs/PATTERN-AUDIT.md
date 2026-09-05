# PATTERN-AUDIT — dsh-crew (2026-09-06)

Audit against the six dsh-qa failure patterns (doc drift / boundary sanity / timing
assumptions / honesty of status / evidence integrity / coverage illusion).
Method: full source read (16 files in `src/`), baseline runs of the repo's own
verification, **and a live drive** — the plugin packed from this worktree was
installed into a private DSH profile (`sweep`, port 3095) and driven like a real
user: real hub dispatches through the loopback jobs API, a real grok CLI dispatch,
and targeted fault-injection probes (fake `agy` binary, fake `HOME`, decoy files).

## Baseline (before this audit)

| Command | Result |
|---|---|
| `npm run smoke:cwd` | pass (`smoke-cwd: all assertions passed`) |
| `npm run smoke:mcp` | pass (bundle rebuilt, stdio handshake, 6 tools listed) |
| `node scripts/verify-wpc9-guardrails.mjs` | pass (0 failures) |
| `node scripts/verify-wpc10-client.mjs` | pass |
| `node scripts/verify-wpc14-proc-endpoints.mjs` | pass |
| `node scripts/verify-cli-workers.mjs` | **environmental failure**: the real `agy` dispatch returns `status: ERROR` ("Agent execution terminated due to error"). Reproduced with a bare `agy --print` call outside the plugin — the agy service itself is erroring on this host today. The plugin propagated the failure honestly (`status=failed`, `error` set). **not verified: agy real-dispatch path on this host until the service recovers.** grok real dispatch verified separately (see P4). |
| `npm test` | **did not exist** — no `test` script at all (P6, fixed) |

Live instance: hub job `hub-1` (task: create `/tmp/sweep-drive/hello.txt`) ran
end-to-end in ~15 s via flash, correct file content, honest token/step view.

## P1 — documentation vs implementation drift

**1 confirmed (fixed).** `dsh_worker_config` accepts `origin_depth_limit`,
`preset_flash`, `preset_pro` — but the `/dsh-crew:config` command doc
(`commands/config.md`), its three siblings (`codex/prompts/dsh-config.md`,
`agy/skills/dsh-config/SKILL.md`, `grok/commands/dsh-config.md`) and the session
command tables in all 15 READMEs listed none of them. An agent that only reads
command docs does not know these knobs exist — dsh-qa defect-1 family
(description drift is a functional defect). Fixed in all 19 doc surfaces.

Checked and found accurate: tool descriptions vs schemas for all 6 MCP tools
(tier/effort enums, `timeout_seconds` bounds 1–7200, `worker=` opt-in semantics,
`allow_concurrent_cwd` read-only guidance); `wait_seconds` 0–7200 default 0;
README guardrail prose vs origin-guard/cwd-lock behavior; default timeout 1800 s;
hub URL default 3080; tier model ids.

## P2 — boundary and limit sanity

**1 confirmed (fixed).** Hub route `GET /jobs/:id?wait=<v>`:
`Number(v ?? 0)` → `?wait=abc` yields `NaN`, `Math.min(NaN,600)` is `NaN`,
`timeoutMs > 0` is false, the wait promise resolves instantly → **HTTP 200 with
an immediate return**. Measured live on a running job: `wait=abc` returns in
0.02 s with 200; `wait=5` waits 5.07 s. A caller asking to wait silently gets no
wait — exactly the "silently changes a conclusion at a boundary" pattern.
Fixed: `parseWaitSeconds()` (integer-or-400); verified live → now HTTP 400 with a
readable error.

Other boundaries reviewed and sound: `readBody` 64 KB cap errors loudly;
`timeout_seconds` zod-bounded; poll slicing at 60 s vs undici's 300 s header
timeout (documented with measurements); vision cache cap 200; `RAW_LINE_CAP`
300; `STDERR_TAIL_BYTES` 4096; `parsePid` rejects non-positive; origin depth
default 3 refused pre-spawn; shard staleness 30 min + writer-liveness-gated
deletion (never deletes on unknown liveness).

## P3 — timing and ordering assumptions

No confirmed defect. The codebase is unusually deliberate here: undici 300 s
header-timeout avoidance (measured 2026-08-19 failures at 14–41 m), hub probe
cache of 10 s, `dsh_worker_result(wait_seconds)` explicitly designed for
agent-thinks-30 s gaps, hub jobs survive MCP session death, and the settled-hub
lock re-check on acquire handles "settled without us hearing". The
defect-5 shape (approval outliving a TTL) has no analogue here: no observation
TTL exists to expire.

**not verified:** the 15 s human-approval window story does not apply; no TTL
found to test against.

## P4 — honesty of status

**1 confirmed (fixed).** `generate_image(provider=agy)`: the CLI saves images
under `~/.gemini/antigravity-cli/…` with sanitized names, so the adapter asked
for a nonce in the filename — but on nonce miss it fell back to "the freshest
image in the tree (≤8 min)" and reported `ok:true "image saved"`. Probe
(fake `agy` shim + fresh decoy image): the tool copied the decoy and returned
success. A file that does not verifiably answer the prompt was presented as the
generated image — dsh-qa defect-3/4 family (unverified evidence reported as
fact). Fixed: nonce match is now required; on miss the tool fails with a
readable error that names the nonce, the search root, and how many fresh
candidates were rejected. Tradeoff recorded: if agy sanitizes the nonce out of
every filename, generation now fails loudly instead of guessing — that is the
correct direction per the audit rules.

Verified honest elsewhere: `dsh_spawn_worker` doc says "claims, not results";
vision degradation reasons ride the provider string; transcription failure
inserts a visible `[transcription failed: …]` marker; CLI stream lines after a
timeout cannot overwrite the recorded timeout error; grok real dispatch returns
`done`/`end_turn` with the actual reply ("ok").

## P5 — evidence and report integrity

**1 confirmed (fixed, minor).** Every job view (`jobView`, hub `view`, status
shards) truncated `task` to 300 chars with **no marker** — in a status list a
truncated brief reads as the whole brief (observed live: other writers' tasks
ending mid-word, e.g. `"...Two deliverables.\n\n## D"`). Fixed: `clipTask()`
appends `…` only when truncating; verified live. Result/error fields are never
truncated (full evidence preserved).

Sound elsewhere: provenance (`provider`, cached/native-degradation) on every
vision answer; proc-kill verifies the command line before signalling and
refuses pid recycling; loopback-only routes with CORS/nosniff headers; no
credentials are printed (keys only read into request headers).

## P6 — coverage illusion

**1 confirmed (fixed).** "Would deleting the rule keep verification green?"
— until this audit the repo had **no `test` script at all**; the four
`verify-*.mjs` scripts were never wired into npm scripts or CI (`release.yml`
runs `build` + `smoke:mcp` + `smoke:pack` only). Three of them pass, one is
environment-blocked. Key unguarded invariants now pinned by
`tests/pattern-audit-regressions.test.mjs` + `npm test`: agy nonce guard, wait
param validation, truncation marker. Red/green proof below.

Still RECORD-ONLY (not wired, documented here): `verify-cli-workers.mjs` spends
real CLI quota and depends on external services — left manual on purpose.

## Fixes and red/green proof

`node --test tests/pattern-audit-regressions.test.mjs` **before** the fixes:

```
✖ generate_image(provider=agy) refuses when no nonce-matching image exists …
  AssertionError: Missing expected rejection: a nonce-less decoy must NOT be reported as a successful generation
✖ parseWaitSeconds rejects non-numeric / negative / NaN waits
  TypeError: parseWaitSeconds is not a function
✖ jobView marks a truncated task, hub view marks a truncated task
  AssertionError: task slice must end with an ellipsis marker when truncated
ℹ pass 0   ℹ fail 3
```

**after**:

```
✔ generate_image(provider=agy) refuses when no nonce-matching image exists (12.8ms)
✔ parseWaitSeconds rejects non-numeric / negative / NaN waits (1.5ms)
✔ jobView marks a truncated task, hub view marks a truncated task (1.0ms)
ℹ pass 3   ℹ fail 0
```

Post-fix full verification: `npm test` 3/3 pass, `smoke:cwd` pass,
`smoke:mcp` pass (bundle rebuilt from fixed sources). Live re-drive on a fresh
install of the fixed pack (profile `sweep`, port 3095): `?wait=abc` → HTTP 400;
long-task views carry the `…` marker; hub dispatch end-to-end still works.

## Would the pre-existing verification have caught these?

No — that is the point. All four defects were invisible to every wired check:
the bundle smoke only does initialize + tools/list; the WPC scripts exercise
guards that already existed; nothing anywhere read the config docs, the wait
query string, the task-preview shape, or the agy file-pick heuristic. Every one
of them surfaced only by driving the plugin against a real instance and
fault-injecting where reality diverges from the fixture.
