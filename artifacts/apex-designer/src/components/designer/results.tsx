import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/utils";
import type { DesignResult } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Download, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  result: DesignResult;
  onEdit: () => void;
}

export function DesignerResults({ result, onEdit }: Props) {
  
  return (
    <div className="flex flex-col h-full bg-card">
      <div className="p-4 border-b bg-muted/20 flex items-center justify-between sticky top-0 z-10">
        <div>
          <Button variant="ghost" size="sm" onClick={onEdit} className="-ml-2 mb-2 text-muted-foreground h-7">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Edit Parameters
          </Button>
          <h2 className="text-xl font-bold tracking-tight">{result.title}</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          
          {/* Status & Summary */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {result.verified ? (
                <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Catalog records reviewed</Badge>
              ) : (
                <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" /> Review Required</Badge>
              )}
            </div>
            
            <p className="text-sm leading-relaxed text-muted-foreground">
              {result.summary}
            </p>

            {result.approximateTotal !== null && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium text-primary">Approximate Material Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(result.approximateTotal)}</span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Design Warnings</h3>
              <ul className="space-y-2">
                {result.warnings.map((w, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-900/50">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Parts List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Generated Modules & Products</h3>
            <div className="border rounded-md overflow-hidden text-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Loc</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dim</TableHead>
                    <TableHead>SKU</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.modules.map((mod, i) => {
                    const product = result.products.find(p => p.id === mod.productId);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{mod.wall} @ {mod.offsetIn}"</TableCell>
                        <TableCell>{mod.label}</TableCell>
                        <TableCell className="text-muted-foreground">{mod.widthIn}"W</TableCell>
                        <TableCell className="font-mono text-xs">
                          {product ? product.sku : <span className="text-muted-foreground italic">Custom/Filler</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-muted p-4 rounded-lg flex gap-3 text-xs text-muted-foreground">
            <Info className="w-5 h-5 shrink-0 text-foreground" />
            <p>
              <strong>Not for Fabrication.</strong> This is a conceptual layout generated for demonstration and quoting purposes only. Final field measurements and professional review are required before ordering. Sample products used may not reflect live inventory.
            </p>
          </div>

        </div>
      </ScrollArea>
      
      <div className="p-4 border-t bg-card print-hide">
        <Button className="w-full" variant="outline" onClick={() => window.print()}>
          <Download className="w-4 h-4 mr-2" />
          Export Quote (PDF)
        </Button>
      </div>
    </div>
  );
}
