import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

const PENDING_SYNC_KEY = "fieldops_pending_actions";

interface PendingAction {
  id: string;
  action: string;
  payload: unknown;
  timestamp: number;
}

type FieldOpsResult<T> = {
  data: T | null;
  error: string | null;
};

type AddLocationPoint = {
  lat: number;
  lng: number;
  accuracy?: number;
  recorded_at?: string;
};

type CreateOrderItem = {
  product_id: string;
  qty: number;
  expected_rate: number;
};

function loadPendingActions() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? (JSON.parse(raw) as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

function isOfflineLikeError(message: string) {
  const normalized = message.toLowerCase();
  return (
    !navigator.onLine ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("network request failed") ||
    normalized.includes("load failed")
  );
}

export function useFieldOps() {
  const [loading, setLoading] = useState(false);
  const [pendingSync, setPendingSync] = useState<PendingAction[]>(loadPendingActions);

  const fieldOpsUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!baseUrl) {
      throw new Error("VITE_SUPABASE_URL is not configured");
    }
    return `${String(baseUrl).replace(/\/$/, "")}/functions/v1/fieldops`;
  }, []);

  const persistPending = useCallback((updater: PendingAction[] | ((prev: PendingAction[]) => PendingAction[])) => {
    setPendingSync((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const callFieldOps = useCallback(async <T,>(action: string, method: string, body?: unknown): Promise<FieldOpsResult<T>> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const url = `${fieldOpsUrl}?action=${encodeURIComponent(action)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const opts: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        signal: controller.signal,
      };
      if (body && method !== "GET") {
        opts.body = JSON.stringify(body);
      }

      let res: Response;
      try {
        res = await fetch(url, opts);
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      
      // Clear any pending for this action on success
      persistPending((prev) => prev.filter((pending) => pending.action !== action));
      return { data: data as T, error: null };
    } catch (error) {
      const message = getErrorMessage(error);
      const shouldQueue = body && method === "POST" && isOfflineLikeError(message);
      if (shouldQueue) {
        const pending: PendingAction = {
          id: crypto.randomUUID(),
          action,
          payload: body,
          timestamp: Date.now(),
        };
        persistPending((prev) => {
          const next = [...prev, pending].slice(-100);
          return next;
        });
      }
      return { data: null, error: message };
    } finally {
      setLoading(false);
    }
  }, [fieldOpsUrl, persistPending]);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine) return;
    const queue = loadPendingActions();
    if (!queue.length) return;

    for (const pending of queue) {
      const result = await callFieldOps(pending.action, "POST", pending.payload);
      if (result.error && isOfflineLikeError(result.error)) {
        break;
      }
      persistPending((prev) => prev.filter((item) => item.id !== pending.id));
    }
  }, [callFieldOps, persistPending]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      void syncPending();
    };

    window.addEventListener("online", handleOnline);
    void syncPending();

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPending]);

  const getDeviceName = useCallback(() => {
    if (typeof navigator === "undefined") return "unknown";
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const ua = navigator.userAgent || "";
    const platform = nav.userAgentData?.platform || nav.platform || "";
    return `${platform} • ${ua}`.slice(0, 240);
  }, []);

  const startDuty = useCallback((lat?: number, lng?: number, tracking_mode?: string, battery_level?: number, device_name?: string) =>
    callFieldOps("start-duty", "POST", { 
      lat, 
      lng, 
      tracking_mode: tracking_mode || "normal", 
      battery_level, 
      device_name: device_name || getDeviceName() 
    }), [callFieldOps, getDeviceName]);

  const stopDuty = useCallback((sessionId: string, lat?: number, lng?: number, battery_level?: number) =>
    callFieldOps("stop-duty", "POST", { session_id: sessionId, lat, lng, battery_level }), [callFieldOps]);

  const addLocations = useCallback((sessionId: string, points: (AddLocationPoint & { battery_level?: number })[]) =>
    callFieldOps("add-locations", "POST", { session_id: sessionId, points }), [callFieldOps]);

  const checkinVisit = (dealerId: string, sessionId?: string, lat?: number, lng?: number, notes?: string) =>
    callFieldOps("checkin-visit", "POST", { dealer_id: dealerId, session_id: sessionId, lat, lng, notes });

  const checkoutVisit = (visitId: string, lat?: number, lng?: number, notes?: string, photoUrl?: string) =>
    callFieldOps("checkout-visit", "POST", { visit_id: visitId, lat, lng, notes, photo_url: photoUrl });

  const createFieldOrder = (dealerId: string, items: CreateOrderItem[], sessionId?: string, notes?: string, deliveryDate?: string) =>
    callFieldOps("create-field-order", "POST", {
      dealer_id: dealerId,
      session_id: sessionId,
      notes,
      requested_delivery_date: deliveryDate,
      items,
    });

  const recordPayment = (dealerId: string, amount: number, mode?: string, referenceNo?: string, paymentDate?: string, notes?: string, attachmentUrl?: string) =>
    callFieldOps("record-payment", "POST", {
      dealer_id: dealerId,
      amount,
      mode,
      reference_no: referenceNo,
      payment_date: paymentDate,
      notes,
      attachment_url: attachmentUrl,
    });

  const getTodaySummary = useCallback(() =>
    callFieldOps("today-summary", "GET"), [callFieldOps]);

  return {
    loading,
    pendingSync,
    syncPending,
    startDuty,
    stopDuty,
    addLocations,
    checkinVisit,
    checkoutVisit,
    createFieldOrder,
    recordPayment,
    getTodaySummary,
  };
}
