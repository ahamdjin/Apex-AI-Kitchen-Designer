import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useImportProducts,
  useGetCatalogSummary,
  getListProductsQueryKey,
  getGetCatalogSummaryQueryKey,
  Product
} from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Download, Upload, Search, Trash2, Edit } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductForm } from "@/components/catalog/product-form";
import { ImportDialog } from "@/components/catalog/import-dialog";
import { formatCurrency } from "@/lib/utils";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: products = [], isLoading } = useListProducts();
  const { data: summary } = useGetCatalogSummary();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    deleteProduct.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
      }
    });
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto space-y-8 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Product Catalog</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage cabinet, countertop, and accessory offerings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => {
            setEditingProduct(null);
            setFormOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Total Items</div>
            <div className="text-2xl font-semibold mt-1">{summary.total}</div>
          </div>
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Cabinets</div>
            <div className="text-2xl font-semibold mt-1">{summary.cabinets}</div>
          </div>
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Countertops</div>
            <div className="text-2xl font-semibold mt-1">{summary.countertops}</div>
          </div>
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Verified</div>
            <div className="text-2xl font-semibold mt-1 text-green-600 dark:text-green-400">{summary.verified}</div>
          </div>
          <div className="bg-card border rounded-lg p-4 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Demo</div>
            <div className="text-2xl font-semibold mt-1 text-orange-600 dark:text-orange-400">{summary.demo}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by SKU or Name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Loading catalog...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {product.category.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {product.widthIn ? `${product.widthIn}"W` : '-'}
                        {product.heightIn ? ` × ${product.heightIn}"H` : ''}
                        {product.depthIn ? ` × ${product.depthIn}"D` : ''}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {product.price ? formatCurrency(product.price) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={product.status === 'verified' ? 'default' : product.status === 'demo' ? 'outline' : 'secondary'}
                          className={product.status === 'demo' ? 'border-orange-200 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30' : ''}
                        >
                          {product.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingProduct(product);
                              setFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <ProductForm 
        open={formOpen} 
        onOpenChange={setFormOpen} 
        product={editingProduct} 
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />
    </div>
  );
}
