import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, MapPin, Phone, RefreshCw, Building2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";
import { Button } from "@/components/ui/button";
import { Database } from "@/integrations/supabase/types";

type Dealer = Database["public"]["Tables"]["dealers"]["Row"];

export default function MobileDealers() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { pendingSync } = useFieldOps();
  const pageSize = 25;

  const load = async (pageNum: number, searchStr: string, append = false) => {
    if (!user) return;
    const from = pageNum * pageSize;
    const to = from + pageSize - 1;

    let q = supabase
      .from("dealers")
      .select("id, name, city, state, phone, contact_person, pincode")
      .eq("status", "active")
      .order("name")
      .range(from, to);

    if (searchStr) {
      q = q.or(`name.ilike.%${searchStr}%,city.ilike.%${searchStr}%,contact_person.ilike.%${searchStr}%`);
    }

    const { data, error } = await q;

    if (error) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const fetched = (data as Dealer[]) || [];
    if (append) {
      setDealers(prev => [...prev, ...fetched]);
    } else {
      setDealers(fetched);
    }
    
    setHasMore(fetched.length === pageSize);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      load(0, search);
    }, 400); // debounce search
    return () => clearTimeout(timer);
  }, [search, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(0);
    load(0, search);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    load(nextPage, search, true);
  };

  return (
    <MobileLayout title="Dealers">
      <div className="space-y-4 pb-8">
        <section className="rounded-[1.75rem] border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Assigned Network</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Dealer Network</h2>
              <p className="text-sm text-muted-foreground">
                Browse active dealers, check in quickly, and stay ready for field visits.
              </p>
            </div>
            <div className="rounded-2xl bg-accent p-3 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between gap-2">
          <SyncBadge count={pendingSync.length} />
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, city or contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base rounded-xl shadow-sm border-border focus:ring-primary"
          />
        </div>

        {loading && page === 0 ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {dealers.map((dealer) => (
              <div
                key={dealer.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="rounded-xl bg-accent p-2 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <p className="truncate font-semibold text-foreground">{dealer.name}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {dealer.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {dealer.city}
                      </span>
                    )}
                    {dealer.phone && (
                      <a href={`tel:${dealer.phone}`} className="flex items-center gap-1 text-primary font-medium">
                        <Phone className="h-3 w-3" />
                        {dealer.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Link
                    to={`/m/visits/checkin?dealer=${dealer.id}&name=${encodeURIComponent(dealer.name)}`}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-sm active:scale-95 transition-transform"
                  >
                    Check In
                  </Link>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            ))}
            
            {dealers.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">No dealers matched your search</p>
              </div>
            )}

            {hasMore && (
              <Button 
                variant="ghost" 
                className="w-full mt-4 text-muted-foreground gap-2 h-12" 
                onClick={handleLoadMore}
                disabled={refreshing}
              >
                <ChevronDown className="h-4 w-4" />
                Load More Dealers
              </Button>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
