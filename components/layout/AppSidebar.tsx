"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Car,
  Fuel,
  LayoutDashboard,
  Map,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const sidebarItems: SidebarItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/veiculos", label: "Veiculos", icon: Car },
  { href: "/motoristas", label: "Motoristas", icon: Users },
  { href: "/rotas", label: "Rotas", icon: Map },
  { href: "/abastecimentos", label: "Abastecimentos", icon: Fuel },
  { href: "/manutencoes", label: "Manutencoes", icon: Wrench },
  { href: "/relatorios", label: "Relatorios", icon: BarChart3 },
  { href: "/admin/usuarios", label: "Usuarios", icon: ShieldCheck, adminOnly: true },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings2 },
];

const systemRoutes = new Set(["/admin/usuarios", "/configuracoes"]);

function getInitials(name?: string) {
  if (!name) return "MM";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "MM";

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  mobile = false,
}: SidebarItem & { mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  if (mobile) {
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-3 rounded-[24px] border px-3.5 py-3.5 text-sm font-medium transition-all duration-200",
          active
            ? "border-transparent bg-[linear-gradient(180deg,#1451d8,#0f43b8)] text-white shadow-[0_18px_34px_rgba(20,81,216,0.28)]"
            : "border-blue-100/80 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/80 hover:text-blue-700 dark:border-white/10 dark:bg-slate-950/55 dark:text-slate-300 dark:hover:border-yellow-400/15 dark:hover:bg-slate-950 dark:hover:text-white"
        )}
      >
        {active ? (
          <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-yellow-300" />
        ) : null}

        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[18px] border transition",
            active
              ? "border-white/12 bg-white/10 text-white"
              : "border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.88))] text-slate-500 group-hover:border-blue-200 group-hover:bg-white group-hover:text-blue-700 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-400 dark:group-hover:border-yellow-400/15 dark:group-hover:bg-slate-950 dark:group-hover:text-yellow-100"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <span className="flex-1 truncate font-semibold tracking-tight">{label}</span>

        {active ? (
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-300 shadow-[0_0_0_4px_rgba(253,224,71,0.14)]" />
        ) : null}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-[20px] px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-blue-50 text-blue-700 dark:bg-[linear-gradient(180deg,#1451d8,#0f43b8)] dark:text-white dark:shadow-[0_18px_30px_rgba(20,81,216,0.24)]"
          : "text-slate-600 hover:bg-blue-50/80 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
      )}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-yellow-300" />
      ) : null}

      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[16px] border transition",
          active
            ? "border-blue-100 bg-white text-blue-700 shadow-[0_8px_18px_rgba(37,99,235,0.12)] dark:border-white/12 dark:bg-white/10 dark:text-white dark:shadow-none"
            : "border-transparent bg-transparent text-slate-400 group-hover:border-blue-100 group-hover:bg-white group-hover:text-blue-700 dark:group-hover:border-white/10 dark:group-hover:bg-slate-950/70 dark:group-hover:text-yellow-100"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <span className="flex-1 truncate font-medium tracking-tight">{label}</span>

      {active ? <span className="h-2 w-2 rounded-full bg-yellow-300" /> : null}
    </Link>
  );
}

function MobileSidebarContent() {
  const { user } = useAuth();

  const visibleItems = sidebarItems.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );
  const primaryItems = visibleItems.filter((item) => !systemRoutes.has(item.href));
  const systemItems = visibleItems.filter((item) => systemRoutes.has(item.href));

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <div className="flex min-h-full flex-col">
        <div className="relative mb-6 shrink-0 overflow-hidden rounded-[36px] border border-blue-600/10 bg-[linear-gradient(180deg,#1451d8_0%,#1451d8_46%,#0f43b8_100%)] px-6 py-7 text-white shadow-[0_24px_50px_rgba(20,81,216,0.26)]">
          <div className="absolute inset-x-7 top-0 h-1 rounded-full bg-yellow-300/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_26%),linear-gradient(135deg,transparent,rgba(255,255,255,0.05))]" />
          <div className="absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex min-h-[176px] flex-col items-center justify-center gap-5 text-center">
            <div className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-[28px] border-2 border-yellow-300/90 bg-white/5 shadow-[0_16px_30px_rgba(15,23,42,0.16)]">
              <Image
                src="/mm-frota-logo.png"
                alt="Grupo MM"
                fill
                className="object-contain p-3.5"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <h1 className="text-[1.5rem] font-semibold leading-[1.05] tracking-tight text-white">
                Gestao de Frota
              </h1>
              <p className="text-sm font-medium tracking-[0.1em] text-blue-100/90">
                Grupo MM
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <section className="rounded-[30px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.88))] p-4 shadow-[0_16px_36px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.9),rgba(14,14,16,0.96))] dark:shadow-[0_18px_38px_rgba(0,0,0,0.26)]">
            <div className="flex items-center gap-3 px-1 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
                Navegacao
              </p>
              <div className="h-px flex-1 bg-blue-100 dark:bg-white/10" />
            </div>

            <nav className="space-y-2.5">
              {primaryItems.map((item) => (
                <SidebarLink key={item.href} {...item} mobile />
              ))}
            </nav>
          </section>

          {systemItems.length > 0 ? (
            <section className="rounded-[30px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.88))] p-4 shadow-[0_16px_36px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.9),rgba(14,14,16,0.96))] dark:shadow-[0_18px_38px_rgba(0,0,0,0.26)]">
              <div className="flex items-center gap-3 px-1 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
                  Sistema
                </p>
                <div className="h-px flex-1 bg-blue-100 dark:bg-white/10" />
              </div>

              <nav className="space-y-2.5">
                {systemItems.map((item) => (
                  <SidebarLink key={item.href} {...item} mobile />
                ))}
              </nav>
            </section>
          ) : null}
        </div>

        {user ? (
          <div className="mt-6 shrink-0 rounded-[30px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.88))] p-4 shadow-[0_16px_36px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.9),rgba(14,14,16,0.96))] dark:shadow-[0_18px_38px_rgba(0,0,0,0.26)]">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-blue-100 bg-white text-sm font-semibold tracking-[0.16em] text-blue-700 dark:border-yellow-400/10 dark:bg-slate-950/75 dark:text-yellow-200">
                {getInitials(user.name)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {user.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {user.storeId || "Grupo MM"}
                    </p>
                  </div>

                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200">
                    {user.role === "admin" ? "Admin" : "Operacao"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DesktopSidebarContent() {
  const { user } = useAuth();

  const visibleItems = sidebarItems.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );
  const primaryItems = visibleItems.filter((item) => !systemRoutes.has(item.href));
  const systemItems = visibleItems.filter((item) => systemRoutes.has(item.href));

  return (
    <div className="flex h-full flex-col">
      <div className="rounded-[28px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.9))] px-4 py-4 shadow-[0_16px_32px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.9),rgba(14,14,16,0.96))] dark:shadow-[0_18px_34px_rgba(0,0,0,0.26)]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border-2 border-yellow-300/90 bg-[linear-gradient(180deg,#1451d8,#0f43b8)] shadow-[0_12px_24px_rgba(20,81,216,0.2)]">
            <Image
              src="/mm-frota-logo.png"
              alt="Grupo MM"
              fill
              className="object-contain p-2.5"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-yellow-200">
              Grupo MM
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Gestao de Frota
            </h1>
          </div>
        </div>
      </div>

      <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-blue-100 to-transparent dark:via-white/10" />

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
              Navegacao
            </p>
            <div className="h-px flex-1 bg-blue-100 dark:bg-white/10" />
          </div>

          <nav className="space-y-1.5">
            {primaryItems.map((item) => (
              <SidebarLink key={item.href} {...item} />
            ))}
          </nav>
        </section>

        {systemItems.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Sistema
              </p>
              <div className="h-px flex-1 bg-blue-100 dark:bg-white/10" />
            </div>

            <nav className="space-y-1.5">
              {systemItems.map((item) => (
                <SidebarLink key={item.href} {...item} />
              ))}
            </nav>
          </section>
        ) : null}
      </div>

      {user ? (
        <div className="mt-auto pt-6">
          <div className="rounded-[24px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-3.5 py-3.5 shadow-[0_14px_30px_rgba(37,99,235,0.06)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.92),rgba(12,12,14,0.98))] dark:shadow-[0_16px_30px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-blue-100 bg-white text-sm font-semibold tracking-[0.16em] text-blue-700 dark:border-yellow-400/10 dark:bg-slate-950/70 dark:text-yellow-200">
                {getInitials(user.name)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                  {user.storeId || "Grupo MM"}
                </p>
              </div>

              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200">
                {user.role === "admin" ? "Admin" : "Operacao"}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppSidebar({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <aside className="h-full w-full bg-transparent p-2">
        <div className="app-panel h-full min-h-0 p-5 md:p-6">
          <MobileSidebarContent />
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-screen w-[312px] shrink-0 bg-transparent p-4 xl:w-[324px]">
      <div className="app-panel sticky top-4 flex h-[calc(100vh-2rem)] min-h-0 flex-col p-5">
        <DesktopSidebarContent />
      </div>
    </aside>
  );
}
