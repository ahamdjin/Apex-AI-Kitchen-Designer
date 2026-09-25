import { integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const rateLimitsTable = pgTable("apex_rate_limits", {
  scope: text("scope").notNull(),
  keyHash: text("key_hash").notNull(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.scope, table.keyHash] }),
]);
