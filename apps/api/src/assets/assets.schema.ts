import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id } from "../db/columns.ts";
import { devices } from "../devices/devices.schema.ts";
import { users } from "../users/users.schema.ts";

export const assetKind = pgEnum("asset_kind", ["photo", "video"]);

/** A photo or video. Files live on disk; this is their metadata. */
export const assets = pgTable(
  "assets",
  {
    id: id(),
    // Restrict: removing a user must deal with their files explicitly.
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: assetKind().notNull(),
    originalFilename: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: "number" }).notNull(),
    /** Hex SHA-256 of the original file, for per-user deduplication. */
    sha256: text().notNull(),
    width: integer(),
    height: integer(),
    takenAt: timestamp({ withTimezone: true }),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Path of the original, relative to the storage root. */
    storagePath: text().notNull(),
    sourceDeviceId: uuid().references(() => devices.id, { onDelete: "set null" }),
    /** Set when moved to trash. */
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex().on(t.userId, t.sha256),
    uniqueIndex().on(t.storagePath),
    index().on(t.userId, t.takenAt),
  ],
);
