import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Trash2, Send, RefreshCw } from "lucide-react";
import { useFieldCatalog } from "@/hooks/useFieldCatalog";
import { SyncBadge } from "@/components/mobile/SyncBadge";

interface OrderItem {
  product_id: string;
  product_name: string;
  qty: number;
  expected_rate: number;
}

export default function MobileNewOrder() {
  const navigate = useNavigate();
  const { createFieldOrder, loading, pendingSync } = useFieldOps();
  const { dealers, products, isLoading, isFetching, refetch, hasCoverageFilter, assignedPincodes } = useFieldCatalog();
  const [selectedDealer, setSelectedDealer] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [dealerSearch, setDealerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const addItem = (product: { id: string; name: string; sale_price?: number | null }) => {
    if (items.find((i) => i.product_id === product.id)) return;
    setItems([...items, { product_id: product.id, product_name: product.name, qty: 1, expected_rate: product.sale_price || 0 }]);
    setProductSearch("");
  };

  const updateItem = (idx: number, field: "qty" | "expected_rate", value: number) => {
    const updated = [...items];
    updated[idx][field] = value;
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!selectedDealer) { toast({ title: "Select a dealer", variant: "destructive" }); return; }
    if (items.length === 0) { toast({ title: "Add at least one item", variant: "destructive" }); return; }

    const { error } = await createFieldOrder(
      selectedDealer,
      items.map(({ product_id, qty, expected_rate }) => ({ product_id, qty, expected_rate })),
      undefined,
      notes || undefined
    );

    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Order Submitted" });
      navigate("/m/orders");
    }
  };

  const filteredDealers = dealers.filter((d) => d.name.toLowerCase().includes(dealerSearch.toLowerCase()));
  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  const selectedDealerName = dealers.find((d) => d.id === selectedDealer)?.name;

  return (
    <MobileLayout title="New Field Order">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <SyncBadge count={pendingSync.length} />
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {hasCoverageFilter && (
          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            Dealer list filtered to your assigned pincodes: {assignedPincodes.join(", ")}
          </div>
        )}

        {/* Dealer Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Dealer</label>
          {selectedDealer ? (
            <div className="flex items-center justify-between bg-accent rounded-lg p-3">
              <span className="font-medium text-accent-foreground">{selectedDealerName}</span>
              <button onClick={() => setSelectedDealer("")} className="text-xs text-destructive">Change</button>
            </div>
          ) : (
            <>
              <Input placeholder="Search dealer..." value={dealerSearch} onChange={(e) => setDealerSearch(e.target.value)} className="h-11" />
              {dealerSearch && (
                <div className="bg-card border border-border rounded-lg max-h-40 overflow-y-auto">
                  {filteredDealers.slice(0, 10).map((d) => (
                    <button key={d.id} onClick={() => { setSelectedDealer(d.id); setDealerSearch(""); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0">
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Items */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Items</label>
          {isLoading && items.length === 0 && (
            <div className="space-y-2">
              <div className="h-12 rounded-lg border border-border bg-card animate-pulse" />
              <div className="h-12 rounded-lg border border-border bg-card animate-pulse" />
            </div>
          )}
          {items.map((item, idx) => (
            <div key={item.product_id} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground truncate flex-1">{item.product_name}</span>
                <button onClick={() => removeItem(idx)} className="text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Qty</label>
                  <Input type="number" value={item.qty} onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} min={1} className="h-10" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Rate ₹</label>
                  <Input type="number" value={item.expected_rate} onChange={(e) => updateItem(idx, "expected_rate", Number(e.target.value))} min={0} className="h-10" />
                </div>
              </div>
            </div>
          ))}

          <div className="relative">
            <Input placeholder="Search product to add..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-11" />
            {productSearch && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg max-h-40 overflow-y-auto z-10 shadow-lg">
                {filteredProducts.slice(0, 10).map((p) => (
                  <button key={p.id} onClick={() => addItem(p)} className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-0 flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-muted-foreground">₹{p.sale_price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />

        {/* Total */}
        {items.length > 0 && (
          <div className="bg-accent rounded-lg p-3 flex justify-between items-center">
            <span className="text-sm font-medium text-accent-foreground">Total</span>
            <span className="text-lg font-bold text-primary">
              ₹{items.reduce((s, i) => s + i.qty * i.expected_rate, 0).toLocaleString()}
            </span>
          </div>
        )}

        <Button onClick={handleSubmit} className="w-full h-14 text-base gap-2" disabled={loading || !selectedDealer || items.length === 0}>
          <Send className="h-5 w-5" />
          Submit Order
        </Button>
      </div>
    </MobileLayout>
  );
}
