import { useState } from 'react';
import type { DesignInput, DesignResult } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { getWallsForLayout } from '@/lib/design-state';

interface Props {
  design: DesignInput;
  result: DesignResult | null;
  onChange?: (design: DesignInput) => void;
}

export function DesignerCanvas({ design, result, onChange }: Props) {
  
  // A simplistic mapping to SVG 2D top-down view.
  // We'll map 1 inch = 4 pixels for drawing.
  const SCALE = 4;
  
  const [selectedWall, setSelectedWall] = useState<string | null>(null);

  // Canvas bounds based on max walls.
  const maxWidth = Math.max(design.walls.A || 0, design.walls.C || 0, design.roomDepthIn || 200) * SCALE + 200;
  const maxHeight = Math.max(design.walls.B || 0, design.roomDepthIn || 200) * SCALE + 200;

  // Let's create a coordinate system where:
  // Wall B is Top horizontal (if U-shape)
  // Wall A is Left vertical
  // Wall C is Right vertical
  
  const generateWallsPath = () => {
    let d = "";
    const wallThickness = 6 * SCALE;
    
    // Top-left origin
    const ox = 100;
    const oy = 100;

    // Draw lines representing the walls
    if (design.layout === 'single') {
      const len = (design.walls.A || 100) * SCALE;
      d = `M ${ox} ${oy} L ${ox} ${oy + len}`;
    } else if (design.layout === 'l') {
      const aLen = (design.walls.A || 100) * SCALE;
      const bLen = (design.walls.B || 100) * SCALE;
      // Wall A going down
      // Wall B going right from top of A
      d = `M ${ox} ${oy + aLen} L ${ox} ${oy} L ${ox + bLen} ${oy}`;
    } else if (design.layout === 'u') {
      const aLen = (design.walls.A || 100) * SCALE;
      const bLen = (design.walls.B || 100) * SCALE;
      const cLen = (design.walls.C || 100) * SCALE;
      // Wall A going up, Wall B right, Wall C going down
      d = `M ${ox} ${oy + aLen} L ${ox} ${oy} L ${ox + bLen} ${oy} L ${ox + bLen} ${oy + cLen}`;
    } else if (design.layout === 'galley') {
      const aLen = (design.walls.A || 100) * SCALE;
      const bLen = (design.walls.B || 100) * SCALE;
      const gap = 60 * SCALE;
      d = `M ${ox} ${oy} L ${ox} ${oy + aLen} M ${ox + gap} ${oy} L ${ox + gap} ${oy + bLen}`;
    } else if (design.layout === 'open') {
      // Just a bounding box representing room
      const w = (design.walls.A || 100) * SCALE;
      const h = (design.roomDepthIn || 100) * SCALE;
      d = `M ${ox} ${oy} L ${ox+w} ${oy} L ${ox+w} ${oy+h} L ${ox} ${oy+h} Z`;
    }

    return d;
  };

  // Helper to get line segment for a wall to map fixtures/windows on it
  const getWallSegment = (wall: string) => {
    const ox = 100, oy = 100;
    const aLen = (design.walls.A || 0) * SCALE;
    const bLen = (design.walls.B || 0) * SCALE;
    const cLen = (design.walls.C || 0) * SCALE;

    if (design.layout === 'u') {
      if (wall === 'A') return { x1: ox, y1: oy + aLen, x2: ox, y2: oy, angle: 90 };
      if (wall === 'B') return { x1: ox, y1: oy, x2: ox + bLen, y2: oy, angle: 0 };
      if (wall === 'C') return { x1: ox + bLen, y1: oy, x2: ox + bLen, y2: oy + cLen, angle: 90 };
    }
    if (design.layout === 'l') {
      if (wall === 'A') return { x1: ox, y1: oy + aLen, x2: ox, y2: oy, angle: 90 };
      if (wall === 'B') return { x1: ox, y1: oy, x2: ox + bLen, y2: oy, angle: 0 };
    }
    if (design.layout === 'single') {
      if (wall === 'A') return { x1: ox, y1: oy, x2: ox, y2: oy + aLen, angle: 90 };
    }
    if (design.layout === 'galley') {
      if (wall === 'A') return { x1: ox, y1: oy, x2: ox, y2: oy + aLen, angle: 90 };
      if (wall === 'B') return { x1: ox + 60*SCALE, y1: oy, x2: ox + 60*SCALE, y2: oy + bLen, angle: 90 };
    }
    return null;
  };

  const drawWallSegment = (wall: string) => {
    const seg = getWallSegment(wall);
    if (!seg) return null;
    
    const isSelected = selectedWall === wall;
    const midX = (seg.x1 + seg.x2) / 2;
    const midY = (seg.y1 + seg.y2) / 2;
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Draw offset arrow indicator at the start corner
    const arrowX = seg.x1 + (dx === 0 ? 0 : Math.sign(dx) * 20);
    const arrowY = seg.y1 + (dy === 0 ? 0 : Math.sign(dy) * 20);

    return (
      <g key={`wall-group-${wall}`}>
        {/* Invisible thick line for click target */}
        <line 
          x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} 
          stroke="transparent" 
          strokeWidth={40} 
          className="cursor-pointer"
          onClick={() => setSelectedWall(wall)}
        />
        {isSelected && (
          <line 
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} 
            stroke="hsl(var(--primary))" 
            strokeWidth={12} 
            className="pointer-events-none opacity-50 transition-opacity"
            strokeLinecap="square"
          />
        )}
        
        {/* Origin arrow */}
        <circle cx={seg.x1} cy={seg.y1} r={6} fill="hsl(var(--destructive))" className="pointer-events-none" />
        <text x={seg.x1 + (dx===0?15:-15)} y={seg.y1 + (dy===0?-15:15)} fontSize="10" fill="hsl(var(--destructive))" className="font-bold pointer-events-none">0"</text>
        <text x={midX + (dx === 0 ? 18 : 0)} y={midY + (dy === 0 ? -18 : 0)} textAnchor="middle" fontSize="13" fill="currentColor" className="font-mono font-semibold pointer-events-none">
          {`Wall ${wall} · ${design.walls[wall] || 0}"`}
        </text>
      </g>
    );
  };
  const drawElementOnWall = (wall: string, offset: number, width: number, type: 'window' | 'opening' | 'fixture' | 'cabinet', label: string) => {
    const seg = getWallSegment(wall);
    if (!seg) return null;

    const length = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
    const startRatio = (offset * SCALE) / length;
    const widthScaled = width * SCALE;
    
    // Simplistic interpolation
    const startX = seg.x1 + (seg.x2 - seg.x1) * startRatio;
    const startY = seg.y1 + (seg.y2 - seg.y1) * startRatio;
    
    const depth = type === 'cabinet' ? 24 * SCALE : type === 'fixture' ? 26 * SCALE : 8 * SCALE;
    
    // Normal vector
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const l = Math.hypot(dx, dy);
    const nx = -dy / l; // normal x
    const ny = dx / l;  // normal y
    
    // Shift cabinets inwards. Wait, the normal points left/up depending on orientation.
    // For U shape: A (up), nx=1 (right). B (right), nx=0, ny=1 (down). C (down), nx=-1 (left).
    const isInterior = (wall === 'A' || wall === 'B' || wall === 'C' && seg.y2 > seg.y1) ? 1 : -1;
    
    const cx = startX + (dx/l) * (widthScaled / 2) + nx * (depth / 2) * isInterior;
    const cy = startY + (dy/l) * (widthScaled / 2) + ny * (depth / 2) * isInterior;

    let fill = "transparent";
    let stroke = "hsl(var(--primary))";
    let strokeWidth = 2;
    let depthColor = "hsl(var(--primary) / 0.5)";
    
    if (type === 'window') {
      stroke = "#60a5fa"; // blue-400
      fill = "rgba(96, 165, 250, 0.2)";
      depthColor = "#93c5fd";
    } else if (type === 'opening') {
      stroke = "#f97316";
      fill = "rgba(249, 115, 22, 0.2)";
      depthColor = "#fdba74";
    } else if (type === 'fixture') {
      stroke = "#a855f7"; // purple-500
      fill = "rgba(168, 85, 247, 0.2)";
      depthColor = "#d8b4fe";
    } else if (type === 'cabinet') {
      stroke = "hsl(var(--border))";
      fill = "hsl(var(--card))";
      depthColor = "hsl(var(--muted-foreground) / 0.2)";
    }

    // Box rotation
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Make it look 3D by adding a shadow/depth polygon
    return (
      <g key={`${type}-${wall}-${offset}-${width}`} transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
        {/* Depth shadow */}
        {(type === 'cabinet' || type === 'fixture') && (
          <polygon 
            points={`${-widthScaled/2},${depth/2} ${widthScaled/2},${depth/2} ${widthScaled/2 + 4},${depth/2 + 4} ${-widthScaled/2 + 4},${depth/2 + 4}`}
            fill={depthColor}
          />
        )}
        <rect 
          x={-widthScaled / 2} 
          y={-depth / 2} 
          width={widthScaled} 
          height={depth} 
          fill={fill} 
          stroke={stroke} 
          strokeWidth={strokeWidth}
          className="transition-all duration-300 shadow-xl"
        />
        {(type === 'fixture' || type === 'cabinet') && (
          <text 
            x={0} 
            y={0} 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fontSize={type === 'cabinet' ? 8 : 10}
            fill="currentColor"
            transform={angle > 90 || angle < -90 ? "rotate(180)" : ""}
            className="font-mono font-semibold opacity-70 pointer-events-none"
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  const drawIsland = () => {
    if (design.island.mode === 'none') return null;
    
    // Just place it somewhere in the middle
    // fromLeftIn and fromBackIn
    const ox = 100;
    const oy = 100;
    
    const x = ox + (design.island.fromLeftIn * SCALE);
    const y = oy + (design.island.fromBackIn * SCALE);
    const w = design.island.widthIn * SCALE;
    const h = design.island.lengthIn * SCALE;
    
    return (
      <g transform={`translate(${x + w/2}, ${y + h/2})`}>
        <polygon 
          points={`${-w/2},${h/2} ${w/2},${h/2} ${w/2 + 6},${h/2 + 6} ${-w/2 + 6},${h/2 + 6}`}
          fill="hsl(var(--muted-foreground) / 0.2)"
        />
        <rect
          x={-w/2}
          y={-h/2}
          width={w}
          height={h}
          fill="hsl(var(--card))"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeDasharray={design.island.mode === 'new' ? '4 4' : 'none'}
        />
        <text 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fontSize="10"
          fill="currentColor"
          className="font-mono font-semibold opacity-70 pointer-events-none"
        >
          ISLAND
        </text>
      </g>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      
      {/* Legend */}
      <div className="absolute top-4 left-4 bg-card/90 backdrop-blur border p-3 rounded-lg shadow-sm text-xs font-mono space-y-2 pointer-events-none z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-primary bg-card"></div>
          <span>Cabinet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-purple-500 bg-purple-500/20"></div>
          <span>Fixture</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-blue-400 bg-blue-400/20"></div>
          <span>Window</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-orange-500 bg-orange-500/20"></div>
          <span>Opening</span>
        </div>
      </div>

      <svg 
        width="100%" 
        height="100%" 
        viewBox={`0 0 ${maxWidth} ${maxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="max-w-full max-h-full drop-shadow-md"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="1" strokeOpacity="0.5"/>
          </pattern>
        </defs>

        {/* The walls */}
        <path 
          d={generateWallsPath()} 
          fill="none" 
          stroke="hsl(var(--foreground))" 
          strokeWidth={8}
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        {/* The walls click targets and highlights */}
        {getWallsForLayout(design.layout).map(drawWallSegment)}

        {/* Base user inputs (Windows, Openings) */}
        {design.windows.map(w => drawElementOnWall(w.wall, w.offsetIn, w.widthIn, 'window', 'WIN'))}
        {design.openings.map(o => drawElementOnWall(o.wall, o.offsetIn, o.widthIn, 'opening', 'OPEN'))}

        {/* If we have a result, show generated modules. Otherwise show rough fixture placement */}
        {result ? (
          <>
            {result.modules.map((m, i) => drawElementOnWall(m.wall, m.offsetIn, m.widthIn, 'cabinet', m.label || 'CAB'))}
          </>
        ) : (
          <>
            {design.fixtures.map(f => drawElementOnWall(f.wall, f.offsetIn, f.widthIn, 'fixture', f.kind.toUpperCase()))}
          </>
        )}

        {drawIsland()}

      </svg>
      
      {/* Inline editor for selected wall */}
      {selectedWall && onChange && (
        <Card className="absolute z-20 shadow-xl p-4 w-72 bg-card/95 backdrop-blur border-primary animate-in fade-in zoom-in-95"
              style={{
                top: Math.min(Math.max((getWallSegment(selectedWall)?.y1 || 0) + 20, 20), maxHeight - 200),
                left: Math.min(Math.max((getWallSegment(selectedWall)?.x1 || 0) + 20, 20), maxWidth - 200)
              }}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm">Wall {selectedWall} Settings</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedWall(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Length (in)</Label>
              <Input 
                type="number" 
                className="h-8"
                value={design.walls[selectedWall] || 0} 
                onChange={(e) => onChange({ ...design, walls: { ...design.walls, [selectedWall]: Number(e.target.value) } })} 
              />
            </div>
            
            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Windows</Label>
                <Button variant="outline" size="sm" className="h-6 text-xs px-2 py-0" onClick={() => {
                  onChange({
                    ...design,
                    windows: [...design.windows, { wall: selectedWall, offsetIn: 48, widthIn: 36, heightIn: 48, sillHeightIn: 36 }]
                  });
                }}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {design.windows.map((win, i) => win.wall === selectedWall && (
                  <div key={i} className="grid grid-cols-2 gap-2 bg-muted/40 p-2 rounded text-xs relative">
                    <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5" onClick={() => {
                      onChange({ ...design, windows: design.windows.filter((_, idx) => idx !== i) });
                    }}>
                      <X className="w-3 h-3 text-destructive" />
                    </Button>
                    <div>
                      <span className="opacity-70">Offset</span>
                      <Input type="number" className="h-6 mt-1 text-xs" value={win.offsetIn} 
                             onChange={(e) => {
                               const newWin = [...design.windows];
                               newWin[i].offsetIn = Number(e.target.value);
                               onChange({...design, windows: newWin});
                             }}/>
                    </div>
                    <div>
                      <span className="opacity-70">Width</span>
                      <Input type="number" className="h-6 mt-1 text-xs" value={win.widthIn}
                             onChange={(e) => {
                               const newWin = [...design.windows];
                               newWin[i].widthIn = Number(e.target.value);
                               onChange({...design, windows: newWin});
                             }}/>
                    </div>
                    <div>
                      <span className="opacity-70">Sill</span>
                      <Input type="number" className="h-6 mt-1 text-xs" value={win.sillHeightIn}
                             onChange={(e) => {
                               const newWin = [...design.windows];
                               newWin[i].sillHeightIn = Number(e.target.value);
                               onChange({...design, windows: newWin});
                             }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
