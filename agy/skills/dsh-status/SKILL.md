---
name: dsh-status
description: Show live status of DSH worker jobs
---

Call the `dsh_worker_status` tool and present the result as one compact table: job id, tier/effort, status (including the current tool), progress, tokens, task summary. If there are no jobs, say so in one line. Reply in the language the user is writing in. Do nothing else.
