import type { DesignInput, DesignResult } from '@workspace/api-client-react';

interface Props {
  design: DesignInput;
  result: DesignResult | null;
}

function Box3D({ x, y, z, w, d, h, colorClass, borderClass, label }: any) {
  const c = colorClass || "bg-stone-200 dark:bg-stone-700";
  const b = borderClass || "border-stone-300 dark:border-stone-600";
  return (
    <div className="absolute transition-all duration-500" style={{ left: x, top: y, width: w, height: d, transform: `translateZ(${z}px)`, transformStyle: 'preserve-3d' }}>
      {/* Top (+Z) */}
      <div className={`absolute inset-0 ${c} border ${b} flex items-center justify-center overflow-hidden`} style={{ transform: `translateZ(${h}px)` }}>
         {label && <span className="text-[10px] font-mono opacity-50 font-bold whitespace-nowrap">{label}</span>}
      </div>
      {/* Front (+Y) */}
      <div className={`absolute ${c} brightness-[0.85] border ${b}`} style={{ width: w, height: h, top: d, transformOrigin: 'top', transform: 'rotateX(-90deg)' }} />
      {/* Back (-Y) */}
      <div className={`absolute ${c} brightness-[0.85] border ${b}`} style={{ width: w, height: h, top: 0, transformOrigin: 'top', transform: 'rotateX(-90deg)' }} />
      {/* Left (-X) */}
      <div className={`absolute ${c} brightness-[0.70] border ${b}`} style={{ width: h, height: d, left: 0, transformOrigin: 'left', transform: 'rotateY(-90deg)' }} />
      {/* Right (+X) */}
      <div className={`absolute ${c} brightness-[0.70] border ${b}`} style={{ width: h, height: d, left: w, transformOrigin: 'left', transform: 'rotateY(-90deg)' }} />
    </div>
  )
}

export function Canvas3D({ design, result }: Props) {
  // 1 inch = 1.5px to fit within view
  const SCALE = 1.5;
  const th = 6 * SCALE; // wall thickness

  const maxW = Math.max(design.walls.A || 0, design.walls.C || 0, design.roomDepthIn || 200) * SCALE + 200;
  const maxH = Math.max(design.walls.B || 0, design.roomDepthIn || 200) * SCALE + 200;

  const aLen = (design.walls.A || 0) * SCALE;
  const bLen = (design.walls.B || 0) * SCALE;
  const cLen = (design.walls.C || 0) * SCALE;
  const ceiling = (design.ceilingIn || 96) * SCALE;
  const roomDepth = (design.roomDepthIn || 120) * SCALE;

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden" style={{ perspective: '1200px' }}>
      <div 
        className="relative transition-transform duration-700 ease-out" 
        style={{ 
          width: bLen + 100, 
          height: Math.max(aLen, cLen, roomDepth) + 100, 
          transformStyle: 'preserve-3d', 
          transform: 'rotateX(60deg) rotateZ(45deg)' 
        }}
      >
        
        {/* Floor */}
        <div className="absolute inset-0 bg-muted/40 border border-muted-foreground/20 shadow-2xl" style={{ transform: 'translateZ(-1px)' }} />

        {/* WALL A (Left) */}
        {(design.layout === 'l' || design.layout === 'u' || design.layout === 'single' || design.layout === 'galley') && (
          <Box3D x={0} y={0} z={0} w={th} d={aLen} h={ceiling} colorClass="bg-zinc-100 dark:bg-zinc-800" borderClass="border-zinc-300 dark:border-zinc-700" label="WALL A" />
        )}

        {/* WALL B (Top) */}
        {(design.layout === 'l' || design.layout === 'u' || design.layout === 'galley') && (
          <Box3D x={design.layout === 'galley' ? 60*SCALE : 0} y={0} z={0} w={bLen} d={th} h={ceiling} colorClass="bg-zinc-200 dark:bg-zinc-900" borderClass="border-zinc-300 dark:border-zinc-700" label="WALL B" />
        )}

        {/* WALL C (Right) */}
        {(design.layout === 'u') && (
          <Box3D x={bLen - th} y={0} z={0} w={th} d={cLen} h={ceiling} colorClass="bg-zinc-100 dark:bg-zinc-800" borderClass="border-zinc-300 dark:border-zinc-700" label="WALL C" />
        )}

        {/* Windows */}
        {design.windows.map((w, i) => {
          let wx=0, wy=0, ww=0, wd=0;
          if (w.wall === 'A') { wx = -1; wy = w.offsetIn * SCALE; ww = th + 2; wd = w.widthIn * SCALE; }
          if (w.wall === 'B') { wy = -1; wx = w.offsetIn * SCALE; wd = th + 2; ww = w.widthIn * SCALE; }
          if (w.wall === 'C') { wx = bLen - th - 1; wy = w.offsetIn * SCALE; ww = th + 2; wd = w.widthIn * SCALE; }
          return <Box3D key={`win-${i}`} x={wx} y={wy} z={w.sillHeightIn * SCALE} w={ww} d={wd} h={w.heightIn * SCALE} colorClass="bg-blue-400/50" borderClass="border-blue-500" label="WIN" />
        })}

        {/* Openings */}
        {design.openings.map((o, i) => {
          let wx=0, wy=0, ww=0, wd=0;
          if (o.wall === 'A') { wx = -1; wy = o.offsetIn * SCALE; ww = th + 2; wd = o.widthIn * SCALE; }
          if (o.wall === 'B') { wy = -1; wx = o.offsetIn * SCALE; wd = th + 2; ww = o.widthIn * SCALE; }
          if (o.wall === 'C') { wx = bLen - th - 1; wy = o.offsetIn * SCALE; ww = th + 2; wd = o.widthIn * SCALE; }
          return <Box3D key={`op-${i}`} x={wx} y={wy} z={0} w={ww} d={wd} h={80 * SCALE} colorClass="bg-orange-500/50" borderClass="border-orange-600" label="OPEN" />
        })}

        {/* Cabinets / Fixtures */}
        {(result ? result.modules : (design.fixtures as any[])).map((m: any, i: number) => {
          const depth = 24 * SCALE;
          const width = m.widthIn * SCALE;
          const height = 34.5 * SCALE;
          const offset = m.offsetIn * SCALE;
          let cx=0, cy=0, cw=0, cd=0;

          if (m.wall === 'A') {
            cx = th; cy = offset; cw = depth; cd = width;
          } else if (m.wall === 'B') {
            cx = offset; cy = th; cw = width; cd = depth;
          } else if (m.wall === 'C') {
            cx = bLen - th - depth; cy = offset; cw = depth; cd = width;
          } else {
            return null; // fallback
          }

          const isFixture = !!m.kind;
          const label = m.label || (m.kind && m.kind.toUpperCase()) || 'CAB';
          const colorClass = isFixture ? "bg-purple-300 dark:bg-purple-800" : "bg-primary dark:bg-primary/80";

          return <Box3D key={`cab-${i}`} x={cx} y={cy} z={0} w={cw} d={cd} h={height} colorClass={colorClass} label={label} />
        })}

        {/* Island */}
        {design.island.mode !== 'none' && (
          <Box3D 
            x={design.island.fromLeftIn * SCALE} 
            y={design.island.fromBackIn * SCALE} 
            z={0} 
            w={design.island.widthIn * SCALE} 
            d={design.island.lengthIn * SCALE} 
            h={34.5 * SCALE} 
            colorClass="bg-accent dark:bg-accent/80" 
            label="ISLAND" 
          />
        )}

      </div>
    </div>
  );
}