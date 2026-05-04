import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

type LegalLayoutProps = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">RaizeChem</p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="text-primary underline-offset-4 hover:underline" to="/privacy-policy">
              Privacy Policy
            </Link>
            <Link className="text-primary underline-offset-4 hover:underline" to="/user-policy">
              User Policy
            </Link>
            <Link className="text-primary underline-offset-4 hover:underline" to="/terms-of-use">
              Terms of Use
            </Link>
          </div>
        </div>

        <Card className="border-border">
          <CardContent className="prose prose-slate max-w-none px-6 py-8 dark:prose-invert prose-headings:scroll-mt-20 prose-p:text-foreground prose-li:text-foreground">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
