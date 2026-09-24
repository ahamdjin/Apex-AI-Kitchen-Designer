import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Product, type ProductInput, ProductInputCategory, ProductInputStatus, useCreateProduct, useUpdateProduct, getListProductsQueryKey, getGetCatalogSummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";

// Transform empty strings to null to fix 0 coercion, and parse numbers correctly
const numericField = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .refine((v) => v === "" || v == null || Number.isFinite(Number(v)), "Enter a valid number");

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  category: z.nativeEnum(ProductInputCategory),
  collection: z.string().optional(),
  finish: z.string().optional(),
  material: z.string().optional(),
  widthIn: numericField,
  heightIn: numericField,
  depthIn: numericField,
  lengthIn: numericField,
  price: numericField,
  cost: numericField,
  stockQty: numericField.refine((v) => v === "" || v == null || Number.isInteger(Number(v)), "Enter a whole number"),
  unit: z.string().optional(),
  status: z.nativeEnum(ProductInputStatus),
  notes: z.string().optional(),
  productUrl: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

export function ProductForm({ open, onOpenChange, product }: Props) {
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: "",
      name: "",
      category: "base_cabinet",
      status: "demo",
      collection: "",
      finish: "",
      material: "",
      widthIn: "",
      heightIn: "",
      depthIn: "",
      lengthIn: "",
      price: "",
      cost: "",
      stockQty: "",
      unit: "ea",
      notes: "",
      productUrl: "",
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        sku: product.sku,
        name: product.name,
        category: product.category,
        status: product.status,
        collection: product.collection || "",
        finish: product.finish || "",
        material: product.material || "",
        widthIn: product.widthIn ?? "",
        heightIn: product.heightIn ?? "",
        depthIn: product.depthIn ?? "",
        lengthIn: product.lengthIn ?? "",
        price: product.price ?? "",
        cost: product.cost ?? "",
        stockQty: product.stockQty ?? "",
        unit: product.unit || "ea",
        notes: product.notes || "",
        productUrl: product.productUrl || "",
      });
    } else {
      form.reset({
        sku: "",
        name: "",
        category: "base_cabinet",
        status: "demo",
        collection: "",
        finish: "",
        material: "",
        widthIn: "",
        heightIn: "",
        depthIn: "",
        lengthIn: "",
        price: "",
        cost: "",
        stockQty: "",
        unit: "ea",
        notes: "",
        productUrl: "",
      });
    }
  }, [product, form, open]);

  const onSubmit = (values: z.infer<typeof schema>) => {
    const numberOrNull = (value: string | number | null | undefined) => value === "" || value == null ? null : Number(value);
    const data: ProductInput = {
      ...values,
      widthIn: numberOrNull(values.widthIn),
      heightIn: numberOrNull(values.heightIn),
      depthIn: numberOrNull(values.depthIn),
      lengthIn: numberOrNull(values.lengthIn),
      price: numberOrNull(values.price),
      cost: numberOrNull(values.cost),
      stockQty: numberOrNull(values.stockQty),
    };

    if (product) {
      updateProduct.mutate({ id: product.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
          toast.success("Product updated");
          onOpenChange(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || err.message || "Failed to update product")
      });
    } else {
      createProduct.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
          toast.success("Product created");
          onOpenChange(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.message || err.message || "Failed to create product")
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product details below." : "Enter details for the new product."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            
            {/* Identity & Status */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Identity</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem><FormLabel>SKU</FormLabel><FormControl><Input {...field} placeholder="B36" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} placeholder="Base Cabinet 36 inch" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem><FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="base_cabinet">Base Cabinet</SelectItem>
                          <SelectItem value="wall_cabinet">Wall Cabinet</SelectItem>
                          <SelectItem value="tall_cabinet">Tall Cabinet</SelectItem>
                          <SelectItem value="countertop">Countertop</SelectItem>
                          <SelectItem value="island">Island</SelectItem>
                          <SelectItem value="accessory">Accessory</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="verified">Verified (Active)</SelectItem>
                          <SelectItem value="demo">Demo (Sample)</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                )} />
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-md flex gap-3 text-xs text-amber-800 dark:text-amber-400">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>Verification Required:</strong> Products default to <em>demo</em> status. Changing to <em>verified</em> confirms you have reviewed dimensions, material, and stock levels for live quoting.
                </p>
              </div>
            </div>

            {/* Attributes & Dimensions */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Details & Dimensions</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="collection" render={({ field }) => (
                    <FormItem><FormLabel>Collection</FormLabel><FormControl><Input {...field} placeholder="e.g. Shaker Pro" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="finish" render={({ field }) => (
                    <FormItem><FormLabel>Finish</FormLabel><FormControl><Input {...field} placeholder="e.g. White" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="material" render={({ field }) => (
                    <FormItem><FormLabel>Material</FormLabel><FormControl><Input {...field} placeholder="e.g. Maple" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <FormField control={form.control} name="widthIn" render={({ field }) => (
                    <FormItem><FormLabel>Width (in)</FormLabel><FormControl><Input type="number" step="0.125" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="heightIn" render={({ field }) => (
                    <FormItem><FormLabel>Height (in)</FormLabel><FormControl><Input type="number" step="0.125" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="depthIn" render={({ field }) => (
                    <FormItem><FormLabel>Depth (in)</FormLabel><FormControl><Input type="number" step="0.125" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lengthIn" render={({ field }) => (
                    <FormItem><FormLabel>Length (in)</FormLabel><FormControl><Input type="number" step="0.125" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Pricing & Stock */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Pricing & Stock</h3>
              <div className="grid grid-cols-4 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem><FormLabel>Price ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cost" render={({ field }) => (
                    <FormItem><FormLabel>Cost ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stockQty" render={({ field }) => (
                    <FormItem><FormLabel>Stock Qty</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} placeholder="ea, sqft, etc." /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Links & Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Links & Notes</h3>
              <FormField control={form.control} name="productUrl" render={({ field }) => (
                  <FormItem><FormLabel>Product URL</FormLabel><FormControl><Input {...field} placeholder="https://..." value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Internal notes..." className="h-20 text-xs" value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {product ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
