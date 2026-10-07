#!/usr/bin/env bun
/**
 * First-run setup. Every step is idempotent, reports one line, and never
 * installs anything the skill has not asked the user about first.
 *
 *   bun setup.ts check                  what is done, what is missing (one line each)
 *   bun setup.ts graphify               uv tool install graphifyy  (code map, no API key for code)
 *   bun setup.ts vectors                local embedding runtime (~500 MB) + model (~23 MB)
 *   bun setup.ts introspect [roots…]    skills on this machine the catalog does not know yet
 *   bun setup.ts learn <tsv-row>…       add classified rows to ~/.claude/raffy/catalog.local.tsv
 *   bun setup.ts index                  embed every catalog row into vectors.sqlite
 *   bun setup.ts done                   write the marker the prompt hook checks
 *
 * State lives in ~/.claude/raffy/ (RAFFY_HOME). Nothing is written to the project.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { RAFFY_HOME, RUNTIME, MODEL, embedder, vectorDb, toBlob } from "../../guide/scripts/embed.ts";
import { load, availability, embedText, LOCAL_CATALOG } from "../../guide/scripts/catalog.ts";
import { scan } from "../../guide/scripts/inventory.ts";

const MARKER = join(RAFFY_HOME, "setup.json");
const argv = process.argv.slice(2);
const cmd = argv[0];
const has = (bin: string) => spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8" }).status === 0;
const run = (c: string, a: string[], opts: object = {}) => spawnSync(c, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const PHASES = ["orient", "idea", "shape", "stack", "plan", "build", "ui", "debug", "review", "secure", "qa", "ship", "grow", "learn", "handoff"];

function marker(): Record<string, unknown> {
  try { return JSON.parse(readFileSync(MARKER, "utf8")); } catch { return {}; }
}

switch (cmd) {
  case "check": {
    const m = marker();
    const vec = vectorDb();
    const indexed = vec ? (vec.query("SELECT count(*) AS n FROM skills").get() as { n: number }).n : 0;
    const rows = load();
    const { unknown } = availability(rows, ".");
    const line = (ok: boolean | "skip", name: string, note: string) => console.log(`${ok === true ? "✓" : ok === "skip" ? "·" : "✗"} ${name.padEnd(10)} ${note}`);
    line(has("bun"), "bun", has("bun") ? "present" : "missing — raffy's scripts need it: https://bun.sh");
    line(has("uv"), "uv", has("uv") ? "present" : "missing — needed for graphify: brew install uv");
    line(has("graphify"), "graphify", has("graphify") ? "present" : "not installed — code map; `setup.ts graphify`");
    line(existsSync(join(RUNTIME, "node_modules", "@huggingface", "transformers")), "vectors", existsSync(join(RUNTIME, "node_modules")) ? `runtime present · ${indexed} skills indexed` : "off — keyword search only; `setup.ts vectors` (~520 MB)");
    line(unknown.length === 0, "catalog", `${rows.length} known${rows.some((r) => r.learned) ? ` (${rows.filter((r) => r.learned).length} learned)` : ""}${unknown.length ? ` · ${unknown.length} installed but unranked — \`setup.ts introspect\`` : ""}`);
    line(!!m.at, "setup", m.at ? `done ${String(m.at).slice(0, 10)}` : "not finished — the prompt hook will keep suggesting /raffy:setup");
    break;
  }

  case "graphify": {
    if (has("graphify")) { console.log("graphify already installed"); break; }
    if (!has("uv")) { console.error("uv is missing — install it first (brew install uv), then rerun"); process.exit(1); }
    // uv brings its own Python, so the system's 3.9 does not matter.
    const r = run("uv", ["tool", "install", "graphifyy"]);
    if (r.status !== 0) { console.error(`uv tool install graphifyy failed:\n${(r.stderr || r.stdout).trim().split("\n").slice(-5).join("\n")}`); process.exit(1); }
    console.log(`graphify installed${has("graphify") ? "" : " — open a new shell if `graphify` is not on PATH yet (uv tool update-shell)"}`);
    break;
  }

  case "vectors": {
    mkdirSync(RUNTIME, { recursive: true });
    if (!existsSync(join(RUNTIME, "package.json"))) writeFileSync(join(RUNTIME, "package.json"), JSON.stringify({ name: "raffy-runtime", private: true }, null, 2));
    if (!existsSync(join(RUNTIME, "node_modules", "@huggingface", "transformers"))) {
      const r = run("bun", ["add", "@huggingface/transformers@3"], { cwd: RUNTIME });
      if (r.status !== 0) { console.error(`installing the embedding runtime failed:\n${r.stderr.trim().split("\n").slice(-5).join("\n")}`); process.exit(1); }
    }
    const embed = await embedder();   // first call downloads the model into runtime/models
    if (!embed) { console.error("runtime installed but the model did not load — rerun `setup.ts vectors`"); process.exit(1); }
    const [v] = await embed(["warm up"]);
    console.log(`vectors ready · ${MODEL} · ${v.length} dims · run \`setup.ts index\` next`);
    break;
  }

  case "introspect": {
    // Everything Claude can see here, plus skills inside other projects and the
    // unlinked store. Printed compactly for the skill to classify — the script
    // does not guess tiers; the model does, then calls `learn`.
    const known = new Set(load().flatMap((r) => [r.id, r.id.split(":").pop()!]));
    const roots = argv.slice(1).length ? argv.slice(1) : [join(homedir(), "code"), join(homedir(), "projects"), join(homedir(), "dev"), join(homedir(), "src")];
    const projects = roots.filter(existsSync).flatMap((root) => {
      try { return readdirSync(root).map((d) => join(root, d)).filter((d) => { try { return statSync(d).isDirectory() && existsSync(join(d, ".claude", "skills")); } catch { return false; } }); } catch { return []; }
    });
    const seen = new Map<string, { src: string; description: string }>();
    for (const s of scan(".").skills) seen.set(s.id, { src: s.source === "plugin" ? `plugin:${s.plugin}` : s.source, description: s.description });
    for (const p of projects) for (const s of scan(p).skills) if (s.source === "project") seen.set(s.name, { src: `project:${p.split("/").pop()}`, description: s.description });
    const agents = join(homedir(), ".agents", "skills");
    if (existsSync(agents)) for (const d of readdirSync(agents)) {
      if (seen.has(d) || !existsSync(join(agents, d, "SKILL.md"))) continue;
      const fm = readFileSync(join(agents, d, "SKILL.md"), "utf8").match(/^description:\s*(.+)$/m)?.[1] ?? "";
      seen.set(d, { src: "agents", description: fm.replace(/^["']|["']$/g, "") });
    }
    const fresh = [...seen.entries()].filter(([id]) => !known.has(id) && !known.has(id.split(":").pop()!));
    console.log(`${seen.size} skills seen across ${projects.length} projects · ${fresh.length} not in the catalog`);
    for (const [id, s] of fresh) console.log(`${id}\t${s.src}\t${s.description.replace(/\s+/g, " ").slice(0, 160)}`);
    if (fresh.length) console.log(`\nclassify each as: id<TAB>tier<TAB>phase<TAB>domain<TAB>src<TAB>when  — then \`setup.ts learn\``);
    break;
  }

  case "learn": {
    const rows = argv.slice(1);
    const known = new Set(load().map((r) => r.id));
    mkdirSync(RAFFY_HOME, { recursive: true });
    if (!existsSync(LOCAL_CATALOG)) writeFileSync(LOCAL_CATALOG, "# learned by /raffy:setup on this machine — same columns as knowledge/catalog.tsv\n");
    let added = 0;
    for (const raw of rows) {
      const f = raw.split("\t");
      const [id, tier, phase, domain, src, when] = f;
      const bad = f.length !== 6 ? "needs 6 tab-separated columns"
        : !["core", "often", "rare", "skip"].includes(tier) ? `tier "${tier}"`
        : !PHASES.includes(phase) ? `phase "${phase}"`
        : !/^(user|command|agents|plugin:[\w-]+|project:[\w.-]+)$/.test(src) ? `src "${src}"`
        : when.length > 90 ? "when is over 90 chars"
        : known.has(id) ? "already cataloged" : "";
      if (bad) { console.error(`  skip  ${id ?? raw.slice(0, 30)} — ${bad}`); continue; }
      appendFileSync(LOCAL_CATALOG, f.join("\t") + "\n");
      known.add(id); added++;
    }
    console.log(`learned ${added} · run \`setup.ts index\` to make them searchable by meaning`);
    break;
  }

  case "index": {
    const embed = await embedder();
    if (!embed) { console.log("vectors off — skipped (keyword search still works)"); break; }
    const db = vectorDb(true)!;
    const rows = load().filter((r) => r.tier !== "skip");
    // The one-line `when` is too thin for a small model to match paraphrases
    // ("sluggish" vs "slow bugs"). Embed the skill's own description too, from
    // wherever it lives: installed, bundled, or the unlinked store.
    const desc = new Map<string, string>();
    for (const s of scan(".").skills) { desc.set(s.id, s.description); desc.set(s.name, s.description); }
    const fromFile = (f: string) => { try { return readFileSync(f, "utf8").match(/^description:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, "") ?? ""; } catch { return ""; } };
    const libDir = resolve(import.meta.dir, "..", "..", "..", "library");
    const textFor = (r: (typeof rows)[number]) => {
      const bare = r.id.split(":").pop()!;
      const d = desc.get(r.id) ?? desc.get(bare)
        ?? (fromFile(join(libDir, r.id.replace(/:/g, "--"), "SKILL.md")) || fromFile(join(homedir(), ".agents", "skills", bare, "SKILL.md")));
      return `${embedText(r)}. ${d}`.slice(0, 700);
    };
    const have = new Map((db.query("SELECT id, text FROM skills").all() as { id: string; text: string }[]).map((r) => [r.id, r.text]));
    const todo = rows.map((r) => ({ r, t: textFor(r) })).filter(({ r, t }) => have.get(r.id) !== t);
    const ins = db.prepare("INSERT OR REPLACE INTO skills (id, text, vec) VALUES (?, ?, ?)");
    for (let i = 0; i < todo.length; i += 32) {
      const batch = todo.slice(i, i + 32);
      const vecs = await embed(batch.map((b) => b.t));
      batch.forEach((b, j) => ins.run(b.r.id, b.t, toBlob(vecs[j])));
    }
    const ids = new Set(rows.map((r) => r.id));
    for (const id of have.keys()) if (!ids.has(id)) db.run("DELETE FROM skills WHERE id = ?", [id]);
    console.log(`indexed ${rows.length} skills (${todo.length} new or changed)`);
    break;
  }

  case "done": {
    mkdirSync(RAFFY_HOME, { recursive: true });
    const plugin = JSON.parse(readFileSync(resolve(import.meta.dir, "..", "..", "..", ".claude-plugin", "plugin.json"), "utf8"));
    writeFileSync(MARKER, JSON.stringify({ at: new Date().toISOString(), version: plugin.version, graphify: has("graphify"), vectors: !!vectorDb() }, null, 2) + "\n");
    console.log("setup complete");
    break;
  }

  default:
    console.error("usage: setup.ts check | graphify | vectors | introspect [roots…] | learn <row>… | index | done");
    process.exit(2);
}
