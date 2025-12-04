"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  BarChart3,
  Fuel,
  Car,
  Users,
  FileText,
  CheckCircle2,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";

type RouteStatus = "em_andamento" | "finalizada";

interface RouteItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverId: string;
  driverName: string;
  startKm: number;
  endKm?: number | null;
  distanceKm?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  status: RouteStatus;
  responsibleUserId: string;
}

interface RefuelItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  liters: number;
  totalCost: number;
  pricePerLiter?: number | null;
  date?: string | null;
  responsibleUserId: string;
}

interface MaintenanceItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel?: string;
  storeId?: string;
  date?: string | null;
  type?: string;
  cost: number;
  status: "em_andamento" | "concluida";
  responsibleUserId: string;
}

interface MonthlySummary {
  id: string; // normalmente ano-mes
  monthKey: string;
  year: number;
  month: number;
  totalKmRodado: number;
  totalCombustivel: number;
  totalManutencao: number;
  kmMedioPorVeiculo: number;
  createdAt?: string | null;
}

type ReportTab = "geral" | "veiculos" | "motoristas";

export default function RelatoriosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [refuels, setRefuels] = useState<RefuelItem[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceItem[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>(
    []
  );

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [activeTab, setActiveTab] = useState<ReportTab>("geral");

  // Filtros de período (por padrão: mês atual)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [initializedDefaultRange, setInitializedDefaultRange] = useState(false);
  const [closingMonth, setClosingMonth] = useState(false);

  const isAdmin = user?.role === "admin";

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  // Define automaticamente o mês atual nos filtros na primeira carga
  useEffect(() => {
    if (initializedDefaultRange) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const y = year;
    const m = String(month + 1).padStart(2, "0");
    const d1 = String(firstDay.getDate()).padStart(2, "0");
    const d2 = String(lastDay.getDate()).padStart(2, "0");

    setStartDate(`${y}-${m}-${d1}`);
    setEndDate(`${y}-${m}-${d2}`);
    setInitializedDefaultRange(true);
  }, [initializedDefaultRange]);

  // Carregar rotas + abastecimentos + manutenções + fechamentos
  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        setErrorMsg("");
        setSuccessMsg("");

        // ROTAS
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
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            driverId: data.driverId,
            driverName: data.driverName,
            startKm: Number(data.startKm ?? 0),
            endKm: data.endKm ?? null,
            distanceKm: data.distanceKm ?? null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            status: (data.status ?? "em_andamento") as RouteStatus,
            responsibleUserId: data.responsibleUserId,
          };
        });

        setRoutes(rList);

        // ABASTECIMENTOS (fuelings)
        let refuelSnap;
        if (isAdmin) {
          refuelSnap = await getDocs(collection(db, "fuelings"));
        } else {
          refuelSnap = await getDocs(
            query(
              collection(db, "fuelings"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const fList: RefuelItem[] = refuelSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            liters: Number(data.liters ?? 0),
            totalCost: Number(
              data.totalCost != null ? data.totalCost : data.total ?? 0
            ),
            pricePerLiter: data.pricePerLiter ?? data.pricePerL ?? null,
            date: data.date ?? null,
            responsibleUserId: data.responsibleUserId,
          };
        });

        setRefuels(fList);

        // MANUTENÇÕES (maintenances)
        let maintSnap;
        if (isAdmin) {
          maintSnap = await getDocs(collection(db, "maintenances"));
        } else {
          maintSnap = await getDocs(
            query(
              collection(db, "maintenances"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const mList: MaintenanceItem[] = maintSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            storeId: data.storeId,
            date: data.date ?? null,
            type: data.type,
            cost: Number(data.cost ?? 0),
            status: (data.status ?? "em_andamento") as
              | "em_andamento"
              | "concluida",
            responsibleUserId: data.responsibleUserId,
          };
        });

        setMaintenances(mList);

        // FECHAMENTOS MENSAIS SALVOS (apenas admin)
        if (isAdmin) {
          const msSnap = await getDocs(collection(db, "monthlySummaries"));
          const msList: MonthlySummary[] = msSnap.docs
            .map((d) => {
              const data = d.data() as any;
              const createdAtDate =
                data.createdAt && data.createdAt.toDate
                  ? data.createdAt.toDate()
                  : null;

              return {
                id: d.id,
                monthKey: data.monthKey ?? d.id,
                year: Number(data.year ?? 0),
                month: Number(data.month ?? 0),
                totalKmRodado: Number(data.totalKmRodado ?? 0),
                totalCombustivel: Number(data.totalCombustivel ?? 0),
                totalManutencao: Number(data.totalManutencao ?? 0),
                kmMedioPorVeiculo: Number(data.kmMedioPorVeiculo ?? 0),
                createdAt: createdAtDate
                  ? createdAtDate.toISOString()
                  : null,
              };
            })
            .sort((a, b) => {
              const ka = a.year * 12 + a.month;
              const kb = b.year * 12 + b.month;
              return kb - ka;
            });

          setMonthlySummaries(msList);
        }
      } catch (error) {
        console.error("Erro ao carregar dados de relatórios:", error);
        setErrorMsg(
          "Erro ao carregar dados de relatórios. Tente novamente mais tarde."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, isAdmin]);

  // Helper: filtro por período (startDate/endDate)
  function isWithinDateRange(isoDate: string | null | undefined) {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return false;

    if (startDate) {
      const from = new Date(startDate + "T00:00:00");
      if (d < from) return false;
    }
    if (endDate) {
      const to = new Date(endDate + "T23:59:59");
      if (d > to) return false;
    }
    return true;
  }

  // Helper: pertence ao mês/ano atual (para fechamento)
  function isInCurrentMonth(isoDate: string | null | undefined) {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return false;

    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }

  // Dados filtrados pela tela (período)
  const filteredRoutes = useMemo(() => {
    if (!startDate && !endDate) return routes;
    return routes.filter((r) => isWithinDateRange(r.startAt || r.endAt || null));
  }, [routes, startDate, endDate]);

  const filteredRefuels = useMemo(() => {
    if (!startDate && !endDate) return refuels;
    return refuels.filter((f) => isWithinDateRange(f.date));
  }, [refuels, startDate, endDate]);

  const filteredMaintenances = useMemo(() => {
    if (!startDate && !endDate) return maintenances;
    return maintenances.filter((m) => isWithinDateRange(m.date));
  }, [maintenances, startDate, endDate]);

  // Resumo geral
  const totalKmRodado = useMemo(() => {
    return filteredRoutes.reduce((acc, r) => {
      if (r.distanceKm != null) return acc + r.distanceKm;
      if (r.endKm != null) return acc + (r.endKm - r.startKm);
      return acc;
    }, 0);
  }, [filteredRoutes]);

  const totalLitros = useMemo(
    () => filteredRefuels.reduce((acc, f) => acc + (f.liters || 0), 0),
    [filteredRefuels]
  );

  const totalGastoCombustivel = useMemo(
    () => filteredRefuels.reduce((acc, f) => acc + (f.totalCost || 0), 0),
    [filteredRefuels]
  );

  const totalGastoManutencao = useMemo(
    () => filteredMaintenances.reduce((acc, m) => acc + (m.cost || 0), 0),
    [filteredMaintenances]
  );

  const mediaKmPorLitro = useMemo(() => {
    if (!totalLitros) return 0;
    return totalKmRodado / totalLitros;
  }, [totalKmRodado, totalLitros]);

  // KM por veículo
  const kmPorVeiculoData = useMemo(() => {
    const map = new Map<string, { vehicle: string; km: number }>();

    for (const r of filteredRoutes) {
      const key = r.vehicleId || r.vehiclePlate;
      const label = `${r.vehiclePlate} · ${r.vehicleModel}`;
      if (!map.has(key)) {
        map.set(key, { vehicle: label, km: 0 });
      }
      const current = map.get(key)!;
      const dist =
        r.distanceKm != null
          ? r.distanceKm
          : r.endKm != null
          ? r.endKm - r.startKm
          : 0;
      current.km += dist;
    }

    return Array.from(map.values()).sort((a, b) => b.km - a.km);
  }, [filteredRoutes]);

  // Gasto combustível por mês (linha)
  const gastoPorMesData = useMemo(() => {
    const map = new Map<string, { mes: string; total: number }>();

    for (const f of filteredRefuels) {
      if (!f.date) continue;
      const d = new Date(f.date);
      if (Number.isNaN(d.getTime())) continue;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const label = `${String(d.getMonth() + 1).padStart(2, "0")}/${
        d.getFullYear() % 100
      }`;

      if (!map.has(key)) {
        map.set(key, { mes: label, total: 0 });
      }
      const current = map.get(key)!;
      current.total += f.totalCost || 0;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.mes.localeCompare(b.mes)
    );
  }, [filteredRefuels]);

  const filtrosAtivos = !!startDate || !!endDate;

  if (!user) return null;

  // ===== Fechamento do mês atual (ADMIN) =====
  async function handleFecharMesAtual() {
    try {
      setClosingMonth(true);
      setSuccessMsg("");
      setErrorMsg("");

      const now = new Date();
      const year = now.getFullYear();
      const monthIndex = now.getMonth(); // 0-11
      const monthNumber = monthIndex + 1;
      const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;

      // Filtra dados do mês atual
      const routesMes = routes.filter((r) =>
        isInCurrentMonth(r.startAt || r.endAt || null)
      );
      const refuelsMes = refuels.filter((f) => isInCurrentMonth(f.date));
      const maintMes = maintenances.filter((m) => isInCurrentMonth(m.date));

      if (
        routesMes.length === 0 &&
        refuelsMes.length === 0 &&
        maintMes.length === 0
      ) {
        setErrorMsg(
          "Não há dados registrados no mês atual para gerar o fechamento."
        );
        return;
      }

      const totalKmRodadoMes = routesMes.reduce((acc, r) => {
        if (r.distanceKm != null) return acc + r.distanceKm;
        if (r.endKm != null) return acc + (r.endKm - r.startKm);
        return acc;
      }, 0);

      const totalCombustivelMes = refuelsMes.reduce(
        (acc, f) => acc + (f.totalCost || 0),
        0
      );

      const totalManutencaoMes = maintMes.reduce(
        (acc, m) => acc + (m.cost || 0),
        0
      );

      // Km médio por veículo no mês (considerando somente veículos que rodaram)
      const kmPorVeiculoMap = new Map<string, number>();
      for (const r of routesMes) {
        const key = r.vehicleId || r.vehiclePlate;
        const dist =
          r.distanceKm != null
            ? r.distanceKm
            : r.endKm != null
            ? r.endKm - r.startKm
            : 0;
        kmPorVeiculoMap.set(key, (kmPorVeiculoMap.get(key) || 0) + dist);
      }
      const qtdVeiculosComMovimento = kmPorVeiculoMap.size;
      const kmMedioPorVeiculo =
        qtdVeiculosComMovimento > 0
          ? totalKmRodadoMes / qtdVeiculosComMovimento
          : 0;

      const refDoc = doc(db, "monthlySummaries", monthKey);
      await setDoc(refDoc, {
        monthKey,
        year,
        month: monthNumber,
        totalKmRodado: totalKmRodadoMes,
        totalCombustivel: totalCombustivelMes,
        totalManutencao: totalManutencaoMes,
        kmMedioPorVeiculo,
        vehiclesWithMovement: qtdVeiculosComMovimento,
        routesCount: routesMes.length,
        refuelsCount: refuelsMes.length,
        maintenancesCount: maintMes.length,
        createdAt: serverTimestamp(),
      });

      setSuccessMsg(
        `Fechamento do mês atual (${String(monthNumber).padStart(
          2,
          "0"
        )}/${year}) salvo com sucesso.`
      );
    } catch (error) {
      console.error("Erro ao gerar fechamento do mês:", error);
      setErrorMsg(
        "Erro ao gerar o fechamento do mês. Verifique os dados e tente novamente."
      );
    } finally {
      setClosingMonth(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-yellow-400" />
            Relatórios da Frota
          </h1>
          <p className="text-sm text-gray-300">
            Acompanhe o desempenho da frota, consumo e custos por período. Por
            padrão, você está vendo o mês atual.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {filtrosAtivos && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] bg-yellow-500/10 border border-yellow-500/40 text-yellow-200">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Filtros de data aplicados
            </span>
          )}

          {isAdmin && (
            <Button
              type="button"
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold"
              onClick={handleFecharMesAtual}
              disabled={closingMonth}
            >
              <FileText className="w-4 h-4" />
              {closingMonth ? "Gerando fechamento..." : "Fechar mês atual"}
            </Button>
          )}
        </div>
      </div>

      {/* Filtros de período */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs text-gray-400 mb-1">
              Data inicial
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-neutral-900 border-neutral-700 text-gray-100 text-sm"
            />
          </div>
          <div className="flex-1 max-w-xs">
            <label className="block text-xs text-gray-400 mb-1">
              Data final
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-neutral-900 border-neutral-700 text-gray-100 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-neutral-700 text-gray-200 hover:bg-neutral-800 text-xs"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Abas internas */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "geral", label: "Visão geral" },
          { key: "veiculos", label: "Por veículo" },
          { key: "motoristas", label: "Por motorista" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as ReportTab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeTab === tab.key
                ? "bg-yellow-500 text-black border-yellow-400 shadow-sm"
                : "bg-neutral-950 text-gray-300 border-neutral-700 hover:bg-neutral-800 hover:text-yellow-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
      )}
      {successMsg && (
        <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </p>
      )}

      {loading ? (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
          <p className="text-sm text-gray-300">Carregando dados...</p>
        </Card>
      ) : (
        <>
          {/* TAB: VISÃO GERAL */}
          {activeTab === "geral" && (
            <>
              {/* Resumo rápido */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="p-4 bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      KM rodado
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-yellow-500/10 text-yellow-300">
                      Rotas
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {totalKmRodado.toFixed(1)} km
                  </p>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Litros abastecidos
                    </p>
                    <Fuel className="w-4 h-4 text-yellow-400" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {totalLitros.toFixed(1)} L
                  </p>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Gasto com combustível
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-300">
                      Custo
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    R$ {totalGastoCombustivel.toFixed(2)}
                  </p>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Gasto com manutenção
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/10 text-sky-300">
                      Oficinas
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    R$ {totalGastoManutencao.toFixed(2)}
                  </p>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Média geral km/L
                    </p>
                    <Car className="w-4 h-4 text-yellow-400" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-400">
                    {mediaKmPorLitro > 0 ? mediaKmPorLitro.toFixed(2) : "-"}
                  </p>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* KM por veículo */}
                <Card className="p-4 bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-yellow-400" />
                      <p className="text-sm font-semibold text-gray-100">
                        KM rodado por veículo
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-500">
                      {kmPorVeiculoData.length} veículo(s)
                    </span>
                  </div>
                  {kmPorVeiculoData.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Não há rotas no período selecionado.
                    </p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kmPorVeiculoData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="vehicle"
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                            interval={0}
                            angle={-20}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              border: "1px solid #facc15",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "#facc15",
                            }}
                            itemStyle={{ color: "#e5e5e5" }}
                            labelStyle={{ color: "#facc15" }}
                            formatter={(value) => [
                              `${Number(value).toFixed(1)} km`,
                              "Km rodado",
                            ]}
                          />
                          <Bar
                            dataKey="km"
                            fill="#facc15"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                {/* Gasto por mês */}
                <Card className="p-4 bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-yellow-400" />
                      <p className="text-sm font-semibold text-gray-100">
                        Gasto com combustível por mês
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-500">
                      {gastoPorMesData.length} mês(es)
                    </span>
                  </div>
                  {gastoPorMesData.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Não há abastecimentos no período selecionado.
                    </p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gastoPorMesData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="mes"
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#9ca3af" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              border: "1px solid #facc15",
                              borderRadius: 8,
                              fontSize: 12,
                              color: "#facc15",
                            }}
                            itemStyle={{ color: "#e5e5e5" }}
                            labelStyle={{ color: "#facc15" }}
                            formatter={(value) => [
                              `R$ ${Number(value).toFixed(2)}`,
                              "Gasto",
                            ]}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="total"
                            name="Combustível"
                            stroke="#facc15"
                            strokeWidth={2}
                            dot={{ r: 4, fill: "#facc15" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>
              </div>

              {/* Fechamentos mensais salvos (apenas admin) */}
              {isAdmin && monthlySummaries.length > 0 && (
                <Card className="p-4 bg-neutral-950 border border-neutral-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm font-semibold text-gray-100">
                      Fechamentos mensais salvos
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left border-b border-neutral-800 text-gray-400">
                          <th className="py-2 pr-2">Mês</th>
                          <th className="py-2 px-2">Km rodado</th>
                          <th className="py-2 px-2">Combustível (R$)</th>
                          <th className="py-2 px-2">Manutenção (R$)</th>
                          <th className="py-2 px-2">Km médio/veículo</th>
                          <th className="py-2 px-2">Criado em</th>
                          <th className="py-2 px-2 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummaries.map((s) => {
                          const label =
                            s.month && s.year
                              ? `${String(s.month).padStart(2, "0")}/${s.year}`
                              : s.monthKey;
                          const created =
                            s.createdAt != null
                              ? new Date(s.createdAt).toLocaleString("pt-BR")
                              : "-";
                          return (
                            <tr
                              key={s.id}
                              className="border-b border-neutral-900 hover:bg-neutral-800/60"
                            >
                              <td className="py-2 pr-2 text-gray-100">
                                {label}
                              </td>
                              <td className="py-2 px-2">
                                {s.totalKmRodado.toFixed(1)} km
                              </td>
                              <td className="py-2 px-2 text-yellow-300">
                                R$ {s.totalCombustivel.toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-sky-300">
                                R$ {s.totalManutencao.toFixed(2)}
                              </td>
                              <td className="py-2 px-2">
                                {s.kmMedioPorVeiculo > 0
                                  ? s.kmMedioPorVeiculo.toFixed(2)
                                  : "-"}
                              </td>
                              <td className="py-2 px-2 text-gray-400">
                                {created}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <Button
                                  size="sm"
                                  className="bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border border-yellow-500/40 text-xs h-7 px-3"
                                  onClick={() =>
                                    router.push(
                                      `/relatorios/fechamento/${s.monthKey}`
                                    )
                                  }
                                >
                                  Ver fechamento
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* TAB: POR VEÍCULO */}
          {activeTab === "veiculos" && (
            <Card className="p-4 bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-semibold text-gray-100">
                  Relatório por veículo
                </p>
              </div>
              <p className="text-sm text-gray-300">
                Veja quais veículos mais rodaram no período selecionado. Em
                versões futuras podemos incluir custo por km, consumo médio e
                manutenções por veículo.
              </p>

              {kmPorVeiculoData.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Não há rotas no período selecionado.
                </p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kmPorVeiculoData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="vehicle"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#020617",
                          border: "1px solid #facc15",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#facc15",
                        }}
                        itemStyle={{ color: "#e5e5e5" }}
                        labelStyle={{ color: "#facc15" }}
                        formatter={(value) => [
                          `${Number(value).toFixed(1)} km`,
                          "Km rodado",
                        ]}
                      />
                      <Bar
                        dataKey="km"
                        fill="#facc15"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}

          {/* TAB: POR MOTORISTA (placeholder) */}
          {activeTab === "motoristas" && (
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-yellow-400" />
                <p className="text-sm font-semibold text-gray-100">
                  Relatório por motorista
                </p>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Em breve, você poderá analisar:
              </p>
              <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                <li>Km rodado por motorista no período</li>
                <li>Veículos utilizados por cada motorista</li>
                <li>Quantidade de rotas e média diária</li>
              </ul>
              <p className="mt-3 text-xs text-yellow-300">
                Essa aba usa as mesmas rotas já cadastradas. No próximo passo a
                gente pode montar um ranking com os motoristas que mais
                rodaram, custo médio por km, etc.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}