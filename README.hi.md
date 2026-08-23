<p align="center">
  <img src="./docs/images/dsh-crew-logo.png" alt="DSH Crew" width="120" />
</p>

<h1 align="center">DSH Crew</h1>

<p align="center">
  <strong>एक <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> प्लगइन: Claude Code / Codex / Antigravity / Grok से DSH एजेंटों में काम भेजें, बिना होस्ट के नेटिव सबएजेंट UI को छोड़े।</strong><br />
  <sub>नेटिव प्रगति UI &bull; टियर पॉलिसी और एस्केलेशन &bull; डिस्पैच गार्डरेल &bull; जॉब्स बोर्ड &bull; इन-होस्ट DSH सेशन &bull; विजन और इमेज जनरेशन (नेटिव-फर्स्ट) &bull; वन-क्लिक इंस्टॉल</sub>
</p>

<p align="center">
  <sub>npm: <code>@zseven-w/dsh-crew</code> &middot; वर्तमान प्लगइन रिलीज: <code>0.1.0-rc.4</code> &middot; DSH <code>0.1.1-rc.1</code> के साथ परीक्षित</sub>
</p>

<p align="center">
  <a href="./README.md">English</a> &middot; <a href="./README.zh.md">简体中文</a> &middot; <a href="./README.zh-TW.md">繁體中文</a> &middot; <a href="./README.ja.md">日本語</a> &middot; <a href="./README.ko.md">한국어</a> &middot; <a href="./README.fr.md">Français</a> &middot; <a href="./README.es.md">Español</a> &middot; <a href="./README.de.md">Deutsch</a> &middot; <a href="./README.pt.md">Português</a> &middot; <a href="./README.ru.md">Русский</a> &middot; <a href="./README.hi.md"><b>हिन्दी</b></a> &middot; <a href="./README.tr.md">Türkçe</a> &middot; <a href="./README.th.md">ไทย</a> &middot; <a href="./README.vi.md">Tiếng Việt</a> &middot; <a href="./README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <a href="https://github.com/ZSeven-W/dsh-crew/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ZSeven-W/dsh-crew?color=64748b" alt="License" /></a>
</p>

<br />

<p align="center">
  <img src="./docs/images/dsh-crew-overview.png" alt="DSH Crew — settings page" width="100%" />
</p>
<p align="center"><sub>DSH Crew सेटिंग्स पेज - होस्ट इंटीग्रेशन, डिस्पैच पॉलिसी, निष्पादन और मल्टीमोडल ब्रिज</sub></p>

## DSH Crew क्यों

DSH Crew एक प्लगइन है [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) के लिए - एक ओपन-सोर्स एजेंट हार्नेस। यह DSH एजेंटों को Claude Code, Codex, Antigravity और Grok से डिस्पैच करने योग्य बनाता है: ऑर्केस्ट्रेटर अपना मॉडल रखता है, काम एक वास्तविक DSH एजेंट पर चलता है जिसके पास उस हार्नेस के टूल, सैंडबॉक्स, प्रीसेट और सेशन हिस्ट्री होती है, और होस्ट अभी भी इसे एक नेटिव सबएजेंट के रूप में दिखाता है जिसमें लाइव प्रगति होती है।

काम को क्या चलाता है वह एक DSH एजेंट है, न कि एक बेयर मॉडल कॉल। टियर (`flash` / `pro`) चुनते हैं कि एजेंट को हार्नेस की कॉन्फ़िगर्ड रोस्टर से कितनी क्षमता मिलेगी - आज DeepSeek V4 Flash और V4 Pro - तो DSH में मॉडल का परिवर्तन यहां कोई परिवर्तन नहीं चाहिए।

<table>
<tr>
<td width="50%">

### 🧵 नेटिव प्रगति UI

कार्यकर्ता Claude Code / Codex / Antigravity / Grok में नियमित सबएजेंट के रूप में दिखाई देते हैं - डिस्पैच काउंट, चल रहे स्टेप, टूल कॉल और टोकन उपयोग सभी होस्ट के अपने टास्क पैनल में दिखाई देते हैं, साथ ही एक claude-hud स्टेटसलाइन सेगमेंट: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3`।

</td>
<td width="50%">

### 🎚️ टियर पॉलिसी और एस्केलेशन

यांत्रिक काम के लिए `flash`, तर्क के लिए `pro`, `effort` को `off` से `max` तक। `tier_policy` टूल लेयर पर हर डिस्पैच को एक टियर तक सीमित कर सकता है, और `escalate_on_failure` विफल flash रन को pro पर एक बार फिर से प्रयास करता है - अनुमान पर नहीं, साक्ष्य पर।

</td>
</tr>
<tr>
<td width="50%">

### 🏛️ इन-होस्ट DSH सेशन

DSH प्रोफाइल में बंडल स्थापित होने के साथ, प्रत्येक कार्यकर्ता एक फर्स्ट-क्लास DSH सेशन है: वेब UI में दृश्यमान, कार्य निर्देशिका द्वारा समूहीकृत, आपके द्वारा प्रति टियर चुने गए एजेंट प्रीसेट के साथ माउंट किया गया। DSH चलाए बिना, डिस्पैच एक स्टैंडअलोन DSH रनटाइम पर वापस आता है, इसलिए CI और हेडलेस वातावरण अभी भी काम करते हैं।

</td>
<td width="50%">

### 👁️ विजन और इमेज जनरेशन

DSH के मॉडल केवल पाठ हैं। `describe_image` अब DeepSeek के अपने VL मॉडल (`deepseek-v4-flash-vision-exp`) को प्राथमिकता देता है जब भी key उपलब्ध हो, फिर उन CLI पर वापस आता है जो आपके पास पहले से हैं - Claude, Codex, Grok, Antigravity - या किसी OpenAI-संगत API का जो आप कॉन्फ़िगर करते हैं। `generate_image` उन्हीं CLI का ब्रश उधार लेता है। चिपकाई गई छवियां बातचीत में दृश्यमान रहती हैं और मॉडल तक पाठ के रूप में पहुंचती हैं।

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ डिस्पैच गार्डरेल

हर डिस्पैच की जांच कुछ भी शुरू होने से पहले होती है। worker→worker नेस्टिंग origin-chain गहराई 3 तक सीमित है और चक्र अस्वीकार किए जाते हैं; किसी ऐसे workspace पर दूसरा worker जिसे कोई दूसरा job पहले से रखता है, धारक की जानकारी के साथ अस्वीकार होता है — कभी चुपचाप कतार में नहीं डाला जाता। अस्वीकरण पठनीय त्रुटियां हैं: प्रतीक्षा करें या दायरा फिर तय करें, बायपास न करें।

</td>
<td width="50%">

### 📋 जॉब्स बोर्ड

DSH Crew पैनल एक जॉब्स बोर्ड के रूप में भी काम करता है: हर worker job — चल रहा या समाप्त — tier, effort, लाइव प्रगति और tokens के साथ सूचीबद्ध है, रखे गए workspaces अपने धारक दिखाते हैं, और एक job जो बीच उड़ान में गायब हो जाता है (जैसे hub रीस्टार्ट) चुपचाप गायब होने के बजाय एक अनाथ ghost के रूप में सामने आता है।

</td>
</tr>
<tr>
<td width="50%">

### 🔌 कस्टम प्रदाता

अपना एंडपॉइंट (Base URL + API key + मॉडल) लाएं या एक स्थानीय कमांड टेम्पलेट। प्रत्येक प्रदाता के पास एक कनेक्टिविटी परीक्षण है जो पहुंच और प्रमाणीकरण की जांच करता है, फिर एक वास्तविक विजन कॉल करता है ताकि आप अब पता लगें, कार्य के बीच में नहीं।

</td>
<td width="50%">

### 📦 वन-क्लिक इंस्टॉल

सेटिंग्स पेज आपके लिए Claude Code प्लगइन, Codex भूमिका फाइलें और Antigravity / Grok के agents, skills और commands स्थापित और अपडेट करता है - मार्केटप्लेस पंजीकरण, अनुमति allowlist, HUD वायरिंग, इस मशीन के लिए रेंडर किए गए पूर्ण पथ - और उन्हें उतना ही आसानी से पुनः स्थापित करता है। हर सेटिंग फाइल पहले बैकअप ली जाती है।

</td>
</tr>
</table>

## यह कैसे काम करता है

```
Claude Code / Codex / Antigravity / Grok (orchestrator, keeps its own model)
  └─ ds-flash / ds-pro  ← native subagent shell (progress shows in the host's task UI)
       └─ MCP: dsh_run_worker(tier, effort, cwd, worker=)
            ├─ worker="agy"/"grok" → that external CLI runs the task (explicit opt-in)
            ├─ hub reachable → session inside DSH (visible in the Web UI, grouped by cwd)
            └─ otherwise     → dsh-jsonrpc-agent runtime (worker.cordis.yml)
                 └─ DeepSeek V4 Flash / Pro (DSH SDK, event stream → progress and token stats)
```

## एक रन, दो नज़रिये

डिस्पैच चौड़ाई में फैलता है। नीचे अठारह worker इस README का समानांतर अनुवाद कर रहे हैं: होस्ट उन्हें अपने subagent गिनता है, जबकि harness उन्हें असली session के रूप में चलाता है।

<p align="center">
  <img src="./docs/images/dsh-crew-host.png" alt="Claude Code" width="100%" />
</p>
<p align="center"><sub>Claude Code में dsh-crew के worker नेटिव subagent दिखते हैं; statusline सेगमेंट चल रहे tier, बीता समय और token दिखाता है।</sub></p>

<p align="center">
  <img src="./docs/images/dsh-crew-jobs.png" alt="DSH Crew" width="100%" />
</p>
<p align="center"><sub>DSH Crew पैनल वही रन harness की तरफ़ से दिखाता है: कौन-सा होस्ट किस job को भेजा, उसका tier और effort, लाइव प्रगति और token खपत।</sub></p>

<p align="center"><sub>पैनल जॉब्स बोर्ड भी है: चल रहे और समाप्त jobs tier, प्रगति और tokens के साथ सूचीबद्ध रहते हैं, रखे गए workspaces अपने धारक का नाम बताते हैं, और एक job जो बीच उड़ान में गायब हो जाता है (hub रीस्टार्ट) चुपचाप गायब होने के बजाय अनाथ ghost के रूप में सामने आता है।</sub></p>

## इंस्टॉल

npm से DSH प्रोफ़ाइल में इंस्टॉल करें:

```bash
dsh plugin --profile web add @zseven-w/dsh-crew@latest
dsh web
```

या, सोर्स ट्री से लोकल डेवलपमेंट के लिए:

```bash
dsh plugin --profile web add link:/path/to/dsh-crew
dsh web
```

`link:` प्रोटोकॉल प्रोफ़ाइल डिपेंडेंसी को इस रिपॉज़िटरी से symlink करता है, इसलिए हर rebuild तुरंत दिखता है।

### DeepSeek क्रेडेंशियल सेट करें (केवल standalone)

hub mode में — ऊपर दिया गया इंस्टॉलेशन — worker DSH इंस्टेंस के अंदर चलते हैं और उन्हीं DeepSeek क्रेडेंशियल का उपयोग करते हैं जो DSH इंस्टेंस में पहले से कॉन्फ़िगर हैं। कुछ और सेट करने की आवश्यकता नहीं है।

केवल standalone fallback को अपनी key की आवश्यकता है: किसी host से DSH इंस्टेंस चलाए बिना डिस्पैच करने से एक अलग प्रक्रिया के रूप में worker runtime लॉन्च होता है। [platform.deepseek.com](https://platform.deepseek.com) से API key प्राप्त करें और इसे `~/.config/dsh-crew/.env` में लिखें:

```
DEEPSEEK_API_KEY=sk-...
```

### जाँच

```bash
node scripts/smoke.mjs
```

smoke test उपलब्ध किसी भी पथ के माध्यम से एक सस्ता job dispatch करता है — जब DSH instance चल रहा हो तो hub, अन्यथा standalone — और उपयोग किए गए पथ को प्रिंट करता है। लगभग दस सेकंड में आपको `smoke test passed — configuration OK` दिखना चाहिए। विफलता पर कारण प्रिंट होता है, जो परीक्षित पथ तक सीमित होता है।

फिर Settings → DSH Crew खोलकर host इंटीग्रेशन — Claude Code, Codex, Antigravity, Grok — एक क्लिक में इंस्टॉल करें, या उसी इंस्टॉलर को कमांड लाइन से चलाएं:

```bash
node src/install/cli.mjs claude   # Claude Code plugin: marketplace + permissions + HUD segment
node src/install/cli.mjs codex    # Codex agents + prompts
node src/install/cli.mjs agy      # Antigravity MCP config + agents + skills
node src/install/cli.mjs grok     # Grok MCP config + agents + commands
node src/install/cli.mjs all      # all four hosts at once
# uninstall symmetrically (uninstall-claude | uninstall-codex | uninstall-agy | uninstall-grok):
node src/install/cli.mjs uninstall-claude
```

## पृष्ठभूमि और शब्दावली

- **DSH** (DeepSeek Harness): DeepSeek का ओपन-सोर्स एजेंट हार्नेस, एक वेब UI फॉर्म में कोड एजेंट, Claude Code के समान लेकिन DeepSeek मॉडल चलाता है।
- **MCP** (Model Context Protocol): Anthropic की AI टूल इंटीग्रेशन प्रोटोकॉल, LLM को बाहरी टूल और डेटा स्रोत को सुरक्षित रूप से कॉल करने में सक्षम बनाता है।
- **Cordis bundle**: DSH की प्लगइन प्रारूप; यह प्रोजेक्ट स्टैंडअलोन MCP सेवा के रूप में चला सकता है या DSH Web में hub मोड में स्थापित कर सकता है।
- **tier**: क्षमता टियर - कार्यकर्ता को DSH की कॉन्फ़िगर्ड मॉडल रोस्टर का कौन सा स्लॉट मिलता है। `flash` तेज़ और सस्ता है (सरल कार्य), `pro` कठिन तर्क करता है (जटिल समस्याएं)। आज वे DeepSeek V4 Flash और V4 Pro में मैप करते हैं; DSH में मॉडल स्वैप करें और यहां कुछ नहीं बदलता।
- **worker**: काम करने वाला DSH एजेंट - अपने स्वयं के टूल, सैंडबॉक्स और प्रीसेट के साथ एक पूर्ण सेशन, एक बेयर मॉडल कॉल नहीं।
- **effort**: तर्क शक्ति, `off` = कोई तर्क नहीं, `high` = उच्च तर्क निवेश, `max` = अधिकतम तर्क निवेश।

## Claude Code

### स्थापना

वन-क्लिक स्थापना (एक चुनें):

- **DSH सेटिंग्स पेज** (जब hub मोड स्थापित हो): सेटिंग्स → DSH Crew → "Claude Code में स्थापित करें"
- **कमांड लाइन**: `node src/install/cli.mjs all`

दोनों एक ही काम करते हैं: स्थानीय मार्केटप्लेस पंजीकृत करें (माता-पिता की निर्देशिका `dsh-plugins/` को मार्केटप्लेस रूट के रूप में) + `claude plugin install` + MCP टूल अनुमति allowlist + claude-hud कार्यकर्ता स्थिति सेगमेंट कॉन्फ़िगरेशन (परिवर्तनों से पहले settings.json को ऑटो-बैकअप करें, idempotent)। **परिवर्तनों को प्रभावी होने के लिए स्थापना के बाद सेशन पुनः प्रारंभ करें।**

### उपयोग

- सीधे बातचीत में कहें "dispatch X to ds-flash" या "dispatch X to ds-pro", और सबएजेंट कार्य निष्पादित करता है
- डिस्पैच काउंट और रीयल-टाइम प्रगति Claude Code टास्क UI में दिखाई दी
- **HUD स्टेटसलाइन सेगमेंट**: `⚙dsh 1▶pro 2m14s 21.7k/606 ✓3` (वर्तमान टियर / बीता हुआ समय / टोकन उपयोग / पूर्णता काउंट)
  - स्थानीय विकास के लिए, `statusline/statusline.sh` या `statusline/worker-segment.sh` को स्वतंत्र रूप से एकीकृत किया जा सकता है
- **लंबे समय चलने वाले कार्य**: CC के पास MCP कॉल पर समय सीमा है (`MCP_TOOL_TIMEOUT` समायोज्य), लंबे कार्य ऑर्केस्ट्रेटर को `dsh_spawn_worker` + `dsh_worker_result(wait_seconds)` पोलिंग का उपयोग कर सकते हैं
- **स्थानीय विकास और डिबगिंग**: `claude --plugin-dir /path/to/dsh-crew` अस्थायी रूप से लोड करने के लिए


### सेशन कमांड

ये केवल मौजूदा सेशन के लिए ग्लोबल डिफ़ॉल्ट को ओवरराइड करते हैं और प्रॉम्प्ट नहीं, टूल लेयर पर लागू होते हैं:

| कमांड | क्या करता है |
|---|---|
| `/dsh-crew:config` | इस सेशन के डिफ़ॉल्ट देखें या सेट करें: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<सेकंड>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-crew:on` · `/dsh-crew:off` | इस सेशन में डिस्पैच चालू या बंद करें (बंद एक हार्ड स्विच है: टूल मना कर देता है) |
| `/dsh-crew:status` | worker jobs की लाइव स्थिति: tier, प्रगति, tokens, मौजूदा टूल |
| `/dsh-crew:playbook` | डिस्पैच सर्वोत्तम अभ्यास: flash बनाम pro चुनना, आत्मनिर्भर ब्रीफ, समानांतरता, परिणाम सत्यापन, गार्डरेल |

## Codex

### स्थापना

इंस्टॉलर का उपयोग करने की अनुशंसा की जाती है (इस मशीन के लिए पथ ऑटो-रेंडर करता है, `/dsh-config`, `/dsh-status` और `/dsh-playbook` prompts कॉपी करता है):

```bash
node src/install/cli.mjs codex
```

या मैन्युअल रूप से कॉपी करें (कॉपी करने के बाद मैन्युअल पथ संशोधन की आवश्यकता है):

```bash
cp codex/agents/*.toml ~/.codex/agents/    # global or project-level .codex/agents/
```

भूमिका फाइलें पूर्व-कॉन्फ़िगर की गई हैं:

- MCP सर्वर माउंटिंग कॉन्फ़िगरेशन
- `default_tools_approval_mode = "approve"` (**आवश्यक**, अन्यथा टूल कॉल exec मोड में ऑटो-रद्द हो जाते हैं)
- `tool_timeout_sec = 3600`

**नोट**: मैन्युअल रूप से कॉपी करते समय, `args` फील्ड में पूर्ण पथ वास्तविक स्थापना स्थान से मेल खाने के लिए अपडेट किया जाना चाहिए; इंस्टॉलर यह स्वचालित रूप से संभालता है।

### उपयोग

- इंटरैक्टिव TUI में, "spawn ds-pro to ..." का चयन करें कार्य डिस्पैच करने के लिए; Active/Done पैनल प्रगति दिखाते हैं
- `codex exec` मोड भी सीधे `dsh_run_worker` कॉल कर सकता है


### सेशन कमांड

Codex के लिए तीन prompts इंस्टॉल होते हैं:

| कमांड | क्या करता है |
|---|---|
| `/dsh-config` | इस सेशन के डिफ़ॉल्ट देखें या सेट करें: `tier=flash\|pro`, `effort=off\|high\|max`, `mode=auto\|hub\|standalone`, `timeout=<सेकंड>`, `policy=auto\|flash-only\|pro-only`, `escalate=true\|false`, `reset` |
| `/dsh-status` | worker jobs की लाइव स्थिति: tier, प्रगति, tokens, मौजूदा टूल |
| `/dsh-playbook` | डिस्पैच सर्वोत्तम अभ्यास: flash बनाम pro चुनना, आत्मनिर्भर ब्रीफ, समानांतरता, परिणाम सत्यापन, गार्डरेल |

## Antigravity (agy)

### स्थापना

```bash
node src/install/cli.mjs agy
```

dsh-crew MCP server को `~/.gemini/config/mcp_config.json` में पंजीकृत करता है और `ds-flash` / `ds-pro` agents तथा `dsh-config`, `dsh-status` और `dsh-playbook` skills को `~/.gemini/config/` में इंस्टॉल करता है (सभी फाइलें पहले बैकअप होती हैं)। इंस्टॉलेशन के बाद सेशन पुनः प्रारंभ करें।

### उपयोग

- कार्य भेजने के लिए `ds-flash` या `ds-pro` को agent के रूप में चुनें
- `dsh_worker_config` सेशन डिफ़ॉल्ट पढ़ता है या ओवरराइड करता है

### सेशन skills

| Skill | क्या करता है |
|---|---|
| `/dsh-config` | इस सेशन के डिफ़ॉल्ट देखें या सेट करें (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | worker jobs की लाइव स्थिति: tier, प्रगति, tokens, मौजूदा टूल |
| `/dsh-playbook` | डिस्पैच सर्वोत्तम अभ्यास: flash बनाम pro चुनना, आत्मनिर्भर ब्रीफ, समानांतरता, परिणाम सत्यापन, गार्डरेल |

### सावधानियां

- agy workers को **पूर्ण अनुमोदन** के साथ चलाता है (`--dangerously-skip-permissions` + accept-edits): agy 1.1.16 में workspace-स्कोप्ड अनुमति मोड नहीं है, इसलिए headless worker को टूल अनुरोध स्वतः-अनुमोदित करने पड़ते हैं।

अनइंस्टॉल: `node src/install/cli.mjs uninstall-agy`

## Grok

### स्थापना

```bash
node src/install/cli.mjs grok
```

`[mcp_servers.dsh-crew]` सेक्शन को `~/.grok/config.toml` में लिखता है और `ds-flash` / `ds-pro` agents तथा `/dsh-config`, `/dsh-status` और `/dsh-playbook` commands को `~/.grok/` में इंस्टॉल करता है (सभी फाइलें पहले बैकअप होती हैं)।

### उपयोग

- कार्य भेजने के लिए `ds-flash` या `ds-pro` को agent के रूप में चुनें

### सेशन commands

| Command | क्या करता है |
|---|---|
| `/dsh-config` | इस सेशन के डिफ़ॉल्ट देखें या सेट करें (tier / effort / mode / timeout / policy / escalation / reset) |
| `/dsh-status` | worker jobs की लाइव स्थिति: tier, प्रगति, tokens, मौजूदा टूल |
| `/dsh-playbook` | डिस्पैच सर्वोत्तम अभ्यास: flash बनाम pro चुनना, आत्मनिर्भर ब्रीफ, समानांतरता, परिणाम सत्यापन, गार्डरेल |

### सावधानियां

- सुरक्षा डिज़ाइन के कारण, grok अविश्वसनीय प्रोजेक्ट निर्देशिकाओं में repo-स्तरीय MCP servers शुरू नहीं करता (`grok mcp doctor` "folder untrusted" रिपोर्ट करता है); वैश्विक इंस्टॉल प्रभावित नहीं होता — निर्देशिका बदलें या `--trust` दें।
- grok workers `bypassPermissions` (always-approve, जैसा grok डॉक्स headless ऑटोमेशन के लिए सुझाते हैं) के साथ चलते हैं; deny नियम और hooks फिर भी लागू होते हैं।

अनइंस्टॉल: `node src/install/cli.mjs uninstall-grok`

## MCP उपकरण

| उपकरण | विवरण |
|---|---|
| `dsh_run_worker` | ब्लॉकिंग टास्क डिस्पैच (`tier`: flash/pro, `effort`: off/high/max, `cwd`, `worker`), परिणाम के लिए प्रतीक्षा करता है |
| `dsh_spawn_worker` | एसिंक्रोनस टास्क डिस्पैच, job id रिटर्न करता है (समानांतर fan-out के लिए); परिणाम `dsh_worker_result` से इकट्ठा करें |
| `dsh_worker_status` | सभी job की रीयल-टाइम प्रगति (turn/step/current tool/token) + cwd advisory locks |
| `dsh_worker_result` | परिणाम प्राप्त करें, `wait_seconds` निर्दिष्ट कर सकता है प्रतीक्षा करने के लिए |
| `dsh_worker_cancel` | निर्दिष्ट job को रद्द करें, इसकी रनटाइम प्रक्रिया समाप्त करें |
| `dsh_worker_config` | सेशन डिफ़ॉल्ट पढ़ें/सेट करें (tier, effort, mode, timeout, policy, escalation) और `worker_profiles` सूचीबद्ध करें |

प्रगति एक साथ `~/.config/dsh-crew/status.d/` में मिरर की जाती है (प्रति लेखक एक शार्ड फाइल, statusline / बाहरी निगरानी द्वारा पढ़ी जा सकती है)।

## डिस्पैच गार्डरेल

हर डिस्पैच की जांच कुछ भी शुरू होने से पहले होती है — अस्वीकरण पठनीय त्रुटियां हैं, कभी मूक कतारें नहीं:

- **Origin chain**: हर डिस्पैच worker→worker origin chain में एक hop जोड़ता है। सीमा से गहरी नेस्टिंग (`origin_depth_limit`, डिफ़ॉल्ट 3) अस्वीकार होती है, और कोई भी चक्र भी (वही backend + cwd दो बार आना) — वह रक्षक जो पुनरावर्ती worker स्व-विस्तार रोकता है।
- **cwd advisory lock**: प्रति workspace एक चालू worker। किसी रखे गए workspace में दूसरा डिस्पैच धारक की job id, backend और प्रारंभ समय के साथ अस्वीकार होता है — उसके समाप्त होने की प्रतीक्षा करें, उसे `dsh_worker_cancel` से रद्द करें, या `allow_concurrent_cwd: true` दें (केवल पठन-मात्र कार्य)।

## डिस्पैच प्लेबुक

*अच्छी तरह* डिस्पैच कैसे करें — flash बनाम pro, आत्मनिर्भर ब्रीफ, सुरक्षित समानांतरता, परिणाम सत्यापन, और ऊपर के गार्डरेल — प्रति host एक प्लेबुक के रूप में बंडल है: `/dsh-crew:playbook` (Claude Code skill), `/dsh-playbook` (Codex prompt, Antigravity skill, Grok command)।

## स्पष्ट CLI बैकएंड

`worker="agy"` / `worker="grok"` एक डिस्पैच को DSH tier तर्क के बजाय उस बाहरी CLI (backend × model × effort) पर पिन करता है। यह स्पष्ट ऑप्ट-इन है — कोई डिफ़ॉल्ट नहीं है, इसलिए इसे केवल तब सेट करें जब उपयोगकर्ता उस CLI की मांग करे। सावधानियां: grok अविश्वसनीय फ़ोल्डरों में repo-स्थानीय MCP servers शुरू करने से मना करता है, और agy workers को पूर्ण अनुमोदन के साथ चलाता है (कोई workspace-स्कोप्ड अनुमति मोड नहीं)।

## मल्टीमोडल: विजन और इमेज जनरेशन

**DeepSeek एक टेक्स्ट-ओनली मॉडल है** और इमेज इनपुट या जनरेशन का समर्थन नहीं करता है। यह प्लगइन ये क्षमताएं MCP उपकरणों के माध्यम से बाहरी रूप से प्राप्त करता है:

**नेटिव विजन पहले**: जब विजन प्रदाता एक अंतर्निहित CLI है (या स्पष्ट रूप से `native`), तो `describe_image` पहले DeepSeek के अपने VL मॉडल `deepseek-v4-flash-vision-exp` को आज़माता है (सीधा API कॉल; key `DEEPSEEK_API_KEY` या `~/.config/dsh-crew/.env` से)। कोई भी विफलता नीचे दी गई CLI प्रदाता श्रृंखला पर सहजता से गिरती है, जो fallback के रूप में बनी रहती है। इमेज जनरेशन अछूता है — नेटिव मॉडल केवल चित्र देखता है।

| उपकरण | विवरण |
|---|---|
| `describe_image` | छवियों (स्क्रीनशॉट, डिज़ाइन, चार्ट, आदि) को देखकर प्रश्नों का उत्तर दें, परिणाम प्रदाता + मॉडल + छवि + प्रश्न द्वारा कैश किए गए |
| `generate_image` | पाठ विवरण से छवि बनाएं, निर्दिष्ट पूर्ण पथ पर सहेजें; आउटपुट फ्लैट बिटमैप है (लेयर संपादन के लिए OpenPencil की आवश्यकता है) |

**सेशन इमेज चिपकाना**: DSH में, मॉडल को `DeepSeek (vision) ◉` पर स्विच करें सीधे छवियों को चिपकाने के लिए। छवियां सेशन में रहती हैं और सामान्य रूप से प्रदर्शित होती हैं; प्लगइन उनके बाद ट्रांसक्राइब किया गया पाठ जोड़ता है और भेजने से पहले छवियों को हटाता है - आप छवि देखते हैं, मॉडल पाठ पढ़ता है। ट्रांसक्रिप्शन उसी नेटिव-फर्स्ट सीढ़ी का अनुसरण करता है: key उपलब्ध होने पर DeepSeek का VL मॉडल, फिर आपका कॉन्फ़िगर किया CLI प्रदाता।

### कॉन्फ़िगरेशन

**DSH सेटिंग्स पेज → DSH Crew → Multimodal** में (या सीधे `~/.config/dsh-crew/config.json` संपादित करें):

**विजन प्रदाता** (इमेज देखना):

- `native` / `deepseek-native` (DeepSeek का अपना VL मॉडल — हर अंतर्निहित प्रदाता के लिए key उपलब्ध होने पर स्वचालित रूप से पहले आज़माया जाता है)
- `claude-code` (डिफ़ॉल्ट, haiku का उपयोग करता है, सस्ता)
- `codex` (GPT का उपयोग करता है, विशिष्ट मॉडल निर्दिष्ट कर सकता है)
- `grok` (Grok का उपयोग करता है)
- `agy` (Antigravity)
- `custom` (OpenAI-संगत API या स्थानीय कमांड)
- `off` (अक्षम)

**इमेज जनरेशन प्रदाता** (इमेज जनरेशन):

- `codex` (`$imagegen`, gpt-image-2)
- `agy` (Nano Banana)
- `grok` (Imagine)
- `custom` (OpenAI-संगत API या स्थानीय कमांड)
- `off` (अक्षम)

### कस्टम प्रदाता

दो इंटीग्रेशन विधियां:

**API**: कोई भी OpenAI-संगत एंडपॉइंट
- Base URL, API Key, मॉडल सूची भरें
- विजन इनलाइन base64 छवियों के साथ `/chat/completions` का उपयोग करता है
- इमेज जनरेशन `/images/generations` का उपयोग करता है
- **जनरेशन क्षमता रखने के लिए "image generation model" निर्दिष्ट करना आवश्यक है**, अन्यथा प्रदाता केवल विजन चयन में दिखाई देता है

**CLI**: स्थानीय कमांड टेम्पलेट, placeholders को सुरक्षित संदर्भों से प्रतिस्थापित किया जाता है
- विजन: `{image} {question} {model}` → stdout उत्तर के रूप में
- इमेज जनरेशन: `{prompt} {output} {size}` → कमांड को `{output}` पर फाइल लिखनी चाहिए
- कम से कम एक कमांड भरें; भरा हुआ कोई भी क्षमता निर्धारित करता है

**कनेक्टिविटी परीक्षण**: प्रत्येक कस्टम प्रदाता के पास एक परीक्षण बटन है
- API: एंडपॉइंट पहुंच, प्रमाणीकरण जांचें, सत्यापित करने के लिए वास्तविक विजन अनुरोध भेजें
- CLI: निष्पादन योग्य फाइल जांचें, सत्यापित करने के लिए वास्तविक कमांड चलाएं
- इमेज जनरेशन: कॉन्फ़िगरेशन को केवल सत्यापित करें, कोई वास्तविक छवि आउटपुट नहीं

**उधार लिए गए सब्सक्रिप्शन CLI** (claude / codex / grok / agy) के लिए आवश्यक है कि आप स्थानीय रूप से लॉगिन हों; प्लगइन उनकी अनुमति को बायपास नहीं करेगा।

## Hub मोड

यह पैकेज एक वैध DSH बंडल भी है (`dsh.bundle` + `cordis.patch.yml`)। `dsh plugin add dsh-crew` के साथ DSH Web प्रोफाइल में स्थापित करने के बाद:

- **कार्यकर्ता सेशन फर्स्ट-क्लास नागरिक बन जाते हैं**: DSH होस्ट में फर्स्ट-क्लास सेशन के रूप में चलें (`agents.create` + per-session मॉडल/effort वॉटरफॉल + डिफ़ॉल्ट प्रीसेट), Web UI सेशन सूची में दिखाई दें, किसी भी समय खोल सकते हैं पूर्ण निष्पादन देखने के लिए
- **कार्य निर्देशिका द्वारा आयोजित करें**: Web UI में cwd द्वारा कार्यकर्ता सेशन का प्रबंधन करें
- **Loopback API**:
  - `POST/GET /_dsh/dsh-crew/jobs`: कार्य भेजें, सूची, लंबे-पोल परिणाम, रद्द करें
  - `GET /_dsh/dsh-crew/ping`: स्वास्थ्य जांच (MCP shim यह निर्धारित करने के लिए उपयोग करता है कि hub चल रहा है या नहीं)
  - `POST /_dsh/dsh-crew/install`: host इंटीग्रेशन की वन-क्लिक इंस्टॉल — Claude Code / Codex / Antigravity / Grok (`src/install/` का बैकएंड)
- **ऑटो-डिटेक्शन**: hosts का MCP shim ऑटो-डिटेक्ट hub करता है (`DSH_CREW_HUB` env var, डिफ़ॉल्ट `http://127.0.0.1:3080`)
  - DSH Web चल रहा है → job hub मोड में प्रवेश करते हैं (`mode: "hub"`)
  - चल नहीं रहा है → स्टैंडअलोन रनटाइम पर वापस आएं

## समाधान चयन और सीमाएं

### नियमित सदस्य → शेल सबएजेंट दृष्टिकोण (अनुशंसित)

- **वर्तमान स्थिति**: Claude Code सबएजेंट शेल मध्यस्थ के रूप में haiku का उपयोग करता है; प्रत्येक डिस्पैच सैकड़ों से हजारों टोकन जोड़ता है
- **ट्रेड-ऑफ**: नेटिव टास्क UI, रीयल-टाइम प्रगति प्रदर्शन, कोई अतिरिक्त कॉन्फ़िगरेशन के बदले थोड़ी मात्रा में Anthropic टोकन का उपयोग करें
- **अनुशंसा**: यदि आप पहले से ही Claude Pro की सदस्यता लेते हैं या Claude Code का उपयोग करते हैं, तो इस दृष्टिकोण का उपयोग करें - सुविधाजनक और पारदर्शी

### पे-एज़-यू-गो / CI वातावरण → सीधे राउटर दृष्टिकोण

- **वर्तमान स्थिति**: Claude Code सबएजेंट फ्रंटमैटर सीधे तीसरे पक्ष के मॉडल कनेक्शन का समर्थन नहीं करता है; इस रेपो का राउटर प्रयोग scratchpad में Claude Code के लिए API-key क्रेडेंशियल की आवश्यकता है, लेकिन सदस्यता OAuth Anthropic द्वारा अपस्ट्रीम 403 से अवरुद्ध है
- **अनुशंसा**:
  - यदि API-key क्रेडेंशियल (OAuth नहीं) का उपयोग करते हैं और Anthropic टोकन बचाना चाहते हैं, तो सीधे DeepSeek कनेक्शन के लिए स्थानीय राउटर चला सकते हैं
  - CI वातावरण आमतौर पर API key का भी उपयोग करते हैं; यह दृष्टिकोण अधिक किफायती है (सभी DeepSeek टोकन)
  - राउटर इंटीग्रेशन का स्व-परीक्षण आवश्यक है (आधिकारिक रूप से समर्थित नहीं)

### DSH Web चल रहा है → hub मोड ऑटो-सक्षम

- **वर्तमान स्थिति**: यदि `dsh plugin add dsh-crew` DSH Web प्रोफाइल में स्थापित है, तो job होस्ट में फर्स्ट-क्लास सेशन के रूप में चलते हैं, Web UI सेशन सूची में दिखाई देते हैं
- **अनुशंसा**: स्थानीय विकास पुनरावृत्ति के दौरान, hub मोड सक्षम करने की अनुशंसा करते हैं; कार्यकर्ता प्रगति पूरी तरह से Web UI में देखी जा सकती है; क्रॉस-मशीन सहयोग या Web UI के बिना वातावरण के लिए, डिस्पैच करने वाले host के शेल दृष्टिकोण का उपयोग करें

### ज्ञात आइटम

- Codex भूमिका सैद्धांतिक रूप से `model_provider` को सीधे DeepSeek की ओर इंगित करने की कोशिश कर सकती है (अनिर्भर); यह ब्रिज इस पर निर्भर नहीं करता
- इमेज जनरेशन आउटपुट फ्लैट बिटमैप है; लेयर संपादन के लिए OpenPencil की आवश्यकता है
- **रनटाइम निर्भरताएं**: केवल `@modelcontextprotocol/sdk` और `zod`; `@deepseek-ai/*` होस्ट रनटाइम हैं (DSH होस्ट द्वारा प्रदान; सादा npm इंस्टॉल इन्हें कभी नहीं खींचता)
- **Codex को कॉन्फ़िगर करना आवश्यक है**: `default_tools_approval_mode = "approve"`, अन्यथा टूल कॉल ऑटो-रद्द हो जाते हैं

## विकास करें

```bash
pnpm install
node_modules/.bin/tsdown src/client/index.tsx --format cjs --platform browser \
  --target es2022 --tsconfig tsconfig.client.json --out-dir .client-build --clean
node scripts/build-client.mjs   # wraps the bundle for the DSH module loader
node scripts/smoke.mjs          # dispatches one real flash task end to end
```

रनटाइम निर्भरताएं केवल `@modelcontextprotocol/sdk` और `zod` हैं; हर `@deepseek-ai/*` पैकेज एक peer निर्भरता है DSH होस्ट द्वारा प्रदान की जाती है, जो प्लगइन को होस्ट के एकल मॉड्यूल दायरे में रखती है।

## पारिस्थितिकी तंत्र

- [DSH Android](https://github.com/ZSeven-W/dsh-android) — बातचीत के भीतर लाइव Android एमुलेटर या USB डिवाइस — पूरी तरह adb से संचालित
- [DSH iOS](https://github.com/ZSeven-W/dsh-ios) — बातचीत के भीतर चलता iOS सिम्युलेटर — और USB से जुड़ा iPhone
- [DSH Noema](https://github.com/ZSeven-W/dsh-noema) — DSH के लिए दीर्घकालीन स्मृति
- [DSH OpenPencil](https://github.com/ZSeven-W/dsh-openpencil) — एक बातचीत के अंदर `.op` डिजाइन दस्तावेज़ को निरीक्षण और संपादित करें

## लाइसेंस

MIT
