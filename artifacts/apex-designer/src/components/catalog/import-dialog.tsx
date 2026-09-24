import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useImportProducts, getListProductsQueryKey, getGetCatalogSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: Props) {
  const [csvContent, setCsvContent] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const importProducts = useImportProducts();
  const queryClient = useQueryClient();

  const handleImport = () => {
    if (!csvContent.trim()) {
      toast.error("Please paste CSV content or select a file");
      return;
    }
    setImportErrors([]);

    importProducts.mutate(
      { data: { csv: csvContent } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
          
          if (res.errors && res.errors.length > 0) {
            setImportErrors(res.errors);
            toast.warning(`Imported with errors. Created: ${res.created}, Updated: ${res.updated}.`);
          } else {
            toast.success(`Successfully imported! Created: ${res.created}, Updated: ${res.updated}`);
            onOpenChange(false);
            setCsvContent("");
          }
        },
        onError: (err: any) => {
          const message = err?.response?.data?.message || err.message || "Failed to import products";
          toast.error(message);
          setImportErrors([message]);
        }
      }
    );
  };

  const downloadTemplate = () => {
    const headers = "sku,name,category,collection,finish,material,widthIn,heightIn,depthIn,lengthIn,price,cost,stockQty,unit,status,notes,productUrl\n";
    const sample = "DEMO-B36,Example 36 inch base cabinet,base_cabinet,Example,White,Wood,36,34.5,24,,,,,each,demo,Illustrative only,\n";
    
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apex_catalog_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Catalog</DialogTitle>
          <DialogDescription>
            Upload or paste your Excel-exported CSV data below to bulk import products.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          
          <div className="flex justify-between items-center bg-muted/50 p-3 rounded-md border border-dashed">
            <div className="text-sm text-muted-foreground">
              Need the exact columns? Download the template.
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Required format</AlertTitle>
            <AlertDescription className="text-xs">
              Must include columns: <code className="bg-muted px-1 py-0.5 rounded">sku, name, category, status</code>. Note: new items should use <code>demo</code> status for safety.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">1. Select CSV File</label>
            <Input 
              type="file" 
              accept=".csv" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setCsvContent(ev.target?.result as string);
                  reader.readAsText(file);
                }
              }} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">2. Or Paste Content</label>
            <Textarea 
              placeholder="sku,name,category,status...&#10;B12,Base 12,base_cabinet,demo..."
              className="min-h-[150px] font-mono text-xs whitespace-pre"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
          </div>

          {importErrors.length > 0 && (
            <div className="bg-destructive/10 border-destructive/20 border rounded-md p-3">
              <h4 className="text-sm font-semibold text-destructive mb-2">Import Errors</h4>
              <ul className="text-xs text-destructive/80 space-y-1 max-h-32 overflow-y-auto pl-4 list-disc">
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importProducts.isPending || !csvContent.trim()}>
              <Upload className="w-4 h-4 mr-2" />
              {importProducts.isPending ? "Importing..." : "Run Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
