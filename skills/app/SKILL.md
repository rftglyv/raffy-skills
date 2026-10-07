---
name: app
description: Opens the raffy dashboard as a desktop app (tray icon, every project, session token use, skills, drill, startup cost), building it on first use, or in the browser with --web. Run by the user as /raffy:app.
disable-model-invocation: true
---

# App

Run this, exactly, and pass through any argument the user gave (`--web`, `--rebuild`):

```bash
bun "${CLAUDE_PLUGIN_ROOT}/tui/app.ts"
```

Reply with the script's output line and nothing else. If it says it is building, say the build
runs once and the next `/raffy:app` opens instantly.

- `--web` — the same dashboard in the browser at http://localhost:4747 (read-only: no enabling
  skills or opening terminals from a web page).
- `--rebuild` — force a fresh desktop build, e.g. after pulling raffy.

Without Rust installed, it opens the browser version and says how to get the desktop one.
