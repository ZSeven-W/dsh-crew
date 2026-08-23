<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Un plugin de <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a>: despachar trabajo a agentes DSH desde Claude Code / Codex / Antigravity / Grok, sin renunciar a la interfaz nativa de subagents del host.</strong><br />
  <sub>UI de progreso nativa &bull; Política de tier y escalado &bull; Barreras de despacho &bull; Tablón de trabajos &bull; Sesiones DSH en el host &bull; Visión y generación de imágenes (nativo primero) &bull; Instalación con un clic</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Versión actual del plugin: <code>0.1.0-rc.4</code> &middot; Probado con DSH <code>0.1.1-rc.1</code></sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md"><b>Español</b></a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>La página de ajustes de DSH Crew — integraciones con el host, política de despacho, ejecución y el puente multimodal</sub></p>

## Por qué DSH Crew

DSH Crew es un plugin para [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH), un harness de agentes de código abierto. Permite despachar agentes DSH desde Claude Code, Codex, Antigravity y Grok: el orchestrator conserva su propio modelo, el trabajo se ejecuta en un agente DSH real con las herramientas, el sandbox, los presets y el historial de sesión de ese harness, y el host lo sigue mostrando como un subagent nativo con progreso en vivo.

Lo que ejecuta el trabajo es un agente DSH, no una simple llamada a un modelo. Los tiers (`flash` / `pro`) seleccionan cuánta capacidad recibe ese agente del roster configurado del harness — hoy, DeepSeek V4 Flash y V4 Pro —, de modo que un cambio de modelo en DSH no requiere ningún cambio aquí.

<table>
<tr>
<td width="50%">

### 🧵 UI de progreso nativa

Los workers aparecen como subagents normales en Claude Code / Codex / Antigravity / Grok: el recuento de despachos, el paso en ejecución, las llamadas a herramientas y el uso de tokens se muestran en el panel de tareas del propio host, además de un segmento statusline de claude-hud: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Política de tier y escalado

`flash` para trabajo mecánico, `pro` para razonamiento, `effort` de `off` a `max`. `tier_policy` puede fijar cada despacho a un único tier en la capa de herramientas, y `escalate_on_failure` reintenta una vez en pro una ejecución flash fallida, basándose en la evidencia y no en adivinar la dificultad de antemano.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ Sesiones DSH en el host

Con el bundle instalado en un perfil DSH, cada worker es una sesión DSH de primera clase: visible en la Web UI, agrupada por directorio de trabajo y montada con el preset de Agent que elijas para cada tier. Sin DSH en marcha, el despacho recurre a un runtime DSH standalone, de modo que los entornos CI y headless siguen funcionando.

</td>
<td width="50%">

### 👁️ Visión y generación de imágenes

Los modelos de DSH son solo de texto. `describe_image` ahora prefiere el propio modelo VL de DeepSeek (`deepseek-v4-flash-vision-exp`) siempre que haya una key disponible, y luego recurre a las CLIs que ya tienes — Claude, Codex, Grok, Antigravity — o a cualquier API compatible con OpenAI que configures. `generate_image` toma prestado el pincel de las mismas CLIs. Las imágenes pegadas permanecen visibles en la conversación y llegan al modelo como texto.

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ Barreras de despacho

Cada despacho se comprueba antes de que nada se lance. El anidamiento worker→worker está limitado a una profundidad de 3 en la cadena de origen y los ciclos se rechazan; un segundo worker en un workspace que otro job ya tiene retenido se rechaza con la información de su titular — nunca se encola en silencio. Los rechazos son errores legibles: espera o redefine el alcance, no intentes saltártelas.

</td>
<td width="50%">

### 📋 Tablón de trabajos

El panel de DSH Crew hace las veces de tablón de trabajos: cada job worker — en ejecución o terminado — aparece listado con tier, effort, progreso en vivo y tokens; los workspaces retenidos muestran a sus titulares, y un job que desaparece a mitad de vuelo (p. ej., un reinicio del hub) aparece como un fantasma huérfano en lugar de desaparecer en silencio.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Proveedores personalizados

Trae tu propio endpoint (Base URL + clave API + modelos) o una plantilla de comando local. Cada proveedor dispone de un test de conectividad que comprueba la accesibilidad y la autenticación y luego hace una llamada de visión real, para que lo descubras ahora y no a mitad de tarea.

</td>
<td width="50%">

### 📦 Instalación con un clic

La página de ajustes instala y actualiza por ti el plugin de Claude Code, los archivos de rol de Codex y los agents, skills y comandos de Antigravity / Grok — registro en el marketplace, lista blanca de permisos, cableado del HUD y rutas absolutas generadas para esta máquina — y los restaura con la misma facilidad. Primero se hace una copia de seguridad de cada archivo de ajustes.

</td>
</tr>
</table>

## Cómo funciona

```
Claude Code / Codex / Antigravity / Grok (orchestrator, conserva su propio modelo)
  └─ ds-flash / ds-pro  ← shell de subagent nativo (el progreso se muestra en la UI de tareas del host)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → esa CLI externa ejecuta la tarea (opt-in explícito)
            ├─ hub alcanzable → sesión dentro de DSH (visible en la Web UI, agrupada por cwd)
            └─ en caso contrario → runtime dsh-jsonrpc-agent (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, flujo de eventos → progreso y estadísticas de tokens)
```

## Una ejecución, dos vistas

El despacho se reparte. Abajo, dieciocho workers traducen este README en paralelo: el host los cuenta como sus propios subagents, mientras el harness los ejecuta como sesiones reales.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>En Claude Code, los workers de dsh-crew son subagents nativos; el segmento de statusline muestra los tiers en ejecución, el tiempo transcurrido y los tokens.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>El panel de DSH Crew muestra la misma ejecución desde el harness: qué host despachó cada trabajo, su tier y effort, el progreso en vivo y el uso de tokens.</sub></p>

<p align="center"><sub>El panel es también el tablón de trabajos: los jobs en ejecución y terminados permanecen listados con tier, progreso y tokens; los workspaces retenidos nombran a sus titulares, y un job que desaparece a mitad de vuelo (un reinicio del hub) aparece como un fantasma huérfano en lugar de desaparecer en silencio.</sub></p>

## Instalación

Instalar desde npm en un perfil de DSH:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

O, para desarrollo local desde el código fuente:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

El protocolo `link:` enlaza la dependencia del perfil a este repositorio, así cada rebuild se ve de inmediato.

### Configurar credenciales de DeepSeek (solo standalone)

En modo hub — la instalación anterior — los workers se ejecutan dentro de la instancia de DSH y utilizan las credenciales de DeepSeek con las que ya está configurada. Nada más que configurar.

Solo el fallback standalone necesita su propia key: despachar desde un host sin ninguna instancia de DSH en ejecución inicia un worker runtime como proceso separado. Obtén una API key en [platform.deepseek.com](https://platform.deepseek.com) y escríbela en `~/.config/dsh-crew/.env`:

```
DEEPSEEK_API_KEY=sk-...
```

### Verificar

```bash
node scripts/smoke.mjs
```

El smoke test despacha una tarea económica por el camino disponible — el hub si una instancia de DSH está en ejecución, en caso contrario standalone — e imprime cuál se utilizó. En unos diez segundos deberías ver `smoke test passed — configuration OK`. Si falla, se imprime el motivo, limitado al camino que fue probado.

Luego abre Ajustes → DSH Crew e instala las integraciones del host — Claude Code, Codex, Antigravity, Grok — con un clic, o usa el mismo instalador desde la línea de comandos:

```bash
node src/install/cli.mjs claude   # Plugin de Claude Code: marketplace + permisos + segmento HUD
node src/install/cli.mjs codex    # Agents + prompts de Codex
node src/install/cli.mjs agy      # Config MCP de Antigravity + agents + skills
node src/install/cli.mjs grok     # Config MCP de Grok + agents + comandos
node src/install/cli.mjs all      # los cuatro hosts a la vez
# desinstalar de forma simétrica (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

## Contexto y terminología

- **DSH** (DeepSeek Harness): el harness de agentes de código abierto de DeepSeek, un agente de código en forma de Web UI, similar a Claude Code pero que impulsa los modelos de DeepSeek.
- **MCP** (Model Context Protocol): el protocolo de integración de herramientas de IA de Anthropic, permite que los LLM llamen de forma segura a herramientas externas y fuentes de datos.
- **Cordis bundle**: el formato de plugin de DSH; este proyecto puede ejecutarse standalone como servicio MCP o instalarse en DSH Web en modo hub.
- **tier**: nivel de capacidad, qué puesto del roster de modelos configurado en DSH recibe un worker. `flash` es rápido y económico (tareas simples), `pro` razona con más profundidad (problemas complejos). Hoy se corresponden con DeepSeek V4 Flash y V4 Pro; cambia los modelos en DSH y aquí no cambia nada.
- **worker**: el agente DSH que hace el trabajo: una sesión completa con sus propias herramientas, sandbox y preset, no una simple llamada a un modelo.
- **effort**: intensidad de razonamiento, `off` = sin razonamiento, `high` = inversión alta de razonamiento, `max` = inversión máxima de razonamiento.

## Claude Code

### Instalación

Instalación con un clic (elige una opción):

- **Página de ajustes de DSH** (cuando el modo hub está instalado): Ajustes → DSH Crew → "Instalar en Claude Code"
- **Línea de comandos**: `node src/install/cli.mjs all`

Ambas hacen lo mismo: registrar el marketplace local (el directorio padre `dsh-plugins/` como raíz del marketplace) + `claude plugin install` + lista blanca de permisos de las herramientas MCP + configuración del segmento de estado del worker en claude-hud (copia de seguridad automática de settings.json antes de los cambios, idempotente). **Reinicia la sesión tras la instalación para que los cambios surtan efecto.**

### Uso

- Directamente en la conversación, di "dispatch X to ds-flash" o "dispatch X to ds-pro" y el subagent ejecuta la tarea
- El número de despachos y el progreso en tiempo real se muestran en la UI de tareas de Claude Code
- **Segmento de la línea de estado del HUD**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (tier actual / tiempo transcurrido / uso de tokens / tareas completadas)
  - Para desarrollo local, `statusline/statusline.sh` o `statusline/worker-segment.sh` se pueden integrar de forma independiente
- **Tareas de larga duración**: CC impone límites de timeout a las llamadas MCP (`MCP_TOOL_TIMEOUT` ajustable); en tareas largas, el orchestrator puede usar `dsh_spawn_worker` + polling con `dsh_worker_result(wait_seconds)`
- **Desarrollo local y depuración**: `claude --plugin-dir /path/to/dsh-crew` para cargar temporalmente


### Comandos de sesión

Solo anulan los valores globales de la sesión actual y se aplican en la capa de herramientas, no por prompt:

| Comando | Qué hace |
|---|---|
| `/dsh-crew:config` | Mostrar o fijar los valores por defecto de la sesión: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<segundos>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Activar o desactivar el despacho en esta sesión (desactivado es un interruptor duro: la herramienta rechaza) |
| `/dsh-crew:status` | Estado en vivo de los jobs worker: tier, progreso, tokens, herramienta actual |
| `/dsh-crew:playbook` | Buenas prácticas de despacho: elegir entre flash y pro, briefs autocontenidos, paralelismo, verificar resultados, barreras |

## Codex

### Instalación

Se recomienda usar el instalador (genera automáticamente las rutas para esta máquina y copia los prompts `/dsh-config`, `/dsh-status` y `/dsh-playbook`):

```bash
node src/install/cli.mjs codex
```

O copia manualmente (requiere modificar las rutas a mano después de copiar):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global o .codex/agents/ a nivel de proyecto
```

Los archivos de rol vienen preconfigurados con:

- Configuración de montaje del servidor MCP
- `default_tools_approval_mode = "approve"` (**obligatorio**; si no, las llamadas a herramientas se cancelan automáticamente en modo exec)
- `tool_timeout_sec = 3600`

**Nota**: al copiar manualmente, las rutas absolutas del campo `args` deben actualizarse para coincidir con la ubicación real de instalación; el instalador lo hace automáticamente.

### Uso

- En la TUI interactiva, selecciona "spawn ds-pro to ..." para despachar tareas; los paneles Active/Done muestran el progreso
- El modo `codex exec` también puede llamar directamente a `dsh_run_worker`


### Comandos de sesión

Para Codex se instalan tres prompts:

| Comando | Qué hace |
|---|---|
| `/dsh-config` | Mostrar o fijar los valores por defecto de la sesión: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<segundos>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | Estado en vivo de los jobs worker: tier, progreso, tokens, herramienta actual |
| `/dsh-playbook` | Buenas prácticas de despacho: elegir entre flash y pro, briefs autocontenidos, paralelismo, verificar resultados, barreras |

## Antigravity (agy)

### Instalación

```bash
node src/install/cli.mjs agy
```

Registra el servidor MCP dsh-crew en `~/.gemini/config/mcp_config.json` e instala los agents `ds-flash` / `ds-pro` además de los skills `dsh-config`, `dsh-status` y `dsh-playbook` en `~/.gemini/config/` (antes se hace copia de seguridad de todos los archivos). Reinicia la sesión después de la instalación.

### Uso

- Elige `ds-flash` o `ds-pro` como agent para despachar tareas
- `dsh_worker_config` lee o sobrescribe los valores por defecto de la sesión

### Skills de sesión

| Skill | Qué hace |
|---|---|
| `/dsh-config` | Mostrar o fijar los valores por defecto de la sesión (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | Estado en vivo de los jobs worker: tier, progreso, tokens, herramienta actual |
| `/dsh-playbook` | Buenas prácticas de despacho: elegir entre flash y pro, briefs autocontenidos, paralelismo, verificar resultados, barreras |

### Advertencias

- agy ejecuta los workers con **aprobación total** (`--dangerously-skip-permissions` + accept-edits): agy 1.1.16 no tiene modo de permisos con ámbito de workspace, así que un worker headless debe autoaprobar las peticiones de herramientas.

Desinstalar: `node src/install/cli.mjs uninstall-agy`

## Grok

### Instalación

```bash
node src/install/cli.mjs grok
```

Escribe la sección `[mcp_servers.dsh-crew]` en `~/.grok/config.toml` e instala los agents `ds-flash` / `ds-pro` además de los comandos `/dsh-config`, `/dsh-status` y `/dsh-playbook` en `~/.grok/` (antes se hace copia de seguridad de todos los archivos).

### Uso

- Elige `ds-flash` o `ds-pro` como agent para despachar tareas

### Comandos de sesión

| Comando | Qué hace |
|---|---|
| `/dsh-config` | Mostrar o fijar los valores por defecto de la sesión (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | Estado en vivo de los jobs worker: tier, progreso, tokens, herramienta actual |
| `/dsh-playbook` | Buenas prácticas de despacho: elegir entre flash y pro, briefs autocontenidos, paralelismo, verificar resultados, barreras |

### Advertencias

- Por diseño de seguridad, grok no inicia servidores MCP a nivel de repo en directorios de proyecto no confiables (`grok mcp doctor` informa "folder untrusted"); una instalación global no se ve afectada — cambia de directorio o pasa `--trust`.
- Los workers de grok se ejecutan con `bypassPermissions` (aprobación siempre, como recomienda la documentación de grok para la automatización headless); las reglas deny y los hooks siguen aplicándose.

Desinstalar: `node src/install/cli.mjs uninstall-grok`

## Herramientas MCP

| Herramienta | Descripción |
|---|---|
| `dsh_run_worker` | Despacho bloqueante de tareas (`tier`: flash/pro, `effort`: off/high/max, `cwd`, `worker`), espera el resultado |
| `dsh_spawn_worker` | Despacho asíncrono de tareas, devuelve un job id (para fan-out en paralelo); recoge los resultados con `dsh_worker_result` |
| `dsh_worker_status` | Progreso en tiempo real de todos los jobs (turn/step/herramienta actual/token) + bloqueos consultivos de cwd |
| `dsh_worker_result` | Recupera el resultado; se puede especificar `wait_seconds` para esperar |
| `dsh_worker_cancel` | Cancela el job indicado y termina su proceso runtime |
| `dsh_worker_config` | Lee/fija los valores por defecto de la sesión (tier, effort, mode, timeout, policy, escalation) y lista los `worker_profiles` |

El progreso se refleja a la vez en `~/.config/dsh-crew/status.d/` (un archivo shard por escritor; lo pueden leer el statusline o la monitorización externa).

## Barreras de despacho

Cada despacho se comprueba antes de que nada se lance — los rechazos son errores legibles, nunca colas silenciosas:

- **Cadena de origen**: cada despacho añade un salto a la cadena de origen worker→worker. Anidar más allá del límite (`origin_depth_limit`, por defecto 3) se rechaza, igual que cualquier ciclo (el mismo backend + cwd apareciendo dos veces): la barrera que detiene la autoamplificación recursiva de workers.
- **Bloqueo consultivo de cwd**: un worker en ejecución por workspace. Un segundo despacho a un workspace retenido se rechaza con el job id de su titular, el backend y la hora de inicio — espera a que se asiente, cancélalo con `dsh_worker_cancel` o pasa `allow_concurrent_cwd: true` (solo tareas de solo lectura).

## Playbook de despacho

Cómo despachar *bien* — flash vs pro, briefs autocontenidos, paralelismo seguro, verificar resultados y las barreras anteriores — viene empaquetado como un playbook por host: `/dsh-crew:playbook` (skill de Claude Code), `/dsh-playbook` (prompt de Codex, skill de Antigravity, comando de Grok).

## Backends explícitos de CLI

`worker="agy"` / `worker="grok"` fija un despacho a esa CLI externa (backend × modelo × effort) en lugar de la lógica de tiers de DSH. Es opt-in explícito — no hay valor por defecto, así que fíjalo solo cuando el usuario pida esa CLI. Advertencias: grok se niega a iniciar servidores MCP locales al repo en carpetas no confiables, y agy ejecuta los workers con aprobación total (sin modo de permisos con ámbito de workspace).

## Multimodal: visión y generación de imágenes

**DeepSeek es un modelo solo de texto** y no admite entrada ni generación de imágenes. Este plugin obtiene esas capacidades de forma externa mediante herramientas MCP:

**Primero la visión nativa**: cuando el proveedor de visión es una CLI integrada (o explícitamente `native`), `describe_image` prueba primero el propio modelo VL de DeepSeek `deepseek-v4-flash-vision-exp` (llamada directa a la API; key de `DEEPSEEK_API_KEY` o `~/.config/dsh-crew/.env`). Cualquier fallo degrada de forma elegante a la cadena de proveedores CLI de abajo, que se mantiene como fallback. La generación de imágenes no cambia — el modelo nativo solo mira imágenes.

| Herramienta | Descripción |
|---|---|
| `describe_image` | Responde preguntas viendo imágenes (capturas, diseños, gráficos, etc.); los resultados se cachean por proveedor + modelo + imagen + pregunta |
| `generate_image` | Genera una imagen a partir de una descripción de texto y la guarda en la ruta absoluta indicada; la salida es un bitmap plano (la edición por capas requiere OpenPencil) |

**Pegado de imágenes en sesión**: en DSH, cambia el modelo a `DeepSeek (vision) ◉` para pegar imágenes directamente. Las imágenes permanecen en la sesión y se muestran con normalidad; el plugin añade el texto transcrito tras ellas y las elimina antes del envío: tú ves la imagen y el modelo lee el texto. La transcripción sigue la misma escalera con lo nativo primero: el modelo VL de DeepSeek cuando hay una key disponible, y después tu proveedor CLI configurado.

### Configuración

En **la página de ajustes de DSH → DSH Crew → Multimodal** (o edita directamente `~/.config/dsh-crew/config.json`):

**Proveedor de visión** (ver imágenes):

- `native` / `deepseek-native` (el propio modelo VL de DeepSeek — se prueba primero automáticamente para cada proveedor integrado siempre que haya una key disponible)
- `claude-code` (por defecto, usa haiku, económico)
- `codex` (usa GPT; se puede especificar un modelo concreto)
- `grok` (usa Grok)
- `agy` (Antigravity)
- `custom` (API compatible con OpenAI o comando local)
- `off` (desactivado)

**Proveedor de generación de imágenes** (generación de imágenes):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (API compatible con OpenAI o comando local)
- `off` (desactivado)

### Proveedor personalizado

Dos métodos de integración:

**API**: cualquier endpoint compatible con OpenAI
- Rellena Base URL, API Key y la lista de modelos
- La visión usa `/chat/completions` con imágenes base64 embebidas
- La generación de imágenes usa `/images/generations`
- **Hay que especificar el «modelo de generación de imágenes» para disponer de capacidad de generación**; si no, el proveedor solo aparece en la selección de visión

**CLI**: plantilla de comando local, con placeholders sustituidos por referencias seguras
- Visión: `{image} {question} {model}` → stdout como respuesta
- Generación de imágenes: `{prompt} {output} {size}` → el comando debe escribir el archivo en `{output}`
- Rellena al menos un comando; el que rellenes determina la capacidad

**Test de conectividad**: cada proveedor personalizado tiene un botón de prueba
- API: comprueba la accesibilidad del endpoint y la autenticación, y envía una petición de visión real para verificar
- CLI: comprueba el archivo ejecutable y ejecuta un comando real para verificar
- Generación de imágenes: solo valida la configuración, sin salida de imagen real

**CLIs de suscripción prestadas** (claude / codex / grok / agy) requieren que hayas iniciado sesión localmente; el plugin no va a saltarse sus permisos por ti.

## Modo hub

Este paquete también es un bundle DSH válido (`dsh.bundle` + `cordis.patch.yml`). Tras instalarlo en un perfil de DSH Web con `dsh plugin add dsh-crew`:

- **Las sesiones de los workers se convierten en ciudadanos de primera clase**: se ejecutan como sesiones de primera clase en el host DSH (`agents.create` + cascada de modelo/effort por sesión + preset por defecto), aparecen en la lista de sesiones de la Web UI y se pueden abrir en cualquier momento para ver la ejecución completa
- **Organización por directorio de trabajo**: gestiona las sesiones de los workers por cwd en la Web UI
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: lanza tareas, lista, long-poll de resultados, cancela
  - `GET /_dsh/dsh-crew/ping`: health check (el shim MCP lo usa para detectar si el hub está en marcha)
  - `POST /_dsh/dsh-crew/install`: instalación con un clic de las integraciones del host — Claude Code / Codex / Antigravity / Grok (backend de `src/install/`)
- **Detección automática**: el shim MCP de los hosts detecta automáticamente el hub (variable de entorno `DSH_CREW_HUB`, por defecto `http://127.0.0.1:3080`)
  - DSH Web en marcha → los jobs entran en modo hub (`mode: "hub"`)
  - No está en marcha → se recurre al runtime standalone

## Elección de solución y limitaciones

### Suscriptores habituales → enfoque de subagent shell (recomendado)

- **Estado actual**: el shell de subagent de Claude Code usa haiku como intermediario; cada despacho añade de cientos a miles de tokens
- **Compromiso**: usar una pequeña cantidad de tokens de Anthropic a cambio de la UI de tareas nativa, la visualización del progreso en tiempo real y ninguna configuración adicional
- **Recomendación**: si ya estás suscrito a Claude Pro o usas Claude Code, usa este enfoque: cómodo y transparente

### Pago por uso / entornos CI → enfoque de router directo

- **Estado actual**: el frontmatter de los subagents de Claude Code no admite la conexión directa a modelos de terceros; el experimento de router de este repo en scratchpad requiere credenciales de API key para Claude Code, pero el OAuth de suscripción está bloqueado aguas arriba por Anthropic con un 403
- **Recomendación**:
  - Si usas credenciales de API key (no OAuth) y quieres ahorrar tokens de Anthropic, puedes ejecutar un router local para conectar directamente con DeepSeek
  - Los entornos CI suelen usar también API keys; este enfoque es más económico (todos los tokens son de DeepSeek)
  - Requiere probar uno mismo la integración del router (no cuenta con soporte oficial)

### DSH Web en ejecución → modo hub activado automáticamente

- **Estado actual**: si `dsh plugin add dsh-crew` está instalado en un perfil de DSH Web, los jobs se ejecutan como sesiones de primera clase en el host y aparecen en la lista de sesiones de la Web UI
- **Recomendación**: durante la iteración del desarrollo local, se recomienda activar el modo hub; el progreso de los workers se puede observar por completo en la Web UI; para la colaboración entre máquinas o entornos sin Web UI, usa el enfoque de shell del host que despacha

### Puntos conocidos

- El rol de Codex puede, en teoría, probar `model_provider` apuntando directamente a DeepSeek (sin verificar); este puente no depende de ello
- La salida de la generación de imágenes es un bitmap plano; la edición por capas requiere OpenPencil
- **Dependencias runtime**: solo `@modelcontextprotocol/sdk` y `zod`; `@deepseek-ai/*` son runtime del host (proporcionado por el host DSH; una instalación npm normal nunca las instala)
- **Codex debe configurar**: `default_tools_approval_mode = "approve"`; si no, las llamadas a herramientas se cancelan automáticamente

## Desarrollo

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # envuelve el bundle para el cargador de módulos de DSH
node scripts/smoke.mjs          # distribuye una tarea flash real de extremo a extremo
```

Las dependencias runtime son solo `@modelcontextprotocol/sdk` y `zod`; cada paquete `@deepseek-ai/*` es runtime del host proporcionado por el host DSH (documentado en el campo dshHostRuntime del paquete, no en peerDependencies, de modo que una instalación npm normal nunca las instala), lo que mantiene al plugin dentro del único realm de módulos del host.

## Ecosistema

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — un emulador de Android o un dispositivo USB en vivo dentro de la conversación, gobernado por completo a través de adb
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — un simulador de iOS —y un iPhone por USB— dentro de la conversación
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema): memoria a largo plazo para DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil): inspeccionar y editar documentos de diseño `.op` dentro de una conversación

## Licencia

MIT
