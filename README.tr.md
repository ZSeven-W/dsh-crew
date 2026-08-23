<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Bir <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> eklentisi: Claude Code / Codex / Antigravity / Grok'tan DSH ajanlarına iş gönderin; host'un yerel subagent arayüzünden vazgeçmeden.</strong><br />
  <sub>Yerel İlerleme Arayüzü &bull; Tier Politikası &amp; Yükseltme &bull; Gönderim Korkulukları &bull; İş Panosu &bull; Host İçi DSH Oturumları &bull; Görüntü İnceleme ve Görsel Üretimi (Native-First) &bull; Tek Tıkla Kurulum</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Geçerli eklenti sürümü: <code>0.1.0-rc.4</code> &middot; DSH <code>0.1.1-rc.1</code> ile test edildi</sub>
</p>

<p align="center">
  <a href="./README.md"><b>English</b></a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md"><b>Türkçe</b></a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="Lisans" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — ayarlar sayfası" width="100%" />
</p>
<p align="center"><sub>DSH Crew ayarlar sayfası — host entegrasyonları, gönderim politikası, yürütme ve multimodal köprü</sub></p>

## Neden DSH Crew

DSH Crew, [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) için bir eklentidir — açık kaynaklı bir agent harness. DSH ajanlarını Claude Code, Codex, Antigravity ve Grok'tan gönderilebilir hale getirir: orchestrator kendi modelini korur, iş gerçek bir DSH ajanında bu harness'ın araçları, sandbox'ı, preset'leri ve oturum geçmişiyle çalışır; host ise onu canlı ilerlemeyle yerel bir subagent olarak göstermeye devam eder.

İşi çalıştıran şey bir DSH ajanıdır, çıplak bir model çağrısı değil. Tier'lar (`flash` / `pro`), ajanın harness'ın yapılandırılmış roster'ından ne kadar yetenek alacağını seçer — bugün DeepSeek V4 Flash ve V4 Pro — yani DSH'de model değişikliği burada hiçbir değişiklik gerektirmez.

<table>
<tr>
<td width="50%">

### 🧵 Yerel İlerleme Arayüzü

Worker'lar Claude Code / Codex / Antigravity / Grok'ta normal subagent'lar olarak görünür — gönderim sayısı, çalışan adım, araç çağrıları ve token kullanımı host'un kendi görev panelinde görünür; ayrıca bir claude-hud statusline bölümü: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Tier Politikası ve Yükseltme

`flash` mekanik işler için, `pro` akıl yürütme için, `effort` `off`'tan `max`'a. `tier_policy`, her gönderimi araç katmanında tek bir tier'a sabitleyebilir ve `escalate_on_failure`, başarısız bir flash çalıştırmasını pro'da bir kez yeniden dener — zorluğu önceden tahmin ederek değil, kanıta dayanarak.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ Host İçi DSH Oturumları

Bundle bir DSH profiline kurulduğunda, her worker birinci sınıf bir DSH oturumudur: Web UI'da görünür, çalışma dizinine göre gruplanır ve tier başına seçtiğiniz Agent preset'iyle bağlanır. DSH çalışmıyorsa, gönderim standalone bir DSH runtime'ına geri döner; böylece CI ve headless ortamlar çalışmaya devam eder.

</td>
<td width="50%">

### 👁️ Görüntü İnceleme ve Görsel Üretimi

DSH'nin modelleri yalnızca metindir. `describe_image` artık key mevcut olduğunda önce DeepSeek'in kendi VL modelini (`deepseek-v4-flash-vision-exp`) tercih eder, sonra zaten sahip olduğunuz CLI'lere — Claude, Codex, Grok, Antigravity — veya yapılandırdığınız herhangi bir OpenAI uyumlu API'ye düşer. `generate_image` aynı CLI'lerin fırçasını kullanır. Yapıştırılan görseller sohbette görünür kalır ve modele metin olarak ulaşır.

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ Gönderim Korkulukları

Her gönderim, herhangi bir şey başlamadan önce kontrol edilir. worker→worker iç içe geçme, origin-chain derinliği 3 ile sınırlıdır ve döngüler reddedilir; başka bir işin zaten tuttuğu bir workspace üzerindeki ikinci bir worker, tutanın bilgileriyle reddedilir — asla sessizce sıraya alınmaz. Reddetmeler okunabilir hatalardır: bekleyin veya kapsamı yeniden belirleyin, atlamayın.

</td>
<td width="50%">

### 📋 İş Panosu

DSH Crew paneli aynı zamanda bir iş panosudur: her worker işi — çalışan veya biten — tier, effort, canlı ilerleme ve token'larıyla listelenir, tutulan workspace'ler sahiplerini gösterir ve yol ortasında kaybolan bir iş (ör. hub yeniden başlatma) sessizce kaybolmak yerine yetim bir ghost olarak görünür.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Özel Sağlayıcılar

Kendi endpoint'inizi (Base URL + API anahtarı + modeller) veya yerel bir komut şablonu getirin. Her sağlayıcıda erişilebilirliği ve kimlik doğrulamayı kontrol eden, ardından gerçek bir görüntü çağrısı yapan bir bağlantı testi vardır; böylece sorunu görev sırasında değil, hemen öğrenirsiniz.

</td>
<td width="50%">

### 📦 Tek Tıkla Kurulum

Ayarlar sayfası Claude Code eklentisini, Codex role dosyalarını ve Antigravity / Grok agent'larını, skill'lerini ve komutlarını sizin için kurar ve günceller — marketplace kaydı, izin allowlist'i, HUD bağlantısı, bu makine için işlenmiş mutlak yollar — ve aynı kolaylıkla geri yükler. Her ayar dosyası önce yedeklenir.

</td>
</tr>
</table>

## Nasıl Çalışır

```
Claude Code / Codex / Antigravity / Grok (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → that external CLI runs the task (explicit opt-in)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## Tek çalışma, iki görünüm

Dağıtım yatayda büyür. Aşağıda on sekiz worker bu README'yi paralel olarak çeviriyor: host onları kendi subagent'ları olarak sayarken, harness onları gerçek oturumlar olarak çalıştırır.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code'da dsh-crew worker'ları yerel subagent olarak görünür; statusline bölümü çalışan tier'ları, geçen süreyi ve token'ları gösterir.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>DSH Crew paneli aynı çalışmayı harness tarafından gösterir: her işi hangi host gönderdi, tier ve effort değerleri, canlı ilerleme ve token kullanımı.</sub></p>

<p align="center"><sub>Panel aynı zamanda iş panosudur: çalışan ve biten işler tier, ilerleme ve token'larıyla listelenmeye devam eder, tutulan workspace'ler sahiplerinin adını söyler ve yol ortasında kaybolan bir iş (hub yeniden başlatma) sessizce kaybolmak yerine yetim bir ghost olarak görünür.</sub></p>

## Kurulum

npm üzerinden bir DSH profiline kurun:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Ya da kaynak ağacından yerel geliştirme için:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

`link:` protokolü profil bağımlılığını bu depoya sembolik olarak bağlar; böylece her rebuild anında görünür.

### DeepSeek kimlik bilgilerini yapılandırın (yalnızca standalone)

Hub modunda — yukarıdaki kurulum — worker'lar DSH örneğinin içinde çalışır ve zaten yapılandırılmış olan DeepSeek kimlik bilgilerini kullanır. Başka bir şey ayarlamaya gerek yok.

Yalnızca standalone geri dönüş yolu kendi anahtarına ihtiyaç duyar: DSH örneği çalışmıyorken bir host'tan iş gönderdiğinizde worker runtime ayrı bir işlem olarak başlatılır. [platform.deepseek.com](https://platform.deepseek.com) adresinden bir API key alın ve `~/.config/dsh-crew/.env` dosyasına yazın:

```
DEEPSEEK_API_KEY=sk-...
```

### Doğrulama

```bash
node scripts/smoke.mjs
```

Smoke test, mevcut yol üzerinden ucuz bir iş gönderir — bir DSH örneği çalışıyorsa hub, aksi halde standalone — ve hangisini kullandığını yazdırır. Yaklaşık on saniye içinde `smoke test passed — configuration OK` görmelisiniz. Hata durumunda nedeni yazdırılır; bu neden test edilen yola özgüdür.

Ardından Ayarlar → DSH Crew bölümünden host entegrasyonlarını — Claude Code, Codex, Antigravity, Grok — tek tıkla kurun ya da aynı yükleyiciyi komut satırından sürün:

```bash
node src/install/cli.mjs claude   # Claude Code plugin: marketplace + permissions + HUD segment
node src/install/cli.mjs codex    # Codex agents + prompts
node src/install/cli.mjs agy      # Antigravity MCP config + agents + skills
node src/install/cli.mjs grok     # Grok MCP config + agents + commands
node src/install/cli.mjs all      # all four hosts at once
# uninstall symmetrically (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

## Arka Plan ve Terminoloji

- **DSH** (DeepSeek Harness): DeepSeek'in açık kaynaklı agent harness'ı; Web UI biçiminde, Claude Code'a benzer ancak DeepSeek modellerini kullanan bir kod ajanı.
- **MCP** (Model Context Protocol): Anthropic'in AI araç entegrasyon protokolü; LLM'lerin harici araçları ve veri kaynaklarını güvenle çağırmasını sağlar.
- **Cordis bundle**: DSH'nin eklenti formatı; bu proje standalone bir MCP hizmeti olarak çalışabilir veya hub modunda DSH Web'e kurulabilir.
- **tier**: yetenek seviyesi — bir worker'ın DSH'nin yapılandırılmış model roster'ındaki hangi yuvayı alacağını belirtir. `flash` hızlı ve ucuzdur (basit görevler), `pro` daha derin akıl yürütür (karmaşık problemler). Bugün DeepSeek V4 Flash ve V4 Pro'ya karşılık gelirler; DSH'de modelleri değiştirin, burada hiçbir şey değişmez.
- **worker**: işi yapan DSH ajanı — kendi araçları, sandbox'ı ve preset'i olan tam bir oturum; çıplak bir model çağrısı değil.
- **effort**: akıl yürütme gücü; `off` = akıl yürütme yok, `high` = yüksek akıl yürütme yatırımı, `max` = maksimum akıl yürütme yatırımı.

## Claude Code

### Kurulum

Tek tıkla kurulum (birini seçin):

- **DSH ayarlar sayfası** (hub modu kuruluysa): Ayarlar → DSH Crew → "Install to Claude Code"
- **Komut satırı**: `node src/install/cli.mjs all`

Her ikisi de aynı şeyi yapar: yerel marketplace'i kaydeder (üst dizin `dsh-plugins/` marketplace kökü olarak) + `claude plugin install` + MCP araç izin allowlist'i + claude-hud worker durum bölümü yapılandırması (değişikliklerden önce settings.json otomatik yedeklenir, idempotent). **Değişikliklerin etkili olması için kurulumdan sonra oturumu yeniden başlatın.**

### Kullanım

- Doğrudan sohbette "dispatch X to ds-flash" veya "dispatch X to ds-pro" deyin; subagent görevi yürütür
- Gönderim sayısı ve gerçek zamanlı ilerleme Claude Code görev arayüzünde gösterilir
- **HUD durum satırı bölümü**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (geçerli tier / geçen süre / token kullanımı / tamamlama sayısı)
  - Yerel geliştirme için `statusline/statusline.sh` veya `statusline/worker-segment.sh` bağımsız olarak entegre edilebilir
- **Uzun süren görevler**: CC'nin MCP çağrılarında zaman aşımı limitleri vardır (`MCP_TOOL_TIMEOUT` ayarlanabilir); uzun görevlerde orchestrator, `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` yoklama kullanabilir
- **Yerel geliştirme ve hata ayıklama**: geçici olarak yüklemek için `claude --plugin-dir /path/to/dsh-crew`


### Oturum komutları

Genel varsayılanları yalnızca geçerli oturum için geçersiz kılar ve prompt ile değil, araç katmanında uygulanır:

| Komut | Ne yapar |
|---|---|
| `/dsh-crew:config` | Oturumun varsayılanlarını göster ya da ayarla: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<saniye>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Bu oturumda dağıtımı aç ya da kapat (kapalı sert bir anahtardır: araç reddeder) |
| `/dsh-crew:status` | Worker işlerinin canlı durumu: tier, ilerleme, token, geçerli araç |
| `/dsh-crew:playbook` | Gönderim en iyi uygulamaları: flash ve pro seçimi, kendi kendine yeten brifingler, paralellik, sonuçları doğrulama, koruma korkulukları |

## Codex

### Kurulum

Yükleyiciyi kullanmanız önerilir (bu makine için yolları otomatik işler, `/dsh-config`, `/dsh-status` ve `/dsh-playbook` prompt'larını kopyalar):

```bash
node src/install/cli.mjs codex
```

Veya elle kopyalayın (kopyaladıktan sonra elle yol değişikliği gerektirir):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

Role dosyaları şunlarla önceden yapılandırılmıştır:

- MCP sunucu bağlama yapılandırması
- `default_tools_approval_mode = "approve"` (**zorunlu**, aksi halde exec modunda araç çağrıları otomatik iptal edilir)
- `tool_timeout_sec = 3600`

**Not**: Elle kopyalarken `args` alanındaki mutlak yollar gerçek kurulum konumuyla eşleşecek şekilde güncellenmelidir; yükleyici bunu otomatik olarak halleder.

### Kullanım

- Etkileşimli TUI'de görev göndermek için "spawn ds-pro to ..." seçeneğini seçin; Active/Done panelleri ilerlemeyi gösterir
- `codex exec` modu ayrıca doğrudan `dsh_run_worker` çağırabilir


### Oturum komutları

Codex için üç prompt kurulur:

| Komut | Ne yapar |
|---|---|
| `/dsh-config` | Oturumun varsayılanlarını göster ya da ayarla: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<saniye>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Worker işlerinin canlı durumu: tier, ilerleme, token, geçerli araç |
| `/dsh-playbook` | Gönderim en iyi uygulamaları: flash ve pro seçimi, kendi kendine yeten brifingler, paralellik, sonuçları doğrulama, koruma korkulukları |

## Antigravity (agy)

### Kurulum

```bash
node src/install/cli.mjs agy
```

dsh-crew MCP sunucusunu `~/.gemini/config/mcp_config.json` dosyasına kaydeder ve `ds-flash` / `ds-pro` agent'larını, `dsh-config`, `dsh-status` ve `dsh-playbook` skill'lerini `~/.gemini/config/` dizinine kurar (tüm dosyalar önce yedeklenir). Kurulumdan sonra oturumu yeniden başlatın.

### Kullanım

- Görev göndermek için `ds-flash` veya `ds-pro` agent'ını seçin
- `dsh_worker_config` oturum varsayılanlarını okur veya geçersiz kılar

### Oturum skill'leri

| Skill | Ne yapar |
|---|---|
| `/dsh-config` | Oturumun varsayılanlarını göster ya da ayarla (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | Worker işlerinin canlı durumu: tier, ilerleme, token, geçerli araç |
| `/dsh-playbook` | Gönderim en iyi uygulamaları: flash ve pro seçimi, kendi kendine yeten brifingler, paralellik, sonuçları doğrulama, koruma korkulukları |

### Dikkat edilecekler

- agy worker'ları **tam onayla** çalıştırır (`--dangerously-skip-permissions` + accept-edits): agy 1.1.16'da workspace kapsamlı izin modu yoktur, bu yüzden headless bir worker araç isteklerini otomatik onaylamak zorundadır.

Kaldırma: `node src/install/cli.mjs uninstall-agy`

## Grok

### Kurulum

```bash
node src/install/cli.mjs grok
```

`[mcp_servers.dsh-crew]` bölümünü `~/.grok/config.toml` dosyasına yazar ve `ds-flash` / `ds-pro` agent'larını, `/dsh-config`, `/dsh-status` ve `/dsh-playbook` komutlarını `~/.grok/` dizinine kurar (tüm dosyalar önce yedeklenir).

### Kullanım

- Görev göndermek için `ds-flash` veya `ds-pro` agent'ını seçin

### Oturum komutları

| Komut | Ne yapar |
|---|---|
| `/dsh-config` | Oturumun varsayılanlarını göster ya da ayarla (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | Worker işlerinin canlı durumu: tier, ilerleme, token, geçerli araç |
| `/dsh-playbook` | Gönderim en iyi uygulamaları: flash ve pro seçimi, kendi kendine yeten brifingler, paralellik, sonuçları doğrulama, koruma korkulukları |

### Dikkat edilecekler

- Güvenlik tasarımı gereği grok, güvenilmeyen proje dizinlerinde repo düzeyinde MCP sunucuları başlatmaz (`grok mcp doctor` "folder untrusted" bildirir); global kurulum etkilenmez — dizini değiştirin veya `--trust` geçin.
- grok worker'ları `bypassPermissions` (always-approve, grok belgelerinin headless otomasyon için önerdiği gibi) ile çalışır; deny kuralları ve hook'lar yine de geçerlidir.

Kaldırma: `node src/install/cli.mjs uninstall-grok`

## MCP araçları

| Araç | Açıklama |
|---|---|
| `dsh_run_worker` | Bloklayan görev gönderimi (`tier`: flash/pro, `effort`: off/high/max, `cwd`, `worker`), sonucu bekler |
| `dsh_spawn_worker` | Eşzamansız görev gönderimi, iş kimliği döndürür (paralel fan-out için); sonuçları `dsh_worker_result` ile toplayın |
| `dsh_worker_status` | Tüm işlerin gerçek zamanlı ilerlemesi (turn/step/geçerli araç/token) + cwd advisory lock'ları |
| `dsh_worker_result` | Sonucu getirir, beklemek için `wait_seconds` belirtilebilir |
| `dsh_worker_cancel` | Belirtilen işi iptal eder, runtime sürecini sonlandırır |
| `dsh_worker_config` | Oturum varsayılanlarını oku/ayarla (tier, effort, mode, timeout, policy, escalation) ve `worker_profiles` listele |

İlerleme aynı anda `~/.config/dsh-crew/status.d/` dizinine yansıtılır (yazar başına bir shard dosyası; statusline / harici izleme tarafından okunabilir).

## Gönderim korkulukları

Her gönderim, herhangi bir şey başlamadan önce kontrol edilir — reddetmeler okunabilir hatalardır, asla sessiz kuyruklar değildir:

- **Origin chain**: Her gönderim, worker→worker origin zincirine bir hop ekler. Sınırdan daha derin iç içe geçme (`origin_depth_limit`, varsayılan 3) reddedilir; aynı şekilde herhangi bir döngü de (aynı backend + cwd'nin iki kez görünmesi) — özyinelemeli worker kendi kendini büyütmesini durduran koruma.
- **cwd advisory lock**: workspace başına bir çalışan worker. Tutulan bir workspace'e ikinci bir gönderim, tutanın iş kimliği, backend'i ve başlangıç zamanıyla reddedilir — bitmesini bekleyin, `dsh_worker_cancel` ile iptal edin veya `allow_concurrent_cwd: true` geçin (yalnızca salt okunur görevler).

## Gönderim playbook'u

*İyi* gönderim nasıl yapılır — flash ve pro, kendi kendine yeten brifingler, güvenli paralellik, sonuçları doğrulama ve yukarıdaki koruma korkulukları — host başına bir playbook olarak paketlenmiştir: `/dsh-crew:playbook` (Claude Code skill), `/dsh-playbook` (Codex prompt, Antigravity skill, Grok komutu).

## Açık CLI arka uçları

`worker="agy"` / `worker="grok"` bir gönderimi DSH tier mantığı yerine o harici CLI'ye (backend × model × effort) sabitler. Bu açık bir opt-in'dir — varsayılan yoktur, bu yüzden yalnızca kullanıcı o CLI'yi istediğinde ayarlayın. Dikkat edilecekler: grok, güvenilmeyen klasörlerde repo yerel MCP sunucularını başlatmayı reddeder ve agy worker'ları tam onayla çalıştırır (workspace kapsamlı izin modu yoktur).

## Multimodal: görüntü inceleme ve görsel üretimi

**DeepSeek yalnızca metin modelidir** ve görsel girdisini veya üretimini desteklemez. Bu eklenti bu yetenekleri MCP araçları aracılığıyla harici olarak sağlar:

**Önce yerel görüntü inceleme**: Görüntü sağlayıcısı yerleşik bir CLI olduğunda (veya açıkça `native`), `describe_image` önce DeepSeek'in kendi VL modelini `deepseek-v4-flash-vision-exp` dener (doğrudan API çağrısı; key `DEEPSEEK_API_KEY` veya `~/.config/dsh-crew/.env` dosyasından). Herhangi bir hata, fallback olarak korunan aşağıdaki CLI sağlayıcı zincirine sorunsuzca düşer. Görsel üretimi etkilenmez — yerel model yalnızca görsellere bakar.

| Araç | Açıklama |
|---|---|
| `describe_image` | Görüntülere bakarak soruları yanıtlar (ekran görüntüleri, tasarımlar, grafikler vb.); sonuçlar sağlayıcı + model + görüntü + soruya göre önbelleğe alınır |
| `generate_image` | Metin açıklamasından görüntü üretir, belirtilen mutlak yola kaydeder; çıktı düz bitmap'tir (katman düzenlemesi için OpenPencil gerekir) |

**Oturumda görsel yapıştırma**: DSH'de görselleri doğrudan yapıştırmak için modeli `DeepSeek (vision) ◉` olarak değiştirin. Görseller oturumda kalır ve normal şekilde görüntülenir; eklenti, onlardan sonra transkript edilmiş metni ekler ve göndermeden önce görselleri çıkarır — siz görseli görürsünüz, model metni okur. Transkripsiyon aynı native-first merdivenini izler: key varsa DeepSeek'in VL modeli, ardından yapılandırdığınız CLI sağlayıcısı.

### Yapılandırma

**DSH ayarlar sayfası → DSH Crew → Multimodal** bölümünde (veya doğrudan `~/.config/dsh-crew/config.json` dosyasını düzenleyin):

**Görüntü sağlayıcısı** (görüntü inceleme):

- `native` / `deepseek-native` (DeepSeek'in kendi VL modeli — her yerleşik sağlayıcı için key mevcutsa otomatik olarak önce denenir)
- `claude-code` (varsayılan, haiku kullanır, ucuz)
- `codex` (GPT kullanır, belirli bir model belirtilebilir)
- `grok` (Grok kullanır)
- `agy` (Antigravity)
- `custom` (OpenAI uyumlu API veya yerel komut)
- `off` (devre dışı)

**Görsel üretim sağlayıcısı** (görsel üretimi):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI uyumlu API veya yerel komut)
- `off` (devre dışı)

### Özel sağlayıcı

İki entegrasyon yöntemi:

**API**: OpenAI uyumlu herhangi bir endpoint
- Base URL, API Anahtarı ve model listesini doldurun
- Görüntü inceleme, satır içi base64 görsellerle `/chat/completions` kullanır
- Görsel üretimi `/images/generations` kullanır
- **Üretim yeteneğine sahip olmak için "image generation model" belirtilmelidir**, aksi halde sağlayıcı yalnızca görüntü inceleme seçiminde görünür

**CLI**: Yerel komut şablonu; placeholders güvenli referanslarla değiştirilir
- Görüntü inceleme: `{image} {question} {model}` → yanıt olarak stdout
- Görsel üretimi: `{prompt} {output} {size}` → komut dosyayı `{output}` konumuna yazmalıdır
- En az bir komut doldurun; hangisi doldurulursa yetenek onu belirler

**Bağlantı testi**: Her özel sağlayıcının bir test düğmesi vardır
- API: Endpoint erişilebilirliğini ve kimlik doğrulamayı kontrol eder, doğrulamak için gerçek bir görüntü isteği gönderir
- CLI: Çalıştırılabilir dosyayı kontrol eder, doğrulamak için gerçek komutu çalıştırır
- Görsel üretimi: Yalnızca yapılandırmayı doğrular, gerçek görsel çıktısı üretmez

**Ödünç alınan abonelik CLI'leri** (claude / codex / grok / agy) yerel olarak oturum açmış olmanızı gerektirir; eklenti sizin adınıza onların izinlerini atlamaz.

## Hub modu

Bu paket aynı zamanda geçerli bir DSH bundle'ıdır (`dsh.bundle` + `cordis.patch.yml`). `dsh plugin add dsh-crew` ile DSH Web profiline kurulduktan sonra:

- **Worker oturumları birinci sınıf vatandaş olur**: DSH host'unda birinci sınıf oturumlar olarak çalışır (`agents.create` + oturum başına model/effort şelalesi + varsayılan preset), Web UI oturum listesinde görünür ve tam yürütmeyi görmek için istenildiği zaman açılabilir
- **Çalışma dizinine göre düzenleme**: Web UI'da worker oturumlarını cwd'ye göre yönetin
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: görev başlatma, listeleme, sonuçları long-poll ile bekleme, iptal
  - `GET /_dsh/dsh-crew/ping`: sağlık kontrolü (MCP shim, hub'ın çalışıp çalışmadığını anlamak için bunu kullanır)
  - `POST /_dsh/dsh-crew/install`: host entegrasyonlarının tek tıkla kurulumu — Claude Code / Codex / Antigravity / Grok (`src/install/` arka ucu)
- **Otomatik algılama**: Host'ların MCP shim'i hub'ı otomatik algılar (`DSH_CREW_HUB` ortam değişkeni, varsayılan `http://127.0.0.1:3080`)
  - DSH Web çalışıyorsa → işler hub moduna girer (`mode: "hub"`)
  - Çalışmıyorsa → standalone runtime'a geri döner

## Çözüm seçimi ve sınırlamalar

### Normal aboneler → shell subagent yaklaşımı (önerilir)

- **Güncel durum**: Claude Code subagent shell'i haiku'yu aracı olarak kullanır; her gönderim yüzlerce ila binlerce token ekler
- **Takas**: Yerel görev arayüzü, gerçek zamanlı ilerleme görüntüleme ve ek yapılandırma gerektirmeme karşılığında az miktarda Anthropic token kullanın
- **Öneri**: Zaten Claude Pro'ya aboneyseniz veya Claude Code kullanıyorsanız bu yaklaşımı kullanın — kullanışlı ve şeffaftır

### Kullandıkça öde / CI ortamları → doğrudan router yaklaşımı

- **Güncel durum**: Claude Code subagent frontmatter'ı doğrudan üçüncü taraf model bağlantısını desteklemez; bu depodaki scratchpad'deki router deneyi Claude Code için API anahtarı kimlik bilgileri gerektirir, ancak abonelik OAuth'u upstream'te Anthropic tarafından 403 ile engellenir
- **Öneri**:
  - API anahtarı kimlik bilgileri kullanıyorsanız (OAuth değil) ve Anthropic token'larından tasarruf etmek istiyorsanız, doğrudan DeepSeek bağlantısı için yerel bir router çalıştırabilirsiniz
  - CI ortamları genellikle API anahtarları kullanır; bu yaklaşım daha ekonomiktir (tümü DeepSeek token'ları)
  - Router entegrasyonunun kendi kendine test edilmesi gerekir (resmi olarak desteklenmez)

### DSH Web çalışıyorsa → hub modu otomatik etkinleşir

- **Güncel durum**: `dsh plugin add dsh-crew` DSH Web profiline kurulduysa, işler host'ta birinci sınıf oturumlar olarak çalışır ve Web UI oturum listesinde görünür
- **Öneri**: Yerel geliştirme iterasyonu sırasında hub modunun etkinleştirilmesi önerilir; worker ilerlemesi Web UI'da tamamen izlenebilir; makineler arası iş birliği veya Web UI olmayan ortamlar için gönderim yapan host'un shell yaklaşımını kullanın

### Bilinen konular

- Codex role'u teorik olarak doğrudan DeepSeek'e işaret eden `model_provider` deneyebilir (doğrulanmamış); bu köprü buna bağlı değildir
- Görsel üretim çıktısı düz bitmap'tir; katman düzenlemesi OpenPencil gerektirir
- **Runtime bağımlılıkları**: Yalnızca `@modelcontextprotocol/sdk` ve `zod`; `@deepseek-ai/*` paketleri host runtime'dır (DSH host tarafından sağlanır; normal bir npm kurulumu bunları asla indirmez)
- **Codex şunları yapılandırmalıdır**: `default_tools_approval_mode = "approve"`, aksi halde araç çağrıları otomatik iptal edilir

## Geliştirme

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Runtime bağımlılıkları yalnızca `@modelcontextprotocol/sdk` ve `zod`'dur; her `@deepseek-ai/*` paketi DSH host tarafından sağlanan host runtime'dır (paketin dshHostRuntime alanında belgelenir, peerDependencies'te değil; bu yüzden normal bir npm kurulumu bunları asla indirmez); bu, eklentiyi host'un tek modül alanı içinde tutar.

## Ekosistem

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — sohbetin içinde canlı bir Android emülatörü ya da USB cihazı — tamamen adb üzerinden sürülür
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — sohbetin içinde canlı bir iOS simülatörü — ve USB'ye bağlı bir iPhone
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH için uzun vadeli bellek
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — bir sohbet içinde `.op` tasarım belgelerini inceleyin ve düzenleyin

## Lisans

MIT
