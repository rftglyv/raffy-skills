# AI-development tooling — the gems

A repo scaffolded without these produces worse output for its entire life, because the agent works
without context, without design constraints, and without a way to receive precise feedback.

**These are pointers, not documentation.** Fetch the URL when you commit to one. Decide which fit
*this* project — do not install all of them by reflex. A tool the user does not understand is
worse than no tool.

---

## 1. `CLAUDE.md` — the highest-leverage file in the repo

Not optional, and not a tool you install. Write it in Phase 4 from the interview answers.

Without it the agent re-decides your architecture every session: a second ORM appears, a route
handler shows up in a Server-Actions codebase, a component gets hand-written next to the one you
installed. With it, the constraints hold.

Contents that actually change behavior: the stack and *why each piece was chosen*, the commands
(`bun dev`, `bun test`, migration commands), directory conventions, what is deliberately **not**
in the stack and the trigger that would add it, and the security invariants (where secrets live,
how authorization is enforced). Keep it short — it loads every session.

## 2. Impeccable — design guardrails

**https://impeccable.style** · Claude Code marketplace, `npx impeccable install`, or
`npx skills add pbakaus/impeccable`. Initialize with `/impeccable init`.

Ships ~59 checks for the visual defaults agents converge on, and ~23 commands (`/typeset`,
`/distill`, `/audit`) that form a shared design vocabulary with the agent. Respects existing tokens
and components rather than overwriting them, and can iterate live against the running app. A
Chrome extension and a CI mode with JSON output exist too.

**Take it when** the project has a real UI and the user cannot yet tell good design from
AI-default design — which is most people. **Skip it** for an API-only service or a CLI.

## 3. Agentation — point at the thing instead of describing it

**https://www.agentation.com** · `npm install agentation`. Desktop-only.

Turns UI annotations into structured context: CSS selectors, file paths, component hierarchy,
computed styles. The user clicks the broken element instead of writing "the button on the left is
a bit off". Integrates by copy-paste, by **MCP** (real-time, bidirectional — the agent can ask for
clarification and mark feedback resolved), or by API/webhook.

**Take it when** a non-engineer will be giving UI feedback. That is exactly the vibecoder case and
it removes the single most lossy step in the loop. **Skip it** for headless services.

## 4. shadcn MCP + skill

See `ui-registries.md`. Wire both for any project with a UI.

## 5. The skills ecosystem

`skills.sh` (`bun dlx skills add <owner>/<name>`) and the Claude Code plugin marketplace both
distribute skills. Before writing a long prompt explaining a library to the agent, **check whether
that library ships a skill or an MCP server** — many now do, and one is worth more than any
prompt, because it is maintained by the people who built the thing.

Worth knowing about, install by need: framework-specific skills, `chrome-devtools` MCP for real
browser debugging, and Playwright MCP for driving a browser.

## 6. Guardrails in CI, not just in chat

The agent will eventually write something that does not typecheck or that breaks a test. Catch it
mechanically:

- `bun test` + `tsc --noEmit` + a formatter on pre-commit
- The same three in GitHub Actions on every PR
- Secret scanning — AI-assisted commits leak credentials at roughly twice the rate of
  human-only commits, so this is not paranoia
- A dependency audit step

This is the cheapest possible supervision, and it works while the user is asleep.

---

## How to offer these

Do not install silently, and do not install all five. In Phase 5, name the two or three that fit
the project, say in one line what each prevents, and ask. Something the user chose gets used;
something that appeared gets deleted.
