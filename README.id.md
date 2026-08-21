<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Plugin <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>: dispatch pekerjaan ke agen DSH dari Claude Code / Codex, tanpa kehilangan UI subagent bawaan host.</strong><br />
  <sub>UI Progres Bawaan &bull; Kebijakan Tier &amp; Eskalasi &bull; Sesi DSH di Dalam Host &bull; Vision &amp; Pembuatan Gambar &bull; Instalasi Sekali Klik</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Rilis plugin saat ini: <code>0.1.0-rc.4</code> &middot; Diuji dengan DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md"><b>Bahasa Indonesia</b></a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>Halaman pengaturan DSH Crew — integrasi host, kebijakan dispatch, eksekusi, dan jembatan multimodal</sub></p>

## Mengapa DSH Crew

DSH Crew adalah plugin untuk [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — harness agen sumber terbuka. Plugin ini membuat agen DSH dapat di-dispatch dari Claude Code dan Codex: orchestrator tetap memakai modelnya sendiri, pekerjaan berjalan pada agen DSH sungguhan dengan tools, sandbox, preset, dan riwayat sesi milik harness tersebut, dan host tetap menampilkannya sebagai subagent bawaan dengan progres langsung.

Yang menjalankan pekerjaan adalah agen DSH, bukan panggilan model biasa. Tier (`flash` / `pro`) menentukan seberapa besar kapabilitas yang didapat agen tersebut dari roster yang dikonfigurasi di harness — saat ini DeepSeek V4 Flash dan V4 Pro — sehingga pergantian model di DSH tidak memerlukan perubahan apa pun di sini.

<table>
<tr>
<td width="50%">

### 🧵 UI Progres Bawaan

Worker tampil sebagai subagent biasa di Claude Code / Codex — jumlah dispatch, langkah yang sedang berjalan, panggilan tool, dan penggunaan token semuanya tampil di panel tugas milik host, plus segmen statusline claude-hud: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Kebijakan Tier dan Eskalasi

`flash` untuk pekerjaan mekanis, `pro` untuk penalaran, `effort` dari `off` sampai `max`. `tier_policy` dapat membatasi setiap dispatch ke satu tier di lapisan tool, dan `escalate_on_failure` mencoba ulang sekali run flash yang gagal di pro — berdasarkan bukti, bukan menebak tingkat kesulitan di awal.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ Sesi DSH di Dalam Host

Dengan bundle terpasang di profil DSH, setiap worker adalah sesi DSH kelas satu: terlihat di Web UI, dikelompokkan menurut direktori kerja, dipasangi preset Agent yang Anda pilih per tier. Tanpa DSH berjalan, dispatch melakukan fallback ke runtime DSH standalone, sehingga lingkungan CI dan headless tetap berfungsi.

</td>
<td width="50%">

### 👁️ Vision dan Pembuatan Gambar

Model DSH hanya mendukung teks. `describe_image` dan `generate_image` meminjam mata dan kuas dari CLI yang sudah Anda miliki — Claude, Codex, Grok, Antigravity — atau dari API apa pun yang kompatibel dengan OpenAI yang Anda konfigurasi. Gambar yang ditempel tetap terlihat di percakapan dan sampai ke model sebagai teks.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Provider Kustom

Bawa endpoint Anda sendiri (Base URL + API key + model) atau template perintah lokal. Setiap provider punya uji konektivitas yang memeriksa keterjangkauan dan autentikasi, lalu melakukan satu panggilan vision sungguhan sehingga Anda langsung tahu sekarang, bukan di tengah tugas.

</td>
<td width="50%">

### 📦 Instalasi Sekali Klik

Halaman pengaturan memasang dan memperbarui plugin Claude Code dan file role Codex untuk Anda — registrasi marketplace, daftar izin (allowlist), pemasangan HUD, path absolut yang dirender untuk mesin ini — dan memulihkannya semudah itu. Setiap file pengaturan dicadangkan terlebih dahulu.

</td>
</tr>
</table>

## Cara Kerja

```
Claude Code / Codex (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## Satu eksekusi, dua sudut pandang

Dispatch bisa melebar. Di bawah ini delapan belas worker menerjemahkan README ini secara paralel: host menghitungnya sebagai subagent miliknya, sementara harness menjalankannya sebagai sesi nyata.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Di Claude Code, worker dsh-crew tampil sebagai subagent native; segmen statusline menampilkan tier yang berjalan, waktu berjalan, dan token.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>Panel DSH Crew melihat eksekusi yang sama dari sisi harness: host mana yang mengirim setiap job, tier dan effort-nya, progres langsung, dan pemakaian token.</sub></p>

## Instalasi

Pasang dari npm ke sebuah profil DSH:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Atau, untuk pengembangan lokal langsung dari kode sumber:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

Protokol `link:` menautkan dependensi profil ke repositori ini, sehingga hasil rebuild langsung terlihat.

### Konfigurasikan kredensial DeepSeek (hanya standalone)

Dalam hub mode — instalasi di atas — worker berjalan di dalam instance DSH dan menggunakan kredensial DeepSeek yang sudah dikonfigurasi. Tidak perlu setup apa pun.

Hanya fallback standalone yang memerlukan key sendiri: ketika dispatch dari Claude Code / Codex tanpa instance DSH yang berjalan, worker runtime diluncurkan sebagai proses terpisah. Ambil API key di [platform.deepseek.com](https://platform.deepseek.com) lalu tulis ke `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### Verifikasi

```bash
node scripts/smoke.mjs
```

Smoke test mengirim satu job murah melalui path yang tersedia — hub saat instance DSH sedang berjalan, standalone sebaliknya — dan mencetak path mana yang digunakan. Dalam sekitar sepuluh detik akan muncul `smoke test passed — configuration OK`. Jika gagal, alasannya dicetak dan dibatasi pada path yang diuji.

Lalu buka Pengaturan → DSH Crew dan pasang integrasi Claude Code / Codex dengan sekali klik.

## Latar Belakang dan Terminologi

- **DSH** (DeepSeek Harness): harness agen sumber terbuka dari DeepSeek, agen kode dalam bentuk Web UI, mirip Claude Code tetapi menggerakkan model DeepSeek.
- **MCP** (Model Context Protocol): protokol integrasi tool AI dari Anthropic, memungkinkan LLM memanggil tool eksternal dan sumber data secara aman.
- **Cordis bundle**: format plugin DSH; proyek ini dapat berjalan standalone sebagai layanan MCP atau dipasang ke DSH Web sebagai mode hub.
- **tier**: tier kapabilitas — slot mana dari roster model DSH yang dikonfigurasi yang didapat seorang worker. `flash` cepat dan murah (tugas sederhana), `pro` menalar lebih dalam (masalah kompleks). Saat ini keduanya dipetakan ke DeepSeek V4 Flash dan V4 Pro; ganti model di DSH dan tidak ada yang berubah di sini.
- **worker**: agen DSH yang mengerjakan pekerjaan — sesi penuh dengan tools, sandbox, dan preset sendiri, bukan panggilan model biasa.
- **effort**: kekuatan penalaran, `off` = tanpa penalaran, `high` = investasi penalaran tinggi, `max` = investasi penalaran maksimum.

## Claude Code

### Instalasi

Instalasi sekali klik (pilih salah satu):

- **Halaman pengaturan DSH** (saat mode hub terpasang): Settings → DSH Crew → "Install to Claude Code"
- **Baris perintah**: `node src/install/cli.mjs all`

Keduanya melakukan hal yang sama: mendaftarkan marketplace lokal (direktori induk `dsh-plugins/` sebagai root marketplace) + `claude plugin install` + daftar izin tool MCP + konfigurasi segmen status worker claude-hud (mencadangkan settings.json otomatis sebelum perubahan, idempotent). **Mulai ulang sesi setelah instalasi agar perubahan diterapkan.**

### Penggunaan

- Langsung di percakapan, katakan "dispatch X to ds-flash" atau "dispatch X to ds-pro", dan subagent menjalankan tugasnya
- Jumlah dispatch dan progres waktu nyata ditampilkan di UI tugas Claude Code
- **Segmen status line HUD**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (tier saat ini / waktu berjalan / penggunaan token / jumlah selesai)
  - Untuk pengembangan lokal, `statusline/statusline.sh` atau `statusline/worker-segment.sh` dapat diintegrasikan secara terpisah
- **Tugas berdurasi panjang**: CC punya batas timeout pada panggilan MCP (`MCP_TOOL_TIMEOUT` dapat disesuaikan), untuk tugas panjang orchestrator dapat memakai polling `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)`
- **Pengembangan dan debugging lokal**: `claude --plugin-dir /path/to/dsh-crew` untuk memuat sementara


### Perintah sesi

Hanya menimpa nilai default global untuk sesi saat ini, dan ditegakkan di lapisan tool, bukan lewat prompt:

| Perintah | Fungsinya |
|---|---|
| `/dsh-crew:config` | Tampilkan atau setel default sesi: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<detik>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Nyalakan atau matikan dispatch untuk sesi ini (mati adalah saklar keras: tool menolak) |
| `/dsh-crew:status` | Status langsung job worker: tier, progres, token, tool saat ini |

## Codex

### Instalasi

Disarankan memakai installer (merender path otomatis untuk mesin ini, menyalin perintah `/dsh-config`, `/dsh-status`):

```bash
node src/install/cli.mjs codex
```

Atau salin manual (memerlukan modifikasi path manual setelah menyalin):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

File role sudah dikonfigurasi sebelumnya dengan:

- Konfigurasi pemasangan server MCP
- `default_tools_approval_mode = "approve"` (**wajib**, jika tidak, panggilan tool otomatis dibatalkan dalam mode exec)
- `tool_timeout_sec = 3600`

**Catatan**: Saat menyalin manual, path absolut di kolom `args` harus diperbarui agar sesuai dengan lokasi instalasi sebenarnya; installer menanganinya secara otomatis.

### Penggunaan

- Di TUI interaktif, pilih "spawn ds-pro to ..." untuk mengirim tugas; panel Active/Done menampilkan progres
- Mode `codex exec` juga dapat memanggil `dsh_run_worker` secara langsung


### Perintah sesi

Untuk Codex dipasang dua prompt yang sama:

| Perintah | Fungsinya |
|---|---|
| `/dsh-config` | Tampilkan atau setel default sesi: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<detik>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Status langsung job worker: tier, progres, token, tool saat ini |

## Tool MCP

| Tool | Deskripsi |
|---|---|
| `dsh_run_worker` | Dispatch tugas sinkron (`tier`: flash/pro, `effort`: off/high/max, `cwd`), menunggu hasil |
| `dsh_spawn_worker` | Dispatch tugas asinkron, mengembalikan job id (untuk fan-out paralel) |
| `dsh_worker_status` | Kueri progres waktu nyata semua job (turn/langkah/tool saat ini/token) |
| `dsh_worker_result` | Ambil hasil, dapat menentukan `wait_seconds` untuk menunggu |
| `dsh_worker_cancel` | Batalkan job tertentu, hentikan proses runtime-nya |

Progres secara bersamaan dicerminkan ke `~/.config/dsh-crew/status.d/` (satu file shard per penulis, dapat dibaca oleh statusline / pemantauan eksternal).

## Multimodal: Vision dan Pembuatan Gambar

**DeepSeek adalah model khusus teks** dan tidak mendukung input maupun pembuatan gambar. Plugin ini memperoleh kapabilitas tersebut secara eksternal melalui tool MCP:

| Tool | Deskripsi |
|---|---|
| `describe_image` | Menjawab pertanyaan dengan melihat gambar (screenshot, desain, bagan, dll.), hasil di-cache berdasarkan provider + model + gambar + pertanyaan |
| `generate_image` | Membuat gambar dari deskripsi teks, menyimpan ke path absolut yang ditentukan; output berupa bitmap datar (memerlukan OpenPencil untuk pengeditan layer) |

**Menempel gambar di sesi**: Di DSH, ganti model ke `DeepSeek (vision) ◉` untuk menempel gambar secara langsung. Gambar tetap ada di sesi dan tampil normal; plugin menambahkan teks hasil transkripsi setelahnya dan menghapus gambar sebelum dikirim—Anda melihat gambarnya, model membaca teksnya.

### Konfigurasi

Di **halaman pengaturan DSH → DSH Crew → Multimodal** (atau langsung edit `~/.config/dsh-crew/config.json`):

**Provider vision** (melihat gambar):

- `claude-code` (default, memakai haiku, murah)
- `codex` (memakai GPT, dapat menentukan model spesifik)
- `grok` (memakai Grok)
- `agy` (Antigravity)
- `custom` (API kompatibel OpenAI atau perintah lokal)
- `off` (nonaktif)

**Provider pembuatan gambar** (pembuatan gambar):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (API kompatibel OpenAI atau perintah lokal)
- `off` (nonaktif)

### Provider Kustom

Dua metode integrasi:

**API**: Endpoint apa pun yang kompatibel dengan OpenAI
- Isi Base URL, API Key, daftar model
- Vision memakai `/chat/completions` dengan gambar base64 inline
- Pembuatan gambar memakai `/images/generations`
- **Harus menentukan "model pembuatan gambar" agar punya kapabilitas pembuatan**, jika tidak provider hanya muncul di pilihan vision

**CLI**: Template perintah lokal, placeholder diganti dengan referensi yang aman
- Vision: `{image} {question} {model}` → stdout sebagai jawaban
- Pembuatan gambar: `{prompt} {output} {size}` → perintah harus menulis file ke `{output}`
- Isi minimal satu perintah; mana pun yang diisi menentukan kapabilitas

**Uji konektivitas**: Setiap provider kustom punya tombol uji
- API: Periksa keterjangkauan endpoint dan autentikasi, kirim permintaan vision sungguhan untuk verifikasi
- CLI: Periksa file eksekutabel, jalankan perintah sungguhan untuk verifikasi
- Pembuatan gambar: Hanya validasi konfigurasi, tanpa output gambar sungguhan

**CLI langganan yang dipinjam** (claude / codex / grok / agy) mengharuskan Anda login secara lokal; plugin tidak akan menerobos izin mereka untuk Anda.

## Mode Hub

Paket ini juga merupakan DSH bundle yang valid (`dsh.bundle` + `cordis.patch.yml`). Setelah dipasang ke profil DSH Web dengan `dsh plugin add dsh-crew`:

- **Sesi worker menjadi warga kelas satu**: berjalan sebagai sesi kelas satu di host DSH (`agents.create` + waterfall model/effort per sesi + preset default), muncul di daftar sesi Web UI, dapat dibuka kapan saja untuk melihat eksekusi lengkap
- **Kelompokkan menurut direktori kerja**: kelola sesi worker berdasarkan cwd di Web UI
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: memulai tugas, daftar, long-poll hasil, membatalkan
  - `GET /_dsh/dsh-crew/ping`: pemeriksaan kesehatan (shim MCP memakai ini untuk mendeteksi apakah hub berjalan)
  - `POST /_dsh/dsh-crew/install`: instalasi sekali klik integrasi Claude Code / Codex (backend dari `src/install/`)
- **Deteksi otomatis**: shim MCP CC/Codex mendeteksi hub secara otomatis (env var `DSH_CREW_HUB`, default `http://127.0.0.1:3080`)
  - DSH Web berjalan → job masuk mode hub (`mode: "hub"`)
  - Tidak berjalan → fallback ke runtime standalone

## Pemilihan Solusi dan Keterbatasan

### Pelanggan reguler → pendekatan subagent shell (disarankan)

- **Kondisi saat ini**: shell subagent Claude Code memakai haiku sebagai perantara; setiap dispatch menambah ratusan hingga ribuan token
- **Trade-off**: Memakai sedikit token Anthropic sebagai ganti UI tugas bawaan, tampilan progres waktu nyata, tanpa konfigurasi tambahan
- **Rekomendasi**: Jika Anda sudah berlangganan Claude Pro atau memakai Claude Code, gunakan pendekatan ini—praktis dan transparan

### Lingkungan pay-as-you-go / CI → pendekatan router langsung

- **Kondisi saat ini**: frontmatter subagent Claude Code tidak mendukung koneksi model pihak ketiga secara langsung; eksperimen router di scratchpad repo ini memerlukan kredensial API-key untuk Claude Code, tetapi OAuth langganan diblokir di sisi upstream oleh Anthropic dengan 403
- **Rekomendasi**:
  - Jika memakai kredensial API-key (bukan OAuth) dan ingin menghemat token Anthropic, dapat menjalankan router lokal untuk koneksi DeepSeek langsung
  - Lingkungan CI biasanya juga memakai API key; pendekatan ini lebih ekonomis (semua token DeepSeek)
  - Memerlukan pengujian sendiri untuk integrasi router (tidak didukung secara resmi)

### Menjalankan DSH Web → mode hub aktif otomatis

- **Kondisi saat ini**: Jika `dsh plugin add dsh-crew` dipasang ke profil DSH Web, job berjalan sebagai sesi kelas satu di host, muncul di daftar sesi Web UI
- **Rekomendasi**: Selama iterasi pengembangan lokal, disarankan mengaktifkan mode hub; progres worker dapat diamati sepenuhnya di Web UI; untuk kolaborasi lintas mesin atau lingkungan tanpa Web UI, gunakan pendekatan shell Claude Code / Codex

### Hal yang Diketahui

- Role Codex secara teoretis dapat mencoba `model_provider` yang mengarah langsung ke DeepSeek (belum diverifikasi); jembatan ini tidak bergantung padanya
- Output pembuatan gambar berupa bitmap datar; pengeditan layer memerlukan OpenPencil
- **Dependensi runtime**: Hanya `@modelcontextprotocol/sdk` dan `zod`; `@deepseek-ai/*` adalah runtime host (disediakan oleh host DSH; instalasi npm biasa tidak pernah menariknya)
- **Codex wajib dikonfigurasi**: `default_tools_approval_mode = "approve"`, jika tidak panggilan tool otomatis dibatalkan

## Pengembangan

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Dependensi runtime hanya `@modelcontextprotocol/sdk` dan `zod`; setiap paket `@deepseek-ai/*` adalah runtime host yang disediakan oleh host DSH (didokumentasikan di field dshHostRuntime pada package, bukan di peerDependencies, sehingga instalasi npm biasa tidak pernah menariknya), yang menjaga plugin tetap berada di dalam satu realm modul milik host.

## Ekosistem

- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — iOS Simulator langsung — dan iPhone via USB — di dalam percakapan
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memori jangka panjang untuk DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — memeriksa dan mengedit dokumen desain `.op` di dalam percakapan

## Lisensi

MIT
