"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Car,
  Fuel,
  History,
  ShieldCheck,
  Users2,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface GerencialModule {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  tag: string;
  adminOnly?: boolean;
}

const gerencialModules: GerencialModule[] = [
  {
    title: "Veiculos",
    href: "/veiculos",
    icon: Car,
    description: "Cadastro da frota, responsaveis, loja, status e quilometragem atual.",
    tag: "Cadastro",
  },
  {
    title: "Motoristas",
    href: "/motoristas",
    icon: Users2,
    description: "Equipe habilitada para operar as rotas e vinculos por unidade.",
    tag: "Cadastro",
  },
  {
    title: "Abastecimentos",
    href: "/abastecimentos",
    icon: Fuel,
    description: "Consumo, custos e registros de combustivel em uma tela limpa.",
    tag: "Operacao",
  },
  {
    title: "Manutencoes",
    href: "/manutencoes",
    icon: Wrench,
    description: "Oficina, indisponibilidades, custos e conclusao dos servicos.",
    tag: "Operacao",
  },
  {
    title: "Rotas realizadas",
    href: "/rotas/realizadas",
    icon: History,
    description: "Historico completo, filtros e conferencia das rotas encerradas.",
    tag: "Historico",
  },
  {
    title: "Usuarios e permissoes",
    href: "/admin/usuarios",
    icon: ShieldCheck,
    description: "Acessos, perfis, lojas, usuarios ativos e troca obrigatoria de senha.",
    tag: "Admin",
    adminOnly: true,
  },
  {
    title: "Relatorios",
    href: "/relatorios",
    icon: BarChart3,
    description: "Indicadores, fechamento mensal e leitura gerencial da operacao.",
    tag: "Admin",
    adminOnly: true,
  },
];

export default function GerenciamentoPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const HeaderIcon = isAdmin ? ShieldCheck : BarChart3;

  return (
    <div className="app-page">
      <PageHeader
        eyebrow={isAdmin ? "Central administrativa" : "Central gerencial"}
        title="Gerencial"
        description="Cadastros, historico, configuracoes e administracao reunidos em uma unica area para o sistema ficar mais limpo."
        icon={HeaderIcon}
        badges={
          <>
            <span className="app-chip">
              <Car className="h-3.5 w-3.5" />
              Cadastros
            </span>
            <span className="app-chip">
              <History className="h-3.5 w-3.5" />
              Historico
            </span>
            {isAdmin ? (
              <span className="app-chip">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </span>
            ) : (
              <span className="app-chip">
                <Fuel className="h-3.5 w-3.5" />
                Operacao
              </span>
            )}
          </>
        }
        actions={
          isAdmin ? (
            <Button asChild>
              <Link href="/admin/usuarios">
                Gerenciar usuarios
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/veiculos">
                Abrir veiculos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )
        }
      />

      <Card className="app-toolbar-shell gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="app-inline-stat">
            <p className="app-inline-stat-label">Cadastros</p>
            <p className="app-inline-stat-value text-base">Veiculos e motoristas</p>
          </div>
          <div className="app-inline-stat">
            <p className="app-inline-stat-label">Operacao</p>
            <p className="app-inline-stat-value text-base">Rotas, abastecimentos e manutencoes</p>
          </div>
          <div className="app-inline-stat">
            <p className="app-inline-stat-label">Acesso</p>
            <p className="app-inline-stat-value text-base">
              {isAdmin ? "Permissoes liberadas" : "Admin protegido"}
            </p>
          </div>
        </div>
      </Card>

      <div className="app-panel p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {gerencialModules.map((module) => {
            const Icon = module.icon;
            const locked = module.adminOnly && !isAdmin;

            const content = (
              <>
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-[18px] border border-blue-100 bg-blue-50 text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200",
                    locked &&
                      "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
                    {module.title}
                  </span>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300",
                      locked &&
                        "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
                    )}
                  >
                    {locked ? "Somente admin" : module.tag}
                  </span>
                </span>

                {!locked ? (
                  <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition group-hover:translate-x-0.5 group-hover:bg-blue-700 dark:bg-white dark:text-slate-950 dark:group-hover:bg-yellow-200">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                ) : null}
              </>
            );

            if (locked) {
              return (
                <Button
                  key={module.href}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[86px] w-full justify-start gap-3 whitespace-normal rounded-[24px] border-dashed p-4 text-left"
                  title={module.description}
                  disabled
                >
                  {content}
                </Button>
              );
            }

            return (
              <Button
                key={module.href}
                asChild
                variant="outline"
                className="group h-auto min-h-[86px] w-full justify-start gap-3 whitespace-normal rounded-[24px] p-4 text-left hover:border-blue-300/70 hover:bg-white dark:hover:border-yellow-400/20 dark:hover:bg-white/[0.04]"
              >
                <Link href={module.href} aria-label={`Abrir ${module.title}: ${module.description}`}>
                  {content}
                </Link>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
