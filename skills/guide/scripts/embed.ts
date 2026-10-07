/**
 * Optional local embeddings. Present only after `/raffy:setup` installs the
 * runtime; every caller must work when this returns null.
 *
 * Runtime:  ~/.claude/raffy/runtime  (@huggingface/transformers, ~500 MB incl. onnxruntime)
 * Model:    Xenova/all-MiniLM-L6-v2, q8, 384 dims, ~23 MB, cached under runtime/models
 * Vectors:  ~/.claude/raffy/vectors.sqlite — one row per catalog skill
 *
 * Warm cost measured on an M-series Mac: ~45 ms load, ~7 ms per batch.
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Database } from "bun:sqlite";

export const RAFFY_HOME = process.env.RAFFY_HOME ?? join(homedir(), ".claude", "raffy");
export const RUNTIME = join(RAFFY_HOME, "runtime");
export const VECTORS = join(RAFFY_HOME, "vectors.sqlite");
export const MODEL = "Xenova/all-MiniLM-L6-v2";

type Embedder = (texts: string[]) => Promise<Float32Array[]>;
let cached: Embedder | null | undefined;

export async function embedder(): Promise<Embedder | null> {
  if (cached !== undefined) return cached;
  const pkg = join(RUNTIME, "node_modules", "@huggingface", "transformers");
  if (!existsSync(pkg)) return (cached = null);
  try {
    const t = await import(pkg);
    t.env.cacheDir = join(RUNTIME, "models");
    t.env.allowRemoteModels = existsSync(join(RUNTIME, "models", MODEL)) ? false : true;
    const pipe = await t.pipeline("feature-extraction", MODEL, { dtype: "q8" });
    cached = async (texts) => {
      const out = await pipe(texts, { pooling: "mean", normalize: true });
      return (out.tolist() as number[][]).map((v) => Float32Array.from(v));
    };
  } catch {
    cached = null;
  }
  return cached;
}

export function vectorDb(create = false): Database | null {
  if (!create && !existsSync(VECTORS)) return null;
  mkdirSync(RAFFY_HOME, { recursive: true });
  const db = new Database(VECTORS, { create: true });
  db.run("CREATE TABLE IF NOT EXISTS skills (id TEXT PRIMARY KEY, text TEXT, vec BLOB)");
  return db;
}

/** Vectors are normalized, so the dot product is the cosine. */
export const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const toBlob = (v: Float32Array) => new Uint8Array(v.buffer.slice(0));
export const fromBlob = (b: Uint8Array) => new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
