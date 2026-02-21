import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function StubPage({ title, description }: { title: string; description: string }) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Construction className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Coming Soon</p>
            <p className="text-sm">This module will be available in a future update.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
