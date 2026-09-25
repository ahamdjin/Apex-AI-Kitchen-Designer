import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  getListPublicProductsQueryKey,
  useCreatePublicProduct,
  type PublicProductInput,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const optionalNumber = z.union([z.string(), z.number()]).optional()
  .refine((value) => value === "" || value == null || (Number.isFinite(Number(value)) && Number(value) > 0), "Enter a positive number");

const schema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(100),
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.enum(["base_cabinet", "wall_cabinet", "tall_cabinet", "countertop", "island", "accessory"]),
  collection: z.string().max(120).optional(),
  finish: z.string().max(120).optional(),
  material: z.string().max(120).optional(),
  widthIn: optionalNumber,
  heightIn: optionalNumber,
  depthIn: optionalNumber,
  lengthIn: optionalNumber,
  price: optionalNumber,
  unit: z.string().max(30).optional(),
  productUrl: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const numberFields = ["widthIn", "heightIn", "depthIn", "lengthIn", "price"] as const;

export function PublicProductForm({ open, onOpenChange }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: "",
      name: "",
      category: "base_cabinet",
      collection: "",
      finish: "",
      material: "",
      widthIn: "",
      heightIn: "",
      depthIn: "",
      lengthIn: "",
      price: "",
      unit: "each",
      productUrl: "",
    },
  });
  const queryClient = useQueryClient();
  const createProduct = useCreatePublicProduct();

  useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  const submit = (values: FormValues) => {
    const toNumber = (value: string | number | undefined) =>
      value === "" || value == null ? undefined : Number(value);
    const data: PublicProductInput = {
      sku: values.sku.trim(),
      name: values.name.trim(),
      category: values.category,
      collection: values.collection || undefined,
      finish: values.finish || undefined,
      material: values.material || undefined,
      widthIn: toNumber(values.widthIn),
      heightIn: toNumber(values.heightIn),
      depthIn: toNumber(values.depthIn),
      lengthIn: toNumber(values.lengthIn),
      price: toNumber(values.price),
      unit: values.unit || undefined,
      productUrl: values.productUrl || undefined,
    };

    createProduct.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPublicProductsQueryKey() });
        toast.success("Product submitted to the catalog");
        form.reset();
        onOpenChange(false);
      },
      onError: (error: any) => toast.error(error?.data?.error || error?.message || "Could not submit product"),
    });
  };

  const fields = [
    ["collection", "Collection"],
    ["finish", "Finish"],
    ["material", "Material"],
    ["widthIn", "Width (in)"],
    ["heightIn", "Height (in)"],
    ["depthIn", "Depth (in)"],
    ["lengthIn", "Length (in)"],
    ["price", "Price ($)"],
    ["unit", "Unit"],
    ["productUrl", "Product URL"],
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a product</DialogTitle>
          <DialogDescription>
            Share public product details. Submissions are marked as demo until reviewed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-5 pt-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              SKU
              <Input {...form.register("sku")} maxLength={100} />
              {form.formState.errors.sku && <span className="block text-xs text-destructive">{form.formState.errors.sku.message}</span>}
            </label>
            <label className="space-y-1 text-sm font-medium">
              Product name
              <Input {...form.register("name")} maxLength={200} />
              {form.formState.errors.name && <span className="block text-xs text-destructive">{form.formState.errors.name.message}</span>}
            </label>
            <label className="space-y-1 text-sm font-medium">
              Category
              <select {...form.register("category")} className="flex h-10 w-full border border-input bg-background px-3 text-sm">
                <option value="base_cabinet">Base cabinet</option>
                <option value="wall_cabinet">Wall cabinet</option>
                <option value="tall_cabinet">Tall cabinet</option>
                <option value="countertop">Countertop</option>
                <option value="island">Island</option>
                <option value="accessory">Accessory</option>
              </select>
            </label>
            {fields.map(([key, label]) => (
              <label key={key} className="space-y-1 text-sm font-medium">
                {label}
                <Input
                  {...form.register(key)}
                  type={numberFields.includes(key as typeof numberFields[number]) ? "number" : "text"}
                  step={key === "price" ? "0.01" : "0.125"}
                  maxLength={key === "productUrl" ? 500 : 120}
                />
                {form.formState.errors[key] && (
                  <span className="block text-xs text-destructive">{form.formState.errors[key]?.message}</span>
                )}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending ? "Submitting..." : "Submit product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}