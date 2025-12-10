"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  ArrowLeft,
  FileText,
  Car,
  Fuel,
  Wrench,
  Map as MapIcon,
  Download,
} from "lucide-react";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type RouteStatus = "em_andamento" | "finalizada";

interface RouteItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverName: string;
  origem?: string | null;
  destino?: string | null;
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
  date?: string | null;
  responsibleUserId: string;
}

interface MaintenanceItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  cost: number;
  date?: string | null;
  type?: string;
  status: "em_andamento" | "concluida";
  responsibleUserId: string;
}

interface MonthlySummaryData {
  monthKey: string;
  year: number;
  month: number;
  totalKmRodado: number;
  totalCombustivel: number;
  totalManutencao: number;
  kmMedioPorVeiculo: number;
  routesCount?: number;
  refuelsCount?: number;
  maintenancesCount?: number;
}

interface VehicleOption {
  id: string;
  plate: string;
  model: string;
  storeId?: string;
  currentKm?: number;

  // modelo antigo
  responsibleUserId?: string;
  responsibleUserName?: string;

  // modelo novo (multi-responsável)
  responsibleUserIds?: string[];
}

export default function MonthlyClosingPage() {
  const params = useParams<{ monthKey: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [summary, setSummary] = useState<MonthlySummaryData | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [refuels, setRefuels] = useState<RefuelItem[]>([]);
  const [maintenances, setMaintenances] = useState<MaintenanceItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  // Helper: está no mês do fechamento?
  function isInMonth(
    isoDate: string | null | undefined,
    year: number,
    month: number
  ) {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return false;
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  }

  // helper: verifica se o usuário pode usar / ver um veículo
  function userCanUseVehicle(vehicle: VehicleOption | undefined): boolean {
    if (!user || !vehicle) return false;
    if (user.role === "admin") return true;

    const singleMatch = vehicle.responsibleUserId === user.id;
    const multiMatch = vehicle.responsibleUserIds?.includes(user.id) ?? false;

    return singleMatch || multiMatch;
  }

  useEffect(() => {
    async function loadData() {
      if (!user || !params?.monthKey) return;

      try {
        setLoading(true);
        setErrorMsg("");

        // monthKey: "YYYY-MM"
        const [yearStr, monthStr] = params.monthKey.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr);
        if (!year || !month) {
          setErrorMsg("Fechamento inválido.");
          setLoading(false);
          return;
        }

        // 1) Carrega resumo salvo em monthlySummaries
        const summaryRef = doc(db, "monthlySummaries", params.monthKey);
        const summarySnap = await getDoc(summaryRef);
        if (!summarySnap.exists()) {
          setErrorMsg("Fechamento mensal não encontrado.");
          setLoading(false);
          return;
        }

        const sData = summarySnap.data() as any;
        let summaryObj: MonthlySummaryData = {
          monthKey: sData.monthKey ?? params.monthKey,
          year: Number(sData.year ?? year),
          month: Number(sData.month ?? month),
          totalKmRodado: Number(sData.totalKmRodado ?? 0),
          totalCombustivel: Number(sData.totalCombustivel ?? 0),
          totalManutencao: Number(sData.totalManutencao ?? 0),
          kmMedioPorVeiculo: Number(sData.kmMedioPorVeiculo ?? 0),
          routesCount: Number(sData.routesCount ?? 0),
          refuelsCount: Number(sData.refuelsCount ?? 0),
          maintenancesCount: Number(sData.maintenancesCount ?? 0),
        };
        setSummary(summaryObj);

        // 2) Carrega veículos (pra aplicar lógica de múltiplos responsáveis)
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        const vList: VehicleOption[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            currentKm: data.currentKm,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            responsibleUserIds: Array.isArray(data.responsibleUserIds)
              ? data.responsibleUserIds
              : undefined,
          };
        });
        setVehicles(vList);
        const vehicleById = new Map<string, VehicleOption>();
        vList.forEach((v) => vehicleById.set(v.id, v));

        // 3) Carrega rotas (todas) e filtra pelo mês + permissão
        const routesSnap = await getDocs(collection(db, "routes"));
        const allRoutes: RouteItem[] = routesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            driverName: data.driverName,
            origem: data.origem ?? null,
            destino: data.destino ?? null,
            startKm: Number(data.startKm ?? 0),
            endKm: data.endKm ?? null,
            distanceKm:
              data.distanceKm != null ? Number(data.distanceKm) : null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            status: (data.status ?? "em_andamento") as RouteStatus,
            responsibleUserId: data.responsibleUserId,
          };
        });

        const monthRoutesRaw = allRoutes.filter((r) =>
          isInMonth(
            r.startAt || r.endAt || null,
            summaryObj.year,
            summaryObj.month
          )
        );

        const visibleRoutes = isAdmin
          ? monthRoutesRaw
          : monthRoutesRaw.filter((r) => {
              if (r.responsibleUserId === user.id) return true;
              const v = vehicleById.get(r.vehicleId);
              return userCanUseVehicle(v);
            });

        visibleRoutes.sort((a, b) =>
          (a.startAt || "").localeCompare(b.startAt || "")
        );
        setRoutes(visibleRoutes);

        // 4) ABASTECIMENTOS (fuelings)
        const refuelSnap = await getDocs(collection(db, "fuelings"));
        const allRefuels: RefuelItem[] = refuelSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            liters: Number(data.liters ?? 0),
            totalCost: Number(
              data.totalCost != null ? data.totalCost : data.total ?? 0
            ),
            date: data.date ?? null,
            responsibleUserId: data.responsibleUserId,
          };
        });

        const monthRefuelsRaw = allRefuels.filter((f) =>
          isInMonth(f.date, summaryObj.year, summaryObj.month)
        );

        const visibleRefuels = isAdmin
          ? monthRefuelsRaw
          : monthRefuelsRaw.filter((f) => {
              if (f.responsibleUserId === user.id) return true;
              const v = vehicleById.get(f.vehicleId);
              return userCanUseVehicle(v);
            });

        setRefuels(visibleRefuels);

        // 5) MANUTENÇÕES
        const maintSnap = await getDocs(collection(db, "maintenances"));
        const allMaint: MaintenanceItem[] = maintSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            cost: Number(data.cost ?? 0),
            date: data.date ?? null,
            type: data.type,
            status: (data.status ?? "em_andamento") as
              | "em_andamento"
              | "concluida",
            responsibleUserId: data.responsibleUserId,
          };
        });

        const monthMaintRaw = allMaint.filter((m) =>
          isInMonth(m.date, summaryObj.year, summaryObj.month)
        );

        const visibleMaint = isAdmin
          ? monthMaintRaw
          : monthMaintRaw.filter((m) => {
              if (m.responsibleUserId === user.id) return true;
              const v = vehicleById.get(m.vehicleId);
              return userCanUseVehicle(v);
            });

        setMaintenances(visibleMaint);

        // 6) Se não for admin, recalcula o resumo para bater com o que o usuário vê
        if (!isAdmin) {
          const totalKm = visibleRoutes.reduce((acc, r) => {
            if (r.distanceKm != null) return acc + r.distanceKm;
            if (r.endKm != null) return acc + (r.endKm - r.startKm);
            return acc;
          }, 0);

          const totalCombustivel = visibleRefuels.reduce(
            (acc, f) => acc + (f.totalCost || 0),
            0
          );

          const totalManutencao = visibleMaint.reduce(
            (acc, m) => acc + (m.cost || 0),
            0
          );

          const kmPorVeiculoMap = new Map<string, number>();
          for (const r of visibleRoutes) {
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
              ? totalKm / qtdVeiculosComMovimento
              : 0;

          summaryObj = {
            ...summaryObj,
            totalKmRodado: totalKm,
            totalCombustivel,
            totalManutencao,
            kmMedioPorVeiculo,
            routesCount: visibleRoutes.length,
            refuelsCount: visibleRefuels.length,
            maintenancesCount: visibleMaint.length,
          };
          setSummary(summaryObj);
        }
      } catch (error) {
        console.error("Erro ao carregar fechamento mensal:", error);
        setErrorMsg("Erro ao carregar o fechamento mensal.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, params?.monthKey, isAdmin]);

  const labelMes = useMemo(() => {
    if (!summary) return "";
    return `${String(summary.month).padStart(2, "0")}/${summary.year}`;
  }, [summary]);

  // Computa distância da rota
  function getRouteDistance(r: RouteItem): number {
    if (r.distanceKm != null) return Number(r.distanceKm);
    if (r.endKm != null) return Number(r.endKm) - Number(r.startKm ?? 0);
    return 0;
  }

  if (!user) return null;

  // Helper pra carregar imagem da logo como dataURL
  function loadImageAsDataUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível obter o contexto do canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  // ===== Gerar PDF =====
  async function handleGeneratePdf() {
    if (!summary) return;
    try {
      setGeneratingPdf(true);
      setErrorMsg("");

      const docPdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const marginLeft = 14;
      let currentY = 18;

      // 🔶 Logo no canto direito (usa favicon.png)
      try {
        const logoDataUrl = await loadImageAsDataUrl("/favicon.png");
        docPdf.addImage(logoDataUrl, "PNG", 180, 10, 16, 16);
      } catch {
        // se não conseguir carregar a imagem, só segue sem logo
      }

      // Cabeçalho
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(16);
      docPdf.text("GRUPO MM · MM FROTA", marginLeft, currentY);
      currentY += 8;

      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "normal");
      docPdf.text(
        `Fechamento mensal da frota - ${labelMes}`,
        marginLeft,
        currentY
      );
      currentY += 6;

      if (user?.name) {
        docPdf.setFontSize(9);
        docPdf.text(`Gerado por: ${user.name}`, marginLeft, currentY);
        currentY += 5;
      }

      const now = new Date();
      docPdf.setFontSize(9);
      docPdf.text(
        `Data de geração: ${now.toLocaleString("pt-BR")}`,
        marginLeft,
        currentY
      );
      currentY += 8;

      // Linha divisória
      docPdf.setDrawColor(250, 204, 21);
      docPdf.setLineWidth(0.5);
      docPdf.line(marginLeft, currentY, 200, currentY);
      currentY += 7;

      // Resumo
      docPdf.setFontSize(11);
      docPdf.setFont("helvetica", "bold");
      docPdf.text("Resumo geral do mês", marginLeft, currentY);
      currentY += 6;

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(10);

      const resumo = [
        `Km rodado: ${summary.totalKmRodado.toFixed(1)} km`,
        `Gasto com combustível: R$ ${summary.totalCombustivel.toFixed(2)}`,
        `Gasto com manutenção: R$ ${summary.totalManutencao.toFixed(2)}`,
        `Km médio por veículo: ${
          summary.kmMedioPorVeiculo > 0
            ? summary.kmMedioPorVeiculo.toFixed(2) + " km"
            : "-"
        }`,
        `Rotas no mês: ${summary.routesCount ?? routes.length}`,
        `Abastecimentos no mês: ${summary.refuelsCount ?? refuels.length}`,
        `Manutenções no mês: ${
          summary.maintenancesCount ?? maintenances.length
        }`,
      ];

      resumo.forEach((line) => {
        docPdf.text(line, marginLeft, currentY);
        currentY += 5;
      });

      currentY += 6;

      // ===== TABELA DE ROTAS =====
      if (routes.length > 0) {
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.text("Rotas do mês", marginLeft, currentY);
        currentY += 5;

        autoTable(docPdf, {
          startY: currentY,
          head: [
            [
              "Data",
              "Veículo",
              "Motorista",
              "Origem",
              "Destino",
              "Km início",
              "Km fim",
              "Km total",
            ],
          ],
          body: routes.map((r) => [
            r.startAt
              ? new Date(r.startAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-",
            `${r.vehiclePlate} · ${r.vehicleModel}`,
            r.driverName || "-",
            r.origem || "-",
            r.destino || "-",
            r.startKm ? `${Number(r.startKm).toFixed(1)} km` : "-",
            r.endKm != null ? `${Number(r.endKm).toFixed(1)} km` : "-",
            `${getRouteDistance(r).toFixed(1)} km`,
          ]),
          styles: {
            fontSize: 8,
            textColor: [0, 0, 0],
          },
          headStyles: {
            fillColor: [250, 204, 21], // amarelo
            textColor: [0, 0, 0],
          },
          alternateRowStyles: {
            fillColor: [40, 40, 40],
            textColor: [255, 255, 255],
          },
          margin: { left: marginLeft, right: 10 },
        });
      }

      docPdf.save(`fechamento-${summary.monthKey}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setErrorMsg("Erro ao gerar PDF do fechamento.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
        <p className="text-sm text-gray-300">Carregando fechamento...</p>
      </Card>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="border-neutral-700 text-gray-200 hover:bg-neutral-800 text-xs"
          onClick={() => router.push("/relatorios")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para relatórios
        </Button>
        <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <button
            onClick={() => router.push("/relatorios")}
            className="inline-flex items-center gap-1 text-xs text-gray-400 mb-2 hover:text-yellow-400"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar para relatórios
          </button>
          <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Fechamento mensal · {labelMes}
          </h1>
          <p className="text-sm text-gray-300">
            Resumo consolidado de rotas, abastecimentos e manutenções da frota
            do Grupo MM nesse mês.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black text-xs font-semibold"
            onClick={handleGeneratePdf}
            disabled={generatingPdf}
          >
            <Download className="w-4 h-4" />
            {generatingPdf ? "Gerando PDF..." : "Baixar PDF do fechamento"}
          </Button>
        </div>
      </div>

      {/* Resumo principal (cards) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Km rodado no mês
            </p>
            <p className="text-2xl font-bold text-yellow-400">
              {summary.totalKmRodado.toFixed(1)} km
            </p>
            <p className="text-[11px] text-gray-500">
              Com base nas rotas registradas
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-yellow-500/10">
            <MapIcon className="w-6 h-6 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Combustível
            </p>
            <p className="text-2xl font-bold text-yellow-400">
              R$ {summary.totalCombustivel.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500">
              {refuels.length} abastecimento(s)
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-yellow-500/10">
            <Fuel className="w-6 h-6 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Manutenções
            </p>
            <p className="text-2xl font-bold text-yellow-400">
              R$ {summary.totalManutencao.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500">
              {maintenances.length} manutenção(ões)
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-yellow-500/10">
            <Wrench className="w-6 h-6 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">
              Km médio por veículo
            </p>
            <p className="text-2xl font-bold text-yellow-400">
              {summary.kmMedioPorVeiculo > 0
                ? summary.kmMedioPorVeiculo.toFixed(2)
                : "-"}
            </p>
            <p className="text-[11px] text-gray-500">
              Considerando apenas veículos que rodaram no mês
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-yellow-500/10">
            <Car className="w-6 h-6 text-yellow-400" />
          </div>
        </Card>
      </div>

      {/* Rotas do mês na tela */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-full bg-yellow-500/10">
            <MapIcon className="w-4 h-4 text-yellow-400" />
          </div>
          <p className="text-sm font-semibold text-gray-100">
            Rotas do mês · {routes.length} registro(s)
          </p>
        </div>

        {routes.length === 0 ? (
          <p className="text-sm text-gray-400">
            Não há rotas registradas para este mês.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Data início</th>
                  <th className="py-2 px-2">Veículo</th>
                  <th className="py-2 px-2">Motorista</th>
                  <th className="py-2 px-2">Origem → Destino</th>
                  <th className="py-2 px-2">Km início</th>
                  <th className="py-2 px-2">Km fim</th>
                  <th className="py-2 px-2">Km total</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 text-gray-300">
                      {r.startAt
                        ? new Date(r.startAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="py-2 px-2 text-gray-100">
                      <span className="font-mono">{r.vehiclePlate}</span> ·{" "}
                      {r.vehicleModel}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {r.driverName || "-"}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {(r.origem ?? "-") + " → " + (r.destino ?? "-")}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {r.startKm} km
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {r.endKm != null ? `${r.endKm} km` : "-"}
                    </td>
                    <td className="py-2 px-2 text-yellow-300">
                      {getRouteDistance(r).toFixed(1)} km
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                          r.status === "finalizada"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {r.status === "finalizada"
                          ? "Finalizada"
                          : "Em andamento"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Resumos rápidos de abastecimentos e manutenções */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="p-4 bg-neutral-950 border border-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <Fuel className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-sm font-semibold text-gray-100">
              Abastecimentos do mês ({refuels.length})
            </p>
          </div>
          {refuels.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhum abastecimento registrado neste mês.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {refuels.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {f.vehiclePlate}
                    </p>
                    <p className="text-xs text-gray-400">
                      {f.date
                        ? new Date(f.date).toLocaleString("pt-BR")
                        : "-"}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-400">
                      {f.liters.toFixed(2)} L
                    </p>
                    <p className="font-semibold text-yellow-300">
                      R$ {f.totalCost.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 bg-neutral-950 border border-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <Wrench className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-sm font-semibold text-gray-100">
              Manutenções do mês ({maintenances.length})
            </p>
          </div>
          {maintenances.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhuma manutenção registrado neste mês.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {maintenances.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {m.vehiclePlate}
                    </p>
                    <p className="text-xs text-gray-400">
                      {m.date
                        ? new Date(m.date).toLocaleString("pt-BR")
                        : "-"}
                    </p>
                    {m.type && (
                      <p className="text-xs text-gray-500 truncate">
                        {m.type}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <p className="font-semibold text-yellow-300">
                      R$ {m.cost.toFixed(2)}
                    </p>
                    <p className="text-gray-400 capitalize">
                      {m.status === "concluida"
                        ? "Concluída"
                        : "Em andamento"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}