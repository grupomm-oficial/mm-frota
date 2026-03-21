import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatusBannerProps {
  tone: "success" | "error" | "info";
  children: ReactNode;
  className?: string;
}

const toneClasses = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200",
  info:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200",
};

export function StatusBanner({
  tone,
  children,
  className,
}: StatusBannerProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-medium",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </div>
  );
}
