import { test, expect } from "bun:test";
import { check } from "./guard.ts";

const deny = [
  "rm -rf /", "rm -rf ~", "rm -rf $HOME", "sudo rm -rf /*", "rm -fr ~/*",
  "mkfs.ext4 /dev/sda1", "dd if=/dev/zero of=/dev/disk2",
];
const ask = [
  `psql "$DATABASE_URL" -c "DROP TABLE users"`, "sqlite3 app.db 'drop database prod'",
  `psql -c "TRUNCATE orders"`, `psql -c "DELETE FROM invoices;"`, `psql -c "ALTER TABLE users DROP COLUMN email"`,
  "dropdb myapp", "redis-cli FLUSHALL",
  "bunx prisma migrate reset", "npx prisma db push --accept-data-loss", "bunx drizzle-kit drop", "supabase db reset",
  "NODE_ENV=production bun run db:migrate", "bunx prisma migrate deploy --schema prod.prisma",
  "rm -rf .", "rm -rf ./*", "rm -r ..", "cd app && rm -rf *",
  "git push --force", "git push -f origin main", "git push origin +main", "git push origin --delete feature",
  "git reset --hard HEAD~3", "git clean -fdx", "git checkout -- .", "git restore .", "git stash clear", "git branch -D old",
  "terraform destroy", "kubectl delete ns prod", "docker volume prune", "docker compose down -v", "gh repo delete me/x --yes",
];
const fine = [
  "rm -rf node_modules", "rm -rf dist .next", "rm file.txt", "rm -rf ./build",
  "git push", "git push --force-with-lease", "git push -u origin feat/x", "git reset HEAD file.ts", "git checkout main", "git restore src/a.ts",
  "bunx prisma migrate dev", "bunx prisma migrate deploy", "bun test", `psql -c "DELETE FROM sessions WHERE expires < now()"`,
  `psql -c "SELECT * FROM users"`, "docker compose down", "terraform plan", "kubectl get pods", "grep -r 'DROP TABLE' docs/",
];

for (const c of deny) test(`deny: ${c}`, () => expect(check(c)?.decision).toBe("deny"));
for (const c of ask) test(`ask: ${c}`, () => expect(check(c)?.decision).toBe("ask"));
for (const c of fine) test(`fine: ${c}`, () => expect(check(c)).toBeNull());
