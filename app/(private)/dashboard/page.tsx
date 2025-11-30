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
import { Car, Fuel, Wrench, Map, Users, Activity } from "lucide-react";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  status: "disponivel" | "em_rota" | "manutencao";
  currentKm?: number;
  responsibleUserId: string;
  responsibleUserName: string;
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
          vehiclesSnap = await getDocs(collection(db, "vehicles"));
        } else {
          vehiclesSnap = await getDocs(
            query(
              collection(db, "vehicles"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const vList: Vehicle[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            status: data.status ?? "disponivel",
            currentKm: data.currentKm,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
          };
        });
        setVehicles(vList);

        // ===== Rotas =====
        let routesSnap;
        if (isAdmin) {
          routesSnap = await getDocs(collection(db, "routes"));
        } else {
          routesSnap = await getDocs(
            query(
              collection(db, "routes"),
              where("responsibleUserId", "==", user.id)
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
          // admin pode ordenar direto
          fuelingsSnap = await getDocs(
            query(collection(db, "fuelings"), orderBy("date", "desc"))
          );
        } else {
          // user: sem orderBy pra evitar erro de índice, ordena no front
          fuelingsSnap = await getDocs(
            query(
              collection(db, "fuelings"),
              where("responsibleUserId", "==", user.id)
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
            liters: data.liters,
            pricePerL: data.pricePerL,
            total: data.total,
          };
        });

        if (!isAdmin) {
          // ordena por data desc no front pro user
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
          maintSnap = await getDocs(
            query(
              collection(db, "maintenances"),
              where("responsibleUserId", "==", user.id)
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
            cost: data.cost,
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

  // ===== Métricas calculadas =====

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

  const totalGastoAbastecimentoMes = useMemo(
    () => fuelingsMes.reduce((acc, f) => acc + (f.total || 0), 0),
    [fuelingsMes]
  );

  const ultimosAbastecimentos = useMemo(
    () => fuelingsMes.slice(0, 5),
    [fuelingsMes]
  );

  // Manutenções: total do mês + em andamento (independente de mês)
  const maintMes = useMemo(
    () => maintenances.filter((m) => isInCurrentMonth(m.date)),
    [maintenances]
  );

  const totalGastoManutencaoMes = useMemo(
    () => maintMes.reduce((acc, m) => acc + (m.cost || 0), 0),
    [maintMes]
  );

  const manutencoesEmAndamento = maintenances
    .filter((m) => m.status === "em_andamento")
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Painel frontal */}
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
              Acompanhe veículos em rota, em manutenção, consumo de combustível
              e atividades mais recentes em um painel único. Valores de
              abastecimentos e manutenções consideram apenas o mês atual.
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
                R$ {totalGastoAbastecimentoMes.toFixed(2)} em combustível (mês)
              </span>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            <p className="text-xs text-gray-400">
              Usuário:{" "}
              <span className="font-semibold text-gray-100">
                {user?.name}
              </span>{" "}
              {isAdmin && (
                <span className="ml-2 rounded-full bg-yellow-500/10 border border-yellow-500/40 px-2 py-[2px] text-[10px] font-semibold text-yellow-300">
                  ADMIN
                </span>
              )}
            </p>
            <p className="text-[11px] text-gray-500">
              Use o menu lateral para navegar entre veículos, rotas,
              abastecimentos e manutenções.
            </p>
          </div>
        </div>
      </Card>

      {errorMsg && (
        <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
      )}

      {/* Cards principais */}
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
              {veiculosDisponiveis} disponíveis
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
              {veiculosEmRota} veículo(s) em rota
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-yellow-500/10">
            <Map className="w-6 h-6 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Manutenção · mês atual
            </p>
            <p className="text-2xl font-bold text-yellow-400">
              {veiculosEmManutencao}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              R$ {totalGastoManutencaoMes.toFixed(2)} em manutenções no mês
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
              R$ {totalGastoAbastecimentoMes.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {fuelingsMes.length} registro(s) no mês
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
              {isAdmin ? (
                <>
                  Você está logado como{" "}
                  <span className="font-semibold text-yellow-400">ADMIN</span>{" "}
                  e tem acesso à frota completa do Grupo MM.
                </>
              ) : (
                <>
                  Você é responsável por{" "}
                  <span className="font-semibold text-yellow-400">
                    {vehicles.length} veículo(s)
                  </span>
                  ,{" "}
                  <span className="font-semibold text-yellow-400">
                    {drivers.length} motorista(s)
                  </span>{" "}
                  e{" "}
                  <span className="font-semibold text-yellow-400">
                    {rotasEmAndamento.length} rota(s)
                  </span>{" "}
                  em andamento.
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Linhas de detalhes */}
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
                        ? new Date(r.startAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
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
                      {f.liters.toFixed(2)} L × R${" "}
                      {f.pricePerL.toFixed(2)}
                    </p>
                    <p className="font-semibold text-yellow-300">
                      R$ {f.total.toFixed(2)}
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
                  <th className="py-2 px-2">Custo</th>
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
                      R$ {m.cost.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}