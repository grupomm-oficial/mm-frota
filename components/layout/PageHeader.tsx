import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  iconTone?: "blue" | "yellow" | "slate";
  actions?: ReactNode;
  badges?: ReactNode;
  className?: string;
}

const iconToneClasses = {
  blue:
    "app-glow-blue border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200",
  yellow:
    "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200",
  slate:
    "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
};

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  iconTone = "blue",
  actions,
  badges,
  className,
}: PageHeaderProps) {
  return (
    <section className={cn("app-panel app-fade-up p-5 md:p-6", className)}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl space-y-3">
          {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}

          <div className="flex items-start gap-3">
            {Icon ? (
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                  iconToneClasses[iconTone]
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
            ) : null}

            <div className="space-y-2">
              <h1 className="app-title">{title}</h1>
              <p className="app-subtitle max-w-2xl">{description}</p>
            </div>
          </div>

          {badges ? <div className="flex flex-wrap gap-2 pt-1">{badges}</div> : null}
        </div>

        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
