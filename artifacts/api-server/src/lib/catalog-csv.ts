import { CreateProductBody } from "@workspace/api-zod";
import type { ProductInput } from "@workspace/api-zod";

const columns = ["sku", "name", "category", "collection", "finish", "material", "widthIn", "heightIn",
  "depthIn", "lengthIn", "price", "cost", "stockQty", "unit", "status", "notes", "productUrl"] as const;
const numbers = new Set<string>(["widthIn", "heightIn", "depthIn", "lengthIn", "price", "cost", "stockQty"]);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("CSV has an unclosed quoted field.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function readCatalogCsv(csv: string) {
  const rows = parseCsv(csv.replace(/^\uFEFF/, ""));
  const header = rows.shift()?.map(c => c.trim()) ?? [];
  if (!["sku", "name", "category", "status"].every(key => header.includes(key))) {
    throw new Error("CSV needs sku, name, category and status headers. Download the template for all fields.");
  }
  if (rows.length > 500) throw new Error("Import at most 500 products at once.");
  const records: ProductInput[] = [], errors: string[] = [];
  rows.forEach((row, index) => {
    if (row.every(cell => !cell.trim())) return;
    const data: Record<string, unknown> = {};
    for (const key of columns) {
      const position = header.indexOf(key);
      if (position < 0) continue;
      const value = (row[position] ?? "").trim();
      if (numbers.has(key)) {
        data[key] = value === "" ? null : Number(value);
      } else data[key] = value;
    }
    if (data.status === "verified") {
      errors.push(`Row ${index + 2}: CSV imports cannot self-verify products. Import as demo, then verify after reviewing specifications.`);
      return;
    }
    const parsed = CreateProductBody.safeParse(data);
    if (!parsed.success || Object.values(data).some(v => typeof v === "number" && !Number.isFinite(v))) {
      errors.push(`Row ${index + 2}: invalid product field or numeric value.`);
    } else records.push(parsed.data);
  });
  return { records, errors };
}