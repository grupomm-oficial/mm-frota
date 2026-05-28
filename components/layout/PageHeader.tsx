import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
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
    <section className={cn("app-panel app-fade-up relative overflow-hidden p-5 md:p-6", className)}>
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent dark:via-yellow-300/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.07),transparent_26%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.08),transparent_24%)]" />

      <div className="relative grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start">
        <div className="min-w-0 max-w-4xl space-y-4">
          {eyebrow ? (
            <div className="flex items-center gap-3">
              <p className="app-kicker">{eyebrow}</p>
              <div className="app-hairline max-w-[120px]" />
            </div>
          ) : null}

          <div className="flex items-start gap-3.5 md:gap-4">
            {Icon ? (
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] border md:h-12 md:w-12",
                  iconToneClasses[iconTone]
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </div>
            ) : null}

            <div className="min-w-0 space-y-2">
              <h1 className="app-title">{title}</h1>
              {description ? (
                <p className="app-subtitle max-w-2xl text-sm leading-6 line-clamp-2">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
        </div>

        {actions ? <div className="app-action-surface 2xl:w-auto">{actions}</div> : null}
      </div>
    </section>
  );
}
