<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>一個 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 外掛程式：從 Claude Code / Codex 分派工作給 DSH 代理，而不放棄主機的原生 subagent UI。</strong><br />
  <sub>原生進度 UI • Tier 策略與升級 • 主機內 DSH 工作階段 • 視覺與圖片生成 • 單鍵安裝</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> • 目前外掛程式版本: <code>0.1.0-rc.3</code> • 測試版本 DSH <code>0.1.0-rc.6</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md"><b>繁體中文</b></a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>DSH Crew 設定頁面 — 主機整合、分派策略、執行與多模態橋接</sub></p>

## 為什麼選擇 DSH Crew

DSH Crew 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）開源代理框架的外掛程式。它使 DSH 代理可從 Claude Code 和 Codex 分派：協調器保留自己的模型，工作在帶有該框架的工具、沙箱、預設和工作階段歷史紀錄的真正 DSH 代理上執行，主機仍然將其顯示為帶有即時進度的原生 subagent。

運行工作的是 DSH 代理，不是裸模型呼叫。Tier（`flash` / `pro`）選擇該代理從框架配置名單取得多少能力 — 目前為 DeepSeek V4 Flash 和 V4 Pro — 因此 DSH 中的模型變更不需要此處變更。

<table>
<tr>
<td width="50%">

### 🧵 原生進度 UI

Worker 在 Claude Code / Codex 中顯示為一般 subagent — 分派計數、執行中步驟、工具呼叫和代幣使用都顯示在主機自己的工作面板中，加上 claude-hud 狀態列區段：`⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`。

</td>
<td width="50%">

### 🎚️ Tier 策略與升級

`flash` 用於機械工作，`pro` 用於推理，`effort` 從 `off` 到 `max`。`tier_policy` 可在工具層級限制每次分派為一個 tier，`escalate_on_failure` 會在 flash 執行失敗時重試一次 pro — 基於證據，不是預先猜測難度。

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ 主機內 DSH 工作階段

安裝束進 DSH 設定檔後，每個 worker 都是一級 DSH 工作階段：在 Web UI 中可見，按工作目錄分組，掛載您為每個 tier 選擇的 Agent 預設。不執行 DSH 時，分派會回落到獨立 DSH runtime，因此 CI 和無頭環境仍能工作。

</td>
<td width="50%">

### 👁️ 視覺與圖片生成

DSH 的模型是純文字。`describe_image` 和 `generate_image` 借用您已有的 CLI 的眼睛和筆刷 — Claude、Codex、Grok、Antigravity — 或任何您配置的 OpenAI 相容 API。貼上的圖片在對話中保持可見並作為文字到達模型。

</td>
</tr>
<tr>
<td width="50%">

### 🔌 自訂提供者

帶入您自己的端點（基底 URL + API 金鑰 + 模型）或本機命令範本。每個提供者都有連線測試檢查可達性和驗證，然後進行一次真實視覺呼叫，讓您現在就發現問題，而不是在工作中間。

</td>
<td width="50%">

### 📦 單鍵安裝

設定頁面為您安裝和更新 Claude Code 外掛程式以及 Codex 角色檔案 — marketplace 註冊、權限白名單、HUD 接線、為此機器轉譯的絕對路徑 — 也能輕鬆還原。每個設定檔都事先備份。

</td>
</tr>
</table>

## 運作原理

```
Claude Code / Codex（協調器，保留自己的模型）
  └─ ds-flash / ds-pro  ← 原生 subagent 殼層（進度顯示在主機的工作 UI）
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub 可達 → DSH 內工作階段（在 Web UI 中可見，按 cwd 分組）
            └─ 其他     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro（DSH SDK，事件流 → 進度和代幣統計）
```

## 一次分派，兩個視角

分派是可以鋪開的。下面這次，18 個 worker 並行翻譯這份 README：宿主把它們算作自己的子代理，harness 則把它們當作真實工作階段來跑。

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code 裡，dsh-crew worker 就是原生子代理；狀態列區段即時顯示執行中的 tier、耗時與 token。</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>DSH Crew 面板從 harness 一側看同一次執行：每個任務由哪個宿主分派、tier 與 effort、即時進度與 token 用量。</sub></p>

## 安裝

從 npm 裝進 DSH profile：

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

或者從原始碼樹本機開發：

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

`link:` 協定把 profile 相依軟連結到本儲存庫，改完重新建置即時可見。

### 設定 DeepSeek 憑證（standalone 模式專用）

在 hub 模式下 — 即上面的安裝方式 — worker 運行在 DSH 實例內部，使用 DSH 實例已設定的 DeepSeek 憑證。無需額外設定。

僅 standalone 回落方案需要自己的 key：從 Claude Code / Codex 分派任務而沒有 DSH 實例運行時，會啟動一個獨立的 worker runtime 程序。從 [platform.deepseek.com](https://platform.deepseek.com) 取得 API key，寫入 `~/.config/dsh-crew/.env`：

```
DEEPSEEK_API_KEY=sk-...
```

### 自我檢查

```bash
node scripts/smoke.mjs
```

smoke 測試會挑一條可用的路徑派一個廉價任務——DSH 實例在跑就走 hub，否則走 standalone——並印出實際用的是哪條。十幾秒內看到 `smoke test passed — configuration OK` 即設定成功。失敗會印出具體原因，且只針對實際測的那條路徑。

接著開啟 設定 → DSH Crew，一鍵裝好 Claude Code / Codex 整合。

## 背景與術語

- **DSH**（DeepSeek Harness）：DeepSeek 的開源代理框架，Web UI 形式的程式碼代理，類似於 Claude Code 但驅動 DeepSeek 模型。
- **MCP**（Model Context Protocol）：Anthropic 的 AI 工具整合協議，使 LLM 能安全地呼叫外部工具和資料來源。
- **Cordis 束**：DSH 的外掛程式格式；此專案可獨立作為 MCP 服務執行或安裝進 DSH Web 作為 hub 模式。
- **tier**：能力層級 — worker 從 DSH 配置名單取得的模型槽位。`flash` 快速且便宜（簡單工作），`pro` 推理更深（複雜問題）。目前對應到 DeepSeek V4 Flash 和 V4 Pro；在 DSH 中交換模型時此處不變。
- **worker**：做工作的 DSH 代理 — 完整的工作階段，擁有自己的工具、沙箱和預設，不是裸模型呼叫。
- **effort**：推理強度，`off` = 無推理，`high` = 高推理投資，`max` = 最大推理投資。

## Claude Code

### 安裝

單鍵安裝（選擇其一）：

- **DSH 設定頁面**（hub 模式已安裝時）：設定 → DSH Crew → "安裝到 Claude Code"
- **命令列**：`node src/install/cli.mjs all`

兩者做同樣的事：註冊本機 marketplace（父目錄 `dsh-plugins/` 作為 marketplace 根目錄）+ `claude plugin install` + MCP 工具權限白名單 + claude-hud worker 狀態區段設定（自動備份 settings.json 後再變更，冪等性）。**安裝後重新啟動工作階段以令變更生效。**

### 使用方式

- 直接在對話中說「分派 X 到 ds-flash」或「分派 X 到 ds-pro」，subagent 執行工作
- 分派計數和即時進度顯示在 Claude Code 工作 UI 中
- **HUD 狀態列區段**：`⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`（目前 tier / 經過時間 / 代幣使用 / 完成計數）
  - 本機開發時，`statusline/statusline.sh` 或 `statusline/worker-segment.sh` 可獨立整合
- **長時間執行的工作**：CC 在 MCP 呼叫上有逾時限制（`MCP_TOOL_TIMEOUT` 可調），長工作可讓協調器使用 `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` 輪詢
- **本機開發與除錯**：`claude --plugin-dir /path/to/dsh-crew` 以暫時載入


### 工作階段命令

只覆寫目前工作階段的全域預設值，且在工具層執行，不靠提示詞自覺：

| 命令 | 作用 |
|---|---|
| `/dsh-crew:config` | 檢視或設定本階段預設值：`tier=flash\|pro`、`effort=off\|high\|max`、`mode=auto\|hub\|standalone`、`timeout=<秒>`、`policy=auto\|flash-only\|pro-only`、`escalate=true\|false`、`reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | 開關本階段的分派（關閉是硬開關，工具層直接拒絕） |
| `/dsh-crew:status` | worker 任務即時狀態：tier、進度、tokens、目前工具 |

## Codex

### 安裝

建議使用安裝程式（自動為此機器轉譯路徑，複製 `/dsh-config`、`/dsh-status` 命令）：

```bash
node src/install/cli.mjs codex
```

或手動複製（複製後需要手動修改路徑）：

```bash
cp codex/agents/*.toml ~/.codex/agents/    # 全域或專案級 .codex/agents/
```

角色檔案預先設定了：

- MCP 伺服器掛載設定
- `default_tools_approval_mode = "approve"`（**必要**，否則工具呼叫在 exec 模式自動取消）
- `tool_timeout_sec = 3600`

**注意**：手動複製時，`args` 欄位中的絕對路徑必須更新以符合實際安裝位置；安裝程式會自動處理此項。

### 使用方式

- 在互動式 TUI 中，選擇「生成 ds-pro 到...」以分派工作；Active/Done 面板顯示進度
- `codex exec` 模式也可直接呼叫 `dsh_run_worker`


### 工作階段命令

Codex 端裝的是同樣兩條 prompt：

| 命令 | 作用 |
|---|---|
| `/dsh-config` | 檢視或設定本階段預設值：`tier=flash\|pro`、`effort=off\|high\|max`、`mode=auto\|hub\|standalone`、`timeout=<秒>`、`policy=auto\|flash-only\|pro-only`、`escalate=true\|false`、`reset` |
| `/dsh-status` | worker 任務即時狀態：tier、進度、tokens、目前工具 |

## MCP 工具

| 工具 | 說明 |
|---|---|
| `dsh_run_worker` | 同步工作分派（`tier`: flash/pro，`effort`: off/high/max，`cwd`），等待結果 |
| `dsh_spawn_worker` | 非同步工作分派，返回工作 id（用於平行分散） |
| `dsh_worker_status` | 查詢所有工作的即時進度（turn/step/目前工具/代幣） |
| `dsh_worker_result` | 取得結果，可指定 `wait_seconds` 等待 |
| `dsh_worker_cancel` | 取消指定工作，終止其 runtime 程序 |

進度同時複製到 `~/.config/dsh-crew/status.d/`（每個寫入者一個分片檔案，可由 statusline / 外部監控讀取）。

## 多模態：視覺與圖片生成

**DeepSeek 是純文字模型**，不支援圖片輸入或生成。此外掛程式透過 MCP 工具從外部取得這些功能：

| 工具 | 說明 |
|---|---|
| `describe_image` | 透過查看圖片回答問題（螢幕截圖、設計、圖表等），結果由提供者 + 模型 + 圖片 + 問題快取 |
| `generate_image` | 從文字描述生成圖片，儲存到指定絕對路徑；輸出是平面點陣圖（需要 OpenPencil 進行圖層編輯） |

**工作階段圖片貼上**：在 DSH 中，切換模型到 `DeepSeek (vision) ◉` 以直接貼上圖片。圖片保留在工作階段中並正常顯示；外掛程式在其後附加轉錄文字並在傳送前移除圖片 — 你看到圖片，模型讀取文字。

### 設定

在 **DSH 設定頁面 → DSH Crew → Multimodal**（或直接編輯 `~/.config/dsh-crew/config.json`）：

**視覺提供者**（圖片查看）：

- `claude-code`（預設，使用 haiku，便宜）
- `codex`（使用 GPT，可指定特定模型）
- `grok`（使用 Grok）
- `agy`（Antigravity）
- `custom`（OpenAI 相容 API 或本機命令）
- `off`（停用）

**圖片生成提供者**（圖片生成）：

- `codex`（`$imagegen`，gpt-image-2）
- `agy`（Nano Banana）
- `grok`（Imagine）
- `custom`（OpenAI 相容 API 或本機命令）
- `off`（停用）

### 自訂提供者

兩種整合方法：

**API**：任何 OpenAI 相容的端點
- 填入基底 URL、API 金鑰、模型列表
- 視覺使用 `/chat/completions` 搭配內聯 base64 圖片
- 圖片生成使用 `/images/generations`
- **必須指定「圖片生成模型」才能具有生成能力**，否則提供者只會出現在視覺選擇中

**CLI**：本機命令範本，預留位置替換為安全參照
- 視覺：`{image} {question} {model}` → stdout 作為答案
- 圖片生成：`{prompt} {output} {size}` → 命令必須將檔案寫入 `{output}`
- 至少填寫一個命令；無論填入哪個都決定能力

**連線測試**：每個自訂提供者都有測試按鈕
- API：檢查端點可達性、驗證，傳送真實視覺要求以驗證
- CLI：檢查可執行檔案，執行真實命令以驗證
- 圖片生成：僅驗證設定，無實際圖片輸出

**借用的訂閱 CLI**（claude / codex / grok / agy）要求您在本機登入；外掛程式不會為您繞過其權限。

## Hub 模式

此套件也是有效的 DSH 束（`dsh.bundle` + `cordis.patch.yml`）。使用 `dsh plugin add dsh-crew` 安裝進 DSH Web 設定檔後：

- **Worker 工作階段成為一級公民**：在 DSH 主機中作為一級工作階段執行（`agents.create` + 每工作階段模型/effort 瀑布 + 預設預設），出現在 Web UI 工作階段列表中，可隨時開啟以檢視完整執行
- **按工作目錄組織**：在 Web UI 中按 cwd 管理 worker 工作階段
- **Loopback API**：
  - `POST/GET /_dsh/dsh-crew/jobs`：生成工作、列出、長時間輪詢結果、取消
  - `GET /_dsh/dsh-crew/ping`：健康檢查（MCP shim 使用此來檢測 hub 是否執行）
  - `POST /_dsh/dsh-crew/install`：單鍵安裝 Claude Code / Codex 整合（`src/install/` 的後端）
- **自動偵測**：CC/Codex 的 MCP shim 自動偵測 hub（`DSH_CREW_HUB` 環境變數，預設 `http://127.0.0.1:3080`）
  - DSH Web 執行中 → 工作進入 hub 模式（`mode: "hub"`）
  - 未執行 → 回落到獨立 runtime

## 方案選擇與限制

### 一般訂閱者 → shell subagent 方法（推薦）

- **目前狀態**：Claude Code subagent 殼層使用 haiku 作為中介；每次分派增加數百到數千個代幣
- **權衡**：使用少量 Anthropic 代幣以換取原生工作 UI、即時進度顯示、無額外設定
- **建議**：如果您已訂閱 Claude Pro 或使用 Claude Code，使用此方法 — 方便且透明

### 隨用隨付 / CI 環境 → 直接路由器方法

- **目前狀態**：Claude Code subagent 前置訊息不支援直接第三方模型連線；此儲存庫在 scratchpad 中的路由器實驗需要 Claude Code 的 API 金鑰認證，但訂閱 OAuth 被 Anthropic 上游以 403 阻擋
- **建議**：
  - 如果使用 API 金鑰認證（非 OAuth）並希望節省 Anthropic 代幣，可以執行本機路由器以進行直接 DeepSeek 連線
  - CI 環境通常也使用 API 金鑰；此方法更經濟（全部 DeepSeek 代幣）
  - 需要自行測試路由器整合（不受官方支援）

### 執行 DSH Web → hub 模式自動啟用

- **目前狀態**：如果 `dsh plugin add dsh-crew` 已安裝到 DSH Web 設定檔，工作在主機中作為一級工作階段執行，出現在 Web UI 工作階段列表中
- **建議**：在本機開發反覆過程中，建議啟用 hub 模式；worker 進度可在 Web UI 中完全觀察；對於跨機器協作或無 Web UI 的環境，使用 Claude Code / Codex shell 方法

### 已知項目

- Codex 角色理論上可以嘗試 `model_provider` 直接指向 DeepSeek（未驗證）；此橋接不依賴它
- 圖片生成輸出是平面點陣圖；圖層編輯需要 OpenPencil
- **Runtime 依賴項**：僅 `@modelcontextprotocol/sdk` 和 `zod`；`@deepseek-ai/*` 是宿主執行階段元件（由 DSH 主機提供；一般 npm 安裝不會拉取它們）
- **Codex 必須設定**：`default_tools_approval_mode = "approve"`，否則工具呼叫自動取消

## 開發

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # 為 DSH 模組載入器包裝束
node scripts/smoke.mjs          # 分派一個真實的 flash 工作端到端
```

Runtime 依賴項僅有 `@modelcontextprotocol/sdk` 和 `zod`；每個 `@deepseek-ai/*` 套件都是由 DSH 主機提供的 peer 依賴項，這樣外掛程式就保持在主機的單一模組領域內。

## 生態系

- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — 在對話中執行 iOS 模擬器與 USB 連接的實機
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH 的長期記憶
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 在對話中檢查和編輯 `.op` 設計文件

## 授權

MIT
