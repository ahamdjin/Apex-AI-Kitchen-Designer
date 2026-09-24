import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, X, Wand2 } from "lucide-react";
import type { DesignInput, WindowInput, OpeningInput, FixtureInput } from "@workspace/api-client-react";
import { getWallsForLayout } from "@/lib/design-state";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  design: DesignInput;
  onChange: (design: DesignInput) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generationError: string | null;
}

export function DesignerSidebar({ design, onChange, onGenerate, isGenerating, generationError }: Props) {
  
  const updateDesign = (updates: Partial<DesignInput>) => {
    onChange({ ...design, ...updates });
  };

  const updateWall = (wall: string, lengthIn: number) => {
    updateDesign({ walls: { ...design.walls, [wall]: lengthIn } });
  };

  const suggestIslandDimensions = () => {
    const bLen = design.walls.B || 100;
    const roomD = design.roomDepthIn || 120;
    const width = 36;
    const length = Math.max(48, Math.min(bLen - 84, 84));
    const fromLeft = 42;
    const fromBack = 42;
    
    updateDesign({ 
      island: { mode: 'new', widthIn: width, lengthIn: length, fromLeftIn: fromLeft, fromBackIn: fromBack } 
    });
  };

  const addWindow = () => {
    const walls = getWallsForLayout(design.layout);
    updateDesign({
      windows: [
        ...design.windows, 
        { wall: walls[0] || 'A', offsetIn: 48, widthIn: 36, heightIn: 48, sillHeightIn: 36 }
      ]
    });
  };

  const removeWindow = (index: number) => {
    updateDesign({ windows: design.windows.filter((_, i) => i !== index) });
  };

  const updateWindow = (index: number, updates: Partial<WindowInput>) => {
    const newWindows = [...design.windows];
    newWindows[index] = { ...newWindows[index], ...updates };
    updateDesign({ windows: newWindows });
  };

  const addOpening = () => {
    const walls = getWallsForLayout(design.layout);
    updateDesign({
      openings: [
        ...design.openings, 
        { wall: walls[0] || 'A', offsetIn: 48, widthIn: 36 }
      ]
    });
  };

  const removeOpening = (index: number) => {
    updateDesign({ openings: design.openings.filter((_, i) => i !== index) });
  };

  const updateOpening = (index: number, updates: Partial<OpeningInput>) => {
    const newOpenings = [...design.openings];
    newOpenings[index] = { ...newOpenings[index], ...updates };
    updateDesign({ openings: newOpenings });
  };

  const addFixture = () => {
    const walls = getWallsForLayout(design.layout);
    updateDesign({
      fixtures: [
        ...design.fixtures, 
        { kind: 'sink', wall: walls[0] || 'A', offsetIn: 48, widthIn: 36 }
      ]
    });
  };

  const removeFixture = (index: number) => {
    updateDesign({ fixtures: design.fixtures.filter((_, i) => i !== index) });
  };

  const updateFixture = (index: number, updates: Partial<FixtureInput>) => {
    const newFixtures = [...design.fixtures];
    newFixtures[index] = { ...newFixtures[index], ...updates };
    updateDesign({ fixtures: newFixtures });
  };

  const walls = getWallsForLayout(design.layout);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/20">
        <h2 className="text-lg font-semibold tracking-tight">Kitchen Parameters</h2>
        <p className="text-sm text-muted-foreground">Define geometry to generate layout.</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <Accordion type="multiple" defaultValue={["layout", "openings"]} className="w-full">
            
            <AccordionItem value="layout">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">Layout & Geometry</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Layout Type</Label>
                  <Select 
                    value={design.layout} 
                    onValueChange={(v: any) => updateDesign({ layout: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="l">L-Shape</SelectItem>
                      <SelectItem value="u">U-Shape</SelectItem>
                      <SelectItem value="galley">Galley</SelectItem>
                      <SelectItem value="single">Single Wall</SelectItem>
                      <SelectItem value="open">Open / Island Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {walls.map(wall => (
                    <div key={wall} className="space-y-2">
                      <Label>{design.layout === 'open' ? 'Room Width (in)' : `Wall ${wall} Length (in)`}</Label>
                      <Input 
                        type="number" 
                        value={design.walls[wall] || 0} 
                        onChange={(e) => updateWall(wall, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label>Room Depth (in)</Label>
                    <Input 
                      type="number" 
                      value={design.roomDepthIn} 
                      onChange={(e) => updateDesign({ roomDepthIn: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ceiling Height (in)</Label>
                    <Input 
                      type="number" 
                      value={design.ceilingIn} 
                      onChange={(e) => updateDesign({ ceilingIn: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="openings">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">Doors & Windows</AccordionTrigger>
              <AccordionContent className="space-y-6 pt-2">
                <p className="text-xs text-muted-foreground italic mb-2">Note: Offsets are measured from the starting corner of the wall (indicated by arrow on canvas).</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Windows</Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addWindow}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {design.windows.length === 0 && <p className="text-xs text-muted-foreground italic">No windows added.</p>}
                  {design.windows.map((win, i) => (
                    <div key={i} className="bg-muted/40 p-3 rounded-md border space-y-3 relative group">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                        onClick={() => removeWindow(i)}
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2 pr-4">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Wall</Label>
                          <Select value={win.wall} onValueChange={(v) => updateWindow(i, { wall: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {walls.map(w => <SelectItem key={w} value={w}>Wall {w}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Offset (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={win.offsetIn} onChange={(e) => updateWindow(i, { offsetIn: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Width (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={win.widthIn} onChange={(e) => updateWindow(i, { widthIn: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Height (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={win.heightIn} onChange={(e) => updateWindow(i, { heightIn: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[10px]">Sill Height (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={win.sillHeightIn} onChange={(e) => updateWindow(i, { sillHeightIn: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doors / Openings</Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addOpening}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {design.openings.length === 0 && <p className="text-xs text-muted-foreground italic">No openings added.</p>}
                  {design.openings.map((op, i) => (
                    <div key={i} className="bg-muted/40 p-3 rounded-md border space-y-3 relative group">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                        onClick={() => removeOpening(i)}
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2 pr-4">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[10px]">Wall</Label>
                          <Select value={op.wall} onValueChange={(v) => updateOpening(i, { wall: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {walls.map(w => <SelectItem key={w} value={w}>Wall {w}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Offset (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={op.offsetIn} onChange={(e) => updateOpening(i, { offsetIn: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Width (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={op.widthIn} onChange={(e) => updateOpening(i, { widthIn: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="fixtures">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">Fixtures</AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Place sink, range, fridge, etc.</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addFixture}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {design.fixtures.map((fix, i) => (
                    <div key={i} className="bg-muted/40 p-3 rounded-md border space-y-3 relative group">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100" 
                        onClick={() => removeFixture(i)}
                      >
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2 pr-4">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[10px]">Type</Label>
                          <Select value={fix.kind} onValueChange={(v: any) => updateFixture(i, { kind: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sink">Sink</SelectItem>
                              <SelectItem value="range">Range</SelectItem>
                              <SelectItem value="fridge">Refrigerator</SelectItem>
                              <SelectItem value="dishwasher">Dishwasher</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-[10px]">Wall</Label>
                          <Select value={fix.wall} onValueChange={(v) => updateFixture(i, { wall: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {walls.map(w => <SelectItem key={w} value={w}>Wall {w}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Offset (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={fix.offsetIn} onChange={(e) => updateFixture(i, { offsetIn: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Width (in)</Label>
                          <Input type="number" className="h-7 text-xs" value={fix.widthIn} onChange={(e) => updateFixture(i, { widthIn: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  ))}

              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="island">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">Island</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2 flex items-end gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Island Mode</Label>
                    <Select 
                      value={design.island.mode} 
                      onValueChange={(v: any) => updateDesign({ island: { ...design.island, mode: v } })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Island</SelectItem>
                        <SelectItem value="existing">Existing (Keep)</SelectItem>
                        <SelectItem value="new">New (Suggest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {design.island.mode === 'new' && (
                    <Button variant="secondary" onClick={suggestIslandDimensions}>
                      Suggest Size
                    </Button>
                  )}
                </div>

                {design.island.mode !== 'none' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Width (in)</Label>
                      <Input type="number" value={design.island.widthIn} onChange={(e) => updateDesign({ island: { ...design.island, widthIn: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Length (in)</Label>
                      <Input type="number" value={design.island.lengthIn} onChange={(e) => updateDesign({ island: { ...design.island, lengthIn: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <Label>From Left Wall (in)</Label>
                      <Input type="number" value={design.island.fromLeftIn} onChange={(e) => updateDesign({ island: { ...design.island, fromLeftIn: Number(e.target.value) } })} />
                    </div>
                    <div className="space-y-2">
                      <Label>From Back Wall (in)</Label>
                      <Input type="number" value={design.island.fromBackIn} onChange={(e) => updateDesign({ island: { ...design.island, fromBackIn: Number(e.target.value) } })} />
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="style">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">Aesthetic</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Cabinet Style / Color</Label>
                  <Input value={design.style} onChange={(e) => updateDesign({ style: e.target.value })} placeholder="e.g. Modern White Shaker" />
                </div>
                <div className="space-y-2">
                  <Label>Countertop Material</Label>
                  <Input value={design.countertop} onChange={(e) => updateDesign({ countertop: e.target.value })} placeholder="e.g. Calacatta Quartz" />
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-card">
        {generationError && (
          <div role="alert" className="mb-3 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {generationError}
          </div>
        )}
        <Button 
          className="w-full font-bold shadow-md hover:shadow-lg transition-shadow" 
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            "Generating..."
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Design
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
