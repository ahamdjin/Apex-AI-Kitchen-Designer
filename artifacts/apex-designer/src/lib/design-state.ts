import { useState, useEffect } from 'react';
import type {
  DesignInput,
  DesignInputLayout,
  FixtureInput,
  IslandInputMode,
  OpeningInput,
  WindowInput,
} from '@workspace/api-client-react';

const defaultDesign: DesignInput = {
  layout: 'u',
  walls: { A: 144, B: 120, C: 144 },
  roomDepthIn: 144,
  ceilingIn: 96,
  windows: [],
  openings: [],
  fixtures: [
    { kind: 'sink', wall: 'B', offsetIn: 48, widthIn: 36 },
    { kind: 'range', wall: 'A', offsetIn: 60, widthIn: 30 },
    { kind: 'fridge', wall: 'C', offsetIn: 24, widthIn: 36 },
  ],
  island: {
    mode: 'none',
    widthIn: 36,
    lengthIn: 72,
    fromLeftIn: 48,
    fromBackIn: 48,
  },
  style: 'Modern Minimalist',
  countertop: 'Quartz',
};

const validLayouts = new Set<DesignInputLayout>(['single', 'l', 'u', 'galley', 'open']);
const validFixtureKinds = new Set<FixtureInput['kind']>(['sink', 'range', 'fridge', 'dishwasher']);
const validIslandModes = new Set<IslandInputMode>(['none', 'existing', 'new']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Reconcile persisted or edited input with the selected layout. Missing feature
 * collections intentionally become empty: removed fixtures are never restored
 * from defaults when a user later switches back to a larger layout.
 */
export function normalizeDesignInput(value: unknown): DesignInput {
  const source = isRecord(value) ? value : {};
  const layout = validLayouts.has(source.layout as DesignInputLayout)
    ? source.layout as DesignInputLayout
    : defaultDesign.layout;
  const activeWalls = getWallsForLayout(layout);
  const sourceWalls = isRecord(source.walls) ? source.walls : {};
  const wallDefaults = defaultDesign.walls;
  const walls = Object.fromEntries(activeWalls.map(wall => [
    wall,
    finiteNumber(sourceWalls[wall], wallDefaults[wall] ?? 120),
  ]));

  const filterFeatures = <T extends { wall: string }>(items: unknown, fallback: T[] = []): T[] =>
    Array.isArray(items)
      ? items.filter((item): item is T => isRecord(item) && activeWalls.includes(String(item.wall)))
      : fallback;

  const windows = filterFeatures<WindowInput>(source.windows).filter(window =>
    Number.isFinite(window.offsetIn) && Number.isFinite(window.widthIn) &&
    Number.isFinite(window.heightIn) && Number.isFinite(window.sillHeightIn));
  const openings = filterFeatures<OpeningInput>(source.openings).filter(opening =>
    Number.isFinite(opening.offsetIn) && Number.isFinite(opening.widthIn));
  const fixtures = filterFeatures<FixtureInput>(source.fixtures).filter(fixture =>
    validFixtureKinds.has(fixture.kind) && Number.isFinite(fixture.offsetIn) && Number.isFinite(fixture.widthIn));

  const roomDepthIn = finiteNumber(source.roomDepthIn, defaultDesign.roomDepthIn);
  const ceilingIn = finiteNumber(source.ceilingIn, defaultDesign.ceilingIn);
  const roomWidth = layout === 'u' || layout === 'l'
    ? finiteNumber(walls.B, 120)
    : layout === 'open' || layout === 'single'
      ? finiteNumber(walls.A, 144)
      : roomDepthIn;
  const rawIsland = isRecord(source.island) ? source.island : {};
  const mode = validIslandModes.has(rawIsland.mode as IslandInputMode)
    ? rawIsland.mode as IslandInputMode
    : defaultDesign.island.mode;
  const islandWidth = Math.min(Math.max(18, finiteNumber(rawIsland.widthIn, defaultDesign.island.widthIn)), Math.max(18, roomWidth));
  const islandLength = Math.min(Math.max(24, finiteNumber(rawIsland.lengthIn, defaultDesign.island.lengthIn)), Math.max(24, roomDepthIn));
  const island = {
    mode,
    widthIn: islandWidth,
    lengthIn: islandLength,
    fromLeftIn: Math.min(Math.max(0, finiteNumber(rawIsland.fromLeftIn, 48)), Math.max(0, roomWidth - islandWidth)),
    fromBackIn: Math.min(Math.max(0, finiteNumber(rawIsland.fromBackIn, 48)), Math.max(0, roomDepthIn - islandLength)),
  };

  return {
    layout,
    walls,
    roomDepthIn,
    ceilingIn,
    windows,
    openings,
    fixtures,
    island,
    style: typeof source.style === 'string' && source.style.trim() ? source.style : defaultDesign.style,
    countertop: typeof source.countertop === 'string' && source.countertop.trim() ? source.countertop : defaultDesign.countertop,
  };
}

export function useDesignState() {
  const [design, setStoredDesign] = useState<DesignInput>(() => {
    try {
      const saved = localStorage.getItem('apex-design');
      if (saved) {
        return normalizeDesignInput(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load design", e);
    }
    return normalizeDesignInput(defaultDesign);
  });

  useEffect(() => {
    localStorage.setItem('apex-design', JSON.stringify(design));
  }, [design]);

  const setDesign = (nextDesign: DesignInput) => setStoredDesign(normalizeDesignInput(nextDesign));
  return [design, setDesign] as const;
}

export function getWallsForLayout(layout: DesignInputLayout): string[] {
  switch (layout) {
    case 'single': return ['A'];
    case 'l': return ['A', 'B'];
    case 'u': return ['A', 'B', 'C'];
    case 'galley': return ['A', 'B']; // Parallel walls
    case 'open': return ['A']; // Room width for the open-plan outline
    default: return ['A'];
  }
}
