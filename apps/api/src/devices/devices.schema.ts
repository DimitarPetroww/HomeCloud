import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id } from "../db/columns.ts";
import { users } from "../users/users.schema.ts";

export const devicePlatform = pgEnum("device_platform", [
  "ios",
  "android",
  "macos",
  "windows",
  "linux",
]);

/** A paired client device (phone, laptop, ...). */
export const devices = pgTable(
  "devices",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    platform: devicePlatform().notNull(),
    /** Hash of the device credential; the credential itself is never stored. */
    credentialHash: text().notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.userId), uniqueIndex().on(t.credentialHash)],
);
