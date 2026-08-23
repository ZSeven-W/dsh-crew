<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong><a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> plugin: Claude Code / Codex / Antigravity / Grok에서 DSH agent로 작업을 dispatch하며, 호스트의 native subagent UI는 그대로 유지합니다.</strong><br />
  <sub>네이티브 진행 UI &bull; Tier 정책 &amp; 에스컬레이션 &bull; 디스패치 가드레일 &bull; 작업 보드 &bull; 호스트 내 DSH 세션 &bull; 비전 &amp; 이미지 생성(네이티브 우선) &bull; 원클릭 설치</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; 현재 plugin 릴리스: <code>0.1.0-rc.4</code> &middot; DSH <code>0.1.1-rc.1</code>에서 테스트됨</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md"><b>한국어</b></a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — 설정 페이지" width="100%" />
</p>
<p align="center"><sub>DSH Crew 설정 페이지 — 호스트 통합, 디스패치 정책, 실행 및 멀티모달 브리지</sub></p>

## DSH Crew를 사용하는 이유

DSH Crew는 오픈소스 agent harness인 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH)의 plugin입니다. Claude Code, Codex, Antigravity, Grok에서 DSH agent를 dispatch할 수 있게 해 줍니다. orchestrator는 자신의 model을 유지하고, 작업은 해당 harness의 tools, sandbox, presets, session history를 갖춘 실제 DSH agent에서 실행되며, 호스트에는 live progress가 표시되는 native subagent로 계속 나타납니다.

작업을 실제로 실행하는 것은 DSH agent이지, 단순한 model 호출이 아닙니다. tier(`flash` / `pro`)는 해당 agent가 harness에 설정된 model roster에서 얼마나 많은 capability를 받을지 결정합니다 — 현재는 DeepSeek V4 Flash와 V4 Pro — 따라서 DSH에서 model을 바꿔도 여기서는 변경할 필요가 없습니다.

<table>
<tr>
<td width="50%">

### 🧵 네이티브 진행 UI

worker는 Claude Code / Codex / Antigravity / Grok에서 일반 subagent로 표시됩니다. dispatch 수, 실행 중인 step, tool 호출, token 사용량이 모두 호스트 자체 task panel에 표시되며, claude-hud statusline segment도 포함됩니다: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Tier 정책 및 에스컬레이션

기계적인 작업에는 `flash`, 추론이 필요한 작업에는 `pro`, `effort`는 `off`부터 `max`까지 사용합니다. `tier_policy`는 tool 계층에서 모든 dispatch를 단일 tier로 고정할 수 있고, `escalate_on_failure`는 실패한 flash 실행을 pro에서 한 번 재시도합니다 — 사전에 난이도를 추측하는 것이 아니라 실제 증거에 기반합니다.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ 호스트 내 DSH 세션

bundle을 DSH profile에 설치하면 각 worker는 first-class DSH session이 됩니다. Web UI에 표시되고, 작업 디렉터리별로 그룹화되며, tier별로 선택한 Agent preset으로 마운트됩니다. DSH가 실행 중이 아니면 standalone DSH runtime으로 폴백하므로 CI 및 headless 환경에서도 작동합니다.

</td>
<td width="50%">

### 👁️ 비전 및 이미지 생성

DSH의 model은 text-only입니다. `describe_image`는 이제 키가 있을 때마다 DeepSeek 자체 VL model(`deepseek-v4-flash-vision-exp`)을 먼저 시도하고, 그다음 이미 보유한 CLI — Claude, Codex, Grok, Antigravity — 또는 설정한 OpenAI 호환 API로 폴백합니다. `generate_image`는 같은 CLI의 붓을 빌려 사용합니다. 붙여넣은 image는 대화에 계속 표시되고 model에는 text로 전달됩니다.

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ 디스패치 가드레일

모든 dispatch는 무엇이든 실행되기 전에 검사됩니다. worker→worker 중첩은 origin-chain 깊이 3으로 제한되고 순환은 거부됩니다. 다른 job이 이미 보유한 workspace에 대한 두 번째 worker는 보유자 정보와 함께 거부됩니다 — 조용히 대기열에 넣지 않습니다. 거부는 읽을 수 있는 오류입니다: 기다리거나 범위를 다시 잡으세요. 우회하지 마세요.

</td>
<td width="50%">

### 📋 작업 보드

DSH Crew 패널은 작업 보드 역할도 합니다: 실행 중이든 완료됐든 모든 worker job이 tier, effort, 실시간 진행 상황, 토큰과 함께 나열되고, 점유된 workspace는 보유자를 표시하며, 실행 도중 사라진 job(예: hub 재시작)은 조용히 사라지는 대신 orphan ghost로 표시됩니다.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 사용자 지정 provider

자체 endpoint(Base URL + API key + models)나 로컬 command template을 가져올 수 있습니다. 각 provider에는 connectivity test가 있어 reachability와 auth를 확인한 후 실제 vision 호출을 한 번 수행하므로, 작업 도중이 아니라 지금 문제를 발견할 수 있습니다.

</td>
<td width="50%">

### 📦 원클릭 설치

설정 페이지에서 Claude Code plugin, Codex role 파일, Antigravity / Grok agent, 스킬, 명령을 설치하고 업데이트할 수 있습니다 — marketplace 등록, permission allowlist, HUD wiring, 이 머신에 맞게 생성된 absolute path — 그리고 복원도 쉽게 할 수 있습니다. 모든 설정 파일은 먼저 백업됩니다.

</td>
</tr>
</table>

## 작동 방식

```
Claude Code / Codex / Antigravity / Grok (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → that external CLI runs the task (explicit opt-in)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## 한 번의 실행, 두 개의 관점

디스패치는 넓게 펼칠 수 있습니다. 아래에서는 18개의 worker가 이 README를 병렬로 번역합니다. 호스트는 이들을 자신의 서브에이전트로 세고, harness는 실제 세션으로 실행합니다.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code에서 dsh-crew worker는 네이티브 서브에이전트로 보입니다. statusline 세그먼트가 실행 중인 tier, 경과 시간, 토큰을 표시합니다.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>DSH Crew 패널에서 본 같은 실행: 각 작업을 디스패치한 호스트, tier와 effort, 실시간 진행 상황과 토큰 사용량.</sub></p>

<p align="center"><sub>패널은 작업 보드이기도 합니다: 실행 중이거나 완료된 job이 tier, 진행 상황, 토큰과 함께 계속 나열되고, 점유된 workspace는 보유자를 표시하며, 실행 도중 사라진 job(hub 재시작)은 조용히 사라지는 대신 orphan ghost로 표시됩니다.</sub></p>

## 설치

npm에서 DSH 프로필로 설치:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

소스 트리에서 로컬 개발하려면:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

`link:` 프로토콜은 프로필 의존성을 이 저장소로 심볼릭 링크하므로 다시 빌드하면 바로 반영됩니다.

### DeepSeek 자격 증명 설정(standalone 전용)

hub mode에서 — 위 설치 방식에서 — worker는 DSH instance 내부에서 실행되고 이미 설정된 DSH의 DeepSeek 자격 증명을 사용합니다. 추가 설정이 필요하지 않습니다.

standalone 폴백만 자체 키가 필요합니다. DSH instance가 실행 중이 아닌 호스트에서 dispatch하면 worker runtime이 별도 프로세스로 시작됩니다. [platform.deepseek.com](https://platform.deepseek.com)에서 API 키를 받아 `~/.config/dsh-crew/.env`에 씁니다:

```
DEEPSEEK_API_KEY=sk-...
```

### 확인

```bash
node scripts/smoke.mjs
```

smoke 테스트는 사용 가능한 경로를 통해 저렴한 job을 dispatch합니다 — DSH instance가 실행 중이면 hub, 그렇지 않으면 standalone — 그리고 사용한 경로를 출력합니다. 약 십 초 안에 `smoke test passed — configuration OK`가 표시되어야 합니다. 실패하면 테스트된 경로에 한정된 오류 이유가 출력됩니다.

그다음 설정 → DSH Crew에서 호스트 통합(Claude Code, Codex, Antigravity, Grok)을 한 번에 설치하거나, 명령줄에서 같은 installer를 실행합니다:

```bash
node src/install/cli.mjs claude   # Claude Code plugin: marketplace + permissions + HUD segment
node src/install/cli.mjs codex    # Codex agents + prompts
node src/install/cli.mjs agy      # Antigravity MCP config + agents + skills
node src/install/cli.mjs grok     # Grok MCP config + agents + commands
node src/install/cli.mjs all      # all four hosts at once
# uninstall symmetrically (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

## 배경 및 용어

- **DSH** (DeepSeek Harness): DeepSeek의 오픈소스 agent harness로, Web UI 형태의 code agent이며 Claude Code와 비슷하지만 DeepSeek model을 구동합니다.
- **MCP** (Model Context Protocol): Anthropic의 AI tool 통합 프로토콜로, LLM이 외부 tool과 data source를 안전하게 호출할 수 있게 합니다.
- **Cordis bundle**: DSH의 plugin 형식입니다. 이 프로젝트는 standalone MCP service로 실행하거나 hub mode로 DSH Web에 설치할 수 있습니다.
- **tier**: capability tier — worker가 DSH에 구성된 model roster 중 어떤 slot을 받는지를 나타냅니다. `flash`는 빠르고 저렴하며(단순 작업), `pro`는 더 깊이 추론합니다(복잡한 문제). 현재는 각각 DeepSeek V4 Flash와 V4 Pro에 매핑됩니다. DSH에서 model을 교체해도 여기서는 변경할 것이 없습니다.
- **worker**: 작업을 수행하는 DSH agent — 자체 tools, sandbox, preset을 가진 전체 session이며, 단순한 model 호출이 아닙니다.
- **effort**: 추론 강도. `off` = 추론 없음, `high` = 높은 추론 투자, `max` = 최대 추론 투자.

## Claude Code

### 설치

원클릭 설치(하나를 선택하세요):

- **DSH 설정 페이지**(hub mode 설치 시): 설정 → DSH Crew → "Install to Claude Code"
- **명령줄**: `node src/install/cli.mjs all`

둘 다 동일한 작업을 수행합니다: 로컬 marketplace 등록(상위 디렉터리 `dsh-plugins/`를 marketplace root로 사용) + `claude plugin install` + MCP tool permission allowlist + claude-hud worker status segment 설정(변경 전 settings.json 자동 백업, 멱등). **변경 사항을 적용하려면 설치 후 세션을 다시 시작하세요.**

### 사용법

- 대화에서 직접 "dispatch X to ds-flash" 또는 "dispatch X to ds-pro"라고 말하면 subagent가 작업을 실행합니다
- dispatch 수와 실시간 progress가 Claude Code task UI에 표시됩니다
- **HUD status line segment**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (현재 tier / 경과 시간 / token 사용량 / 완료 수)
  - 로컬 개발에서는 `statusline/statusline.sh` 또는 `statusline/worker-segment.sh`를 독립적으로 통합할 수 있습니다
- **장기 실행 작업**: CC에는 MCP 호출에 대한 timeout 제한이 있습니다(`MCP_TOOL_TIMEOUT`으로 조정 가능). 긴 작업은 orchestrator가 `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` polling을 사용할 수 있습니다
- **로컬 개발 및 디버깅**: `claude --plugin-dir /path/to/dsh-crew`로 임시 로드할 수 있습니다


### 세션 명령

현재 세션에만 전역 기본값을 덮어쓰며, 프롬프트가 아니라 도구 계층에서 강제됩니다:

| 명령 | 동작 |
|---|---|
| `/dsh-crew:config` | 이 세션의 기본값 조회·설정: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<초>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | 이 세션의 디스패치 켜기·끄기 (끄기는 하드 스위치로 도구가 거부) |
| `/dsh-crew:status` | worker 작업 실시간 상태: tier, 진행, 토큰, 현재 도구 |
| `/dsh-crew:playbook` | 디스패치 모범 사례: flash vs pro 선택, 자기 완결적인 브리프, 병렬 처리, 결과 검증, 가드레일 |

## Codex

### 설치

installer 사용을 권장합니다(이 머신에 맞게 path를 자동 생성하고 `/dsh-config`, `/dsh-status`, `/dsh-playbook` 프롬프트를 복사합니다):

```bash
node src/install/cli.mjs codex
```

또는 수동으로 복사(복사 후 path 수동 수정 필요):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

role 파일에는 다음이 기본 구성되어 있습니다:

- MCP server 마운트 구성
- `default_tools_approval_mode = "approve"` (**필수**, 그렇지 않으면 exec mode에서 tool 호출이 자동 취소됩니다)
- `tool_timeout_sec = 3600`

**참고**: 수동 복사 시 `args` 필드의 absolute path를 실제 설치 위치에 맞게 업데이트해야 합니다. installer는 이를 자동으로 처리합니다.

### 사용법

- 대화형 TUI에서 "spawn ds-pro to ..."를 선택하여 작업을 dispatch합니다. Active/Done panel에 progress가 표시됩니다
- `codex exec` mode에서도 `dsh_run_worker`를 직접 호출할 수 있습니다


### 세션 명령

Codex에는 세 개의 프롬프트가 설치됩니다:

| 명령 | 동작 |
|---|---|
| `/dsh-config` | 이 세션의 기본값 조회·설정: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<초>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | worker 작업 실시간 상태: tier, 진행, 토큰, 현재 도구 |
| `/dsh-playbook` | 디스패치 모범 사례: flash vs pro 선택, 자기 완결적인 브리프, 병렬 처리, 결과 검증, 가드레일 |

## Antigravity (agy)

### 설치

```bash
node src/install/cli.mjs agy
```

dsh-crew MCP server를 `~/.gemini/config/mcp_config.json`에 등록하고 `ds-flash` / `ds-pro` agent와 `dsh-config`, `dsh-status`, `dsh-playbook` 스킬을 `~/.gemini/config/`에 설치합니다(모든 파일은 먼저 백업됨). 설치 후 세션을 다시 시작하세요.

### 사용법

- 작업을 dispatch할 agent로 `ds-flash` 또는 `ds-pro`를 선택합니다
- `dsh_worker_config`가 세션 기본값을 읽거나 덮어씁니다

### 세션 스킬

| 스킬 | 동작 |
|---|---|
| `/dsh-config` | 이 세션의 기본값 조회·설정(tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | worker 작업 실시간 상태: tier, 진행, 토큰, 현재 도구 |
| `/dsh-playbook` | 디스패치 모범 사례: flash vs pro 선택, 자기 완결적인 브리프, 병렬 처리, 결과 검증, 가드레일 |

### 주의 사항

- agy는 worker를 **전체 승인**(full approval)으로 실행합니다(`--dangerously-skip-permissions` + accept-edits): agy 1.1.16에는 workspace-scoped permission mode가 없으므로 headless worker가 tool 요청을 자동 승인해야 합니다.

제거: `node src/install/cli.mjs uninstall-agy`

## Grok

### 설치

```bash
node src/install/cli.mjs grok
```

`[mcp_servers.dsh-crew]` 섹션을 `~/.grok/config.toml`에 쓰고 `ds-flash` / `ds-pro` agent와 `/dsh-config`, `/dsh-status`, `/dsh-playbook` 명령을 `~/.grok/`에 설치합니다(모든 파일은 먼저 백업됨).

### 사용법

- 작업을 dispatch할 agent로 `ds-flash` 또는 `ds-pro`를 선택합니다

### 세션 명령

| 명령 | 동작 |
|---|---|
| `/dsh-config` | 이 세션의 기본값 조회·설정(tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | worker 작업 실시간 상태: tier, 진행, 토큰, 현재 도구 |
| `/dsh-playbook` | 디스패치 모범 사례: flash vs pro 선택, 자기 완결적인 브리프, 병렬 처리, 결과 검증, 가드레일 |

### 주의 사항

- 보안 설계상 grok은 신뢰할 수 없는 프로젝트 디렉터리에서 repo-level MCP server를 시작하지 않습니다(`grok mcp doctor`가 "folder untrusted"로 보고). global 설치는 영향받지 않습니다 — 디렉터리를 바꾸거나 `--trust`를 전달하세요.
- grok worker는 `bypassPermissions`로 실행됩니다(항상 승인 — grok 문서가 headless 자동화에 권장하는 방식). deny 규칙과 hook은 계속 적용됩니다.

제거: `node src/install/cli.mjs uninstall-grok`

## MCP 도구

| 도구 | 설명 |
|---|---|
| `dsh_run_worker` | 블로킹 작업 dispatch(`tier`: flash/pro, `effort`: off/high/max, `cwd`, `worker`), 결과를 기다립니다 |
| `dsh_spawn_worker` | 비동기 dispatch, job id 반환(병렬 fan-out용); 결과는 `dsh_worker_result`로 수집 |
| `dsh_worker_status` | 모든 job의 실시간 progress 조회(turn/step/현재 tool/token) + cwd advisory lock |
| `dsh_worker_result` | 결과 가져오기, `wait_seconds` 지정 가능 |
| `dsh_worker_cancel` | 지정한 job 취소 및 해당 runtime process 종료 |
| `dsh_worker_config` | 세션 기본값(tier, effort, mode, timeout, policy, escalation) 조회·설정 및 `worker_profiles` 나열 |

progress는 동시에 `~/.config/dsh-crew/status.d/`에 미러링됩니다(writer마다 shard file 하나, statusline / 외부 모니터링에서 읽을 수 있음).

## 디스패치 가드레일

모든 dispatch는 무엇이든 실행되기 전에 검사됩니다 — 거부는 읽을 수 있는 오류이며 결코 조용한 대기열이 아닙니다:

- **Origin chain**: 각 dispatch는 worker→worker origin chain에 hop을 추가합니다. 제한(`origin_depth_limit`, 기본값 3)보다 깊은 중첩은 거부되고, 순환(같은 backend + cwd가 두 번 나타남)도 거부됩니다 — 재귀적 worker 자기 증폭을 막는 가드입니다.
- **cwd advisory lock**: workspace당 실행 중인 worker 하나. 점유된 workspace에 대한 두 번째 dispatch는 보유자의 job id, backend, 시작 시간과 함께 거부됩니다 — 끝날 때까지 기다리거나, `dsh_worker_cancel`로 취소하거나, `allow_concurrent_cwd: true`를 전달하세요(읽기 전용 작업에만).

## 디스패치 플레이북

dispatch를 *잘* 하는 방법 — flash vs pro 선택, 자기 완결적인 브리프, 안전한 병렬 처리, 결과 검증, 위의 가드레일 — 이 호스트별 플레이북으로 번들되어 있습니다: `/dsh-crew:playbook` (Claude Code 스킬), `/dsh-playbook` (Codex 프롬프트, Antigravity 스킬, Grok 명령).

## 명시적 CLI 백엔드

`worker="agy"` / `worker="grok"`는 dispatch를 DSH tier 로직 대신 해당 외부 CLI(backend × model × effort)에 고정합니다. 명시적 opt-in입니다 — 기본값이 없으므로 사용자가 해당 CLI를 요청할 때만 설정하세요. 주의 사항: grok은 신뢰할 수 없는 폴더에서 repo-local MCP server 시작을 거부하고, agy는 worker를 전체 승인으로 실행합니다(workspace-scoped permission mode 없음).

## 멀티모달: 비전 및 이미지 생성

**DeepSeek는 text-only model**이며 image 입력이나 생성을 지원하지 않습니다. 이 plugin은 MCP tool을 통해 이러한 기능을 외부에서 제공받습니다:

**네이티브 비전 우선**: vision provider가 내장 CLI(또는 명시적으로 `native`)일 때 `describe_image`는 먼저 DeepSeek 자체 VL model `deepseek-v4-flash-vision-exp`를 시도합니다(직접 API 호출; 키는 `DEEPSEEK_API_KEY` 또는 `~/.config/dsh-crew/.env`에서). 실패하면 아래 CLI provider 체인으로 우아하게 저하되며, 이 체인은 폴백으로 유지됩니다. 이미지 생성은 영향받지 않습니다 — 네이티브 model은 사진만 볼 뿐입니다.

| 도구 | 설명 |
|---|---|
| `describe_image` | 이미지(스크린샷, 디자인, 차트 등)를 보고 질문에 답합니다. 결과는 provider + model + image + question별로 캐시됩니다 |
| `generate_image` | 텍스트 설명에서 이미지를 생성하고 지정된 absolute path에 저장합니다. 출력은 flat bitmap입니다(레이어 편집에는 OpenPencil 필요) |

**세션 이미지 붙여넣기**: DSH에서 model을 `DeepSeek (vision) ◉`로 전환하면 이미지를 직접 붙여넣을 수 있습니다. 이미지는 session에 남아 정상적으로 표시됩니다. plugin은 이미지 뒤에 전사된 텍스트를 추가하고 전송 전에 이미지를 제거합니다 — 사용자는 이미지를 보고, model은 텍스트를 읽습니다. 전사는 동일한 네이티브 우선 사다리를 따릅니다: 키가 있을 때는 DeepSeek의 VL model, 그다음에는 설정한 CLI provider.

### 구성

**DSH 설정 페이지 → DSH Crew → Multimodal**(또는 `~/.config/dsh-crew/config.json` 직접 편집):

**Vision provider**(이미지 보기):

- `native` / `deepseek-native` (DeepSeek 자체 VL model — 모든 내장 provider에서 키가 있을 때마다 자동으로 먼저 시도됨)
- `claude-code` (기본값, haiku 사용, 저비용)
- `codex` (GPT 사용, 특정 model 지정 가능)
- `grok` (Grok 사용)
- `agy` (Antigravity)
- `custom` (OpenAI 호환 API 또는 로컬 명령)
- `off` (비활성화)

**Image generation provider**(이미지 생성):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI 호환 API 또는 로컬 명령)
- `off` (비활성화)

### 사용자 지정 provider

두 가지 통합 방법이 있습니다:

**API**: 모든 OpenAI 호환 endpoint
- Base URL, API Key, model list 입력
- Vision은 인라인 base64 이미지와 함께 `/chat/completions`를 사용합니다
- Image generation은 `/images/generations`를 사용합니다
- 생성 기능을 사용하려면 **"image generation model"을 반드시 지정해야 합니다**. 그렇지 않으면 provider는 vision 선택 항목에만 나타납니다

**CLI**: 로컬 command template. placeholder는 안전한 참조로 대체됩니다
- Vision: `{image} {question} {model}` → stdout이 답변이 됩니다
- Image generation: `{prompt} {output} {size}` → 명령이 `{output}`에 파일을 써야 합니다
- 최소한 하나의 command를 입력하세요. 입력된 command에 따라 capability가 결정됩니다

**Connectivity test**: 각 custom provider에는 테스트 버튼이 있습니다
- API: endpoint reachability와 auth를 확인하고 실제 vision 요청을 보내 검증합니다
- CLI: 실행 파일을 확인하고 실제 명령을 실행해 검증합니다
- Image generation: 구성만 검증하고 실제 이미지를 출력하지는 않습니다

**빌려 쓰는 subscription CLI**(claude / codex / grok / agy)는 로컬에 로그인되어 있어야 합니다. plugin이 해당 권한을 대신 우회하지 않습니다.

## Hub 모드

이 패키지는 유효한 DSH bundle(`dsh.bundle` + `cordis.patch.yml`)이기도 합니다. `dsh plugin add dsh-crew`로 DSH Web profile에 설치하면:

- **Worker session이 first-class citizen이 됩니다**: DSH host에서 first-class session으로 실행되고(`agents.create` + session별 model/effort waterfall + 기본 preset), Web UI session 목록에 표시되며, 언제든 열어 전체 실행을 확인할 수 있습니다
- **작업 디렉터리별 구성**: Web UI에서 worker session을 cwd별로 관리할 수 있습니다
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: 작업 생성, 목록, long-poll 결과, 취소
  - `GET /_dsh/dsh-crew/ping`: health check(MCP shim이 hub 실행 여부를 감지하는 데 사용)
  - `POST /_dsh/dsh-crew/install`: 호스트 통합 원클릭 설치 — Claude Code / Codex / Antigravity / Grok(`src/install/`의 backend)
- **자동 감지**: 호스트들의 MCP shim이 hub를 자동 감지합니다(`DSH_CREW_HUB` 환경 변수, 기본값 `http://127.0.0.1:3080`)
  - DSH Web 실행 중 → job이 hub mode로 실행됩니다(`mode: "hub"`)
  - 실행 중이 아님 → standalone runtime으로 폴백합니다

## 솔루션 선택 및 제한 사항

### 일반 구독자 → shell subagent 방식(권장)

- **현재 상태**: Claude Code subagent shell은 중간 매개체로 haiku를 사용하므로 dispatch마다 수백~수천 token이 추가됩니다
- **트레이드오프**: 소량의 Anthropic token을 사용하는 대신 native task UI, 실시간 progress 표시, 추가 구성 불필요라는 이점을 얻습니다
- **권장**: 이미 Claude Pro를 구독 중이거나 Claude Code를 사용한다면 이 방식이 편리하고 투명합니다

### 종량제 / CI 환경 → 직접 router 방식

- **현재 상태**: Claude Code subagent frontmatter는 타사 model 직접 연결을 지원하지 않습니다. 이 저장소의 scratchpad에 있는 router 실험은 Claude Code에 API-key 자격 증명이 필요하지만, subscription OAuth는 Anthropic 상위 단계에서 403으로 차단됩니다
- **권장**:
  - API-key 자격 증명(OAuth 아님)을 사용하고 Anthropic token을 절약하려면 로컬 router를 실행해 DeepSeek에 직접 연결할 수 있습니다
  - CI 환경도 일반적으로 API key를 사용하므로 이 방식이 더 경제적입니다(모두 DeepSeek token)
  - router 통합에 대한 자체 테스트가 필요합니다(공식 지원되지 않음)

### DSH Web 실행 중 → hub mode 자동 활성화

- **현재 상태**: `dsh plugin add dsh-crew`를 DSH Web profile에 설치했다면 job은 host에서 first-class session으로 실행되고 Web UI session 목록에 표시됩니다
- **권장**: 로컬 개발 반복 중에는 hub mode를 활성화하는 것을 권장합니다. worker progress를 Web UI에서 완전히 관찰할 수 있습니다. 머신 간 협업 또는 Web UI가 없는 환경에서는 dispatch 호스트 shell 방식을 사용하세요

### 알려진 항목

- Codex role은 이론적으로 DeepSeek을 직접 가리키는 `model_provider`를 시도할 수 있습니다(미검증). 이 bridge는 그것에 의존하지 않습니다
- Image generation 출력은 flat bitmap입니다. 레이어 편집에는 OpenPencil이 필요합니다
- **Runtime dependencies**: `@modelcontextprotocol/sdk`와 `zod`만 있습니다. `@deepseek-ai/*`는 호스트 런타임입니다(DSH host가 제공; 일반 npm 설치는 이를 가져오지 않음)
- **Codex 필수 구성**: `default_tools_approval_mode = "approve"`, 그렇지 않으면 tool 호출이 자동 취소됩니다

## 개발

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Runtime dependencies는 `@modelcontextprotocol/sdk`와 `zod`뿐입니다. 모든 `@deepseek-ai/*` 패키지는 DSH host가 제공하는 호스트 런타임이며(package.json의 dshHostRuntime 필드에 문서화되고 peerDependencies에는 없으므로 일반 npm 설치가 이를 가져오지 않음), plugin을 host의 단일 module realm 안에 유지합니다.

## 에코시스템

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 대화 안에서 동작하는 Android 에뮬레이터와 USB 연결 기기 — 전부 adb로 구동
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — 대화 안에서 동작하는 iOS 시뮬레이터와 USB 연결 iPhone
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH를 위한 장기 메모리
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 대화 중 `.op` 디자인 문서를 검사하고 편집

## 라이선스

MIT
