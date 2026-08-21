<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong><a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> プラグイン: Claude Code / Codex から DSH エージェントへ作業をディスパッチします。ホスト本来の subagent UI はそのままです。</strong><br />
  <sub>ネイティブ進捗 UI &bull; tier ポリシー &amp; エスカレーション &bull; ホスト内 DSH セッション &bull; ビジョン &amp; 画像生成 &bull; ワンクリックインストール</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; 現行プラグインリリース: <code>0.1.0-rc.4</code> &middot; 動作確認済み DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md"><b>日本語</b></a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew 設定ページ" width="100%" />
</p>
<p align="center"><sub>DSH Crew 設定ページ — ホスト連携、ディスパッチポリシー、実行、マルチモーダルブリッジ</sub></p>

## DSH Crew を使う理由

DSH Crew は、オープンソースのエージェントハーネスである [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) のプラグインです。Claude Code と Codex から DSH エージェントをディスパッチできるようにします。orchestrator は自身のモデルを維持したまま、作業は DSH 本来のツール・サンドボックス・プリセット・セッション履歴を持つ本物の DSH エージェント上で実行され、ホスト側ではライブ進捗付きのネイティブ subagent として表示され続けます。

作業を実行するのは DSH エージェントであり、単なるモデル呼び出しではありません。tier (`flash` / `pro`) によって、そのエージェントがハーネスに設定されたモデルロースターからどれだけの能力を得るかが決まります — 現在は DeepSeek V4 Flash と V4 Pro — そのため DSH 側でモデルを変更しても、ここでの変更は不要です。

<table>
<tr>
<td width="50%">

### 🧵 ネイティブ進捗 UI

worker は Claude Code / Codex 上で通常の subagent として表示され、ディスパッチ数・実行中ステップ・ツール呼び出し・トークン使用量がすべてホスト自身のタスクパネルに表示されます。さらに claude-hud の statusline セグメント: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`。

</td>
<td width="50%">

### 🎚️ tier ポリシーとエスカレーション

機械的な作業には `flash`、推論を要する作業には `pro`、`effort` は `off` から `max` まで。`tier_policy` はツール層ですべてのディスパッチを単一の tier に固定でき、`escalate_on_failure` は失敗した flash 実行を pro で一度だけリトライします — 事前の難易度推測ではなく、実績に基づいて。

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ ホスト内 DSH セッション

bundle を DSH プロファイルにインストールすると、各 worker は第一級の DSH セッションになります。Web UI に表示され、作業ディレクトリごとにグループ化され、tier ごとに選択した Agent プリセットでマウントされます。DSH が起動していない場合、ディスパッチは standalone DSH ランタイムにフォールバックするため、CI やヘッドレス環境でも動作します。

</td>
<td width="50%">

### 👁️ ビジョンと画像生成

DSH のモデルはテキストのみです。`describe_image` と `generate_image` は、すでにお持ちの CLI — Claude、Codex、Grok、Antigravity — または設定した任意の OpenAI 互換 API の目と筆を借ります。貼り付けた画像は会話内で表示されたまま、テキストとしてモデルに渡されます。

</td>
</tr>
<tr>
<td width="50%">

### 🔌 カスタムプロバイダー

独自のエンドポイント (Base URL + API キー + モデル) またはローカルコマンドテンプレートを利用できます。各プロバイダーには接続テストがあり、到達性と認証をチェックしたうえで実際のビジョン呼び出しを 1 回行うため、問題はタスクの途中ではなくいま判明します。

</td>
<td width="50%">

### 📦 ワンクリックインストール

設定ページから Claude Code プラグインと Codex ロールファイルをインストール・更新できます — marketplace 登録、権限許可リスト、HUD 配線、このマシン向けに展開された絶対パス — そして同じくらい簡単に復元できます。すべての設定ファイルは変更前にバックアップされます。

</td>
</tr>
</table>

## 動作の仕組み

```
Claude Code / Codex (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## 1 回の実行、2 つの視点

ディスパッチは横に広がります。下の例では 18 個の worker がこの README を並行翻訳しています。ホストはそれらを自身のサブエージェントとして数え、harness は実際のセッションとして実行します。

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code から見ると、dsh-crew の worker はネイティブなサブエージェントです。statusline セグメントが実行中の tier・経過時間・トークンを表示します。</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>DSH Crew パネルから見た同じ実行: どのホストが各ジョブをディスパッチしたか、tier と effort、進捗とトークン使用量。</sub></p>

## インストール

npm から DSH プロファイルへインストール:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

ソースツリーからローカル開発する場合:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

`link:` プロトコルはプロファイルの依存をこのリポジトリへシンボリックリンクするため、再ビルドが即座に反映されます。

### DeepSeek の認証情報を設定（スタンドアロン専用）

hub モード — 上記のインストール — では、worker は DSH インスタンス内で実行され、すでに設定されている DSH の DeepSeek 認証情報を使用します。追加の設定は不要です。

スタンドアロン フォールバックのみが独自のキーを必要とします。DSH インスタンスが実行されていない状態で Claude Code / Codex からディスパッチすると、worker ランタイムが個別のプロセスとして起動します。[platform.deepseek.com](https://platform.deepseek.com) から API キーを取得し、`~/.config/dsh-crew/.env` に書きます:

```
DEEPSEEK_API_KEY=sk-...
```

### 動作確認

```bash
node scripts/smoke.mjs
```

smoke テストは利用可能なパスを通じて 1 つの安い job をディスパッチします — DSH インスタンスが実行されているときは hub、それ以外は standalone — そして使用したパスを表示します。十数秒で `smoke test passed — configuration OK` が表示されるはずです。失敗時は理由が表示され、テストされたパスに限定されます。

その後、設定 → DSH Crew から Claude Code / Codex 連携をワンクリックで導入します。

## 背景と用語

- **DSH** (DeepSeek Harness): DeepSeek のオープンソースエージェントハーネス。Web UI 形式のコードエージェントで、Claude Code に似ていますが DeepSeek モデルを駆動します。
- **MCP** (Model Context Protocol): Anthropic の AI ツール連携プロトコル。LLM が外部ツールやデータソースを安全に呼び出せるようにします。
- **Cordis bundle**: DSH のプラグインフォーマット。このプロジェクトは standalone で MCP サービスとして実行することも、DSH Web に hub モードとしてインストールすることもできます。
- **tier**: 能力 tier — worker が DSH に設定されたモデルロースターのどのスロットを得るか。`flash` は高速・低コスト (単純なタスク)、`pro` はより深く推論します (複雑な問題)。現在はそれぞれ DeepSeek V4 Flash と V4 Pro に対応。DSH 側でモデルを入れ替えても、ここでの変更は不要です。
- **worker**: 作業を行う DSH エージェント — 独自のツール・サンドボックス・プリセットを持つ完全なセッションであり、単なるモデル呼び出しではありません。
- **effort**: 推論の強度。`off` = 推論なし、`high` = 高い推論投入、`max` = 最大の推論投入。

## Claude Code

### インストール

ワンクリックインストール (いずれかを選択):

- **DSH 設定ページ** (hub モード導入時): 設定 → DSH Crew → "Install to Claude Code"
- **コマンドライン**: `node src/install/cli.mjs all`

どちらも同じことを行います: ローカル marketplace の登録 (親ディレクトリ `dsh-plugins/` を marketplace ルートとして使用) + `claude plugin install` + MCP ツール権限許可リスト + claude-hud worker ステータスセグメント設定 (変更前に settings.json を自動バックアップ、冪等)。**変更を反映するには、インストール後にセッションを再起動してください。**

### 使い方

- 会話内で直接「dispatch X to ds-flash」または「dispatch X to ds-pro」と伝えると、subagent がタスクを実行します
- ディスパッチ数とリアルタイム進捗が Claude Code のタスク UI に表示されます
- **HUD ステータスラインセグメント**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (現在の tier / 経過時間 / トークン使用量 / 完了数)
  - ローカル開発では、`statusline/statusline.sh` または `statusline/worker-segment.sh` を単独で組み込むこともできます
- **長時間実行タスク**: CC には MCP 呼び出しのタイムアウト制限があります (`MCP_TOOL_TIMEOUT` で調整可能)。長時間のタスクでは、orchestrator が `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` のポーリングを使用できます
- **ローカル開発とデバッグ**: `claude --plugin-dir /path/to/dsh-crew` で一時的にロードできます


### セッションコマンド

現在のセッションのみグローバル既定値を上書きします。プロンプト任せではなくツール層で強制されます:

| コマンド | 動作 |
|---|---|
| `/dsh-crew:config` | このセッションの既定値を表示・設定: `tier=flash\|pro`、`effort=off\|high\|max`、`mode=auto\|hub\|standalone`、`timeout=<秒>`、`policy=auto\|flash-only\|pro-only`、`escalate=true\|false`、`reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | このセッションのディスパッチを有効／無効にする（無効はハードスイッチでツールが拒否） |
| `/dsh-crew:status` | worker ジョブの実況: tier、進捗、トークン、実行中のツール |

## Codex

### インストール

インストーラーの使用を推奨します (このマシン向けにパスを自動展開し、`/dsh-config`、`/dsh-status` コマンドをコピーします):

```bash
node src/install/cli.mjs codex
```

または手動コピー (コピー後にパスの手動修正が必要):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

ロールファイルには以下が事前設定されています:

- MCP サーバーマウント設定
- `default_tools_approval_mode = "approve"` (**必須**。これがないと exec モードでツール呼び出しが自動キャンセルされます)
- `tool_timeout_sec = 3600`

**注意**: 手動コピーの場合、`args` フィールドの絶対パスを実際のインストール先に合わせて更新する必要があります。インストーラーはこれを自動で処理します。

### 使い方

- 対話型 TUI で「spawn ds-pro to ...」を選択してタスクをディスパッチします。Active/Done パネルに進捗が表示されます
- `codex exec` モードでも `dsh_run_worker` を直接呼び出せます


### セッションコマンド

Codex 側にも同じ 2 つのプロンプトが入ります:

| コマンド | 動作 |
|---|---|
| `/dsh-config` | このセッションの既定値を表示・設定: `tier=flash\|pro`、`effort=off\|high\|max`、`mode=auto\|hub\|standalone`、`timeout=<秒>`、`policy=auto\|flash-only\|pro-only`、`escalate=true\|false`、`reset` |
| `/dsh-status` | worker ジョブの実況: tier、進捗、トークン、実行中のツール |

## MCP ツール

| ツール | 説明 |
|---|---|
| `dsh_run_worker` | 同期タスクディスパッチ (`tier`: flash/pro、`effort`: off/high/max、`cwd`)。結果を待機します |
| `dsh_spawn_worker` | 非同期タスクディスパッチ。ジョブ id を返します (並列 fan-out 用) |
| `dsh_worker_status` | 全ジョブのリアルタイム進捗を照会 (turn/step/現在のツール/トークン) |
| `dsh_worker_result` | 結果を取得。`wait_seconds` を指定して待機できます |
| `dsh_worker_cancel` | 指定したジョブをキャンセルし、そのランタイムプロセスを終了します |

進捗は同時に `~/.config/dsh-crew/status.d/` へミラーリングされます (ライターごとに 1 つのシャードファイル。statusline / 外部監視から読み取れます)。

## マルチモーダル: ビジョンと画像生成

**DeepSeek はテキストのみのモデルであり**、画像入力や生成には対応していません。このプラグインはこれらの能力を MCP ツール経由で外部から調達します:

| ツール | 説明 |
|---|---|
| `describe_image` | 画像 (スクリーンショット、デザイン、図表など) を見て質問に回答します。結果はプロバイダー + モデル + 画像 + 質問の組み合わせでキャッシュされます |
| `generate_image` | テキスト説明から画像を生成し、指定した絶対パスに保存します。出力はフラットなビットマップです (レイヤー編集には OpenPencil が必要) |

**セッションへの画像貼り付け**: DSH でモデルを `DeepSeek (vision) ◉` に切り替えると、画像を直接貼り付けられます。画像はセッション内に残り、通常どおり表示されます。プラグインは画像の後に書き起こしテキストを追記し、送信前に画像を除去します — あなたには画像が見え、モデルにはテキストが読まれます。

### 設定

**DSH 設定ページ → DSH Crew → Multimodal** (または `~/.config/dsh-crew/config.json` を直接編集):

**ビジョンプロバイダー** (画像閲覧):

- `claude-code` (デフォルト。haiku を使用し、低コスト)
- `codex` (GPT を使用。特定のモデルを指定可能)
- `grok` (Grok を使用)
- `agy` (Antigravity)
- `custom` (OpenAI 互換 API またはローカルコマンド)
- `off` (無効)

**画像生成プロバイダー** (画像生成):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI 互換 API またはローカルコマンド)
- `off` (無効)

### カスタムプロバイダー

連携方法は 2 種類です:

**API**: 任意の OpenAI 互換エンドポイント
- Base URL、API キー、モデルリストを入力します
- ビジョンはインライン base64 画像付きで `/chat/completions` を使用します
- 画像生成は `/images/generations` を使用します
- 生成機能を使うには**「画像生成モデル」の指定が必須です**。指定しない場合、プロバイダーはビジョンの選択肢にのみ表示されます

**CLI**: ローカルコマンドテンプレート。プレースホルダーは安全な参照に置換されます
- ビジョン: `{image} {question} {model}` → stdout が回答になります
- 画像生成: `{prompt} {output} {size}` → コマンドは `{output}` にファイルを書き込む必要があります
- 少なくとも 1 つのコマンドを入力してください。入力されたコマンドによって能力が決まります

**接続テスト**: 各カスタムプロバイダーにはテストボタンがあります
- API: エンドポイントの到達性と認証を確認し、実際のビジョンリクエストを送信して検証します
- CLI: 実行可能ファイルを確認し、実際のコマンドを実行して検証します
- 画像生成: 設定の検証のみで、実際の画像出力は行いません

**借りるサブスクリプション CLI** (claude / codex / grok / agy) はローカルでのログインが必要です。プラグインがそれらの権限を代わりに突破することはありません。

## Hub モード

このパッケージは有効な DSH bundle (`dsh.bundle` + `cordis.patch.yml`) でもあります。`dsh plugin add dsh-crew` で DSH Web プロファイルにインストールすると:

- **worker セッションが第一級市民になります**: DSH ホスト内で第一級セッションとして実行され (`agents.create` + セッションごとの model/effort フォールバック + デフォルトプリセット)、Web UI のセッション一覧に表示され、いつでも開いて実行の全容を確認できます
- **作業ディレクトリごとに整理**: Web UI で worker セッションを cwd ごとに管理できます
- **ループバック API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: タスクの起動、一覧、結果のロングポーリング、キャンセル
  - `GET /_dsh/dsh-crew/ping`: ヘルスチェック (MCP shim が hub の稼働検知に使用)
  - `POST /_dsh/dsh-crew/install`: Claude Code / Codex 連携のワンクリックインストール (`src/install/` のバックエンド)
- **自動検出**: CC/Codex の MCP shim が hub を自動検出します (`DSH_CREW_HUB` 環境変数、デフォルト `http://127.0.0.1:3080`)
  - DSH Web が稼働中 → ジョブは hub モードで実行されます (`mode: "hub"`)
  - 未稼働 → standalone ランタイムにフォールバックします

## 方式の選択と制限事項

### 通常のサブスクリプション利用者 → shell subagent 方式 (推奨)

- **現状**: Claude Code の subagent シェルは中継に haiku を使用するため、ディスパッチごとに数百〜数千トークンが加算されます
- **トレードオフ**: 少量の Anthropic トークンと引き換えに、ネイティブのタスク UI、リアルタイム進捗表示、追加設定不要が得られます
- **推奨**: すでに Claude Pro を契約しているか Claude Code を使用しているなら、この方式が便利で透過的です

### 従量課金 / CI 環境 → ダイレクトルーター方式

- **現状**: Claude Code の subagent frontmatter はサードパーティモデルへの直接接続をサポートしていません。このリポジトリの scratchpad にあるルーター実験では Claude Code の API キー資格情報が必要ですが、サブスクリプション OAuth は Anthropic により上流で 403 でブロックされます
- **推奨**:
  - API キー資格情報 (OAuth ではない) を使用しており、Anthropic トークンを節約したい場合は、ローカルルーターを実行して DeepSeek へ直接接続できます
  - CI 環境も通常は API キーを使用するため、この方式はより経済的です (すべて DeepSeek トークン)
  - ルーター連携の自己検証が必要です (公式サポート対象外)

### DSH Web 稼働中 → hub モードが自動有効

- **現状**: `dsh plugin add dsh-crew` で DSH Web プロファイルにインストール済みであれば、ジョブはホスト内で第一級セッションとして実行され、Web UI のセッション一覧に表示されます
- **推奨**: ローカル開発の反復中は hub モードの有効化を推奨します。worker の進捗を Web UI で完全に観察できます。マシン間の共同作業や Web UI のない環境では、Claude Code / Codex のシェル方式を使用してください

### 既知の事項

- Codex ロールは理論上、DeepSeek を直接指す `model_provider` を試せます (未検証)。このブリッジはそれに依存しません
- 画像生成の出力はフラットなビットマップです。レイヤー編集には OpenPencil が必要です
- **ランタイム依存**: `@modelcontextprotocol/sdk` と `zod` のみ。`@deepseek-ai/*` はホストランタイムです (DSH ホストが提供。通常の npm インストールが取得することはありません)
- **Codex の必須設定**: `default_tools_approval_mode = "approve"`。これがないとツール呼び出しが自動キャンセルされます

## 開発

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

ランタイム依存は `@modelcontextprotocol/sdk` と `zod` のみです。すべての `@deepseek-ai/*` パッケージは DSH ホストが提供するホストランタイムであり（package.json の dshHostRuntime フィールドに記載され、peerDependencies には含まれないため、通常の npm インストールが取得することはありません）、プラグインはホストの単一モジュールレルム内に留まります。

## エコシステム

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — 会話の中で動く Android エミュレータや USB 接続の実機を、すべて adb 経由で操作
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — 会話の中で動く iOS シミュレータと USB 接続の実機
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH の長期記憶
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — 会話内で `.op` デザインドキュメントを検査・編集

## ライセンス

MIT
