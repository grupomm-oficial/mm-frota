"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Fuel,
  Map,
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

interface SidebarSection {
  id: string;
  label: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    id: "principal",
    label: "Menu principal",
    items: [
      { href: "/rotas", label: "Rotas", icon: Map },
      { href: "/abastecimentos", label: "Abastecimento", icon: Fuel },
      { href: "/manutencoes", label: "Manutencoes", icon: Wrench },
      { href: "/gerenciamento", label: "Gerencial", icon: BarChart3 },
    ],
  },
];

export const sidebarItems: SidebarItem[] = sidebarSections.flatMap(
  (section) => section.items
);

function getVisibleSidebarSections(role?: string) {
  return sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || role === "admin"),
    }))
    .filter((section) => section.items.length > 0);
}

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

  if (mobile) {
    return (
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-3 rounded-[24px] border px-3.5 py-3.5 text-sm font-medium transition-all duration-200",
          active
            ? "border-transparent bg-slate-950 text-white shadow-[0_18px_34px_rgba(15,23,42,0.2)] dark:bg-white dark:text-slate-950"
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
              ? "border-white/12 bg-white/10 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-950"
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
          ? "bg-slate-950 text-white shadow-[0_14px_26px_rgba(15,23,42,0.12)] dark:bg-white dark:text-slate-950"
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
            ? "border-white/12 bg-white/10 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-950 dark:shadow-none"
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

  const visibleSections = getVisibleSidebarSections(user?.role);

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <div className="flex min-h-full flex-col">
        <div className="relative mb-6 shrink-0 overflow-hidden rounded-[36px] border border-blue-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))] px-6 py-7 text-slate-950 shadow-[0_24px_50px_rgba(37,99,235,0.12)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.92),rgba(14,14,16,0.98))] dark:text-white dark:shadow-[0_20px_40px_rgba(0,0,0,0.24)]">
          <div className="absolute inset-x-7 top-0 h-1 rounded-full bg-blue-500/80 dark:bg-yellow-300/90" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.08),transparent_26%),linear-gradient(135deg,transparent,rgba(255,255,255,0.05))] dark:bg-[radial-gradient(circle_at_top_right,rgba(250,204,21,0.12),transparent_26%)]" />
          <div className="absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-blue-500/10 blur-3xl dark:bg-white/10" />

          <div className="relative flex min-h-[176px] flex-col items-center justify-center gap-5 text-center">
            <div className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-[28px] border-2 border-blue-100 bg-white shadow-[0_16px_30px_rgba(15,23,42,0.08)] dark:border-yellow-300/30 dark:bg-white/5 dark:shadow-[0_16px_30px_rgba(15,23,42,0.16)]">
              <Image
                src="/mm-frota-logo.png"
                alt="Grupo MM"
                fill
                sizes="92px"
                className="object-contain p-3.5"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <h1 className="text-[1.5rem] font-semibold leading-[1.05] tracking-tight text-slate-950 dark:text-white">
                Gestao de Frota
              </h1>
              <p className="text-sm font-medium tracking-[0.1em] text-blue-700 dark:text-blue-100/90">
                Grupo MM
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          {visibleSections.map((section) => (
            <section
              key={section.id}
              className="rounded-[30px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,246,255,0.88))] p-4 shadow-[0_16px_36px_rgba(37,99,235,0.08)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.9),rgba(14,14,16,0.96))] dark:shadow-[0_18px_38px_rgba(0,0,0,0.26)]"
            >
              <div className="flex items-center gap-3 px-1 pb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
                  {section.label}
                </p>
                <div className="h-px flex-1 bg-blue-100 dark:bg-white/10" />
              </div>

              <nav className="space-y-2.5">
                {section.items.map((item) => (
                  <SidebarLink key={item.href} {...item} mobile />
                ))}
              </nav>
            </section>
          ))}
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
                    {user.role === "admin" ? "Administrador" : "Loja"}
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

  const visibleSections = getVisibleSidebarSections(user?.role);

  return (
    <div className="flex h-full flex-col">
      <div className="rounded-[28px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.9))] px-4 py-4 shadow-[0_16px_32px_rgba(37,99,235,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.9),rgba(14,14,16,0.96))] dark:shadow-[0_18px_34px_rgba(0,0,0,0.26)]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border-2 border-blue-100 bg-white shadow-[0_12px_24px_rgba(37,99,235,0.14)] dark:border-white/10 dark:bg-slate-950/70 dark:shadow-none">
            <Image
              src="/mm-frota-logo.png"
              alt="Grupo MM"
              fill
              sizes="56px"
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
        {visibleSections.map((section) => (
          <section key={section.id} className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.18em]",
                  section.id === "sistema"
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-blue-700 dark:text-yellow-200"
                )}
              >
                {section.label}
              </p>
              <div className="h-px flex-1 bg-blue-100 dark:bg-white/10" />
            </div>

            <nav className="space-y-1.5">
              {section.items.map((item) => (
                <SidebarLink key={item.href} {...item} />
              ))}
            </nav>
          </section>
        ))}
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
                {user.role === "admin" ? "Administrador" : "Loja"}
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
