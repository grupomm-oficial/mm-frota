"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import {
  BarChart3,
  Building2,
  CalendarRange,
  Car,
  FileText,
  Fuel,
  Gauge,
  MapPinned,
  Route as RouteIcon,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildMonthlyTrendData,
  buildReportAnalytics,
  formatMonthLabel,
  getCurrentMonthKey,
  getMonthBounds,
  getPreviousMonthKey,
  type ReportMaintenanceRecord,
  type ReportRefuelRecord,
  type ReportRouteRecord,
  type ReportVehicleRecord,
} from "@/lib/reporting";

interface MonthlySummary {
  id: string;
  monthKey: string;
  year: number;
  month: number;
  totalKmRodado: number;
  totalLitros?: number;
  totalCombustivel: number;
  totalManutencao: number;
  totalCusto?: number;
  kmMedioPorVeiculo: number;
  costPerKm?: number;
  kmPorLitro?: number;
  routesCount?: number;
  refuelsCount?: number;
  maintenancesCount?: number;
  activeVehicles?: number;
  responsiblesCount?: number;
  driversCount?: number;
  createdAt?: string | null;
}

type ReportTab = "overview" | "vehicles" | "responsibles" | "drivers";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const chartTooltipStyle = {
  backgroundColor: "#07111f",
  border: "1px solid rgba(245, 158, 11, 0.35)",
  borderRadius: 16,
  color: "#e5e7eb",
  fontSize: 12,
  boxShadow: "0 20px 40px rgba(2, 6, 23, 0.45)",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatNumber(value: number, suffix = "") {
  return `${numberFormatter.format(value || 0)}${suffix}`;
}

function formatPercent(value: number) {
  return percentFormatter.format(value || 0);
}

function formatDelta(
  currentValue: number,
  previousValue: number,
  formatter: (value: number) => string
) {
  if (!previousValue && !currentValue) {
    return { label: "Sem variação", tone: "neutral" as const };
  }

  if (!previousValue) {
    return { label: "Sem base anterior", tone: "neutral" as const };
  }

  const delta = currentValue - previousValue;
  const signal = delta === 0 ? "" : delta > 0 ? "+" : "-";
  const tone =
    delta === 0 ? ("neutral" as const) : delta > 0 ? ("up" as const) : ("down" as const);

  return {
    label: `${signal}${formatter(Math.abs(delta))} vs. mês anterior`,
    tone,
  };
}

function DeltaBadge({
  currentValue,
  previousValue,
  formatter,
}: {
  currentValue: number;
  previousValue: number;
  formatter: (value: number) => string;
}) {
  const delta = formatDelta(currentValue, previousValue, formatter);

  const toneClass =
    delta.tone === "up"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : delta.tone === "down"
      ? "border-red-400/30 bg-red-500/10 text-red-200"
      : "border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${toneClass}`}
    >
      {delta.label}
    </span>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
  delta,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  delta?: React.ReactNode;
}) {
  return (
    <Card className="app-panel-muted overflow-hidden">
      <div className="relative h-full p-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
          </div>
          <div className={`rounded-2xl border px-3 py-3 ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-300">{subtitle}</p>
        {delta ? <div className="mt-4">{delta}</div> : null}
      </div>
    </Card>
  );
}

function InsightCard({
  title,
  label,
  value,
}: {
  title: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/90 p-4 dark:border-white/10 dark:bg-slate-950/70">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{label}</p>
      <p className="mt-2 text-sm text-amber-300">{value}</p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-white/70 px-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
      {text}
    </div>
  );
}

const reportPanelClass = "app-panel p-5";
const reportPanelWideClass = "app-panel p-5 md:p-6";
const reportTablePanelClass = "app-panel p-5";
const reportTableHeadClass =
  "border-b border-slate-200 text-left text-slate-500 dark:border-white/10 dark:text-slate-400";
const reportTableRowClass =
  "border-b border-slate-200/80 text-slate-700 transition hover:bg-slate-50 dark:border-white/5 dark:text-slate-200 dark:hover:bg-white/[0.03]";

export default function RelatoriosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<ReportRouteRecord[]>([]);
  const [refuels, setRefuels] = useState<ReportRefuelRecord[]>([]);
  const [maintenances, setMaintenances] = useState<ReportMaintenanceRecord[]>(
    []
  );
  const [vehicles, setVehicles] = useState<ReportVehicleRecord[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>(
    []
  );

  const [referenceMonthKey, setReferenceMonthKey] = useState(
    getCurrentMonthKey()
  );
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [closingMonth, setClosingMonth] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  useEffect(() => {
    setErrorMsg("");
    setSuccessMsg("");
  }, [referenceMonthKey]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        setLoading(true);
        setErrorMsg("");

        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        const allVehicles: ReportVehicleRecord[] = vehiclesSnap.docs.map((docItem) => {
          const data = docItem.data();

          return {
            id: docItem.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            currentKm: Number(data.currentKm ?? 0),
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            responsibleUserIds: Array.isArray(data.responsibleUserIds)
              ? data.responsibleUserIds
              : undefined,
            responsibleUsers: Array.isArray(data.responsibleUsers)
              ? data.responsibleUsers
              : undefined,
          };
        });

        const userCanUseVehicle = (vehicle: ReportVehicleRecord) => {
          if (!user) return false;
          if (user.role === "admin") return true;

          const singleMatch = vehicle.responsibleUserId === user.id;
          const multiMatch = vehicle.responsibleUserIds?.includes(user.id) ?? false;

          return singleMatch || multiMatch;
        };

        const visibleVehicles = isAdmin
          ? allVehicles
          : allVehicles.filter(userCanUseVehicle);

        const vehicleById = new Map<string, ReportVehicleRecord>();
        allVehicles.forEach((vehicle) => vehicleById.set(vehicle.id, vehicle));

        const routesSnap = await getDocs(collection(db, "routes"));
        const allRoutes: ReportRouteRecord[] = routesSnap.docs.map((docItem) => {
          const data = docItem.data();

          return {
            id: docItem.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            driverId: data.driverId,
            driverName: data.driverName,
            storeId: data.storeId ?? data.vehicleStoreId ?? null,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName ?? null,
            startKm: Number(data.startKm ?? 0),
            endKm: data.endKm != null ? Number(data.endKm) : null,
            distanceKm:
              data.distanceKm != null ? Number(data.distanceKm) : null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            canceledAt: data.canceledAt ?? null,
            status: (data.status ?? "em_andamento") as
              | "em_andamento"
              | "finalizada"
              | "cancelada",
          };
        });

        const visibleRoutes = isAdmin
          ? allRoutes
          : allRoutes.filter((route) => {
              if (route.responsibleUserId === user.id) return true;
              const vehicle = vehicleById.get(route.vehicleId);
              return vehicle ? userCanUseVehicle(vehicle) : false;
            });

        const refuelsSnap = await getDocs(collection(db, "fuelings"));
        const allRefuels: ReportRefuelRecord[] = refuelsSnap.docs.map((docItem) => {
          const data = docItem.data();

          return {
            id: docItem.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            storeId: data.storeId,
            liters: Number(data.liters ?? 0),
            totalCost: Number(data.totalCost ?? data.total ?? 0),
            pricePerLiter:
              data.pricePerLiter != null
                ? Number(data.pricePerLiter)
                : data.pricePerL != null
                ? Number(data.pricePerL)
                : null,
            odometerKm:
              data.odometerKm != null ? Number(data.odometerKm) : null,
            date: data.date ?? null,
            stationName: data.stationName ?? null,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName ?? null,
          };
        });

        const visibleRefuels = isAdmin
          ? allRefuels
          : allRefuels.filter((refuel) => {
              if (refuel.responsibleUserId === user.id) return true;
              const vehicle = vehicleById.get(refuel.vehicleId);
              return vehicle ? userCanUseVehicle(vehicle) : false;
            });

        const maintenancesSnap = await getDocs(collection(db, "maintenances"));
        const allMaintenances: ReportMaintenanceRecord[] = maintenancesSnap.docs.map(
          (docItem) => {
            const data = docItem.data();

            return {
              id: docItem.id,
              vehicleId: data.vehicleId,
              vehiclePlate: data.vehiclePlate,
              vehicleModel: data.vehicleModel,
              storeId: data.storeId,
              cost: Number(data.cost ?? 0),
              type: data.type,
              status: (data.status ?? "em_andamento") as
                | "em_andamento"
                | "concluida",
              date: data.date ?? null,
              endDate: data.endDate ?? null,
              odometerKm:
                data.odometerKm != null ? Number(data.odometerKm) : null,
              endKm: data.endKm != null ? Number(data.endKm) : null,
              responsibleUserId: data.responsibleUserId,
              responsibleUserName: data.responsibleUserName ?? null,
            };
          }
        );

        const visibleMaintenances = isAdmin
          ? allMaintenances
          : allMaintenances.filter((maintenance) => {
              if (maintenance.responsibleUserId === user.id) return true;
              const vehicle = vehicleById.get(maintenance.vehicleId);
              return vehicle ? userCanUseVehicle(vehicle) : false;
            });

        let summaries: MonthlySummary[] = [];
        if (isAdmin) {
          const summariesSnap = await getDocs(collection(db, "monthlySummaries"));
          summaries = summariesSnap.docs
            .map((docItem) => {
              const data = docItem.data();
              const createdAtDate =
                data.createdAt && data.createdAt.toDate
                  ? data.createdAt.toDate()
                  : null;

              return {
                id: docItem.id,
                monthKey: data.monthKey ?? docItem.id,
                year: Number(data.year ?? 0),
                month: Number(data.month ?? 0),
                totalKmRodado: Number(data.totalKmRodado ?? 0),
                totalLitros: Number(data.totalLitros ?? 0),
                totalCombustivel: Number(data.totalCombustivel ?? 0),
                totalManutencao: Number(data.totalManutencao ?? 0),
                totalCusto: Number(data.totalCusto ?? 0),
                kmMedioPorVeiculo: Number(data.kmMedioPorVeiculo ?? 0),
                costPerKm: Number(data.costPerKm ?? 0),
                kmPorLitro: Number(data.kmPorLitro ?? 0),
                routesCount: Number(data.routesCount ?? 0),
                refuelsCount: Number(data.refuelsCount ?? 0),
                maintenancesCount: Number(data.maintenancesCount ?? 0),
                activeVehicles: Number(data.activeVehicles ?? 0),
                responsiblesCount: Number(data.responsiblesCount ?? 0),
                driversCount: Number(data.driversCount ?? 0),
                createdAt: createdAtDate
                  ? createdAtDate.toISOString()
                  : null,
              };
            })
            .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        }

        setVehicles(visibleVehicles);
        setRoutes(visibleRoutes);
        setRefuels(visibleRefuels);
        setMaintenances(visibleMaintenances);
        setMonthlySummaries(summaries);
      } catch (error) {
        console.error("Erro ao carregar relatórios:", error);
        setErrorMsg(
          "Não foi possível carregar os dados analíticos dos relatórios."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, isAdmin, router]);

  const monthlyTrend = useMemo(
    () =>
      buildMonthlyTrendData({
        routes,
        refuels,
        maintenances,
      }),
    [routes, refuels, maintenances]
  );

  const analytics = useMemo(
    () =>
      buildReportAnalytics({
        monthKey: referenceMonthKey,
        routes,
        refuels,
        maintenances,
        vehicles,
      }),
    [referenceMonthKey, routes, refuels, maintenances, vehicles]
  );

  const previousMonthKey = useMemo(
    () => getPreviousMonthKey(referenceMonthKey),
    [referenceMonthKey]
  );

  const previousAnalytics = useMemo(
    () =>
      buildReportAnalytics({
        monthKey: previousMonthKey,
        routes,
        refuels,
        maintenances,
        vehicles,
      }),
    [previousMonthKey, routes, refuels, maintenances, vehicles]
  );

  const selectedSummary = useMemo(
    () =>
      monthlySummaries.find((summary) => summary.monthKey === referenceMonthKey),
    [monthlySummaries, referenceMonthKey]
  );

  const monthBounds = useMemo(
    () => getMonthBounds(referenceMonthKey),
    [referenceMonthKey]
  );

  const topVehicleRows = analytics.vehicleRows.filter((item) => item.hasActivity);
  const topResponsibleRows = analytics.responsibleRows;
  const topDriverRows = analytics.driverRows;
  const storeRows = analytics.storeRows;

  if (!user) return null;

  async function handleCloseSelectedMonth() {
    if (!user) return;

    try {
      setClosingMonth(true);
      setErrorMsg("");
      setSuccessMsg("");

      const hasAnyData =
        analytics.filteredRoutes.length > 0 ||
        analytics.filteredRefuels.length > 0 ||
        analytics.filteredMaintenances.length > 0;

      if (!hasAnyData) {
        setErrorMsg(
          "Não há dados registrados no mês selecionado para gerar o fechamento."
        );
        return;
      }

      const [yearStr, monthStr] = referenceMonthKey.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);

      const payload = {
        monthKey: referenceMonthKey,
        year,
        month,
        periodStart: monthBounds.startDate,
        periodEnd: monthBounds.endDate,
        totalKmRodado: analytics.overview.totalKm,
        totalLitros: analytics.overview.totalLiters,
        totalCombustivel: analytics.overview.totalFuelCost,
        totalManutencao: analytics.overview.totalMaintenanceCost,
        totalCusto: analytics.overview.totalCost,
        kmMedioPorVeiculo:
          analytics.overview.vehiclesWithMovement > 0
            ? analytics.overview.totalKm /
              analytics.overview.vehiclesWithMovement
            : 0,
        costPerKm: analytics.overview.costPerKm,
        kmPorLitro: analytics.overview.kmPerLiter,
        avgFuelTicket: analytics.overview.avgFuelTicket,
        avgMaintenanceTicket: analytics.overview.avgMaintenanceTicket,
        vehiclesWithMovement: analytics.overview.vehiclesWithMovement,
        activeVehicles: analytics.overview.activeVehicles,
        routesCount: analytics.overview.totalRoutes,
        finishedRoutesCount: analytics.overview.finishedRoutes,
        cancelledRoutesCount: analytics.overview.cancelledRoutes,
        refuelsCount: analytics.overview.refuelsCount,
        maintenancesCount: analytics.overview.maintenancesCount,
        responsiblesCount: analytics.overview.responsiblesCount,
        driversCount: analytics.overview.driversCount,
        topVehicle:
          topVehicleRows.find((item) => item.totalCost > 0 || item.km > 0)
            ?.vehicleLabel ?? null,
        topResponsible: topResponsibleRows[0]?.responsibleName ?? null,
        updatedById: user.id,
        updatedByName: user.name,
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "monthlySummaries", referenceMonthKey), payload);

      const localSummary: MonthlySummary = {
        id: referenceMonthKey,
        monthKey: referenceMonthKey,
        year,
        month,
        totalKmRodado: analytics.overview.totalKm,
        totalLitros: analytics.overview.totalLiters,
        totalCombustivel: analytics.overview.totalFuelCost,
        totalManutencao: analytics.overview.totalMaintenanceCost,
        totalCusto: analytics.overview.totalCost,
        kmMedioPorVeiculo:
          analytics.overview.vehiclesWithMovement > 0
            ? analytics.overview.totalKm /
              analytics.overview.vehiclesWithMovement
            : 0,
        costPerKm: analytics.overview.costPerKm,
        kmPorLitro: analytics.overview.kmPerLiter,
        routesCount: analytics.overview.totalRoutes,
        refuelsCount: analytics.overview.refuelsCount,
        maintenancesCount: analytics.overview.maintenancesCount,
        activeVehicles: analytics.overview.activeVehicles,
        responsiblesCount: analytics.overview.responsiblesCount,
        driversCount: analytics.overview.driversCount,
        createdAt: new Date().toISOString(),
      };

      setMonthlySummaries((current) => {
        const next = current.filter(
          (summary) => summary.monthKey !== referenceMonthKey
        );
        next.unshift(localSummary);
        return next.sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      });

      setSuccessMsg(
        selectedSummary
          ? `Fechamento de ${formatMonthLabel(referenceMonthKey)} atualizado com sucesso.`
          : `Fechamento de ${formatMonthLabel(referenceMonthKey)} gerado com sucesso.`
      );
    } catch (error) {
      console.error("Erro ao gerar fechamento mensal:", error);
      setErrorMsg(
        "Não foi possível concluir o fechamento do mês selecionado. Tente novamente."
      );
    } finally {
      setClosingMonth(false);
    }
  }

  return (
    <div className="app-page" data-report-page>
      <PageHeader
        eyebrow="Central analitica"
        title="Relatorios executivos da frota"
        description="Acompanhe custos, produtividade, fechamento mensal e comportamento da frota com uma leitura mais clara e organizada."
        icon={BarChart3}
        iconTone="yellow"
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              Competencia: {analytics.monthLabel}
            </span>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              Periodo: {monthBounds.startDate} ate {monthBounds.endDate}
            </span>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {isAdmin ? "Visao corporativa" : "Dados do seu escopo"}
            </span>
            {selectedSummary ? (
              <span className="app-chip border-emerald-400/25 bg-emerald-500/10 text-emerald-200 dark:text-emerald-200">
                Fechamento salvo neste mes
              </span>
            ) : null}
          </>
        }
      />

      <Card className={reportPanelWideClass}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Competencia e fechamento
            </p>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Controle do periodo analisado
            </h2>
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              Troque o mes de referencia, revise o resumo rapido e gere o fechamento mensal quando necessario.
            </p>
          </div>

          <div className="w-full max-w-xl space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Mes de referencia
                </label>
                <Input
                  type="month"
                  value={referenceMonthKey}
                  onChange={(event) => setReferenceMonthKey(event.target.value)}
                  className="h-11 rounded-2xl border-slate-200 bg-white dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                onClick={() => setReferenceMonthKey(getCurrentMonthKey())}
              >
                Mes atual
              </Button>
              {isAdmin ? (
                <Button
                  type="button"
                  onClick={handleCloseSelectedMonth}
                  disabled={closingMonth}
                >
                  <FileText className="h-4 w-4" />
                  {closingMonth
                    ? "Fechando..."
                    : selectedSummary
                    ? "Atualizar fechamento"
                    : "Fechar mes"}
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Custo total
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                  {formatCurrency(analytics.overview.totalCost)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Km rodado
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                  {formatNumber(analytics.overview.totalKm, " km")}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Eficiencia
                </p>
                <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                  {analytics.overview.kmPerLiter > 0
                    ? formatNumber(analytics.overview.kmPerLiter, " km/L")
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}

      {successMsg ? (
        <StatusBanner tone="success">{successMsg}</StatusBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Custo Total"
          value={formatCurrency(analytics.overview.totalCost)}
          subtitle="Combustível e manutenção consolidados no período."
          icon={TrendingUp}
          accent="border-amber-400/20 bg-amber-500/10 text-amber-300"
          delta={
            <DeltaBadge
              currentValue={analytics.overview.totalCost}
              previousValue={previousAnalytics.overview.totalCost}
              formatter={formatCurrency}
            />
          }
        />
        <KpiCard
          title="Km Rodado"
          value={formatNumber(analytics.overview.totalKm, " km")}
          subtitle="Distância total percorrida nas rotas registradas."
          icon={MapPinned}
          accent="border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
          delta={
            <DeltaBadge
              currentValue={analytics.overview.totalKm}
              previousValue={previousAnalytics.overview.totalKm}
              formatter={(value) => formatNumber(value, " km")}
            />
          }
        />
        <KpiCard
          title="Consumo Médio"
          value={
            analytics.overview.kmPerLiter > 0
              ? formatNumber(analytics.overview.kmPerLiter, " km/L")
              : "-"
          }
          subtitle="Relação entre quilômetros rodados e litros abastecidos."
          icon={Gauge}
          accent="border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
          delta={
            <DeltaBadge
              currentValue={analytics.overview.kmPerLiter}
              previousValue={previousAnalytics.overview.kmPerLiter}
              formatter={(value) => formatNumber(value, " km/L")}
            />
          }
        />
        <KpiCard
          title="Custo por Km"
          value={
            analytics.overview.costPerKm > 0
              ? formatCurrency(analytics.overview.costPerKm)
              : "-"
          }
          subtitle="Quanto a operação está custando para cada quilômetro rodado."
          icon={RouteIcon}
          accent="border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-300"
          delta={
            <DeltaBadge
              currentValue={analytics.overview.costPerKm}
              previousValue={previousAnalytics.overview.costPerKm}
              formatter={formatCurrency}
            />
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Combustível"
          value={formatCurrency(analytics.overview.totalFuelCost)}
          subtitle={`${integerFormatter.format(
            analytics.overview.refuelsCount
          )} abastecimento(s) e ${formatNumber(
            analytics.overview.totalLiters,
            " L"
          )}.`}
          icon={Fuel}
          accent="border-amber-400/20 bg-amber-500/10 text-amber-300"
        />
        <KpiCard
          title="Manutenção"
          value={formatCurrency(analytics.overview.totalMaintenanceCost)}
          subtitle={`${integerFormatter.format(
            analytics.overview.maintenancesCount
          )} registro(s) no período.`}
          icon={Wrench}
          accent="border-sky-400/20 bg-sky-500/10 text-sky-300"
        />
        <KpiCard
          title="Veículos Ativos"
          value={integerFormatter.format(analytics.overview.activeVehicles)}
          subtitle={`${integerFormatter.format(
            analytics.overview.idleVehicles
          )} sem movimentação no mês.`}
          icon={Car}
          accent="border-indigo-400/20 bg-indigo-500/10 text-indigo-300"
        />
        <KpiCard
          title="Fechamento de Rotas"
          value={formatPercent(analytics.overview.completionRate)}
          subtitle={`${integerFormatter.format(
            analytics.overview.finishedRoutes
          )} finalizadas e ${integerFormatter.format(
            analytics.overview.cancelledRoutes
          )} canceladas.`}
          icon={Users}
          accent="border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "overview", label: "Visão executiva", icon: BarChart3 },
          { key: "vehicles", label: "Veículos", icon: Car },
          { key: "responsibles", label: "Responsáveis", icon: Users },
          { key: "drivers", label: "Motoristas", icon: RouteIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as ReportTab)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                active
                  ? "border-amber-400/30 bg-amber-500 text-slate-950"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <Card className={reportPanelWideClass}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Carregando painel analítico...</p>
        </Card>
      ) : null}

      {!loading && activeTab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <Card className={reportPanelClass}>
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Evolução mensal
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Custo e quilometragem dos últimos meses
                  </h2>
                </div>
                <span className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] px-3 py-1 text-xs text-slate-600 dark:text-slate-300">
                  Últimos {monthlyTrend.length} mês(es)
                </span>
              </div>

              {monthlyTrend.length === 0 ? (
                <EmptyPanel text="Nenhum histórico suficiente para montar a evolução mensal." />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyTrend}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="cost"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
                      />
                      <YAxis
                        yAxisId="km"
                        orientation="right"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${Number(value).toFixed(0)} km`}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number, name: string) => {
                          if (name === "Km") return [formatNumber(value, " km"), name];
                          return [formatCurrency(value), name];
                        }}
                      />
                      <Legend />
                      <Bar
                        yAxisId="cost"
                        dataKey="fuelCost"
                        name="Combustível"
                        stackId="cost"
                        fill="#f59e0b"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        yAxisId="cost"
                        dataKey="maintenanceCost"
                        name="Manutenção"
                        stackId="cost"
                        fill="#38bdf8"
                        radius={[8, 8, 0, 0]}
                      />
                      <Line
                        yAxisId="km"
                        type="monotone"
                        dataKey="km"
                        name="Km"
                        stroke="#34d399"
                        strokeWidth={3}
                        dot={{ r: 3, fill: "#34d399" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className={reportPanelClass}>
              <div className="mb-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Composição do custo
                </p>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Onde o mês consumiu mais orçamento
                </h2>
              </div>

              {analytics.costComposition.length === 0 ? (
                <EmptyPanel text="Sem custos no período selecionado para compor o gráfico." />
              ) : (
                <>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.costComposition}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={75}
                          outerRadius={110}
                          paddingAngle={4}
                        >
                          {analytics.costComposition.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2">
                    {analytics.costComposition.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.fill }}
                          />
                          {item.name}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-slate-950 dark:text-white">
                            {formatCurrency(item.value)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatPercent(item.value / analytics.overview.totalCost)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className={reportPanelClass}>
              <div className="mb-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Insights prioritários
                </p>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Principais destaques do mês
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {analytics.insights.topCostVehicle ? (
                  <InsightCard
                    title={analytics.insights.topCostVehicle.title}
                    label={analytics.insights.topCostVehicle.label}
                    value={formatCurrency(analytics.insights.topCostVehicle.value)}
                  />
                ) : null}
                {analytics.insights.topDistanceVehicle ? (
                  <InsightCard
                    title={analytics.insights.topDistanceVehicle.title}
                    label={analytics.insights.topDistanceVehicle.label}
                    value={formatNumber(
                      analytics.insights.topDistanceVehicle.value,
                      " km"
                    )}
                  />
                ) : null}
                {analytics.insights.bestEfficiencyVehicle ? (
                  <InsightCard
                    title={analytics.insights.bestEfficiencyVehicle.title}
                    label={analytics.insights.bestEfficiencyVehicle.label}
                    value={formatNumber(
                      analytics.insights.bestEfficiencyVehicle.value,
                      " km/L"
                    )}
                  />
                ) : null}
                {analytics.insights.topResponsible ? (
                  <InsightCard
                    title={analytics.insights.topResponsible.title}
                    label={analytics.insights.topResponsible.label}
                    value={formatCurrency(analytics.insights.topResponsible.value)}
                  />
                ) : null}
                {analytics.insights.topDriver ? (
                  <InsightCard
                    title={analytics.insights.topDriver.title}
                    label={analytics.insights.topDriver.label}
                    value={formatNumber(analytics.insights.topDriver.value, " km")}
                  />
                ) : null}
              </div>
            </Card>

            <Card className={reportPanelClass}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Saúde operacional
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Indicadores complementares
                  </h2>
                </div>
                <CalendarRange className="h-5 w-5 text-amber-300" />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ticket médio do abastecimento</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {analytics.overview.avgFuelTicket > 0
                      ? formatCurrency(analytics.overview.avgFuelTicket)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ticket médio da manutenção</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {analytics.overview.avgMaintenanceTicket > 0
                      ? formatCurrency(analytics.overview.avgMaintenanceTicket)
                      : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Distância média por rota</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {analytics.overview.avgRouteDistance > 0
                      ? formatNumber(analytics.overview.avgRouteDistance, " km")
                      : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">Taxa de cancelamento</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {formatPercent(analytics.overview.cancellationRate)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className={reportPanelClass}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Ranking de custo
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Veículos mais caros no mês
                  </h2>
                </div>
                <Car className="h-5 w-5 text-amber-300" />
              </div>

              {analytics.topVehicleCostChart.length === 0 ? (
                <EmptyPanel text="Nenhum veículo com custo registrado no período." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.topVehicleCostChart}>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="totalCost" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className={reportPanelClass}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Ranking de responsáveis
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Quem concentrou mais custo no mês
                  </h2>
                </div>
                <Users className="h-5 w-5 text-cyan-300" />
              </div>

              {analytics.responsibleCostChart.length === 0 ? (
                <EmptyPanel text="Nenhum responsável com movimentação no período." />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.responsibleCostChart} layout="vertical">
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="totalCost" fill="#38bdf8" radius={[0, 10, 10, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {storeRows.length > 0 ? (
            <Card className={reportPanelClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Performance por loja
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Consolidado operacional por unidade
                  </h2>
                </div>
                <Building2 className="h-5 w-5 text-emerald-300" />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className={reportTableHeadClass}>
                    <tr>
                      <th className="py-3 pr-4">Loja</th>
                      <th className="py-3 px-4">Km</th>
                      <th className="py-3 px-4">Combustível</th>
                      <th className="py-3 px-4">Manutenção</th>
                      <th className="py-3 px-4">Custo total</th>
                      <th className="py-3 px-4">Veículos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeRows.map((store) => (
                      <tr
                        key={store.key}
                        className={reportTableRowClass}
                      >
                        <td className="py-3 pr-4 font-medium text-slate-950 dark:text-white">
                          {store.storeId}
                        </td>
                        <td className="py-3 px-4">{formatNumber(store.km, " km")}</td>
                        <td className="py-3 px-4">{formatCurrency(store.fuelCost)}</td>
                        <td className="py-3 px-4">
                          {formatCurrency(store.maintenanceCost)}
                        </td>
                        <td className="py-3 px-4 font-medium text-amber-300">
                          {formatCurrency(store.totalCost)}
                        </td>
                        <td className="py-3 px-4">
                          {integerFormatter.format(store.vehiclesCount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {isAdmin ? (
            <Card className={reportPanelClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Fechamentos gerados
                  </p>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Histórico de fechamentos mensais
                  </h2>
                </div>
                <FileText className="h-5 w-5 text-amber-300" />
              </div>

              {monthlySummaries.length === 0 ? (
                <EmptyPanel text="Nenhum fechamento salvo até o momento." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className={reportTableHeadClass}>
                      <tr>
                        <th className="py-3 pr-4">Competência</th>
                        <th className="py-3 px-4">Custo total</th>
                        <th className="py-3 px-4">Km</th>
                        <th className="py-3 px-4">Km/L</th>
                        <th className="py-3 px-4">Custo/Km</th>
                        <th className="py-3 px-4">Rotas</th>
                        <th className="py-3 px-4">Gerado em</th>
                        <th className="py-3 pl-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummaries.map((summary) => (
                        <tr
                          key={summary.id}
                          className={reportTableRowClass}
                        >
                          <td className="py-3 pr-4 font-medium text-slate-950 dark:text-white">
                            {formatMonthLabel(summary.monthKey)}
                          </td>
                          <td className="py-3 px-4 text-amber-300">
                            {formatCurrency(
                              summary.totalCusto ??
                                summary.totalCombustivel +
                                  summary.totalManutencao
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {formatNumber(summary.totalKmRodado, " km")}
                          </td>
                          <td className="py-3 px-4">
                            {summary.kmPorLitro
                              ? formatNumber(summary.kmPorLitro, " km/L")
                              : "-"}
                          </td>
                          <td className="py-3 px-4">
                            {summary.costPerKm
                              ? formatCurrency(summary.costPerKm)
                              : "-"}
                          </td>
                          <td className="py-3 px-4">
                            {integerFormatter.format(summary.routesCount ?? 0)}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                            {summary.createdAt
                              ? new Date(summary.createdAt).toLocaleString("pt-BR")
                              : "-"}
                          </td>
                          <td className="py-3 pl-4 text-right">
                            <ActionIconButton
                              action="view"
                              className="border-amber-400/35 text-amber-700 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-500/10"
                              label={`Ver fechamento de ${formatMonthLabel(summary.monthKey)}`}
                              onClick={() =>
                                router.push(
                                  `/relatorios/fechamento/${summary.monthKey}`
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {!loading && activeTab === "vehicles" ? (
        <div className="space-y-4">
          <Card className={reportPanelClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Veículos
                </p>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Custos, consumo e produtividade por veículo
                </h2>
              </div>
              <Car className="h-5 w-5 text-amber-300" />
            </div>

            {analytics.topVehicleKmChart.length === 0 ? (
              <EmptyPanel text="Nenhum veículo com quilometragem registrada no período." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.topVehicleKmChart}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${Number(value).toFixed(0)} km`}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatNumber(value, " km")}
                    />
                    <Area
                      type="monotone"
                      dataKey="km"
                      stroke="#f59e0b"
                      fill="rgba(245,158,11,0.35)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className={reportTablePanelClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={reportTableHeadClass}>
                  <tr>
                    <th className="py-3 pr-4">Veículo</th>
                    <th className="py-3 px-4">Km</th>
                    <th className="py-3 px-4">Litros</th>
                    <th className="py-3 px-4">Combustível</th>
                    <th className="py-3 px-4">Manutenção</th>
                    <th className="py-3 px-4">Custo total</th>
                    <th className="py-3 px-4">Custo/Km</th>
                    <th className="py-3 px-4">Km/L</th>
                    <th className="py-3 px-4">Rotas</th>
                    <th className="py-3 px-4">Responsáveis</th>
                  </tr>
                </thead>
                <tbody>
                  {topVehicleRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Nenhuma movimentação encontrada para o mês selecionado.
                      </td>
                    </tr>
                  ) : (
                    topVehicleRows.map((vehicle) => (
                      <tr
                        key={vehicle.key}
                        className={reportTableRowClass}
                      >
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-medium text-slate-950 dark:text-white">
                              {vehicle.vehicleLabel}
                            </p>
                            <p className="text-xs text-slate-500">
                              {vehicle.storeId || "Sem loja"} · Última atividade{" "}
                              {vehicle.lastActivityAt
                                ? new Date(vehicle.lastActivityAt).toLocaleDateString(
                                    "pt-BR"
                                  )
                                : "-"}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">{formatNumber(vehicle.km, " km")}</td>
                        <td className="py-3 px-4">
                          {formatNumber(vehicle.liters, " L")}
                        </td>
                        <td className="py-3 px-4">
                          {formatCurrency(vehicle.fuelCost)}
                        </td>
                        <td className="py-3 px-4">
                          {formatCurrency(vehicle.maintenanceCost)}
                        </td>
                        <td className="py-3 px-4 font-medium text-amber-300">
                          {formatCurrency(vehicle.totalCost)}
                        </td>
                        <td className="py-3 px-4">
                          {vehicle.costPerKm > 0
                            ? formatCurrency(vehicle.costPerKm)
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          {vehicle.kmPerLiter > 0
                            ? formatNumber(vehicle.kmPerLiter, " km/L")
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          {integerFormatter.format(vehicle.routesCount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {vehicle.responsibleNames.length > 0
                            ? vehicle.responsibleNames.join(", ")
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {!loading && activeTab === "responsibles" ? (
        <div className="space-y-4">
          <Card className={reportPanelClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Responsáveis
                </p>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Gasto, quilometragem e abrangência por responsável
                </h2>
              </div>
              <Users className="h-5 w-5 text-cyan-300" />
            </div>

            {analytics.responsibleCostChart.length === 0 ? (
              <EmptyPanel text="Nenhum responsável com dados suficientes no período." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.responsibleCostChart}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `R$ ${Number(value).toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="fuelCost" name="Combustível" stackId="a" fill="#f59e0b" />
                    <Bar
                      dataKey="maintenanceCost"
                      name="Manutenção"
                      stackId="a"
                      fill="#38bdf8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className={reportTablePanelClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={reportTableHeadClass}>
                  <tr>
                    <th className="py-3 pr-4">Responsável</th>
                    <th className="py-3 px-4">Km</th>
                    <th className="py-3 px-4">Combustível</th>
                    <th className="py-3 px-4">Manutenção</th>
                    <th className="py-3 px-4">Custo total</th>
                    <th className="py-3 px-4">Veículos</th>
                    <th className="py-3 px-4">Custo/Km</th>
                    <th className="py-3 px-4">Rotas</th>
                  </tr>
                </thead>
                <tbody>
                  {topResponsibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Nenhuma movimentação encontrada para o mês selecionado.
                      </td>
                    </tr>
                  ) : (
                    topResponsibleRows.map((responsible) => (
                      <tr
                        key={responsible.key}
                        className={reportTableRowClass}
                      >
                        <td className="py-3 pr-4 font-medium text-slate-950 dark:text-white">
                          {responsible.responsibleName}
                        </td>
                        <td className="py-3 px-4">
                          {formatNumber(responsible.km, " km")}
                        </td>
                        <td className="py-3 px-4">
                          {formatCurrency(responsible.fuelCost)}
                        </td>
                        <td className="py-3 px-4">
                          {formatCurrency(responsible.maintenanceCost)}
                        </td>
                        <td className="py-3 px-4 font-medium text-amber-300">
                          {formatCurrency(responsible.totalCost)}
                        </td>
                        <td className="py-3 px-4">
                          {integerFormatter.format(responsible.vehiclesCount)}
                        </td>
                        <td className="py-3 px-4">
                          {responsible.costPerKm > 0
                            ? formatCurrency(responsible.costPerKm)
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          {integerFormatter.format(responsible.routesCount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {!loading && activeTab === "drivers" ? (
        <div className="space-y-4">
          <Card className={reportPanelClass}>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Motoristas
                </p>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Produtividade operacional por motorista
                </h2>
              </div>
              <RouteIcon className="h-5 w-5 text-emerald-300" />
            </div>

            {analytics.driverKmChart.length === 0 ? (
              <EmptyPanel text="Nenhum motorista com rotas registradas no período." />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.driverKmChart}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => `${Number(value).toFixed(0)} km`}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => formatNumber(value, " km")}
                    />
                    <Bar dataKey="km" fill="#34d399" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className={reportTablePanelClass}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={reportTableHeadClass}>
                  <tr>
                    <th className="py-3 pr-4">Motorista</th>
                    <th className="py-3 px-4">Km</th>
                    <th className="py-3 px-4">Rotas</th>
                    <th className="py-3 px-4">Média por rota</th>
                    <th className="py-3 px-4">Fechamento</th>
                    <th className="py-3 px-4">Veículos usados</th>
                    <th className="py-3 px-4">Última rota</th>
                  </tr>
                </thead>
                <tbody>
                  {topDriverRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Nenhuma movimentação encontrada para o mês selecionado.
                      </td>
                    </tr>
                  ) : (
                    topDriverRows.map((driver) => (
                      <tr
                        key={driver.key}
                        className={reportTableRowClass}
                      >
                        <td className="py-3 pr-4 font-medium text-slate-950 dark:text-white">
                          {driver.driverName}
                        </td>
                        <td className="py-3 px-4">{formatNumber(driver.km, " km")}</td>
                        <td className="py-3 px-4">
                          {integerFormatter.format(driver.routesCount)}
                        </td>
                        <td className="py-3 px-4">
                          {driver.avgRouteDistance > 0
                            ? formatNumber(driver.avgRouteDistance, " km")
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          {formatPercent(driver.completionRate)}
                        </td>
                        <td className="py-3 px-4">
                          {integerFormatter.format(driver.vehiclesCount)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {driver.lastRouteAt
                            ? new Date(driver.lastRouteAt).toLocaleDateString(
                                "pt-BR"
                              )
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}


