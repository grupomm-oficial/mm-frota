"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Fuel, LayoutDashboard, Map, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const mobileItems = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/rotas", label: "Rotas", icon: Map },
  { href: "/veiculos", label: "Veiculos", icon: Car },
  { href: "/abastecimentos", label: "Custos", icon: Fuel },
  { href: "/manutencoes", label: "Oficina", icon: Wrench },
];

export function AppMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="app-mobile-safe fixed inset-x-3 bottom-3 z-40 lg:hidden">
      <div className="app-panel mx-auto max-w-xl px-2 py-2">
        <div className="grid grid-cols-5 gap-1">
          {mobileItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-center transition",
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl border transition",
                    active
                      ? "border-blue-100 bg-white text-blue-700 dark:border-blue-400/20 dark:bg-slate-950/50 dark:text-blue-200"
                      : "border-border bg-white text-slate-500 dark:bg-slate-950/40 dark:text-slate-400"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="truncate text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
