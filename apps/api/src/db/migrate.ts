import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Db } from "./client.ts";

// Resolves to apps/api/drizzle from both src/db (dev) and dist/db (production).
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Applies pending migrations. Runs on every API start, so an updated appliance migrates itself. */
export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder });
}
