import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MapPin } from "lucide-react";

export default function MobileLogin() {
  const { session, signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (session) return <Navigate to="/m/home" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_hsl(var(--accent))_0%,_hsl(var(--background))_48%)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-border bg-card shadow-lg shadow-primary/10">
            <img src="/raizechem-field-logo.png" alt="RaizeChem Field" className="h-16 w-16 object-contain" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.32em] text-primary">RaizeChem</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Field Operations</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in to manage duty, visits, dealer orders, and collections on the go.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>Live duty tracking for authorized RaizeChem staff</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-[1.75rem] border border-border bg-card/95 p-5 shadow-xl shadow-primary/5 backdrop-blur">
          <Input
            type="email"
            placeholder="RaizeChem email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 rounded-xl border-border bg-background text-base"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-12 rounded-xl border-border bg-background text-base"
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button type="submit" className="h-12 w-full rounded-xl text-base" disabled={loading}>
            {loading ? "Signing in..." : "Enter Field App"}
            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Access is restricted to authorized internal users only.
          </p>
        </form>
      </div>
    </div>
  );
}
