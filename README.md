<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>A <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> plugin: dispatch work to DSH agents from Claude Code / Codex, without giving up the host's native subagent UI.</strong><br />
  <sub>Native Progress UI &bull; Tier Policy &amp; Escalation &bull; In-Host DSH Sessions &bull; Vision &amp; Image Generation &bull; One-Click Install</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Current plugin release: <code>0.1.0-rc.3</code> &middot; Tested with DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md"><b>English</b></a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>The DSH Crew settings page — host integrations, dispatch policy, execution and the multimodal bridge</sub></p>

## Why DSH Crew

DSH Crew is a plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — an open-source agent harness. It makes DSH agents dispatchable from Claude Code and Codex: the orchestrator keeps its own model, the work runs on a real DSH agent with that harness's tools, sandbox, presets and session history, and the host still shows it as a native subagent with live progress.

What runs the work is a DSH agent, not a bare model call. Tiers (`flash` / `pro`) select how much capability that agent gets from the harness's configured roster — DeepSeek V4 Flash and V4 Pro today — so a change of model in DSH needs no change here.

<table>
<tr>
<td width="50%">

### 🧵 Native Progress UI

Workers appear as regular subagents in Claude Code / Codex — dispatch count, running step, tool calls and token usage all show up in the host's own task panel, plus a claude-hud statusline segment: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Tier Policy and Escalation

`flash` for mechanical work, `pro` for reasoning, `effort` from `off` to `max`. `tier_policy` can clamp every dispatch to one tier at the tool layer, and `escalate_on_failure` retries a failed flash run once on pro — based on evidence, not on guessing difficulty up front.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ In-Host DSH Sessions

With the bundle installed in a DSH profile, each worker is a first-class DSH session: visible in the Web UI, grouped by working directory, mounted with the Agent preset you choose per tier. Without DSH running, dispatch falls back to a standalone DSH runtime, so CI and headless environments still work.

</td>
<td width="50%">

### 👁️ Vision and Image Generation

DSH's models are text-only. `describe_image` and `generate_image` borrow the eyes and brush of the CLIs you already have — Claude, Codex, Grok, Antigravity — or of any OpenAI-compatible API you configure. Pasted images stay visible in the conversation and reach the model as text.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Custom Providers

Bring your own endpoint (Base URL + API key + models) or a local command template. Each provider has a connectivity test that checks reachability and auth, then makes one real vision call so you find out now, not mid-task.

</td>
<td width="50%">

### 📦 One-Click Install

The settings page installs and updates the Claude Code plugin and the Codex role files for you — marketplace registration, permission allowlist, HUD wiring, absolute paths rendered for this machine — and restores them just as easily. Every settings file is backed up first.

</td>
</tr>
</table>

## How it works

```
Claude Code / Codex (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## One run, two views

Dispatch fans out. Below, eighteen workers translate this README in parallel: the host counts them as its own subagents, while the harness runs them as real sessions.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code sees dsh-crew workers as native subagents, with a statusline segment tracking running tiers, elapsed time and tokens.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>The DSH Crew panel sees the same run from the harness side: which host dispatched each job, its tier and effort, live progress and token usage.</sub></p>

## Install

Install into a DSH profile from npm:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Or, for local development straight from the source tree:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

The `link:` protocol symlinks the profile dependency to this repository, so rebuilds are visible immediately.

### Configure DeepSeek credentials (standalone only)

In hub mode — the installation above — workers run inside the DSH instance and use the DeepSeek credentials it is already configured with. Nothing else to set up.

Only the standalone fallback needs a key of its own: dispatching from Claude Code / Codex with no DSH instance running launches a worker runtime as a separate process. Obtain an API key from [platform.deepseek.com](https://platform.deepseek.com) and write it to `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### Verify

```bash
node scripts/smoke.mjs
```

The smoke test dispatches one cheap job through whichever path is available — the hub when a DSH instance is running, standalone otherwise — and prints which one it used. Within about ten seconds you should see `smoke test passed — configuration OK`. On failure the reason is printed, scoped to the path that was tested.

Then open Settings → DSH Crew and install the Claude Code / Codex integrations with one click.

## Background and terminology

- **DSH** (DeepSeek Harness): DeepSeek's open-source agent harness, a code agent in Web UI form, similar to Claude Code but driving DeepSeek models.
- **MCP** (Model Context Protocol): Anthropic's AI tool integration protocol, enables LLMs to safely call external tools and data sources.
- **Cordis bundle**: DSH's plugin format; this project can run standalone as an MCP service or install into DSH Web as hub mode.
- **tier**: capability tier — which slot of DSH's configured model roster a worker gets. `flash` is fast and cheap (simple tasks), `pro` reasons harder (complex problems). Today they map to DeepSeek V4 Flash and V4 Pro; swap models in DSH and nothing changes here.
- **worker**: the DSH agent doing the work — a full session with its own tools, sandbox and preset, not a bare model call.
- **effort**: reasoning strength, `off` = no reasoning, `high` = high reasoning investment, `max` = maximum reasoning investment.

## Claude Code

### Installation

One-click installation (choose one):

- **DSH settings page** (when hub mode is installed): Settings → DSH Crew → "Install to Claude Code"
- **Command line**: `node src/install/cli.mjs all`

Both do the same thing: register local marketplace (parent directory `dsh-plugins/` as marketplace root) + `claude plugin install` + MCP tool permission allowlist + claude-hud worker status segment config (auto-backup settings.json before changes, idempotent). **Restart the session after installation for changes to take effect.**

### Usage

- Directly in conversation, say "dispatch X to ds-flash" or "dispatch X to ds-pro", and subagent executes the task
- Dispatch count and real-time progress shown in Claude Code task UI
- **HUD status line segment**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (current tier / elapsed time / token usage / completion count)
  - For local development, `statusline/statusline.sh` or `statusline/worker-segment.sh` can be independently integrated
- **Long-running tasks**: CC has timeout limits on MCP calls (`MCP_TOOL_TIMEOUT` adjustable), long tasks can have orchestrator use `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` polling
- **Local development and debugging**: `claude --plugin-dir /path/to/dsh-crew` to temporarily load


### Session commands

These override the global defaults for the current session only, and are enforced at the tool layer rather than by prompting:

| Command | What it does |
|---|---|
| `/dsh-crew:config` | Show or set this session's defaults: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<seconds>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Turn dispatch for this session on or off (off is a hard switch: the tool refuses) |
| `/dsh-crew:status` | Live status of worker jobs: tier, progress, tokens, current tool |

## Codex

### Installation

Recommended to use the installer (auto-renders paths for this machine, copies `/dsh-config`, `/dsh-status` commands):

```bash
node src/install/cli.mjs codex
```

Or manually copy (requires manual path modification after copying):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

Role files come pre-configured with:

- MCP server mounting configuration
- `default_tools_approval_mode = "approve"` (**required**, otherwise tool calls are auto-cancelled in exec mode)
- `tool_timeout_sec = 3600`

**Note**: When manually copying, absolute paths in the `args` field must be updated to match actual installation location; the installer handles this automatically.

### Usage

- In interactive TUI, select "spawn ds-pro to ..." to dispatch tasks; Active/Done panels show progress
- `codex exec` mode can also directly call `dsh_run_worker`


### Session commands

The same two prompts are installed for Codex:

| Command | What it does |
|---|---|
| `/dsh-config` | Show or set this session's defaults: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<seconds>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Live status of worker jobs: tier, progress, tokens, current tool |

## MCP tools

| Tool | Description |
|---|---|
| `dsh_run_worker` | Synchronous task dispatch (`tier`: flash/pro, `effort`: off/high/max, `cwd`), waits for result |
| `dsh_spawn_worker` | Asynchronous task dispatch, returns job id (for parallel fan-out) |
| `dsh_worker_status` | Query real-time progress of all jobs (turn/step/current tool/token) |
| `dsh_worker_result` | Fetch result, can specify `wait_seconds` to wait |
| `dsh_worker_cancel` | Cancel specified job, terminate its runtime process |

Progress is simultaneously mirrored to `~/.config/dsh-crew/status.d/` (one shard file per writer, can be read by statusline / external monitoring).

## Multimodal: vision and image generation

**DeepSeek is a text-only model** and does not support image input or generation. This plugin sources these capabilities externally through MCP tools:

| Tool | Description |
|---|---|
| `describe_image` | Answer questions by viewing images (screenshots, designs, charts, etc.), results cached by provider + model + image + question |
| `generate_image` | Generate image from text description, save to specified absolute path; output is flat bitmap (requires OpenPencil for layer editing) |

**Session image pasting**: In DSH, switch model to `DeepSeek (vision) ◉` to directly paste images. Images remain in session and display normally; the plugin appends transcribed text after them and strips images before sending—you see the image, the model reads the text.

### Configuration

In **DSH settings page → DSH Crew → Multimodal** (or directly edit `~/.config/dsh-crew/config.json`):

**Vision provider** (image viewing):

- `claude-code` (default, uses haiku, inexpensive)
- `codex` (uses GPT, can specify specific model)
- `grok` (uses Grok)
- `agy` (Antigravity)
- `custom` (OpenAI-compatible API or local command)
- `off` (disabled)

**Image generation provider** (image generation):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI-compatible API or local command)
- `off` (disabled)

### Custom provider

Two integration methods:

**API**: Any OpenAI-compatible endpoint
- Fill Base URL, API Key, model list
- Vision uses `/chat/completions` with inline base64 images
- Image generation uses `/images/generations`
- **Must specify "image generation model" to have generation capability**, otherwise provider only appears in vision selection

**CLI**: Local command template, placeholders substituted with safe references
- Vision: `{image} {question} {model}` → stdout as answer
- Image generation: `{prompt} {output} {size}` → command must write file to `{output}`
- Fill at least one command; whichever is filled determines capability

**Connectivity test**: Each custom provider has a test button
- API: Check endpoint reachability, auth, send real vision request to verify
- CLI: Check executable file, run real command to verify
- Image generation: Validate config only, no actual image output

**Borrowed subscription CLIs** (claude / codex / grok / agy) require you to be logged in locally; the plugin won't bypass their permissions for you.

## Hub mode

This package is also a valid DSH bundle (`dsh.bundle` + `cordis.patch.yml`). After installing into DSH Web profile with `dsh plugin add dsh-crew`:

- **Worker sessions become first-class citizens**: run as first-class sessions in DSH host (`agents.create` + per-session model/effort waterfall + default preset), appear in Web UI session list, can be opened anytime to view complete execution
- **Organize by working directory**: manage worker sessions by cwd in Web UI
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: spawn tasks, list, long-poll results, cancel
  - `GET /_dsh/dsh-crew/ping`: health check (MCP shim uses this to detect if hub is running)
  - `POST /_dsh/dsh-crew/install`: one-click install Claude Code / Codex integration (backend of `src/install/`)
- **Auto-detection**: CC/Codex's MCP shim auto-detects hub (`DSH_CREW_HUB` env var, default `http://127.0.0.1:3080`)
  - DSH Web running → jobs enter hub mode (`mode: "hub"`)
  - Not running → fall back to standalone runtime

## Solution selection and limitations

### Regular subscribers → shell subagent approach (recommended)

- **Current state**: Claude Code subagent shell uses haiku as intermediary; each dispatch adds hundreds to thousands of tokens
- **Trade-off**: Use small amount of Anthropic token in exchange for native task UI, real-time progress display, no extra configuration
- **Recommendation**: If you already subscribe to Claude Pro or use Claude Code, use this approach—convenient and transparent

### Pay-as-you-go / CI environments → direct router approach

- **Current state**: Claude Code subagent frontmatter doesn't support direct third-party model connection; this repo's router experiment in scratchpad requires API-key credentials for Claude Code, but subscription OAuth is blocked upstream by Anthropic with 403
- **Recommendation**:
  - If using API-key credentials (not OAuth) and want to save Anthropic tokens, can run local router for direct DeepSeek connection
  - CI environments typically also use API keys; this approach is more economical (all DeepSeek tokens)
  - Requires self-testing of router integration (not officially supported)

### Running DSH Web → hub mode auto-enabled

- **Current state**: If `dsh plugin add dsh-crew` installed into DSH Web profile, jobs run as first-class sessions in host, appear in Web UI session list
- **Recommendation**: During local development iteration, recommend enabling hub mode; worker progress can be fully observed in Web UI; for cross-machine collaboration or environments without Web UI, use Claude Code / Codex shell approach

### Known items

- Codex role can theoretically try `model_provider` pointing directly to DeepSeek (unverified); this bridge doesn't depend on it
- Image generation output is flat bitmap; layer editing requires OpenPencil
- **Runtime dependencies**: Only `@modelcontextprotocol/sdk` and `zod`; `@deepseek-ai/*` are host runtime, provided by the DSH host (a plain npm install never pulls them)
- **Codex must configure**: `default_tools_approval_mode = "approve"`, otherwise tool calls are auto-cancelled

## Develop

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Runtime dependencies are only `@modelcontextprotocol/sdk` and `zod`; every `@deepseek-ai/*` package is host runtime provided by the DSH host (documented in the package's dshHostRuntime field, not in peerDependencies, so a plain npm install never pulls them), which keeps the plugin inside the host's single module realm.

## Ecosystem

- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — a live iOS Simulator and a USB-connected iPhone, inside the conversation
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — long-term memory for DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspect and edit `.op` design documents inside a conversation

## License

MIT
