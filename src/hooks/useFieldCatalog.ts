import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Dealer = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  pincode?: string | null;
};

type Product = {
  id: string;
  name: string;
  sale_price?: number | null;
};

type PincodeRow = {
  pincode: string;
};

const DEALERS_CACHE_KEY = "fieldops_cached_dealers";
const PRODUCTS_CACHE_KEY = "fieldops_cached_products";

function readCache<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeCache<T>(key: string, value: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore cache write failures
  }
}

export function useFieldCatalog() {
  const { user, hasRole } = useAuth();
  const isFieldopsUser = hasRole("fieldops");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["field-catalog", user?.id, isFieldopsUser],
    enabled: !!user,
    queryFn: async () => {
      const [dealersRes, productsRes, pincodesRes] = await Promise.all([
        supabase
          .from("dealers")
          .select("id, name, city, state, phone, contact_person, pincode")
          .eq("status", "active")
          .order("name"),
        supabase
          .from("products")
          .select("id, name, sale_price")
          .eq("is_active", true)
          .order("name"),
        isFieldopsUser
          ? supabase.from("employee_pincodes").select("pincode").eq("user_id", user!.id)
          : Promise.resolve({ data: [] as PincodeRow[], error: null }),
      ]);

      const dealers = (dealersRes.data || []) as Dealer[];
      const products = (productsRes.data || []) as Product[];
      const assignedPincodes = ((pincodesRes.data || []) as PincodeRow[])
        .map((row) => row.pincode)
        .filter(Boolean);

      writeCache(DEALERS_CACHE_KEY, dealers);
      writeCache(PRODUCTS_CACHE_KEY, products);

      return { dealers, products, assignedPincodes };
    },
    staleTime: 60_000,
    retry: 1,
  });

  const cachedDealers = readCache<Dealer>(DEALERS_CACHE_KEY);
  const cachedProducts = readCache<Product>(PRODUCTS_CACHE_KEY);

  const assignedPincodes = data?.assignedPincodes || [];

  const dealers = useMemo(() => {
    const source = (data?.dealers?.length ? data.dealers : cachedDealers) || [];
    if (!isFieldopsUser || assignedPincodes.length === 0) return source;
    return source.filter((dealer) => dealer.pincode && assignedPincodes.includes(dealer.pincode));
  }, [assignedPincodes, cachedDealers, data?.dealers, isFieldopsUser]);

  const products = data?.products?.length ? data.products : cachedProducts;

  return {
    dealers,
    products,
    assignedPincodes,
    isLoading,
    isFetching,
    refetch,
    hasCoverageFilter: isFieldopsUser && assignedPincodes.length > 0,
  };
}
