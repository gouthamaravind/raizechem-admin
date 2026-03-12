import { Construction, Mail } from "lucide-react";

export function MaintenanceMode() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Construction className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Under Maintenance
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          We're performing scheduled maintenance to improve your experience. We'll be back shortly.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
          <Mail className="h-4 w-4" />
          <span>Contact: admin@raizechem.in</span>
        </div>
      </div>
    </div>
  );
}
