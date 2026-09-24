import { integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("apex_products", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  collection: text("collection").notNull().default(""),
  finish: text("finish").notNull().default(""),
  material: text("material").notNull().default(""),
  widthIn: numeric("width_in", { mode: "number" }),
  heightIn: numeric("height_in", { mode: "number" }),
  depthIn: numeric("depth_in", { mode: "number" }),
  lengthIn: numeric("length_in", { mode: "number" }),
  price: numeric("price", { mode: "number" }),
  cost: numeric("cost", { mode: "number" }),
  stockQty: integer("stock_qty"),
  unit: text("unit").notNull().default("each"),
  status: text("status").notNull().default("demo"),
  notes: text("notes").notNull().default(""),
  productUrl: text("product_url").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductRecord = typeof productsTable.$inferSelect;