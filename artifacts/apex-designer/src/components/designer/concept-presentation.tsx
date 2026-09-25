import type { DesignImage, DesignInput, DesignResult, Product } from "@workspace/api-client-react";
import { DesignerCanvas } from "@/components/designer/canvas";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowUpRight, Camera, Ruler, RotateCw } from "lucide-react";

interface Props {
  design: DesignInput;
  result: DesignResult;
  image: DesignImage | null;
  imageStatus: "loading" | "ready" | "error";
  imageError: string | null;
  onRetry: () => void;
  onImageError: () => void;
}

function productDescriptor(product: Product) {
  return [product.collection, product.finish, product.material].filter(Boolean).join(" · ");
}

export function ConceptPresentation({
  design, result, image, imageStatus, imageError, onRetry, onImageError,
}: Props) {
  const selectedIds = new Set(result.modules.map((module) => module.productId).filter((id): id is number => id != null));
  const selectedProducts = result.products.filter((product) => selectedIds.has(product.id));
  const cabinet = selectedProducts.find((product) => product.category.includes("cabinet"));
  const counter = result.products.find((product) => product.category === "countertop");

  return (
    <div className="w-full min-w-0 bg-[#f3f0e9] dark:bg-background">
      <div className="px-5 pt-7 pb-5 md:px-8 md:pt-8 md:pb-6 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Apex / Design presentation</span>
          <span className="h-px w-7 bg-primary/40" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Concept study 01</span>
        </div>
        <h1 className="text-[clamp(1.65rem,3vw,2.6rem)] leading-[1.1] font-medium tracking-tight text-foreground">See the space. Check the plan.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">An illustrative interior concept beside your measured cabinet layout. The image expresses a direction; the plan carries the dimensions.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,1fr)] gap-0 xl:gap-4 xl:p-5">
        <section className="min-w-0 bg-card xl:border border-border/70" aria-labelledby="concept-title">
          <div className="flex items-center justify-between px-5 py-4 md:px-6 border-b border-border/70">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">01 /</span>
              <div>
                <h2 id="concept-title" className="text-base font-medium tracking-tight">Interior concept</h2>
                <p className="text-[11px] text-muted-foreground">Illustrative image · not a construction rendering</p>
              </div>
            </div>
            <Camera className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>

          <div className="relative aspect-[4/3] min-h-[280px] bg-[#e5dfd4] dark:bg-muted">
            {imageStatus === "loading" && (
              <div className="concept-skeleton absolute inset-0 flex items-end p-5 md:p-8" role="status" data-testid="status-render-loading">
                <div className="relative z-10 max-w-[350px] border border-white/60 bg-[#f8f5ee]/90 dark:bg-card/90 p-5 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center gap-2 mb-3 text-primary">
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Image in progress</span>
                  </div>
                  <p className="text-lg leading-snug font-medium">Composing your kitchen view</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cabinetry, countertop and room details are being brought together. This may take about a minute. Your measured plan is ready to explore.</p>
                </div>
              </div>
            )}
            {imageStatus === "error" && (
              <div className="absolute inset-0 flex items-center justify-center p-5 bg-[#e9e3d8] dark:bg-muted" role="alert" data-testid="status-render-error">
                <div className="max-w-sm w-full bg-card border border-border p-6 shadow-sm">
                  <AlertCircle className="size-6 text-destructive mb-4" aria-hidden="true" />
                  <h3 className="text-xl font-medium tracking-tight">The image could not be made</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{imageError || "The image service did not return a view. Your measured plan is still available."}</p>
                  <Button onClick={onRetry} data-testid="button-retry-render" className="mt-5 gap-2">
                    <RotateCw className="size-4" /> Retry image
                  </Button>
                </div>
              </div>
            )}
            {imageStatus === "ready" && image && (
              <img
                data-testid="img-interior-concept"
                src={image.imageDataUrl}
                alt={`Illustrative interior concept for the ${design.layout}-shaped kitchen with ${design.style} styling and ${design.countertop} countertop direction`}
                onError={onImageError}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
          <div className="p-5 md:p-6 border-t border-border/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Material direction / catalog references</p>
                <h3 className="mt-2 text-lg font-medium tracking-tight">Cabinetry &amp; countertop</h3>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([["Cabinetry", cabinet, design.style], ["Countertop", counter, design.countertop]] as const).map(([label, product, direction]) => (
                <div key={label} className="border-l-2 border-primary/60 pl-3" data-testid={`text-material-${label.toLowerCase()}`}>
                  <p className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">{label} · {product ? product.status === "demo" ? "Demo catalog" : `${product.status} catalog record` : "Design selection"}</p>
                  <p className="mt-1 text-sm font-medium">{product?.name || direction}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{product ? `${productDescriptor(product) || "Finish and material not specified"} · ${product.sku}` : "No matching catalog product supplied"}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Visual interpretation only. Catalog references and finishes may differ from the image; availability, pricing and specifications require confirmation.</p>
            {image?.disclaimer && <p data-testid="text-image-disclaimer" className="mt-2 text-xs leading-relaxed text-muted-foreground">{image.disclaimer}</p>}
          </div>
        </section>

        <section className="min-w-0 bg-card border-t xl:border border-border/70" aria-labelledby="plan-title">
          <div className="flex items-center justify-between px-5 py-4 md:px-6 border-b border-border/70">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">02 /</span>
              <div>
                <h2 id="plan-title" className="text-base font-medium tracking-tight">Measured floor plan</h2>
                <p className="text-[11px] text-muted-foreground">Wall lengths, fixtures &amp; generated modules</p>
              </div>
            </div>
            <Ruler className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="h-[390px] sm:h-[480px] xl:h-[min(48vw,610px)] min-h-[360px] relative bg-blueprint" data-testid="canvas-measured-plan">
            <DesignerCanvas design={design} result={result} />
          </div>
          <p className="px-5 py-4 md:px-6 text-xs leading-relaxed text-muted-foreground border-t border-border/70">Measurements shown are based on your input. Verify all dimensions on site before ordering or fabrication.</p>
        </section>
      </div>
    </div>
  );
}