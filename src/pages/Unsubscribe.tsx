import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) { setState("invalid"); setMsg("Missing token."); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON_KEY },
        });
        const j = await r.json();
        if (j.valid === true) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else { setState("invalid"); setMsg(j.error || "Invalid token."); }
      } catch (e: any) {
        setState("error"); setMsg(e?.message || "Network error.");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    if (error) { setState("error"); setMsg(error.message); return; }
    if ((data as any)?.success) setState("done");
    else if ((data as any)?.reason === "already_unsubscribed") setState("already");
    else { setState("error"); setMsg((data as any)?.error || "Unknown error."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unsubscribe from Raizechem emails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validating link…</p>}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">Click below to stop receiving payment reminders and notifications from Raizechem.</p>
              <Button variant="destructive" className="w-full" onClick={confirm}>Confirm Unsubscribe</Button>
            </>
          )}
          {state === "submitting" && <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Processing…</p>}
          {state === "done" && <p className="flex items-center gap-2 text-green-600"><CheckCircle2 className="h-4 w-4" />You have been unsubscribed.</p>}
          {state === "already" && <p className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" />This email is already unsubscribed.</p>}
          {(state === "invalid" || state === "error") && (
            <p className="flex items-center gap-2 text-destructive"><XCircle className="h-4 w-4" />{msg || "Invalid or expired link."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
