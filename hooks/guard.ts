#!/usr/bin/env bun
/**
 * PreToolUse hook for Bash. Stops the commands that destroy data or history
 * before they run, and says why in plain words.
 *
 *   ask   → the user confirms first (non-interactive runs treat this as deny)
 *   deny  → never, from an agent: wiping a home directory or a disk
 *
 * Off for a session with RAFFY_GUARD=off. Everything else passes silently —
 * this hook prints nothing at all for the 99% of commands that are fine.
 *
 * The rules match command text, so they are a seatbelt, not a sandbox: a
 * determined script can get around them. What they catch is the agent that
 * "cleans up" a database or force-pushes over someone's work by accident.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type Verdict = { decision: "ask" | "deny"; plain: string; terse: string };
type Rule = { re: RegExp; decision: "ask" | "deny"; plain: string; terse: string; sql?: true };

// SQL rules fire only when the command actually talks to a database. Searching
// docs for "DROP TABLE" is not dropping a table.
const SQL_CLIENT = /\b(psql|pgcli|mysql|mariadb|sqlite3|sqlcmd|duckdb|clickhouse(-client)?|turso|mongosh|wrangler\s+d1|prisma\s+db\s+execute|supabase\s+db)\b/i;

const RULES: Rule[] = [
  // ── never ──────────────────────────────────────────────────────────────────
  { re: /\brm\s+(-[a-z]*r[a-z]*f?|-[a-z]*f[a-z]*r|--recursive)\b[^|;&]*\s(\/|~|\$HOME|\/\*|~\/\*|\$HOME\/\*)(\s|$)/i, decision: "deny",
    plain: "This deletes your whole home folder or disk. Raffy never lets an agent run it.", terse: "rm -r on / or $HOME — refused." },
  { re: /\b(mkfs(\.\w+)?|diskutil\s+(erase\w*|zeroDisk))\b|\bdd\b[^|;&]*\bof=\/dev\//i, decision: "deny",
    plain: "This erases a disk. Raffy never lets an agent run it.", terse: "disk erase — refused." },

  // ── databases ──────────────────────────────────────────────────────────────
  { re: /\bdrop\s+(table|database|schema)\b/i, decision: "ask",
    plain: "This deletes a database table or the whole database. The data is gone unless you have a backup.", terse: "DROP TABLE/DATABASE/SCHEMA.", sql: true },
  { re: /\btruncate\s+(table\s+)?\w/i, decision: "ask",
    plain: "This empties a database table. Every row is deleted.", terse: "TRUNCATE.", sql: true },
  { re: /\bdelete\s+from\s+["`\w.]+\s*(;|"|'|$)/i, decision: "ask",
    plain: "This deletes every row in a table — there is no WHERE condition limiting it.", terse: "DELETE without WHERE.", sql: true },
  { re: /\balter\s+table\b[^;]*\bdrop\s+column\b/i, decision: "ask",
    plain: "This deletes a column and all the data in it.", terse: "ALTER TABLE … DROP COLUMN.", sql: true },
  { re: /\bdropdb\b|\bredis-cli\b[^|;&]*\bflush(all|db)\b/i, decision: "ask",
    plain: "This deletes a whole database.", terse: "dropdb / FLUSHALL." },
  { re: /\bprisma\s+migrate\s+reset\b|\bprisma\s+db\s+push\b[^|;&]*--(force-reset|accept-data-loss)|\bdrizzle-kit\s+drop\b|\bsupabase\s+db\s+reset\b|\brails\s+db:(drop|reset)\b|\b(knex|sequelize)\b[^|;&]*\b(rollback|undo)(:all|\s+--all)/i, decision: "ask",
    plain: "This resets the database — tables are dropped and recreated, and the data in them is lost.", terse: "migration reset / data-loss push." },
  { re: /\b(migrate|db\s+push|db:migrate|deploy)\b[^|;&]*\b(prod|production)\b|\b(NODE_ENV|RAILS_ENV|APP_ENV)=prod(uction)?\b[^|;&]*\b(migrate|db\s+push|db:migrate)\b/i, decision: "ask",
    plain: "This changes the production database. Real users' data is on the other end.", terse: "migration against production." },

  // ── files ──────────────────────────────────────────────────────────────────
  { re: /\brm\s+(-[a-z]*r[a-z]*|--recursive)\b[^|;&]*\s(\.|\.\/|\*|\.\/\*|\.\.(\/\S*)?)(\s|$)/i, decision: "ask",
    plain: "This deletes everything in the current folder (or above it), not one file.", terse: "rm -r on . / * / .." },

  // ── git history ────────────────────────────────────────────────────────────
  { re: /\bgit\s+push\b[^|;&]*(\s--force(?!-with-lease)\b|\s-f\b|\s\+\S+)/i, decision: "ask",
    plain: "A force push overwrites the history on the server. Anyone else's commits there can be lost.", terse: "git push --force (use --force-with-lease)." },
  { re: /\bgit\s+push\b[^|;&]*\s(--delete|-d)\b|\bgit\s+push\b[^|;&]*\s:\S+/i, decision: "ask",
    plain: "This deletes a branch on the server.", terse: "git push --delete." },
  { re: /\bgit\s+reset\s+--hard\b/i, decision: "ask",
    plain: "This throws away uncommitted changes, and can move the branch back so commits disappear from it. The reflog keeps them for a while; the uncommitted part is gone.", terse: "git reset --hard (uncommitted work lost; commits recoverable via reflog)." },
  { re: /\bgit\s+clean\s+-[a-z]*f|\bgit\s+(checkout|restore)\s+(--\s+)?\.(\s|$)|\bgit\s+stash\s+(clear|drop)\b|\bgit\s+branch\s+-D\b/i, decision: "ask",
    plain: "This throws away work that is not committed yet. It cannot be undone.", terse: "discards uncommitted work / deletes a branch." },

  // ── infrastructure ─────────────────────────────────────────────────────────
  { re: /\bterraform\s+(destroy|apply\b[^|;&]*-destroy)|\bpulumi\s+destroy\b|\bkubectl\s+delete\b|\bhelm\s+(uninstall|delete)\b/i, decision: "ask",
    plain: "This tears down running infrastructure.", terse: "infra destroy/delete." },
  { re: /\bdocker\s+(system|volume)\s+prune\b|\bdocker\s+volume\s+rm\b|\bdocker\s+compose\b[^|;&]*\bdown\b[^|;&]*\s-v\b/i, decision: "ask",
    plain: "This deletes Docker volumes — local databases often live there.", terse: "docker volume removal." },
  { re: /\bgh\s+repo\s+delete\b|\b(fly|flyctl)\s+apps?\s+destroy\b|\bheroku\s+apps:destroy\b|\bvercel\s+(rm|remove)\b|\brailway\s+down\b/i, decision: "ask",
    plain: "This deletes a deployed app or a repository.", terse: "deletes an app / repo." },
];

/** Check every sub-command, so `cd x && git reset --hard` is caught too. */
export function check(command: string): Verdict | null {
  let worst: Verdict | null = null;
  for (const r of RULES) {
    if (!r.re.test(command) || (r.sql && !SQL_CLIENT.test(command))) continue;
    if (r.decision === "deny") return { decision: "deny", plain: r.plain, terse: r.terse };
    worst ??= { decision: r.decision, plain: r.plain, terse: r.terse };
  }
  return worst;
}

function userLevel(): string {
  const f = join(process.env.RAFFY_HOME ?? join(homedir(), ".claude", "raffy"), "memory.jsonl");
  if (!existsSync(f)) return "builder";
  const m = readFileSync(f, "utf8").match(/"text":"level: (hobbyist|builder|developer)"/g)?.at(-1);
  return m?.match(/hobbyist|builder|developer/)?.[0] ?? "builder";
}

if (import.meta.main) {
  try {
    if (process.env.RAFFY_GUARD === "off") process.exit(0);
    const input = JSON.parse(await Bun.stdin.text() || "{}");
    const command: string = input.tool_input?.command ?? "";
    const v = command && check(command);
    if (v) {
      const why = userLevel() === "developer" ? v.terse : v.plain;
      const tail = v.decision === "ask" ? " Raffy paused it so you can confirm." : " Run it yourself if you really mean it.";
      console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: v.decision, permissionDecisionReason: `raffy guard — ${why}${tail}` } }));
    }
  } catch {}
  process.exit(0);
}
