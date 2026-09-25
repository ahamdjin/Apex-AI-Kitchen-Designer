import { useRef, useState } from "react";
import { useDesignState } from "@/lib/design-state";
import { DesignerSidebar } from "@/components/designer/sidebar";
import { DesignerCanvas } from "@/components/designer/canvas";
import { Canvas3D } from "@/components/designer/canvas-3d";
import { DesignerResults } from "@/components/designer/results";
import { useGenerateDesign } from "@workspace/api-client-react";
import type { DesignResult } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Designer() {
  const [design, setDesign] = useDesignState();
  const [result, setResult] = useState<DesignResult | null>(null);
  const [viewTab, setViewTab] = useState("2d");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const mobileResultRef = useRef<HTMLDivElement>(null);
  
  const generateDesign = useGenerateDesign();

  const handleGenerate = () => {
    setGenerationError(null);
    generateDesign.mutate(
      { data: design },
      {
        onSuccess: (data) => {
          setResult(data);
          setViewTab("3d");
          toast.success("Design generated successfully!");
          if (window.innerWidth < 768) {
            requestAnimationFrame(() => requestAnimationFrame(() =>
              mobileResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            ));
          }
        },
        onError: (err: any) => {
          const message = err?.message || "Could not generate a design. Check the measurements and try again.";
          setGenerationError(message);
          toast.error(message);
          console.error(err);
        }
      }
    );
  };

  return (
    <>
    <div className="flex-1 flex flex-col md:flex-row md:h-[calc(100vh-65px)] md:overflow-hidden print-hide">
      {/* Left Sidebar - Controls */}
      <div className={`w-full md:w-[400px] flex-shrink-0 border-r bg-card flex flex-col md:h-full md:overflow-y-auto md:z-10 shadow-lg shadow-black/5 print-hide ${result ? "order-2 h-auto" : "order-1 h-[calc(100vh-65px)]"}`}>
        {!result ? (
          <DesignerSidebar 
            design={design} 
            onChange={setDesign} 
            onGenerate={handleGenerate}
            isGenerating={generateDesign.isPending}
            generationError={generationError}
          />
        ) : (
          <DesignerResults 
            result={result} 
            onEdit={() => setResult(null)} 
          />
        )}
      </div>

      {result && (
        <div ref={mobileResultRef} className="order-1 md:hidden w-full scroll-mt-16 bg-background" aria-label="Generated kitchen visuals">
          <section className="border-b">
            <div className="px-4 pt-5 pb-2">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Generated concept · 01</p>
              <h2 className="text-lg font-semibold">3D kitchen view</h2>
            </div>
            <div className="relative h-[390px] bg-blueprint overflow-hidden">
              <Canvas3D design={design} result={result} />
            </div>
          </section>
          <section className="border-b">
            <div className="px-4 pt-5 pb-2">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Measured layout · 02</p>
              <h2 className="text-lg font-semibold">Floor plan</h2>
            </div>
            <div className="relative h-[390px] bg-blueprint overflow-hidden">
              <DesignerCanvas design={design} result={result} />
            </div>
          </section>
          <p className="px-4 py-3 text-xs text-muted-foreground">
            These are measurement-based schematic previews, not a photo rendering or fabrication plan.
          </p>
        </div>
      )}

      {/* Right Canvas - Visualizer */}
      <div className={`order-2 md:order-2 flex-1 bg-blueprint flex-col relative overflow-hidden h-[520px] md:h-full print-w-full print:h-auto ${result ? "hidden md:flex" : "flex"}`}>
        <div className="absolute top-4 right-4 z-10 print-hide">
          <Tabs value={viewTab} onValueChange={setViewTab}>
            <TabsList className="bg-card/90 backdrop-blur border shadow-sm">
              <TabsTrigger value="2d" className="text-xs">2D Plan</TabsTrigger>
              <TabsTrigger value="3d" className="text-xs">3D Isometric</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 w-full h-full relative">
          <div className={`absolute inset-0 transition-opacity duration-300 ${viewTab === '2d' || typeof window !== 'undefined' && window.matchMedia('print').matches ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none print:hidden'}`}>
            <DesignerCanvas design={design} result={result} onChange={setDesign} />
          </div>
          <div className={`absolute inset-0 bg-stone-900/5 transition-opacity duration-300 ${viewTab === '3d' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none print:hidden'}`}>
            <Canvas3D design={design} result={result} />
          </div>
        </div>
      </div>
    </div>
    {result && <div className="print-report"><DesignerResults result={result} onEdit={() => {}} /></div>}
    </>
  );
}
