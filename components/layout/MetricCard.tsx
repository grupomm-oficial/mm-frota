import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accent?: "yellow" | "blue" | "green" | "red" | "slate";
  aside?: ReactNode;
  className?: string;
}

const accentClasses = {
  yellow:
    "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  blue:
    "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200",
  green:
    "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  red:
    "border-red-100 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200",
  slate:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
};

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = "blue",
  aside,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("app-panel-muted gap-0 p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-[2rem]">
            {value}
          </p>
          <p className="max-w-[18rem] text-sm leading-6 text-slate-500 dark:text-slate-400">
            {helper}
          </p>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
            accentClasses[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {aside ? <div className="mt-4">{aside}</div> : null}
    </Card>
  );
}
