import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Grid3X3 } from "lucide-react";
import { useState } from "react";

export default function PriceMatrix() {
  const [search, setSearch] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, sale_price, category").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: priceLevels = [] } = useQuery({
    queryKey: ["price-levels"],
    queryFn: async () => {
      const { data } = await supabase.from("price_levels").select("id, name, sort_order").order("sort_order");
      return data || [];
    },
  });

  const { data: priceLevelPrices = [] } = useQuery({
    queryKey: ["price-level-prices"],
    queryFn: async () => {
      const { data } = await supabase.from("product_price_levels").select("product_id, price_level_id, price");
      return data || [];
    },
  });

  const priceMap = new Map<string, number>();
  priceLevelPrices.forEach((p: any) => {
    priceMap.set(`${p.product_id}_${p.price_level_id}`, Number(p.price));
  });

  const filtered = products.filter((p: any) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Grid3X3 className="h-6 w-6 text-primary" />
            Price Matrix
          </h1>
          <p className="text-muted-foreground">All products vs all price levels at a glance</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No products found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10">Product</TableHead>
                      <TableHead>Base Price</TableHead>
                      {priceLevels.map((pl: any) => (
                        <TableHead key={pl.id} className="text-center">{pl.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((product: any) => (
                      <TableRow key={product.id}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium">{product.name}</TableCell>
                        <TableCell className="font-mono text-sm">₹{Number(product.sale_price || 0).toFixed(2)}</TableCell>
                        {priceLevels.map((pl: any) => {
                          const price = priceMap.get(`${product.id}_${pl.id}`);
                          return (
                            <TableCell key={pl.id} className="text-center font-mono text-sm">
                              {price !== undefined ? (
                                <span className={price !== Number(product.sale_price) ? "text-primary font-semibold" : ""}>
                                  ₹{price.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
