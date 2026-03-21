"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppMobileNav } from "@/components/layout/AppMobileNav";
import { PageLoadingState } from "@/components/layout/PageLoadingState";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="app-shell px-4 py-6 md:px-6">
        <PageLoadingState
          title="Carregando painel"
          description="Estamos preparando os dados da sua operacao para abrir o sistema sem repetir cliques."
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
          <div className="mx-auto flex w-full max-w-[1600px] flex-1 px-4 py-4 md:px-6 md:py-5">
            <div className="w-full space-y-6 pb-24 lg:pb-6">
              <AppHeader />
              {children}
            </div>
          </div>
        </main>
      </div>

      <AppMobileNav />
    </div>
  );
}
