import { useId, useState } from 'react';
import type { DesignInput, DesignResult } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X, ZoomIn, ZoomOut, Scan } from 'lucide-react';
import { getWallsForLayout } from '@/lib/design-state';

interface Props {
  design: DesignInput;
  result: DesignResult | null;
  onChange?: (design: DesignInput) => void;
}

type PlanElementType = 'window' | 'opening' | 'fixture' | 'cabinet';

export function DesignerCanvas({ design, result, onChange }: Props) {
  const SCALE = 4;
  const MARGIN = 120;
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const gridId = useId().replace(/:/g, '');
  const titleId = useId().replace(/:/g, '');

  const aIn = Math.max(design.walls.A || 0, 1);
  const bIn = Math.max(design.walls.B || 0, 1);
  const cIn = Math.max(design.walls.C || 0, 1);
  const roomDepthIn = Math.max(design.roomDepthIn || 0, 1);
  const galleyGapIn = Math.max(60, Math.min(roomDepthIn, 180));

  const planWidthIn =
    design.layout === 'u' || design.layout === 'l' ? bIn :
    design.layout === 'galley' ? galleyGapIn :
    design.layout === 'open' ? aIn :
    Math.max(72, Math.min(roomDepthIn, 180));

  const planHeightIn =
    design.layout === 'u' ? Math.max(aIn, cIn) :
    design.layout === 'l' ? aIn :
    design.layout === 'galley' ? Math.max(aIn, bIn) :
    design.layout === 'open' ? roomDepthIn :
    aIn;

  const contentWidth = planWidthIn * SCALE;
  const contentHeight = planHeightIn * SCALE;
  const fullWidth = contentWidth + MARGIN * 2;
  const fullHeight = contentHeight + MARGIN * 2;
  const uiScale = Math.max(1, Math.min(4.5, Math.max(contentWidth, contentHeight) / 700));

  const zoomedWidth = fullWidth / zoom;
  const zoomedHeight = fullHeight / zoom;
  const viewX = (fullWidth - zoomedWidth) / 2;
  const viewY = (fullHeight - zoomedHeight) / 2;

  const ox = MARGIN;
  const oy = MARGIN;

  const generateWallsPath = () => {
    const aLen = aIn * SCALE;
    const bLen = bIn * SCALE;
    const cLen = cIn * SCALE;
    const gap = galleyGapIn * SCALE;

    if (design.layout === 'single') {
      return 'M ' + ox + ' ' + oy + ' L ' + ox + ' ' + (oy + aLen);
    }
    if (design.layout === 'l') {
      return 'M ' + ox + ' ' + (oy + aLen) + ' L ' + ox + ' ' + oy + ' L ' + (ox + bLen) + ' ' + oy;
    }
    if (design.layout === 'u') {
      return 'M ' + ox + ' ' + (oy + aLen) + ' L ' + ox + ' ' + oy + ' L ' + (ox + bLen) + ' ' + oy + ' L ' + (ox + bLen) + ' ' + (oy + cLen);
    }
    if (design.layout === 'galley') {
      return 'M ' + ox + ' ' + oy + ' L ' + ox + ' ' + (oy + aLen) + ' M ' + (ox + gap) + ' ' + oy + ' L ' + (ox + gap) + ' ' + (oy + bLen);
    }
    if (design.layout === 'open') {
      const width = aIn * SCALE;
      const depth = roomDepthIn * SCALE;
      return 'M ' + ox + ' ' + oy + ' L ' + (ox + width) + ' ' + oy + ' L ' + (ox + width) + ' ' + (oy + depth) + ' L ' + ox + ' ' + (oy + depth) + ' Z';
    }
    return '';
  };

  const getWallSegment = (wall: string) => {
    const aLen = aIn * SCALE;
    const bLen = bIn * SCALE;
    const cLen = cIn * SCALE;
    const gap = galleyGapIn * SCALE;

    if (design.layout === 'u') {
      if (wall === 'A') return { x1: ox, y1: oy + aLen, x2: ox, y2: oy };
      if (wall === 'B') return { x1: ox, y1: oy, x2: ox + bLen, y2: oy };
      if (wall === 'C') return { x1: ox + bLen, y1: oy, x2: ox + bLen, y2: oy + cLen };
    }
    if (design.layout === 'l') {
      if (wall === 'A') return { x1: ox, y1: oy + aLen, x2: ox, y2: oy };
      if (wall === 'B') return { x1: ox, y1: oy, x2: ox + bLen, y2: oy };
    }
    if (design.layout === 'single') {
      if (wall === 'A') return { x1: ox, y1: oy, x2: ox, y2: oy + aLen };
    }
    if (design.layout === 'galley') {
      if (wall === 'A') return { x1: ox, y1: oy, x2: ox, y2: oy + aLen };
      if (wall === 'B') return { x1: ox + gap, y1: oy, x2: ox + gap, y2: oy + bLen };
    }
    if (design.layout === 'open') {
      if (wall === 'A') return { x1: ox, y1: oy, x2: ox + aLen, y2: oy };
    }
    return null;
  };

  const interiorSign = (wall: string) => {
    if (design.layout === 'galley') return wall === 'A' ? -1 : 1;
    if (design.layout === 'single') return -1;
    return 1;
  };

  const drawWallSegment = (wall: string) => {
    const segment = getWallSegment(wall);
    if (!segment) return null;

    const isSelected = selectedWall === wall;
    const midX = (segment.x1 + segment.x2) / 2;
    const midY = (segment.y1 + segment.y2) / 2;
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;

    return (
      <g key={'wall-group-' + wall}>
        <line
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke="transparent"
          strokeWidth={Math.max(36, 24 * uiScale)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          onClick={() => onChange && setSelectedWall(wall)}
        />
        {isSelected && onChange && (
          <line
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke="hsl(var(--primary))"
            strokeWidth={10}
            opacity={0.28}
            strokeLinecap="square"
            vectorEffect="non-scaling-stroke"
            className="pointer-events-none"
          />
        )}

        {onChange && (
          <>
            <circle
              cx={segment.x1}
              cy={segment.y1}
              r={4 * uiScale}
              fill="hsl(var(--destructive))"
              className="pointer-events-none"
            />
            <text
              x={segment.x1 + (dx === 0 ? 14 * uiScale : -10 * uiScale)}
              y={segment.y1 + (dy === 0 ? -12 * uiScale : 12 * uiScale)}
              fontSize={10 * uiScale}
              fill="hsl(var(--destructive))"
              className="font-bold pointer-events-none"
            >
              0"
            </text>
          </>
        )}

        <text
          x={midX + (dx === 0 ? 18 * uiScale : 0)}
          y={midY + (dy === 0 ? -16 * uiScale : 0)}
          textAnchor="middle"
          fontSize={12 * uiScale}
          fill="currentColor"
          className="font-mono font-semibold pointer-events-none"
        >
          {'Wall ' + wall + ' · ' + (design.walls[wall] || 0) + '"'}
        </text>
      </g>
    );
  };

  const drawElementOnWall = (
    wall: string,
    offset: number,
    width: number,
    type: PlanElementType,
    label: string,
    itemKey: string,
  ) => {
    const segment = getWallSegment(wall);
    if (!segment) return null;

    const length = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(offset) ||
      !Number.isFinite(width) || width <= 0 || offset < 0 ||
      (offset + width) * SCALE > length) {
      return null;
    }

    const startRatio = (offset * SCALE) / length;
    const widthScaled = width * SCALE;
    const startX = segment.x1 + (segment.x2 - segment.x1) * startRatio;
    const startY = segment.y1 + (segment.y2 - segment.y1) * startRatio;
    const depth = (type === 'cabinet' ? 24 : type === 'fixture' ? 26 : 8) * SCALE;

    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const segmentLength = Math.hypot(dx, dy);
    const nx = -dy / segmentLength;
    const ny = dx / segmentLength;
    const sign = interiorSign(wall);

    const cx = startX + (dx / segmentLength) * (widthScaled / 2) + nx * (depth / 2) * sign;
    const cy = startY + (dy / segmentLength) * (widthScaled / 2) + ny * (depth / 2) * sign;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    let fill = 'transparent';
    let stroke = 'hsl(var(--primary))';

    if (type === 'window') {
      stroke = '#60a5fa';
      fill = 'rgba(96, 165, 250, 0.18)';
    } else if (type === 'opening') {
      stroke = '#f97316';
      fill = 'rgba(249, 115, 22, 0.15)';
    } else if (type === 'fixture') {
      stroke = '#a855f7';
      fill = 'rgba(168, 85, 247, 0.16)';
    } else if (type === 'cabinet') {
      fill = 'hsl(var(--card))';
    }

    const compactLabel = label.length > 14 ? label.slice(0, 13) + '…' : label;
    const textSize = Math.max(8, Math.min(12, width / 3.2)) * uiScale;

    return (
      <g key={itemKey} transform={'translate(' + cx + ', ' + cy + ') rotate(' + angle + ')'}>
        <rect
          x={-widthScaled / 2}
          y={-depth / 2}
          width={widthScaled}
          height={depth}
          rx={type === 'cabinet' ? 2 * uiScale : 1 * uiScale}
          fill={fill}
          stroke={stroke}
          strokeWidth={type === 'cabinet' ? 2.2 : 2}
          vectorEffect="non-scaling-stroke"
          className="transition-all duration-300"
        />
        {(type === 'fixture' || type === 'cabinet') && width >= 9 && (
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={textSize}
            fill="currentColor"
            className="font-mono font-semibold opacity-75 pointer-events-none"
          >
            {compactLabel}
          </text>
        )}
      </g>
    );
  };

  const drawIsland = () => {
    if (design.island.mode === 'none') return null;

    const x = ox + design.island.fromLeftIn * SCALE;
    const y = oy + design.island.fromBackIn * SCALE;
    const width = design.island.widthIn * SCALE;
    const length = design.island.lengthIn * SCALE;

    return (
      <g transform={'translate(' + (x + width / 2) + ', ' + (y + length / 2) + ')'}>
        <rect
          x={-width / 2}
          y={-length / 2}
          width={width}
          height={length}
          rx={3 * uiScale}
          fill="hsl(var(--card))"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          strokeDasharray={design.island.mode === 'new' ? '8 6' : undefined}
          vectorEffect="non-scaling-stroke"
        />
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11 * uiScale}
          fill="currentColor"
          className="font-mono font-semibold pointer-events-none"
        >
          {'ISLAND · ' + design.island.widthIn + '" × ' + design.island.lengthIn + '"'}
        </text>
      </g>
    );
  };

  const layoutLabel = {
    u: 'U-shaped',
    l: 'L-shaped',
    galley: 'Galley',
    single: 'Single wall',
    open: 'Open / island',
  }[design.layout];

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden select-none ${result ? 'bg-muted/60 p-2 sm:p-3' : ''}`}>
      <div className={`relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden ${result ? 'border-2 border-b-0 border-foreground bg-card' : ''}`}>
      <div className="absolute left-3 top-3 z-10 hidden max-w-[220px] rounded-md border bg-card/92 p-3 text-[11px] shadow-sm backdrop-blur sm:block">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Measured plan</p>
        <p className="mt-1 font-medium">{layoutLabel}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="size-2 border-2 border-primary bg-card" />Cabinet</span>
          <span className="flex items-center gap-1.5"><i className="size-2 border-2 border-purple-500 bg-purple-500/20" />Fixture</span>
          <span className="flex items-center gap-1.5"><i className="size-2 border-2 border-blue-400 bg-blue-400/20" />Window</span>
          <span className="flex items-center gap-1.5"><i className="size-2 border-2 border-orange-500 bg-orange-500/20" />Opening</span>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-card/92 p-1 shadow-sm backdrop-blur">
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setZoom(value => Math.max(1, Number((value - 0.25).toFixed(2))))} disabled={zoom <= 1} aria-label="Zoom out plan">
          <ZoomOut className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setZoom(1)} aria-label="Fit plan">
          <Scan className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setZoom(value => Math.min(2.5, Number((value + 0.25).toFixed(2))))} disabled={zoom >= 2.5} aria-label="Zoom in plan">
          <ZoomIn className="size-4" />
        </Button>
      </div>

      <svg width="100%" height="100%" viewBox={[viewX, viewY, zoomedWidth, zoomedHeight].join(' ')} preserveAspectRatio="xMidYMid meet" className="h-full w-full max-w-full" role="img" aria-labelledby={titleId}>
        <title id={titleId}>{layoutLabel + ' measured kitchen plan'}</title>
        <defs>
          <pattern id={gridId} width={10 * SCALE} height={10 * SCALE} patternUnits="userSpaceOnUse">
            <path d={'M ' + (10 * SCALE) + ' 0 L 0 0 0 ' + (10 * SCALE)} fill="none" stroke="hsl(var(--border))" strokeWidth="1" strokeOpacity="0.42" vectorEffect="non-scaling-stroke" />
          </pattern>
        </defs>

        <rect x={0} y={0} width={fullWidth} height={fullHeight} fill={'url(#' + gridId + ')'} />

        {design.layout === 'open' && (
          <rect x={ox} y={oy} width={aIn * SCALE} height={roomDepthIn * SCALE} fill="hsl(var(--card) / 0.32)" stroke="none" />
        )}

        <path d={generateWallsPath()} fill="none" stroke="hsl(var(--foreground))" strokeWidth={6} strokeLinecap="square" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />

        {getWallsForLayout(design.layout).map(drawWallSegment)}

        {design.windows.map((window, index) => drawElementOnWall(window.wall, window.offsetIn, window.widthIn, 'window', 'WIN', 'window-' + index))}
        {design.openings.map((opening, index) => drawElementOnWall(opening.wall, opening.offsetIn, opening.widthIn, 'opening', 'OPEN', 'opening-' + index))}

        {result
          ? result.modules.map((module, index) => {
              const product = module.productId == null ? undefined : result.products.find(item => item.id === module.productId);
              const type: PlanElementType = module.category === 'fixture' ? 'fixture' : 'cabinet';
              const label = type === 'fixture' ? module.label.toUpperCase() : product?.sku || Math.round(module.widthIn) + '" CAB';
              return drawElementOnWall(module.wall, module.offsetIn, module.widthIn, type, label, 'module-' + index);
            })
          : design.fixtures.map((fixture, index) => drawElementOnWall(fixture.wall, fixture.offsetIn, fixture.widthIn, 'fixture', fixture.kind.toUpperCase(), 'fixture-' + index))}

        {drawIsland()}
      </svg>

      {!result && !selectedWall && (
        <div className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] gap-1.5 overflow-x-auto rounded-md border bg-card/92 p-2 text-[9px] text-muted-foreground shadow-sm backdrop-blur sm:hidden">
          <span className="whitespace-nowrap">Blue: cabinet</span><span>·</span><span className="whitespace-nowrap">Purple: fixture</span><span>·</span><span className="whitespace-nowrap">Tap a wall to edit</span>
        </div>
      )}

      {selectedWall && onChange && (
        <Card className="absolute bottom-3 left-3 right-3 z-20 max-h-[62%] overflow-y-auto border-primary/60 bg-card/96 p-4 shadow-xl backdrop-blur sm:bottom-auto sm:left-auto sm:right-4 sm:top-14 sm:w-72">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Plan editor</p><h3 className="text-sm font-bold">Wall {selectedWall}</h3></div>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setSelectedWall(null)} aria-label="Close wall editor"><X className="size-4" /></Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Length (in)</Label>
              <Input type="number" className="h-8" min={1} value={design.walls[selectedWall] || 0} onChange={(event) => onChange({ ...design, walls: { ...design.walls, [selectedWall]: Number(event.target.value) } })} />
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Windows on this wall</Label>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                  const wallLength = Math.max(design.walls[selectedWall] || 60, 18);
                  const widthIn = Math.min(36, Math.max(18, wallLength / 3));
                  const offsetIn = Math.max(0, (wallLength - widthIn) / 2);
                  onChange({ ...design, windows: [...design.windows, { wall: selectedWall, offsetIn, widthIn, heightIn: 48, sillHeightIn: 36 }] });
                }}>
                  <Plus className="mr-1 size-3" /> Add
                </Button>
              </div>

              <div className="space-y-2">
                {design.windows.filter(window => window.wall === selectedWall).length === 0 && <p className="text-xs text-muted-foreground">No windows on this wall.</p>}
                {design.windows.map((window, index) => window.wall === selectedWall && (
                  <div key={index} className="relative grid grid-cols-3 gap-2 rounded border bg-muted/30 p-2 pt-7 text-xs">
                    <Button variant="ghost" size="icon" className="absolute right-1 top-1 size-5" onClick={() => onChange({ ...design, windows: design.windows.filter((_, itemIndex) => itemIndex !== index) })} aria-label="Remove window"><X className="size-3 text-destructive" /></Button>
                    <label className="space-y-1"><span className="text-[9px] uppercase text-muted-foreground">Offset</span><Input type="number" className="h-7 text-xs" value={window.offsetIn} onChange={(event) => {
                      const windows = [...design.windows]; windows[index] = { ...windows[index], offsetIn: Number(event.target.value) }; onChange({ ...design, windows });
                    }} /></label>
                    <label className="space-y-1"><span className="text-[9px] uppercase text-muted-foreground">Width</span><Input type="number" className="h-7 text-xs" value={window.widthIn} onChange={(event) => {
                      const windows = [...design.windows]; windows[index] = { ...windows[index], widthIn: Number(event.target.value) }; onChange({ ...design, windows });
                    }} /></label>
                    <label className="space-y-1"><span className="text-[9px] uppercase text-muted-foreground">Sill</span><Input type="number" className="h-7 text-xs" value={window.sillHeightIn} onChange={(event) => {
                      const windows = [...design.windows]; windows[index] = { ...windows[index], sillHeightIn: Number(event.target.value) }; onChange({ ...design, windows });
                    }} /></label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
      </div>
      {result && (
        <div className="grid w-full shrink-0 grid-cols-[minmax(0,1fr)_64px_64px] border-2 border-foreground bg-card text-foreground sm:grid-cols-[minmax(0,1fr)_86px_86px]" aria-label="Floor plan title block">
          <div className="min-w-0 px-2 py-2 sm:px-4 sm:py-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em]">Apex Kitchens / Design Study</p>
            <p className="mt-1 text-sm font-semibold leading-tight">Proposed floor plan</p>
            <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{layoutLabel} kitchen · Concept only</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide">Not for construction</p>
          </div>
          <div className="flex flex-col justify-center border-l-2 border-foreground px-1.5 py-2 sm:px-3">
            <span className="font-mono text-[9px] uppercase text-muted-foreground">Sheet</span>
            <strong className="text-sm leading-tight">SK-01</strong>
          </div>
          <div className="flex flex-col justify-center border-l-2 border-foreground px-1.5 py-2 sm:px-3">
            <span className="font-mono text-[9px] uppercase text-muted-foreground">Scale</span>
            <strong className="text-sm leading-tight">NTS</strong>
          </div>
        </div>
      )}
    </div>
  );
}
