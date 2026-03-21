"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Car,
  Clock3,
  CircleDollarSign,
  Fuel,
  Gauge,
  Map as MapIcon,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricCard } from "@/components/layout/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

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
  responsibleUserId?: string;
  responsibleUserName?: string;
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
  endAt?: string | null;
  distanceKm?: number | null;
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

interface ComparisonData {
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
}

interface DashboardAlert {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "danger" | "warning" | "info";
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatNumber(value: number, suffix = "") {
  return `${numberFormatter.format(value || 0)}${suffix}`;
}

function formatCompactNumber(value: number) {
  return compactFormatter.format(value || 0);
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getComparisonData(current: number, previous: number): ComparisonData {
  const delta = current - previous;
  const percent = previous === 0 ? null : (delta / previous) * 100;

  return {
    current,
    previous,
    delta,
    percent,
  };
}

function getHoursSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
}

function getDaysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

function TrendChip({
  comparison,
  higherIsBetter = true,
  previousLabel,
  emptyLabel = "Sem base anterior",
}: {
  comparison: ComparisonData;
  higherIsBetter?: boolean;
  previousLabel: string;
  emptyLabel?: string;
}) {
  const direction =
    comparison.delta === 0 ? "flat" : comparison.delta > 0 ? "up" : "down";
  const positive =
    direction === "flat"
      ? null
      : higherIsBetter
        ? comparison.delta > 0
        : comparison.delta < 0;

  const toneClasses =
    positive === null
      ? "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300"
      : positive
        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200";

  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Clock3;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        toneClasses
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {comparison.previous === 0
        ? emptyLabel
        : `${comparison.delta > 0 ? "+" : ""}${Math.round(comparison.percent || 0)}% vs ${previousLabel}`}
    </div>
  );
}

function StateBlock({
  message,
  tone = "neutral",
}: {
  message: string;
  tone?: "neutral" | "info";
}) {
  return (
    <div
      className={
        tone === "info"
          ? "rounded-[22px] border border-blue-200 bg-blue-50/90 px-4 py-8 text-center text-sm text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
          : "rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-400"
      }
    >
      {message}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [costChartMode, setCostChartMode] = useState<"split" | "total">("split");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [fuelings, setFuelings] = useState<Fueling[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [router, user]);

  useEffect(() => {
    async function loadAll() {
      if (!user) return;

      try {
        setLoading(true);
        setErrorMsg("");

        let vehiclesSnap;
        if (isAdmin) {
          vehiclesSnap = await getDocs(collection(db, "vehicles"));
        } else {
          vehiclesSnap = await getDocs(
            query(
              collection(db, "vehicles"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        const vList: Vehicle[] = vehiclesSnap.docs.map((doc) => {
          const data = doc.data() as any;
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

          const responsibleUserIdsFromDoc =
            Array.isArray(data.responsibleUserIds) && data.responsibleUserIds.length
              ? data.responsibleUserIds
              : responsibleUsersFromDoc.map((responsibleUser) => responsibleUser.id);

          return {
            id: doc.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            status: data.status ?? "disponivel",
            currentKm: data.currentKm,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName:
              data.responsibleUserName || responsibleUsersFromDoc[0]?.name || "",
            responsibleUserIds: responsibleUserIdsFromDoc,
            responsibleUsers: responsibleUsersFromDoc,
          };
        });
        setVehicles(vList);

        let routesSnap;
        if (isAdmin) {
          routesSnap = await getDocs(collection(db, "routes"));
        } else {
          routesSnap = await getDocs(
            query(
              collection(db, "routes"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        setRoutes(
          routesSnap.docs.map((doc) => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              vehiclePlate: data.vehiclePlate,
              vehicleModel: data.vehicleModel,
              driverName: data.driverName,
              origem: data.origem ?? null,
              destino: data.destino ?? null,
              startKm: Number(data.startKm || 0),
              startAt: data.startAt ?? null,
              endAt: data.endAt ?? null,
              distanceKm: data.distanceKm ?? null,
              status: data.status ?? "em_andamento",
            };
          })
        );

        let fuelingsSnap;
        if (isAdmin) {
          fuelingsSnap = await getDocs(
            query(collection(db, "fuelings"), orderBy("date", "desc"))
          );
        } else {
          fuelingsSnap = await getDocs(
            query(
              collection(db, "fuelings"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        let fList: Fueling[] = fuelingsSnap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
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
          fList = fList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        }
        setFuelings(fList);

        let maintSnap;
        if (isAdmin) {
          maintSnap = await getDocs(
            query(collection(db, "maintenances"), orderBy("date", "desc"))
          );
        } else {
          maintSnap = await getDocs(
            query(
              collection(db, "maintenances"),
              where("responsibleUserIds", "array-contains", user.id)
            )
          );
        }

        let mList: Maintenance[] = maintSnap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
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
          mList = mList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        }
        setMaintenances(mList);

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

        setDrivers(
          driversSnap.docs.map((doc) => {
            const data = doc.data() as any;
            return {
              id: doc.id,
              name: data.name,
              storeId: data.storeId,
              responsibleUserId: data.responsibleUserId,
            };
          })
        );
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
        setErrorMsg("Erro ao carregar dados do dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [isAdmin, user]);

  function isInRelativeMonth(dateStr: string | null | undefined, offset = 0) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    const reference = new Date(now.getFullYear(), now.getMonth() + offset, 1);

    return (
      date.getFullYear() === reference.getFullYear() &&
      date.getMonth() === reference.getMonth()
    );
  }

  function isInCurrentMonth(dateStr?: string | null) {
    return isInRelativeMonth(dateStr, 0);
  }

  const totalVeiculos = vehicles.length;
  const veiculosEmRota = vehicles.filter((vehicle) => vehicle.status === "em_rota").length;
  const veiculosEmManutencao = vehicles.filter(
    (vehicle) => vehicle.status === "manutencao"
  ).length;
  const veiculosDisponiveis = vehicles.filter(
    (vehicle) => vehicle.status === "disponivel"
  ).length;
  const rotasEmAndamento = routes
    .filter((route) => route.status === "em_andamento")
    .sort((a, b) => (b.startAt || "").localeCompare(a.startAt || ""));
  const ultimasRotasEmAndamento = rotasEmAndamento.slice(0, 5);

  const fuelingsMes = useMemo(
    () => fuelings.filter((fueling) => isInCurrentMonth(fueling.date)),
    [fuelings]
  );
  const fuelingsMesAnterior = useMemo(
    () => fuelings.filter((fueling) => isInRelativeMonth(fueling.date, -1)),
    [fuelings]
  );
  const ultimosAbastecimentos = useMemo(
    () => fuelingsMes.slice(0, 5),
    [fuelingsMes]
  );
  const maintMes = useMemo(
    () => maintenances.filter((maintenance) => isInCurrentMonth(maintenance.date)),
    [maintenances]
  );
  const maintMesAnterior = useMemo(
    () =>
      maintenances.filter((maintenance) =>
        isInRelativeMonth(maintenance.date, -1)
      ),
    [maintenances]
  );
  const manutencoesEmAndamento = useMemo(
    () => maintenances.filter((maintenance) => maintenance.status === "em_andamento"),
    [maintenances]
  );
  const finalizadasMes = useMemo(
    () =>
      routes.filter(
        (route) =>
          route.status === "finalizada" && isInCurrentMonth(route.endAt)
      ),
    [routes]
  );
  const finalizadasMesAnterior = useMemo(
    () =>
      routes.filter(
        (route) =>
          route.status === "finalizada" && isInRelativeMonth(route.endAt, -1)
      ),
    [routes]
  );
  const totalCombustivelMes = useMemo(
    () => fuelingsMes.reduce((sum, fueling) => sum + Number(fueling.total || 0), 0),
    [fuelingsMes]
  );
  const totalCombustivelMesAnterior = useMemo(
    () =>
      fuelingsMesAnterior.reduce(
        (sum, fueling) => sum + Number(fueling.total || 0),
        0
      ),
    [fuelingsMesAnterior]
  );
  const totalManutencaoMes = useMemo(
    () => maintMes.reduce((sum, maintenance) => sum + Number(maintenance.cost || 0), 0),
    [maintMes]
  );
  const totalManutencaoMesAnterior = useMemo(
    () =>
      maintMesAnterior.reduce(
        (sum, maintenance) => sum + Number(maintenance.cost || 0),
        0
      ),
    [maintMesAnterior]
  );
  const totalCustoMes = totalCombustivelMes + totalManutencaoMes;
  const totalCustoMesAnterior =
    totalCombustivelMesAnterior + totalManutencaoMesAnterior;
  const totalKmMes = useMemo(
    () =>
      finalizadasMes.reduce(
        (sum, route) => sum + Number(route.distanceKm || 0),
        0
      ),
    [finalizadasMes]
  );
  const totalKmMesAnterior = useMemo(
    () =>
      finalizadasMesAnterior.reduce(
        (sum, route) => sum + Number(route.distanceKm || 0),
        0
      ),
    [finalizadasMesAnterior]
  );
  const qtdManutencoesEmAndamento = manutencoesEmAndamento.length;
  const disponibilidadePercentual =
    totalVeiculos === 0 ? 0 : (veiculosDisponiveis / totalVeiculos) * 100;
  const custoPorKmMes = totalKmMes > 0 ? totalCustoMes / totalKmMes : 0;
  const custoPorKmMesAnterior =
    totalKmMesAnterior > 0 ? totalCustoMesAnterior / totalKmMesAnterior : 0;

  const monthlyTotals = useMemo(() => {
    if (fuelings.length === 0 && maintenances.length === 0) return [];
    const map = new Map<string, { fuel: number; maint: number }>();

    fuelings.forEach((fueling) => {
      if (!fueling.date) return;
      const date = new Date(fueling.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = map.get(key) ?? { fuel: 0, maint: 0 };
      current.fuel += Number(fueling.total || 0);
      map.set(key, current);
    });

    maintenances.forEach((maintenance) => {
      if (!maintenance.date) return;
      const date = new Date(maintenance.date);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = map.get(key) ?? { fuel: 0, maint: 0 };
      current.maint += Number(maintenance.cost || 0);
      map.set(key, current);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => {
        const [year, month] = key.split("-");
        return {
          label: `${month}/${year.slice(2)}`,
          fuelTotal: value.fuel,
          maintTotal: value.maint,
        };
      });
  }, [fuelings, maintenances]);

  const lastMonthTotals =
    monthlyTotals.length > 0 ? monthlyTotals[monthlyTotals.length - 1] : null;
  const monthlySeries = monthlyTotals.map((item) => ({
    ...item,
    totalCost: item.fuelTotal + item.maintTotal,
  }));
  const fleetStatusData = [
    { name: "Disponiveis", value: veiculosDisponiveis, color: "#facc15" },
    { name: "Em rota", value: veiculosEmRota, color: "#3b82f6" },
    { name: "Manutencao", value: veiculosEmManutencao, color: "#334155" },
  ].filter((item) => item.value > 0);
  const operationalData = [
    { label: "Rotas finais", value: finalizadasMes.length, fill: "#3b82f6" },
    { label: "Abastec.", value: fuelingsMes.length, fill: "#facc15" },
    { label: "Manut.", value: maintMes.length, fill: "#94a3b8" },
  ];

  const chartColors =
    theme === "dark"
      ? {
          axis: "#94a3b8",
          grid: "rgba(148, 163, 184, 0.18)",
          tooltipBg: "#111827",
          tooltipBorder: "rgba(148, 163, 184, 0.24)",
          text: "#e2e8f0",
          fuel: "#facc15",
          maint: "#3b82f6",
          total: "#3b82f6",
        }
      : {
          axis: "#64748b",
          grid: "rgba(148, 163, 184, 0.22)",
          tooltipBg: "#ffffff",
          tooltipBorder: "rgba(148, 163, 184, 0.28)",
          text: "#0f172a",
          fuel: "#d97706",
          maint: "#2563eb",
          total: "#2563eb",
        };

  const chartTooltipStyle = {
    backgroundColor: chartColors.tooltipBg,
    border: `1px solid ${chartColors.tooltipBorder}`,
    borderRadius: 18,
    color: chartColors.text,
  };

  const currentPeriodLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date());
  const previousPeriodLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));

  const custoComparativo = getComparisonData(totalCustoMes, totalCustoMesAnterior);
  const rotasComparativo = getComparisonData(
    finalizadasMes.length,
    finalizadasMesAnterior.length
  );
  const abastecimentosComparativo = getComparisonData(
    fuelingsMes.length,
    fuelingsMesAnterior.length
  );
  const manutencoesComparativo = getComparisonData(
    maintMes.length,
    maintMesAnterior.length
  );
  const custoPorKmComparativo = getComparisonData(
    custoPorKmMes,
    custoPorKmMesAnterior
  );

  const rotasLongasEmAndamento = useMemo(
    () =>
      rotasEmAndamento
        .map((route) => ({
          ...route,
          openHours: getHoursSince(route.startAt) ?? 0,
        }))
        .filter((route) => route.openHours >= 8)
        .sort((a, b) => b.openHours - a.openHours),
    [rotasEmAndamento]
  );

  const manutencoesAtrasadas = useMemo(
    () =>
      manutencoesEmAndamento
        .map((maintenance) => ({
          ...maintenance,
          openDays: getDaysSince(maintenance.date) ?? 0,
        }))
        .filter((maintenance) => maintenance.openDays >= 5)
        .sort((a, b) => b.openDays - a.openDays),
    [manutencoesEmAndamento]
  );

  const dashboardAlerts = useMemo<DashboardAlert[]>(() => {
    const alerts: DashboardAlert[] = [];

    if (rotasLongasEmAndamento.length > 0) {
      alerts.push({
        id: "rotas-longas",
        title: "Rotas abertas por tempo elevado",
        description: `${rotasLongasEmAndamento.length} rota(s) estao em andamento ha mais de 8 horas.`,
        href: "/rotas",
        actionLabel: "Abrir rotas",
        tone: "warning",
      });
    }

    if (manutencoesAtrasadas.length > 0) {
      alerts.push({
        id: "manutencoes-atrasadas",
        title: "Manutencoes sem retorno",
        description: `${manutencoesAtrasadas.length} manutencao(oes) seguem abertas ha mais de 5 dias.`,
        href: "/manutencoes",
        actionLabel: "Ver manutencoes",
        tone: "danger",
      });
    }

    if (custoComparativo.previous > 0 && custoComparativo.percent !== null && custoComparativo.percent >= 15) {
      alerts.push({
        id: "custo-acima-da-base",
        title: "Custo acima do padrao recente",
        description: `O custo do mes subiu ${Math.round(custoComparativo.percent)}% em relacao a ${previousPeriodLabel}.`,
        href: isAdmin ? "/relatorios" : "/abastecimentos",
        actionLabel: isAdmin ? "Analisar relatorio" : "Ver custos",
        tone: "warning",
      });
    }

    if (isAdmin && totalVeiculos > 0 && disponibilidadePercentual < 45) {
      alerts.push({
        id: "baixa-disponibilidade",
        title: "Disponibilidade da frota abaixo do ideal",
        description: `Apenas ${Math.round(disponibilidadePercentual)}% da frota esta disponivel agora.`,
        href: "/veiculos",
        actionLabel: "Revisar frota",
        tone: "info",
      });
    }

    if (!isAdmin && veiculosDisponiveis === 0 && vehicles.length > 0) {
      alerts.push({
        id: "sem-veiculo-disponivel",
        title: "Nenhum veiculo disponivel no momento",
        description: "Todos os veiculos vinculados a voce estao em rota ou manutencao.",
        href: "/veiculos",
        actionLabel: "Abrir veiculos",
        tone: "info",
      });
    }

    return alerts.slice(0, 4);
  }, [
    custoComparativo.percent,
    custoComparativo.previous,
    disponibilidadePercentual,
    isAdmin,
    manutencoesAtrasadas.length,
    previousPeriodLabel,
    rotasLongasEmAndamento.length,
    totalVeiculos,
    veiculosDisponiveis,
    vehicles.length,
  ]);
  const pendenciasAtivas = rotasLongasEmAndamento.length + manutencoesEmAndamento.length;
  const isDarkTheme = theme === "dark";
  const dashboardHeaderClass = isDarkTheme
    ? "border-yellow-400/10 bg-[linear-gradient(145deg,rgba(8,8,10,0.98),rgba(15,15,17,0.96))]"
    : "border-blue-200/80 bg-[linear-gradient(145deg,rgba(239,246,255,0.96),rgba(255,255,255,0.99))] shadow-[0_24px_56px_rgba(37,99,235,0.12)]";
  const dashboardSectionClass = cn(
    "app-panel gap-0 overflow-hidden py-0",
    isDarkTheme
      ? "border-yellow-400/10"
      : "border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,0.99))] shadow-[0_20px_48px_rgba(37,99,235,0.11)]"
  );
  const dashboardMetricClass = isDarkTheme
    ? "border-yellow-400/10 bg-[linear-gradient(180deg,rgba(10,10,12,0.95),rgba(15,15,17,0.96))]"
    : "border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.98),rgba(255,255,255,0.98))] shadow-[0_18px_40px_rgba(37,99,235,0.1)]";
  const sectionEyebrowClass =
    "text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200";
  const sectionNeutralEyebrowClass =
    "text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-slate-200";
  const sectionMetaCardClass =
    "rounded-[20px] border border-blue-100 bg-blue-50/80 px-4 py-3 dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(12,12,14,0.94),rgba(18,18,20,0.98))]";
  const sectionMetaLabelClass =
    "text-[11px] uppercase tracking-[0.16em] text-blue-700/70 dark:text-slate-400";
  const detailCardClass =
    "rounded-[22px] border border-blue-100/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.78),rgba(255,255,255,0.98))] p-4 dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(12,12,14,0.94),rgba(18,18,20,0.98))]";
  const detailStatClass =
    "rounded-[18px] border border-blue-100 bg-white px-3 py-2 dark:border-white/10 dark:bg-slate-950/50";
  const detailAccentStatClass =
    "rounded-[18px] border border-blue-200 bg-blue-50 px-3 py-2 dark:border-yellow-400/20 dark:bg-yellow-400/10";
  const detailAccentLabelClass =
    "text-[11px] uppercase tracking-[0.16em] text-blue-700 dark:text-yellow-200";
  const softPillClass =
    "rounded-full border border-blue-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-200";
  const accentPillClass =
    "rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200";
  const actionOutlineClass = isDarkTheme
    ? "border-yellow-300/40 hover:border-yellow-300/70 hover:bg-yellow-400/10 hover:text-white"
    : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800";
  const alertActionClass = isDarkTheme
    ? "text-yellow-200 hover:bg-yellow-400/10 hover:text-yellow-100"
    : "text-blue-700 hover:bg-blue-50 hover:text-blue-800";

  if (!user) return null;

  return (
    <div className="app-page">
      <PageHeader
        eyebrow={isAdmin ? "Painel executivo" : "Painel de operacao"}
        title={
          isAdmin
            ? "Dashboard da frota Grupo MM"
            : `Operacao da sua frota, ${user.name}`
        }
        description={
          isAdmin
            ? "Acompanhe custos, status da frota e operacao em um painel mais limpo, com foco no que precisa de decisao rapida."
            : "Veja somente os dados essenciais da sua operacao: rotas ativas, custos do mes, abastecimentos e manutencoes que precisam de acompanhamento."
        }
        icon={isAdmin ? Gauge : Activity}
        iconTone="yellow"
        className={dashboardHeaderClass}
        badges={
          <>
            <span className={cn("inline-flex items-center gap-2", accentPillClass)}>
              <span
                className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-current" : "bg-current"}`}
              />
              {loading ? "Atualizando painel" : "Painel sincronizado"}
            </span>
            <span className={cn("inline-flex items-center", softPillClass)}>
              Mes atual - {currentPeriodLabel}
            </span>
            {lastMonthTotals ? (
              <span className={cn("inline-flex items-center", accentPillClass)}>
                Ultimo fechamento - {lastMonthTotals.label}
              </span>
            ) : null}
          </>
        }
        actions={
          isAdmin ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push("/relatorios")}
              >
                Abrir relatorios
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={actionOutlineClass}
                onClick={() => router.push("/veiculos")}
              >
                Ver veiculos
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push("/rotas")}
              >
                Nova rota
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={actionOutlineClass}
                onClick={() => router.push("/abastecimentos")}
              >
                Abastecer
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="bg-slate-900 text-white hover:bg-slate-800 dark:border dark:border-yellow-400/10 dark:bg-slate-950/70 dark:text-white dark:hover:bg-slate-900"
                onClick={() => router.push("/manutencoes")}
              >
                Manutencao
              </Button>
            </>
          )
        }
      />

      {loading ? (
        <StatusBanner
          tone="info"
          className="border-blue-200 bg-blue-50 text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
            Buscando os dados mais recentes da frota e montando os indicadores.
          </span>
        </StatusBanner>
      ) : null}

      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}

      <Card className={dashboardSectionClass}>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className={sectionEyebrowClass}>
              Alertas do dia
            </p>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              O que precisa de atencao agora
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sinais de custo, operacao e disponibilidade que merecem acompanhamento.
            </p>
          </div>

          <div className={sectionMetaCardClass}>
            <p className={sectionMetaLabelClass}>
              Alertas ativos
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              {loading ? "--" : dashboardAlerts.length}
            </p>
          </div>
        </div>

        <div className="p-4 md:p-5">
          {loading ? (
            <StateBlock message="Consolidando os alertas mais importantes da operacao..." tone="info" />
          ) : dashboardAlerts.length === 0 ? (
            <StateBlock message="Sem alertas criticos no momento. A operacao esta dentro do esperado." />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-4">
              {dashboardAlerts.map((alert) => {
                const toneClasses =
                  alert.tone === "danger"
                    ? "border-red-200 bg-red-50/90 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                    : alert.tone === "warning"
                      ? "border-blue-200 bg-blue-50/90 text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
                      : "border-blue-100 bg-white text-blue-700 dark:border-yellow-400/10 dark:bg-slate-950/60 dark:text-slate-200";

                return (
                  <div
                    key={alert.id}
                    className={detailCardClass}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                          toneClasses
                        )}
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("h-9 rounded-xl px-3", alertActionClass)}
                        onClick={() => router.push(alert.href)}
                      >
                        {alert.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                        {alert.title}
                      </h3>
                      <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? (
          <>
            <MetricCard
              label="Frota monitorada"
              value={loading ? "--" : String(totalVeiculos)}
              helper={`${Math.round(disponibilidadePercentual)}% da frota esta disponivel hoje.`}
              icon={Car}
              accent="yellow"
              className={dashboardMetricClass}
              aside={
                <div className="flex flex-wrap gap-2">
                  <span className={softPillClass}>
                    {veiculosEmRota} em rota
                  </span>
                  <span className={accentPillClass}>
                    {veiculosEmManutencao} em manutencao
                  </span>
                </div>
              }
            />
            <MetricCard
              label="Rotas concluidas no mes"
              value={loading ? "--" : String(finalizadasMes.length)}
              helper={`${drivers.length} motoristas em leitura e ${rotasEmAndamento.length} rotas ainda abertas.`}
              icon={MapIcon}
              accent="slate"
              className={dashboardMetricClass}
              aside={
                <TrendChip
                  comparison={rotasComparativo}
                  previousLabel={previousPeriodLabel}
                  emptyLabel="Primeiro fechamento comparavel"
                />
              }
            />
            <MetricCard
              label="Custo do mes"
              value={loading ? "--" : formatCurrency(totalCustoMes)}
              helper={`${formatCurrency(totalCombustivelMes)} em combustivel e ${formatCurrency(totalManutencaoMes)} em manutencao.`}
              icon={CircleDollarSign}
              accent="yellow"
              className={dashboardMetricClass}
              aside={
                <TrendChip
                  comparison={custoComparativo}
                  higherIsBetter={false}
                  previousLabel={previousPeriodLabel}
                  emptyLabel="Sem base de custo anterior"
                />
              }
            />
            <MetricCard
              label="Custo por km"
              value={loading ? "--" : formatCurrency(custoPorKmMes)}
              helper={
                totalKmMes > 0
                  ? `${formatNumber(totalKmMes, " km")} finalizados no periodo atual.`
                  : "Aguardando quilometragem finalizada para consolidar este indicador."
              }
              icon={Gauge}
              accent="yellow"
              className={dashboardMetricClass}
              aside={
                <TrendChip
                  comparison={custoPorKmComparativo}
                  higherIsBetter={false}
                  previousLabel={previousPeriodLabel}
                  emptyLabel="Sem base de custo por km"
                />
              }
            />
          </>
        ) : (
          <>
            <MetricCard
              label="Veiculos sob sua responsabilidade"
              value={loading ? "--" : String(vehicles.length)}
              helper={`${veiculosDisponiveis} disponiveis e ${veiculosEmRota} em rota.`}
              icon={Car}
              accent="yellow"
              className={dashboardMetricClass}
              aside={
                <div className="flex flex-wrap gap-2">
                  <span className={softPillClass}>
                    {veiculosDisponiveis} livres agora
                  </span>
                  <span className={accentPillClass}>
                    {veiculosEmManutencao} em oficina
                  </span>
                </div>
              }
            />
            <MetricCard
              label="Rotas em acompanhamento"
              value={loading ? "--" : String(rotasEmAndamento.length)}
              helper={`${finalizadasMes.length} rotas finalizadas no periodo atual.`}
              icon={MapIcon}
              accent="slate"
              className={dashboardMetricClass}
              aside={
                <div className="flex flex-wrap gap-2">
                  <TrendChip
                    comparison={rotasComparativo}
                    previousLabel={previousPeriodLabel}
                    emptyLabel="Primeiro fechamento comparavel"
                  />
                  {rotasLongasEmAndamento.length > 0 ? (
                    <span className={accentPillClass}>
                      {rotasLongasEmAndamento.length} rota(s) longa(s)
                    </span>
                  ) : null}
                </div>
              }
            />
            <MetricCard
              label="Custo do mes"
              value={loading ? "--" : formatCurrency(totalCustoMes)}
              helper={`${formatCurrency(totalCombustivelMes)} em combustivel e ${formatCurrency(totalManutencaoMes)} em manutencao.`}
              icon={CircleDollarSign}
              accent="yellow"
              className={dashboardMetricClass}
              aside={
                <TrendChip
                  comparison={custoComparativo}
                  higherIsBetter={false}
                  previousLabel={previousPeriodLabel}
                  emptyLabel="Sem base de custo anterior"
                />
              }
            />
            <MetricCard
              label="Pendencias ativas"
              value={loading ? "--" : String(pendenciasAtivas)}
              helper={`${manutencoesEmAndamento.length} manutencoes abertas e ${rotasLongasEmAndamento.length} rota(s) com longa duracao.`}
              icon={Wrench}
              accent="red"
              className={dashboardMetricClass}
              aside={
                <TrendChip
                  comparison={manutencoesComparativo}
                  higherIsBetter={false}
                  previousLabel={previousPeriodLabel}
                  emptyLabel="Sem base anterior"
                />
              }
            />
          </>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className={cn(dashboardSectionClass, "xl:col-span-2")}>
          <div className="flex flex-col gap-3 border-b border-border px-5 py-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <p className={sectionEyebrowClass}>
                Custos da frota
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Evolucao mensal de combustivel e manutencao
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Leitura clara da evolucao de custos no tempo.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={costChartMode === "split" ? "secondary" : "outline"}
                  className={
                    costChartMode === "split"
                      ? isDarkTheme
                        ? ""
                        : "border-blue-600/10 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                      : actionOutlineClass
                  }
                  onClick={() => setCostChartMode("split")}
                >
                  Combustivel + manutencao
                </Button>
                <Button
                  size="sm"
                  variant={costChartMode === "total" ? "secondary" : "outline"}
                  className={
                    costChartMode === "total"
                      ? isDarkTheme
                        ? ""
                        : "border-blue-600/10 bg-blue-600 text-white hover:bg-blue-500 hover:text-white"
                      : actionOutlineClass
                  }
                  onClick={() => setCostChartMode("total")}
                >
                  Custo total
                </Button>
              </div>

              <div className={sectionMetaCardClass}>
                <p className={sectionMetaLabelClass}>
                  Fechamento atual
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  {loading ? "--" : formatCurrency(totalCustoMes)}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {currentPeriodLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="h-[320px] p-4 md:h-[360px] md:p-6">
            {loading ? (
              <StateBlock message="Montando a linha do tempo de custos..." tone="info" />
            ) : monthlySeries.length === 0 ? (
              <StateBlock message="Ainda nao ha historico suficiente para montar o grafico." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries}>
                  <defs>
                    <linearGradient id="dashboardTotalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.total} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={chartColors.total} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="dashboardFuelGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.fuel} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={chartColors.fuel} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="dashboardMaintGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.maint} stopOpacity={0.24} />
                      <stop offset="95%" stopColor={chartColors.maint} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: chartColors.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: chartColors.axis, fontSize: 11 }}
                    tickFormatter={(value) => `R$${formatCompactNumber(Number(value))}`}
                    tickLine={false}
                    axisLine={false}
                  />
                  {costChartMode === "split" ? (
                    <>
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value, name) => [
                          formatCurrency(Number(value)),
                          name === "fuelTotal" ? "Combustivel" : "Manutencao",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="fuelTotal"
                        stroke={chartColors.fuel}
                        fill="url(#dashboardFuelGradient)"
                        strokeWidth={3}
                      />
                      <Area
                        type="monotone"
                        dataKey="maintTotal"
                        stroke={chartColors.maint}
                        fill="url(#dashboardMaintGradient)"
                        strokeWidth={3}
                      />
                    </>
                  ) : (
                    <>
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value) => [formatCurrency(Number(value)), "Custo total"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalCost"
                        stroke={chartColors.total}
                        fill="url(#dashboardTotalGradient)"
                        strokeWidth={3}
                      />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className={dashboardSectionClass}>
            <div className="border-b border-border px-5 py-5">
              <p className={sectionEyebrowClass}>
                Status da frota
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Distribuicao atual dos veiculos
              </h2>
            </div>

            <div className="relative h-[300px] p-4 md:h-[320px] md:p-6">
              {loading ? (
                <StateBlock message="Organizando o status da frota..." tone="info" />
              ) : fleetStatusData.length === 0 ? (
                <StateBlock message="Nenhum status disponivel para exibir." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="82%">
                    <PieChart>
                      <Pie
                        data={fleetStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={104}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {fleetStatusData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value, name) => [value, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full border border-blue-100 bg-white/95 px-5 py-4 text-center shadow-[0_12px_28px_rgba(37,99,235,0.1)] dark:border-yellow-400/10 dark:bg-[linear-gradient(180deg,rgba(8,8,10,0.92),rgba(15,15,17,0.98))]">
                      <p className={sectionMetaLabelClass}>
                        Frota
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                        {totalVeiculos}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {fleetStatusData.map((item) => (
                      <span
                        key={item.name}
                        className={cn("inline-flex items-center gap-2", softPillClass)}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}: {item.value}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card className={dashboardSectionClass}>
            <div className="border-b border-border px-5 py-5">
              <p className={sectionNeutralEyebrowClass}>
                Movimento do mes
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Volume operacional
              </h2>
            </div>

            <div className="h-[230px] p-4 md:p-6">
              {loading ? (
                <StateBlock message="Calculando volumes do periodo..." tone="info" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operationalData} barCategoryGap={24}>
                    <CartesianGrid
                      stroke={chartColors.grid}
                      strokeDasharray="4 4"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value) => [value, "Registros"]}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {operationalData.map((item) => (
                        <Cell key={item.label} fill={item.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className={dashboardSectionClass}>
          <div className="flex flex-col gap-3 border-b border-border px-5 py-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className={sectionNeutralEyebrowClass}>
                {isAdmin ? "Rotas monitoradas" : "Rotas em acompanhamento"}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                {isAdmin ? "Rotas em andamento agora" : "Rotas ativas da sua operacao"}
              </h2>
            </div>

            <Button
              size="sm"
              variant="outline"
              className={actionOutlineClass}
              onClick={() => router.push("/rotas")}
            >
              Abrir modulo
            </Button>
          </div>

          <div className="p-4 md:p-5">
            {loading ? (
              <StateBlock message="Buscando as rotas em andamento..." tone="info" />
            ) : ultimasRotasEmAndamento.length === 0 ? (
              <StateBlock message="Nenhuma rota em andamento no momento." />
            ) : (
              <div className="space-y-3">
                {ultimasRotasEmAndamento.map((route) => (
                  <div
                    key={route.id}
                    className={detailCardClass}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {route.vehiclePlate} - {route.vehicleModel}
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Motorista: {route.driverName}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {route.origem || "Origem nao informada"} -&gt;{" "}
                          {route.destino || "Destino nao informado"}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 md:min-w-[320px]">
                        <div className={detailStatClass}>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                            Inicio
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatTime(route.startAt)}
                          </p>
                        </div>
                        <div className={detailStatClass}>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                            KM inicial
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatNumber(route.startKm, " km")}
                          </p>
                        </div>
                        <div className={detailAccentStatClass}>
                          <p className={detailAccentLabelClass}>
                            Duracao
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {`${getHoursSince(route.startAt) ?? 0}h`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className={dashboardSectionClass}>
          <div className="flex flex-col gap-3 border-b border-border px-5 py-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className={sectionEyebrowClass}>
                Combustivel
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                {isAdmin ? "Ultimos abastecimentos do mes" : "Seus abastecimentos mais recentes"}
              </h2>
            </div>

            <Button
              size="sm"
              variant="outline"
              className={actionOutlineClass}
              onClick={() => router.push("/abastecimentos")}
            >
              Abrir modulo
            </Button>
          </div>

          <div className="p-4 md:p-5">
            {loading ? (
              <StateBlock message="Buscando os abastecimentos mais recentes..." tone="info" />
            ) : ultimosAbastecimentos.length === 0 ? (
              <StateBlock message="Nenhum abastecimento registrado neste mes." />
            ) : (
              <div className="space-y-3">
                {ultimosAbastecimentos.map((fueling) => (
                  <div
                    key={fueling.id}
                    className={detailCardClass}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {fueling.vehiclePlate} - {fueling.vehicleModel}
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {fueling.storeId}
                        </p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {formatDateTime(fueling.date)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 md:min-w-[240px]">
                        <div className={detailStatClass}>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                            Litros
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatNumber(fueling.liters, " L")}
                          </p>
                        </div>
                        <div className={detailAccentStatClass}>
                          <p className={detailAccentLabelClass}>
                            Total
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(fueling.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card
        className={cn(
          "app-table-wrap gap-0 overflow-hidden py-0",
          !isDarkTheme &&
            "border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(255,255,255,0.99))] shadow-[0_20px_48px_rgba(37,99,235,0.11)]"
        )}
      >
        <div className="flex flex-col gap-3 border-b border-border px-5 py-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className={sectionEyebrowClass}>
              Manutencao
            </p>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              {isAdmin ? "Manutencoes em andamento" : "Manutencoes que exigem retorno"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Acompanhamento rapido dos veiculos que ainda nao foram liberados.
            </p>
          </div>

          <div className={sectionMetaCardClass}>
            <div className="flex items-center gap-3">
              <div>
                <p className={sectionMetaLabelClass}>
                  Abertas agora
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  {loading ? "--" : qtdManutencoesEmAndamento}
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className={actionOutlineClass}
                onClick={() => router.push("/manutencoes")}
              >
                Abrir modulo
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-4 md:p-5">
            <StateBlock message="Buscando as manutencoes em andamento..." tone="info" />
          </div>
        ) : manutencoesEmAndamento.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhuma manutencao em andamento no momento.
          </div>
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {manutencoesEmAndamento.map((maintenance) => (
                <div
                  key={maintenance.id}
                  className={detailCardClass}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {maintenance.vehiclePlate} - {maintenance.vehicleModel}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {maintenance.type}
                      </p>
                    </div>

                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                        (getDaysSince(maintenance.date) ?? 0) >= 7
                          ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                          : "border border-blue-200 bg-blue-50 text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
                      )}
                    >
                      {(getDaysSince(maintenance.date) ?? 0) >= 7 ? "Critica" : "Monitorar"}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className={detailStatClass}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Data
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {formatDateTime(maintenance.date)}
                      </p>
                    </div>
                    <div className={detailStatClass}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Loja
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {maintenance.storeId}
                      </p>
                    </div>
                    <div className={detailAccentStatClass}>
                      <p className={detailAccentLabelClass}>
                        Custo
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(maintenance.cost)}
                      </p>
                    </div>
                    <div className={detailStatClass}>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        Dias abertos
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {`${getDaysSince(maintenance.date) ?? 0} dia(s)`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Veiculo</th>
                    <th>Loja</th>
                    <th>Tipo</th>
                    <th>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {manutencoesEmAndamento.map((maintenance) => (
                    <tr key={maintenance.id}>
                      <td>{formatDateTime(maintenance.date)}</td>
                      <td>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {maintenance.vehiclePlate}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {maintenance.vehicleModel}
                          </p>
                        </div>
                      </td>
                      <td>{maintenance.storeId}</td>
                      <td>
                        <div className="space-y-1">
                          <p>{maintenance.type}</p>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                              (getDaysSince(maintenance.date) ?? 0) >= 7
                                ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                                : "border border-blue-200 bg-blue-50 text-blue-700 dark:border-yellow-400/20 dark:bg-yellow-400/10 dark:text-yellow-200"
                            )}
                          >
                            {(getDaysSince(maintenance.date) ?? 0) >= 7 ? "Critica" : "Monitorar"}
                          </span>
                        </div>
                      </td>
                      <td className="font-semibold text-slate-900 dark:text-white">
                        <div className="space-y-1">
                          <p>{formatCurrency(maintenance.cost)}</p>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {`${getDaysSince(maintenance.date) ?? 0} dia(s) aberto`}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
