import { ShieldCheck } from "lucide-react";

export const Brand = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-crimson text-crimson-foreground">
      <ShieldCheck className="h-5 w-5" aria-hidden />
    </div>
    <div className="min-w-0">
      <p className="font-display text-lg font-semibold leading-tight">{title}</p>
      <p className="truncate text-xs text-primary-foreground/70">{subtitle}</p>
    </div>
  </div>
);
