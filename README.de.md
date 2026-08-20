<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Ein <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>-Plugin: Verteilen Sie Arbeit von Claude Code / Codex aus an DSH-Agenten, ohne auf die native Subagent-UI des Hosts zu verzichten.</strong><br />
  <sub>Native Fortschritts-UI &bull; Tier-Richtlinie &amp; Eskalation &bull; DSH-Sitzungen im Host &bull; Vision &amp; Bildgenerierung &bull; Ein-Klick-Installation</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Aktuelles Plugin-Release: <code>0.1.0-rc.3</code> &middot; Getestet mit DSH <code>0.1.0-rc.6</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md"><b>Deutsch</b></a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — Einstellungsseite" width="100%" />
</p>
<p align="center"><sub>Die Einstellungsseite von DSH Crew — Host-Integrationen, Dispatch-Richtlinie, Ausführung und die multimodale Brücke</sub></p>

## Warum DSH Crew

DSH Crew ist ein Plugin für [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — ein Open-Source-Agent-Harness. Es macht DSH-Agenten aus Claude Code und Codex heraus dispatchbar: Der Orchestrator behält sein eigenes Modell, die Arbeit läuft auf einem echten DSH-Agenten mit den Tools, der Sandbox, den Presets und dem Sitzungsverlauf dieses Harness, und der Host zeigt diesen weiterhin als nativen Subagenten mit Live-Fortschritt an.

Was die Arbeit ausführt, ist ein DSH-Agent, kein bloßer Modellaufruf. Tiers (`flash` / `pro`) bestimmen, wie viel Fähigkeit dieser Agent aus dem konfigurierten Roster des Harness erhält — derzeit DeepSeek V4 Flash und V4 Pro —, sodass ein Modellwechsel in DSH hier keine Änderung erfordert.

<table>
<tr>
<td width="50%">

### 🧵 Native Fortschritts-UI

Worker erscheinen als normale Subagenten in Claude Code / Codex — Dispatch-Anzahl, laufender Schritt, Tool-Aufrufe und Token-Verbrauch werden alle im eigenen Task-Panel des Hosts angezeigt, plus ein claude-hud-Statusline-Segment: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Tier-Richtlinie und Eskalation

`flash` für mechanische Arbeit, `pro` für Reasoning, `effort` von `off` bis `max`. `tier_policy` kann jeden Dispatch auf Tool-Ebene auf einen Tier begrenzen, und `escalate_on_failure` wiederholt einen fehlgeschlagenen flash-Lauf einmal auf pro — evidenzbasiert, statt die Schwierigkeit im Voraus zu erraten.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ DSH-Sitzungen im Host

Ist das Bundle in einem DSH-Profil installiert, ist jeder Worker eine First-Class-DSH-Sitzung: sichtbar in der Web-UI, nach Arbeitsverzeichnis gruppiert, mit dem pro Tier gewählten Agent-Preset gemountet. Läuft DSH nicht, fällt der Dispatch auf eine Standalone-DSH-Runtime zurück, sodass CI- und Headless-Umgebungen weiterhin funktionieren.

</td>
<td width="50%">

### 👁️ Vision und Bildgenerierung

Die Modelle von DSH sind reine Textmodelle. `describe_image` und `generate_image` leihen sich Augen und Pinsel der CLIs, die Sie bereits haben — Claude, Codex, Grok, Antigravity — oder einer beliebigen von Ihnen konfigurierten OpenAI-kompatiblen API. Eingefügte Bilder bleiben in der Konversation sichtbar und erreichen das Modell als Text.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Benutzerdefinierte Provider

Bringen Sie Ihren eigenen Endpoint (Base URL + API-Schlüssel + Modelle) oder eine lokale Befehlsvorlage mit. Jeder Provider hat einen Konnektivitätstest, der Erreichbarkeit und Auth prüft und dann einen echten Vision-Aufruf macht — so erfahren Sie es sofort statt mitten in der Aufgabe.

</td>
<td width="50%">

### 📦 Ein-Klick-Installation

Die Einstellungsseite installiert und aktualisiert das Claude-Code-Plugin und die Codex-Rollendateien für Sie — Marketplace-Registrierung, Berechtigungs-Allowlist, HUD-Anbindung, für diese Maschine gerenderte absolute Pfade — und stellt sie genauso einfach wieder her. Jede Einstellungsdatei wird zuvor gesichert.

</td>
</tr>
</table>

## Funktionsweise

```
Claude Code / Codex (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## Ein Lauf, zwei Ansichten

Dispatch lässt sich breit auffächern. Unten übersetzen achtzehn Worker dieses README parallel: Der Host zählt sie als eigene Subagenten, während das Harness sie als echte Sessions ausführt.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code sieht dsh-crew-Worker als native Subagenten; das Statusline-Segment zeigt laufende Tiers, verstrichene Zeit und Tokens.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>Das DSH-Crew-Panel zeigt denselben Lauf von der Harness-Seite: welcher Host welchen Job gestartet hat, Tier und Effort, Fortschritt und Tokenverbrauch.</sub></p>

## Installation

Aus npm in ein DSH-Profil installieren:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Oder für lokale Entwicklung direkt aus dem Quellbaum:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

Das `link:`-Protokoll verlinkt die Profilabhängigkeit auf dieses Repository, sodass Rebuilds sofort sichtbar sind.

### DeepSeek-Zugangsdaten konfigurieren (nur standalone)

Im Hub-Modus — die Installation oben — laufen Worker innerhalb der DSH-Instanz und nutzen die DeepSeek-Zugangsdaten, mit denen sie bereits konfiguriert ist. Mehr ist nicht zu konfigurieren.

Nur das Standalone-Fallback braucht einen eigenen Key: Dispatch von Claude Code / Codex ohne laufende DSH-Instanz startet eine Worker-Runtime als separaten Prozess. Hole einen API-Key auf [platform.deepseek.com](https://platform.deepseek.com) und schreibe ihn in `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### Prüfen

```bash
node scripts/smoke.mjs
```

Der Smoke Test schickt einen günstigen Job über den verfügbaren Pfad — den Hub, wenn eine DSH-Instanz läuft, sonst standalone — und gibt aus, welcher davon verwendet wurde. Nach etwa zehn Sekunden sollte `smoke test passed — configuration OK` erscheinen. Bei einem Fehler wird der Grund ausgegeben, bezogen auf den getesteten Pfad.

Öffne danach Einstellungen → DSH Crew und installiere die Claude-Code-/Codex-Integrationen mit einem Klick.

## Hintergrund und Begriffe

- **DSH** (DeepSeek Harness): DeepSeeks Open-Source-Agent-Harness, ein Code-Agent in Web-UI-Form, ähnlich wie Claude Code, aber mit DeepSeek-Modellen.
- **MCP** (Model Context Protocol): Das KI-Tool-Integrationsprotokoll von Anthropic; ermöglicht es LLMs, externe Tools und Datenquellen sicher aufzurufen.
- **Cordis-Bundle**: Das Plugin-Format von DSH; dieses Projekt kann standalone als MCP-Dienst laufen oder als Hub-Modus in DSH Web installiert werden.
- **tier**: Fähigkeitsstufe — welcher Slot aus DSHs konfiguriertem Modell-Roster einem Worker zugewiesen wird. `flash` ist schnell und günstig (einfache Aufgaben), `pro` denkt intensiver nach (komplexe Probleme). Derzeit sind sie DeepSeek V4 Flash und V4 Pro zugeordnet; Modelle in DSH austauschen, und hier ändert sich nichts.
- **worker**: Der DSH-Agent, der die Arbeit erledigt — eine vollständige Sitzung mit eigenen Tools, eigener Sandbox und eigenem Preset, kein bloßer Modellaufruf.
- **effort**: Reasoning-Stärke, `off` = kein Reasoning, `high` = hoher Reasoning-Einsatz, `max` = maximaler Reasoning-Einsatz.

## Claude Code

### Installation

Ein-Klick-Installation (eine Option wählen):

- **DSH-Einstellungsseite** (wenn der Hub-Modus installiert ist): Settings → DSH Crew → „Install to Claude Code"
- **Kommandozeile**: `node src/install/cli.mjs all`

Beide bewirken dasselbe: lokalen Marketplace registrieren (übergeordnetes Verzeichnis `dsh-plugins/` als Marketplace-Root) + `claude plugin install` + MCP-Tool-Berechtigungs-Allowlist + Konfiguration des claude-hud-Worker-Status-Segments (automatisches Backup von settings.json vor Änderungen, idempotent). **Starten Sie die Sitzung nach der Installation neu, damit die Änderungen wirksam werden.**

### Verwendung

- Sagen Sie direkt in der Konversation „dispatch X to ds-flash" oder „dispatch X to ds-pro", und der Subagent führt die Aufgabe aus
- Dispatch-Anzahl und Echtzeit-Fortschritt werden in der Task-UI von Claude Code angezeigt
- **HUD-Statuszeilen-Segment**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (aktueller Tier / verstrichene Zeit / Token-Verbrauch / Abschlusszähler)
  - Für die lokale Entwicklung können `statusline/statusline.sh` oder `statusline/worker-segment.sh` unabhängig integriert werden
- **Langlaufende Aufgaben**: CC hat Timeout-Limits für MCP-Aufrufe (`MCP_TOOL_TIMEOUT` anpassbar); bei langen Aufgaben kann der Orchestrator `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)`-Polling verwenden
- **Lokale Entwicklung und Debugging**: `claude --plugin-dir /path/to/dsh-crew` zum temporären Laden


### Sitzungsbefehle

Sie überschreiben die globalen Vorgaben nur für die aktuelle Sitzung und werden auf Tool-Ebene durchgesetzt, nicht per Prompt:

| Befehl | Wirkung |
|---|---|
| `/dsh-crew:config` | Vorgaben der Sitzung anzeigen oder setzen: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<Sekunden>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Dispatch für diese Sitzung ein- oder ausschalten (aus ist ein harter Schalter: das Tool verweigert) |
| `/dsh-crew:status` | Live-Status der Worker-Jobs: Tier, Fortschritt, Tokens, aktuelles Tool |

## Codex

### Installation

Empfohlen wird die Verwendung des Installers (rendert Pfade für diese Maschine automatisch, kopiert die Befehle `/dsh-config` und `/dsh-status`):

```bash
node src/install/cli.mjs codex
```

Oder manuell kopieren (erfordert nach dem Kopieren eine manuelle Pfadanpassung):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

Die Rollendateien sind vorkonfiguriert mit:

- MCP-Server-Mounting-Konfiguration
- `default_tools_approval_mode = "approve"` (**erforderlich**, andernfalls werden Tool-Aufrufe im Exec-Modus automatisch abgebrochen)
- `tool_timeout_sec = 3600`

**Hinweis**: Beim manuellen Kopieren müssen die absoluten Pfade im Feld `args` an den tatsächlichen Installationsort angepasst werden; der Installer übernimmt dies automatisch.

### Verwendung

- Wählen Sie in der interaktiven TUI „spawn ds-pro to ...", um Aufgaben zu verteilen; die Active/Done-Panels zeigen den Fortschritt
- Der `codex exec`-Modus kann `dsh_run_worker` auch direkt aufrufen


### Sitzungsbefehle

Für Codex werden dieselben zwei Prompts installiert:

| Befehl | Wirkung |
|---|---|
| `/dsh-config` | Vorgaben der Sitzung anzeigen oder setzen: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<Sekunden>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Live-Status der Worker-Jobs: Tier, Fortschritt, Tokens, aktuelles Tool |

## MCP-Tools

| Tool | Beschreibung |
|---|---|
| `dsh_run_worker` | Synchroner Task-Dispatch (`tier`: flash/pro, `effort`: off/high/max, `cwd`), wartet auf das Ergebnis |
| `dsh_spawn_worker` | Asynchroner Task-Dispatch, gibt die Job-ID zurück (für paralleles Fan-out) |
| `dsh_worker_status` | Fragt den Echtzeit-Fortschritt aller Jobs ab (Turn/Schritt/aktuelles Tool/Token) |
| `dsh_worker_result` | Holt das Ergebnis, kann mit `wait_seconds` warten |
| `dsh_worker_cancel` | Bricht den angegebenen Job ab und beendet seinen Runtime-Prozess |

Der Fortschritt wird gleichzeitig nach `~/.config/dsh-crew/status.d/` gespiegelt (eine Shard-Datei pro Writer, lesbar für Statusline / externes Monitoring).

## Multimodal: Vision und Bildgenerierung

**DeepSeek ist ein reines Textmodell** und unterstützt weder Bildeingabe noch -generierung. Dieses Plugin bezieht diese Fähigkeiten extern über MCP-Tools:

| Tool | Beschreibung |
|---|---|
| `describe_image` | Beantwortet Fragen durch das Betrachten von Bildern (Screenshots, Designs, Diagramme usw.), Ergebnisse werden nach Provider + Modell + Bild + Frage zwischengespeichert |
| `generate_image` | Erzeugt ein Bild aus einer Textbeschreibung und speichert es unter einem angegebenen absoluten Pfad; die Ausgabe ist eine flache Bitmap (Ebenenbearbeitung erfordert OpenPencil) |

**Bildeinfügen in Sitzungen**: Wechseln Sie in DSH das Modell auf `DeepSeek (vision) ◉`, um Bilder direkt einzufügen. Bilder bleiben in der Sitzung und werden normal angezeigt; das Plugin hängt transkribierten Text dahinter an und entfernt die Bilder vor dem Senden — Sie sehen das Bild, das Modell liest den Text.

### Konfiguration

In der **DSH-Einstellungsseite → DSH Crew → Multimodal** (oder bearbeiten Sie direkt `~/.config/dsh-crew/config.json`):

**Vision-Provider** (Bildbetrachtung):

- `claude-code` (Standard, verwendet Haiku, kostengünstig)
- `codex` (verwendet GPT, konkretes Modell wählbar)
- `grok` (verwendet Grok)
- `agy` (Antigravity)
- `custom` (OpenAI-kompatible API oder lokaler Befehl)
- `off` (deaktiviert)

**Bildgenerierungs-Provider** (Bildgenerierung):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI-kompatible API oder lokaler Befehl)
- `off` (deaktiviert)

### Benutzerdefinierter Provider

Zwei Integrationsmethoden:

**API**: Jeder OpenAI-kompatible Endpoint
- Base URL, API-Schlüssel und Modellliste ausfüllen
- Vision verwendet `/chat/completions` mit inline eingebetteten Base64-Bildern
- Bildgenerierung verwendet `/images/generations`
- **Das „Bildgenerierungsmodell" muss angegeben werden, um Generierungsfähigkeit zu erhalten**, andernfalls erscheint der Provider nur in der Vision-Auswahl

**CLI**: Lokale Befehlsvorlage, Platzhalter werden durch sichere Referenzen ersetzt
- Vision: `{image} {question} {model}` → stdout als Antwort
- Bildgenerierung: `{prompt} {output} {size}` → der Befehl muss die Datei nach `{output}` schreiben
- Mindestens einen Befehl ausfüllen; je nachdem, welcher ausgefüllt ist, ergibt sich die Fähigkeit

**Konnektivitätstest**: Jeder benutzerdefinierte Provider hat eine Test-Schaltfläche
- API: Erreichbarkeit des Endpoints und Auth prüfen, echte Vision-Anfrage zur Verifizierung senden
- CLI: Ausführbare Datei prüfen, echten Befehl zur Verifizierung ausführen
- Bildgenerierung: Nur die Konfiguration validieren, keine tatsächliche Bildausgabe

**Entliehene Abo-CLIs** (claude / codex / grok / agy) erfordern eine lokale Anmeldung; das Plugin umgeht deren Berechtigungen nicht für Sie.

## Hub-Modus

Dieses Paket ist auch ein gültiges DSH-Bundle (`dsh.bundle` + `cordis.patch.yml`). Nach der Installation in ein DSH-Web-Profil mit `dsh plugin add dsh-crew`:

- **Worker-Sitzungen werden First-Class-Bürger**: laufen als First-Class-Sitzungen im DSH-Host (`agents.create` + Modell-/Effort-Wasserfall pro Sitzung + Standard-Preset), erscheinen in der Sitzungsliste der Web-UI und können jederzeit geöffnet werden, um die vollständige Ausführung einzusehen
- **Nach Arbeitsverzeichnis organisieren**: Worker-Sitzungen nach cwd in der Web-UI verwalten
- **Loopback-API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: Tasks starten, auflisten, Ergebnisse per Long-Poll abrufen, abbrechen
  - `GET /_dsh/dsh-crew/ping`: Health-Check (der MCP-Shim nutzt dies, um zu erkennen, ob der Hub läuft)
  - `POST /_dsh/dsh-crew/install`: Ein-Klick-Installation der Claude-Code-/Codex-Integration (Backend von `src/install/`)
- **Auto-Erkennung**: Der MCP-Shim von CC/Codex erkennt den Hub automatisch (Env-Var `DSH_CREW_HUB`, Standard `http://127.0.0.1:3080`)
  - DSH Web läuft → Jobs wechseln in den Hub-Modus (`mode: "hub"`)
  - Läuft nicht → Fallback auf die Standalone-Runtime

## Lösungsauswahl und Einschränkungen

### Reguläre Abonnenten → Shell-Subagent-Ansatz (empfohlen)

- **Aktueller Stand**: Die Subagent-Shell von Claude Code verwendet Haiku als Vermittler; jeder Dispatch fügt Hunderte bis Tausende Token hinzu
- **Kompromiss**: Eine kleine Menge Anthropic-Token im Austausch für native Task-UI, Echtzeit-Fortschrittsanzeige und keine zusätzliche Konfiguration
- **Empfehlung**: Wenn Sie bereits Claude Pro abonniert haben oder Claude Code verwenden, nutzen Sie diesen Ansatz — bequem und transparent

### Pay-as-you-go- / CI-Umgebungen → direkter Router-Ansatz

- **Aktueller Stand**: Das Subagent-Frontmatter von Claude Code unterstützt keine direkte Verbindung zu Drittanbieter-Modellen; das Router-Experiment dieses Repos im Scratchpad erfordert API-Key-Credentials für Claude Code, aber Abo-OAuth wird upstream von Anthropic mit 403 blockiert
- **Empfehlung**:
  - Wer API-Key-Credentials (kein OAuth) verwendet und Anthropic-Token sparen möchte, kann einen lokalen Router für eine direkte DeepSeek-Verbindung betreiben
  - CI-Umgebungen verwenden typischerweise ebenfalls API-Schlüssel; dieser Ansatz ist wirtschaftlicher (ausschließlich DeepSeek-Token)
  - Erfordert eigene Tests der Router-Integration (nicht offiziell unterstützt)

### DSH Web läuft → Hub-Modus automatisch aktiviert

- **Aktueller Stand**: Ist `dsh plugin add dsh-crew` in ein DSH-Web-Profil installiert, laufen Jobs als First-Class-Sitzungen im Host und erscheinen in der Sitzungsliste der Web-UI
- **Empfehlung**: Bei lokalen Entwicklungsiterationen wird empfohlen, den Hub-Modus zu aktivieren; der Worker-Fortschritt lässt sich vollständig in der Web-UI beobachten; für maschinenübergreifende Zusammenarbeit oder Umgebungen ohne Web-UI den Shell-Ansatz von Claude Code / Codex verwenden

### Bekannte Punkte

- Die Codex-Rolle kann theoretisch `model_provider` direkt auf DeepSeek zeigen lassen (unverifiziert); diese Brücke hängt nicht davon ab
- Die Ausgabe der Bildgenerierung ist eine flache Bitmap; Ebenenbearbeitung erfordert OpenPencil
- **Runtime-Abhängigkeiten**: Nur `@modelcontextprotocol/sdk` und `zod`; `@deepseek-ai/*` sind Host-Runtime (vom DSH-Host bereitgestellt; eine normale npm-Installation zieht sie nie)
- **Codex muss konfigurieren**: `default_tools_approval_mode = "approve"`, andernfalls werden Tool-Aufrufe automatisch abgebrochen

## Entwicklung

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Runtime-Abhängigkeiten sind nur `@modelcontextprotocol/sdk` und `zod`; jedes `@deepseek-ai/*`-Paket ist eine Peer-Abhängigkeit, die vom DSH-Host bereitgestellt wird, wodurch das Plugin im einzigen Modul-Realm des Hosts bleibt.

## Ökosystem

- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — ein lebender iOS-Simulator — und ein iPhone per USB — in der Konversation
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — Langzeitgedächtnis für DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — `.op`-Designdokumente innerhalb einer Konversation inspizieren und bearbeiten

## Lizenz

MIT
