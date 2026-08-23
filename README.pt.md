<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Um plugin do <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>: envie trabalho para agentes DSH a partir do Claude Code / Codex / Antigravity / Grok, sem abrir mão da UI nativa de subagent do host.</strong><br />
  <sub>UI de progresso nativa &bull; Política de Tier &amp; Escalonamento &bull; Proteções de Despacho &bull; Quadro de Jobs &bull; Sessões DSH no Host &bull; Visão &amp; Geração de Imagens (Native-First) &bull; Instalação em Um Clique</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Versão atual do plugin: <code>0.1.0-rc.4</code> &middot; Testado com DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md"><b>Português</b></a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="Licença" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — página de configurações" width="100%" />
</p>
<p align="center"><sub>A página de configurações do DSH Crew — integrações do host, política de despacho, execução e a ponte multimodal</sub></p>

## Por que DSH Crew

O DSH Crew é um plugin para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — um harness de agente open-source. Ele torna os agentes DSH despacháveis a partir do Claude Code, Codex, Antigravity e Grok: o orchestrator mantém seu próprio modelo, o trabalho é executado em um agente DSH real com as ferramentas, o sandbox, os presets e o histórico de sessão desse harness, e o host continua exibindo-o como um subagent nativo com progresso ao vivo.

O que executa o trabalho é um agente DSH, não uma chamada de modelo pura. Os tiers (`flash` / `pro`) selecionam quanta capacidade esse agente recebe do roster configurado do harness — DeepSeek V4 Flash e V4 Pro hoje — portanto, uma mudança de modelo no DSH não exige mudança aqui.

<table>
<tr>
<td width="50%">

### 🧵 UI de Progresso Nativa

Workers aparecem como subagents regulares no Claude Code / Codex / Antigravity / Grok — contagem de despachos, etapa em execução, chamadas de ferramenta e uso de tokens aparecem no painel de tarefas do próprio host, além de um segmento de statusline do claude-hud: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Política de Tier e Escalonamento

`flash` para trabalho mecânico, `pro` para raciocínio, `effort` de `off` a `max`. O `tier_policy` pode fixar cada despacho em um único tier na camada de ferramenta, e o `escalate_on_failure` tenta novamente uma execução flash com falha uma vez no pro — com base em evidências, não em adivinhar a dificuldade antecipadamente.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ Sessões DSH no Host

Com o bundle instalado em um perfil DSH, cada worker é uma sessão DSH de primeira classe: visível na Web UI, agrupada por diretório de trabalho e montada com o preset de Agent que você escolhe por tier. Sem o DSH em execução, o despacho volta para um runtime DSH standalone, então ambientes CI e headless continuam funcionando.

</td>
<td width="50%">

### 👁️ Visão e Geração de Imagens

Os modelos do DSH são somente texto. `describe_image` agora prefere o modelo VL da própria DeepSeek (`deepseek-v4-flash-vision-exp`) sempre que uma key estiver disponível, e depois recorre às CLIs que você já tem — Claude, Codex, Grok, Antigravity — ou qualquer API compatível com OpenAI que você configurar. `generate_image` usa o pincel das mesmas CLIs. Imagens coladas permanecem visíveis na conversa e chegam ao modelo como texto.

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ Proteções de Despacho

Todo despacho é verificado antes de qualquer coisa ser iniciada. O aninhamento worker→worker é limitado à profundidade 3 da cadeia de origem e ciclos são recusados; um segundo worker em um workspace que outro job já detém é recusado com as informações do detentor — nunca enfileirado silenciosamente. Recusas são erros legíveis: espere ou ajuste o escopo; não contorne.

</td>
<td width="50%">

### 📋 Quadro de Jobs

O painel do DSH Crew também funciona como um quadro de jobs: cada job de worker — em execução ou concluído — é listado com tier, effort, progresso ao vivo e tokens; workspaces ocupados mostram seus detentores; e um job que desaparece no meio da execução (por exemplo, um restart do hub) aparece como um fantasma órfão em vez de desaparecer silenciosamente.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Provedores Personalizados

Traga seu próprio endpoint (Base URL + API Key + modelos) ou um modelo de comando local. Cada provedor tem um teste de conectividade que verifica alcance e autenticação e depois faz uma chamada real de visão, para você descobrir agora, não no meio da tarefa.

</td>
<td width="50%">

### 📦 Instalação em Um Clique

A página de configurações instala e atualiza o plugin do Claude Code, os arquivos de role do Codex e os agents, skills e comandos do Antigravity / Grok para você — registro no marketplace, allowlist de permissões, integração com HUD, caminhos absolutos renderizados para esta máquina — e também os restaura facilmente. Todos os arquivos de configuração têm backup antes de qualquer alteração.

</td>
</tr>
</table>

## Como funciona

```
Claude Code / Codex / Antigravity / Grok (orchestrator, mantém o próprio modelo)
  └─ ds-flash / ds-pro  ← shell de subagent nativo (o progresso aparece na UI de tarefas do host)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → essa CLI externa executa a tarefa (opt-in explícito)
            ├─ hub acessível → sessão dentro do DSH (visível na Web UI, agrupada por cwd)
            └─ caso contrário → runtime dsh-jsonrpc-agent (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progresso e estatísticas de tokens)
```

## Uma execução, duas visões

O despacho se espalha. Abaixo, dezoito workers traduzem este README em paralelo: o host os conta como seus próprios subagents, enquanto o harness os executa como sessões reais.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>No Claude Code, os workers do dsh-crew são subagents nativos; o segmento da statusline acompanha os tiers em execução, o tempo decorrido e os tokens.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>O painel do DSH Crew mostra a mesma execução pelo lado do harness: qual host despachou cada job, seu tier e effort, o progresso ao vivo e o uso de tokens.</sub></p>

<p align="center"><sub>O painel também é o quadro de jobs: jobs em execução e concluídos permanecem listados com tier, progresso e tokens, workspaces ocupados nomeiam seus detentores, e um job que desaparece no meio da execução (um restart do hub) aparece como um fantasma órfão em vez de desaparecer silenciosamente.</sub></p>

## Instalação

Instalar do npm em um perfil do DSH:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Ou, para desenvolvimento local a partir do código-fonte:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

O protocolo `link:` cria um symlink da dependência do perfil para este repositório, então cada rebuild aparece imediatamente.

### Configurar credenciais do DeepSeek (apenas standalone)

No modo hub — a instalação anterior — os workers são executados dentro da instância DSH e usam as credenciais do DeepSeek já configuradas. Nada mais para configurar.

Apenas o fallback standalone precisa de sua própria key: despachar de um host sem uma instância DSH em execução inicia um worker runtime como um processo separado. Obtenha uma API key em [platform.deepseek.com](https://platform.deepseek.com) e escreva em `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### Verificar

```bash
node scripts/smoke.mjs
```

O smoke test despacha uma tarefa econômica por qualquer caminho disponível — o hub se uma instância DSH está em execução, caso contrário standalone — e imprime qual foi utilizado. Em cerca de dez segundos você deve ver `smoke test passed — configuration OK`. Em caso de falha o motivo é impresso, limitado ao caminho que foi testado.

Depois abra Configurações → DSH Crew e instale as integrações do host — Claude Code, Codex, Antigravity, Grok — com um clique, ou acione o mesmo instalador pela linha de comando:

```bash
node src/install/cli.mjs claude  # plugin do Claude Code: marketplace + permissões + segmento do HUD
node src/install/cli.mjs codex   # agents + prompts do Codex
node src/install/cli.mjs agy     # config MCP do Antigravity + agents + skills
node src/install/cli.mjs grok    # config MCP do Grok + agents + comandos
node src/install/cli.mjs all     # os quatro hosts de uma vez
# desinstale simetricamente (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

## Contexto e terminologia

- **DSH** (DeepSeek Harness): o harness de agente open-source da DeepSeek, um agente de código na forma de Web UI, semelhante ao Claude Code, mas que utiliza modelos DeepSeek.
- **MCP** (Model Context Protocol): o protocolo de integração de ferramentas de IA da Anthropic, que permite que LLMs chamem ferramentas externas e fontes de dados com segurança.
- **Cordis bundle**: o formato de plugin do DSH; este projeto pode ser executado standalone como um serviço MCP ou instalado no DSH Web como modo hub.
- **tier**: tier de capacidade — qual slot do roster de modelos configurado do DSH um worker recebe. `flash` é rápido e barato (tarefas simples), `pro` raciocina com mais profundidade (problemas complexos). Hoje eles mapeiam para DeepSeek V4 Flash e V4 Pro; troque os modelos no DSH e nada muda aqui.
- **worker**: o agente DSH que executa o trabalho — uma sessão completa com suas próprias ferramentas, sandbox e preset, não uma chamada de modelo pura.
- **effort**: intensidade de raciocínio, `off` = sem raciocínio, `high` = alto investimento de raciocínio, `max` = investimento máximo de raciocínio.

## Claude Code

### Instalação

Instalação em um clique (escolha uma opção):

- **Página de configurações do DSH** (quando o modo hub está instalado): Configurações → DSH Crew → "Install to Claude Code"
- **Linha de comando**: `node src/install/cli.mjs all`

Ambas fazem a mesma coisa: registrar o marketplace local (diretório pai `dsh-plugins/` como raiz do marketplace) + `claude plugin install` + allowlist de permissões das ferramentas MCP + configuração do segmento de status do worker no claude-hud (backup automático do settings.json antes de alterações, idempotente). **Reinicie a sessão após a instalação para que as alterações entrem em vigor.**

### Uso

- Diretamente na conversa, diga "dispatch X to ds-flash" ou "dispatch X to ds-pro", e o subagent executa a tarefa
- A contagem de despachos e o progresso em tempo real aparecem na interface de tarefas do Claude Code
- **Segmento da linha de status do HUD**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (tier atual / tempo decorrido / uso de tokens / contagem de conclusões)
  - Para desenvolvimento local, `statusline/statusline.sh` ou `statusline/worker-segment.sh` podem ser integrados de forma independente
- **Tarefas de longa duração**: o CC tem limites de timeout em chamadas MCP (`MCP_TOOL_TIMEOUT` ajustável); tarefas longas podem fazer o orchestrator usar `dsh_spawn_worker` + polling com `dsh_worker_result(wait_seconds)`
- **Desenvolvimento e depuração locais**: `claude --plugin-dir /path/to/dsh-crew` para carregar temporariamente


### Comandos de sessão

Substituem os padrões globais apenas na sessão atual e são aplicados na camada de ferramentas, não por prompt:

| Comando | O que faz |
|---|---|
| `/dsh-crew:config` | Mostrar ou definir os padrões da sessão: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<segundos>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Ligar ou desligar o despacho nesta sessão (desligado é chave rígida: a ferramenta recusa) |
| `/dsh-crew:status` | Status ao vivo dos jobs de worker: tier, progresso, tokens, ferramenta atual |
| `/dsh-crew:playbook` | Boas práticas de despacho: escolher flash vs pro, briefs autocontidos, paralelismo, verificação de resultados, proteções |

## Codex

### Instalação

Recomenda-se usar o instalador (renderiza automaticamente os caminhos para esta máquina e copia os prompts `/dsh-config`, `/dsh-status` e `/dsh-playbook`):

```bash
node src/install/cli.mjs codex
```

Ou copie manualmente (exige modificação manual dos caminhos após copiar):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

Os arquivos de role já vêm pré-configurados com:

- Configuração de montagem do servidor MCP
- `default_tools_approval_mode = "approve"` (**obrigatório**, caso contrário as chamadas de ferramenta são canceladas automaticamente no modo exec)
- `tool_timeout_sec = 3600`

**Nota**: Ao copiar manualmente, os caminhos absolutos no campo `args` devem ser atualizados para corresponder ao local real da instalação; o instalador faz isso automaticamente.

### Uso

- No TUI interativo, selecione "spawn ds-pro to ..." para despachar tarefas; os painéis Active/Done mostram o progresso
- O modo `codex exec` também pode chamar diretamente `dsh_run_worker`


### Comandos de sessão

Três prompts são instalados para o Codex:

| Comando | O que faz |
|---|---|
| `/dsh-config` | Mostrar ou definir os padrões da sessão: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<segundos>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Status ao vivo dos jobs de worker: tier, progresso, tokens, ferramenta atual |
| `/dsh-playbook` | Boas práticas de despacho: escolher flash vs pro, briefs autocontidos, paralelismo, verificação de resultados, proteções |

## Antigravity (agy)

### Instalação

```bash
node src/install/cli.mjs agy
```

Registra o servidor MCP dsh-crew em `~/.gemini/config/mcp_config.json` e instala os agents `ds-flash` / `ds-pro`, além das skills `dsh-config`, `dsh-status` e `dsh-playbook`, em `~/.gemini/config/` (todos os arquivos têm backup antes). Reinicie a sessão após a instalação.

### Uso

- Escolha `ds-flash` ou `ds-pro` como o agente para despachar tarefas
- `dsh_worker_config` lê ou sobrescreve os padrões da sessão

### Skills de sessão

| Skill | O que faz |
|---|---|
| `/dsh-config` | Mostrar ou definir os padrões da sessão (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | Status ao vivo dos jobs de worker: tier, progresso, tokens, ferramenta atual |
| `/dsh-playbook` | Boas práticas de despacho: escolher flash vs pro, briefs autocontidos, paralelismo, verificação de resultados, proteções |

### Ressalvas

- o agy executa workers com **aprovação total** (`--dangerously-skip-permissions` + accept-edits): o agy 1.1.16 não tem modo de permissão com escopo de workspace, então um worker headless precisa aprovar automaticamente as requisições de ferramentas.

Desinstalar: `node src/install/cli.mjs uninstall-agy`

## Grok

### Instalação

```bash
node src/install/cli.mjs grok
```

Escreve a seção `[mcp_servers.dsh-crew]` em `~/.grok/config.toml` e instala os agents `ds-flash` / `ds-pro`, além dos comandos `/dsh-config`, `/dsh-status` e `/dsh-playbook`, em `~/.grok/` (todos os arquivos têm backup antes).

### Uso

- Escolha `ds-flash` ou `ds-pro` como o agente para despachar tarefas

### Comandos de sessão

| Comando | O que faz |
|---|---|
| `/dsh-config` | Mostrar ou definir os padrões da sessão (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | Status ao vivo dos jobs de worker: tier, progresso, tokens, ferramenta atual |
| `/dsh-playbook` | Boas práticas de despacho: escolher flash vs pro, briefs autocontidos, paralelismo, verificação de resultados, proteções |

### Ressalvas

- Por design de segurança, o grok não inicia servidores MCP no nível do repositório em diretórios de projeto não confiáveis (`grok mcp doctor` reporta "folder untrusted"); uma instalação global não é afetada — mude de diretório ou passe `--trust`.
- Workers do grok rodam com `bypassPermissions` (sempre aprovar, como a documentação do grok recomenda para automação headless); regras de deny e hooks ainda se aplicam.

Desinstalar: `node src/install/cli.mjs uninstall-grok`

## Ferramentas MCP

| Ferramenta | Descrição |
|---|---|
| `dsh_run_worker` | Despacho bloqueante de tarefa (`tier`: flash/pro, `effort`: off/high/max, `cwd`, `worker`), aguarda o resultado |
| `dsh_spawn_worker` | Despacho assíncrono, retorna o id do job (para fan-out paralelo); colete os resultados com `dsh_worker_result` |
| `dsh_worker_status` | Progresso em tempo real de todos os jobs (turn/step/ferramenta atual/token) + bloqueios consultivos de cwd |
| `dsh_worker_result` | Busca o resultado; pode especificar `wait_seconds` para aguardar |
| `dsh_worker_cancel` | Cancela o job especificado e encerra o processo do runtime |
| `dsh_worker_config` | Ler/definir os padrões da sessão (tier, effort, mode, timeout, policy, escalation) e listar `worker_profiles` |

O progresso também é espelhado em `~/.config/dsh-crew/status.d/` (um arquivo shard por escritor, que pode ser lido por statusline / monitoramento externo).

## Proteções de despacho

Todo despacho é verificado antes de qualquer coisa ser iniciada — recusas são erros legíveis, nunca filas silenciosas:

- **Cadeia de origem**: cada despacho acrescenta um salto à cadeia de origem worker→worker. Aninhamento mais profundo que o limite (`origin_depth_limit`, padrão 3) é recusado, assim como qualquer ciclo (o mesmo backend + cwd aparecendo duas vezes) — a proteção que impede a autoamplificação recursiva de workers.
- **Bloqueio consultivo de cwd**: um worker em execução por workspace. Um segundo despacho para um workspace ocupado é recusado com o id do job detentor, o backend e a hora de início — espere ele terminar, cancele-o com `dsh_worker_cancel` ou passe `allow_concurrent_cwd: true` (apenas tarefas de somente leitura).

## Playbook de despacho

Como despachar *bem* — flash vs pro, briefs autocontidos, paralelismo seguro, verificação de resultados e as proteções acima — vem empacotado como um playbook por host: `/dsh-crew:playbook` (skill do Claude Code), `/dsh-playbook` (prompt do Codex, skill do Antigravity, comando do Grok).

## Backends de CLI explícitos

`worker="agy"` / `worker="grok"` fixa um despacho naquela CLI externa (backend × modelo × effort) em vez da lógica de tier do DSH. É opt-in explícito — não há padrão, então defina-o somente quando o usuário pedir por aquela CLI. Ressalvas: o grok se recusa a iniciar servidores MCP locais ao repositório em pastas não confiáveis, e o agy executa workers com aprovação total (sem modo de permissão com escopo de workspace).

## Multimodal: visão e geração de imagens

**DeepSeek é um modelo somente texto** e não suporta entrada ou geração de imagens. Este plugin obtém essas capacidades externamente por meio de ferramentas MCP:

**Visão nativa primeiro**: quando o provedor de visão é uma CLI embutida (ou explicitamente `native`), o `describe_image` tenta primeiro o modelo VL da própria DeepSeek `deepseek-v4-flash-vision-exp` (chamada de API direta; key de `DEEPSEEK_API_KEY` ou `~/.config/dsh-crew/.env`). Qualquer falha degrada graciosamente para a cadeia de provedores de CLI abaixo, que é mantida como fallback. A geração de imagens não é afetada — o modelo nativo apenas olha para imagens.

| Ferramenta | Descrição |
|---|---|
| `describe_image` | Responde perguntas analisando imagens (capturas de tela, designs, gráficos etc.); resultados em cache por provedor + modelo + imagem + pergunta |
| `generate_image` | Gera imagem a partir de uma descrição em texto e salva no caminho absoluto especificado; a saída é um bitmap plano (requer OpenPencil para edição de camadas) |

**Colar imagens na sessão**: No DSH, mude o modelo para `DeepSeek (vision) ◉` para colar imagens diretamente. As imagens permanecem na sessão e são exibidas normalmente; o plugin acrescenta o texto transcrito após elas e remove as imagens antes do envio — você vê a imagem, o modelo lê o texto. A transcrição segue a mesma escada native-first: o modelo VL da DeepSeek quando há key disponível e, em seguida, o provedor de CLI que você configurou.

### Configuração

Na **página de configurações do DSH → DSH Crew → Multimodal** (ou edite diretamente `~/.config/dsh-crew/config.json`):

**Provedor de visão** (visualização de imagens):

- `native` / `deepseek-native` (o modelo VL da própria DeepSeek — tentado primeiro automaticamente para todo provedor embutido sempre que uma key estiver disponível)
- `claude-code` (padrão, usa haiku, barato)
- `codex` (usa GPT, pode especificar um modelo específico)
- `grok` (usa Grok)
- `agy` (Antigravity)
- `custom` (API compatível com OpenAI ou comando local)
- `off` (desativado)

**Provedor de geração de imagens** (geração de imagens):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (API compatível com OpenAI ou comando local)
- `off` (desativado)

### Provedor personalizado

Dois métodos de integração:

**API**: qualquer endpoint compatível com OpenAI
- Preencha Base URL, API Key e lista de modelos
- Visão usa `/chat/completions` com imagens base64 inline
- Geração de imagens usa `/images/generations`
- **É obrigatório especificar o "modelo de geração de imagens" para ter capacidade de geração**; caso contrário, o provedor só aparece na seleção de visão

**CLI**: modelo de comando local, com placeholders substituídos por referências seguras
- Visão: `{image} {question} {model}` → stdout como resposta
- Geração de imagens: `{prompt} {output} {size}` → o comando deve gravar o arquivo em `{output}`
- Preencha pelo menos um comando; o que for preenchido determina a capacidade

**Teste de conectividade**: cada provedor personalizado tem um botão de teste
- API: verifica alcance do endpoint, autenticação e envia uma requisição real de visão para confirmar
- CLI: verifica o arquivo executável e executa um comando real para confirmar
- Geração de imagens: valida apenas a configuração, sem gerar imagem de fato

**CLIs de assinatura emprestadas** (claude / codex / grok / agy) exigem que você esteja conectado localmente; o plugin não contorna as permissões delas por você.

## Modo hub

Este pacote também é um bundle DSH válido (`dsh.bundle` + `cordis.patch.yml`). Após instalar no perfil do DSH Web com `dsh plugin add dsh-crew`:

- **Sessões de worker se tornam cidadãs de primeira classe**: são executadas como sessões de primeira classe no host DSH (`agents.create` + waterfall de model/effort por sessão + preset padrão), aparecem na lista de sessões da Web UI e podem ser abertas a qualquer momento para ver a execução completa
- **Organize por diretório de trabalho**: gerencie sessões de worker por cwd na Web UI
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: cria tarefas, lista, faz long-poll de resultados e cancela
  - `GET /_dsh/dsh-crew/ping`: verificação de saúde (o shim MCP usa isso para detectar se o hub está em execução)
  - `POST /_dsh/dsh-crew/install`: instalação em um clique das integrações do host — Claude Code / Codex / Antigravity / Grok (backend de `src/install/`)
- **Detecção automática**: o shim MCP dos hosts detecta automaticamente o hub (`DSH_CREW_HUB` env var, padrão `http://127.0.0.1:3080`)
  - DSH Web em execução → os jobs entram no modo hub (`mode: "hub"`)
  - Sem execução → volta para o runtime standalone

## Seleção de solução e limitações

### Assinantes regulares → abordagem de shell subagent (recomendada)

- **Estado atual**: o shell de subagent do Claude Code usa haiku como intermediário; cada despacho adiciona centenas a milhares de tokens
- **Trade-off**: use uma pequena quantidade de tokens Anthropic em troca da interface de tarefas nativa, exibição de progresso em tempo real e nenhuma configuração extra
- **Recomendação**: se você já assina o Claude Pro ou usa o Claude Code, use esta abordagem — conveniente e transparente

### Ambientes pay-as-you-go / CI → abordagem de router direto

- **Estado atual**: o frontmatter de subagent do Claude Code não suporta conexão direta com modelos de terceiros; o experimento de router deste repositório no scratchpad exige credenciais de API key para o Claude Code, mas o OAuth de assinatura é bloqueado upstream pela Anthropic com 403
- **Recomendação**:
  - Se você usa credenciais de API key (não OAuth) e quer economizar tokens Anthropic, pode executar um router local para conexão direta com DeepSeek
  - Ambientes CI normalmente também usam API keys; esta abordagem é mais econômica (todos os tokens DeepSeek)
  - Exige autoteste da integração do router (não é oficialmente suportado)

### DSH Web em execução → modo hub ativado automaticamente

- **Estado atual**: se `dsh plugin add dsh-crew` foi instalado no perfil do DSH Web, os jobs são executados como sessões de primeira classe no host e aparecem na lista de sessões da Web UI
- **Recomendação**: durante a iteração de desenvolvimento local, recomenda-se ativar o modo hub; o progresso dos workers pode ser totalmente observado na Web UI; para colaboração entre máquinas ou ambientes sem Web UI, use a abordagem de shell do host de despacho

### Itens conhecidos

- O role do Codex pode, teoricamente, tentar `model_provider` apontando diretamente para DeepSeek (não verificado); esta ponte não depende disso
- A saída da geração de imagens é um bitmap plano; a edição de camadas requer OpenPencil
- **Dependências de runtime**: apenas `@modelcontextprotocol/sdk` e `zod`; `@deepseek-ai/*` são runtime do host (fornecidas pelo host DSH; uma instalação npm comum nunca as baixa)
- **O Codex deve configurar**: `default_tools_approval_mode = "approve"`, caso contrário as chamadas de ferramenta são canceladas automaticamente

## Desenvolvimento

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

As dependências de runtime são apenas `@modelcontextprotocol/sdk` e `zod`; todo pacote `@deepseek-ai/*` é runtime do host fornecido pelo host DSH (documentado no campo dshHostRuntime do pacote, não em peerDependencies, então uma instalação npm comum nunca os baixa), o que mantém o plugin dentro do realm de módulo único do host.

## Ecossistema

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — um emulador Android ou dispositivo USB ao vivo dentro da conversa, tudo conduzido via adb
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — um simulador de iOS — e um iPhone por USB — dentro da conversa
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — memória de longo prazo para DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspecione e edite documentos de design `.op` dentro de uma conversa

## Licença

MIT
