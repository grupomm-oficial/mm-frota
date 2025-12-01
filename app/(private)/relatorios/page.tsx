"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, Fuel, Wrench, Users } from "lucide-react";

export default function RelatoriosPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Relatórios
          </h1>
          <p className="text-sm text-gray-400">
            Visão consolidada da frota: gastos, consumo, rotas e desempenho por veículo e motorista.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Resumo mensal
              </p>
              <p className="text-sm text-gray-200">
                Gastos com combustível e manutenções no mês atual.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-yellow-500/10">
              <Fuel className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <Button
            className="mt-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold"
            variant="default"
            disabled
          >
            Em breve · Relatório mensal detalhado
          </Button>
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Por veículo
              </p>
              <p className="text-sm text-gray-200">
                Consumo médio, km rodados e gastos por veículo.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-yellow-500/10">
              <Car className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <Button
            className="mt-2 bg-neutral-900 border border-neutral-700 text-yellow-400 text-xs font-semibold hover:bg-neutral-800"
            onClick={() => router.push("/veiculos")}
          >
            Abrir lista de veículos
          </Button>
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Por motorista
              </p>
              <p className="text-sm text-gray-200">
                Rotas realizadas, veículos utilizados e gastos associados.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-yellow-500/10">
              <Users className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <Button
            className="mt-2 bg-neutral-900 border border-neutral-700 text-yellow-400 text-xs font-semibold hover:bg-neutral-800"
            disabled
          >
            Em breve · Relatório por motorista
          </Button>
        </Card>
      </div>
    </div>
  );
}