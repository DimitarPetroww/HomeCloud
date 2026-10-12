import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { assets } from "../assets/assets.schema.ts";
import { createdAt, id, updatedAt } from "../db/columns.ts";
import { users } from "../users/users.schema.ts";

export const albums = pgTable(
  "albums",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const albumAssets = pgTable(
  "album_assets",
  {
    albumId: uuid()
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    assetId: uuid()
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.albumId, t.assetId] }), index().on(t.assetId)],
);
