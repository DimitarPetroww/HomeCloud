import { buildApp } from "./app.ts";
import { config } from "./config.ts";
import { createDb } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";

const db = createDb(config.databaseUrl);
await runMigrations(db);

const app = buildApp(db);
await app.listen({ port: config.port, host: config.host });
