---
name: hook-routes-secure
description: A plain question about leaked keys reaches raffy:secure with no slash command
tags: [hook, routing]
runs: 1
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill, "Bash(bun:*)", "Bash(git:*)"]
---
did I leak any api keys or secrets in this repo?
