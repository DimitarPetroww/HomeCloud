import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export function createDb(databaseUrl: string) {
  // Ignore server notices such as "already exists, skipping" from migrations.
  const client = postgres(databaseUrl, { onnotice: () => undefined });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
