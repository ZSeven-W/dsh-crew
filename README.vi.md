<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Một plugin của <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>: điều phối công việc tới các DSH agent từ Claude Code / Codex mà không phải từ bỏ UI subagent gốc của host.</strong><br />
  <sub>UI Tiến trình Gốc &bull; Chính sách Tier &amp; Nâng cấp &bull; Phiên DSH Trong Host &bull; Vision &amp; Tạo ảnh &bull; Cài đặt Một Cú Nhấp</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Phiên bản plugin hiện tại: <code>0.1.0-rc.4</code> &middot; Đã kiểm thử với DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md"><b>Tiếng Việt</b></a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>Trang cài đặt DSH Crew — tích hợp host, chính sách điều phối, thực thi và cầu nối đa phương thức</sub></p>

## Vì sao dùng DSH Crew

DSH Crew là một plugin cho [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — một agent harness mã nguồn mở. Nó giúp các DSH agent có thể được điều phối từ Claude Code và Codex: orchestrator giữ model của riêng mình, công việc chạy trên một DSH agent thật với công cụ, sandbox, presets và lịch sử phiên của harness đó, và host vẫn hiển thị nó như một subagent gốc với tiến trình trực tiếp.

Thứ chạy công việc là một DSH agent, không phải một lời gọi model thuần túy. Tier (`flash` / `pro`) chọn mức năng lực mà agent đó nhận được từ roster model đã cấu hình của harness — hiện là DeepSeek V4 Flash và V4 Pro — nên việc đổi model trong DSH không cần thay đổi gì ở đây.

<table>
<tr>
<td width="50%">

### 🧵 UI Tiến trình Gốc

Workers xuất hiện như các subagent thông thường trong Claude Code / Codex — số lần điều phối, bước đang chạy, lời gọi tool và lượng token sử dụng đều hiển thị trong panel tác vụ của chính host, cộng thêm một segment statusline của claude-hud: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Chính sách Tier và Nâng cấp

`flash` cho công việc máy móc, `pro` cho suy luận, `effort` từ `off` đến `max`. `tier_policy` có thể kẹp mọi lần điều phối vào một tier duy nhất ở tầng công cụ, và `escalate_on_failure` thử lại một lần chạy flash thất bại trên pro — dựa trên bằng chứng, không phải đoán trước độ khó.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ Phiên DSH Trong Host

Với bundle được cài trong một DSH profile, mỗi worker là một phiên DSH first-class: hiển thị trong Web UI, được nhóm theo thư mục làm việc, gắn preset Agent mà bạn chọn theo từng tier. Khi DSH không chạy, việc điều phối rơi về một DSH runtime standalone, nên CI và môi trường headless vẫn hoạt động.

</td>
<td width="50%">

### 👁️ Vision và Tạo ảnh

Các model của DSH chỉ xử lý văn bản. `describe_image` và `generate_image` mượn mắt và cọ vẽ của những CLI bạn đã có — Claude, Codex, Grok, Antigravity — hoặc của bất kỳ API tương thích OpenAI nào bạn cấu hình. Ảnh được dán vẫn hiển thị trong hội thoại và đến được model dưới dạng văn bản.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Provider Tùy chỉnh

Mang endpoint của riêng bạn (Base URL + API key + models) hoặc một template lệnh cục bộ. Mỗi provider có một bài kiểm tra kết nối kiểm tra khả năng truy cập và xác thực, sau đó thực hiện một lời gọi vision thật để bạn phát hiện ngay bây giờ, không phải giữa chừng tác vụ.

</td>
<td width="50%">

### 📦 Cài đặt Một Cú Nhấp

Trang cài đặt cài và cập nhật plugin Claude Code cùng các role file Codex cho bạn — đăng ký marketplace, allowlist quyền MCP tool, nối dây HUD, đường dẫn tuyệt đối được render cho máy này — và khôi phục chúng dễ dàng như vậy. Mọi tệp cài đặt đều được sao lưu trước.

</td>
</tr>
</table>

## Cách hoạt động

```
Claude Code / Codex (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## Một lần chạy, hai góc nhìn

Việc dispatch có thể trải rộng. Bên dưới, mười tám worker dịch song song tài liệu README này: host đếm chúng như subagent của chính nó, còn harness chạy chúng như những phiên thực sự.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Trong Claude Code, worker của dsh-crew hiện ra như subagent gốc; đoạn statusline theo dõi tier đang chạy, thời gian trôi qua và token.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>Bảng DSH Crew nhìn cùng lần chạy đó từ phía harness: host nào đã gửi mỗi job, tier và effort của nó, tiến độ trực tiếp và lượng token.</sub></p>

## Cài đặt

Cài từ npm vào một profile DSH:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Hoặc, để phát triển cục bộ ngay từ mã nguồn:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

Giao thức `link:` tạo symlink phụ thuộc của profile tới kho này, nên mỗi lần build lại đều thấy ngay.

### Cấu hình thông tin xác thực DeepSeek (chỉ standalone)

Trong hub mode — cài đặt ở trên — worker chạy bên trong instance DSH và sử dụng thông tin xác thực DeepSeek đã được cấu hình. Không cần setup thêm gì.

Chỉ fallback standalone cần key riêng: khi dispatch từ Claude Code / Codex mà không có instance DSH đang chạy, nó sẽ khởi động worker runtime như một process riêng. Lấy API key tại [platform.deepseek.com](https://platform.deepseek.com) và ghi vào `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### Kiểm tra

```bash
node scripts/smoke.mjs
```

Smoke test dispatch một job rẻ qua path nào khả dụng — hub khi instance DSH đang chạy, standalone nếu không — và in ra path nào được sử dụng. Trong khoảng mười giây bạn sẽ thấy `smoke test passed — configuration OK`. Nếu lỗi, lý do sẽ được in ra và giới hạn trong path được kiểm tra.

Sau đó mở Cài đặt → DSH Crew và cài tích hợp Claude Code / Codex chỉ với một cú nhấp.

## Bối cảnh và thuật ngữ

- **DSH** (DeepSeek Harness): agent harness mã nguồn mở của DeepSeek, một code agent dưới dạng Web UI, tương tự Claude Code nhưng điều khiển các model DeepSeek.
- **MCP** (Model Context Protocol): giao thức tích hợp công cụ AI của Anthropic, cho phép LLM gọi công cụ và nguồn dữ liệu bên ngoài một cách an toàn.
- **Cordis bundle**: định dạng plugin của DSH; dự án này có thể chạy standalone như một MCP service hoặc cài vào DSH Web dưới dạng hub mode.
- **tier**: bậc năng lực — slot nào trong roster model đã cấu hình của DSH mà một worker nhận được. `flash` nhanh và rẻ (tác vụ đơn giản), `pro` suy luận sâu hơn (bài toán phức tạp). Hiện chúng ánh xạ tới DeepSeek V4 Flash và V4 Pro; đổi model trong DSH thì không có gì thay đổi ở đây.
- **worker**: DSH agent thực hiện công việc — một phiên đầy đủ với công cụ, sandbox và preset riêng, không phải một lời gọi model thuần túy.
- **effort**: cường độ suy luận, `off` = không suy luận, `high` = đầu tư suy luận cao, `max` = đầu tư suy luận tối đa.

## Claude Code

### Cài đặt

Cài đặt một cú nhấp (chọn một):

- **Trang cài đặt DSH** (khi hub mode được cài): Settings → DSH Crew → "Install to Claude Code"
- **Dòng lệnh**: `node src/install/cli.mjs all`

Cả hai làm cùng một việc: đăng ký marketplace cục bộ (thư mục cha `dsh-plugins/` làm marketplace root) + `claude plugin install` + allowlist quyền MCP tool + cấu hình segment trạng thái worker cho claude-hud (tự sao lưu settings.json trước khi thay đổi, idempotent). **Khởi động lại phiên sau khi cài đặt để thay đổi có hiệu lực.**

### Sử dụng

- Trực tiếp trong hội thoại, nói "dispatch X to ds-flash" hoặc "dispatch X to ds-pro", và subagent sẽ thực hiện tác vụ
- Số lần điều phối và tiến trình thời gian thực hiển thị trong task UI của Claude Code
- **Segment statusline HUD**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (tier hiện tại / thời gian trôi qua / lượng token / số hoàn thành)
  - Khi phát triển cục bộ, `statusline/statusline.sh` hoặc `statusline/worker-segment.sh` có thể được tích hợp độc lập
- **Tác vụ chạy lâu**: CC có giới hạn timeout trên các lời gọi MCP (`MCP_TOOL_TIMEOUT` có thể điều chỉnh), tác vụ dài có thể để orchestrator dùng `dsh_spawn_worker` + polling `dsh_worker_result(wait_seconds)`
- **Phát triển và gỡ lỗi cục bộ**: `claude --plugin-dir /path/to/dsh-crew` để tải tạm thời


### Lệnh phiên

Chỉ ghi đè giá trị mặc định toàn cục cho phiên hiện tại, và được thực thi ở tầng công cụ chứ không dựa vào prompt:

| Lệnh | Tác dụng |
|---|---|
| `/dsh-crew:config` | Xem hoặc đặt mặc định của phiên: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<giây>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Bật hoặc tắt dispatch cho phiên này (tắt là công tắc cứng: công cụ sẽ từ chối) |
| `/dsh-crew:status` | Trạng thái trực tiếp của job worker: tier, tiến độ, token, công cụ hiện tại |

## Codex

### Cài đặt

Khuyến nghị dùng installer (tự render đường dẫn cho máy này, chép các lệnh `/dsh-config`, `/dsh-status`):

```bash
node src/install/cli.mjs codex
```

Hoặc chép tay (cần sửa đường dẫn thủ công sau khi chép):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

Các role file được cấu hình sẵn với:

- Cấu hình mount MCP server
- `default_tools_approval_mode = "approve"` (**bắt buộc**, nếu không các lời gọi tool sẽ bị tự động hủy trong chế độ exec)
- `tool_timeout_sec = 3600`

**Lưu ý**: Khi chép tay, các đường dẫn tuyệt đối trong trường `args` phải được cập nhật cho khớp vị trí cài đặt thực tế; installer xử lý việc này tự động.

### Sử dụng

- Trong TUI tương tác, chọn "spawn ds-pro to ..." để điều phối tác vụ; các panel Active/Done hiển thị tiến trình
- Chế độ `codex exec` cũng có thể gọi trực tiếp `dsh_run_worker`


### Lệnh phiên

Phía Codex cài đúng hai prompt tương ứng:

| Lệnh | Tác dụng |
|---|---|
| `/dsh-config` | Xem hoặc đặt mặc định của phiên: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<giây>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Trạng thái trực tiếp của job worker: tier, tiến độ, token, công cụ hiện tại |

## Công cụ MCP

| Công cụ | Mô tả |
|---|---|
| `dsh_run_worker` | Điều phối tác vụ đồng bộ (`tier`: flash/pro, `effort`: off/high/max, `cwd`), chờ kết quả |
| `dsh_spawn_worker` | Điều phối tác vụ bất đồng bộ, trả về job id (cho fan-out song song) |
| `dsh_worker_status` | Truy vấn tiến trình thời gian thực của mọi job (turn/bước/công cụ hiện tại/token) |
| `dsh_worker_result` | Lấy kết quả, có thể chỉ định `wait_seconds` để chờ |
| `dsh_worker_cancel` | Hủy job được chỉ định, chấm dứt process runtime của nó |

Tiến trình đồng thời được phản chiếu vào `~/.config/dsh-crew/status.d/` (một tệp shard cho mỗi writer, có thể được đọc bởi statusline / giám sát bên ngoài).

## Đa phương thức: vision và tạo ảnh

**DeepSeek là model chỉ xử lý văn bản** và không hỗ trợ nhập ảnh hay tạo ảnh. Plugin này lấy các khả năng đó từ bên ngoài thông qua các MCP tool:

| Công cụ | Mô tả |
|---|---|
| `describe_image` | Trả lời câu hỏi bằng cách xem ảnh (ảnh chụp màn hình, thiết kế, biểu đồ, v.v.), kết quả được cache theo provider + model + ảnh + câu hỏi |
| `generate_image` | Tạo ảnh từ mô tả văn bản, lưu vào đường dẫn tuyệt đối được chỉ định; đầu ra là bitmap phẳng (cần OpenPencil để chỉnh sửa layer) |

**Dán ảnh trong phiên**: Trong DSH, chuyển model sang `DeepSeek (vision) ◉` để dán ảnh trực tiếp. Ảnh ở lại trong phiên và hiển thị bình thường; plugin nối văn bản được nhận dạng vào sau ảnh và gỡ ảnh trước khi gửi — bạn thấy ảnh, model đọc văn bản.

### Cấu hình

Trong **trang cài đặt DSH → DSH Crew → Multimodal** (hoặc sửa trực tiếp `~/.config/dsh-crew/config.json`):

**Vision provider** (xem ảnh):

- `claude-code` (mặc định, dùng haiku, chi phí thấp)
- `codex` (dùng GPT, có thể chỉ định model cụ thể)
- `grok` (dùng Grok)
- `agy` (Antigravity)
- `custom` (API tương thích OpenAI hoặc lệnh cục bộ)
- `off` (tắt)

**Image generation provider** (tạo ảnh):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (API tương thích OpenAI hoặc lệnh cục bộ)
- `off` (tắt)

### Provider tùy chỉnh

Hai cách tích hợp:

**API**: Bất kỳ endpoint tương thích OpenAI nào
- Điền Base URL, API Key, danh sách model
- Vision dùng `/chat/completions` với ảnh base64 inline
- Tạo ảnh dùng `/images/generations`
- **Phải chỉ định "image generation model" để có khả năng tạo ảnh**, nếu không provider chỉ xuất hiện trong lựa chọn vision

**CLI**: Template lệnh cục bộ, placeholder được thay bằng tham chiếu an toàn
- Vision: `{image} {question} {model}` → stdout là câu trả lời
- Tạo ảnh: `{prompt} {output} {size}` → lệnh phải ghi tệp vào `{output}`
- Điền ít nhất một lệnh; lệnh nào được điền sẽ quyết định khả năng

**Kiểm tra kết nối**: Mỗi provider tùy chỉnh có một nút kiểm tra
- API: Kiểm tra khả năng truy cập endpoint, xác thực, gửi yêu cầu vision thật để xác minh
- CLI: Kiểm tra tệp thực thi, chạy lệnh thật để xác minh
- Tạo ảnh: Chỉ xác thực cấu hình, không xuất ảnh thật

**CLI thuê bao được mượn** (claude / codex / grok / agy) yêu cầu bạn đăng nhập cục bộ; plugin sẽ không bỏ qua quyền của chúng thay bạn.

## Hub mode

Gói này cũng là một DSH bundle hợp lệ (`dsh.bundle` + `cordis.patch.yml`). Sau khi cài vào DSH Web profile bằng `dsh plugin add dsh-crew`:

- **Các phiên worker trở thành công dân hạng nhất**: chạy như các phiên first-class trong DSH host (`agents.create` + waterfall model/effort theo từng phiên + preset mặc định), xuất hiện trong danh sách phiên của Web UI, có thể mở bất cứ lúc nào để xem toàn bộ quá trình thực thi
- **Sắp xếp theo thư mục làm việc**: quản lý các phiên worker theo cwd trong Web UI
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: tạo tác vụ, liệt kê, long-poll kết quả, hủy
  - `GET /_dsh/dsh-crew/ping`: kiểm tra sức khỏe (MCP shim dùng nó để phát hiện hub có đang chạy không)
  - `POST /_dsh/dsh-crew/install`: cài đặt tích hợp Claude Code / Codex một cú nhấp (backend của `src/install/`)
- **Tự động phát hiện**: MCP shim của CC/Codex tự động phát hiện hub (biến env `DSH_CREW_HUB`, mặc định `http://127.0.0.1:3080`)
  - DSH Web đang chạy → job vào hub mode (`mode: "hub"`)
  - Không chạy → rơi về standalone runtime

## Lựa chọn giải pháp và giới hạn

### Người dùng thuê bao → phương án shell subagent (khuyến nghị)

- **Hiện trạng**: shell subagent của Claude Code dùng haiku làm trung gian; mỗi lần điều phối tốn thêm hàng trăm đến hàng nghìn token
- **Đánh đổi**: Dùng một lượng nhỏ token Anthropic để đổi lấy task UI gốc, hiển thị tiến trình thời gian thực, không cần cấu hình thêm
- **Khuyến nghị**: Nếu bạn đã đăng ký Claude Pro hoặc dùng Claude Code, hãy dùng phương án này — tiện lợi và minh bạch

### Môi trường trả theo lượt dùng / CI → phương án router trực tiếp

- **Hiện trạng**: frontmatter của Claude Code subagent không hỗ trợ kết nối trực tiếp model bên thứ ba; thử nghiệm router của repo này trong scratchpad cần credential API-key cho Claude Code, nhưng OAuth thuê bao bị Anthropic chặn ở upstream với lỗi 403
- **Khuyến nghị**:
  - Nếu dùng credential API-key (không phải OAuth) và muốn tiết kiệm token Anthropic, có thể chạy router cục bộ để kết nối trực tiếp DeepSeek
  - Môi trường CI thường cũng dùng API key; phương án này tiết kiệm hơn (toàn bộ token là DeepSeek)
  - Cần tự kiểm thử tích hợp router (không được hỗ trợ chính thức)

### Đang chạy DSH Web → hub mode tự bật

- **Hiện trạng**: Nếu `dsh plugin add dsh-crew` được cài vào DSH Web profile, các job chạy như phiên first-class trong host, xuất hiện trong danh sách phiên của Web UI
- **Khuyến nghị**: Trong các vòng lặp phát triển cục bộ, khuyến nghị bật hub mode; tiến trình worker có thể được quan sát đầy đủ trong Web UI; với cộng tác liên máy hoặc môi trường không có Web UI, dùng phương án shell của Claude Code / Codex

### Các mục đã biết

- Codex role về lý thuyết có thể thử `model_provider` trỏ thẳng tới DeepSeek (chưa xác minh); cầu nối này không phụ thuộc vào điều đó
- Đầu ra tạo ảnh là bitmap phẳng; chỉnh sửa layer cần OpenPencil
- **Runtime dependencies**: Chỉ có `@modelcontextprotocol/sdk` và `zod`; `@deepseek-ai/*` là runtime của host (do DSH host cung cấp; cài npm thông thường không bao giờ tải chúng)
- **Codex phải cấu hình**: `default_tools_approval_mode = "approve"`, nếu không các lời gọi tool sẽ bị tự động hủy

## Phát triển

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Runtime dependencies chỉ có `@modelcontextprotocol/sdk` và `zod`; mọi gói `@deepseek-ai/*` là runtime của host do DSH host cung cấp (được ghi trong trường dshHostRuntime của package, không nằm trong peerDependencies, nên cài npm thông thường không bao giờ tải chúng), giúp plugin nằm trong module realm duy nhất của host.

## Hệ sinh thái

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — trình giả lập Android hoặc thiết bị cắm USB trực tiếp ngay trong hội thoại, điều khiển hoàn toàn qua adb
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — một iOS Simulator sống động — và iPhone kết nối USB — ngay trong hội thoại
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — bộ nhớ dài hạn cho DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — kiểm tra và chỉnh sửa tài liệu thiết kế `.op` ngay trong hội thoại

## Giấy phép

MIT
