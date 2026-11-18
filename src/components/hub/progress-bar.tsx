import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  tone: "success" | "warning";
  className?: string;
};

export const ProgressBar = ({ value, tone, className }: ProgressBarProps) => (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
  >
    <div
      className={cn(
        "h-full rounded-full transition-all duration-500",
        tone === "success" ? "bg-success" : "bg-warning",
      )}
      style={{ width: `${value}%` }}
    />
  </div>
);
