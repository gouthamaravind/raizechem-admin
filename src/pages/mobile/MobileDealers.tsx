import { useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, MapPin, Phone, RefreshCw, Building2 } from "lucide-react";
import { useFieldCatalog } from "@/hooks/useFieldCatalog";
import { SyncBadge } from "@/components/mobile/SyncBadge";
import { useFieldOps } from "@/hooks/useFieldOps";

export default function MobileDealers() {
  const [search, setSearch] = useState("");
  const { dealers, isLoading, isFetching, refetch, hasCoverageFilter, assignedPincodes } = useFieldCatalog();
  const { pendingSync } = useFieldOps();

  const filtered = dealers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.city?.toLowerCase().includes(search.toLowerCase()) ||
      d.contact_person?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MobileLayout title="Dealers">
      <div className="space-y-4">
        <section className="rounded-[1.75rem] border border-border bg-card px-5 py-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Assigned Network</p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Dealer access for your route</h2>
              <p className="text-sm text-muted-foreground">
                Browse your active dealers, check in quickly, and stay ready for field visits.
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
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {hasCoverageFilter && (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            Showing dealers for assigned pincodes: {assignedPincodes.join(", ")}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search dealers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        {loading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((dealer) => (
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
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {dealer.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {dealer.city}
                      </span>
                    )}
                    {dealer.phone && (
                      <a href={`tel:${dealer.phone}`} className="flex items-center gap-1 text-primary">
                        <Phone className="h-3 w-3" />
                        {dealer.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/m/visits/checkin?dealer=${dealer.id}&name=${encodeURIComponent(dealer.name)}`}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                  >
                    Check In
                  </Link>
                  <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No dealers found</p>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
