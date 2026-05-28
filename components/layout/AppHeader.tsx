"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  LogOut,
  Settings2,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { sidebarItems } from "@/components/layout/AppSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Painel operacional",
    subtitle: "Visao consolidada da frota, custos e operacao das lojas.",
  },
  "/veiculos": {
    title: "Gestao de veiculos",
    subtitle: "Cadastre, acompanhe status e mantenha a frota organizada.",
  },
  "/motoristas": {
    title: "Motoristas",
    subtitle: "Controle quem pode operar cada veiculo e por qual unidade.",
  },
  "/cadastros": {
    title: "Gerenciamento",
    subtitle: "Redirecionando cadastros para a central gerencial.",
  },
  "/rotas/realizadas": {
    title: "Rotas realizadas",
    subtitle: "Historico completo de rotas finalizadas, canceladas e ajustadas.",
  },
  "/rotas": {
    title: "Rotas",
    subtitle: "Tela limpa para iniciar e finalizar rotas do dia a dia.",
  },
  "/abastecimentos": {
    title: "Abastecimentos",
    subtitle: "Registre consumo, custo e comportamento da frota por loja.",
  },
  "/manutencoes": {
    title: "Manutencoes",
    subtitle: "Monitore indisponibilidades, custos e liberacao dos veiculos.",
  },
  "/relatorios": {
    title: "Relatorios",
    subtitle: "Indicadores gerenciais para tomar decisoes com mais seguranca.",
  },
  "/relatorios/fechamento": {
    title: "Fechamento mensal",
    subtitle: "Resumo executivo para acompanhamento e prestacao de contas.",
  },
  "/admin/usuarios": {
    title: "Administracao de usuarios",
    subtitle: "Acessos, perfis e governanca das lojas em um unico lugar.",
  },
  "/gerenciamento": {
    title: "Gerencial",
    subtitle: "Cadastros, historico, permissoes e controle do sistema em uma central.",
  },
  "/configuracoes": {
    title: "Configuracoes",
    subtitle: "Preferencias visuais e ajustes da experiencia do sistema.",
  },
};

function resolvePageMeta(pathname: string) {
  const matchedEntry = Object.entries(routeMeta)
    .sort(([routeA], [routeB]) => routeB.length - routeA.length)
    .find(
    ([route]) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (matchedEntry) {
    return matchedEntry[1];
  }

  if (pathname.startsWith("/veiculos/")) {
    return {
      title: "Detalhes do veiculo",
      subtitle: "Historico, custos, manutencoes e movimentacao do ativo.",
    };
  }

  const fallback = sidebarItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  return {
    title: fallback?.label ?? "MM Frota",
    subtitle: "Sistema de gestao de frota do Grupo MM.",
  };
}

function getInitials(name?: string) {
  if (!name) return "MM";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return "MM";

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const pageMeta = resolvePageMeta(pathname);
  const roleLabel = user?.role === "admin" ? "Administrador" : "Operacao da loja";
  const storeLabel = user?.storeId || "Grupo MM";
  const userLabel = user?.name || "Equipe MM";
  const userInitials = getInitials(user?.name);

  const controlButtonClass =
    "h-9 rounded-xl border-blue-100 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-blue-400/20 dark:hover:bg-blue-500/10 dark:hover:text-blue-100";
  const mobileControlButtonClass =
    "h-8 w-8 rounded-xl border-blue-100 bg-white p-0 text-slate-700 shadow-none hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-blue-400/20 dark:hover:bg-blue-500/10 dark:hover:text-blue-100";

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  useEffect(() => {
    const routesToPrefetch =
      user?.role === "admin"
        ? [
            "/rotas",
            "/rotas/realizadas",
            "/abastecimentos",
            "/manutencoes",
            "/gerenciamento",
          ]
        : [
            "/rotas",
            "/rotas/realizadas",
            "/abastecimentos",
            "/manutencoes",
            "/gerenciamento",
          ];

    routesToPrefetch
      .filter((route) => route !== pathname)
      .forEach((route) => {
        router.prefetch(route);
      });
  }, [pathname, router, user?.role]);

  return (
    <>
    <header className="sticky top-0 z-40 -mx-1 bg-transparent pb-2 lg:hidden">
      <div className="relative overflow-hidden rounded-[22px] border border-blue-100/80 bg-white/90 px-3 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
        <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent dark:via-yellow-300/70" />
        <div className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-blue-100 bg-white text-[11px] font-semibold tracking-[0.18em] text-blue-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-yellow-200">
            MM
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <Truck className="h-3 w-3 shrink-0" />
              <span className="truncate">{storeLabel}</span>
            </p>
            <h2 className="mt-0.5 truncate text-[15px] font-semibold leading-tight text-slate-950 dark:text-white">
              {pageMeta.title}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className={mobileControlButtonClass}
              onClick={() => router.push("/configuracoes")}
              aria-label="Abrir configuracoes"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Button>

            <ThemeToggle compact className={mobileControlButtonClass} />

            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              className={mobileControlButtonClass}
              onClick={handleLogout}
              aria-label="Sair do sistema"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </header>

    <header className="sticky top-0 z-30 hidden bg-transparent pb-3 lg:block">
      <div className="app-panel-muted relative overflow-hidden px-4 py-3.5 md:px-5">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent dark:via-yellow-300/65" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.06),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.06),transparent_22%)]" />

        <div className="relative flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-blue-100 bg-white text-sm font-semibold tracking-[0.22em] text-blue-700 shadow-[0_10px_24px_rgba(37,99,235,0.1)] dark:border-white/10 dark:bg-slate-950/70 dark:text-yellow-200 sm:flex">
              MM
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300">
                  <ShieldCheck className="h-3 w-3" />
                  {roleLabel}
                </span>
                <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300 sm:inline-flex">
                  <Truck className="h-3 w-3" />
                  {storeLabel}
                </span>
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white md:text-[1.45rem]">
                  {pageMeta.title}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
            <div className="hidden items-center gap-3 rounded-[22px] border border-blue-100 bg-white/90 px-3.5 py-2.5 shadow-[0_10px_24px_rgba(37,99,235,0.06)] dark:border-white/10 dark:bg-slate-950/70 md:flex">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-blue-100 bg-white text-sm font-semibold text-blue-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-yellow-200">
                {userInitials}
              </div>

              <div className="min-w-[150px]">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {userLabel}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {storeLabel}
                </p>
              </div>
            </div>

            <div className="app-action-surface sm:w-auto sm:flex-nowrap">
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
    </>
  );
}
