import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PendingAction {
  id: string;
  action: string;
  payload: any;
  timestamp: number;
}

export function useFieldOps() {
  const [loading, setLoading] = useState(false);
  const [pendingSync, setPendingSync] = useState<PendingAction[]>([]);

  const callFieldOps = useCallback(async (action: string, method: string, body?: any) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/fieldops?action=${action}`;
      
      const opts: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      };
      if (body && method !== "GET") {
        opts.body = JSON.stringify(body);
      }

      const res = await fetch(url, opts);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }
      
      // Clear any pending for this action on success
      setPendingSync(prev => prev.filter(p => p.action !== action));
      return { data, error: null };
    } catch (err: any) {
      // Queue for offline retry
      if (body && method === "POST") {
        const pending: PendingAction = {
          id: crypto.randomUUID(),
          action,
          payload: body,
          timestamp: Date.now(),
        };
        setPendingSync(prev => [...prev, pending]);
      }
      return { data: null, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const startDuty = (lat?: number, lng?: number) =>
    callFieldOps("start-duty", "POST", { lat, lng });

  const stopDuty = (sessionId: string, lat?: number, lng?: number) =>
    callFieldOps("stop-duty", "POST", { session_id: sessionId, lat, lng });

  const addLocations = (sessionId: string, points: Array<{ lat: number; lng: number; accuracy?: number; recorded_at?: string }>) =>
    callFieldOps("add-locations", "POST", { session_id: sessionId, points });

  const checkinVisit = (dealerId: string, sessionId?: string, lat?: number, lng?: number, notes?: string) =>
    callFieldOps("checkin-visit", "POST", { dealer_id: dealerId, session_id: sessionId, lat, lng, notes });

  const checkoutVisit = (visitId: string, lat?: number, lng?: number, notes?: string, photoUrl?: string) =>
    callFieldOps("checkout-visit", "POST", { visit_id: visitId, lat, lng, notes, photo_url: photoUrl });

  const createFieldOrder = (dealerId: string, items: Array<{ product_id: string; qty: number; expected_rate: number }>, sessionId?: string, notes?: string, deliveryDate?: string) =>
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

  const getTodaySummary = () =>
    callFieldOps("today-summary", "GET");

  return {
    loading,
    pendingSync,
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
