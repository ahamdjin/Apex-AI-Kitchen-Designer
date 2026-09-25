import { Router, type IRouter, type Request, type Response } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import {
  CreateProductBody, CreateProductResponse, UpdateProductBody, UpdateProductParams,
  UpdateProductResponse, DeleteProductParams, DeleteProductResponse,
  ListProductsResponse, ImportProductsBody, ImportProductsResponse,
  GetCatalogSummaryResponse, GenerateDesignBody, GenerateDesignResponse,
  RenderDesignImageBody, RenderDesignImageResponse,
  CreatePublicProductBody, CreatePublicProductResponse, ListPublicProductsResponse,
} from "@workspace/api-zod";
import { readCatalogCsv } from "../lib/catalog-csv";
import { addAiNarrative, makeConcept, normalizeDesignInput } from "../lib/apex-design";
import { renderKitchenImage } from "../lib/apex-render";
import { consumeRateLimit } from "../lib/rate-limit";

const router: IRouter = Router();
const FIFTEEN_MINUTES = 15 * 60_000;

const visible = (row: typeof productsTable.$inferSelect) => {
  const { updatedAt: _updatedAt, ...product } = row;
  return product;
};

function parseLimit(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 500 ? parsed : fallback;
}

function clientRateKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const agent = (req.get("user-agent") || "unknown").slice(0, 160);
  return `${ip}|${agent}`;
}

async function enforceRateLimit(
  req: Request,
  res: Response,
  scope: string,
  limit: number,
): Promise<boolean> {
  const state = await consumeRateLimit(scope, clientRateKey(req), limit, FIFTEEN_MINUTES);
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(state.remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(state.resetAt.getTime() / 1000)));

  if (state.allowed) return true;

  res.setHeader("Retry-After", String(Math.max(1, Math.ceil((state.resetAt.getTime() - Date.now()) / 1000))));
  res.status(429).json({ error: "Request limit reached. Please try again later." });
  return false;
}

function productError(product: typeof productsTable.$inferInsert): string | null {
  const requiredText = [
    ["sku", product.sku, 100],
    ["name", product.name, 200],
  ] as const;
  for (const [key, value, max] of requiredText) {
    const normalized = value?.trim() ?? "";
    if (!normalized) return `${key} is required.`;
    if (normalized.length > max) return `${key} is too long.`;
  }

  const optionalText = [
    ["collection", product.collection, 120],
    ["finish", product.finish, 120],
    ["material", product.material, 120],
    ["unit", product.unit, 30],
    ["notes", product.notes, 2000],
    ["productUrl", product.productUrl, 500],
  ] as const;
  for (const [key, value, max] of optionalText) {
    if ((value ?? "").length > max) return `${key} is too long.`;
  }

  if (product.productUrl?.trim()) {
    try {
      const url = new URL(product.productUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "productUrl must use http or https.";
    } catch {
      return "productUrl must be a valid URL.";
    }
  }

  for (const key of ["widthIn", "heightIn", "depthIn", "lengthIn", "price", "cost", "stockQty"] as const) {
    const value = product[key];
    if (value != null && (!Number.isFinite(value) || value < 0 || (key !== "stockQty" && value === 0))) {
      return `${key} must be a positive number (stock may be zero).`;
    }
  }

  if (product.status !== "verified") return null;
  if (product.category === "countertop") {
    if (!product.material?.trim() || !product.widthIn || !product.lengthIn) {
      return "Review material, width and length before verifying a countertop.";
    }
  } else if (product.category?.endsWith("_cabinet")) {
    if (!product.material?.trim() || !product.widthIn || !product.heightIn || !product.depthIn) {
      return "Review material, width, height and depth before verifying a cabinet.";
    }
  }
  return null;
}

function designError(input: {
  walls: Record<string, number>;
  windows: unknown[];
  openings: unknown[];
  fixtures: unknown[];
  style: string;
  countertop: string;
}): string | null {
  if (input.windows.length > 20 || input.openings.length > 20 || input.fixtures.length > 20) {
    return "Use no more than 20 windows, 20 openings and 20 fixtures per design.";
  }
  if (Object.keys(input.walls).some((key) => !["A", "B", "C"].includes(key))) {
    return "Only walls A, B and C are supported.";
  }
  for (const [label, value] of [["style", input.style], ["countertop", input.countertop]] as const) {
    if (value.length > 120) return `${label} must be 120 characters or fewer.`;
    if (/[\u0000-\u001F\u007F]/.test(value)) return `${label} contains unsupported control characters.`;
  }
  return null;
}

const publicProductFields = [
  "sku", "name", "category", "collection", "finish", "material",
  "widthIn", "heightIn", "depthIn", "lengthIn", "price", "unit", "productUrl",
] as const;

type PublicProductRow = Pick<typeof productsTable.$inferSelect,
  "id" | "sku" | "name" | "category" | "collection" | "finish" | "material" |
  "widthIn" | "heightIn" | "depthIn" | "lengthIn" | "price" | "unit" | "status" | "productUrl">;

function publicProduct(row: PublicProductRow) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    collection: row.collection,
    finish: row.finish,
    material: row.material,
    widthIn: row.widthIn,
    heightIn: row.heightIn,
    depthIn: row.depthIn,
    lengthIn: row.lengthIn,
    price: row.price,
    unit: row.unit,
    status: row.status,
    productUrl: row.productUrl,
  };
}

router.get("/catalog/products", async (_req, res): Promise<void> => {
  const records = await db.select({
    id: productsTable.id,
    sku: productsTable.sku,
    name: productsTable.name,
    category: productsTable.category,
    collection: productsTable.collection,
    finish: productsTable.finish,
    material: productsTable.material,
    widthIn: productsTable.widthIn,
    heightIn: productsTable.heightIn,
    depthIn: productsTable.depthIn,
    lengthIn: productsTable.lengthIn,
    price: productsTable.price,
    unit: productsTable.unit,
    status: productsTable.status,
    productUrl: productsTable.productUrl,
  }).from(productsTable).where(ne(productsTable.status, "inactive")).orderBy(productsTable.id);
  res.json(ListPublicProductsResponse.parse(records.map(publicProduct)));
});

router.post("/catalog/products", async (req, res): Promise<void> => {
  if (!await enforceRateLimit(req, res, "public-catalog-create", parseLimit("PUBLIC_CATALOG_CREATE_RATE_LIMIT_PER_15M", 10))) return;
  if (Buffer.byteLength(JSON.stringify(req.body ?? null), "utf8") > 12_000) {
    res.status(413).json({ error: "Product submission is too large." });
    return;
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Product submission must be an object." });
    return;
  }
  const unsupported = Object.keys(req.body).filter((key) => !(publicProductFields as readonly string[]).includes(key));
  if (unsupported.length) {
    res.status(400).json({ error: `Unsupported public product field: ${unsupported[0]}.` });
    return;
  }
  const parsed = CreatePublicProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!parsed.data.sku.trim() || !parsed.data.name.trim()) {
    res.status(400).json({ error: "SKU and name must not be blank." });
    return;
  }
  if (parsed.data.productUrl?.trim()) {
    try {
      const url = new URL(parsed.data.productUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        res.status(400).json({ error: "productUrl must use http or https." });
        return;
      }
    } catch {
      res.status(400).json({ error: "productUrl must be a valid URL." });
      return;
    }
  }
  try {
    const [record] = await db.insert(productsTable).values({
      ...parsed.data,
      status: "demo",
    }).returning({
      id: productsTable.id,
      sku: productsTable.sku,
      name: productsTable.name,
      category: productsTable.category,
      collection: productsTable.collection,
      finish: productsTable.finish,
      material: productsTable.material,
      widthIn: productsTable.widthIn,
      heightIn: productsTable.heightIn,
      depthIn: productsTable.depthIn,
      lengthIn: productsTable.lengthIn,
      price: productsTable.price,
      unit: productsTable.unit,
      status: productsTable.status,
      productUrl: productsTable.productUrl,
    });
    res.status(201).json(CreatePublicProductResponse.parse(publicProduct(record)));
  } catch (error) {
    req.log.warn({ error }, "Public product creation rejected");
    res.status(409).json({ error: "SKU already exists or product data is invalid." });
  }
});

router.get("/products", async (_req, res): Promise<void> => {
  const records = await db.select().from(productsTable).orderBy(productsTable.id);
  res.json(ListProductsResponse.parse(records.map(visible)));
});

router.post("/products", async (req, res): Promise<void> => {
  if (!await enforceRateLimit(req, res, "catalog-create", parseLimit("CATALOG_CREATE_RATE_LIMIT_PER_15M", 20))) return;
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const validationError = productError(parsed.data);
  if (validationError) { res.status(400).json({ error: validationError }); return; }
  try {
    const [record] = await db.insert(productsTable).values(parsed.data).returning();
    res.status(201).json(CreateProductResponse.parse(visible(record)));
  } catch (error) {
    req.log.warn({ error }, "Product creation rejected");
    res.status(409).json({ error: "SKU already exists or product data is invalid." });
  }
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  if (!await enforceRateLimit(req, res, "catalog-update", parseLimit("CATALOG_UPDATE_RATE_LIMIT_PER_15M", 120))) return;
  const params = UpdateProductParams.safeParse(req.params);
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid product id or fields." }); return; }
  try {
    const [previous] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
    if (!previous) { res.status(404).json({ error: "Product not found." }); return; }
    const validationError = productError({ ...previous, ...body.data });
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    const [record] = await db.update(productsTable).set(body.data).where(eq(productsTable.id, params.data.id)).returning();
    if (!record) { res.status(404).json({ error: "Product not found." }); return; }
    res.json(UpdateProductResponse.parse(visible(record)));
  } catch (error) {
    req.log.warn({ error }, "Product update rejected");
    res.status(409).json({ error: "SKU already exists or product data is invalid." });
  }
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  if (!await enforceRateLimit(req, res, "catalog-delete", parseLimit("CATALOG_DELETE_RATE_LIMIT_PER_15M", 30))) return;
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid product id." }); return; }
  const [record] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  res.json(DeleteProductResponse.parse({ deleted: !!record }));
});

router.post("/products/import", async (req, res): Promise<void> => {
  if (!await enforceRateLimit(req, res, "catalog-import", parseLimit("CATALOG_IMPORT_RATE_LIMIT_PER_15M", 5))) return;
  const body = ImportProductsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  let parsed: ReturnType<typeof readCatalogCsv>;
  try { parsed = readCatalogCsv(body.data.csv); }
  catch (error) { res.status(400).json({ error: (error as Error).message }); return; }

  let created = 0, updated = 0;
  const errors = [...parsed.errors];
  for (const [index, record] of parsed.records.entries()) {
    try {
      const validationError = productError(record);
      if (validationError) {
        errors.push(`Row ${index + 2}: ${validationError}`);
        continue;
      }
      const existing = await db.select({ id: productsTable.id }).from(productsTable)
        .where(eq(productsTable.sku, record.sku)).limit(1);
      if (existing[0]) {
        const [current] = await db.select().from(productsTable).where(eq(productsTable.id, existing[0].id));
        if (current.status === "verified") {
          errors.push(`Row ${index + 2}: verified SKU ${record.sku} was skipped; edit it manually after review.`);
          continue;
        }
        await db.update(productsTable).set(record).where(eq(productsTable.id, existing[0].id));
        updated++;
      } else {
        await db.insert(productsTable).values(record);
        created++;
      }
    } catch {
      errors.push(`Import failed for SKU ${record.sku}. Check field values.`);
    }
  }
  res.json(ImportProductsResponse.parse({ created, updated, errors }));
});

router.get("/catalog-summary", async (_req, res): Promise<void> => {
  const rows = await db.select().from(productsTable);
  res.json(GetCatalogSummaryResponse.parse({
    total: rows.length,
    verified: rows.filter(p => p.status === "verified").length,
    demo: rows.filter(p => p.status === "demo").length,
    cabinets: rows.filter(p => p.category.endsWith("_cabinet")).length,
    countertops: rows.filter(p => p.category === "countertop").length,
  }));
});

router.post("/designs/generate", async (req, res): Promise<void> => {
  const parsed = GenerateDesignBody.safeParse(normalizeDesignInput(req.body));
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const validationError = designError(parsed.data);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  try {
    if (!await enforceRateLimit(req, res, "design", parseLimit("DESIGN_RATE_LIMIT_PER_15M", 30))) return;
    const catalog = await db.select().from(productsTable);
    const concept = makeConcept(parsed.data, catalog);
    const described = await addAiNarrative(parsed.data, concept);
    res.json(GenerateDesignResponse.parse(described));
  } catch (error) {
    req.log.warn({ error }, "Design generation rejected");
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not generate the design." });
  }
});

router.post("/designs/render", async (req, res): Promise<void> => {
  const parsed = RenderDesignImageBody.safeParse(normalizeDesignInput(req.body));
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const validationError = designError(parsed.data);
  if (validationError) { res.status(400).json({ error: validationError }); return; }

  let concept: ReturnType<typeof makeConcept>;
  try {
    if (!await enforceRateLimit(req, res, "render", parseLimit("RENDER_RATE_LIMIT_PER_15M", 8))) return;
    const catalog = await db.select().from(productsTable);
    concept = makeConcept(parsed.data, catalog);
  } catch (error) {
    req.log.warn({ error }, "Render request rejected");
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not prepare the render." });
    return;
  }

  try {
    const imageDataUrl = await renderKitchenImage(parsed.data, concept);
    res.json(RenderDesignImageResponse.parse({
      imageDataUrl,
      disclaimer: "Illustrative AI concept only. The measured floor plan, not this image, defines the layout. Materials, products, dimensions and fabrication must be confirmed by Apex.",
    }));
  } catch (error) {
    req.log.error({ error }, "Kitchen image generation failed");
    res.status(502).json({ error: "The photorealistic image could not be generated right now. Your measured floor plan is still available; please retry the image." });
  }
});

export default router;
