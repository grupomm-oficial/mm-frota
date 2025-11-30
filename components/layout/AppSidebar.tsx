"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Car,
  Users,
  Map,
  Fuel,
  Wrench,
} from "lucide-react";
import Image from "next/image";

function NavItem({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: any;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors
      ${
        active
          ? "bg-yellow-500 text-black"
          : "text-gray-300 hover:bg-neutral-800 hover:text-yellow-400"
      }`}
    >
      <Icon
        className={active ? "w-4 h-4 text-black" : "w-4 h-4 text-yellow-400"}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppSidebar() {
  return (
    <aside
      className="
        h-screen w-60 md:w-64 
        bg-neutral-950 border-r border-neutral-800 
        flex flex-col p-4
      "
    >
      {/* TOPO COM LOGO */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center overflow-hidden">
          <Image
            src="/mm-frota-logo.png"
            alt="MM Frota"
            fill
            className="object-contain p-1"
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-yellow-400 leading-tight">
            MM Frota
          </span>
          <span className="text-[11px] text-gray-400">
            Gestão de Veículos · Grupo MM
          </span>
        </div>
      </div>

      {/* NAV ROLA SE FALTAR ESPAÇO (MELHOR EM TELAS PEQUENAS) */}
      <nav className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />
        <NavItem href="/admin/usuarios" icon={Users} label="Usuários" />
        <NavItem href="/veiculos" icon={Car} label="Veículos" />
        <NavItem href="/motoristas" icon={Users} label="Motoristas" />
        <NavItem href="/rotas" icon={Map} label="Rotas" />
        <NavItem
          href="/abastecimentos"
          icon={Fuel}
          label="Abastecimentos"
        />
        <NavItem
          href="/manutencoes"
          icon={Wrench}
          label="Manutenções"
        />
      </nav>

      {/* RODAPÉ */}
      <div className="mt-4 text-[11px] text-gray-500 border-t border-neutral-800 pt-3">
        <p>MM Frota · Versão inicial</p>
      </div>
    </aside>
  );
}