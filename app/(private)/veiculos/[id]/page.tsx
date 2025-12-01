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
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Car, Fuel, Wrench, Map, ArrowLeft } from "lucide-react";

// Chart.js
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
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
}

interface Fueling {
  id: string;
  date: string;
  liters: number;
  total: number;
  pricePerL: number;
  stationName?: string | null;
}

interface Maintenance {
  id: string;
  date: string;
  type: string;
  cost: number;
  workshopName?: string | null;
  status: "em_andamento" | "concluida";
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

      // 1) Carrega o veículo (crítico)
      try {
        const vehicleRef = doc(db, "vehicles", params.id);
        const vehicleSnap = await getDoc(vehicleRef);

        if (!vehicleSnap.exists()) {
          setErrorMsg("Veículo não encontrado.");
          setLoading(false);
          return;
        }

        const vData = vehicleSnap.data() as any;
        const vehicleObj: Vehicle = {
          id: vehicleSnap.id,
          plate: vData.plate,
          model: vData.model,
          storeId: vData.storeId,
          status: vData.status ?? "disponivel",
          currentKm: vData.currentKm,
          responsibleUserId: vData.responsibleUserId,
          responsibleUserName: vData.responsibleUserName,
        };

        // segurança: user comum só vê se for responsável
        if (user.role !== "admin" && vehicleObj.responsibleUserId !== user.id) {
          setErrorMsg("Você não tem acesso a este veículo.");
          setLoading(false);
          return;
        }

        setVehicle(vehicleObj);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar veículo:", error);
        setErrorMsg("Erro ao carregar dados do veículo.");
        setLoading(false);
        return;
      }

      // 2) Carrega abastecimentos
      try {
        const fuelSnap = await getDocs(
          query(
            collection(db, "fuelings"),
            where("vehicleId", "==", params.id)
          )
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
          };
        });

        // ordena por data desc
        fList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        setFuelings(fList);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar abastecimentos:", error);
      }

      // 3) Carrega manutenções
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
            workshopName: data.workshopName ?? null,
            status: data.status ?? "em_andamento",
          };
        });

        // ordena por data desc
        mList.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        setMaintenances(mList);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar manutenções:", error);
      }

      // 4) Carrega rotas
      try {
        const routesSnap = await getDocs(
          query(
            collection(db, "routes"),
            where("vehicleId", "==", params.id)
          )
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
          };
        });

        // ordena por startAt desc
        rList.sort((a, b) => (b.startAt || "").localeCompare(a.startAt || ""));

        setRoutes(rList);
      } catch (error) {
        console.error("[VEÍCULO] Erro ao carregar rotas:", error);
      }

      setLoading(false);
    }

    loadData();
  }, [user, params?.id]);

  // ===== Métricas =====
  const totalCombustivel = useMemo(
    () => fuelings.reduce((acc, f) => acc + Number(f.total || 0), 0),
    [fuelings]
  );

  const litrosAbastecidos = useMemo(
    () => fuelings.reduce((acc, f) => acc + Number(f.liters || 0), 0),
    [fuelings]
  );

  const totalManutencao = useMemo(
    () => maintenances.reduce((acc, m) => acc + Number(m.cost || 0), 0),
    [maintenances]
  );

  const rotasFinalizadas = routes.filter((r) => r.status === "finalizada");
  const rotasEmAndamento = routes.filter((r) => r.status === "em_andamento");

  const consumoMedioEstimado = useMemo(() => {
    if (!litrosAbastecidos || !vehicle?.currentKm) return null;
    // placeholder por enquanto
    return null;
  }, [litrosAbastecidos, vehicle?.currentKm]);

  const fuelChartData = useMemo(() => {
    if (fuelings.length === 0) return null;

    const sorted = [...fuelings].sort((a, b) =>
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
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    };
  }, [fuelings]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/veiculos")}
            className="inline-flex items-center gap-1 text-xs text-gray-400 mb-1 hover:text-yellow-400"
          >
            <ArrowLeft className="w-3 h-3" />
            Voltar para lista de veículos
          </button>
          <h1 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
            <Car className="w-6 h-6" />
            Detalhes do veículo
          </h1>
          {vehicle && (
            <p className="text-sm text-gray-400">
              {vehicle.plate} · {vehicle.model} · {vehicle.storeId}
            </p>
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
          {/* Cards principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Status
                </p>
                <p className="text-lg font-bold text-yellow-400 capitalize">
                  {vehicle.status === "disponivel"
                    ? "Disponível"
                    : vehicle.status === "em_rota"
                    ? "Em rota"
                    : "Em manutenção"}
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
                  Combustível
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
                  Manutenções
                </p>
                <p className="text-lg font-bold text-yellow-400">
                  R$ {totalManutencao.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {maintenances.length} registro(s)
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Wrench className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Rotas
                </p>
                <p className="text-lg font-bold text-yellow-400">
                  {routes.length}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {rotasEmAndamento.length} em andamento ·{" "}
                  {rotasFinalizadas.length} finalizadas
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-yellow-500/10">
                <Map className="w-6 h-6 text-yellow-400" />
              </div>
            </Card>
          </div>

          {/* Gráfico + manutenções */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-full bg-yellow-500/10">
                    <Fuel className="w-4 h-4 text-yellow-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-100">
                    Histórico de abastecimentos
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
                        },
                        y: {
                          ticks: {
                            color: "#9CA3AF",
                            font: { size: 10 },
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Nenhum abastecimento registrado para este veículo ainda.
                </p>
              )}
            </Card>

            <Card className="p-4 bg-neutral-950 border border-neutral-800">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Wrench className="w-4 h-4 text-yellow-400" />
                </div>
                <h2 className="text-sm font-semibold text-gray-100">
                  Últimas manutenções
                </h2>
              </div>

              {maintenances.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhuma manutenção registrado para este veículo ainda.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {maintenances.slice(0, 10).map((m) => (
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

          {/* Rotas recentes */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Map className="w-4 h-4 text-yellow-400" />
              </div>
              <h2 className="text-sm font-semibold text-gray-100">
                Rotas deste veículo
              </h2>
            </div>

            {routes.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma rota registrada para este veículo ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b border-neutral-800 text-gray-400">
                      <th className="py-2 pr-2 text-gray-400">Data início</th>
                      <th className="py-2 px-2 text-gray-400">Motorista</th>
                      <th className="py-2 px-2 text-gray-400">
                        Origem → Destino
                      </th>
                      <th className="py-2 px-2 text-gray-400">KM inicial</th>
                      <th className="py-2 px-2 text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.slice(0, 15).map((r) => (
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
        </>
      )}
    </div>
  );
}