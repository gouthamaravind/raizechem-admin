import { useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Input } from "@/components/ui/input";
import { Search, ChevronRight, MapPin, Phone, RefreshCw } from "lucide-react";
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
      <div className="space-y-3">
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
                className="bg-card rounded-xl p-4 border border-border flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{dealer.name}</p>
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
                    className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium"
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
