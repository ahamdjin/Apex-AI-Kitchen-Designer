import { useRef, useState } from "react";
import { normalizeDesignInput, useDesignState } from "@/lib/design-state";
import { DesignerSidebar } from "@/components/designer/sidebar";
import { DesignerCanvas } from "@/components/designer/canvas";
import { DesignerResults } from "@/components/designer/results";
import { ConceptPresentation } from "@/components/designer/concept-presentation";
import { useGenerateDesign, useRenderDesignImage } from "@workspace/api-client-react";
import type { DesignImage, DesignInput, DesignResult } from "@workspace/api-client-react";
import { toast } from "sonner";

type ImageStatus = "loading" | "ready" | "error";

export default function Designer() {
  const [design, setDesign] = useDesignState();
  const [result, setResult] = useState<DesignResult | null>(null);
  const [generatedInput, setGeneratedInput] = useState<DesignInput | null>(null);
  const [image, setImage] = useState<DesignImage | null>(null);
  const [imageStatus, setImageStatus] = useState<ImageStatus>("loading");
  const [imageError, setImageError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const mobileResultRef = useRef<HTMLDivElement>(null);
  const generationEpoch = useRef(0);
  const generationLocked = useRef(false);
  const renderLocked = useRef(false);
  const generatedInputRef = useRef<DesignInput | null>(null);

  const generateDesign = useGenerateDesign();
  const renderDesignImage = useRenderDesignImage();

  const startRender = (input: DesignInput, epoch: number) => {
    if (renderLocked.current || epoch !== generationEpoch.current) return;
    renderLocked.current = true;
    setImage(null);
    setImageError(null);
    setImageStatus("loading");
    renderDesignImage.mutate(
      { data: input },
      {
        onSuccess: (data) => {
          if (epoch !== generationEpoch.current) return;
          renderLocked.current = false;
          if (!data.imageDataUrl) {
            setImageError("The image service returned an empty image. Please retry.");
            setImageStatus("error");
            return;
          }
          setImage(data);
          setImageStatus("ready");
        },
        onError: (error) => {
          if (epoch !== generationEpoch.current) return;
          renderLocked.current = false;
          setImageError(error instanceof Error ? error.message : "Image generation failed. Please try again.");
          setImageStatus("error");
        },
      },
    );
  };

  const handleGenerate = () => {
    if (generationLocked.current) return;
    generationLocked.current = true;
    const input = normalizeDesignInput(structuredClone(design));
    const epoch = ++generationEpoch.current;
    generatedInputRef.current = null;
    setGenerationError(null);
    setImage(null);
    setImageError(null);
    generateDesign.mutate(
      { data: input },
      {
        onSuccess: (data) => {
          if (epoch !== generationEpoch.current) return;
          generationLocked.current = false;
          generatedInputRef.current = input;
          setGeneratedInput(input);
          setResult(data);
          startRender(input, epoch);
          toast.success("Measured layout ready. Creating your interior concept.");
          if (window.innerWidth < 768) {
            requestAnimationFrame(() => requestAnimationFrame(() =>
              mobileResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            ));
          }
        },
        onError: (error) => {
          if (epoch !== generationEpoch.current) return;
          generationLocked.current = false;
          const message = error instanceof Error ? error.message : "Could not generate a design. Check the measurements and try again.";
          setGenerationError(message);
          toast.error(message);
        },
      },
    );
  };

  const handleEdit = () => {
    generationEpoch.current += 1;
    generationLocked.current = false;
    renderLocked.current = false;
    generatedInputRef.current = null;
    setResult(null);
    setGeneratedInput(null);
    setImage(null);
    setImageError(null);
    setImageStatus("loading");
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const handleRetry = () => {
    const input = generatedInputRef.current;
    if (!input || !result || renderLocked.current) return;
    startRender(input, generationEpoch.current);
  };

  const presentation = result && generatedInput && (
    <ConceptPresentation
      design={generatedInput}
      result={result}
      image={image}
      imageStatus={imageStatus}
      imageError={imageError}
      onRetry={handleRetry}
      onChangeConfiguration={handleEdit}
      onImageError={() => {
        setImage(null);
        setImageError("The returned image could not be displayed. Please retry.");
        setImageStatus("error");
      }}
    />
  );

  return (
    <>
      <div className="flex-1 flex flex-col md:flex-row md:h-[calc(100dvh-65px)] md:overflow-hidden print-hide">
        <div className={`w-full md:w-[400px] flex-shrink-0 border-r bg-card flex flex-col md:h-full md:overflow-y-auto md:z-10 ${result ? "order-2" : "order-1"}`}>
          {!result ? (
            <DesignerSidebar
              design={design}
              onChange={setDesign}
              onGenerate={handleGenerate}
              isGenerating={generateDesign.isPending}
              generationError={generationError}
            />
          ) : (
            <DesignerResults result={result} onEdit={handleEdit} />
          )}
        </div>

        {result ? (
          <div ref={mobileResultRef} className="order-1 md:order-2 flex-1 min-w-0 md:h-full md:overflow-y-auto scroll-mt-16" aria-label="Kitchen concept and measured plan">
            {presentation}
          </div>
        ) : (
          <div className="order-2 flex-1 min-w-0 relative bg-blueprint h-[62dvh] min-h-[430px] max-h-[720px] md:h-full md:max-h-none">
            <DesignerCanvas design={design} result={null} onChange={setDesign} />
          </div>
        )}
      </div>
      {result && <div className="print-report"><DesignerResults result={result} onEdit={() => {}} /></div>}
    </>
  );
}