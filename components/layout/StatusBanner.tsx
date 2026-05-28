import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatusBannerProps {
  tone: "success" | "error" | "info";
  children: ReactNode;
  className?: string;
}

const toneClasses = {
  success:
    "border-emerald-200/90 bg-emerald-50/95 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  error:
    "border-red-200/90 bg-red-50/95 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200",
  info:
    "border-blue-200/90 bg-blue-50/95 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200",
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function StatusBanner({
  tone,
  children,
  className,
}: StatusBannerProps) {
  const Icon = toneIcons[tone];

  return (
    <div
      className={cn(
        "app-fade-up rounded-[22px] border px-4 py-3.5 text-sm font-medium shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
        toneClasses[tone],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
