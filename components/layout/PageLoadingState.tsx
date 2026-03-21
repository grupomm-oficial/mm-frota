import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface PageLoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export function PageLoadingState({
  title = "Carregando tela",
  description = "Estamos preparando os dados desta area para voce continuar sem precisar repetir a acao.",
  className,
  compact = false,
}: PageLoadingStateProps) {
  return (
    <div className={cn("app-page", className)}>
      <section
        className={cn(
          "app-panel overflow-hidden p-5 md:p-6",
          compact ? "max-w-2xl" : ""
        )}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[28px] border border-yellow-400/30 bg-yellow-400/12 text-yellow-500 dark:border-yellow-300/20 dark:bg-yellow-300/10 dark:text-yellow-200">
            <div className="absolute inset-0 rounded-[28px] border border-yellow-400/20 animate-pulse" />
            <LoaderCircle className="relative h-8 w-8 animate-spin" />
          </div>

          <div className="space-y-2">
            <p className="app-kicker">Carregando</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {title}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="app-panel-muted p-4">
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-yellow-400/30 dark:bg-yellow-300/20" />
            <div className="mt-4 h-8 w-3/4 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.06]" />
          </div>
          <div className="app-panel-muted p-4">
            <div className="h-2.5 w-20 animate-pulse rounded-full bg-yellow-400/30 dark:bg-yellow-300/20" />
            <div className="mt-4 h-8 w-2/3 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.06]" />
          </div>
          <div className="app-panel-muted p-4">
            <div className="h-2.5 w-28 animate-pulse rounded-full bg-yellow-400/30 dark:bg-yellow-300/20" />
            <div className="mt-4 h-8 w-4/5 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.06]" />
          </div>
        </div>
      </section>
    </div>
  );
}
