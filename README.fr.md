<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>Un plugin <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> : envoyer du travail à des agents DSH depuis Claude Code / Codex / Antigravity / Grok, sans renoncer à l'interface native de subagents de l'hôte.</strong><br />
  <sub>Interface de progression native &bull; Politique de tier et escalade &bull; Garde-fous d'envoi &bull; Tableau des jobs &bull; Sessions DSH dans l'hôte &bull; Vision et génération d'images (natif d'abord) &bull; Installation en un clic</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; Version actuelle du plugin : <code>0.1.0-rc.4</code> &middot; Testé avec DSH <code>0.1.1-rc.1</code></sub>
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

DSH Crew est un plugin pour [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) — un harness open-source pour agents. Il permet d'envoyer des agents DSH depuis Claude Code, Codex, Antigravity et Grok : l'orchestrateur conserve son propre modèle, le travail s'exécute sur un véritable agent DSH avec les outils, le sandbox, les presets et l'historique de session de ce harness, et l'hôte l'affiche toujours comme un subagent natif avec une progression en direct.

Ce qui exécute le travail est un agent DSH, pas un simple appel de modèle. Les tiers (`flash` / `pro`) sélectionnent le niveau de capacité que cet agent reçoit depuis le roster configuré du harness — DeepSeek V4 Flash et V4 Pro aujourd'hui — donc un changement de modèle dans DSH ne nécessite aucun changement ici.

<table>
<tr>
<td width="50%">

### 🧵 Interface de progression native

Les workers apparaissent comme des subagents normaux dans Claude Code / Codex / Antigravity / Grok — le nombre d'envois, l'étape en cours, les appels d'outils et l'utilisation de tokens s'affichent dans le panneau de tâches de l'hôte, plus un segment statusline claude-hud : `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`.

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

Les modèles de DSH sont uniquement textuels. `describe_image` préfère désormais le propre modèle VL de DeepSeek (`deepseek-v4-flash-vision-exp`) dès qu'une clé est disponible, puis retombe sur les CLI que vous avez déjà — Claude, Codex, Grok, Antigravity — ou sur toute API compatible OpenAI que vous configurez. `generate_image` emprunte le pinceau de ces mêmes CLI. Les images collées restent visibles dans la conversation et arrivent au modèle sous forme de texte.

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ Garde-fous d'envoi

Chaque envoi est vérifié avant que quoi que ce soit ne soit lancé. L'imbrication worker→worker est plafonnée à une profondeur de chaîne d'origine de 3 et les cycles sont refusés ; un second worker sur un espace de travail qu'un autre job détient déjà est refusé avec les informations du détenteur — jamais mis en file silencieusement. Les refus sont des erreurs lisibles : attendez ou recadrez, ne contournez pas.

</td>
<td width="50%">

### 📋 Tableau des jobs

Le panneau DSH Crew fait aussi office de tableau des jobs : chaque job worker — en cours ou terminé — est listé avec son tier, son effort, sa progression en direct et ses tokens, les espaces de travail détenus indiquent leurs détenteurs, et un job qui disparaît en plein vol (par ex. un redémarrage du hub) apparaît comme un fantôme orphelin au lieu de disparaître silencieusement.

</td>
</tr>
<tr>
<td width="50%">

### 🔌 Fournisseurs personnalisés

Apportez votre propre endpoint (Base URL + clé API + modèles) ou un modèle de commande local. Chaque fournisseur dispose d'un test de connectivité qui vérifie l'accessibilité et l'authentification, puis effectue un véritable appel vision pour que vous le sachiez maintenant, pas en pleine tâche.

</td>
<td width="50%">

### 📦 Installation en un clic

La page de paramètres installe et met à jour le plugin Claude Code, les fichiers de rôle Codex et les agents, skills et commandes Antigravity / Grok pour vous — enregistrement marketplace, liste blanche de permissions, câblage HUD, chemins absolus rendus pour cette machine — et les restaure tout aussi facilement. Chaque fichier de paramètres est d'abord sauvegardé.

</td>
</tr>
</table>

## Comment ça marche

```
Claude Code / Codex / Antigravity / Grok (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → that external CLI runs the task (explicit opt-in)
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

<p align="center"><sub>Le panneau est aussi le tableau des jobs : les jobs en cours et terminés restent listés avec tier, progression et tokens, les espaces de travail détenus indiquent leurs détenteurs, et un job qui disparaît en plein vol (un redémarrage du hub) apparaît comme un fantôme orphelin au lieu de disparaître silencieusement.</sub></p>

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

Seul le fallback standalone a besoin d'une clé propre : envoyer du travail depuis un hôte sans instance DSH en cours d'exécution lance un worker runtime comme processus séparé. Récupérez une clé API sur [platform.deepseek.com](https://platform.deepseek.com) et écrivez-la dans `~/.config/dsh-crew/.env` :

```
DEEPSEEK_API_KEY=sk-...
```

### Vérifier

```bash
node scripts/smoke.mjs
```

Le smoke test envoie une tâche peu coûteuse par le chemin disponible — le hub si une instance DSH tourne, sinon standalone — et affiche lequel a été utilisé. En une dizaine de secondes, `smoke test passed — configuration OK` doit s'afficher. En cas d'échec, la raison est imprimée et limitée au chemin qui a été testé.

Ouvrez ensuite Réglages → DSH Crew pour installer les intégrations hôte — Claude Code, Codex, Antigravity, Grok — en un clic, ou pilotez le même installeur depuis la ligne de commande :

```bash
node src/install/cli.mjs claude   # Claude Code plugin: marketplace + permissions + HUD segment
node src/install/cli.mjs codex    # Codex agents + prompts
node src/install/cli.mjs agy      # Antigravity MCP config + agents + skills
node src/install/cli.mjs grok     # Grok MCP config + agents + commands
node src/install/cli.mjs all      # all four hosts at once
# uninstall symmetrically (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

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
| `/dsh-crew:playbook` | Bonnes pratiques d'envoi : choisir flash ou pro, briefs autonomes, parallélisme, vérification des résultats, garde-fous |

## Codex

### Installation

Il est recommandé d'utiliser l'installeur (génère automatiquement les chemins pour cette machine, copie les prompts `/dsh-config`, `/dsh-status` et `/dsh-playbook`) :

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

Trois prompts sont installés pour Codex :

| Commande | Effet |
|---|---|
| `/dsh-config` | Afficher ou définir les valeurs par défaut de la session : `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<secondes>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | État en direct des jobs worker : tier, progression, tokens, outil courant |
| `/dsh-playbook` | Bonnes pratiques d'envoi : choisir flash ou pro, briefs autonomes, parallélisme, vérification des résultats, garde-fous |

## Antigravity (agy)

### Installation

```bash
node src/install/cli.mjs agy
```

Enregistre le serveur MCP dsh-crew dans `~/.gemini/config/mcp_config.json` et installe les agents `ds-flash` / `ds-pro` ainsi que les skills `dsh-config`, `dsh-status` et `dsh-playbook` dans `~/.gemini/config/` (tous les fichiers sont d'abord sauvegardés). Redémarrez la session après l'installation.

### Utilisation

- Choisissez `ds-flash` ou `ds-pro` comme agent pour envoyer des tâches
- `dsh_worker_config` lit ou remplace les valeurs par défaut de la session

### Skills de session

| Skill | Effet |
|---|---|
| `/dsh-config` | Afficher ou définir les valeurs par défaut de la session (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | État en direct des jobs worker : tier, progression, tokens, outil courant |
| `/dsh-playbook` | Bonnes pratiques d'envoi : choisir flash ou pro, briefs autonomes, parallélisme, vérification des résultats, garde-fous |

### Mises en garde

- agy exécute les workers avec **approbation totale** (`--dangerously-skip-permissions` + accept-edits) : agy 1.1.16 n'a pas de mode de permission limité à l'espace de travail, un worker headless doit donc auto-approuver les demandes d'outils.

Désinstallation : `node src/install/cli.mjs uninstall-agy`

## Grok

### Installation

```bash
node src/install/cli.mjs grok
```

Écrit la section `[mcp_servers.dsh-crew]` dans `~/.grok/config.toml` et installe les agents `ds-flash` / `ds-pro` ainsi que les commandes `/dsh-config`, `/dsh-status` et `/dsh-playbook` dans `~/.grok/` (tous les fichiers sont d'abord sauvegardés).

### Utilisation

- Choisissez `ds-flash` ou `ds-pro` comme agent pour envoyer des tâches

### Commandes de session

| Commande | Effet |
|---|---|
| `/dsh-config` | Afficher ou définir les valeurs par défaut de la session (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | État en direct des jobs worker : tier, progression, tokens, outil courant |
| `/dsh-playbook` | Bonnes pratiques d'envoi : choisir flash ou pro, briefs autonomes, parallélisme, vérification des résultats, garde-fous |

### Mises en garde

- Par conception de sécurité, grok ne démarre pas les serveurs MCP au niveau du dépôt dans les répertoires de projet non fiables (`grok mcp doctor` signale « folder untrusted ») ; une installation globale n'est pas affectée — changez de répertoire ou passez `--trust`.
- Les workers grok s'exécutent avec `bypassPermissions` (toujours approuver, comme le recommandent les docs grok pour l'automatisation headless) ; les règles de refus et les hooks s'appliquent toujours.

Désinstallation : `node src/install/cli.mjs uninstall-grok`

## Outils MCP

| Outil | Description |
|---|---|
| `dsh_run_worker` | Envoi de tâche bloquant (`tier` : flash/pro, `effort` : off/high/max, `cwd`, `worker`), attend le résultat |
| `dsh_spawn_worker` | Envoi asynchrone, renvoie un identifiant de job (pour le fan-out parallèle) ; récupérez les résultats avec `dsh_worker_result` |
| `dsh_worker_status` | Progression en temps réel de tous les jobs (turn/step/outil actuel/token) + verrous consultatifs cwd |
| `dsh_worker_result` | Récupère le résultat, peut spécifier `wait_seconds` pour attendre |
| `dsh_worker_cancel` | Annule le job spécifié et termine son processus runtime |
| `dsh_worker_config` | Lit/définit les valeurs par défaut de la session (tier, effort, mode, timeout, policy, escalation) et liste les `worker_profiles` |

La progression est simultanément répliquée dans `~/.config/dsh-crew/status.d/` (un fichier shard par écrivain, lisible par statusline / surveillance externe).

## Garde-fous d'envoi

Chaque envoi est vérifié avant que quoi que ce soit ne soit lancé — les refus sont des erreurs lisibles, jamais des files d'attente silencieuses :

- **Chaîne d'origine** : chaque envoi ajoute un saut à la chaîne d'origine worker→worker. Une imbrication plus profonde que la limite (`origin_depth_limit`, 3 par défaut) est refusée, tout comme tout cycle (le même backend + cwd apparaissant deux fois) — le garde-fou qui arrête l'auto-amplification récursive des workers.
- **Verrou consultatif cwd** : un seul worker en cours par espace de travail. Un second envoi dans un espace de travail détenu est refusé avec l'identifiant de job du détenteur, son backend et son heure de démarrage — attendez qu'il se termine, annulez-le avec `dsh_worker_cancel`, ou passez `allow_concurrent_cwd: true` (tâches en lecture seule uniquement).

## Playbook d'envoi

Comment *bien* envoyer — flash ou pro, des briefs autonomes, un parallélisme sûr, la vérification des résultats et les garde-fous ci-dessus — est fourni sous forme de playbook par hôte : `/dsh-crew:playbook` (skill Claude Code), `/dsh-playbook` (prompt Codex, skill Antigravity, commande Grok).

## Backends CLI explicites

`worker="agy"` / `worker="grok"` épingle un envoi à cette CLI externe (backend × modèle × effort) au lieu de la logique de tier DSH. C'est un opt-in explicite — il n'y a pas de valeur par défaut, ne le définissez donc que lorsque l'utilisateur demande cette CLI. Mises en garde : grok refuse de démarrer des serveurs MCP locaux au dépôt dans des dossiers non fiables, et agy exécute les workers avec une approbation totale (pas de mode de permission limité à l'espace de travail).

## Multimodal : vision et génération d'images

**DeepSeek est un modèle uniquement textuel** et ne prend pas en charge la saisie ou la génération d'images. Ce plugin obtient ces capacités en externe via des outils MCP :

**La vision native d'abord** : lorsque le fournisseur de vision est une CLI intégrée (ou explicitement `native`), `describe_image` essaie d'abord le propre modèle VL de DeepSeek `deepseek-v4-flash-vision-exp` (appel API direct ; clé depuis `DEEPSEEK_API_KEY` ou `~/.config/dsh-crew/.env`). Tout échec se replie gracieusement sur la chaîne de fournisseurs CLI ci-dessous, conservée comme fallback. La génération d'images n'est pas touchée — le modèle natif ne fait que regarder des images.

| Outil | Description |
|---|---|
| `describe_image` | Répond aux questions en visualisant des images (captures d'écran, maquettes, graphiques, etc.) ; résultats mis en cache par fournisseur + modèle + image + question |
| `generate_image` | Génère une image à partir d'une description textuelle, l'enregistre dans le chemin absolu spécifié ; la sortie est un bitmap plat (nécessite OpenPencil pour l'édition en couches) |

**Collage d'images en session** : dans DSH, passez le modèle sur `DeepSeek (vision) ◉` pour coller directement des images. Les images restent dans la session et s'affichent normalement ; le plugin ajoute le texte transcrit après elles et retire les images avant l'envoi — vous voyez l'image, le modèle lit le texte. La transcription suit la même échelle « natif d'abord » : le modèle VL de DeepSeek lorsqu'une clé est disponible, puis votre fournisseur CLI configuré.

### Configuration

Dans **la page de paramètres DSH → DSH Crew → Multimodal** (ou modifiez directement `~/.config/dsh-crew/config.json`) :

**Fournisseur de vision** (visualisation d'images) :

- `native` / `deepseek-native` (le propre modèle VL de DeepSeek — essayé en premier automatiquement pour chaque fournisseur intégré dès qu'une clé est disponible)
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
  - `POST /_dsh/dsh-crew/install` : installation en un clic des intégrations hôte — Claude Code / Codex / Antigravity / Grok (backend de `src/install/`)
- **Détection automatique** : le shim MCP des hôtes détecte automatiquement le hub (variable d'environnement `DSH_CREW_HUB`, défaut `http://127.0.0.1:3080`)
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
- **Recommandation** : lors des itérations de développement local, il est recommandé d'activer le mode hub ; la progression des workers peut être entièrement observée dans la Web UI ; pour la collaboration entre machines ou les environnements sans Web UI, utilisez l'approche shell de l'hôte d'envoi

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

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — un émulateur Android ou un appareil USB, en direct dans la conversation, piloté entièrement via adb
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — un simulateur iOS — et un iPhone en USB — vivants dans la conversation
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — mémoire à long terme pour DSH
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — inspecter et modifier les documents de conception `.op` dans une conversation

## Licence

MIT
