import { sql } from "drizzle-orm";
import Fastify from "fastify";
import type { Db } from "./db/client.ts";

export function buildApp(db: Db) {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    await db.execute(sql`select 1`);
    return { status: "ok" };
  });

  return app;
}
