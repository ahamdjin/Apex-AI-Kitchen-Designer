import type { ProductRecord } from "@workspace/db";
import OpenAI from "openai";
import type { DesignInput } from "@workspace/api-zod";

type Design = DesignInput;
type Module = { wall: string; offsetIn: number; widthIn: number; category: string; label: string; productId: number | null };

export function makeConcept(input: Design, catalog: ProductRecord[]) {
  const warnings: string[] = [];
  const modules: Module[] = [];
  const selected = new Map<number, ProductRecord>();
  const active = catalog.filter(p => p.status !== "inactive");
  const wallKeys = input.layout === "u" ? ["A", "B", "C"] :
    input.layout === "single" ? ["A"] : input.layout === "open" ? [] : ["A", "B"];

  if (input.ceilingIn < 72 || input.ceilingIn > 180 || input.roomDepthIn < 72 || input.roomDepthIn > 600) {
    throw new Error("Enter a ceiling height from 72–180 in and room depth from 72–600 in.");
  }
  for (const wall of wallKeys) {
    const length = input.walls[wall];
    if (!Number.isFinite(length) || length < 60 || length > 600) {
      throw new Error(`${wall} must be between 60 and 600 inches.`);
    }
  }
  if (input.layout === "open" && (!Number.isFinite(input.walls.A) || input.walls.A < 60 || input.walls.A > 600)) {
    throw new Error("Room width must be between 60 and 600 inches.");
  }
  for (const item of [...input.windows, ...input.openings, ...input.fixtures]) {
    const length = input.walls[item.wall];
    if (!wallKeys.includes(item.wall) || !Number.isFinite(item.offsetIn) ||
      item.offsetIn < 0 || item.widthIn <= 0 || item.offsetIn + item.widthIn > length) {
      throw new Error(`A feature on ${item.wall} does not fit the selected wall.`);
    }
  }
  for (const w of input.windows) {
    if (w.sillHeightIn < 0 || w.heightIn <= 0 || w.sillHeightIn + w.heightIn > input.ceilingIn) {
      throw new Error("A window exceeds the ceiling height.");
    }
  }

  const roomWidth = input.layout === "u" || input.layout === "l" ? input.walls.B : input.layout === "open" ? input.walls.A : input.roomDepthIn;
  if (input.island.mode !== "none") {
    const i = input.island;
    if (i.widthIn < 18 || i.lengthIn < 24 || i.fromLeftIn < 0 || i.fromBackIn < 0 ||
        i.fromLeftIn + i.widthIn > roomWidth || i.fromBackIn + i.lengthIn > input.roomDepthIn) {
      throw new Error("Island dimensions or position do not fit the room outline.");
    }
    const clearances = [
      i.fromLeftIn - (input.layout === "u" ? 24 : 0),
      roomWidth - i.fromLeftIn - i.widthIn - (input.layout === "u" ? 24 : 0),
      i.fromBackIn - (input.layout === "u" || input.layout === "l" ? 25 : 0),
      input.roomDepthIn - i.fromBackIn - i.lengthIn,
    ];
    if (Math.min(...clearances) < 36) {
      warnings.push("Island circulation is below 36 in in at least one direction. Confirm clearances with an Apex designer.");
    }
  }

  for (const wall of wallKeys) {
    const length = input.walls[wall];
    const blocked = input.openings.filter(o => o.wall === wall)
      .map(o => [o.offsetIn, o.offsetIn + o.widthIn]);
    const fixtures = input.fixtures.filter(f => f.wall === wall);
    for (const fixture of fixtures) {
      blocked.push([fixture.offsetIn, fixture.offsetIn + fixture.widthIn]);
      modules.push({ wall, offsetIn: fixture.offsetIn, widthIn: fixture.widthIn,
        category: "fixture", label: fixture.kind, productId: null });
    }
    blocked.sort((a, b) => a[0] - b[0]);
    let cursor = wall === "B" && input.layout !== "galley" ? 25 : wall === "C" && input.layout === "u" ? 25 : 0;
    const end = length - (wall === "B" && input.layout === "u" ? 25 : wall === "A" && (input.layout === "u" || input.layout === "l") ? 25 : 0);
    const candidates = active.filter(p => p.category === "base_cabinet" &&
      p.widthIn && p.widthIn > 0 && p.widthIn <= 48 &&
      (!input.style || !p.collection || p.collection.toLowerCase().includes(input.style.toLowerCase())))
      .sort((a, b) => (b.widthIn ?? 0) - (a.widthIn ?? 0));
    if (!candidates.length) {
      warnings.push(`No matching base cabinet records for ${wall}; upload sizes before specifying sellable units.`);
      continue;
    }
    while (cursor < end - 5) {
      const overlap = blocked.find(([start, stop]) => cursor >= start && cursor < stop);
      if (overlap) { cursor = overlap[1]; continue; }
      const next = blocked.find(([start]) => start > cursor);
      const free = Math.min(next?.[0] ?? end, end) - cursor;
      const choice = candidates.find(p => (p.widthIn ?? Infinity) <= free);
      if (!choice) {
        if (free >= 3) warnings.push(`${wall} has ${Math.round(free)} in unfilled. An Apex designer must specify filler or a different module.`);
        cursor += Math.max(free, 1);
        continue;
      }
      modules.push({ wall, offsetIn: cursor, widthIn: choice.widthIn!,
        category: choice.category, label: choice.name, productId: choice.id });
      selected.set(choice.id, choice);
      cursor += choice.widthIn!;
    }
  }
  const tops = active.filter(p => p.category === "countertop" &&
    (!input.countertop || p.material.toLowerCase().includes(input.countertop.toLowerCase()) ||
      p.name.toLowerCase().includes(input.countertop.toLowerCase())));
  if (tops[0]) selected.set(tops[0].id, tops[0]);
  else warnings.push("No matching countertop record yet; countertop selection needs Apex confirmation.");
  if (input.windows.some(w => w.sillHeightIn < 36)) {
    warnings.push("A low window may interfere with a standard-height counter; verify on site.");
  }
  warnings.push("Concept only. Measurements, inventory, slab yield, code clearances and installation must be verified by Apex.");
  const products = [...selected.values()].map(({ updatedAt: _updatedAt, ...product }) => product);
  const verified = products.length > 0 && products.every(p => p.status === "verified");
  if (!verified) warnings.unshift("Demo product records are illustrative and not confirmed for sale.");
  const units = modules.filter(m => m.productId);
  const totalKnown = units.every(m => selected.get(m.productId!)?.price != null) &&
    (!tops[0] || tops[0].price != null);
  const approximateTotal = verified && totalKnown
    ? units.reduce((sum, m) => sum + (selected.get(m.productId!)?.price ?? 0), 0) + (tops[0]?.price ?? 0)
    : null;
  return {
    title: `${{ l: "L-shaped", u: "U-shaped", galley: "Galley", single: "Single-wall", open: "Open-plan" }[input.layout]} kitchen concept`,
    summary: `A ${input.layout.toUpperCase()} kitchen concept using measured walls, ${input.ceilingIn} in ceilings and ${input.island.mode === "none" ? "no island" : `a ${input.island.mode} island`}.`,
    modules, products, warnings, approximateTotal, verified,
  };
}

export async function addAiNarrative(input: Design, result: ReturnType<typeof makeConcept>) {
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return { ...result, warnings: ["AI commentary unavailable; measured layout remains available.", ...result.warnings] };
  }
  try {
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      timeout: 20000,
    });
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 180,
      messages: [
        { role: "system", content: "Write one short, warm kitchen design description (max 50 words). Describe ONLY the provided measured layout and catalog selections. Never imply products are available, verified, manufacturable, priced or fabrication-ready. Do not add windows, appliances, materials or units not supplied." },
        { role: "user", content: JSON.stringify({ layout: input.layout, walls: input.walls, windows: input.windows, island: input.island, selectedProducts: result.products.map(p => ({ name: p.name, status: p.status })), modules: result.modules.length }) },
      ],
    });
    const summary = response.choices[0]?.message?.content?.trim();
    return { ...result, summary: summary || result.summary };
  } catch {
    return { ...result, warnings: ["AI commentary unavailable; measured layout remains available.", ...result.warnings] };
  }
}