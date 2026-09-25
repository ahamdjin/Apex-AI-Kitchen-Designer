import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useImportProducts,
  useGetCatalogSummary,
  useListPublicProducts,
  getListProductsQueryKey,
  getGetCatalogSummaryQueryKey,
  getListPublicProductsQueryKey,
  Product,
  type PublicProduct,
} from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Search, Trash2, Edit, LockKeyhole, LogOut } from "lucide-react";
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
import { clearAdminToken, getAdminToken, saveAdminToken } from "@/lib/admin-auth";
import { PublicProductForm } from "@/components/catalog/public-product-form";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [adminToken, setAdminToken] = useState(() => getAdminToken() ?? "");
  const [tokenDraft, setTokenDraft] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [publicFormOpen, setPublicFormOpen] = useState(false);
  const queryClient = useQueryClient();
  const hasAdminToken = adminToken.length > 0;
  const {
    data: publicProducts = [],
    isLoading: publicLoading,
    error: publicError,
  } = useListPublicProducts({
    query: { queryKey: getListPublicProductsQueryKey(), refetchOnMount: "always" },
  });

  const {
    data: products = [],
    isLoading,
    error: productsError,
  } = useListProducts({ query: { queryKey: getListProductsQueryKey(), enabled: hasAdminToken, retry: false } });
  const {
    data: summary,
    error: summaryError,
  } = useGetCatalogSummary({ query: { queryKey: getGetCatalogSummaryQueryKey(), enabled: hasAdminToken, retry: false } });
  const deleteProduct = useDeleteProduct();

  const authStatus = (productsError as { status?: number } | null)?.status
    ?? (summaryError as { status?: number } | null)?.status;

  useEffect(() => {
    if (authStatus === 401) {
      clearAdminToken();
      setAdminToken("");
      setAuthMessage("That admin key was not accepted.");
    } else if (authStatus === 503) {
      setAuthMessage("Catalog administration is not configured on the server.");
    }
  }, [authStatus]);

  const unlockCatalog = (event: React.FormEvent) => {
    event.preventDefault();
    const token = tokenDraft.trim();
    if (!token) {
      setAuthMessage("Enter the admin key.");
      return;
    }
    queryClient.removeQueries({ queryKey: getListProductsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetCatalogSummaryQueryKey() });
    saveAdminToken(token);
    setAdminToken(token);
    setTokenDraft("");
    setAuthMessage(null);
  };

  const logout = () => {
    clearAdminToken();
    setAdminToken("");
    queryClient.removeQueries({ queryKey: getListProductsQueryKey() });
    queryClient.removeQueries({ queryKey: getGetCatalogSummaryQueryKey() });
  };
  const filteredPublicProducts = publicProducts.filter((product: PublicProduct) =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  if (!hasAdminToken) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-8 p-6 md:p-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Apex Kitchen Designer</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Product Catalog</h1>
            <p className="mt-2 text-sm text-muted-foreground">Browse cabinet, countertop, and accessory offerings, or submit a product for review.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPublicFormOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add Product
            </Button>
            <Button variant="outline" onClick={() => setAdminAccessOpen((open) => !open)}>
              <LockKeyhole className="mr-2 size-4" />
              Admin
            </Button>
          </div>
        </div>

        {adminAccessOpen && (
          <form onSubmit={unlockCatalog} className="ml-auto flex max-w-xl flex-col gap-3 border bg-card p-4 shadow-sm sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              value={tokenDraft}
              onChange={(event) => setTokenDraft(event.target.value)}
              placeholder="Server-side admin key"
              aria-label="Admin key"
            />
            <Button type="submit">Unlock</Button>
            {authMessage && <p role="alert" className="basis-full text-sm text-destructive">{authMessage}</p>}
          </form>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by SKU or name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        {publicError ? (
          <div role="alert" className="border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            The public catalog could not be loaded. Please try again.
          </div>
        ) : publicLoading ? (
          <div className="border bg-card p-10 text-center text-sm text-muted-foreground">Loading catalog...</div>
        ) : filteredPublicProducts.length === 0 ? (
          <div className="border bg-card p-10 text-center text-sm text-muted-foreground">No products found. Add the first product to get started.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPublicProducts.map((product) => (
              <article key={product.id} className="space-y-4 border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
                    <h2 className="mt-1 font-semibold">{product.name}</h2>
                  </div>
                  <Badge variant={product.status === "verified" ? "default" : "outline"} className="capitalize">{product.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">{product.category.replaceAll("_", " ")}</Badge>
                  {product.collection && <Badge variant="outline">{product.collection}</Badge>}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {(product.finish || product.material) && <p>{[product.finish, product.material].filter(Boolean).join(" · ")}</p>}
                  <p>
                    {product.widthIn ? `${product.widthIn}" W` : ""}
                    {product.heightIn ? ` × ${product.heightIn}" H` : ""}
                    {product.depthIn ? ` × ${product.depthIn}" D` : ""}
                    {product.lengthIn ? ` × ${product.lengthIn}" L` : ""}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">{product.unit || "each"}</span>
                  <span className="font-semibold">{product.price != null ? formatCurrency(product.price) : "Price on request"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
        <PublicProductForm open={publicFormOpen} onOpenChange={setPublicFormOpen} />
      </div>
    );
  }

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
          <Button variant="ghost" onClick={logout} title="Lock catalog">
            <LogOut className="w-4 h-4 mr-2" />
            Lock
          </Button>
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
