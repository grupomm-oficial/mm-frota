import { AnimatedCarLoader } from "@/components/layout/AnimatedCarLoader";
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
        <div className="flex justify-center">
          <AnimatedCarLoader
            title={title}
            description={description}
            compact={compact}
          />
        </div>

        <div className={cn("mt-6 grid gap-3 md:grid-cols-3", compact ? "hidden" : "")}>
          <div className="app-panel-muted p-4">
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-blue-300/35 dark:bg-blue-300/20" />
            <div className="mt-4 h-8 w-3/4 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.06]" />
          </div>
          <div className="app-panel-muted p-4">
            <div className="h-2.5 w-20 animate-pulse rounded-full bg-blue-300/35 dark:bg-blue-300/20" />
            <div className="mt-4 h-8 w-2/3 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.06]" />
          </div>
          <div className="app-panel-muted p-4">
            <div className="h-2.5 w-28 animate-pulse rounded-full bg-blue-300/35 dark:bg-blue-300/20" />
            <div className="mt-4 h-8 w-4/5 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/[0.06]" />
          </div>
        </div>
      </section>
    </div>
  );
}
