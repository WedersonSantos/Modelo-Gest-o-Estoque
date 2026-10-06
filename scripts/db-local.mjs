import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

if (process.env.NODE_ENV === "production") throw new Error("O PostgreSQL embutido é exclusivo de desenvolvimento.");
const databaseDir = resolve(".local/postgres");
await mkdir(databaseDir, { recursive: true });
const pg = new EmbeddedPostgres({ databaseDir, user: "restaurante", password: "restaurante_local", port: 55432, persistent: true, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"] });

if (!existsSync(resolve(databaseDir, "PG_VERSION"))) {
  await pg.initialise();
  await appendFile(resolve(databaseDir, "postgresql.conf"), "\n# Local development only\nlisten_addresses = '127.0.0.1'\n");
}
await pg.start();
const client = pg.getPgClient("postgres", "127.0.0.1");
await client.connect();
try {
  for (const databaseName of ["restaurante", "restaurante_test"]) {
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (!result.rowCount) await pg.createDatabase(databaseName);
  }
} finally { await client.end(); }

console.log("PostgreSQL local ativo em 127.0.0.1:55432. Dados persistem em .local/postgres. Use Ctrl+C para encerrar.");
const keepAlive = setInterval(() => {}, 60_000);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(keepAlive);
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
