"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Car,
  Fuel,
  Wrench,
  Map as MapIcon,
  Users,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// ======== TIPAGENS ========

interface VehicleResponsibleUser {
  id: string;
  name: string;
  storeId?: string;
}

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  status: "disponivel" | "em_rota" | "manutencao";
  currentKm?: number;

  // campos antigos (pra manter compatibilidade)
  responsibleUserId?: string;
  responsibleUserName?: string;

  // NOVOS CAMPOS: múltiplos responsáveis
  responsibleUserIds: string[];
  responsibleUsers: VehicleResponsibleUser[];
}

interface RouteItem {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverName: string;
  origem?: string | null;
  destino?: string | null;
  startKm: number;
  startAt?: string | null;
  status: "em_andamento" | "finalizada";
}

interface Fueling {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  storeId: string;
  date: string;
  liters: number;
  pricePerL: number;
  total: number;
}

interface Maintenance {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  storeId: string;
  date: string;
  type: string;
  cost: number;
  status: "em_andamento" | "concluida";
}

interface Driver {
  id: string;
  name: string;
  storeId: string;
  responsibleUserId: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [fuelings, setFuelings] = useState<Fueling[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    async function loadAll() {
      if (!user) return;

      try {
        setLoading(true);
        setErrorMsg("");

        // ===== Veículos =====
        let vehiclesSnap;
        if (isAdmin) {
          // Admin vê todos
          vehiclesSnap = await getDocs(collection(db, "vehicles"));
        } else {
          // Usuário comum vê veículos em que ele é um dos responsáveis
          vehiclesSnap = await getDocs(
            query(
              collection(db, "vehicles"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        const vList: Vehicle[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;

          // Compatibilidade: se já existir array de responsáveis, usa;
          // senão, monta a partir de responsibleUserId / responsibleUserName
          const responsibleUsersFromDoc: VehicleResponsibleUser[] =
            Array.isArray(data.responsibleUsers) && data.responsibleUsers.length
              ? data.responsibleUsers
              : data.responsibleUserId && data.responsibleUserName
              ? [
                  {
                    id: data.responsibleUserId,
                    name: data.responsibleUserName,
                    storeId: data.storeId,
                  },
                ]
              : [];

          const responsibleUserIdsFromDoc: string[] =
            Array.isArray(data.responsibleUserIds) &&
            data.responsibleUserIds.length
              ? data.responsibleUserIds
              : responsibleUsersFromDoc.map((u) => u.id);

          const primaryName =
            data.responsibleUserName ||
            (responsibleUsersFromDoc[0]?.name ?? "");

          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            status: data.status ?? "disponivel",
            currentKm: data.currentKm,
            // antigos
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: primaryName,
            // novos
            responsibleUserIds: responsibleUserIdsFromDoc,
            responsibleUsers: responsibleUsersFromDoc,
          };
        });
        setVehicles(vList);

        // ===== Rotas =====
        let routesSnap;
        if (isAdmin) {
          routesSnap = await getDocs(collection(db, "routes"));
        } else {
          // Usuário vê rotas dos veículos em que ele é um dos responsáveis
          routesSnap = await getDocs(
            query(
              collection(db, "routes"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        const rList: RouteItem[] = routesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            driverName: data.driverName,
            origem: data.origem ?? null,
            destino: data.destino ?? null,
            startKm: data.startKm,
            startAt: data.startAt ?? null,
            status: data.status ?? "em_andamento",
          };
        });
        setRoutes(rList);

        // ===== Abastecimentos =====
        let fuelingsSnap;
        if (isAdmin) {
          fuelingsSnap = await getDocs(
            query(collection(db, "fuelings"), orderBy("date", "desc"))
          );
        } else {
          // Usuário vê abastecimentos dos veículos em que ele é um dos responsáveis
          fuelingsSnap = await getDocs(
            query(
              collection(db, "fuelings"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        let fList: Fueling[] = fuelingsSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            storeId: data.storeId,
            date: data.date,
            liters: Number(data.liters || 0),
            pricePerL: Number(data.pricePerL || 0),
            total: Number(data.total || 0),
          };
        });

        if (!isAdmin) {
          fList = fList.sort((a, b) =>
            (b.date || "").localeCompare(a.date || "")
          );
        }
        setFuelings(fList);

        // ===== Manutenções =====
        let maintSnap;
        if (isAdmin) {
          maintSnap = await getDocs(
            query(collection(db, "maintenances"), orderBy("date", "desc"))
          );
        } else {
          // Usuário vê manutenções dos veículos em que ele é um dos responsáveis
          maintSnap = await getDocs(
            query(
              collection(db, "maintenances"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        let mList: Maintenance[] = maintSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            storeId: data.storeId,
            date: data.date,
            type: data.type,
            cost: Number(data.cost || 0),
            status: data.status ?? "em_andamento",
          };
        });

        if (!isAdmin) {
          mList = mList.sort((a, b) =>
            (b.date || "").localeCompare(a.date || "")
          );
        }
        setMaintenances(mList);

        // ===== Motoristas =====
        let driversSnap;
        if (isAdmin) {
          driversSnap = await getDocs(collection(db, "drivers"));
        } else {
          driversSnap = await getDocs(
            query(
              collection(db, "drivers"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const dList: Driver[] = driversSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            storeId: data.storeId,
            responsibleUserId: data.responsibleUserId,
          };
        });
        setDrivers(dList);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        setErrorMsg("Erro ao carregar dados do dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [user, isAdmin]);

  if (!user) return null;

  // ===== Helpers de mês atual =====
  function isInCurrentMonth(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;

    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }

  // ===== Métricas gerais =====

  const totalVeiculos = vehicles.length;
  const veiculosEmRota = vehicles.filter((v) => v.status === "em_rota").length;
  const veiculosEmManutencao = vehicles.filter(
    (v) => v.status === "manutencao"
  ).length;
  const veiculosDisponiveis = vehicles.filter(
    (v) => v.status === "disponivel"
  ).length;

  const rotasEmAndamento = routes
    .filter((r) => r.status === "em_andamento")
    .sort((a, b) => (b.startAt || "").localeCompare(a.startAt || ""));

  const ultimasRotasEmAndamento = rotasEmAndamento.slice(0, 5);

  // Filtra abastecimentos do mês atual
  const fuelingsMes = useMemo(
    () => fuelings.filter((f) => isInCurrentMonth(f.date)),
    [fuelings]
  );

  const ultimosAbastecimentos = useMemo(
    () => fuelingsMes.slice(0, 5),
    [fuelingsMes]
  );

  // Manutenções: mês atual e em andamento
  const maintMes = useMemo(
    () => maintenances.filter((m) => isInCurrentMonth(m.date)),
    [maintenances]
  );

  const manutencoesEmAndamento = maintenances
    .filter((m) => m.status === "em_andamento")
    .slice(0, 5);

  const qtdManutencoesEmAndamento = useMemo(
    () => maintenances.filter((m) => m.status === "em_andamento").length,
    [maintenances]
  );

  // ===== Gasto mensal com combustível e manutenção (para ADMIN) =====
  const monthlyTotals = useMemo(() => {
    if (fuelings.length === 0 && maintenances.length === 0) return [];

    const map = new Map<string, { fuel: number; maint: number }>();

    // Abastecimentos
    fuelings.forEach((f) => {
      if (!f.date) return;
      const d = new Date(f.date);
      if (Number.isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;

      const current = map.get(key) ?? { fuel: 0, maint: 0 };
      current.fuel += Number(f.total || 0);
      map.set(key, current);
    });

    // Manutenções
    maintenances.forEach((m) => {
      if (!m.date) return;
      const d = new Date(m.date);
      if (Number.isNaN(d.getTime())) return;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;

      const current = map.get(key) ?? { fuel: 0, maint: 0 };
      current.maint += Number(m.cost || 0);
      map.set(key, current);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        const [year, month] = key.split("-");
        const label = `${month}/${year.slice(2)}`; // ex: 03/25
        return {
          monthKey: key,
          label,
          fuelTotal: value.fuel,
          maintTotal: value.maint,
        };
      });
  }, [fuelings, maintenances]);

  const lastMonthTotals = useMemo(() => {
    if (monthlyTotals.length === 0) return null;
    const last = monthlyTotals[monthlyTotals.length - 1];
    return {
      label: last.label,
      fuel: last.fuelTotal,
      maint: last.maintTotal,
    };
  }, [monthlyTotals]);

  return (
    <div className="space-y-6">
      {/* ====================== MODO ADMIN ====================== */}
      {isAdmin ? (
        <>
          {/* Painel frontal ADMIN */}
          <Card className="relative overflow-hidden border border-neutral-800 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950">
            <div className="absolute inset-y-0 right-0 w-40 bg-yellow-500/5 blur-3xl pointer-events-none" />
            <div className="relative p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-yellow-400/80">
                  Painel geral · MM Frota
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Visão em tempo real da frota do Grupo MM
                </h1>
                <p className="text-sm text-gray-300 max-w-2xl">
                  Acompanhe veículos em rota, manutenções em andamento e o
                  histórico financeiro da frota. Valores de combustível e
                  manutenções podem ser analisados mês a mês na linha do tempo.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/80 border border-neutral-700 px-3 py-1 text-[11px] text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    {veiculosEmRota} veículo(s) em rota
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/80 border border-neutral-700 px-3 py-1 text-[11px] text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    {veiculosEmManutencao} em manutenção
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/80 border border-neutral-700 px-3 py-1 text-[11px] text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    {fuelingsMes.length} abastecimento(s) neste mês
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end gap-2">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-gray-400">
                    Usuário:{" "}
                    <span className="font-semibold text-gray-100">
                      {user?.name}
                    </span>{" "}
                    <span className="ml-2 rounded-full bg-yellow-500/10 border border-yellow-500/40 px-2 py-[2px] text-[10px] font-semibold text-yellow-300">
                      ADMIN
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-500">
                    Use o menu lateral para navegar ou os atalhos abaixo para
                    relatórios e veículos.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold"
                    onClick={() => router.push("/relatorios")}
                  >
                    Ver relatórios completos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-neutral-700 text-gray-200 hover:bg-neutral-800 text-xs font-semibold"
                    onClick={() => router.push("/veiculos")}
                  >
                    Abrir lista de veículos
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {errorMsg && (
            <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
          )}

          {/* Cards principais ADMIN */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Veículos cadastrados
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {totalVeiculos}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {veiculosDisponiveis} disponíveis para uso
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Car className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Rotas em andamento
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {rotasEmAndamento.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {veiculosEmRota} veículo(s) atualmente em rota
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <MapIcon className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Manutenções
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {veiculosEmManutencao}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {qtdManutencoesEmAndamento} manutenção(ões) em andamento
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Wrench className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Abastecimentos · mês atual
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {fuelingsMes.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Registros de abastecimento neste mês
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Fuel className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>
          </div>

          {/* Resumo do responsável */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Users className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Resumo do usuário
                </p>
                <p className="text-sm text-gray-200">
                  Você está logado como{" "}
                  <span className="font-semibold text-yellow-400">ADMIN</span>{" "}
                  e tem acesso à frota completa do Grupo MM.
                </p>
              </div>
            </div>
          </Card>

          {/* Gráfico de linha ADMIN */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Fuel className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-100">
                    Gasto mensal · Combustível x Manutenção
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Cada ponto representa a soma de todos os abastecimentos e
                    manutenções daquele mês.
                  </p>
                </div>
              </div>
            </div>

            {monthlyTotals.length === 0 ? (
              <p className="text-sm text-gray-400">
                Ainda não há dados suficientes para montar o gráfico mensal.
              </p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthlyTotals}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#111827"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#9CA3AF" }}
                        width={70}
                      />
                      <Tooltip
                        formatter={(value: any, _name, entry: any) => {
                          const key = entry?.dataKey as string;
                          const label =
                            key === "fuelTotal"
                              ? "Combustível"
                              : "Manutenção";
                          return [
                            `R$ ${Number(value || 0).toFixed(2)}`,
                            label,
                          ];
                        }}
                        labelFormatter={(label) => `Mês: ${label}`}
                        contentStyle={{
                          backgroundColor: "#020617",
                          border: "1px solid #374151",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#E5E7EB",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fuelTotal"
                        name="Combustível"
                        stroke="#FACC15"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                          stroke: "#FACC15",
                          fill: "#020617",
                        }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="maintTotal"
                        name="Manutenção"
                        stroke="#38BDF8"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                          stroke: "#38BDF8",
                          fill: "#020617",
                        }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {lastMonthTotals && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950 border border-neutral-800 px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      Último mês ({lastMonthTotals.label}) · Combustível:{" "}
                      <span className="text-yellow-300 font-semibold">
                        R$ {lastMonthTotals.fuel.toFixed(2)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950 border border-neutral-800 px-3 py-1">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      Manutenção:{" "}
                      <span className="text-sky-300 font-semibold">
                        R$ {lastMonthTotals.maint.toFixed(2)}
                      </span>
                    </span>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Detalhes operacionais ADMIN */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Rotas em andamento */}
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Activity className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-100">
                  Rotas em andamento
                </h2>
              </div>

              {loading ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : ultimasRotasEmAndamento.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhuma rota em andamento no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {ultimasRotasEmAndamento.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {r.vehiclePlate} · {r.vehicleModel}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          Motorista:{" "}
                          <span className="text-gray-200">
                            {r.driverName || "-"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {r.origem ?? "-"} → {r.destino ?? "-"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          Início:{" "}
                          {r.startAt
                            ? new Date(r.startAt).toLocaleTimeString(
                                "pt-BR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "-"}
                        </p>
                        <p className="text-xs text-gray-400">
                          KM inicial:{" "}
                          <span className="font-mono text-gray-100">
                            {r.startKm} km
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Últimos abastecimentos do mês */}
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Fuel className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-100">
                  Últimos abastecimentos · mês atual
                </h2>
              </div>

              {loading ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : ultimosAbastecimentos.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhum abastecimento registrado neste mês.
                </p>
              ) : (
                <div className="space-y-2">
                  {ultimosAbastecimentos.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {f.vehiclePlate} · {f.vehicleModel}
                        </p>
                        <p className="text-xs text-gray-400">{f.storeId}</p>
                        <p className="text-xs text-gray-500">
                          {f.date
                            ? new Date(f.date).toLocaleString("pt-BR")
                            : "-"}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-gray-400">
                          {Number(f.liters || 0).toFixed(2)} L × R${" "}
                          {Number(f.pricePerL || 0).toFixed(2)}
                        </p>
                        <p className="font-semibold text-yellow-300">
                          R$ {Number(f.total || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Manutenções em andamento */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Wrench className="w-4 h-4 text-yellow-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-100">
                Manutenções em andamento
              </h2>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Carregando...</p>
            ) : manutencoesEmAndamento.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum veículo em manutenção no momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-neutral-800 text-gray-400">
                      <th className="py-2 pr-2">Data</th>
                      <th className="py-2 px-2">Veículo</th>
                      <th className="py-2 px-2">Loja</th>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2">Custo (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manutencoesEmAndamento.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-neutral-900 hover:bg-neutral-800/60"
                      >
                        <td className="py-2 pr-2">
                          {m.date
                            ? new Date(m.date).toLocaleString("pt-BR")
                            : "-"}
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {m.vehiclePlate} · {m.vehicleModel}
                        </td>
                        <td className="py-2 px-2">{m.storeId}</td>
                        <td className="py-2 px-2">{m.type}</td>
                        <td className="py-2 px-2 text-yellow-300">
                          R$ {Number(m.cost || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        /* ====================== MODO OPERADOR / USER ====================== */
        <>
          {/* Painel frontal OPERADOR */}
          <Card className="relative overflow-hidden border border-neutral-800 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950">
            <div className="absolute inset-y-0 right-0 w-40 bg-yellow-500/5 blur-3xl pointer-events-none" />
            <div className="relative p-5 md:p-6 flex flex-col gap-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-yellow-400/80">
                  Área do motorista / responsável
                </p>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Olá, {user.name}! Vamos cuidar da frota hoje?
                </h1>
                <p className="text-sm text-gray-300 max-w-2xl">
                  Aqui você vê os veículos que estão sob sua responsabilidade,
                  as rotas em andamento e os registros deste mês dos veículos
                  que você compartilha com outros responsáveis.
                </p>
              </div>

              {/* Botões de ação rápida */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  className="w-full h-11 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold flex items-center justify-center gap-2"
                  onClick={() => router.push("/rotas")}
                >
                  <MapIcon className="w-4 h-4" />
                  Iniciar rota
                </Button>
                <Button
                  className="w-full h-11 bg-neutral-900 border border-yellow-500/60 hover:bg-neutral-800 text-yellow-300 text-sm font-semibold flex items-center justify-center gap-2"
                  onClick={() => router.push("/abastecimentos")}
                >
                  <Fuel className="w-4 h-4" />
                  Registrar abastecimento
                </Button>
                <Button
                  className="w-full h-11 bg-neutral-900 border border-sky-500/60 hover:bg-neutral-800 text-sky-300 text-sm font-semibold flex items-center justify-center gap-2"
                  onClick={() => router.push("/manutencoes")}
                >
                  <Wrench className="w-4 h-4" />
                  Registrar manutenção
                </Button>
              </div>

              {/* Chips rápidos */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/80 border border-neutral-700 px-3 py-1 text-[11px] text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {rotasEmAndamento.length} rota(s) em andamento
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/80 border border-neutral-700 px-3 py-1 text-[11px] text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  {vehicles.length} veículo(s) sob sua responsabilidade
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-950/80 border border-neutral-700 px-3 py-1 text-[11px] text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  {fuelingsMes.length} abastecimento(s) neste mês
                </span>
              </div>
            </div>
          </Card>

          {errorMsg && (
            <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
          )}

          {/* Cards principais OPERADOR */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Meus veículos
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {vehicles.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {veiculosDisponiveis} disponíveis · {veiculosEmRota} em rota
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Car className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Rotas em andamento
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {rotasEmAndamento.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Qualquer responsável pode finalizar as rotas em comum.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <MapIcon className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Abastecimentos · mês atual
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {fuelingsMes.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Registros deste mês dos veículos sob sua responsabilidade.
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Fuel className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>
          </div>

          {/* Bloco "minhas atividades" */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Users className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Resumo do seu dia
                </p>
                <p className="text-sm text-gray-200">
                  Você é responsável por{" "}
                  <span className="font-semibold text-yellow-400">
                    {vehicles.length} veículo(s)
                  </span>{" "}
                  e tem{" "}
                  <span className="font-semibold text-yellow-400">
                    {rotasEmAndamento.length} rota(s)
                  </span>{" "}
                  em andamento agora (podendo finalizar rotas iniciadas pelos
                  outros responsáveis).
                </p>
              </div>
            </div>
          </Card>

          {/* Listas de operação do operador */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Minhas rotas em andamento */}
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Activity className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-100">
                  Minhas rotas em andamento
                </h2>
              </div>

              {loading ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : ultimasRotasEmAndamento.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhuma rota em andamento no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {ultimasRotasEmAndamento.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {r.vehiclePlate} · {r.vehicleModel}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          Origem: {r.origem ?? "-"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Destino: {r.destino ?? "-"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          Início:{" "}
                          {r.startAt
                            ? new Date(r.startAt).toLocaleTimeString(
                                "pt-BR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "-"}
                        </p>
                        <p className="text-xs text-gray-400">
                          KM inicial:{" "}
                          <span className="font-mono text-gray-100">
                            {r.startKm} km
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Meus últimos abastecimentos do mês */}
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Fuel className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-100">
                  Meus últimos abastecimentos · mês atual
                </h2>
              </div>

              {loading ? (
                <p className="text-sm text-gray-400">Carregando...</p>
              ) : ultimosAbastecimentos.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhum abastecimento registrado por você neste mês.
                </p>
              ) : (
                <div className="space-y-2">
                  {ultimosAbastecimentos.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {f.vehiclePlate} · {f.vehicleModel}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {f.storeId}
                        </p>
                        <p className="text-xs text-gray-500">
                          {f.date
                            ? new Date(f.date).toLocaleString("pt-BR")
                            : "-"}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="text-gray-400">
                          {Number(f.liters || 0).toFixed(2)} L × R${" "}
                          {Number(f.pricePerL || 0).toFixed(2)}
                        </p>
                        <p className="font-semibold text-yellow-300">
                          R$ {Number(f.total || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Minhas manutenções em andamento */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Wrench className="w-4 h-4 text-yellow-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-100">
                Minhas manutenções em andamento
              </h2>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Carregando...</p>
            ) : manutencoesEmAndamento.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum veículo em manutenção no momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-neutral-800 text-gray-400">
                      <th className="py-2 pr-2">Data</th>
                      <th className="py-2 px-2">Veículo</th>
                      <th className="py-2 px-2">Loja</th>
                      <th className="py-2 px-2">Tipo</th>
                      <th className="py-2 px-2">Custo (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manutencoesEmAndamento.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-neutral-900 hover:bg-neutral-800/60"
                      >
                        <td className="py-2 pr-2">
                          {m.date
                            ? new Date(m.date).toLocaleString("pt-BR")
                            : "-"}
                        </td>
                        <td className="py-2 px-2 font-mono">
                          {m.vehiclePlate} · {m.vehicleModel}
                        </td>
                        <td className="py-2 px-2">{m.storeId}</td>
                        <td className="py-2 px-2">{m.type}</td>
                        <td className="py-2 px-2 text-yellow-300">
                          R$ {Number(m.cost || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}