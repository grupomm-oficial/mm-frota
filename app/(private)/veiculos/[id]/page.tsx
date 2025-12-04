"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
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
  Car,
  Fuel,
  Wrench,
  Map,
  ArrowLeft,
  FileDown,
  Info,
  CalendarDays,
  ListFilter,
  X,
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

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  status: VehicleStatus;
  currentKm?: number;
  responsibleUserId: string;
  responsibleUserName: string;
  generalNotes?: string | null;
}

interface Fueling {
  id: string;
  date: string;
  liters: number;
  total: number;
  pricePerL: number;
  stationName?: string | null;
  notes?: string | null;
}

interface Maintenance {
  id: string;
  date: string;
  type: string;
  cost: number;
  workshopName?: string | null;
  status: "em_andamento" | "concluida";
  notes?: string | null;
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
  status: "em_andamento" | "finalizada";
  notes?: string | null;
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
        const vehicleRef = doc(db, "vehicles", params.id);
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

        const vehicleObj: Vehicle = {
          id: vehicleSnap.id,
          plate: vData.plate,
          model: vData.model,
          storeId: vData.storeId,
          status: vData.status ?? "disponivel",
          currentKm: vData.currentKm,
          responsibleUserId: vData.responsibleUserId,
          responsibleUserName: vData.responsibleUserName,
          generalNotes: generalNotesFromDb,
        };

        // segurança: user comum só vê se for responsável
        if (user.role !== "admin" && vehicleObj.responsibleUserId !== user.id) {
          setErrorMsg("Você não tem acesso a este veículo.");
          setLoading(false);
          return;
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
            liters: Number(data.liters || 0),
            total: Number(data.total || 0),
            pricePerL: Number(data.pricePerL || 0),
            stationName: data.stationName ?? null,
            notes: data.notes ?? data.observacoes ?? null,
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
            type: data.type,
            cost: Number(data.cost || 0),
            workshopName: data.workshopName ?? data.workshop ?? null,
            status: data.status ?? "em_andamento",
            notes:
              data.notes ??
              data.observacoes ??
              data.description ??
              data.obs ??
              null,
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
          label: "Litros abastecidos",
          data: sorted.map((f) => Number(f.liters || 0)),
          borderColor: "#facc15",
          backgroundColor: "rgba(250, 204, 21, 0.15)",
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: "#facc15",
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

  const canEditGeneralNotes =
    !!user &&
    !!vehicle &&
    (user.role === "admin" || user.id === vehicle.responsibleUserId);

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

      docPdf.text(
        `Responsável: ${vehicle.responsibleUserName}   |   KM atual (aprox.): ${
          vehicle.currentKm ?? "-"
        } km`,
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
      alert("Não foi possível gerar o PDF. Tente novamente.");
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

      await updateDoc(doc(db, "vehicles", vehicle.id), {
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

  if (!user) return null;

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

  return (
    <div className="space-y-6">
      {/* Cabeçalho + PDF + Filtros */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <button
            onClick={() => router.push("/veiculos")}
            className="inline-flex items-center gap-1 text-xs text-gray-400 mb-1 hover:text-yellow-400"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar para lista de veículos
          </button>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <Car className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-yellow-400">
                Detalhes do veículo
              </h1>
              {vehicle && (
                <p className="text-sm text-gray-400">
                  {vehicle.plate} · {vehicle.model} · {vehicle.storeId}
                </p>
              )}
            </div>
          </div>

          {vehicle && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full border ${statusBadgeClass}`}
              >
                {statusText}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-400">
                <Info className="w-3 h-3" />
                Responsável:{" "}
                <span className="text-gray-100">
                  {vehicle.responsibleUserName}
                </span>
                {vehicle.currentKm != null && (
                  <>
                    <span className="mx-1 text-gray-500">•</span>
                    KM atual aprox.:{" "}
                    <span className="text-yellow-300">
                      {vehicle.currentKm} km
                    </span>
                  </>
                )}
              </span>
            </div>
          )}

          {filtrosAtivos && (
            <p className="mt-1 text-[11px] text-gray-400">
              {periodoTexto}{" "}
              {filtrosPadraoMes && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/40">
                  Mês atual
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          {/* Filtros de período */}
          <div className="flex flex-wrap gap-2 justify-end">
            <div className="flex flex-col">
              <span className="text-[11px] text-gray-400 mb-1">
                Data inicial
              </span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 bg-neutral-900 border-neutral-700 text-gray-100 text-xs"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-gray-400 mb-1">
                Data final
              </span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 bg-neutral-900 border-neutral-700 text-gray-100 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1 mt-4">
              <div className="flex gap-1 flex-wrap">
                <Button
                  type="button"
                  className="h-7 bg-yellow-500 hover:bg-yellow-400 text-black text-[11px] inline-flex items-center gap-1 px-3"
                  onClick={() => {
                    const { start, end } = getCurrentMonthRange();
                    setStartDate(start);
                    setEndDate(end);
                  }}
                >
                  <CalendarDays className="w-3 h-3" />
                  Mês atual
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 border-yellow-500/70 text-yellow-300 hover:bg-yellow-500/10 text-[11px] inline-flex items-center gap-1 px-3"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  <ListFilter className="w-3 h-3" />
                  Todos os registros
                </Button>
              </div>
            </div>
          </div>

          {/* Botão de PDF */}
          {vehicle && (
            <Button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="mt-1 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-xs flex items-center gap-2 w-full md:w-auto"
            >
              <FileDown className="w-4 h-4" />
              {generatingPdf ? "Gerando PDF..." : "Gerar relatório em PDF"}
            </Button>
          )}
        </div>
      </div>

      {errorMsg && !vehicle && (
        <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
      )}

      {loading || !vehicle ? (
        <p className="text-sm text-gray-400">Carregando dados...</p>
      ) : (
        <>
          {/* Cards principais - tudo já filtrado por período */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Status geral
                </p>
                <p className="text-lg font-bold text-yellow-400 capitalize">
                  {statusText}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Responsável:{" "}
                  <span className="text-gray-100">
                    {vehicle.responsibleUserName}
                  </span>
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Car className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Combustível (período)
                </p>
                <p className="text-lg font-bold text-yellow-400">
                  R$ {totalCombustivel.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {litrosAbastecidos.toFixed(2)} litros abastecidos
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Fuel className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Manutenções (período)
                </p>
                <p className="text-lg font-bold text-yellow-400">
                  R$ {totalManutencao.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {filteredMaintenances.length} registro(s)
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Wrench className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Rotas (período)
                </p>
                <p className="text-lg font-bold text-yellow-400">
                  {filteredRoutes.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {rotasEmAndamento.length} em andamento ·{" "}
                  {rotasFinalizadas.length} finalizadas
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Km rodado:{" "}
                  <span className="text-yellow-300">
                    {totalKmRodadoPeriodo.toFixed(1)} km
                  </span>
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Map className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>
          </div>

          {/* Observações gerais do veículo */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Info className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-100">
                    Observações gerais do veículo
                  </h2>
                  <p className="text-[11px] text-gray-400">
                    Texto único por veículo — aparece também no relatório em PDF.
                  </p>
                </div>
              </div>

              {canEditGeneralNotes && !editingGeneralNotes && (
                <Button
                  type="button"
                  className="h-7 bg-yellow-500 hover:bg-yellow-400 text-black text-[11px] px-3"
                  onClick={() => {
                    setGeneralNotesDraft(generalNotes ?? "");
                    setGeneralNotesMsg(null);
                    setEditingGeneralNotes(true);
                  }}
                >
                  {generalNotes ? "Editar observações" : "Adicionar observações"}
                </Button>
              )}
            </div>

            {generalNotesMsg && (
              <p
                className={`text-xs ${
                  generalNotesMsg.type === "success"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {generalNotesMsg.text}
              </p>
            )}

            {editingGeneralNotes && canEditGeneralNotes ? (
              <form onSubmit={handleSaveGeneralNotes} className="space-y-3">
                <textarea
                  value={generalNotesDraft}
                  onChange={(e) => setGeneralNotesDraft(e.target.value)}
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[90px]"
                  placeholder="Ex: Veículo principal das entregas de Cedral e região. Priorizar manutenção preventiva a cada 8.000 km..."
                />
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    type="submit"
                    disabled={savingGeneralNotes}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs"
                  >
                    {savingGeneralNotes ? "Salvando..." : "Salvar observações"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs"
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
              <div className="text-sm text-gray-100 whitespace-pre-wrap">
                {generalNotes && generalNotes.trim() ? (
                  generalNotes
                ) : (
                  <span className="text-gray-500 italic">
                    Nenhuma observação geral registrada para este veículo.
                  </span>
                )}
              </div>
            )}
          </Card>

          {/* Gráfico + manutenções (filtrados) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-yellow-500/10">
                    <Fuel className="w-4 h-4 text-yellow-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-100">
                    Histórico de abastecimentos (período)
                  </h2>
                </div>
              </div>

              {fuelChartData ? (
                <div className="h-64">
                  <Line
                    data={fuelChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        x: {
                          ticks: {
                            color: "#9CA3AF",
                            font: { size: 10 },
                          },
                          grid: { color: "rgba(75, 85, 99, 0.3)" },
                        },
                        y: {
                          ticks: {
                            color: "#9CA3AF",
                            font: { size: 10 },
                          },
                          grid: { color: "rgba(75, 85, 99, 0.3)" },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Nenhum abastecimento neste período para este veículo.
                </p>
              )}
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Wrench className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-100">
                  Manutenções no período
                </h2>
              </div>

              {filteredMaintenances.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhuma manutenção registrada neste período.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredMaintenances.slice(0, 10).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {m.type}
                        </p>
                        <p className="text-xs text-gray-400">
                          {m.date
                            ? new Date(m.date).toLocaleString("pt-BR")
                            : "-"}
                        </p>
                        {m.workshopName && (
                          <p className="text-xs text-gray-500 truncate">
                            {m.workshopName}
                          </p>
                        )}
                        {m.notes && (
                          <button
                            type="button"
                            onClick={() =>
                              setObsViewer({
                                title: `Observações da manutenção`,
                                subtitle: `${m.type} · ${
                                  m.date
                                    ? new Date(m.date).toLocaleString("pt-BR")
                                    : ""
                                }`,
                                note: m.notes!,
                              })
                            }
                            className="text-[11px] text-gray-400 italic truncate hover:text-yellow-300 hover:underline underline-offset-2"
                          >
                            Obs.: {truncate(m.notes, 80)} (ver tudo)
                          </button>
                        )}
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-semibold text-yellow-300">
                          R$ {Number(m.cost || 0).toFixed(2)}
                        </p>
                        <p className="text-gray-400 capitalize">
                          {m.status === "em_andamento"
                            ? "Em andamento"
                            : "Concluída"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Rotas do período */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Map className="w-4 h-4 text-yellow-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-100">
                Rotas deste veículo (período)
              </h2>
            </div>

            {filteredRoutes.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma rota registrado neste período para este veículo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-neutral-800 text-gray-400">
                      <th className="py-2 pr-2">Data</th>
                      <th className="py-2 px-2">Motorista</th>
                      <th className="py-2 px-2">Origem → Destino</th>
                      <th className="py-2 px-2">KM início</th>
                      <th className="py-2 px-2">KM fim</th>
                      <th className="py-2 px-2">KM total</th>
                      <th className="py-2 px-2 hidden lg:table-cell">Obs.</th>
                      <th className="py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoutes.slice(0, 30).map((r) => {
                      const kmTotal =
                        r.endKm != null ? r.endKm - r.startKm : null;

                      return (
                        <tr
                          key={r.id}
                          className="border-b border-neutral-900 hover:bg-neutral-800/60 text-gray-200"
                        >
                          <td className="py-2 pr-2 text-gray-300">
                            {r.startAt
                              ? new Date(r.startAt).toLocaleString("pt-BR")
                              : "-"}
                          </td>
                          <td className="py-2 px-2 text-gray-200">
                            {r.driverName}
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
                          <td className="py-2 px-2 text-gray-200">
                            {kmTotal != null
                              ? `${kmTotal.toFixed(1)} km`
                              : "-"}
                          </td>
                          <td className="py-2 px-2 text-gray-300 hidden lg:table-cell">
                            {r.notes ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setObsViewer({
                                    title: "Observações da rota",
                                    subtitle: `${
                                      r.startAt
                                        ? new Date(
                                            r.startAt
                                          ).toLocaleString("pt-BR")
                                        : ""
                                    } · ${r.driverName}`,
                                    note: r.notes!,
                                  })
                                }
                                className="text-[11px] text-gray-300 hover:text-yellow-300 hover:underline underline-offset-2 text-left w-full truncate"
                              >
                                {truncate(r.notes, 60)} (ver tudo)
                              </button>
                            ) : (
                              "—"
                            )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal para visualizar observação completa (rotas/manutenções) */}
      {obsViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3">
          <div className="w-full max-w-lg rounded-lg bg-neutral-950 border border-neutral-700 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-yellow-300">
                  {obsViewer.title}
                </h3>
                {obsViewer.subtitle && (
                  <p className="text-[11px] text-gray-400">
                    {obsViewer.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setObsViewer(null)}
                className="p-1 rounded-full hover:bg-neutral-800 text-gray-400 hover:text-yellow-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-100 whitespace-pre-wrap">
                {obsViewer.note}
              </p>
            </div>
            <div className="flex justify-end px-4 py-3 border-t border-neutral-800">
              <Button
                type="button"
                className="bg-neutral-800 hover:bg-neutral-700 text-xs text-gray-100"
                onClick={() => setObsViewer(null)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}