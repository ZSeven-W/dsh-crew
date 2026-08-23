<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>ปลั๊กอินสำหรับ <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>: ส่งงานให้ DSH agents จาก Claude Code / Codex / Antigravity / Grok โดยไม่ต้องสละ subagent UI ดั้งเดิมของโฮสต์</strong><br />
  <sub>UI แสดงความคืบหน้าแบบเนทีฟ &bull; นโยบาย Tier และการยกระดับ &bull; ราวกันตกของการ Dispatch &bull; กระดานงาน &bull; เซสชัน DSH ในโฮสต์ &bull; การดูภาพและการสร้างภาพ (Native-First) &bull; ติดตั้งในคลิกเดียว</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; เวอร์ชันปลั๊กอินปัจจุบัน: <code>0.1.0-rc.4</code> &middot; ทดสอบกับ DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md"><b>English</b></a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md"><b>ไทย</b></a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>หน้า settings ของ DSH Crew — การเชื่อมต่อโฮสต์ นโยบายการส่งงาน การทำงาน และสะพาน multimodal</sub></p>

## ทำไมต้อง DSH Crew

DSH Crew เป็นปลั๊กอินสำหรับ [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — agent harness แบบโอเพนซอร์ส มันทำให้ DSH agents ถูกสั่งงานจาก Claude Code, Codex, Antigravity และ Grok ได้: orchestrator คงใช้โมเดลของตัวเอง งานรันบน DSH agent จริงพร้อม tools, sandbox, presets และ session history ของ harness นั้น และโฮสต์ยังคงแสดงผลเป็น subagent แบบเนทีฟพร้อมความคืบหน้าแบบเรียลไทม์

สิ่งที่รันงานคือ DSH agent ไม่ใช่การเรียกโมเดลเปล่าๆ Tier (`flash` / `pro`) กำหนดว่า agent นั้นจะได้ capability มากแค่ไหนจาก roster โมเดลที่ตั้งค่าไว้ใน harness — ปัจจุบันคือ DeepSeek V4 Flash และ V4 Pro — ดังนั้นการเปลี่ยนโมเดลใน DSH ไม่ต้องแก้ไขอะไรที่นี่

<table>
<tr>
<td width="50%">

### 🧵 UI แสดงความคืบหน้าแบบเนทีฟ

Workers ปรากฏเป็น subagent ปกติใน Claude Code / Codex / Antigravity / Grok — จำนวนงานที่ส่ง ขั้นตอนที่กำลังรัน การเรียก tool และการใช้ token แสดงทั้งหมดใน task panel ของโฮสต์เอง พร้อมด้วย claude-hud statusline segment: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`

</td>
<td width="50%">

### 🎚️ นโยบาย Tier และการยกระดับ

`flash` สำหรับงานเชิงกลไก `pro` สำหรับงานที่ต้องใช้เหตุผล `effort` ตั้งแต่ `off` ถึง `max` `tier_policy` บังคับให้ทุกการส่งงานใช้ tier เดียวที่ tool layer ได้ และ `escalate_on_failure` จะลองรัน flash ที่ล้มเหลวซ้ำบน pro อีกครั้ง — อิงจากหลักฐานจริง ไม่ใช่การเดาความยากล่วงหน้า

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ เซสชัน DSH ในโฮสต์

เมื่อติดตั้ง bundle ลงใน DSH profile แล้ว worker แต่ละตัวคือ DSH session ชั้นหนึ่ง: มองเห็นได้ใน Web UI จัดกลุ่มตาม working directory และติดตั้งด้วย Agent preset ที่คุณเลือกตาม tier หาก DSH ไม่ได้รันอยู่ การส่งงานจะ fallback ไปยัง DSH runtime แบบ standalone ทำให้ CI และสภาพแวดล้อมแบบ headless ยังทำงานได้

</td>
<td width="50%">

### 👁️ การดูภาพและการสร้างภาพ

โมเดลของ DSH รองรับเฉพาะข้อความ `describe_image` ตอนนี้จะใช้ VL model ของ DeepSeek เอง (`deepseek-v4-flash-vision-exp`) ก่อนเสมอเมื่อมี key จากนั้นจึง fallback ไปยัง CLI ที่คุณมีอยู่แล้ว — Claude, Codex, Grok, Antigravity — หรือ OpenAI-compatible API ใดๆ ที่คุณตั้งค่าไว้ `generate_image` ยืมพู่กันจาก CLI ชุดเดียวกัน ภาพที่วางเข้ามายังมองเห็นได้ในบทสนทนาและไปถึงโมเดลในรูปของข้อความ

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ ราวกันตกของการ Dispatch

ทุกการส่งงานถูกตรวจสอบก่อนที่อะไรจะถูก spawn การซ้อน worker→worker ถูกจำกัดไว้ที่ความลึกของ origin-chain 3 ระดับ และ cycle ถูกปฏิเสธ worker ตัวที่สองบน workspace ที่ job อื่นถือครองอยู่แล้วจะถูกปฏิเสธพร้อมข้อมูลของผู้ถือ — ไม่มีการเข้าคิวแบบเงียบๆ เด็ดขาด การปฏิเสธคือ error ที่อ่านออกได้: รอหรือปรับขอบเขตงาน อย่าหาทางเลี่ยง

</td>
<td width="50%">

### 📋 กระดานงาน

แผง DSH Crew ทำหน้าที่เป็นกระดานงานด้วย: งาน worker ทุกงาน — กำลังรันหรือเสร็จแล้ว — ถูกแสดงพร้อม tier, effort, ความคืบหน้าแบบเรียลไทม์และ tokens workspace ที่ถูกถือครองแสดงผู้ถือของมัน และงานที่หายไประหว่างทาง (เช่น hub restart) จะถูกแสดงเป็น orphan ghost แทนที่จะหายไปเงียบๆ

</td>
</tr>
<tr>
<td width="50%">

### 🔌 ผู้ให้บริการแบบกำหนดเอง

นำ endpoint ของคุณเอง (Base URL + API key + models) หรือ command template ในเครื่องมาใช้ ผู้ให้บริการแต่ละรายมีการทดสอบการเชื่อมต่อที่ตรวจสอบการเข้าถึงและ auth จากนั้นส่งคำขอ vision จริงหนึ่งครั้ง เพื่อให้คุณรู้ผลทันที ไม่ใช่กลางคันของงาน

</td>
<td width="50%">

### 📦 ติดตั้งในคลิกเดียว

หน้า settings ติดตั้งและอัปเดตปลั๊กอิน Claude Code, ไฟล์ role ของ Codex และ agents, skills และ commands ของ Antigravity / Grok ให้คุณ — การลงทะเบียน marketplace, allowlist สิทธิ์, การต่อสาย HUD, absolute path ที่สร้างสำหรับเครื่องนี้ — และกู้คืนได้ง่ายพอๆ กัน ไฟล์ settings ทุกไฟล์ถูกสำรองก่อนเสมอ

</td>
</tr>
</table>

## วิธีการทำงาน

```
Claude Code / Codex / Antigravity / Grok (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → that external CLI runs the task (explicit opt-in)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## หนึ่งการรัน สองมุมมอง

การ dispatch ขยายออกได้กว้าง ด้านล่างมี worker สิบแปดตัวแปล README นี้พร้อมกัน: ฝั่ง host นับพวกมันเป็น subagent ของตัวเอง ส่วน harness รันพวกมันเป็นเซสชันจริง

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>ใน Claude Code worker ของ dsh-crew ปรากฏเป็น subagent ดั้งเดิม และส่วน statusline แสดง tier ที่กำลังทำงาน เวลาที่ใช้ และ token</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>แผง DSH Crew แสดงการรันเดียวกันจากฝั่ง harness: host ใดส่งงานไหน tier และ effort ความคืบหน้าแบบเรียลไทม์ และการใช้ token</sub></p>

<p align="center"><sub>แผงนี้ยังเป็นกระดานงานด้วย: งานที่กำลังรันและที่เสร็จแล้วยังคงแสดงอยู่ในรายการพร้อม tier ความคืบหน้าและ tokens workspace ที่ถูกถือครองระบุชื่อผู้ถือ และงานที่หายไประหว่างทาง (hub restart) จะปรากฏเป็น orphan ghost แทนที่จะหายไปเงียบๆ</sub></p>

## การติดตั้ง

ติดตั้งจาก npm ลงในโปรไฟล์ DSH:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

หรือสำหรับการพัฒนาในเครื่องจากซอร์ส:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

โปรโตคอล `link:` จะ symlink dependency ของโปรไฟล์มาที่รีโพนี้ ทำให้ผลการ rebuild เห็นได้ทันที

### ตั้งค่าข้อมูลรับรองของ DeepSeek (เฉพาะ standalone)

ในโหมด hub — การติดตั้งข้างบน — worker รันภายใน DSH instance และใช้ข้อมูลรับรอง DeepSeek ที่มีการตั้งค่าไว้แล้ว ไม่ต้องตั้งค่าอะไรเพิ่มเติม

เฉพาะ standalone fallback เท่านั้นที่ต้องใช้ key ของตัวเอง: การส่งงานจากโฮสต์ที่ไม่มี DSH instance ทำงานจะเปิดตัว worker runtime เป็นกระบวนการแยกต่างหาก ขอ API key จาก [platform.deepseek.com](https://platform.deepseek.com) และเขียนลงใน `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### ตรวจสอบ

```bash
node scripts/smoke.mjs
```

smoke test ส่งงาน job หนึ่งอันราคาถูกผ่านเส้นทางใดๆ ที่มีอยู่ — hub เมื่อ DSH instance ทำงานอยู่ standalone ในกรณีอื่น — และพิมพ์เส้นทางที่ใช้ ภายในประมาณสิบวินาที คุณควรเห็น `smoke test passed — configuration OK` เมื่อล้มเหลว เหตุผลจะถูกพิมพ์ ซึ่งกำหนดไว้สำหรับเส้นทางที่ทดสอบ

จากนั้นเปิด การตั้งค่า → DSH Crew แล้วติดตั้งการเชื่อมต่อของโฮสต์ — Claude Code, Codex, Antigravity, Grok — ด้วยคลิกเดียว หรือเรียกใช้ตัวติดตั้งเดียวกันจากบรรทัดคำสั่ง:

```bash
node src/install/cli.mjs claude   # ปลั๊กอิน Claude Code: marketplace + สิทธิ์ + HUD segment
node src/install/cli.mjs codex    # Codex agents + prompts
node src/install/cli.mjs agy      # Antigravity MCP config + agents + skills
node src/install/cli.mjs grok     # Grok MCP config + agents + commands
node src/install/cli.mjs all      # ทั้งสี่โฮสต์พร้อมกัน
# uninstall แบบสมมาตร (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

## ความเป็นมาและคำศัพท์

- **DSH** (DeepSeek Harness): agent harness โอเพนซอร์สของ DeepSeek เป็น code agent ในรูปแบบ Web UI คล้ายกับ Claude Code แต่ขับเคลื่อนด้วยโมเดลของ DeepSeek
- **MCP** (Model Context Protocol): โปรโตคอลเชื่อมต่อเครื่องมือ AI ของ Anthropic ช่วยให้ LLM เรียกเครื่องมือภายนอกและแหล่งข้อมูลได้อย่างปลอดภัย
- **Cordis bundle**: รูปแบบปลั๊กอินของ DSH โปรเจกต์นี้รันแบบ standalone เป็น MCP service ได้ หรือติดตั้งลงใน DSH Web เป็นโหมด hub
- **tier**: ระดับ capability — worker จะได้รับช่องไหนจาก roster โมเดลที่ตั้งค่าไว้ใน DSH `flash` เร็วและถูก (งานง่าย) `pro` ใช้เหตุผลลึกกว่า (ปัญหาซับซ้อน) ปัจจุบันจับคู่กับ DeepSeek V4 Flash และ V4 Pro หากเปลี่ยนโมเดลใน DSH ที่นี่ก็ไม่ต้องแก้ไขอะไร
- **worker**: DSH agent ที่ทำงาน — เป็น session เต็มรูปแบบพร้อม tools, sandbox และ preset ของตัวเอง ไม่ใช่การเรียกโมเดลเปล่าๆ
- **effort**: ระดับความเข้มข้นของการใช้เหตุผล `off` = ไม่ใช้เหตุผล `high` = ลงทุนการใช้เหตุผลสูง `max` = ลงทุนการใช้เหตุผลสูงสุด

## Claude Code

### การติดตั้ง

ติดตั้งในคลิกเดียว (เลือกอย่างใดอย่างหนึ่ง):

- **หน้า settings ของ DSH** (เมื่อติดตั้งโหมด hub แล้ว): Settings → DSH Crew → "Install to Claude Code"
- **บรรทัดคำสั่ง**: `node src/install/cli.mjs all`

ทั้งสองวิธีทำสิ่งเดียวกัน: ลงทะเบียน marketplace ในเครื่อง (ไดเรกทอรีแม่ `dsh-plugins/` เป็น marketplace root) + `claude plugin install` + allowlist สิทธิ์ของ MCP tool + ตั้งค่า claude-hud worker status segment (สำรอง settings.json อัตโนมัติก่อนแก้ไข และรันซ้ำได้โดยปลอดภัย) **รีสตาร์ท session หลังติดตั้งเพื่อให้การเปลี่ยนแปลงมีผล**

### วิธีใช้งาน

- ในบทสนทนาโดยตรง พูดว่า "dispatch X to ds-flash" หรือ "dispatch X to ds-pro" แล้ว subagent จะรันงานนั้น
- จำนวนงานที่ส่งและความคืบหน้าแบบเรียลไทม์แสดงใน task UI ของ Claude Code
- **HUD status line segment**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (tier ปัจจุบัน / เวลาที่ผ่านไป / การใช้ token / จำนวนที่เสร็จ)
  - สำหรับการพัฒนาในเครื่อง `statusline/statusline.sh` หรือ `statusline/worker-segment.sh` สามารถเชื่อมต่อแยกอิสระได้
- **งานที่รันนาน**: CC มีการจำกัด timeout ของการเรียก MCP (ปรับ `MCP_TOOL_TIMEOUT` ได้) งานที่ยาวสามารถให้ orchestrator ใช้ `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` เพื่อ polling ได้
- **การพัฒนาและดีบักในเครื่อง**: `claude --plugin-dir /path/to/dsh-crew` เพื่อโหลดชั่วคราว


### คำสั่งระดับเซสชัน

แทนที่ค่าเริ่มต้นระดับ global เฉพาะเซสชันปัจจุบัน และบังคับใช้ที่ชั้นเครื่องมือ ไม่ใช่ด้วยพรอมป์ต์:

| คำสั่ง | ทำอะไร |
|---|---|
| `/dsh-crew:config` | ดูหรือตั้งค่าเริ่มต้นของเซสชัน: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<วินาที>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | เปิดหรือปิดการ dispatch ของเซสชันนี้ (ปิดคือสวิตช์แข็ง เครื่องมือจะปฏิเสธ) |
| `/dsh-crew:status` | สถานะสดของงาน worker: tier ความคืบหน้า tokens และเครื่องมือปัจจุบัน |
| `/dsh-crew:playbook` | แนวปฏิบัติที่ดีที่สุดในการ dispatch: การเลือก flash vs pro, บรีฟที่ครบถ้วนในตัวเอง, การทำงานแบบขนาน, การตรวจสอบผลลัพธ์, ราวกันตก |

## Codex

### การติดตั้ง

แนะนำให้ใช้ตัวติดตั้ง (สร้าง path สำหรับเครื่องนี้โดยอัตโนมัติ และคัดลอกพรอมป์ต์ `/dsh-config`, `/dsh-status` และ `/dsh-playbook`):

```bash
node src/install/cli.mjs codex
```

หรือคัดลอกด้วยตนเอง (ต้องแก้ไข path เองหลังคัดลอก):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

ไฟล์ role ถูกตั้งค่าไว้ล่วงหน้าด้วย:

- การตั้งค่าการ mount MCP server
- `default_tools_approval_mode = "approve"` (**จำเป็น** มิฉะนั้น tool calls จะถูกยกเลิกอัตโนมัติใน exec mode)
- `tool_timeout_sec = 3600`

**หมายเหตุ**: เมื่อคัดลอกด้วยตนเอง absolute path ในฟิลด์ `args` ต้องอัปเดตให้ตรงกับตำแหน่งติดตั้งจริง ตัวติดตั้งจัดการส่วนนี้ให้อัตโนมัติ

### วิธีใช้งาน

- ใน TUI แบบอินเทอร์แอกทีฟ เลือก "spawn ds-pro to ..." เพื่อส่งงาน แผง Active/Done แสดงความคืบหน้า
- โหมด `codex exec` เรียก `dsh_run_worker` ได้โดยตรงเช่นกัน


### คำสั่งระดับเซสชัน

ฝั่ง Codex ติดตั้งพรอมป์ต์สามตัว:

| คำสั่ง | ทำอะไร |
|---|---|
| `/dsh-config` | ดูหรือตั้งค่าเริ่มต้นของเซสชัน: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<วินาที>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | สถานะสดของงาน worker: tier ความคืบหน้า tokens และเครื่องมือปัจจุบัน |
| `/dsh-playbook` | แนวปฏิบัติที่ดีที่สุดในการ dispatch: การเลือก flash vs pro, บรีฟที่ครบถ้วนในตัวเอง, การทำงานแบบขนาน, การตรวจสอบผลลัพธ์, ราวกันตก |

## Antigravity (agy)

### การติดตั้ง

```bash
node src/install/cli.mjs agy
```

ลงทะเบียน dsh-crew MCP server ใน `~/.gemini/config/mcp_config.json` และติดตั้ง `ds-flash` / `ds-pro` agents พร้อม skill `dsh-config`, `dsh-status` และ `dsh-playbook` ลงใน `~/.gemini/config/` (สำรองไฟล์ทั้งหมดก่อนแก้ไข) รีสตาร์ทเซสชันหลังการติดตั้ง

### วิธีใช้งาน

- เลือก `ds-flash` หรือ `ds-pro` เป็น agent เพื่อส่งงาน
- `dsh_worker_config` อ่านหรือเขียนทับค่าเริ่มต้นของเซสชัน

### Skills ระดับเซสชัน

| Skill | ทำอะไร |
|---|---|
| `/dsh-config` | ดูหรือตั้งค่าเริ่มต้นของเซสชัน (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | สถานะสดของงาน worker: tier ความคืบหน้า tokens และเครื่องมือปัจจุบัน |
| `/dsh-playbook` | แนวปฏิบัติที่ดีที่สุดในการ dispatch: การเลือก flash vs pro, บรีฟที่ครบถ้วนในตัวเอง, การทำงานแบบขนาน, การตรวจสอบผลลัพธ์, ราวกันตก |

### ข้อควรระวัง

- agy รัน worker ด้วย **full approval** (`--dangerously-skip-permissions` + accept-edits): agy 1.1.16 ไม่มีโหมดสิทธิ์ระดับ workspace ดังนั้น worker แบบ headless จึงต้องอนุมัติคำขอ tool โดยอัตโนมัติ

ถอนการติดตั้ง: `node src/install/cli.mjs uninstall-agy`

## Grok

### การติดตั้ง

```bash
node src/install/cli.mjs grok
```

เขียนส่วน `[mcp_servers.dsh-crew]` ลงใน `~/.grok/config.toml` และติดตั้ง `ds-flash` / `ds-pro` agents พร้อมคำสั่ง `/dsh-config`, `/dsh-status` และ `/dsh-playbook` ลงใน `~/.grok/` (สำรองไฟล์ทั้งหมดก่อนแก้ไข)

### วิธีใช้งาน

- เลือก `ds-flash` หรือ `ds-pro` เป็น agent เพื่อส่งงาน

### คำสั่งระดับเซสชัน

| คำสั่ง | ทำอะไร |
|---|---|
| `/dsh-config` | ดูหรือตั้งค่าเริ่มต้นของเซสชัน (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | สถานะสดของงาน worker: tier ความคืบหน้า tokens และเครื่องมือปัจจุบัน |
| `/dsh-playbook` | แนวปฏิบัติที่ดีที่สุดในการ dispatch: การเลือก flash vs pro, บรีฟที่ครบถ้วนในตัวเอง, การทำงานแบบขนาน, การตรวจสอบผลลัพธ์, ราวกันตก |

### ข้อควรระวัง

- ด้วยการออกแบบด้านความปลอดภัย grok จะไม่สตาร์ท MCP server ระดับ repo ในไดเรกทอรีโปรเจกต์ที่ไม่ได้รับความไว้วางใจ (`grok mcp doctor` รายงานว่า "folder untrusted"); การติดตั้งแบบ global ไม่ได้รับผลกระทบ — เปลี่ยนไดเรกทอรีหรือส่ง `--trust`
- grok workers รันด้วย `bypassPermissions` (always-approve ตามที่เอกสารของ grok แนะนำสำหรับ headless automation); deny rules และ hooks ยังคงมีผล

ถอนการติดตั้ง: `node src/install/cli.mjs uninstall-grok`

## เครื่องมือ MCP

| เครื่องมือ | คำอธิบาย |
|---|---|
| `dsh_run_worker` | ส่งงานแบบ blocking (`tier`: flash/pro, `effort`: off/high/max, `cwd`, `worker`) และรอผลลัพธ์ |
| `dsh_spawn_worker` | ส่งงานแบบ asynchronous คืน job id (สำหรับ fan-out แบบขนาน); เก็บผลลัพธ์ด้วย `dsh_worker_result` |
| `dsh_worker_status` | ความคืบหน้าแบบเรียลไทม์ของทุก job (turn/step/tool ปัจจุบัน/token) + cwd advisory locks |
| `dsh_worker_result` | ดึงผลลัพธ์ ระบุ `wait_seconds` เพื่อรอได้ |
| `dsh_worker_cancel` | ยกเลิก job ที่ระบุ พร้อมยุติ runtime process ของมัน |
| `dsh_worker_config` | อ่าน/ตั้งค่าเริ่มต้นของเซสชัน (tier, effort, mode, timeout, policy, escalation) และแสดงรายการ `worker_profiles` |

ความคืบหน้าจะถูก mirror ไปยัง `~/.config/dsh-crew/status.d/` พร้อมกัน (หนึ่งไฟล์ shard ต่อผู้เขียนหนึ่งราย statusline / ระบบ monitoring ภายนอกอ่านได้)

## ราวกันตกของการ Dispatch

ทุกการส่งงานถูกตรวจสอบก่อนที่อะไรจะถูก spawn — การปฏิเสธคือ error ที่อ่านออกได้ ไม่ใช่การเข้าคิวแบบเงียบๆ:

- **Origin chain**: การส่งงานแต่ละครั้งเพิ่มหนึ่ง hop เข้าไปใน origin chain ของ worker→worker การซ้อนลึกเกินขีดจำกัด (`origin_depth_limit` ค่าเริ่มต้น 3) จะถูกปฏิเสธ และ cycle ก็เช่นกัน (backend + cwd เดียวกันปรากฏสองครั้ง) — ราวกันตกที่หยุดการขยายตัวเองแบบวนซ้ำของ worker
- **cwd advisory lock**: หนึ่ง worker ที่กำลังรันต่อหนึ่ง workspace การส่งงานครั้งที่สองเข้า workspace ที่ถูกถือครองจะถูกปฏิเสธพร้อม job id, backend และเวลาเริ่มต้นของผู้ถือ — รอให้จบ ยกเลิกด้วย `dsh_worker_cancel` หรือส่ง `allow_concurrent_cwd: true` (เฉพาะงานแบบอ่านอย่างเดียว)

## เพลย์บุ๊กการ Dispatch

วิธี dispatch ให้ *ดี* — flash vs pro, บรีฟที่ครบถ้วนในตัวเอง, การทำงานแบบขนานที่ปลอดภัย, การตรวจสอบผลลัพธ์ และราวกันตกข้างบน — รวมอยู่ใน playbook ประจำโฮสต์: `/dsh-crew:playbook` (Claude Code skill), `/dsh-playbook` (Codex prompt, Antigravity skill, Grok command)

## แบ็กเอนด์ CLI แบบระบุเจาะจง

`worker="agy"` / `worker="grok"` ตรึงการส่งงานครั้งหนึ่งไว้กับ CLI ภายนอกนั้น (backend × model × effort) แทนตรรกะ tier ของ DSH เป็น opt-in อย่างชัดเจน — ไม่มีค่าเริ่มต้น จึงตั้งค่าเฉพาะเมื่อผู้ใช้ขอ CLI นั้นเท่านั้น ข้อควรระวัง: grok ปฏิเสธการสตาร์ท MCP server ระดับ repo ในโฟลเดอร์ที่ไม่ได้รับความไว้วางใจ และ agy รัน worker ด้วย full approval (ไม่มีโหมดสิทธิ์ระดับ workspace)

## Multimodal: การดูภาพและการสร้างภาพ

**DeepSeek เป็นโมเดลแบบข้อความล้วน** ไม่รองรับการรับภาพหรือการสร้างภาพ ปลั๊กอินนี้ดึง capability เหล่านี้จากภายนอกผ่าน MCP tools:

**Native vision ก่อนเสมอ**: เมื่อ vision provider เป็น CLI ในตัว (หรือระบุ `native` อย่างชัดเจน) `describe_image` จะลองใช้ VL model ของ DeepSeek เอง `deepseek-v4-flash-vision-exp` ก่อน (เรียก API โดยตรง; key จาก `DEEPSEEK_API_KEY` หรือ `~/.config/dsh-crew/.env`) ความล้มเหลวใดๆ จะลดระดับลงไปยังสาย CLI provider ด้านล่างอย่างนุ่มนวล ซึ่งยังคงเก็บไว้เป็น fallback การสร้างภาพไม่ถูกแตะต้อง — native model ใช้ดูภาพเท่านั้น

| เครื่องมือ | คำอธิบาย |
|---|---|
| `describe_image` | ตอบคำถามด้วยการดูภาพ (screenshots, ดีไซน์, แผนภูมิ ฯลฯ) ผลลัพธ์ถูกแคชตาม provider + model + image + question |
| `generate_image` | สร้างภาพจากคำอธิบายข้อความ บันทึกไปยัง absolute path ที่ระบุ ผลลัพธ์เป็น bitmap แบบแบน (ต้องใช้ OpenPencil เพื่อแก้ไขเลเยอร์) |

**การวางภาพใน session**: ใน DSH ให้สลับโมเดลเป็น `DeepSeek (vision) ◉` เพื่อวางภาพโดยตรง ภาพยังคงอยู่ใน session และแสดงผลตามปกติ ปลั๊กอินจะต่อท้ายข้อความที่ถอดความแล้วไว้หลังภาพและตัดภาพออกก่อนส่ง—คุณเห็นภาพ โมเดลอ่านข้อความ การถอดความใช้บันได native-first แบบเดียวกัน: ใช้ VL model ของ DeepSeek เมื่อมี key หรือไม่ก็ใช้ CLI provider ที่คุณตั้งค่าไว้

### การตั้งค่า

ใน **หน้า settings ของ DSH → DSH Crew → Multimodal** (หรือแก้ไข `~/.config/dsh-crew/config.json` โดยตรง):

**Vision provider** (การดูภาพ):

- `native` / `deepseek-native` (VL model ของ DeepSeek เอง — จะถูกทดลองใช้ก่อนอัตโนมัติสำหรับ built-in provider ทุกตัวเมื่อมี key)
- `claude-code` (ค่าเริ่มต้น ใช้ haiku ราคาประหยัด)
- `codex` (ใช้ GPT ระบุโมเดลเฉพาะได้)
- `grok` (ใช้ Grok)
- `agy` (Antigravity)
- `custom` (OpenAI-compatible API หรือคำสั่งในเครื่อง)
- `off` (ปิดใช้งาน)

**Image generation provider** (การสร้างภาพ):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI-compatible API หรือคำสั่งในเครื่อง)
- `off` (ปิดใช้งาน)

### ผู้ให้บริการแบบกำหนดเอง

มีสองวิธีในการเชื่อมต่อ:

**API**: endpoint ที่รองรับ OpenAI ใดก็ได้
- กรอก Base URL, API Key และรายการ models
- Vision ใช้ `/chat/completions` พร้อมภาพ base64 แบบ inline
- การสร้างภาพใช้ `/images/generations`
- **ต้องระบุ "image generation model" จึงจะสร้างภาพได้** มิฉะนั้น provider จะปรากฏเฉพาะในตัวเลือก vision เท่านั้น

**CLI**: command template ในเครื่อง โดย placeholder จะถูกแทนที่ด้วยการอ้างอิงที่ปลอดภัย
- Vision: `{image} {question} {model}` → stdout เป็นคำตอบ
- การสร้างภาพ: `{prompt} {output} {size}` → คำสั่งต้องเขียนไฟล์ไปยัง `{output}`
- กรอกอย่างน้อยหนึ่งคำสั่ง คำสั่งไหนถูกกรอกจะเป็นตัวกำหนด capability

**การทดสอบการเชื่อมต่อ**: ผู้ให้บริการแบบกำหนดเองแต่ละรายมีปุ่มทดสอบ
- API: ตรวจสอบการเข้าถึง endpoint และ auth พร้อมส่งคำขอ vision จริงเพื่อยืนยัน
- CLI: ตรวจสอบไฟล์ปฏิบัติการ และรันคำสั่งจริงเพื่อยืนยัน
- การสร้างภาพ: ตรวจสอบ config เท่านั้น ไม่มีการสร้างภาพจริง

**CLI ที่ยืมมาจาก subscription** (claude / codex / grok / agy) กำหนดให้คุณต้องล็อกอินในเครื่องก่อน ปลั๊กอินจะไม่เลี่ยงการตรวจสอบสิทธิ์ของ CLI เหล่านั้นให้คุณ

## โหมด Hub

แพ็กเกจนี้ยังเป็น DSH bundle ที่สมบูรณ์ด้วย (`dsh.bundle` + `cordis.patch.yml`) หลังจากติดตั้งลงใน DSH Web profile ด้วย `dsh plugin add dsh-crew`:

- **Worker sessions กลายเป็นพลเมืองชั้นหนึ่ง**: รันเป็น session ชั้นหนึ่งในโฮสต์ DSH (`agents.create` + model/effort waterfall ต่อ session + preset เริ่มต้น) ปรากฏในรายการ session ของ Web UI เปิดดูการทำงานทั้งหมดได้ทุกเมื่อ
- **จัดระเบียบตาม working directory**: จัดการ worker sessions ตาม cwd ใน Web UI
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: สร้างงาน แสดงรายการ long-poll ผลลัพธ์ ยกเลิก
  - `GET /_dsh/dsh-crew/ping`: ตรวจสุขภาพ (MCP shim ใช้ endpoint นี้ตรวจจับว่า hub ทำงานอยู่หรือไม่)
  - `POST /_dsh/dsh-crew/install`: ติดตั้งการเชื่อมต่อของโฮสต์ — Claude Code / Codex / Antigravity / Grok ในคลิกเดียว (backend ของ `src/install/`)
- **การตรวจจับอัตโนมัติ**: MCP shim ของโฮสต์ต่างๆ ตรวจจับ hub โดยอัตโนมัติ (env var `DSH_CREW_HUB` ค่าเริ่มต้น `http://127.0.0.1:3080`)
  - DSH Web ทำงานอยู่ → jobs เข้าสู่โหมด hub (`mode: "hub"`)
  - ไม่ได้ทำงานอยู่ → fallback ไปยัง runtime แบบ standalone

## การเลือกแนวทางและข้อจำกัด

### ผู้ใช้แบบ subscription ทั่วไป → แนวทาง shell subagent (แนะนำ)

- **สถานะปัจจุบัน**: Claude Code subagent shell ใช้ haiku เป็นตัวกลาง การส่งงานแต่ละครั้งเพิ่ม token หลายร้อยถึงหลายพัน
- **ข้อแลกเปลี่ยน**: ใช้ Anthropic token จำนวนเล็กน้อย แลกกับ task UI แบบเนทีฟ การแสดงความคืบหน้าแบบเรียลไทม์ และไม่ต้องตั้งค่าเพิ่มเติม
- **ข้อแนะนำ**: หากคุณสมัคร Claude Pro อยู่แล้วหรือใช้ Claude Code อยู่ ให้ใช้แนวทางนี้—สะดวกและโปร่งใส

### สภาพแวดล้อมแบบจ่ายตามการใช้งาน / CI → แนวทาง direct router

- **สถานะปัจจุบัน**: frontmatter ของ Claude Code subagent ไม่รองรับการเชื่อมต่อโมเดลบุคคลที่สามโดยตรง การทดลอง router ใน scratchpad ของ repo นี้ต้องใช้ credentials แบบ API-key สำหรับ Claude Code แต่ OAuth แบบ subscription ถูก Anthropic บล็อกไว้ต้นทางด้วย 403
- **ข้อแนะนำ**:
  - หากใช้ credentials แบบ API-key (ไม่ใช่ OAuth) และต้องการประหยัด Anthropic token สามารถรัน router ในเครื่องเพื่อเชื่อมต่อ DeepSeek ได้โดยตรง
  - สภาพแวดล้อม CI มักใช้ API keys เช่นกัน แนวทางนี้ประหยัดกว่า (ใช้ DeepSeek token ทั้งหมด)
  - ต้องทดสอบการเชื่อมต่อ router ด้วยตนเอง (ไม่ได้รับการสนับสนุนอย่างเป็นทางการ)

### เมื่อ DSH Web ทำงานอยู่ → โหมด hub เปิดใช้อัตโนมัติ

- **สถานะปัจจุบัน**: หากติดตั้ง `dsh plugin add dsh-crew` ลงใน DSH Web profile แล้ว jobs จะรันเป็น session ชั้นหนึ่งในโฮสต์และปรากฏในรายการ session ของ Web UI
- **ข้อแนะนำ**: ระหว่างการพัฒนาในเครื่อง แนะนำให้เปิดโหมด hub เพราะสามารถสังเกตความคืบหน้าของ worker ได้ครบถ้วนใน Web UI สำหรับการทำงานร่วมกันข้ามเครื่องหรือสภาพแวดล้อมที่ไม่มี Web UI ให้ใช้แนวทาง shell ของโฮสต์ที่ส่งงาน

### เรื่องที่ทราบอยู่แล้ว

- ในทางทฤษฎี Codex role สามารถลองชี้ `model_provider` ไปยัง DeepSeek ได้โดยตรง (ยังไม่ผ่านการตรวจสอบ) สะพานเชื่อมนี้ไม่ได้พึ่งพาสิ่งนั้น
- ผลลัพธ์ของการสร้างภาพเป็น bitmap แบบแบน การแก้ไขเลเยอร์ต้องใช้ OpenPencil
- **Runtime dependencies**: มีเพียง `@modelcontextprotocol/sdk` และ `zod` เท่านั้น `@deepseek-ai/*` เป็น host runtime (จัดหาโดย DSH host; การติดตั้ง npm ปกติจะไม่ดึงมา)
- **Codex ต้องตั้งค่า**: `default_tools_approval_mode = "approve"` มิฉะนั้น tool calls จะถูกยกเลิกอัตโนมัติ

## การพัฒนา

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Runtime dependencies มีเพียง `@modelcontextprotocol/sdk` และ `zod` เท่านั้น ทุกแพ็กเกจ `@deepseek-ai/*` เป็น host runtime ที่ DSH host จัดหาให้ (บันทึกไว้ในฟิลด์ dshHostRuntime ของ package ไม่ใช่ใน peerDependencies การติดตั้ง npm ปกติจึงไม่ดึงมา) ซึ่งทำให้ปลั๊กอินอยู่ใน module realm เดียวกันของโฮสต์

## ระบบนิเวศ

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — อีมูเลเตอร์ Android หรืออุปกรณ์ผ่าน USB แบบสดภายในบทสนทนา ขับเคลื่อนทั้งหมดผ่าน adb
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — iOS Simulator ที่ทำงานจริง — และ iPhone ที่ต่อผ่าน USB — ภายในบทสนทนา
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — หน่วยความจำระยะยาวสำหรับ DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — ตรวจดูและแก้ไขเอกสารดีไซน์ `.op` ภายในบทสนทนา

## สัญญาอนุญาต

MIT
