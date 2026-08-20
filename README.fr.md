<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Un plugin <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> : envoyer du travail à des agents DSH depuis Claude Code / Codex, sans renoncer à l'interface native de subagents de l'hôte.</strong><br />
  <sub>Interface de progression native &bull; Politique de tier et escalade &bull; Sessions DSH dans l'hôte &bull; Vision et génération d'images &bull; Installation en un clic</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Version actuelle du plugin : <code>0.1.0-rc.3</code> &middot; Testé avec DSH <code>0.1.0-rc.6</code></sub>
</p>

<p align="center">
  <a href="./README.md"><b>English</b></a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md"><b>Français</b></a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md">हिन्दी</a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>La page de paramètres de DSH Crew — intégrations hôte, politique d'envoi, exécution et pont multimodal</sub></p>

## Pourquoi DSH Crew

DSH Crew est un plugin pour [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — un harness open-source pour agents. Il permet d'envoyer des agents DSH depuis Claude Code et Codex : l'orchestrateur conserve son propre modèle, le travail s'exécute sur un véritable agent DSH avec les outils, le sandbox, les presets et l'historique de session de ce harness, et l'hôte l'affiche toujours comme un subagent natif avec une progression en direct.

Ce qui exécute le travail est un agent DSH, pas un simple appel de modèle. Les tiers (`flash` / `pro`) sélectionnent le niveau de capacité que cet agent reçoit depuis le roster configuré du harness — DeepSeek V4 Flash et V4 Pro aujourd'hui — donc un changement de modèle dans DSH ne nécessite aucun changement ici.

<table>
<tr>
<td width="50%">

### 🧵 Interface de progression native

Les workers apparaissent comme des subagents normaux dans Claude Code / Codex — le nombre d'envois, l'étape en cours, les appels d'outils et l'utilisation de tokens s'affichent dans le panneau de tâches de l'hôte, plus un segment statusline claude-hud : `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

</td>
<td width="50%">

### 🎚️ Politique de tier et escalade

`flash` pour le travail mécanique, `pro` pour le raisonnement, `effort` de `off` à `max`. `tier_policy` peut verrouiller chaque envoi sur un seul tier au niveau de la couche d'outils, et `escalate_on_failure` relance une fois sur pro une exécution flash ayant échoué — sur la base de preuves, pas en devinant la difficulté à l'avance.

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ Sessions DSH dans l'hôte

Avec le bundle installé dans un profil DSH, chaque worker est une session DSH de première classe : visible dans la Web UI, regroupée par répertoire de travail, montée avec le preset Agent que vous choisissez par tier. Sans DSH en cours d'exécution, l'envoi retombe sur un runtime DSH standalone, donc les environnements CI et headless fonctionnent toujours.

</td>
<td width="50%">

### 👁️ Vision et génération d'images

Les modèles de DSH sont uniquement textuels. `describe_image` et `generate_image` empruntent les yeux et le pinceau des CLI que vous avez déjà — Claude, Codex, Grok, Antigravity — ou de toute API compatible OpenAI que vous configurez. Les images collées restent visibles dans la conversation et arrivent au modèle sous forme de texte.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Fournisseurs personnalisés

Apportez votre propre endpoint (Base URL + clé API + modèles) ou un modèle de commande local. Chaque fournisseur dispose d'un test de connectivité qui vérifie l'accessibilité et l'authentification, puis effectue un véritable appel vision pour que vous le sachiez maintenant, pas en pleine tâche.

</td>
<td width="50%">

### 📦 Installation en un clic

La page de paramètres installe et met à jour le plugin Claude Code et les fichiers de rôle Codex pour vous — enregistrement marketplace, liste blanche de permissions, câblage HUD, chemins absolus rendus pour cette machine — et les restaure tout aussi facilement. Chaque fichier de paramètres est d'abord sauvegardé.

</td>
</tr>
</table>

## Comment ça marche

```
Claude Code / Codex (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## Une exécution, deux points de vue

La répartition s'étale. Ci-dessous, dix-huit workers traduisent ce README en parallèle : l'hôte les compte comme ses propres subagents, tandis que le harness les exécute comme de vraies sessions.

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Dans Claude Code, les workers dsh-crew sont des subagents natifs ; le segment de statusline suit les tiers en cours, le temps écoulé et les tokens.</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>Le panneau DSH Crew montre la même exécution côté harness : quel hôte a lancé chaque tâche, son tier et son effort, sa progression et ses tokens.</sub></p>

## Installation

Installer depuis npm dans un profil DSH :

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

Ou, pour le développement local depuis les sources :

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

Le protocole `link:` crée un lien symbolique vers ce dépôt, donc chaque rebuild est visible immédiatement.

### Configurer les identifiants DeepSeek (standalone uniquement)

En mode hub — l'installation ci-dessus — les workers s'exécutent dans l'instance DSH et utilisent les identifiants DeepSeek avec lesquels elle est déjà configurée. Rien d'autre à configurer.

Seul le fallback standalone a besoin d'une clé propre : envoyer du travail depuis Claude Code / Codex sans instance DSH en cours d'exécution lance un worker runtime comme processus séparé. Récupérez une clé API sur [platform.deepseek.com](https://platform.deepseek.com) et écrivez-la dans `~/.config/dsh-crew/.env` :

```
DEEPSEEK_API_KEY=sk-...
```

### Vérifier

```bash
node scripts/smoke.mjs
```

Le smoke test envoie une tâche peu coûteuse par le chemin disponible — le hub si une instance DSH tourne, sinon standalone — et affiche lequel a été utilisé. En une dizaine de secondes, `smoke test passed — configuration OK` doit s'afficher. En cas d'échec, la raison est imprimée et limitée au chemin qui a été testé.

Ouvrez ensuite Réglages → DSH Crew pour installer les intégrations Claude Code / Codex en un clic.

## Contexte et terminologie

- **DSH** (DeepSeek Harness) : le harness open-source pour agents de DeepSeek, un agent code sous forme de Web UI, similaire à Claude Code mais pilotant les modèles DeepSeek.
- **MCP** (Model Context Protocol) : le protocole d'intégration d'outils IA d'Anthropic, qui permet aux LLM d'appeler en toute sécurité des outils externes et des sources de données.
- **Cordis bundle** : le format de plugin de DSH ; ce projet peut s'exécuter en standalone comme service MCP ou s'installer dans DSH Web en mode hub.
- **tier** : niveau de capacité — quel emplacement du roster de modèles configuré de DSH un worker reçoit. `flash` est rapide et peu coûteux (tâches simples), `pro` raisonne plus en profondeur (problèmes complexes). Aujourd'hui, ils correspondent à DeepSeek V4 Flash et V4 Pro ; changez les modèles dans DSH et rien ne change ici.
- **worker** : l'agent DSH qui effectue le travail — une session complète avec ses propres outils, sandbox et preset, pas un simple appel de modèle.
- **effort** : intensité de raisonnement, `off` = aucun raisonnement, `high` = investissement de raisonnement élevé, `max` = investissement de raisonnement maximal.

## Claude Code

### Installation

Installation en un clic (choisissez une option) :

- **Page de paramètres DSH** (quand le mode hub est installé) : Paramètres → DSH Crew → « Install to Claude Code »
- **Ligne de commande** : `node src/install/cli.mjs all`

Les deux font la même chose : enregistrer le marketplace local (le répertoire parent `dsh-plugins/` comme racine marketplace) + `claude plugin install` + liste blanche de permissions des outils MCP + configuration du segment de statut worker claude-hud (sauvegarde automatique de settings.json avant modification, idempotent). **Redémarrez la session après l'installation pour que les changements prennent effet.**

### Utilisation

- Directement en conversation, dites « dispatch X to ds-flash » ou « dispatch X to ds-pro » et le subagent exécute la tâche
- Le nombre d'envois et la progression en temps réel s'affichent dans l'interface de tâches de Claude Code
- **Segment de ligne de statut HUD** : `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (tier actuel / temps écoulé / utilisation de tokens / nombre de tâches terminées)
  - Pour le développement local, `statusline/statusline.sh` ou `statusline/worker-segment.sh` peuvent être intégrés indépendamment
- **Tâches longues** : CC a des limites de timeout sur les appels MCP (`MCP_TOOL_TIMEOUT` ajustable) ; pour les tâches longues, l'orchestrateur peut utiliser `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` en polling
- **Développement local et débogage** : `claude --plugin-dir /path/to/dsh-crew` pour charger temporairement


### Commandes de session

Elles ne remplacent les valeurs globales que pour la session courante, et sont appliquées au niveau de l'outil plutôt que par le prompt :

| Commande | Effet |
|---|---|
| `/dsh-crew:config` | Afficher ou définir les valeurs par défaut de la session : `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<secondes>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | Activer ou désactiver la répartition pour cette session (désactivé = interrupteur strict, l'outil refuse) |
| `/dsh-crew:status` | État en direct des jobs worker : tier, progression, tokens, outil courant |

## Codex

### Installation

Il est recommandé d'utiliser l'installeur (génère automatiquement les chemins pour cette machine, copie les commandes `/dsh-config`, `/dsh-status`) :

```bash
node src/install/cli.mjs codex
```

Ou copie manuelle (nécessite une modification manuelle des chemins après copie) :

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

Les fichiers de rôle sont préconfigurés avec :

- Configuration de montage du serveur MCP
- `default_tools_approval_mode = "approve"` (**requis**, sinon les appels d'outils sont automatiquement annulés en mode exec)
- `tool_timeout_sec = 3600`

**Remarque** : en cas de copie manuelle, les chemins absolus dans le champ `args` doivent être mis à jour pour correspondre à l'emplacement réel d'installation ; l'installeur s'en charge automatiquement.

### Utilisation

- Dans la TUI interactive, sélectionnez « spawn ds-pro to ... » pour envoyer des tâches ; les panneaux Active/Done affichent la progression
- Le mode `codex exec` peut aussi appeler directement `dsh_run_worker`


### Commandes de session

Les deux mêmes prompts sont installés pour Codex :

| Commande | Effet |
|---|---|
| `/dsh-config` | Afficher ou définir les valeurs par défaut de la session : `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<secondes>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | État en direct des jobs worker : tier, progression, tokens, outil courant |

## Outils MCP

| Outil | Description |
|---|---|
| `dsh_run_worker` | Envoi de tâche synchrone (`tier` : flash/pro, `effort` : off/high/max, `cwd`), attend le résultat |
| `dsh_spawn_worker` | Envoi de tâche asynchrone, renvoie un identifiant de job (pour le fan-out parallèle) |
| `dsh_worker_status` | Interroge la progression en temps réel de tous les jobs (turn/step/outil actuel/token) |
| `dsh_worker_result` | Récupère le résultat, peut spécifier `wait_seconds` pour attendre |
| `dsh_worker_cancel` | Annule le job spécifié et termine son processus runtime |

La progression est simultanément répliquée dans `~/.config/dsh-crew/status.d/` (un fichier shard par écrivain, lisible par statusline / surveillance externe).

## Multimodal : vision et génération d'images

**DeepSeek est un modèle uniquement textuel** et ne prend pas en charge la saisie ou la génération d'images. Ce plugin obtient ces capacités en externe via des outils MCP :

| Outil | Description |
|---|---|
| `describe_image` | Répond aux questions en visualisant des images (captures d'écran, maquettes, graphiques, etc.) ; résultats mis en cache par fournisseur + modèle + image + question |
| `generate_image` | Génère une image à partir d'une description textuelle, l'enregistre dans le chemin absolu spécifié ; la sortie est un bitmap plat (nécessite OpenPencil pour l'édition en couches) |

**Collage d'images en session** : dans DSH, passez le modèle sur `DeepSeek (vision) ◉` pour coller directement des images. Les images restent dans la session et s'affichent normalement ; le plugin ajoute le texte transcrit après elles et retire les images avant l'envoi — vous voyez l'image, le modèle lit le texte.

### Configuration

Dans **la page de paramètres DSH → DSH Crew → Multimodal** (ou modifiez directement `~/.config/dsh-crew/config.json`) :

**Fournisseur de vision** (visualisation d'images) :

- `claude-code` (par défaut, utilise haiku, peu coûteux)
- `codex` (utilise GPT, peut spécifier un modèle particulier)
- `grok` (utilise Grok)
- `agy` (Antigravity)
- `custom` (API compatible OpenAI ou commande locale)
- `off` (désactivé)

**Fournisseur de génération d'images** (génération d'images) :

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (API compatible OpenAI ou commande locale)
- `off` (désactivé)

### Fournisseur personnalisé

Deux méthodes d'intégration :

**API** : tout endpoint compatible OpenAI
- Renseignez Base URL, la clé API et la liste de modèles
- La vision utilise `/chat/completions` avec des images base64 en ligne
- La génération d'images utilise `/images/generations`
- **Vous devez spécifier le « modèle de génération d'images » pour disposer de la capacité de génération**, sinon le fournisseur n'apparaît que dans la sélection de vision

**CLI** : modèle de commande locale, avec des espaces réservés remplacés par des références sûres
- Vision : `{image} {question} {model}` → stdout comme réponse
- Génération d'images : `{prompt} {output} {size}` → la commande doit écrire le fichier dans `{output}`
- Renseignez au moins une commande ; celle qui est remplie détermine la capacité

**Test de connectivité** : chaque fournisseur personnalisé dispose d'un bouton de test
- API : vérifier l'accessibilité de l'endpoint, l'authentification, envoyer une vraie requête vision pour valider
- CLI : vérifier le fichier exécutable, exécuter une vraie commande pour valider
- Génération d'images : valider uniquement la configuration, sans sortie d'image réelle

**CLI d'abonnement empruntées** (claude / codex / grok / agy) exigent que vous soyez connecté localement ; le plugin ne contournera pas leurs permissions à votre place.

## Mode hub

Ce package est aussi un bundle DSH valide (`dsh.bundle` + `cordis.patch.yml`). Après installation dans un profil DSH Web avec `dsh plugin add dsh-crew` :

- **Les sessions worker deviennent des citoyens de première classe** : elles s'exécutent comme des sessions de première classe dans l'hôte DSH (`agents.create` + cascade modèle/effort par session + preset par défaut), apparaissent dans la liste des sessions de la Web UI et peuvent être ouvertes à tout moment pour voir l'exécution complète
- **Organisation par répertoire de travail** : gérez les sessions worker par cwd dans la Web UI
- **API loopback** :
  - `POST/GET /_dsh/dsh-crew/jobs` : lancer des tâches, lister, long-poll des résultats, annuler
  - `GET /_dsh/dsh-crew/ping` : health check (le shim MCP l'utilise pour détecter si le hub fonctionne)
  - `POST /_dsh/dsh-crew/install` : installation en un clic de l'intégration Claude Code / Codex (backend de `src/install/`)
- **Détection automatique** : le shim MCP de CC/Codex détecte automatiquement le hub (variable d'environnement `DSH_CREW_HUB`, défaut `http://127.0.0.1:3080`)
  - DSH Web actif → les jobs passent en mode hub (`mode: "hub"`)
  - Non actif → repli sur le runtime standalone

## Choix de solution et limitations

### Abonnés réguliers → approche par subagent shell (recommandé)

- **État actuel** : le shell subagent de Claude Code utilise haiku comme intermédiaire ; chaque envoi ajoute des centaines à des milliers de tokens
- **Compromis** : utiliser une petite quantité de tokens Anthropic en échange de l'interface de tâches native, de l'affichage de progression en temps réel et d'aucune configuration supplémentaire
- **Recommandation** : si vous êtes déjà abonné à Claude Pro ou utilisez Claude Code, utilisez cette approche — pratique et transparente

### Paiement à l'usage / environnements CI → approche routeur direct

- **État actuel** : le frontmatter de subagent de Claude Code ne prend pas en charge la connexion directe à un modèle tiers ; l'expérience de routeur de ce dépôt dans scratchpad nécessite des identifiants de type clé API pour Claude Code, mais l'OAuth par abonnement est bloqué en amont par Anthropic avec une 403
- **Recommandation** :
  - Si vous utilisez des identifiants par clé API (pas OAuth) et souhaitez économiser les tokens Anthropic, vous pouvez exécuter un routeur local pour une connexion directe à DeepSeek
  - Les environnements CI utilisent généralement aussi des clés API ; cette approche est plus économique (uniquement des tokens DeepSeek)
  - Nécessite de tester soi-même l'intégration du routeur (non officiellement prise en charge)

### DSH Web en cours d'exécution → mode hub activé automatiquement

- **État actuel** : si `dsh plugin add dsh-crew` est installé dans un profil DSH Web, les jobs s'exécutent comme des sessions de première classe dans l'hôte et apparaissent dans la liste des sessions de la Web UI
- **Recommandation** : lors des itérations de développement local, il est recommandé d'activer le mode hub ; la progression des workers peut être entièrement observée dans la Web UI ; pour la collaboration entre machines ou les environnements sans Web UI, utilisez l'approche shell Claude Code / Codex

### Points connus

- Le rôle Codex peut théoriquement essayer `model_provider` pointant directement vers DeepSeek (non vérifié) ; ce pont n'en dépend pas
- La sortie de génération d'images est un bitmap plat ; l'édition en couches nécessite OpenPencil
- **Dépendances runtime** : uniquement `@modelcontextprotocol/sdk` et `zod` ; `@deepseek-ai/*` sont le runtime de l'hôte (fourni par l'hôte DSH ; une simple installation npm ne les installe jamais)
- **Codex doit configurer** : `default_tools_approval_mode = "approve"`, sinon les appels d'outils sont automatiquement annulés

## Développement

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

Les dépendances runtime sont uniquement `@modelcontextprotocol/sdk` et `zod` ; chaque package `@deepseek-ai/*` est un runtime d'hôte fourni par l'hôte DSH (documenté dans le champ dshHostRuntime du package, et non dans peerDependencies, si bien qu'une simple installation npm ne les installe jamais), ce qui maintient le plugin dans le realm de module unique de l'hôte.

## Écosystème

- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — un simulateur iOS — et un iPhone en USB — vivants dans la conversation
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — mémoire à long terme pour DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspecter et modifier les documents de conception `.op` dans une conversation

## Licence

MIT
