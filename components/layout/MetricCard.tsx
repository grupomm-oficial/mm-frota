import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  accent?: "yellow" | "blue" | "green" | "red" | "slate";
  aside?: ReactNode;
  className?: string;
  size?: "default" | "hero";
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
  size = "default",
}: MetricCardProps) {
  const isHero = size === "hero";

  return (
    <Card
      className={cn(
        "app-panel-muted min-w-0 max-w-full gap-0 overflow-hidden",
        isHero ? "p-5 md:p-6" : "p-4",
        className
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p
            className={cn(
              "min-w-0 break-words font-semibold tracking-tight text-slate-950 dark:text-white",
              isHero
                ? "text-[clamp(1.85rem,3vw,2.7rem)] leading-[1.02]"
                : "text-[clamp(1.55rem,2.3vw,2.15rem)] leading-tight"
            )}
          >
            {value}
          </p>
          {helper ? (
            <p
              className={cn(
                "max-w-full text-slate-500 line-clamp-2 dark:text-slate-400",
                isHero ? "text-sm leading-6" : "text-xs leading-5"
              )}
            >
              {helper}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl border",
            isHero ? "h-11 w-11 md:h-12 md:w-12" : "h-10 w-10",
            accentClasses[accent]
          )}
        >
          <Icon className={isHero ? "h-5 w-5" : "h-4 w-4"} />
        </div>
      </div>

      {aside ? <div className={isHero ? "mt-4" : "mt-3"}>{aside}</div> : null}
    </Card>
  );
}
