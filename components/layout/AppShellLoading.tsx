import { AnimatedCarLoader } from "@/components/layout/AnimatedCarLoader";

export function AppShellLoading() {
  return (
    <div className="app-shell-loading">
      <div className="hidden lg:block">
        <aside className="h-screen w-[312px] shrink-0 bg-transparent p-4 xl:w-[324px]">
          <div className="app-panel sticky top-4 flex h-[calc(100vh-2rem)] min-h-0 flex-col p-5">
            <div className="app-skeleton-block h-24 rounded-[28px]" />
            <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-white/10" />

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/[0.08]" />
                <div className="space-y-2">
                  <div className="app-skeleton-block h-14 rounded-[20px]" />
                  <div className="app-skeleton-block h-14 rounded-[20px]" />
                  <div className="app-skeleton-block h-14 rounded-[20px]" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-white/[0.08]" />
                <div className="space-y-2">
                  <div className="app-skeleton-block h-14 rounded-[20px]" />
                  <div className="app-skeleton-block h-14 rounded-[20px]" />
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <div className="app-skeleton-block h-[72px] rounded-[24px]" />
            </div>
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 px-4 py-4 md:px-6 md:py-5">
            <div className="w-full space-y-6 pb-24 lg:pb-6">
              <section className="app-panel-muted relative overflow-hidden px-4 py-3.5 md:px-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3 md:gap-4">
                    <div className="app-skeleton-block h-11 w-11 rounded-[18px]" />
                    <div className="space-y-2">
                      <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-white/[0.08]" />
                      <div className="h-7 w-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/[0.08]" />
                    </div>
                  </div>

                  <div className="app-action-surface">
                    <div className="app-skeleton-block h-10 rounded-xl sm:w-[136px]" />
                    <div className="app-skeleton-block h-10 rounded-xl sm:w-[136px]" />
                  </div>
                </div>
              </section>

              <section className="app-panel overflow-hidden p-5 md:p-6">
                <div className="flex min-h-[420px] items-center justify-center py-8">
                  <AnimatedCarLoader
                    title="Preparando sua frota"
                    description="Estamos carregando os dados e abrindo o caminho para a proxima tela."
                  />
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
