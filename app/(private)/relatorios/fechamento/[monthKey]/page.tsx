"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import {
  ArrowLeft,
  CalendarRange,
  Car,
  Download,
  FileText,
  Fuel,
  MapPinned,
  Route as RouteIcon,
  Users,
  Wrench,
} from "lucide-react";
import {
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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildReportAnalytics,
  formatMonthLabel,
  getMonthBounds,
  type ReportMaintenanceRecord,
  type ReportRefuelRecord,
  type ReportRouteRecord,
  type ReportVehicleRecord,
} from "@/lib/reporting";

interface MonthlySummaryDocument {
  monthKey: string;
  year: number;
  month: number;
  createdAt?: string | null;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
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
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatNumber(value: number, suffix = "") {
  return `${numberFormatter.format(value || 0)}${suffix}`;
}

function KpiTile({
  label,
  value,
  helper,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="app-panel-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{helper}</p>
        </div>
        <div className={`rounded-2xl border px-3 py-3 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-white/70 px-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-400">
      {text}
    </div>
  );
}

const reportPanelClass = "app-panel p-5";
const reportPanelWideClass = "app-panel p-5 md:p-6";
const reportTableHeadClass =
  "border-b border-slate-200 text-left text-slate-500 dark:border-white/10 dark:text-slate-400";
const reportTableRowClass =
  "border-b border-slate-200/80 text-slate-700 transition hover:bg-slate-50 dark:border-white/5 dark:text-slate-200 dark:hover:bg-white/[0.03]";

export default function MonthlyClosingPage() {
  const params = useParams<{ monthKey: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [summaryDoc, setSummaryDoc] = useState<MonthlySummaryDocument | null>(null);
  const [vehicles, setVehicles] = useState<ReportVehicleRecord[]>([]);
  const [routes, setRoutes] = useState<ReportRouteRecord[]>([]);
  const [refuels, setRefuels] = useState<ReportRefuelRecord[]>([]);
  const [maintenances, setMaintenances] = useState<ReportMaintenanceRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isAdmin = user?.role === "admin";
  const monthKey = params?.monthKey ?? "";
  const monthBounds = useMemo(() => getMonthBounds(monthKey), [monthKey]);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      if (!user || !monthKey) return;

      try {
        setLoading(true);
        setErrorMsg("");

        const summarySnap = await getDoc(doc(db, "monthlySummaries", monthKey));
        if (!summarySnap.exists()) {
          setErrorMsg("Fechamento mensal não encontrado.");
          setLoading(false);
          return;
        }

        const summaryData = summarySnap.data();
        const createdAtDate =
          summaryData.createdAt && summaryData.createdAt.toDate
            ? summaryData.createdAt.toDate()
            : null;

        setSummaryDoc({
          monthKey: summaryData.monthKey ?? monthKey,
          year: Number(summaryData.year ?? 0),
          month: Number(summaryData.month ?? 0),
          createdAt: createdAtDate ? createdAtDate.toISOString() : null,
        });

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

        setVehicles(visibleVehicles);
        setRoutes(visibleRoutes);
        setRefuels(visibleRefuels);
        setMaintenances(visibleMaintenances);
      } catch (error) {
        console.error("Erro ao carregar fechamento mensal:", error);
        setErrorMsg("Não foi possível carregar os dados do fechamento.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, monthKey, isAdmin, router]);

  const analytics = useMemo(
    () =>
      buildReportAnalytics({
        monthKey,
        routes,
        refuels,
        maintenances,
        vehicles,
      }),
    [monthKey, routes, refuels, maintenances, vehicles]
  );

  const topVehicles = analytics.vehicleRows.filter((item) => item.hasActivity);
  const topResponsibles = analytics.responsibleRows;
  const topDrivers = analytics.driverRows;

  if (!user) return null;

  async function handleGeneratePdf() {
    if (!summaryDoc) return;

    try {
      setGeneratingPdf(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, 210, 24, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text(`Fechamento da Frota · ${formatMonthLabel(monthKey)}`, 14, 15);

      pdf.setTextColor(100, 116, 139);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 14, 21);

      let cursorY = 34;
      const summaryLines = [
        `Custo total: ${formatCurrency(analytics.overview.totalCost)}`,
        `Km rodado: ${formatNumber(analytics.overview.totalKm, " km")}`,
        `Combustível: ${formatCurrency(analytics.overview.totalFuelCost)}`,
        `Manutenção: ${formatCurrency(analytics.overview.totalMaintenanceCost)}`,
        `Custo por km: ${
          analytics.overview.costPerKm > 0
            ? formatCurrency(analytics.overview.costPerKm)
            : "-"
        }`,
        `Consumo médio: ${
          analytics.overview.kmPerLiter > 0
            ? formatNumber(analytics.overview.kmPerLiter, " km/L")
            : "-"
        }`,
        `Rotas: ${analytics.overview.totalRoutes}`,
        `Taxa de fechamento: ${percentFormatter.format(
          analytics.overview.completionRate
        )}`,
        `Ticket médio abastecimento: ${
          analytics.overview.avgFuelTicket > 0
            ? formatCurrency(analytics.overview.avgFuelTicket)
            : "-"
        }`,
        `Ticket médio manutenção: ${
          analytics.overview.avgMaintenanceTicket > 0
            ? formatCurrency(analytics.overview.avgMaintenanceTicket)
            : "-"
        }`,
        `Veículos ativos: ${analytics.overview.activeVehicles}`,
      ];

      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Resumo executivo", 14, cursorY);
      cursorY += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      summaryLines.forEach((line) => {
        pdf.text(line, 14, cursorY);
        cursorY += 5;
      });

      autoTable(pdf, {
        startY: cursorY + 4,
        head: [["Veículo", "Km", "Combustível", "Manutenção", "Custo total"]],
        body: topVehicles.slice(0, 10).map((vehicle) => [
          vehicle.vehicleLabel,
          formatNumber(vehicle.km, " km"),
          formatCurrency(vehicle.fuelCost),
          formatCurrency(vehicle.maintenanceCost),
          formatCurrency(vehicle.totalCost),
        ]),
        headStyles: {
          fillColor: [245, 158, 11],
          textColor: [15, 23, 42],
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
        },
        margin: { left: 14, right: 14 },
      });

      const pdfWithTables = pdf as jsPDF & {
        lastAutoTable?: {
          finalY: number;
        };
      };

      autoTable(pdf, {
        startY: (pdfWithTables.lastAutoTable?.finalY ?? cursorY + 4) + 8,
        head: [["Responsável", "Km", "Combustível", "Manutenção", "Custo total"]],
        body: topResponsibles.slice(0, 10).map((responsible) => [
          responsible.responsibleName,
          formatNumber(responsible.km, " km"),
          formatCurrency(responsible.fuelCost),
          formatCurrency(responsible.maintenanceCost),
          formatCurrency(responsible.totalCost),
        ]),
        headStyles: {
          fillColor: [56, 189, 248],
          textColor: [15, 23, 42],
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
        },
        margin: { left: 14, right: 14 },
      });

      autoTable(pdf, {
        startY: (pdfWithTables.lastAutoTable?.finalY ?? cursorY + 20) + 8,
        head: [["Motorista", "Km", "Rotas", "Média por rota", "Fechamento"]],
        body: topDrivers.slice(0, 10).map((driver) => [
          driver.driverName,
          formatNumber(driver.km, " km"),
          String(driver.routesCount),
          driver.avgRouteDistance > 0
            ? formatNumber(driver.avgRouteDistance, " km")
            : "-",
          percentFormatter.format(driver.completionRate),
        ]),
        headStyles: {
          fillColor: [52, 211, 153],
          textColor: [15, 23, 42],
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.5,
        },
        margin: { left: 14, right: 14 },
      });

      pdf.save(`fechamento-${monthKey}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setErrorMsg("Não foi possível gerar o PDF deste fechamento.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (loading) {
    return (
      <div className="app-page" data-report-page>
        <PageHeader
          eyebrow="Fechamento mensal"
          title="Carregando fechamento do periodo"
          description="Estamos reunindo os dados consolidados deste fechamento para montar a leitura executiva."
          icon={FileText}
          iconTone="yellow"
        />
        <Card className={reportPanelWideClass}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Carregando fechamento...
          </p>
        </Card>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="app-page" data-report-page>
        <PageHeader
          eyebrow="Fechamento mensal"
          title="Nao foi possivel abrir este fechamento"
          description="Confira o periodo selecionado ou volte para a central de relatorios para tentar novamente."
          icon={FileText}
          iconTone="yellow"
          actions={
            <Button
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              onClick={() => router.push('/relatorios')}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para relatorios
            </Button>
          }
        />
        <StatusBanner tone="error">{errorMsg}</StatusBanner>
      </div>
    );
  }

  return (
    <div className="app-page" data-report-page>
      <PageHeader
        eyebrow="Fechamento mensal"
        title={`Fechamento de ${formatMonthLabel(monthKey)}`}
        description="Consulte o consolidado do periodo com custos, utilizacao da frota, desempenho operacional e historico do mes fechado."
        icon={FileText}
        iconTone="yellow"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.06]"
              onClick={() => router.push('/relatorios')}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para relatorios
            </Button>
            <Button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
            >
              <Download className="h-4 w-4" />
              {generatingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </Button>
          </>
        }
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              Periodo: {monthBounds.startDate} ate {monthBounds.endDate}
            </span>
            {summaryDoc?.createdAt ? (
              <span className="app-chip">
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                Gerado em {new Date(summaryDoc.createdAt).toLocaleString('pt-BR')}
              </span>
            ) : null}
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {isAdmin ? 'Visao corporativa' : 'Dados do seu escopo'}
            </span>
          </>
        }
      />

      <Card className={reportPanelWideClass}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Competencia
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {formatMonthLabel(monthKey)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Custo consolidado
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {formatCurrency(analytics.overview.totalCost)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Km rodado
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
              {formatNumber(analytics.overview.totalKm, ' km')}
            </p>
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Custo total"
          value={formatCurrency(analytics.overview.totalCost)}
          helper="Combustível e manutenção no mês fechado."
          icon={FileText}
          accent="border-amber-400/20 bg-amber-500/10 text-amber-300"
        />
        <KpiTile
          label="Km rodado"
          value={formatNumber(analytics.overview.totalKm, " km")}
          helper="Quilometragem consolidada das rotas do mês."
          icon={MapPinned}
          accent="border-cyan-400/20 bg-cyan-500/10 text-cyan-300"
        />
        <KpiTile
          label="Combustível"
          value={formatCurrency(analytics.overview.totalFuelCost)}
          helper={`${analytics.overview.refuelsCount} abastecimento(s) registrados.`}
          icon={Fuel}
          accent="border-amber-400/20 bg-amber-500/10 text-amber-300"
        />
        <KpiTile
          label="Manutenção"
          value={formatCurrency(analytics.overview.totalMaintenanceCost)}
          helper={`${analytics.overview.maintenancesCount} manutenção(ões) no período.`}
          icon={Wrench}
          accent="border-sky-400/20 bg-sky-500/10 text-sky-300"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card className={reportPanelClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Distribuição do custo
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Participação de combustível e manutenção
              </h2>
            </div>
            <CalendarRange className="h-5 w-5 text-amber-300" />
          </div>

          {analytics.costComposition.length === 0 ? (
            <EmptyPanel text="Sem custos registrados no fechamento selecionado." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
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

              <div className="space-y-3">
                {analytics.costComposition.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        {item.name}
                      </div>
                      <span className="text-sm font-medium text-slate-950 dark:text-white">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {percentFormatter.format(item.value / analytics.overview.totalCost)}{" "}
                      do custo total do fechamento.
                    </p>
                  </div>
                ))}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-sm text-slate-400">Eficiência média do mês</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {analytics.overview.kmPerLiter > 0
                      ? formatNumber(analytics.overview.kmPerLiter, " km/L")
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card className={reportPanelClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Indicadores do fechamento
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Resumo operacional
              </h2>
            </div>
            <RouteIcon className="h-5 w-5 text-emerald-300" />
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm text-slate-400">Custo por km</p>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {analytics.overview.costPerKm > 0
                  ? formatCurrency(analytics.overview.costPerKm)
                  : "-"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm text-slate-400">Rotas finalizadas</p>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {percentFormatter.format(analytics.overview.completionRate)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm text-slate-400">Veículos ativos</p>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {analytics.overview.activeVehicles}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm text-slate-400">Responsáveis com atividade</p>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                {analytics.overview.responsiblesCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className={reportPanelClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Ranking por veículo
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Top veículos do fechamento
              </h2>
            </div>
            <Car className="h-5 w-5 text-amber-300" />
          </div>

          {topVehicles.length === 0 ? (
            <EmptyPanel text="Nenhum veículo com atividade no fechamento selecionado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={reportTableHeadClass}>
                  <tr>
                    <th className="py-3 pr-4">Veículo</th>
                    <th className="py-3 px-4">Km</th>
                    <th className="py-3 px-4">Combustível</th>
                    <th className="py-3 px-4">Manutenção</th>
                    <th className="py-3 px-4">Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {topVehicles.slice(0, 12).map((vehicle) => (
                    <tr key={vehicle.key} className={reportTableRowClass}>
                      <td className="py-3 pr-4 font-medium text-slate-950 dark:text-white">
                        {vehicle.vehicleLabel}
                      </td>
                      <td className="py-3 px-4">{formatNumber(vehicle.km, " km")}</td>
                      <td className="py-3 px-4">{formatCurrency(vehicle.fuelCost)}</td>
                      <td className="py-3 px-4">
                        {formatCurrency(vehicle.maintenanceCost)}
                      </td>
                      <td className="py-3 px-4 font-medium text-amber-300">
                        {formatCurrency(vehicle.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className={reportPanelClass}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Ranking por responsável
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Responsáveis com maior custo
              </h2>
            </div>
            <Users className="h-5 w-5 text-cyan-300" />
          </div>

          {topResponsibles.length === 0 ? (
            <EmptyPanel text="Nenhum responsável com atividade no fechamento." />
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

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className={`${reportPanelClass} xl:col-span-2`}>
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Rotas do fechamento
            </p>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Histórico de rotas do mês consolidado
            </h2>
          </div>

          {analytics.filteredRoutes.length === 0 ? (
            <EmptyPanel text="Nenhuma rota registrada neste fechamento." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className={reportTableHeadClass}>
                  <tr>
                    <th className="py-3 pr-4">Data</th>
                    <th className="py-3 px-4">Veículo</th>
                    <th className="py-3 px-4">Motorista</th>
                    <th className="py-3 px-4">Km total</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.filteredRoutes.map((route) => (
                    <tr key={route.id} className={reportTableRowClass}>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {route.endAt || route.startAt
                          ? new Date(route.endAt || route.startAt || "").toLocaleString(
                              "pt-BR"
                            )
                          : "-"}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-950 dark:text-white">
                        {route.vehiclePlate} · {route.vehicleModel}
                      </td>
                      <td className="py-3 px-4">{route.driverName || "-"}</td>
                      <td className="py-3 px-4">
                        {formatNumber(route.distanceKm ?? 0, " km")}
                      </td>
                      <td className="py-3 px-4 capitalize">{route.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className={reportPanelClass}>
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Abastecimentos
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Lançamentos do mês
              </h2>
            </div>

            {analytics.filteredRefuels.length === 0 ? (
              <EmptyPanel text="Nenhum abastecimento registrado neste fechamento." />
            ) : (
              <div className="space-y-2">
                {analytics.filteredRefuels.slice(0, 8).map((refuel) => (
                  <div
                    key={refuel.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <p className="font-medium text-slate-950 dark:text-white">{refuel.vehiclePlate}</p>
                    <p className="text-xs text-slate-400">
                      {refuel.date
                        ? new Date(refuel.date).toLocaleString("pt-BR")
                        : "-"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {formatNumber(refuel.liters, " L")} ·{" "}
                      {formatCurrency(refuel.totalCost)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className={reportPanelClass}>
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Manutenções
              </p>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Lançamentos do mês
              </h2>
            </div>

            {analytics.filteredMaintenances.length === 0 ? (
              <EmptyPanel text="Nenhuma manutenção registrada neste fechamento." />
            ) : (
              <div className="space-y-2">
                {analytics.filteredMaintenances.slice(0, 8).map((maintenance) => (
                  <div
                    key={maintenance.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <p className="font-medium text-slate-950 dark:text-white">
                      {maintenance.vehiclePlate}
                    </p>
                    <p className="text-xs text-slate-400">
                      {maintenance.date
                        ? new Date(maintenance.date).toLocaleString("pt-BR")
                        : "-"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {maintenance.type || "Manutenção"} ·{" "}
                      {formatCurrency(maintenance.cost)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}




