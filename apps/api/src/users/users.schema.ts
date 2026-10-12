import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "../db/columns.ts";

export const userRole = pgEnum("user_role", ["owner", "member"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    username: text().notNull(),
    displayName: text().notNull(),
    role: userRole().notNull(),
    passwordHash: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_username_unique").on(sql`lower(${t.username})`),
    // Exactly one owner per appliance.
    uniqueIndex("users_single_owner")
      .on(t.role)
      .where(sql`${t.role} = 'owner'`),
  ],
);
