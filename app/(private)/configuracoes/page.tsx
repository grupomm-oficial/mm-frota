"use client";

import { Palette, Settings2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Card } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  const { user } = useAuth();

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Preferencias"
        title="Configuracoes"
        description="Ajuste a aparencia do sistema para o dia a dia da operacao."
        icon={Settings2}
        badges={
          <span className="app-chip">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {user?.storeId ?? "Grupo MM"}
          </span>
        }
      />

      <Card className="app-panel p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
            <Palette className="h-5 w-5" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Aparencia do sistema
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Use o modo claro para uma leitura mais limpa no escritorio e ative
              o modo escuro quando preferir uma visualizacao com menos brilho.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <ThemeToggle />
        </div>
      </Card>
    </div>
  );
}
