"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { CalendarDays, LogOut, Menu, Settings2 } from "lucide-react";

import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppSidebar, sidebarItems } from "@/components/layout/AppSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Visao geral da frota.",
  },
  "/veiculos": {
    title: "Veiculos",
    subtitle: "Cadastro e status da frota.",
  },
  "/motoristas": {
    title: "Motoristas",
    subtitle: "Equipe habilitada para operacao.",
  },
  "/rotas": {
    title: "Rotas",
    subtitle: "Saidas, retorno e historico.",
  },
  "/abastecimentos": {
    title: "Abastecimentos",
    subtitle: "Consumo e custo por veiculo.",
  },
  "/manutencoes": {
    title: "Manutencoes",
    subtitle: "Disponibilidade e custos.",
  },
  "/relatorios": {
    title: "Relatorios",
    subtitle: "Analise gerencial da frota.",
  },
  "/admin/usuarios": {
    title: "Usuarios",
    subtitle: "Permissoes e acessos.",
  },
  "/configuracoes": {
    title: "Configuracoes",
    subtitle: "Preferencias visuais do sistema.",
  },
};

function resolvePageMeta(pathname: string) {
  const matchedEntry = Object.entries(routeMeta).find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (matchedEntry) {
    return matchedEntry[1];
  }

  const fallback = sidebarItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return {
    title: fallback?.label ?? "MM Frota",
    subtitle: "Sistema interno do Grupo MM.",
  };
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      }),
    []
  );

  const pageMeta = resolvePageMeta(pathname);
  const roleLabel = user?.role === "admin" ? "Admin" : "Operacao";
  const storeLabel = user?.storeId || "Grupo MM";
  const userLabel = user?.name || "Equipe MM";

  const controlButtonClass =
    "h-9 rounded-xl border-blue-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-yellow-400/20 dark:hover:bg-yellow-400/10 dark:hover:text-yellow-100";

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 bg-transparent pb-3">
      <div className="app-panel relative overflow-hidden px-4 py-4 md:px-5">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/80 to-transparent dark:via-yellow-300/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.08),transparent_22%)]" />

        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3 md:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className={cn("shrink-0 lg:hidden", controlButtonClass)}
                  aria-label="Abrir menu"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[88vw] max-w-[340px] border-border bg-background/95 p-0 backdrop-blur-xl"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navegacao principal</SheetTitle>
                  <SheetDescription>
                    Acesse os modulos do sistema de frota.
                  </SheetDescription>
                </SheetHeader>
                <AppSidebar mobile />
              </SheetContent>
            </Sheet>

            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.88))] text-sm font-semibold tracking-[0.24em] text-blue-700 shadow-[0_14px_28px_rgba(37,99,235,0.12)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.92),rgba(14,14,16,0.96))] dark:text-yellow-200 sm:flex">
              MM
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200">
                  Grupo MM
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300">
                  {roleLabel}
                </span>
                <span className="hidden items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300 sm:inline-flex">
                  {storeLabel}
                </span>
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-2xl">
                  {pageMeta.title}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                  {pageMeta.subtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
            <div className="hidden items-center gap-3 rounded-[24px] border border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9))] px-4 py-3 shadow-[0_12px_30px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.92),rgba(14,14,16,0.94))] md:flex">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-blue-100 bg-white text-blue-700 dark:border-yellow-400/10 dark:bg-slate-950/70 dark:text-yellow-200">
                <CalendarDays className="h-4 w-4" />
              </div>

              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-blue-700/70 dark:text-yellow-200/70">
                  Hoje
                </p>
                <p className="text-sm font-semibold capitalize text-slate-950 dark:text-white">
                  {todayLabel}
                </p>
              </div>

              <div className="h-9 w-px bg-blue-100 dark:bg-white/10" />

              <div className="min-w-[132px] space-y-0.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Usuario
                </p>
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {userLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[24px] border border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.9))] p-2 shadow-[0_12px_30px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.92),rgba(14,14,16,0.94))]">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={controlButtonClass}
                onClick={() => router.push("/configuracoes")}
                aria-label="Abrir configuracoes"
              >
                <Settings2 className="h-4 w-4" />
              </Button>

              <ThemeToggle compact className={controlButtonClass} />

              <Button
                size="sm"
                variant="outline"
                className={cn("px-3 text-slate-700 dark:text-slate-100", controlButtonClass)}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
