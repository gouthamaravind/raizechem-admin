import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, ChevronRight, MapPin, Phone } from "lucide-react";

export default function MobileDealers() {
  const [dealers, setDealers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("dealers")
        .select("id, name, city, state, phone, contact_person")
        .eq("status", "active")
        .order("name");
      setDealers(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = dealers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.city?.toLowerCase().includes(search.toLowerCase()) ||
      d.contact_person?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MobileLayout title="Dealers">
      <div className="space-y-3">
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
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
