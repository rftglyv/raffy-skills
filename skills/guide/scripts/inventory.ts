#!/usr/bin/env bun
/**
 * Lists every skill this Claude Code install can actually invoke, and which of
 * them the guide has a card for.
 *
 * The guide must never recommend a skill that is not installed without saying
 * so, and must notice when two installed skills claim the same job — that
 * overlap is exactly where users pick the wrong one.
 *
 *   bun inventory.ts [project-path]            one-line summary (default — cheap on context)
 *   bun inventory.ts [project-path] --list     every skill, one line each
 *   bun inventory.ts [project-path] --json     full records
 *
 * Also importable: `scan(project)` returns the same records without printing.
 *
 * Sources, in the order Claude Code resolves them:
 *   project  <project>/.claude/skills/<name>/SKILL.md
 *   user     ~/.claude/skills/<name>/SKILL.md
 *   plugin   <installPath>/skills/<name>/SKILL.md, or the paths a plugin's own
 *            .claude-plugin/plugin.json lists under "skills", from installed_plugins.json
 *            (project-scoped plugins only count inside their own project)
 *   command  ~/.claude/commands/<name>.md, <project>/.claude/commands, plugin commands/
 *            — slash commands are invoked the same way, so the guide routes to them too
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const HOME = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
const CARDS = join(import.meta.dir, "..", "knowledge", "skills.md");

export type Skill = {
  id: string;          // what you type: "ship" or "raffy:ship"
  name: string;        // bare name
  plugin?: string;
  source: "project" | "user" | "plugin" | "command";
  description: string;
  path: string;
  origin?: string;     // GitHub "owner/repo" it was installed from, when known
  carded: boolean;
};

function frontmatter(file: string): { name?: string; description?: string } {
  let src: string;
  try { src = readFileSync(file, "utf8"); } catch { return {}; }
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!fm) return {};
  const field = (k: string) => {
    // Handles `key: value`, quoted values, and folded/literal blocks (`key: >` / `key: |`).
    const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, "m"));
    if (!m) return undefined;
    let v = m[1].trim();
    if (v === ">" || v === "|" || v === ">-" || v === "|-") {
      const rest = fm.slice(m.index! + m[0].length).split("\n").slice(1);
      const lines: string[] = [];
      for (const l of rest) { if (/^\S/.test(l)) break; lines.push(l.trim()); }
      v = lines.join(" ").trim();
    }
    return v.replace(/^["']|["']$/g, "");
  };
  return { name: field("name"), description: field("description") };
}

function skillDirs(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((d) => join(root, d))
    .filter((d) => { try { return statSync(d).isDirectory() && existsSync(join(d, "SKILL.md")); } catch { return false; } });
}

const carded = new Set(
  existsSync(CARDS)
    ? [...readFileSync(CARDS, "utf8").matchAll(/^### `?([A-Za-z0-9:_-]+)`?/gm)].map((m) => m[1])
    : [],
);

// `npx skills` records where each user skill came from. Without it, a user
// skill is just a folder and the guide cannot say how to reinstall or update it.
const origins = new Map<string, string>();
try {
  const lock = JSON.parse(readFileSync(join(homedir(), ".agents", ".skill-lock.json"), "utf8"));
  for (const [name, v] of Object.entries<any>(lock.skills ?? {})) if (v?.source) origins.set(name, v.source);
} catch {}

function commandFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((f) => f.endsWith(".md")).map((f) => join(root, f));
}

// A plugin from a local-directory marketplace loads in place from that
// directory; installPath can point at a stale cache copy (or none at all).
export function pluginRoot(key: string, installPath: string): string {
  const [name, market] = key.split("@");
  try {
    const m = JSON.parse(readFileSync(join(HOME, "plugins", "known_marketplaces.json"), "utf8"))[market];
    if (m?.source?.source === "directory" && m.source.path) {
      const dir = m.source.path;
      const entry = JSON.parse(readFileSync(join(dir, ".claude-plugin", "marketplace.json"), "utf8")).plugins?.find((p: any) => p.name === name);
      if (entry && typeof entry.source === "string") return resolve(dir, entry.source);
    }
  } catch {}
  return installPath;
}

export function scan(projectPath: string) {
const PROJECT = resolve(projectPath);
const found: Skill[] = [];
const add = (dir: string, source: Skill["source"], plugin?: string, file = join(dir, "SKILL.md")) => {
  const fm = frontmatter(file);
  const name = (source === "command" ? undefined : fm.name) ?? dir.split("/").pop()!.replace(/\.md$/, "");
  const id = plugin ? `${plugin}:${name}` : name;
  found.push({
    id, name, plugin, source,
    description: (fm.description ?? "").replace(/\s+/g, " "),
    path: dir,
    origin: source === "user" ? origins.get(name) : undefined,
    carded: carded.has(id) || carded.has(name),
  });
};

// Run from the home folder, <project>/.claude *is* the user folder: count it once, as user.
const projectClaude = resolve(PROJECT, ".claude") === resolve(HOME) ? null : join(PROJECT, ".claude");
if (projectClaude) for (const d of skillDirs(join(projectClaude, "skills"))) add(d, "project");
for (const d of skillDirs(join(HOME, "skills"))) add(d, "user");
for (const f of [...(projectClaude ? commandFiles(join(projectClaude, "commands")) : []), ...commandFiles(join(HOME, "commands"))]) add(f, "command", undefined, f);

const manifest = join(HOME, "plugins", "installed_plugins.json");
if (existsSync(manifest)) {
  const plugins: Record<string, { scope: string; projectPath?: string; installPath: string }[]> =
    JSON.parse(readFileSync(manifest, "utf8")).plugins ?? {};
  for (const [key, installs] of Object.entries(plugins)) {
    const plugin = key.split("@")[0];
    // A plugin can be installed more than once; prefer the user-scope install,
    // and only count a project-scope one when we are inside that project.
    const usable = installs.filter((i) => i.scope !== "project" || (i.projectPath && resolve(i.projectPath) === PROJECT));
    const pick = usable.find((i) => i.scope === "user") ?? usable[0];
    if (!pick) continue;
    const root = pluginRoot(key, pick.installPath);
    let listed: string[] | undefined;
    try { listed = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8")).skills; } catch {}
    const dirs = Array.isArray(listed)
      ? listed.map((r) => resolve(root, r)).filter((d) => existsSync(join(d, "SKILL.md")))
      : skillDirs(join(root, "skills"));
    for (const d of dirs) add(d, "plugin", plugin);
    for (const f of commandFiles(join(root, "commands"))) add(f, "command", plugin, f);
  }
}

// Overlap: the same bare name from two sources, e.g. user "ship" and "raffy:ship".
const byName = new Map<string, Skill[]>();
for (const s of found) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
const overlaps = [...byName.values()].filter((g) => g.length > 1).map((g) => g.map((s) => s.id));

const summary = {
  project: PROJECT,
  total: found.length,
  carded: found.filter((s) => s.carded).length,
  bySource: {
    project: found.filter((s) => s.source === "project").length,
    user: found.filter((s) => s.source === "user").length,
    plugin: found.filter((s) => s.source === "plugin").length,
    command: found.filter((s) => s.source === "command").length,
  },
  overlaps,
  skills: found.sort((a, b) => a.id.localeCompare(b.id)),
};
return summary;
}

if (import.meta.main) {
const args = process.argv.slice(2);
const summary = scan(args.find((a) => !a.startsWith("--")) ?? ".");
const overlaps = summary.overlaps;
if (args.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  const { bySource: b } = summary;
  console.log(`${summary.total} skills · ${b.user} user · ${b.plugin} plugin · ${b.project} project · ${b.command} commands · ${summary.carded} carded`);
  if (args.includes("--list")) for (const s of summary.skills) {
    const mark = s.carded ? "●" : "○";
    console.log(`  ${mark} ${s.id.padEnd(40)} ${s.description.slice(0, 70)}`);
  }
  if (overlaps.length) {
    console.log(`\nsame name, more than one source — say which one you mean:`);
    for (const g of overlaps) console.log(`  ${g.join("  vs  ")}`);
  }
  if (args.includes("--list")) console.log(`\n● has a guide card · ○ description only`);
}
}
