import { useState, forwardRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, PanelLeft, ShoppingCart, CreditCard, Package,
  ArrowRight, ArrowLeft, Sparkles, FileText, Users,
} from "lucide-react";

interface WelcomeTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const slides = [
  {
    icon: Sparkles,
    title: "Welcome to Raizechem Admin",
    description: "Let's take a quick tour of your admin panel. You'll learn where everything is and how to get started.",
    color: "text-primary",
    bg: "bg-primary/10",
    tips: [
      "This walkthrough covers the essentials",
      "You can replay this tour anytime from the top bar",
      "Let's begin! 🚀",
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Your Dashboard",
    description: "The dashboard gives you a bird's-eye view of your business at a glance.",
    color: "text-primary",
    bg: "bg-primary/10",
    tips: [
      "Today's Orders — see how many orders came in today",
      "Pending Payments — track outstanding amounts",
      "Low Stock Alerts — never run out of inventory",
      "Monthly Revenue — monitor your growth",
    ],
  },
  {
    icon: PanelLeft,
    title: "Sidebar Navigation",
    description: "Use the collapsible sidebar to navigate between different modules.",
    color: "text-accent-foreground",
    bg: "bg-accent/20",
    tips: [
      "Masters — Manage dealers, products, suppliers & price levels",
      "Sales — Orders, invoices & returns",
      "Inventory — Stock-in, batches & alerts",
      "Finance — Payments, ledger & outstanding",
      "Reports — GST, sales register & more",
    ],
  },
  {
    icon: ShoppingCart,
    title: "Sales Workflow",
    description: "Follow the complete sales cycle from order to payment collection.",
    color: "text-primary",
    bg: "bg-primary/10",
    tips: [
      "Create Order → Confirm → Generate Invoice",
      "Print or share invoices with GST details",
      "Track payment status per invoice",
      "Process returns with credit notes",
    ],
  },
  {
    icon: Package,
    title: "Inventory Management",
    description: "Keep track of every product batch, stock level, and movement.",
    color: "text-warning",
    bg: "bg-warning/10",
    tips: [
      "Stock In — Record new inventory arrivals",
      "Batches — Track batch-wise quantities & expiry",
      "Alerts — Get notified when stock runs low",
      "All movements are auto-tracked with audit trails",
    ],
  },
  {
    icon: CreditCard,
    title: "Finance & Payments",
    description: "Manage your cash flow with comprehensive financial tools.",
    color: "text-success",
    bg: "bg-success/10",
    tips: [
      "Record payments with TDS/TCS support",
      "Allocate payments against specific invoices",
      "View dealer-wise ledger & outstanding reports",
      "Supplier payments & purchase ledger included",
    ],
  },
  {
    icon: FileText,
    title: "Reports & Compliance",
    description: "Generate GST-ready reports and business insights.",
    color: "text-destructive",
    bg: "bg-destructive/10",
    tips: [
      "GSTR-1 & GSTR-3B summaries",
      "Sales & Purchase registers",
      "Outstanding aging analysis",
      "TDS/TCS compliance reports",
    ],
  },
  {
    icon: Users,
    title: "You're All Set!",
    description: "Start managing your business like a pro. Here are some quick actions to get going.",
    color: "text-primary",
    bg: "bg-primary/10",
    tips: [
      "Add your dealers & products in Masters",
      "Create your first sales order",
      "Record a stock-in entry",
      "You can replay this tour from the ❓ button anytime",
    ],
  },
];

export const WelcomeTour = forwardRef<HTMLDivElement, WelcomeTourProps>(function WelcomeTour({ open, onOpenChange }, _ref) {
  const [step, setStep] = useState(0);
  const slide = slides[step];
  const isLast = step === slides.length - 1;
  const isFirst = step === 0;

  const handleClose = () => {
    setStep(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header with icon */}
        <div className={`${slide.bg} p-6 pb-4 flex flex-col items-center text-center`}>
          <div className={`p-3 rounded-2xl bg-background/80 backdrop-blur-sm shadow-sm mb-3`}>
            <slide.icon className={`h-8 w-8 ${slide.color}`} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">{slide.title}</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">{slide.description}</p>
        </div>

        {/* Content */}
        <div className="p-6 pt-4 space-y-4">
          <ul className="space-y-2.5">
            {slide.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-foreground/80">{tip}</span>
              </li>
            ))}
          </ul>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 pt-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/20 hover:bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              className="gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>

            {isLast ? (
              <Button size="sm" onClick={handleClose} className="gap-1">
                Get Started
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
