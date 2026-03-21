"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc as fsDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import {
  Car,
  Fuel,
  Wrench,
  Map,
  ArrowLeft,
  FileDown,
  Info,
  CalendarDays,
  ListFilter,
} from "lucide-react";

// Chart.js
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  ChartTooltip,
  Legend
);

type VehicleStatus = "disponivel" | "em_rota" | "manutencao";

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
  status: VehicleStatus;
  currentKm?: number;

  // CAMPOS ANTIGOS (compatibilidade)
  responsibleUserId?: string;
  responsibleUserName?: string;

  // NOVOS CAMPOS: múltiplos responsáveis
  responsibleUserIds: string[];
  responsibleUsers: VehicleResponsibleUser[];

  generalNotes?: string | null;
}

interface Fueling {
  id: string;
  date: string;
  odometerKm: number;
  liters: number;
  total: number;
  pricePerL: number;
  responsibleUserName?: string | null;
  stationName?: string | null;
  notes?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  editReason?: string | null;
}

interface Maintenance {
  id: string;
  date: string;
  odometerKm: number;
  type: string;
  cost: number;
  responsibleUserName?: string | null;
  workshopName?: string | null;
  status: "em_andamento" | "concluida";
  endKm?: number | null;
  notes?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  editReason?: string | null;
}

interface RouteItem {
  id: string;
  driverName: string;
  origem?: string | null;
  destino?: string | null;
  startKm: number;
  endKm?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  status: "em_andamento" | "finalizada" | "cancelada";
  notes?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  editReason?: string | null;
  canceledAt?: string | null;
  canceledByName?: string | null;
  cancelReason?: string | null;
}

// Helper: retorna início e fim do mês atual no formato YYYY-MM-DD
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  return {
    start: toYMD(start),
    end: toYMD(end),
  };
}

function truncate(text: string, max = 60) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start) return "-";

  const startDate = new Date(start).getTime();
  const endDate = end ? new Date(end).getTime() : Date.now();

  if (!Number.isFinite(startDate) || !Number.isFinite(endDate)) return "-";

  const diffMs = Math.max(0, endDate - startDate);
  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default function VehicleDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [fuelings, setFuelings] = useState<Fueling[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Filtro de período: por padrão, mês atual
  const [startDate, setStartDate] = useState<string>(
    () => getCurrentMonthRange().start
  );
  const [endDate, setEndDate] = useState<string>(
    () => getCurrentMonthRange().end
  );

  // Viewer de observações (modal – rotas/manutenções)
  const [obsViewer, setObsViewer] = useState<{
    title: string;
    subtitle?: string;
    note: string;
  } | null>(null);

  // Observação geral do veículo
  const [generalNotes, setGeneralNotes] = useState<string | null>(null);
  const [generalNotesDraft, setGeneralNotesDraft] = useState("");
  const [editingGeneralNotes, setEditingGeneralNotes] = useState(false);
  const [savingGeneralNotes, setSavingGeneralNotes] = useState(false);
  const [generalNotesMsg, setGeneralNotesMsg] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      if (!user || !params?.id) return;

      setLoading(true);
      setErrorMsg("");

      // 1) Veículo
      try {
        const vehicleRef = fsDoc(db, "vehicles", params.id);
        const vehicleSnap = await getDoc(vehicleRef);

        if (!vehicleSnap.exists()) {
          setErrorMsg("Veículo não encontrado.");
          setLoading(false);
          return;
        }

        const vData = vehicleSnap.data() as any;
        const generalNotesFromDb =
          vData.vehicleNotes ??
          vData.generalNotes ??
          vData.notes ??
          vData.observacoesGerais ??
          null;

        // Compatibilidade de responsáveis
        const responsibleUsersFromDoc: VehicleResponsibleUser[] =
          Array.isArray(vData.responsibleUsers) && vData.responsibleUsers.length
            ? vData.responsibleUsers
            : vData.responsibleUserId && vData.responsibleUserName
            ? [
                {
                  id: vData.responsibleUserId,
                  name: vData.responsibleUserName,
                  storeId: vData.storeId,
                },
              ]
            : [];

        const responsibleUserIdsFromDoc: string[] =
          Array.isArray(vData.responsibleUserIds) &&
          vData.responsibleUserIds.length
            ? vData.responsibleUserIds
            : responsibleUsersFromDoc.map((u) => u.id);

        const primaryName =
          vData.responsibleUserName ||
          (responsibleUsersFromDoc[0]?.name ?? "");

        const vehicleObj: Vehicle = {
          id: vehicleSnap.id,
          plate: vData.plate,
          model: vData.model,
          storeId: vData.storeId,
          status: vData.status ?? "disponivel",
          currentKm: vData.currentKm,
          // antigos
          responsibleUserId: vData.responsibleUserId,
          responsibleUserName: primaryName,
          // novos
          responsibleUserIds: responsibleUserIdsFromDoc,
          responsibleUsers: responsibleUsersFromDoc,
          generalNotes: generalNotesFromDb,
        };

        // segurança: user comum só vê se for um dos responsáveis
        if (user.role !== "admin") {
          const isExplicitResponsible =
            !!vehicleObj.responsibleUserId &&
            vehicleObj.responsibleUserId === user.id;

          const isInMultiResponsibles =
            vehicleObj.responsibleUserIds?.includes(user.id) ?? false;

          if (!isExplicitResponsible && !isInMultiResponsibles) {
            setErrorMsg("Você não tem acesso a este veículo.");
            setLoading(false);
            return;
          }
        }

        setVehicle(vehicleObj);
        setGeneralNotes(generalNotesFromDb);
        setGeneralNotesDraft(generalNotesFromDb ?? "");
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar veículo:", error);
        setErrorMsg("Erro ao carregar dados do veículo.");
        setLoading(false);
        return;
      }

      // 2) Abastecimentos
      try {
        const fuelSnap = await getDocs(
          query(collection(db, "fuelings"), where("vehicleId", "==", params.id))
        );

        const fList: Fueling[] = fuelSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            date: data.date,
            odometerKm: Number(data.odometerKm || 0),
            liters: Number(data.liters || 0),
            total: Number(data.total || 0),
            pricePerL: Number(data.pricePerL || 0),
            responsibleUserName: data.responsibleUserName ?? null,
            stationName: data.stationName ?? null,
            notes: data.notes ?? data.observacoes ?? null,
            updatedAt: data.updatedAt ?? null,
            updatedByName: data.updatedByName ?? null,
            editReason: data.editReason ?? null,
          };
        });

        fList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setFuelings(fList);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar abastecimentos:", error);
      }

      // 3) Manutenções
      try {
        const maintSnap = await getDocs(
          query(
            collection(db, "maintenances"),
            where("vehicleId", "==", params.id)
          )
        );

        const mList: Maintenance[] = maintSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            date: data.date,
            odometerKm: Number(data.odometerKm || 0),
            type: data.type,
            cost: Number(data.cost || 0),
            responsibleUserName: data.responsibleUserName ?? null,
            workshopName: data.workshopName ?? data.workshop ?? null,
            status: data.status ?? "em_andamento",
            endKm: data.endKm ?? null,
            notes:
              data.notes ??
              data.observacoes ??
              data.description ??
              data.obs ??
              null,
            updatedAt: data.updatedAt ?? null,
            updatedByName: data.updatedByName ?? null,
            editReason: data.editReason ?? null,
          };
        });

        mList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setMaintenances(mList);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar manutenções:", error);
      }

      // 4) Rotas
      try {
        const routesSnap = await getDocs(
          query(collection(db, "routes"), where("vehicleId", "==", params.id))
        );

        const rList: RouteItem[] = routesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            driverName: data.driverName,
            origem: data.origem ?? null,
            destino: data.destino ?? null,
            startKm: Number(data.startKm || 0),
            endKm: data.endKm ?? null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            status: data.status ?? "em_andamento",
            notes: data.observacoes ?? data.notes ?? null,
            updatedAt: data.updatedAt ?? null,
            updatedByName: data.updatedByName ?? null,
            editReason: data.editReason ?? null,
            canceledAt: data.canceledAt ?? null,
            canceledByName: data.canceledByName ?? null,
            cancelReason: data.cancelReason ?? null,
          };
        });

        rList.sort((a, b) => (b.startAt || "").localeCompare(a.startAt || ""));
        setRoutes(rList);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar rotas:", error);
      }

      setLoading(false);
    }

    loadData();
  }, [user, params?.id]);

  // ===== Helper de filtro por período =====
  function isWithinRange(isoDate: string | null | undefined) {
    if (!isoDate) return false;
    const d = new Date(isoDate);
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

  // ===== Arrays filtrados pelo período =====
  const filteredFuelings = useMemo(() => {
    if (!startDate && !endDate) return fuelings;
    return fuelings.filter((f) => isWithinRange(f.date));
  }, [fuelings, startDate, endDate]);

  const filteredMaintenances = useMemo(() => {
    if (!startDate && !endDate) return maintenances;
    return maintenances.filter((m) => isWithinRange(m.date));
  }, [maintenances, startDate, endDate]);

  const filteredRoutes = useMemo(() => {
    if (!startDate && !endDate) return routes;
    return routes.filter((r) => isWithinRange(r.startAt || r.endAt || null));
  }, [routes, startDate, endDate]);

  // ===== Métricas do PERÍODO =====
  const totalCombustivel = useMemo(
    () => filteredFuelings.reduce((acc, f) => acc + Number(f.total || 0), 0),
    [filteredFuelings]
  );

  const litrosAbastecidos = useMemo(
    () => filteredFuelings.reduce((acc, f) => acc + Number(f.liters || 0), 0),
    [filteredFuelings]
  );

  const totalManutencao = useMemo(
    () => filteredMaintenances.reduce((acc, m) => acc + Number(m.cost || 0), 0),
    [filteredMaintenances]
  );

  const rotasFinalizadas = filteredRoutes.filter(
    (r) => r.status === "finalizada"
  );
  const rotasEmAndamento = filteredRoutes.filter(
    (r) => r.status === "em_andamento"
  );

  const totalKmRodadoPeriodo = useMemo(() => {
    return filteredRoutes.reduce((acc, r) => {
      if (r.endKm != null) {
        return acc + (r.endKm - r.startKm);
      }
      return acc;
    }, 0);
  }, [filteredRoutes]);

  // Gráfico usando registros filtrados
  const fuelChartData = useMemo(() => {
    if (filteredFuelings.length === 0) return null;

    const sorted = [...filteredFuelings].sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );

    return {
      labels: sorted.map((f) =>
        f.date ? new Date(f.date).toLocaleDateString("pt-BR") : "–"
      ),
      datasets: [
        {
          label: "Litros",
          data: sorted.map((f) => Number(f.liters || 0)),
          borderColor: "#facc15",
          backgroundColor: "rgba(250, 204, 21, 0.18)",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#facc15",
          yAxisID: "y",
        },
        {
          label: "Valor total",
          data: sorted.map((f) => Number(f.total || 0)),
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.16)",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#38bdf8",
          yAxisID: "y1",
        },
      ],
    };
  }, [filteredFuelings]);

  const filtrosAtivos = !!startDate || !!endDate;

  const { start: defaultMonthStart, end: defaultMonthEnd } =
    getCurrentMonthRange();
  const filtrosPadraoMes =
    startDate === defaultMonthStart && endDate === defaultMonthEnd;

  const statusBadgeClass =
    vehicle?.status === "disponivel"
      ? "bg-green-500/20 text-green-300 border-green-500/40"
      : vehicle?.status === "em_rota"
      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
      : "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";

  const statusText =
    vehicle?.status === "disponivel"
      ? "Disponível"
      : vehicle?.status === "em_rota"
      ? "Em rota"
      : "Em manutenção";

  // Nome do responsável principal + contador de co-responsáveis
  const primaryResponsibleName = useMemo(() => {
    if (!vehicle) return "";
    if (vehicle.responsibleUserName) return vehicle.responsibleUserName;
    if (vehicle.responsibleUsers && vehicle.responsibleUsers.length > 0) {
      return vehicle.responsibleUsers[0].name;
    }
    return "";
  }, [vehicle]);

  const otherResponsiblesCount = useMemo(() => {
    if (!vehicle || !vehicle.responsibleUsers) return 0;
    return Math.max(0, vehicle.responsibleUsers.length - 1);
  }, [vehicle]);

  const responsaveisLabel = useMemo(() => {
    if (!primaryResponsibleName) return "-";
    if (otherResponsiblesCount === 0) return primaryResponsibleName;
    if (otherResponsiblesCount === 1)
      return `${primaryResponsibleName} + 1 co-responsável`;
    return `${primaryResponsibleName} + ${otherResponsiblesCount} co-responsáveis`;
  }, [primaryResponsibleName, otherResponsiblesCount]);

  const canEditGeneralNotes =
    !!user &&
    !!vehicle &&
    (user.role === "admin" ||
      vehicle.responsibleUserIds?.includes(user.id) ||
      (!!vehicle.responsibleUserId && vehicle.responsibleUserId === user.id));

  // ===== PDF =====
  async function handleGeneratePdf() {
    if (!vehicle) return;

    try {
      setGeneratingPdf(true);

      const docPdf = new jsPDF();
      const marginLeft = 14;
      let currentY = 20;

      // Tenta carregar logo (assumindo que está em /public/favicon.png)
      const logoSrc = "/favicon.png";
      const img = new Image();
      img.src = logoSrc;

      await new Promise<void>((resolve) => {
        img.onload = () => {
          try {
            docPdf.addImage(img, "PNG", 165, 8, 30, 15);
          } catch {
            // se der erro, só segue sem logo
          }
          resolve();
        };
        img.onerror = () => resolve();
      });

      // Cabeçalho
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(16);
      docPdf.text("MM Frota", marginLeft, currentY);
      currentY += 7;

      docPdf.setFontSize(13);
      docPdf.text("Relatório detalhado do veículo", marginLeft, currentY);
      currentY += 8;

      docPdf.setFontSize(9);
      docPdf.setFont("helvetica", "normal");
      docPdf.text(
        `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
        marginLeft,
        currentY
      );
      currentY += 5;

      const periodoLabel =
        !startDate && !endDate
          ? "Período: todos os registros"
          : `Período: ${
              startDate
                ? new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")
                : "início"
            } até ${
              endDate
                ? new Date(endDate + "T23:59:59").toLocaleDateString("pt-BR")
                : "hoje"
            }`;

      docPdf.text(periodoLabel, marginLeft, currentY);
      currentY += 8;

      // Bloco visual com dados do veículo
      docPdf.setDrawColor(15, 23, 42);
      docPdf.setFillColor(245, 245, 245);
      docPdf.rect(marginLeft - 2, currentY - 5, 180, 24, "S");
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(10);
      docPdf.text(
        `Veículo: ${vehicle.plate} · ${vehicle.model}`,
        marginLeft,
        currentY
      );
      currentY += 5;

      const statusLabelPdf =
        vehicle.status === "disponivel"
          ? "Disponível"
          : vehicle.status === "em_rota"
          ? "Em rota"
          : "Em manutenção";

      docPdf.setFont("helvetica", "normal");
      docPdf.text(
        `Loja: ${vehicle.storeId}   |   Status: ${statusLabelPdf}`,
        marginLeft,
        currentY
      );
      currentY += 5;

      const responsaveisPdfLabel = (() => {
        if (!vehicle.responsibleUsers || vehicle.responsibleUsers.length === 0) {
          return vehicle.responsibleUserName || "-";
        }
        const names = vehicle.responsibleUsers.map((u) => u.name);
        return names.join(", ");
      })();

      docPdf.text(
        `Responsáveis: ${responsaveisPdfLabel}`,
        marginLeft,
        currentY
      );
      currentY += 5;

      docPdf.text(
        `KM atual (aprox.): ${vehicle.currentKm ?? "-"} km`,
        marginLeft,
        currentY
      );
      currentY += 10;

      // Observações gerais do veículo
      if (generalNotes && generalNotes.trim()) {
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.text("Observações gerais do veículo", marginLeft, currentY);
        currentY += 5;

        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        const wrapped = docPdf.splitTextToSize(generalNotes.trim(), 180);
        docPdf.text(wrapped, marginLeft, currentY);
        currentY += wrapped.length * 4 + 6;
      }

      // Resumo do período (tabela)
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(11);
      docPdf.text(
        "Resumo financeiro e operacional do período",
        marginLeft,
        currentY
      );
      currentY += 6;

      autoTable(docPdf, {
        startY: currentY,
        head: [["Indicador", "Valor"]],
        body: [
          [
            "Total em combustíveis",
            `R$ ${totalCombustivel.toFixed(2)}  (${litrosAbastecidos.toFixed(
              2
            )} L)`,
          ],
          ["Total em manutenções", `R$ ${totalManutencao.toFixed(2)}`],
          [
            "Km rodados em rotas finalizadas",
            `${totalKmRodadoPeriodo.toFixed(1)} km`,
          ],
          [
            "Quantidade de rotas no período",
            `${filteredRoutes.length} ( ${rotasFinalizadas.length} finalizadas / ${rotasEmAndamento.length} em andamento )`,
          ],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [250, 204, 21], textColor: 0 },
      });

      // @ts-ignore
      currentY = (docPdf as any).lastAutoTable.finalY + 10;

      // Abastecimentos do período
      if (filteredFuelings.length > 0) {
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.text("Abastecimentos no período", marginLeft, currentY);
        currentY += 4;

        autoTable(docPdf, {
          startY: currentY,
          head: [["Data", "Litros", "Total (R$)", "Preço/L", "Posto", "Obs."]],
          body: filteredFuelings.map((f) => [
            f.date ? new Date(f.date).toLocaleString("pt-BR") : "",
            f.liters.toFixed(2),
            f.total.toFixed(2),
            f.pricePerL.toFixed(2),
            f.stationName || "-",
            f.notes ? truncate(f.notes, 40) : "-",
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [15, 23, 42], textColor: [250, 250, 250] },
        });

        // @ts-ignore
        currentY = (docPdf as any).lastAutoTable.finalY + 8;
      }

      // Manutenções do período
      if (filteredMaintenances.length > 0) {
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.text("Manutenções no período", marginLeft, currentY);
        currentY += 4;

        autoTable(docPdf, {
          startY: currentY,
          head: [["Data", "Tipo", "Oficina", "Status", "Custo (R$)", "Obs."]],
          body: filteredMaintenances.map((m) => [
            m.date ? new Date(m.date).toLocaleString("pt-BR") : "",
            m.type,
            m.workshopName || "-",
            m.status === "concluida" ? "Concluída" : "Em andamento",
            m.cost.toFixed(2),
            m.notes ? truncate(m.notes, 40) : "-",
          ]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [15, 23, 42], textColor: [250, 250, 250] },
        });

        // @ts-ignore
        currentY = (docPdf as any).lastAutoTable.finalY + 8;
      }

      // Rotas do período
      if (filteredRoutes.length > 0) {
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.text("Rotas do período", marginLeft, currentY);
        currentY += 4;

        autoTable(docPdf, {
          startY: currentY,
          head: [
            [
              "Data",
              "Motorista",
              "Origem",
              "Destino",
              "Status",
              "KM início",
              "KM fim",
              "KM total",
              "Obs.",
            ],
          ],
          body: filteredRoutes.map((r) => {
            const kmFim = r.endKm != null ? `${r.endKm} km` : "-";
            const kmTotal =
              r.endKm != null ? `${(r.endKm - r.startKm).toFixed(1)} km` : "-";

            return [
              r.startAt ? new Date(r.startAt).toLocaleString("pt-BR") : "",
              r.driverName,
              r.origem || "-",
              r.destino || "-",
              r.status === "finalizada" ? "Finalizada" : "Em andamento",
              `${r.startKm} km`,
              kmFim,
              kmTotal,
              r.notes ? truncate(r.notes, 35) : "-",
            ];
          }),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [15, 23, 42], textColor: [250, 250, 250] },
        });
      }

      const fileName = `relatorio-veiculo-${vehicle.plate.replace(
        /\s+/g,
        "-"
      )}.pdf`;
      docPdf.save(fileName);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setErrorMsg("Nao foi possivel gerar o PDF. Tente novamente.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  // salvar observações gerais no Firestore
  async function handleSaveGeneralNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle || !user) return;

    try {
      setSavingGeneralNotes(true);
      setGeneralNotesMsg(null);

      const nowIso = new Date().toISOString();

      await updateDoc(fsDoc(db, "vehicles", vehicle.id), {
        vehicleNotes: generalNotesDraft.trim() || null,
        updatedVehicleNotesAt: nowIso,
        updatedVehicleNotesById: user.id,
        updatedVehicleNotesByName: user.name,
      });

      setGeneralNotes(generalNotesDraft.trim() || null);
      setEditingGeneralNotes(false);
      setGeneralNotesMsg({
        type: "success",
        text: "Observações gerais atualizadas com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao salvar observações gerais:", error);
      setGeneralNotesMsg({
        type: "error",
        text: "Erro ao salvar observações gerais. Tente novamente.",
      });
    } finally {
      setSavingGeneralNotes(false);
    }
  }


  // Helper pra mostrar o período atual na tela
  const periodoTexto = useMemo(() => {
    if (!startDate && !endDate) return "Mostrando todos os registros";
    const inicio = startDate
      ? new Date(startDate + "T00:00:00").toLocaleDateString("pt-BR")
      : "início";
    const fim = endDate
      ? new Date(endDate + "T23:59:59").toLocaleDateString("pt-BR")
      : "hoje";
    return `Período: ${inicio} até ${fim}`;
  }, [startDate, endDate]);

  const totalCustoPeriodo = totalCombustivel + totalManutencao;
  const manutencoesAbertas = filteredMaintenances.filter(
    (maintenance) => maintenance.status === "em_andamento"
  ).length;
  const ultimosAbastecimentos = filteredFuelings.slice(0, 5);
  const ultimasRotas = filteredRoutes.slice(0, 24);
  const precoMedioLitro =
    litrosAbastecidos > 0 ? totalCombustivel / litrosAbastecidos : 0;
  const ticketMedioCombustivel =
    filteredFuelings.length > 0 ? totalCombustivel / filteredFuelings.length : 0;
  const statusMetricAccent =
    vehicle?.status === "disponivel"
      ? "green"
      : vehicle?.status === "em_rota"
      ? "blue"
      : "yellow";
  const latestFueling = fuelings[0] ?? null;
  const latestMaintenance = maintenances[0] ?? null;
  const latestRoute = routes[0] ?? null;
  const highestKnownKm = useMemo(() => {
    const values: number[] = [];

    if (vehicle?.currentKm != null) values.push(vehicle.currentKm);

    fuelings.forEach((fueling) => {
      if (fueling.odometerKm != null) values.push(fueling.odometerKm);
    });

    maintenances.forEach((maintenance) => {
      if (maintenance.odometerKm != null) values.push(maintenance.odometerKm);
      if (maintenance.endKm != null) values.push(maintenance.endKm);
    });

    routes.forEach((route) => {
      if (route.startKm != null) values.push(route.startKm);
      if (route.endKm != null) values.push(route.endKm);
    });

    return values.length ? Math.max(...values) : null;
  }, [fuelings, maintenances, routes, vehicle?.currentKm]);
  const divergenceItems = useMemo(() => {
    const items: string[] = [];
    const hasOpenRoute = routes.some((route) => route.status === "em_andamento");
    const hasOpenMaintenance = maintenances.some(
      (maintenance) => maintenance.status === "em_andamento"
    );

    if (vehicle?.status === "disponivel" && hasOpenRoute) {
      items.push("O veículo está como disponível, mas existe rota em andamento.");
    }

    if (vehicle?.status === "em_rota" && !hasOpenRoute) {
      items.push("O veículo está como em rota, mas não há rota aberta.");
    }

    if (vehicle?.status === "manutencao" && !hasOpenMaintenance) {
      items.push("O veículo está em manutenção, mas não existe manutenção aberta.");
    }

    if (hasOpenRoute && hasOpenMaintenance) {
      items.push("Existe rota em andamento ao mesmo tempo que uma manutenção aberta.");
    }

    if (
      vehicle?.currentKm != null &&
      highestKnownKm != null &&
      highestKnownKm > vehicle.currentKm
    ) {
      items.push(
        `O KM atual do veículo (${vehicle.currentKm} km) está abaixo do maior KM já registrado (${highestKnownKm} km).`
      );
    }

    return items;
  }, [highestKnownKm, maintenances, routes, vehicle?.currentKm, vehicle?.status]);
  const timelineEntries = useMemo(() => {
    const entries = [
      ...fuelings.map((fueling) => ({
        id: `fuel-${fueling.id}`,
        date: fueling.date,
        type: "Abastecimento",
        title: fueling.stationName || "Posto nao informado",
        subtitle: `${formatCurrency(fueling.total)} • ${fueling.liters.toFixed(
          1
        )} L • ${fueling.odometerKm} km`,
        note: fueling.notes || null,
      })),
      ...maintenances.map((maintenance) => ({
        id: `maintenance-${maintenance.id}`,
        date: maintenance.date,
        type: "Manutencao",
        title: maintenance.type,
        subtitle: `${formatCurrency(maintenance.cost)} • ${
          maintenance.status === "em_andamento" ? "Em andamento" : "Concluida"
        } • ${maintenance.odometerKm} km`,
        note: maintenance.notes || maintenance.editReason || null,
      })),
      ...routes.map((route) => ({
        id: `route-${route.id}`,
        date: route.endAt || route.startAt || route.canceledAt || null,
        type: "Rota",
        title: route.driverName,
        subtitle: `${route.origem || "-"} -> ${route.destino || "-"} • ${
          route.endKm != null ? `${(route.endKm - route.startKm).toFixed(1)} km` : "Sem fechamento"
        }`,
        note:
          route.notes ||
          route.cancelReason ||
          route.editReason ||
          null,
      })),
    ];

    return entries
      .filter((entry) => !!entry.date)
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      )
      .slice(0, 10);
  }, [fuelings, maintenances, routes]);

  if (!user) return null;

  return (
    <div className="app-page space-y-6">
      <PageHeader
        eyebrow="Analise individual"
        title={
          vehicle
            ? `${vehicle.plate} | ${vehicle.model}`
            : "Detalhes do veiculo"
        }
        description={
          vehicle
            ? `Loja ${vehicle.storeId}. Veja custo, rotas, manutencoes e observacoes em um unico painel.`
            : "Acompanhe o historico e o desempenho operacional do veiculo."
        }
        icon={Car}
        iconTone="yellow"
        badges={
          vehicle ? (
            <>
              <span className={`app-chip border ${statusBadgeClass}`}>
                {statusText}
              </span>
              <span className="app-chip">
                <Info className="h-3.5 w-3.5" />
                {responsaveisLabel}
              </span>
              <span className="app-chip">
                KM atual: {vehicle.currentKm != null ? `${vehicle.currentKm} km` : "-"}
              </span>
              <span className="app-chip">{periodoTexto}</span>
            </>
          ) : null
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => router.push("/veiculos")}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            {vehicle ? (
              <Button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="gap-2"
              >
                <FileDown className="h-4 w-4" />
                {generatingPdf ? "Gerando PDF..." : "Gerar PDF"}
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="app-panel-muted p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Filtro de periodo
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ajuste o intervalo para analisar custo, rotas e manutencoes com
                foco no periodo certo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const { start, end } = getCurrentMonthRange();
                  setStartDate(start);
                  setEndDate(end);
                }}
              >
                <CalendarDays className="h-4 w-4" />
                Mes atual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
              >
                <ListFilter className="h-4 w-4" />
                Todos os registros
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[180px_180px_minmax(0,1fr)]">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Data inicial
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="app-field"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Data final
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="app-field"
              />
            </div>

            <div className="flex items-end">
              <div className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                <p className="font-medium text-slate-900 dark:text-white">
                  {periodoTexto}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {filtrosPadraoMes
                    ? "Leitura padrao do mes atual."
                    : filtrosAtivos
                    ? "Os dados abaixo refletem exatamente este intervalo."
                    : "Todos os registros do veiculo estao visiveis."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}

      {loading || !vehicle ? (
        <Card className="app-panel p-6 text-sm text-slate-500 dark:text-slate-400">
          Carregando dados do veiculo...
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Status atual"
              value={statusText}
              helper={`Responsaveis: ${responsaveisLabel}`}
              icon={Car}
              accent={statusMetricAccent}
            />
            <MetricCard
              label="Custo do periodo"
              value={formatCurrency(totalCustoPeriodo)}
              helper={`${formatCurrency(totalCombustivel)} combustivel + ${formatCurrency(totalManutencao)} manutencao`}
              icon={Fuel}
              accent="yellow"
            />
            <MetricCard
              label="KM rodado"
              value={`${totalKmRodadoPeriodo.toFixed(1)} km`}
              helper={`${rotasFinalizadas.length} rotas finalizadas no periodo`}
              icon={Map}
              accent="blue"
            />
            <MetricCard
              label="Manutencoes"
              value={String(filteredMaintenances.length)}
              helper={`${manutencoesAbertas} em andamento e ${filteredRoutes.length} rotas no periodo`}
              icon={Wrench}
              accent="yellow"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <div className="space-y-4">
              <Card className="app-panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                        <Info className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                          Observacoes gerais do veiculo
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Registro permanente do veiculo e referencia para o PDF.
                        </p>
                      </div>
                    </div>
                  </div>

                  {canEditGeneralNotes && !editingGeneralNotes ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setGeneralNotesDraft(generalNotes ?? "");
                        setGeneralNotesMsg(null);
                        setEditingGeneralNotes(true);
                      }}
                    >
                      {generalNotes ? "Editar observacoes" : "Adicionar observacoes"}
                    </Button>
                  ) : null}
                </div>

                {generalNotesMsg ? (
                  <div
                    className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                      generalNotesMsg.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                        : "border-red-500/20 bg-red-500/10 text-red-200"
                    }`}
                  >
                    {generalNotesMsg.text}
                  </div>
                ) : null}

                {editingGeneralNotes && canEditGeneralNotes ? (
                  <form onSubmit={handleSaveGeneralNotes} className="mt-4 space-y-3">
                    <textarea
                      value={generalNotesDraft}
                      onChange={(e) => setGeneralNotesDraft(e.target.value)}
                      className="min-h-[140px] w-full resize-y rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-yellow-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:placeholder:text-slate-500"
                      placeholder="Ex: Veiculo principal das entregas da unidade, com atencao especial a manutencao preventiva e controle de pneus."
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="submit" disabled={savingGeneralNotes}>
                        {savingGeneralNotes ? "Salvando..." : "Salvar observacoes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingGeneralNotes(false);
                          setGeneralNotesDraft(generalNotes ?? "");
                          setGeneralNotesMsg(null);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                    {generalNotes && generalNotes.trim() ? (
                      <p className="whitespace-pre-wrap">{generalNotes}</p>
                    ) : (
                      <span className="italic text-slate-500 dark:text-slate-500">
                        Nenhuma observacao geral registrada para este veiculo.
                      </span>
                    )}
                  </div>
                )}
              </Card>

              <Card className="app-panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-2 text-blue-300">
                      <Fuel className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Abastecimentos no periodo
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Curva de abastecimento e ultimos registros do intervalo.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {filteredFuelings.length} registro(s)
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  {fuelChartData ? (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[24px] border border-yellow-500/20 bg-yellow-500/10 p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Ticket medio
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(ticketMedioCombustivel)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Media por abastecimento no intervalo.
                          </p>
                        </div>
                        <div className="rounded-[24px] border border-blue-500/20 bg-blue-500/10 p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Preco medio por litro
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(precoMedioLitro)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Relacao entre custo total e litros abastecidos.
                          </p>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Leitura do periodo
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                            {litrosAbastecidos.toFixed(1)} L
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {filteredFuelings.length} registro(s) e {formatCurrency(totalCombustivel)} no total.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 dark:border-white/10 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              Evolucao do consumo e do gasto
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Litros no eixo esquerdo e valor total no eixo direito para comparar volume e custo.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                              Litros
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                              Valor total
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 h-72">
                          <Line
                            data={fuelChartData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: {
                                mode: "index",
                                intersect: false,
                              },
                              plugins: {
                                legend: {
                                  display: true,
                                  position: "bottom",
                                  labels: {
                                    color: "#94A3B8",
                                    usePointStyle: true,
                                    boxWidth: 10,
                                    boxHeight: 10,
                                    padding: 18,
                                  },
                                },
                                tooltip: {
                                  backgroundColor: "rgba(15, 23, 42, 0.94)",
                                  titleColor: "#F8FAFC",
                                  bodyColor: "#E2E8F0",
                                  borderColor: "rgba(148, 163, 184, 0.22)",
                                  borderWidth: 1,
                                  padding: 12,
                                  callbacks: {
                                    label: (context) => {
                                      if (context.dataset.yAxisID === "y1") {
                                        return `${context.dataset.label}: ${formatCurrency(
                                          Number(context.parsed.y || 0)
                                        )}`;
                                      }

                                      return `${context.dataset.label}: ${Number(
                                        context.parsed.y || 0
                                      ).toFixed(1)} L`;
                                    },
                                  },
                                },
                              },
                              scales: {
                                x: {
                                  ticks: {
                                    color: "#94A3B8",
                                    font: { size: 10 },
                                  },
                                  grid: { color: "rgba(148, 163, 184, 0.12)" },
                                },
                                y: {
                                  position: "left",
                                  beginAtZero: true,
                                  ticks: {
                                    color: "#FACC15",
                                    font: { size: 10 },
                                    callback: (value) => `${value} L`,
                                  },
                                  grid: { color: "rgba(148, 163, 184, 0.12)" },
                                },
                                y1: {
                                  position: "right",
                                  beginAtZero: true,
                                  ticks: {
                                    color: "#38BDF8",
                                    font: { size: 10 },
                                    callback: (value) => `R$ ${value}`,
                                  },
                                  grid: {
                                    drawOnChartArea: false,
                                  },
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                      Nenhum abastecimento neste periodo para este veiculo.
                    </div>
                  )}

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Ultimos abastecimentos
                      </p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {litrosAbastecidos.toFixed(1)} litros no periodo
                      </span>
                    </div>

                    {ultimosAbastecimentos.length ? (
                      <div className="mt-3 space-y-3">
                        {ultimosAbastecimentos.map((fueling) => (
                          <div
                            key={fueling.id}
                            className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/10"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">
                                {fueling.stationName || "Posto nao informado"}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {formatDateTime(fueling.date)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                KM: {fueling.odometerKm} km
                                {fueling.responsibleUserName
                                  ? ` • ${fueling.responsibleUserName}`
                                  : ""}
                              </p>
                              {fueling.notes ? (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {truncate(fueling.notes, 72)}
                                </p>
                              ) : null}
                              {fueling.updatedAt ? (
                                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  Editado por {fueling.updatedByName || "Admin"} em{" "}
                                  {formatDateTime(fueling.updatedAt)}
                                  {fueling.editReason ? ` • ${fueling.editReason}` : ""}
                                </p>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900 dark:text-yellow-300">
                                {formatCurrency(fueling.total)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {fueling.liters.toFixed(1)} L
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                        Nenhum registro disponivel neste intervalo.
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="app-panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                      <Map className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Rotas no periodo
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Historico operacional do veiculo com motorista, trajeto e KM.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {filteredRoutes.length} registro(s)
                  </span>
                </div>

                {ultimasRotas.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    Nenhuma rota registrada neste periodo para este veiculo.
                  </div>
                ) : (
                  <>
                    <div className="mt-4 space-y-3 md:hidden">
                      {ultimasRotas.map((route) => {
                        const kmTotal =
                          route.endKm != null ? route.endKm - route.startKm : null;

                        return (
                          <div
                            key={route.id}
                            className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {route.driverName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatDateTime(route.startAt)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  Duracao: {formatDuration(route.startAt, route.endAt)}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  route.status === "finalizada"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : route.status === "cancelada"
                                    ? "bg-red-500/15 text-red-300"
                                    : "bg-blue-500/15 text-blue-300"
                                }`}
                              >
                                {route.status === "finalizada"
                                  ? "Finalizada"
                                  : route.status === "cancelada"
                                  ? "Cancelada"
                                  : "Em andamento"}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                                  Trajeto
                                </p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                                  {(route.origem ?? "-") + " -> " + (route.destino ?? "-")}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                                  KM total
                                </p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                                  {kmTotal != null ? `${kmTotal.toFixed(1)} km` : "-"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                                  KM inicio / fim
                                </p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                                  {route.startKm} km
                                  {route.endKm != null ? ` / ${route.endKm} km` : ""}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                                  Encerramento
                                </p>
                                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                                  {route.endAt ? formatDateTime(route.endAt) : "-"}
                                </p>
                              </div>
                            </div>

                            {route.notes ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setObsViewer({
                                    title: "Observacoes da rota",
                                    subtitle: `${formatDateTime(route.startAt)} | ${route.driverName}`,
                                    note: route.notes!,
                                  })
                                }
                                className="mt-3 text-left text-xs text-slate-500 underline-offset-2 hover:text-yellow-300 hover:underline dark:text-slate-400"
                              >
                                {truncate(route.notes, 96)} (ver tudo)
                              </button>
                            ) : null}
                            {route.updatedAt ? (
                              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                                Editada por {route.updatedByName || "Admin"} em{" "}
                                {formatDateTime(route.updatedAt)}
                                {route.editReason ? ` • ${route.editReason}` : ""}
                              </p>
                            ) : null}
                            {route.canceledAt ? (
                              <p className="mt-2 text-[11px] text-red-300">
                                Cancelada por {route.canceledByName || "Admin"} em{" "}
                                {formatDateTime(route.canceledAt)}
                                {route.cancelReason ? ` • ${route.cancelReason}` : ""}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 hidden overflow-x-auto md:block">
                      <table className="min-w-[880px] w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-white/10 dark:text-slate-400">
                            <th className="py-3 pr-3 font-medium">Data</th>
                            <th className="px-3 py-3 font-medium">Motorista</th>
                            <th className="px-3 py-3 font-medium">Trajeto</th>
                            <th className="px-3 py-3 font-medium">KM inicio</th>
                            <th className="px-3 py-3 font-medium">KM fim</th>
                            <th className="px-3 py-3 font-medium">KM total</th>
                            <th className="px-3 py-3 font-medium">Obs. / auditoria</th>
                            <th className="py-3 pl-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ultimasRotas.map((route) => {
                            const kmTotal =
                              route.endKm != null ? route.endKm - route.startKm : null;

                            return (
                              <tr
                                key={route.id}
                                className="border-b border-slate-200/80 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                              >
                                <td className="py-3 pr-3 text-slate-600 dark:text-slate-300">
                                  {formatDateTime(route.startAt)}
                                </td>
                                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                  {route.driverName}
                                </td>
                                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                  {(route.origem ?? "-") + " -> " + (route.destino ?? "-")}
                                </td>
                                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                  {route.startKm} km
                                </td>
                                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                  {route.endKm != null ? `${route.endKm} km` : "-"}
                                </td>
                                <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                                  {kmTotal != null ? `${kmTotal.toFixed(1)} km` : "-"}
                                </td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                  <div className="space-y-1">
                                    {route.notes ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setObsViewer({
                                            title: "Observacoes da rota",
                                            subtitle: `${formatDateTime(route.startAt)} | ${route.driverName}`,
                                            note: route.notes!,
                                          })
                                        }
                                        className="max-w-[220px] truncate text-left text-xs underline-offset-2 hover:text-yellow-300 hover:underline"
                                      >
                                        {truncate(route.notes, 58)}
                                      </button>
                                    ) : (
                                      <span className="text-xs text-slate-400 dark:text-slate-500">
                                        Sem observacao
                                      </span>
                                    )}
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      Duracao: {formatDuration(route.startAt, route.endAt)}
                                    </p>
                                    {route.updatedAt ? (
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                        Editada por {route.updatedByName || "Admin"} •{" "}
                                        {formatDateTime(route.updatedAt)}
                                        {route.editReason ? ` • ${route.editReason}` : ""}
                                      </p>
                                    ) : null}
                                    {route.canceledAt ? (
                                      <p className="text-[11px] text-red-300">
                                        Cancelada por {route.canceledByName || "Admin"} •{" "}
                                        {formatDateTime(route.canceledAt)}
                                        {route.cancelReason ? ` • ${route.cancelReason}` : ""}
                                      </p>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="py-3 pl-3">
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      route.status === "finalizada"
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : route.status === "cancelada"
                                        ? "bg-red-500/15 text-red-300"
                                        : "bg-blue-500/15 text-blue-300"
                                    }`}
                                  >
                                    {route.status === "finalizada"
                                      ? "Finalizada"
                                      : route.status === "cancelada"
                                      ? "Cancelada"
                                      : "Em andamento"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Card>

              <Card className="app-panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                      <Wrench className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Manutencoes do periodo
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Lista rapida das ultimas intervencoes do veiculo.
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    {filteredMaintenances.length} registro(s)
                  </span>
                </div>

                {filteredMaintenances.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    Nenhuma manutencao registrada neste periodo.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {filteredMaintenances.slice(0, 10).map((maintenance) => (
                      <div
                        key={maintenance.id}
                        className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {maintenance.type}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatDateTime(maintenance.date)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Entrada: {maintenance.odometerKm} km
                              {maintenance.endKm != null
                                ? ` • Saida: ${maintenance.endKm} km`
                                : ""}
                              {maintenance.responsibleUserName
                                ? ` • ${maintenance.responsibleUserName}`
                                : ""}
                            </p>
                            {maintenance.workshopName ? (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {maintenance.workshopName}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900 dark:text-yellow-300">
                              {formatCurrency(maintenance.cost)}
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                maintenance.status === "em_andamento"
                                  ? "bg-yellow-500/15 text-yellow-300"
                                  : "bg-emerald-500/15 text-emerald-300"
                              }`}
                            >
                              {maintenance.status === "em_andamento"
                                ? "Em andamento"
                                : "Concluida"}
                            </span>
                          </div>
                        </div>

                        {maintenance.notes ? (
                          <button
                            type="button"
                            onClick={() =>
                              setObsViewer({
                                title: "Observacoes da manutencao",
                                subtitle: `${maintenance.type} | ${formatDateTime(
                                  maintenance.date
                                )}`,
                                note: maintenance.notes!,
                              })
                            }
                            className="mt-3 text-left text-xs text-slate-500 underline-offset-2 hover:text-yellow-300 hover:underline dark:text-slate-400"
                          >
                            {truncate(maintenance.notes, 96)} (ver tudo)
                          </button>
                        ) : null}
                        {maintenance.updatedAt ? (
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                            Editada por {maintenance.updatedByName || "Admin"} em{" "}
                            {formatDateTime(maintenance.updatedAt)}
                            {maintenance.editReason ? ` • ${maintenance.editReason}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="app-panel p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                    <Car className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Ficha do veiculo
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Dados-base para conferencia e validacao rapida.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="text-slate-500 dark:text-slate-400">Placa</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">
                      {vehicle.plate}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="text-slate-500 dark:text-slate-400">Modelo</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {vehicle.model}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="text-slate-500 dark:text-slate-400">Loja</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {vehicle.storeId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="text-slate-500 dark:text-slate-400">KM atual</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {vehicle.currentKm != null ? `${vehicle.currentKm} km` : "-"}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-slate-500 dark:text-slate-400">Responsaveis</p>
                    <p className="mt-2 text-sm leading-7 text-slate-900 dark:text-white">
                      {vehicle.responsibleUsers.length
                        ? vehicle.responsibleUsers
                            .map((responsible) => responsible.name)
                            .join(", ")
                        : responsaveisLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-slate-500 dark:text-slate-400">Ultima movimentacao</p>
                    <div className="mt-2 space-y-1 text-sm text-slate-900 dark:text-white">
                      <p>
                        Rota: {latestRoute ? formatDateTime(latestRoute.endAt || latestRoute.startAt) : "-"}
                      </p>
                      <p>
                        Abastecimento: {latestFueling ? formatDateTime(latestFueling.date) : "-"}
                      </p>
                      <p>
                        Manutencao: {latestMaintenance ? formatDateTime(latestMaintenance.date) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="app-panel p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Conferencia e divergencias
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Alertas para apoiar auditoria e investigacao de inconsistencias.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Maior KM conhecido
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {highestKnownKm != null ? `${highestKnownKm} km` : "-"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Comparado com o KM atual do cadastro para validar consistencia.
                    </p>
                  </div>

                  {divergenceItems.length ? (
                    <div className="space-y-2">
                      {divergenceItems.map((item) => (
                        <div
                          key={item}
                          className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100"
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                      Nenhuma divergencia operacional identificada com os dados carregados.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="app-panel p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                    <Info className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Visao do periodo
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Resumo rapido do custo e da operacao.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Custo consolidado
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(totalCustoPeriodo)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatCurrency(totalCombustivel)} combustivel + {formatCurrency(totalManutencao)} manutencao
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="text-slate-500 dark:text-slate-400">Abastecimentos</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {filteredFuelings.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="text-slate-500 dark:text-slate-400">Rotas finalizadas</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {rotasFinalizadas.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="text-slate-500 dark:text-slate-400">Rotas em andamento</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {rotasEmAndamento.length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="text-slate-500 dark:text-slate-400">Manutencoes abertas</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {manutencoesAbertas}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="app-panel p-5">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-2 text-blue-300">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Linha do tempo recente
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Ultimos eventos do veiculo para conferencia rapida.
                    </p>
                  </div>
                </div>

                {timelineEntries.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    Nenhuma movimentacao recente encontrada.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {timelineEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {entry.type}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                              {entry.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {entry.subtitle}
                            </p>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {formatDateTime(entry.date)}
                          </span>
                        </div>
                        {entry.note ? (
                          <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                            {truncate(entry.note, 120)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="hidden">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-2 text-yellow-400">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Manutencoes do periodo
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Lista rapida das ultimas intervencoes do veiculo.
                    </p>
                  </div>
                </div>

                {filteredMaintenances.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    Nenhuma manutencao registrada neste periodo.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {filteredMaintenances.slice(0, 10).map((maintenance) => (
                      <div
                        key={maintenance.id}
                        className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {maintenance.type}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatDateTime(maintenance.date)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              Entrada: {maintenance.odometerKm} km
                              {maintenance.endKm != null
                                ? ` • Saida: ${maintenance.endKm} km`
                                : ""}
                              {maintenance.responsibleUserName
                                ? ` • ${maintenance.responsibleUserName}`
                                : ""}
                            </p>
                            {maintenance.workshopName ? (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {maintenance.workshopName}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900 dark:text-yellow-300">
                              {formatCurrency(maintenance.cost)}
                            </p>
                            <span
                              className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                maintenance.status === "em_andamento"
                                  ? "bg-yellow-500/15 text-yellow-300"
                                  : "bg-emerald-500/15 text-emerald-300"
                              }`}
                            >
                              {maintenance.status === "em_andamento"
                                ? "Em andamento"
                                : "Concluida"}
                            </span>
                          </div>
                        </div>

                        {maintenance.notes ? (
                          <button
                            type="button"
                            onClick={() =>
                              setObsViewer({
                                title: "Observacoes da manutencao",
                                subtitle: `${maintenance.type} | ${formatDateTime(
                                  maintenance.date
                                )}`,
                                note: maintenance.notes!,
                              })
                            }
                            className="mt-3 text-left text-xs text-slate-500 underline-offset-2 hover:text-yellow-300 hover:underline dark:text-slate-400"
                          >
                            {truncate(maintenance.notes, 96)} (ver tudo)
                          </button>
                        ) : null}
                        {maintenance.updatedAt ? (
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                            Editada por {maintenance.updatedByName || "Admin"} em{" "}
                            {formatDateTime(maintenance.updatedAt)}
                            {maintenance.editReason ? ` • ${maintenance.editReason}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={!!obsViewer}
        onOpenChange={(open) => {
          if (!open) {
            setObsViewer(null);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
            <DialogTitle className="text-slate-950 dark:text-white">
              {obsViewer?.title || "Observacoes"}
            </DialogTitle>
            <DialogDescription>
              {obsViewer?.subtitle || "Texto completo do registro selecionado."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
              {obsViewer?.note}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
