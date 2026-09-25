import { Router, type IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateProductBody, CreateProductResponse, UpdateProductBody, UpdateProductParams,
  UpdateProductResponse, DeleteProductParams, DeleteProductResponse,
  ListProductsResponse, ImportProductsBody, ImportProductsResponse,
  GetCatalogSummaryResponse, GenerateDesignBody, GenerateDesignResponse,
  RenderDesignImageBody, RenderDesignImageResponse,
} from "@workspace/api-zod";
import { readCatalogCsv } from "../lib/catalog-csv";
import { addAiNarrative, makeConcept } from "../lib/apex-design";
import { renderKitchenImage } from "../lib/apex-render";

const router: IRouter = Router();
const renderAttempts = new Map<string, { count: number; resetAt: number }>();
const visible = (row: typeof productsTable.$inferSelect) => {
  const { updatedAt: _updatedAt, ...product } = row;
  return product;
};

function productError(product: typeof productsTable.$inferInsert): string | null {
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

router.get("/products", async (_req, res): Promise<void> => {
  const records = await db.select().from(productsTable).orderBy(productsTable.id);
  res.json(ListProductsResponse.parse(records.map(visible)));
});

router.post("/products", async (req, res): Promise<void> => {
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
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid product id." }); return; }
  const [record] = await db.delete(productsTable).where(eq(productsTable.id, params.data.id)).returning();
  res.json(DeleteProductResponse.parse({ deleted: !!record }));
});

router.post("/products/import", async (req, res): Promise<void> => {
  const body = ImportProductsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  let parsed: ReturnType<typeof readCatalogCsv>;
  try { parsed = readCatalogCsv(body.data.csv); }
  catch (error) { res.status(400).json({ error: (error as Error).message }); return; }
  let created = 0, updated = 0;
  const errors = [...parsed.errors];
  for (const [index, record] of parsed.records.entries()) {
    try {
      const existing = await db.select({ id: productsTable.id }).from(productsTable)
        .where(eq(productsTable.sku, record.sku)).limit(1);
      if (existing[0]) {
        // A CSV cannot silently downgrade a manually verified product.
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
  const parsed = GenerateDesignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const catalog = await db.select().from(productsTable);
    const concept = makeConcept(parsed.data, catalog);
    const described = await addAiNarrative(parsed.data, concept);
    res.json(GenerateDesignResponse.parse(described));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/designs/render", async (req, res): Promise<void> => {
  const parsed = RenderDesignImageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let concept: ReturnType<typeof makeConcept>;
  try {
    const catalog = await db.select().from(productsTable);
    concept = makeConcept(parsed.data, catalog);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
    return;
  }

  // This demo is publicly accessible. Limit costly generation per connecting IP.
  const key = req.ip ?? "unknown";
  const now = Date.now();
  if (renderAttempts.size > 1000) {
    for (const [ip, entry] of renderAttempts) if (entry.resetAt <= now) renderAttempts.delete(ip);
  }
  const previous = renderAttempts.get(key);
  const entry = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + 15 * 60_000 };
  if (entry.count >= 8) {
    res.status(429).json({ error: "Image limit reached. Please try again in a few minutes." });
    return;
  }
  entry.count++;
  renderAttempts.set(key, entry);

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