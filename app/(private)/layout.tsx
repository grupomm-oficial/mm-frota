"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppMobileNav } from "@/components/layout/AppMobileNav";
import { PageLoadingState } from "@/components/layout/PageLoadingState";
import { AppShellLoading } from "@/components/layout/AppShellLoading";
import { RouteTransitionOverlay } from "@/components/layout/RouteTransitionOverlay";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.mustChangePassword) {
      router.replace("/nova-senha");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user || user.mustChangePassword) {
      return;
    }

    const routesToPrefetch =
      user.role === "admin"
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

    routesToPrefetch.forEach((route) => {
      router.prefetch(route);
    });
  }, [loading, router, user]);

  if (loading || !user || user.mustChangePassword) {
    if (loading || !user) {
      return <AppShellLoading />;
    }

    return (
      <div className="app-shell px-4 py-6 md:px-6">
        <PageLoadingState
          title={
            user?.mustChangePassword
              ? "Redirecionando com seguranca"
              : "Carregando painel"
          }
          description={
            user?.mustChangePassword
              ? "Antes de seguir para o sistema, precisamos que voce defina uma nova senha de acesso."
              : "Estamos preparando os dados da sua operacao para abrir o sistema sem repetir cliques."
          }
          compact
        />
      </div>
    );
  }

  return (
    <div className="app-shell flex min-h-screen bg-transparent text-foreground">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 px-3 py-2 md:px-6 md:py-5">
            <div className="w-full space-y-4 pb-20 md:space-y-6 lg:pb-6">
              <AppHeader />
              {children}
            </div>
          </div>
        </main>
      </div>

      <AppMobileNav />
      <RouteTransitionOverlay />
    </div>
  );
}
