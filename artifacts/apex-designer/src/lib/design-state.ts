import { useState, useEffect } from 'react';
import type { DesignInput, DesignInputLayout, IslandInputMode } from '@workspace/api-client-react';

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

export function useDesignState() {
  const [design, setDesign] = useState<DesignInput>(() => {
    try {
      const saved = localStorage.getItem('apex-design');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load design", e);
    }
    return defaultDesign;
  });

  useEffect(() => {
    localStorage.setItem('apex-design', JSON.stringify(design));
  }, [design]);

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
