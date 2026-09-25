import type { ProductRecord } from "@workspace/db";
import OpenAI from "openai";
import type { DesignInput } from "@workspace/api-zod";

type Design = DesignInput;
type Module = {
  wall: string;
  offsetIn: number;
  widthIn: number;
  category: string;
  label: string;
  productId: number | null;
};

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "kitchen", "cabinet", "cabinets", "style", "design",
  "look", "color", "colour", "finish", "material", "countertop", "countertops",
]);

const DEFAULT_DESIGN = {
  layout: "u",
  walls: { A: 144, B: 120, C: 144 },
  roomDepthIn: 144,
  ceilingIn: 96,
  island: { mode: "none", widthIn: 36, lengthIn: 72, fromLeftIn: 48, fromBackIn: 48 },
  style: "Modern Minimalist",
  countertop: "Quartz",
} as const;

const layoutWalls: Record<string, string[]> = {
  single: ["A"],
  l: ["A", "B"],
  u: ["A", "B", "C"],
  galley: ["A", "B"],
  open: ["A"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * Adds defaults only for omitted values and discards feature references to
 * walls removed by the selected layout. Explicitly supplied invalid values are
 * preserved so the API schema/measurement validation can report them.
 *
 * The unknown return type is intentional: callers can pass this result into
 * their request schema's safeParse before using it as a DesignInput.
 */
export function normalizeDesignInput(input: unknown): unknown {
  if (!isRecord(input)) return input;

  const output: Record<string, unknown> = { ...input };
  if (!own(input, "layout")) output.layout = DEFAULT_DESIGN.layout;
  const layout = typeof output.layout === "string" ? output.layout : "";
  const activeWalls = layoutWalls[layout];
  if (activeWalls) {
    if (!own(input, "walls")) {
      output.walls = Object.fromEntries(activeWalls.map(wall => [
        wall,
        DEFAULT_DESIGN.walls[wall as keyof typeof DEFAULT_DESIGN.walls] ?? 120,
      ]));
    } else if (isRecord(input.walls)) {
      const walls: Record<string, unknown> = Object.fromEntries(
        Object.entries(input.walls).filter(([wall]) =>
          !["A", "B", "C"].includes(wall) || activeWalls.includes(wall)),
      );
      for (const wall of activeWalls) {
        walls[wall] = own(input.walls, wall)
          ? input.walls[wall]
          : DEFAULT_DESIGN.walls[wall as keyof typeof DEFAULT_DESIGN.walls] ?? 120;
      }
      output.walls = walls;
    }

    for (const featureKey of ["windows", "openings", "fixtures"] as const) {
      if (!own(input, featureKey)) {
        output[featureKey] = [];
      } else if (Array.isArray(input[featureKey])) {
        // Keep malformed feature entries so safeParse can reject them; only a
        // known wall reference removed by the layout is discarded. Unknown
        // wall IDs must survive for route/domain validation to reject.
        output[featureKey] = input[featureKey].filter(item =>
          !isRecord(item) || typeof item.wall !== "string" ||
          !["A", "B", "C"].includes(item.wall) || activeWalls.includes(item.wall));
      }
    }
  }

  if (!own(input, "roomDepthIn")) output.roomDepthIn = DEFAULT_DESIGN.roomDepthIn;
  if (!own(input, "ceilingIn")) output.ceilingIn = DEFAULT_DESIGN.ceilingIn;
  if (!own(input, "style")) output.style = DEFAULT_DESIGN.style;
  if (!own(input, "countertop")) output.countertop = DEFAULT_DESIGN.countertop;

  if (!own(input, "island")) {
    output.island = { ...DEFAULT_DESIGN.island };
  } else if (isRecord(input.island)) {
    const island: Record<string, unknown> = { ...input.island };
    const defaults = DEFAULT_DESIGN.island;
    const roomDepth = typeof output.roomDepthIn === "number" && Number.isFinite(output.roomDepthIn)
      ? output.roomDepthIn
      : DEFAULT_DESIGN.roomDepthIn;
    const walls = isRecord(output.walls) ? output.walls : {};
    const roomWidth = layout === "u" || layout === "l"
      ? walls.B
      : layout === "open" || layout === "single"
        ? walls.A
        : roomDepth;
    const usableWidth = typeof roomWidth === "number" && Number.isFinite(roomWidth) ? roomWidth : 120;
    const widthDefault = Math.min(defaults.widthIn, Math.max(18, usableWidth));
    const lengthDefault = Math.min(defaults.lengthIn, Math.max(24, roomDepth));
    if (!own(input.island, "mode")) island.mode = defaults.mode;
    if (!own(input.island, "widthIn")) island.widthIn = widthDefault;
    if (!own(input.island, "lengthIn")) island.lengthIn = lengthDefault;
    if (!own(input.island, "fromLeftIn")) {
      const width = typeof island.widthIn === "number" && Number.isFinite(island.widthIn)
        ? island.widthIn
        : widthDefault;
      island.fromLeftIn = Math.min(defaults.fromLeftIn, Math.max(0, usableWidth - width));
    }
    if (!own(input.island, "fromBackIn")) {
      const length = typeof island.lengthIn === "number" && Number.isFinite(island.lengthIn)
        ? island.lengthIn
        : lengthDefault;
      island.fromBackIn = Math.min(defaults.fromBackIn, Math.max(0, roomDepth - length));
    }
    output.island = island;
  }

  return output;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTokens(value: string): string[] {
  return [...new Set(normalize(value).split(" ").filter(token => token.length >= 3 && !STOP_WORDS.has(token)))];
}

function productSearchText(product: ProductRecord): string {
  return normalize([
    product.sku,
    product.name,
    product.collection,
    product.finish,
    product.material,
    product.notes,
  ].join(" "));
}

function textRelevance(product: ProductRecord, query: string): number {
  const phrase = normalize(query);
  if (!phrase) return 0;

  const text = productSearchText(product);
  let score = text.includes(phrase) ? 36 : 0;

  for (const token of queryTokens(query)) {
    if (text.includes(token)) score += 8;
  }

  const normalizedCollection = normalize(product.collection);
  const normalizedFinish = normalize(product.finish);
  const normalizedMaterial = normalize(product.material);
  const normalizedName = normalize(product.name);

  if (normalizedCollection && phrase.includes(normalizedCollection)) score += 18;
  if (normalizedFinish && phrase.includes(normalizedFinish)) score += 14;
  if (normalizedMaterial && phrase.includes(normalizedMaterial)) score += 10;
  if (normalizedName && phrase.includes(normalizedName)) score += 12;

  return score;
}

function availabilityScore(product: ProductRecord): number {
  let score = product.status === "verified" ? 34 : 0;
  if (product.stockQty != null) score += product.stockQty > 0 ? 12 : -35;
  return score;
}

function familyAffinity(product: ProductRecord, anchor: ProductRecord | null): number {
  if (!anchor) return 0;

  let score = 0;
  if (normalize(product.collection) && normalize(product.collection) === normalize(anchor.collection)) score += 70;
  if (normalize(product.finish) && normalize(product.finish) === normalize(anchor.finish)) score += 30;
  if (normalize(product.material) && normalize(product.material) === normalize(anchor.material)) score += 15;
  return score;
}

function rankProducts(
  products: ProductRecord[],
  query: string,
  anchor: ProductRecord | null = null,
  extraScore: (product: ProductRecord) => number = () => 0,
): ProductRecord[] {
  return [...products].sort((a, b) => {
    const aScore = textRelevance(a, query) + availabilityScore(a) + familyAffinity(a, anchor) + extraScore(a);
    const bScore = textRelevance(b, query) + availabilityScore(b) + familyAffinity(b, anchor) + extraScore(b);
    if (bScore !== aScore) return bScore - aScore;
    return a.name.localeCompare(b.name);
  });
}

function isSinkBase(product: ProductRecord): boolean {
  const text = productSearchText(product);
  return /\bsink\b|\bsink base\b|\bsb\s?\d{2}\b/.test(text);
}

function publicProduct(product: ProductRecord) {
  const {
    updatedAt: _updatedAt,
    cost: _cost,
    stockQty: _stockQty,
    notes: _notes,
    ...visible
  } = product;
  return visible;
}

export function makeConcept(rawInput: Design, catalog: ProductRecord[]) {
  const input = normalizeDesignInput(rawInput) as Design;
  const warnings: string[] = [];
  const modules: Module[] = [];
  const selected = new Map<number, ProductRecord>();
  const active = catalog.filter(product => product.status !== "inactive");

  const cabinetWallKeys = input.layout === "u" ? ["A", "B", "C"] :
    input.layout === "single" ? ["A"] :
    input.layout === "open" ? [] : ["A", "B"];
  const featureWallKeys = input.layout === "open" ? ["A"] : cabinetWallKeys;

  if (input.ceilingIn < 72 || input.ceilingIn > 180 || input.roomDepthIn < 72 || input.roomDepthIn > 600) {
    throw new Error("Enter a ceiling height from 72–180 in and room depth from 72–600 in.");
  }

  for (const wall of cabinetWallKeys) {
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
    if (!featureWallKeys.includes(item.wall) || !Number.isFinite(item.offsetIn) ||
      item.offsetIn < 0 || item.widthIn <= 0 || item.offsetIn + item.widthIn > length) {
      throw new Error(`A feature on ${item.wall} does not fit the selected wall.`);
    }
  }

  for (const window of input.windows) {
    if (window.sillHeightIn < 0 || window.heightIn <= 0 ||
      window.sillHeightIn + window.heightIn > input.ceilingIn) {
      throw new Error("A window exceeds the ceiling height.");
    }
  }

  const roomWidth = input.layout === "u" || input.layout === "l"
    ? input.walls.B
    : input.layout === "open"
      ? input.walls.A
      : input.roomDepthIn;

  if (input.island.mode !== "none") {
    const island = input.island;
    if (island.widthIn < 18 || island.lengthIn < 24 || island.fromLeftIn < 0 || island.fromBackIn < 0 ||
      island.fromLeftIn + island.widthIn > roomWidth ||
      island.fromBackIn + island.lengthIn > input.roomDepthIn) {
      throw new Error("Island dimensions or position do not fit the room outline.");
    }

    const clearances = [
      island.fromLeftIn - (input.layout === "u" ? 24 : 0),
      roomWidth - island.fromLeftIn - island.widthIn - (input.layout === "u" ? 24 : 0),
      island.fromBackIn - (input.layout === "u" || input.layout === "l" ? 25 : 0),
      input.roomDepthIn - island.fromBackIn - island.lengthIn,
    ];
    if (Math.min(...clearances) < 36) {
      warnings.push("Island circulation is below 36 in in at least one direction. Confirm clearances with an Apex designer.");
    }
  }

  const baseCabinets = active.filter(product =>
    product.category === "base_cabinet" &&
    product.widthIn != null &&
    product.widthIn >= 6 &&
    product.widthIn <= 48,
  );
  const preferredBase = rankProducts(baseCabinets, input.style)[0] ?? null;

  if (cabinetWallKeys.length && !preferredBase) {
    warnings.push("No active base cabinets with usable widths are in the catalog yet.");
  } else if (preferredBase && input.style.trim() && textRelevance(preferredBase, input.style) === 0) {
    warnings.push("No close cabinet-style text match was found; the layout uses the strongest active catalog family available.");
  }

  const pickCabinetForGap = (freeIn: number) => {
    const fitting = baseCabinets.filter(product => (product.widthIn ?? Infinity) <= freeIn);
    return rankProducts(
      fitting,
      input.style,
      preferredBase,
      product => ((product.widthIn ?? 0) / Math.max(freeIn, 1)) * 28,
    )[0] ?? null;
  };

  const sinkCandidates = baseCabinets.filter(isSinkBase);

  for (const wall of cabinetWallKeys) {
    const length = input.walls[wall];
    const blocked = input.openings
      .filter(opening => opening.wall === wall)
      .map(opening => [opening.offsetIn, opening.offsetIn + opening.widthIn] as [number, number]);

    const fixtures = input.fixtures.filter(fixture => fixture.wall === wall);
    for (const fixture of fixtures) {
      blocked.push([fixture.offsetIn, fixture.offsetIn + fixture.widthIn]);

      let fixtureProduct: ProductRecord | null = null;
      if (fixture.kind === "sink") {
        fixtureProduct = rankProducts(
          sinkCandidates.filter(product => Math.abs((product.widthIn ?? fixture.widthIn) - fixture.widthIn) <= 6),
          input.style,
          preferredBase,
          product => 30 - Math.abs((product.widthIn ?? fixture.widthIn) - fixture.widthIn) * 4,
        )[0] ?? null;
        if (fixtureProduct) selected.set(fixtureProduct.id, fixtureProduct);
      }

      modules.push({
        wall,
        offsetIn: fixture.offsetIn,
        widthIn: fixture.widthIn,
        category: "fixture",
        label: fixture.kind,
        productId: fixtureProduct?.id ?? null,
      });
    }

    blocked.sort((a, b) => a[0] - b[0]);

    let cursor = wall === "B" && input.layout !== "galley"
      ? 25
      : wall === "C" && input.layout === "u"
        ? 25
        : 0;
    const end = length - (
      wall === "B" && input.layout === "u"
        ? 25
        : wall === "A" && (input.layout === "u" || input.layout === "l")
          ? 25
          : 0
    );

    while (cursor < end - 5) {
      const overlap = blocked.find(([start, stop]) => cursor >= start && cursor < stop);
      if (overlap) {
        cursor = overlap[1];
        continue;
      }

      const next = blocked.find(([start]) => start > cursor);
      const free = Math.min(next?.[0] ?? end, end) - cursor;
      const choice = pickCabinetForGap(free);

      if (!choice) {
        if (free >= 3) {
          warnings.push(`${wall} has ${Math.round(free)} in unfilled. An Apex designer must specify filler or a different module.`);
        }
        cursor += Math.max(free, 1);
        continue;
      }

      modules.push({
        wall,
        offsetIn: cursor,
        widthIn: choice.widthIn!,
        category: choice.category,
        label: choice.name,
        productId: choice.id,
      });
      selected.set(choice.id, choice);
      cursor += choice.widthIn!;
    }
  }

  // Open-plan layouts have no perimeter cabinet run, but wall A still
  // represents the measured room-width edge and may carry explicitly placed
  // fixtures. Include only those fixture modules; never synthesize cabinets.
  if (input.layout === "open") {
    for (const fixture of input.fixtures.filter(item => item.wall === "A")) {
      let fixtureProduct: ProductRecord | null = null;
      if (fixture.kind === "sink") {
        fixtureProduct = rankProducts(
          sinkCandidates.filter(product => Math.abs((product.widthIn ?? fixture.widthIn) - fixture.widthIn) <= 6),
          input.style,
          preferredBase,
          product => 30 - Math.abs((product.widthIn ?? fixture.widthIn) - fixture.widthIn) * 4,
        )[0] ?? null;
        if (fixtureProduct) selected.set(fixtureProduct.id, fixtureProduct);
      }

      modules.push({
        wall: fixture.wall,
        offsetIn: fixture.offsetIn,
        widthIn: fixture.widthIn,
        category: "fixture",
        label: fixture.kind,
        productId: fixtureProduct?.id ?? null,
      });
    }
  }

  const countertops = active.filter(product => product.category === "countertop");
  const countertop = rankProducts(countertops, input.countertop)[0] ?? null;
  if (countertop) {
    selected.set(countertop.id, countertop);
    if (input.countertop.trim() && textRelevance(countertop, input.countertop) === 0) {
      warnings.push("No close countertop text match was found; the strongest active catalog surface was used as the visual reference.");
    }
  } else {
    warnings.push("No active countertop record is available; countertop selection needs Apex confirmation.");
  }

  const wallCabinet = rankProducts(
    active.filter(product => product.category === "wall_cabinet"),
    input.style,
    preferredBase,
  )[0] ?? null;

  const tallCabinet = input.fixtures.some(fixture => fixture.kind === "fridge")
    ? rankProducts(
        active.filter(product => product.category === "tall_cabinet"),
        input.style,
        preferredBase,
      )[0] ?? null
    : null;

  const islandProduct = input.island.mode !== "none"
    ? rankProducts(
        active.filter(product => product.category === "island"),
        input.style,
        preferredBase,
        product => {
          const widthDelta = product.widthIn == null ? 0 : Math.abs(product.widthIn - input.island.widthIn);
          const lengthDelta = product.lengthIn == null ? 0 : Math.abs(product.lengthIn - input.island.lengthIn);
          return Math.max(0, 30 - (widthDelta + lengthDelta) * 0.5);
        },
      )[0] ?? null
    : null;

  if (input.windows.some(window => window.sillHeightIn < 36)) {
    warnings.push("A low window may interfere with a standard-height counter; verify on site.");
  }

  warnings.push("Concept only. Measurements, inventory, slab yield, code clearances and installation must be verified by Apex.");

  const products = [...selected.values()].map(publicProduct);
  const verified = products.length > 0 && products.every(product => product.status === "verified");
  if (!verified) warnings.unshift("Demo product records are illustrative and not confirmed for sale.");

  const units = modules.filter(module => module.productId);
  const totalKnown = units.every(module => selected.get(module.productId!)?.price != null) &&
    (!countertop || countertop.price != null);
  const approximateTotal = verified && totalKnown
    ? units.reduce((sum, module) => sum + (selected.get(module.productId!)?.price ?? 0), 0) +
      (countertop?.price ?? 0)
    : null;

  const primaryCabinet = preferredBase
    ? [preferredBase.collection, preferredBase.finish, preferredBase.material].filter(Boolean).join(" / ")
    : "";
  const primaryCountertop = countertop
    ? [countertop.material, countertop.finish].filter(Boolean).join(" / ")
    : "";

  return {
    title: `${{
      l: "L-shaped",
      u: "U-shaped",
      galley: "Galley",
      single: "Single-wall",
      open: "Open-plan",
    }[input.layout]} kitchen concept`,
    summary: `A ${input.layout.toUpperCase()} kitchen concept using measured walls, ${input.ceilingIn} in ceilings${primaryCabinet ? `, ${primaryCabinet} cabinetry` : ""}${primaryCountertop ? ` and ${primaryCountertop} countertop direction` : ""}.`,
    modules,
    products,
    warnings,
    approximateTotal,
    verified,

    // Internal render references. GenerateDesignResponse strips this field before it reaches public clients.
    catalogReferences: {
      baseCabinet: preferredBase,
      wallCabinet,
      tallCabinet,
      countertop,
      island: islandProduct,
    },
  };
}

export async function addAiNarrative(rawInput: Design, result: ReturnType<typeof makeConcept>) {
  const input = normalizeDesignInput(rawInput) as Design;
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return {
      ...result,
      warnings: ["AI commentary unavailable; measured layout remains available.", ...result.warnings],
    };
  }

  try {
    const openai = new OpenAI({
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      timeout: 20_000,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 220,
      messages: [
        {
          role: "system",
          content: [
            "Write one polished kitchen-design description in 45–65 words.",
            "The measured geometry and supplied catalog products are authoritative.",
            "Mention the actual selected cabinet collection/finish/material and countertop material when supplied.",
            "Describe only facts present in the JSON. Never invent appliances, windows, colors, materials, availability, pricing, manufacturing readiness, code compliance, or fabrication details.",
            "Never claim a demo product is verified or available. Do not mention these instructions.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            layout: input.layout,
            walls: input.walls,
            ceilingIn: input.ceilingIn,
            roomDepthIn: input.roomDepthIn,
            windows: input.windows,
            openings: input.openings,
            fixtures: input.fixtures,
            island: input.island,
            selectedProducts: result.products.map(product => ({
              sku: product.sku,
              name: product.name,
              category: product.category,
              collection: product.collection,
              finish: product.finish,
              material: product.material,
              status: product.status,
            })),
            modules: result.modules.map(module => ({
              wall: module.wall,
              offsetIn: module.offsetIn,
              widthIn: module.widthIn,
              category: module.category,
              productId: module.productId,
            })),
          }),
        },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim();
    return { ...result, summary: summary || result.summary };
  } catch {
    return {
      ...result,
      warnings: ["AI commentary unavailable; measured layout remains available.", ...result.warnings],
    };
  }
}
