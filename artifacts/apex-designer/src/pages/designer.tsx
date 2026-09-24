import { useState } from "react";
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
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden print-hide">
      {/* Left Sidebar - Controls */}
      <div className="w-full md:w-[400px] flex-shrink-0 border-r bg-card flex flex-col h-[calc(100vh-65px)] overflow-y-auto z-10 shadow-lg shadow-black/5 print-hide">
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

      {/* Right Canvas - Visualizer */}
      <div className="flex-1 bg-blueprint flex flex-col relative overflow-hidden h-[calc(100vh-65px)] print-w-full print:h-auto">
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
