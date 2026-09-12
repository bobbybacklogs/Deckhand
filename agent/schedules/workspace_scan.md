---
cron: "*/15 * * * *"
---

Scan the user workspace git status. If the tree is dirty, summarize changed files. If it is clean, say so in one line. Do not commit or push unless the session was started for a sync.
