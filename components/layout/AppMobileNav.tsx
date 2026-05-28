"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Fuel, Map, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const mobileItems = [
  { href: "/rotas", label: "Rotas", icon: Map },
  { href: "/abastecimentos", label: "Abastec.", icon: Fuel },
  { href: "/manutencoes", label: "Manut.", icon: Wrench },
  { href: "/gerenciamento", label: "Gerencial", icon: BarChart3 },
];

export function AppMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="app-mobile-safe fixed inset-x-2 bottom-1.5 z-40 lg:hidden">
      <div className="app-panel-muted mx-auto max-w-[430px] rounded-[22px] px-1.5 py-1.5 shadow-[0_16px_34px_rgba(15,23,42,0.14)]">
        <div
          className={cn(
            "grid gap-1",
            mobileItems.length === 5 ? "grid-cols-5" : "grid-cols-4"
          )}
        >
          {mobileItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/rotas"
                ? pathname === href || pathname.startsWith("/rotas/")
                : href === "/gerenciamento"
                ? pathname.startsWith("/gerenciamento") ||
                  pathname.startsWith("/cadastros") ||
                  pathname.startsWith("/veiculos") ||
                  pathname.startsWith("/motoristas") ||
                  pathname.startsWith("/relatorios") ||
                  pathname.startsWith("/admin")
                : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-0.5 rounded-[15px] px-1 py-1.5 text-center transition",
                  active
                    ? "bg-slate-950 text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)] dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-[12px] border transition",
                    active
                      ? "border-white/15 bg-white/12 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-950"
                      : "border-border bg-white text-slate-500 dark:bg-slate-950/40 dark:text-slate-400"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="truncate text-[9px] font-semibold leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
