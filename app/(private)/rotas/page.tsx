"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Route as RouteIcon,
  Activity,
  MapPin,
  Clock,
  Filter,
  Search,
  PieChart as PieIcon,
  Info,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type RouteStatus = "em_andamento" | "finalizada" | "cancelada";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  currentKm?: number;
  status?: "disponivel" | "em_rota" | "manutencao";
  responsibleUserId: string;
}

interface Driver {
  id: string;
  name: string;
  storeId: string;
  responsibleUserId: string;
}

interface RouteItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  storeId?: string | null;
  driverId: string;
  driverName: string;
  origem?: string | null;
  destino?: string | null;
  startKm: number;
  endKm?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  distanceKm?: number | null;
  status: RouteStatus;
  responsibleUserId: string;
  responsibleUserName?: string | null;
  observacoes?: string | null;

  createdAt?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  finishedAt?: string | null;
  finishedById?: string | null;
  finishedByName?: string | null;
  canceledAt?: string | null;
  canceledById?: string | null;
  canceledByName?: string | null;
  cancelReason?: string | null;
}

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0];
  const color = item.color || item.fill || "#facc15";

  const value = item.value || 0;
  const total = item.payload?.total || 0;
  const percent = total ? ((value / total) * 100).toFixed(1) : null;

  return (
    <div
      style={{
        backgroundColor: "#020617",
        borderRadius: 8,
        padding: "6px 10px",
        border: `1px solid ${color}`,
        fontSize: 11,
      }}
    >
      <p style={{ margin: 0, color }}>{item.name}</p>
      <p style={{ margin: 0, color: "#e5e7eb" }}>
        {value} veículo(s)
        {percent && ` · ${percent}%`}
      </p>
    </div>
  );
};

function getMonthKeyFromIso(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function RotasPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // form nova rota
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [startKmInput, setStartKmInput] = useState("");

  // finalizar rota
  const [finishingRoute, setFinishingRoute] = useState<RouteItem | null>(null);
  const [endKmInput, setEndKmInput] = useState("");
  const [endDestinoInput, setEndDestinoInput] = useState("");
  const [obsInput, setObsInput] = useState("");

  // cancelar rota
  const [cancelingRoute, setCancelingRoute] = useState<RouteItem | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState("");

  // histórico / filtros
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "todas" | "finalizada" | "cancelada"
  >("todas");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStoreFilter, setHistoryStoreFilter] = useState("todas");
  const [historyDriverFilter, setHistoryDriverFilter] = useState("todos");
  const [historyMonth, setHistoryMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
  });

  // NOVO: filtro para ver só rotas que eu lancei
  const [showOnlyMyRoutes, setShowOnlyMyRoutes] = useState(false);

  // edição/visualização de obs
  const [editingObsRouteId, setEditingObsRouteId] = useState<string | null>(
    null
  );
  const [obsDraft, setObsDraft] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        setLoading(true);
        setErrorMsg("");

        // veículos
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
            currentKm: data.currentKm,
            status: data.status,
            responsibleUserId: data.responsibleUserId,
          };
        });
        setVehicles(vList);

        // motoristas
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

        // rotas
        let routesSnap;
        if (isAdmin) {
          routesSnap = await getDocs(
            query(collection(db, "routes"), orderBy("startAt", "desc"))
          );
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
            storeId: data.storeId ?? data.vehicleStoreId ?? null,
            driverId: data.driverId,
            driverName: data.driverName,
            origem: data.origem ?? null,
            destino: data.destino ?? null,
            startKm: data.startKm,
            endKm: data.endKm ?? null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            distanceKm: data.distanceKm ?? null,
            status: (data.status ?? "em_andamento") as RouteStatus,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName ?? null,
            observacoes: data.observacoes ?? null,
            createdAt: data.createdAt ?? data.startAt ?? null,
            createdById: data.createdById ?? data.responsibleUserId ?? null,
            createdByName:
              data.createdByName ?? data.responsibleUserName ?? null,
            finishedAt: data.finishedAt ?? data.endAt ?? null,
            finishedById: data.finishedById ?? null,
            finishedByName: data.finishedByName ?? null,
            canceledAt: data.canceledAt ?? null,
            canceledById: data.canceledById ?? null,
            canceledByName: data.canceledByName ?? null,
            cancelReason: data.cancelReason ?? null,
          };
        });

        const sorted = rList.sort((a, b) =>
          (b.startAt || "").localeCompare(a.startAt || "")
        );

        setRoutes(sorted);
      } catch (error) {
        console.error("Erro ao carregar rotas:", error);
        setErrorMsg("Erro ao carregar dados de rotas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, isAdmin]);

  function resetForm() {
    setSelectedVehicleId("");
    setSelectedDriverId("");
    setOrigem("");
    setDestino("");
    setStartKmInput("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  useEffect(() => {
    if (!selectedVehicleId) return;
    const v = vehicles.find((v) => v.id === selectedVehicleId);
    if (v && v.currentKm != null) {
      setStartKmInput(String(v.currentKm));
    }
  }, [selectedVehicleId, vehicles]);

  const rotasEmAndamento = useMemo(
    () => routes.filter((r) => r.status === "em_andamento"),
    [routes]
  );
  const rotasFinalizadas = useMemo(
    () => routes.filter((r) => r.status === "finalizada"),
    [routes]
  );
  const rotasCanceladas = useMemo(
    () => routes.filter((r) => r.status === "cancelada"),
    [routes]
  );

  const totalRotas = routes.length;

  const totalKmRodado = useMemo(() => {
    return routes.reduce((acc, r) => {
      if (r.status === "cancelada") return acc;
      if (r.distanceKm != null) return acc + r.distanceKm;
      if (r.endKm != null) return acc + (r.endKm - r.startKm);
      return acc;
    }, 0);
  }, [routes]);

  const uniqueVehiclesCount = useMemo(() => {
    const setIds = new Set(
      routes.map((r) => r.vehicleId || `plate:${r.vehiclePlate}`)
    );
    return setIds.size;
  }, [routes]);

  const vehicleStatusData = useMemo(() => {
    if (!vehicles.length) return [];
    let disponivel = 0;
    let emRota = 0;
    let manutencao = 0;

    vehicles.forEach((v) => {
      if (v.status === "disponivel" || !v.status) disponivel += 1;
      else if (v.status === "em_rota") emRota += 1;
      else if (v.status === "manutencao") manutencao += 1;
    });

    const total = disponivel + emRota + manutencao;

    const data = [
      { name: "Disponíveis", value: disponivel, total },
      { name: "Em rota", value: emRota, total },
      { name: "Em manutenção", value: manutencao, total },
    ];

    return data.filter((d) => d.value > 0);
  }, [vehicles]);

  const vehicleStatusColors = ["#22c55e", "#eab308", "#ef4444"];

  const historyRoutes = useMemo(
    () => routes.filter((r) => r.status !== "em_andamento"),
    [routes]
  );

  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    historyRoutes.forEach((r) => {
      if (r.storeId) set.add(r.storeId);
    });
    return Array.from(set).sort();
  }, [historyRoutes]);

  const driverOptions = useMemo(() => {
    const map = new Map<string, string>();
    historyRoutes.forEach((r) => {
      if (r.driverId) map.set(r.driverId, r.driverName);
    });
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [historyRoutes]);

  if (!user) return null;

  const isOwner = (route: RouteItem) => route.responsibleUserId === user.id;

  const filteredHistoryRoutes = useMemo(() => {
    return historyRoutes
      .filter((r) => {
        // NOVO: se marcado, mostra só rotas que eu lancei
        if (showOnlyMyRoutes && r.responsibleUserId !== user.id) {
          return false;
        }

        if (
          historyStatusFilter !== "todas" &&
          r.status !== historyStatusFilter
        ) {
          return false;
        }

        if (historyMonth) {
          const refDate = r.endAt || r.startAt || null;
          const key = getMonthKeyFromIso(refDate);
          if (key !== historyMonth) return false;
        }

        if (
          historyStoreFilter !== "todas" &&
          (r.storeId || "") !== historyStoreFilter
        ) {
          return false;
        }

        if (
          historyDriverFilter !== "todos" &&
          r.driverId !== historyDriverFilter
        ) {
          return false;
        }

        if (historySearch.trim()) {
          const term = historySearch.toLowerCase();
          const composed =
            [
              r.vehiclePlate,
              r.vehicleModel,
              r.driverName,
              r.origem || "",
              r.destino || "",
              r.storeId || "",
              r.observacoes || "",
            ]
              .join(" ")
              .toLowerCase() || "";

          if (!composed.includes(term)) return false;
        }

        return true;
      })
      .sort((a, b) => (b.startAt || "").localeCompare(a.startAt || ""));
  }, [
    historyRoutes,
    historyStatusFilter,
    historyMonth,
    historyStoreFilter,
    historyDriverFilter,
    historySearch,
    showOnlyMyRoutes,
    user.id,
  ]);

  const availableVehiclesForRoute = useMemo(
    () =>
      vehicles.filter(
        (v) => v.status !== "em_rota" && v.status !== "manutencao"
      ),
    [vehicles]
  );

  async function handleCriarRota(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!selectedVehicleId || !selectedDriverId) {
        setErrorMsg("Selecione veículo e motorista.");
        return;
      }

      const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
      if (!vehicle) {
        setErrorMsg("Veículo inválido.");
        return;
      }

      if (vehicle.status === "em_rota" || vehicle.status === "manutencao") {
        setErrorMsg(
          "Este veículo está em rota ou manutenção. Escolha outro veículo."
        );
        return;
      }

      const driver = drivers.find((d) => d.id === selectedDriverId);
      if (!driver) {
        setErrorMsg("Motorista inválido.");
        return;
      }

      const startKmNumber = startKmInput.trim()
        ? Number(startKmInput.replace(",", "."))
        : vehicle.currentKm ?? 0;

      const nowIso = new Date().toISOString();

      const newRouteData = {
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        vehicleModel: vehicle.model,
        storeId: vehicle.storeId,
        driverId: driver.id,
        driverName: driver.name,
        origem: origem || null,
        destino: destino || null,
        startKm: startKmNumber,
        startAt: nowIso,
        status: "em_andamento" as RouteStatus,
        responsibleUserId: user.id,
        responsibleUserName: user.name,
        endKm: null as number | null,
        endAt: null as string | null,
        distanceKm: null as number | null,
        observacoes: null as string | null,
        createdAt: nowIso,
        createdById: user.id,
        createdByName: user.name,
      };

      const docRef = await addDoc(collection(db, "routes"), newRouteData);

      await updateDoc(doc(db, "vehicles", vehicle.id), {
        status: "em_rota",
        currentKm: startKmNumber,
      });

      const routeForState: RouteItem = {
        id: docRef.id,
        ...newRouteData,
      };

      setRoutes((prev) => [routeForState, ...prev]);

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id
            ? { ...v, status: "em_rota", currentKm: startKmNumber }
            : v
        )
      );

      setSuccessMsg("Rota iniciada com sucesso!");
      resetForm();
      setFormOpen(false);
    } catch (error) {
      console.error("Erro ao iniciar rota:", error);
      setErrorMsg("Erro ao iniciar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function abrirFinalizarRota(route: RouteItem) {
    setFinishingRoute(route);
    setCancelingRoute(null);
    setEndKmInput(route.endKm != null ? String(route.endKm) : "");
    setEndDestinoInput(route.destino ?? "");
    setObsInput(route.observacoes ?? "");
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleFinalizarRota(e: React.FormEvent) {
    e.preventDefault();
    if (!finishingRoute || !user) return;

    if (!isOwner(finishingRoute)) {
      setErrorMsg("Apenas quem iniciou a rota pode finalizá-la.");
      return;
    }

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!endKmInput.trim()) {
        setErrorMsg("Informe o KM final.");
        return;
      }

      const endKmNumber = Number(endKmInput.replace(",", "."));
      if (Number.isNaN(endKmNumber)) {
        setErrorMsg("KM final inválido.");
        return;
      }

      if (endKmNumber < finishingRoute.startKm) {
        setErrorMsg("KM final não pode ser menor que o KM inicial.");
        return;
      }

      const distance = endKmNumber - finishingRoute.startKm;
      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, "routes", finishingRoute.id), {
        endKm: endKmNumber,
        endAt: nowIso,
        distanceKm: distance,
        status: "finalizada",
        destino: endDestinoInput || null,
        observacoes: obsInput || null,
        finishedAt: nowIso,
        finishedById: user.id,
        finishedByName: user.name,
      });

      if (finishingRoute.vehicleId) {
        await updateDoc(doc(db, "vehicles", finishingRoute.vehicleId), {
          currentKm: endKmNumber,
          status: "disponivel",
        });

        setVehicles((prev) =>
          prev.map((v) =>
            v.id === finishingRoute.vehicleId
              ? { ...v, currentKm: endKmNumber, status: "disponivel" }
              : v
          )
        );
      }

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === finishingRoute.id
            ? {
                ...r,
                endKm: endKmNumber,
                endAt: nowIso,
                distanceKm: distance,
                status: "finalizada",
                destino: endDestinoInput || null,
                observacoes: obsInput || null,
                finishedAt: nowIso,
                finishedById: user.id,
                finishedByName: user.name,
              }
            : r
        )
      );

      setSuccessMsg("Rota finalizada com sucesso!");
      setFinishingRoute(null);
      setEndKmInput("");
      setEndDestinoInput("");
      setObsInput("");
    } catch (error) {
      console.error("Erro ao finalizar rota:", error);
      setErrorMsg("Erro ao finalizar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function abrirCancelarRota(route: RouteItem) {
    setCancelingRoute(route);
    setFinishingRoute(null);
    setCancelReasonInput("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleConfirmarCancelamento(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelingRoute || !user) return;

    if (!isOwner(cancelingRoute)) {
      setErrorMsg("Apenas quem iniciou a rota pode cancelá-la.");
      return;
    }

    const confirm = window.confirm(
      `Tem certeza que deseja cancelar a rota do veículo ${cancelingRoute.vehiclePlate}?`
    );
    if (!confirm) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, "routes", cancelingRoute.id), {
        status: "cancelada" as RouteStatus,
        canceledAt: nowIso,
        canceledById: user.id,
        canceledByName: user.name,
        cancelReason: cancelReasonInput || null,
      });

      if (cancelingRoute.vehicleId) {
        await updateDoc(doc(db, "vehicles", cancelingRoute.vehicleId), {
          status: "disponivel",
          currentKm: cancelingRoute.startKm,
        });

        setVehicles((prev) =>
          prev.map((v) =>
            v.id === cancelingRoute.vehicleId
              ? { ...v, status: "disponivel", currentKm: cancelingRoute.startKm }
              : v
          )
        );
      }

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === cancelingRoute.id
            ? {
                ...r,
                status: "cancelada",
                canceledAt: nowIso,
                canceledById: user.id,
                canceledByName: user.name,
                cancelReason: cancelReasonInput || null,
              }
            : r
        )
      );

      setSuccessMsg("Rota cancelada com sucesso!");
      setCancelingRoute(null);
      setCancelReasonInput("");
    } catch (error) {
      console.error("Erro ao cancelar rota:", error);
      setErrorMsg("Erro ao cancelar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluirRota(route: RouteItem) {
    if (!isAdmin) return;
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir a rota do veículo ${route.vehiclePlate}?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "routes", route.id));
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));

      if (route.status === "em_andamento" && route.vehicleId) {
        await updateDoc(doc(db, "vehicles", route.vehicleId), {
          status: "disponivel",
        });
        setVehicles((prev) =>
          prev.map((v) =>
            v.id === route.vehicleId ? { ...v, status: "disponivel" } : v
          )
        );
      }
    } catch (error) {
      console.error("Erro ao excluir rota:", error);
      setErrorMsg("Erro ao excluir rota. Tente novamente.");
    }
  }

  function abrirObsRoute(route: RouteItem) {
    setEditingObsRouteId(route.id);
    setObsDraft(route.observacoes ?? "");
    setErrorMsg("");
    setSuccessMsg("");
  }

  function fecharObsRoute() {
    setEditingObsRouteId(null);
    setObsDraft("");
  }

  async function handleSalvarObs(e: React.FormEvent) {
    e.preventDefault();
    if (!editingObsRouteId || !user) return;

    const route = routes.find((r) => r.id === editingObsRouteId);
    if (!route) return;

    if (isAdmin && !isOwner(route)) {
      fecharObsRoute();
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, "routes", route.id), {
        observacoes: obsDraft || null,
        updatedObsAt: nowIso,
        updatedObsById: user.id,
        updatedObsByName: user.name,
      });

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === route.id ? { ...r, observacoes: obsDraft || null } : r
        )
      );

      setSuccessMsg("Observações atualizadas com sucesso!");
      fecharObsRoute();
    } catch (error) {
      console.error("Erro ao salvar observações:", error);
      setErrorMsg("Erro ao salvar observações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RouteIcon className="w-5 h-5 text-yellow-400" />
            <h1 className="text-2xl font-bold text-yellow-400">
              Rotas da Frota
            </h1>
          </div>
          <p className="text-sm text-gray-400 max-w-xl">
            Inicie, acompanhe e finalize rotas dos veículos. Tudo aqui alimenta
            os relatórios e o fechamento mensal da frota.
          </p>
        </div>

        <Button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm"
          onClick={() => {
            resetForm();
            setFinishingRoute(null);
            setCancelingRoute(null);
            setFormOpen(true);
          }}
        >
          + Nova rota
        </Button>
      </div>

      {/* Resumo + Formulário */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)] gap-4">
        {/* Resumo em cards */}
        <div className="space-y-4">
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Total de rotas
                </p>
                <p className="text-2xl font-bold text-yellow-400">
                  {totalRotas}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Em andamento
                </p>
                <p className="text-2xl font-bold text-sky-400">
                  {rotasEmAndamento.length}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Finalizadas
                </p>
                <p className="text-2xl font-bold text-green-400">
                  {rotasFinalizadas.length}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Canceladas
                </p>
                <p className="text-2xl font-bold text-red-400">
                  {rotasCanceladas.length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  KM rodado (somado)
                </p>
                <p className="text-2xl font-bold text-yellow-300">
                  {totalKmRodado.toFixed(1)} km
                </p>
              </div>
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Veículos que rodaram
                </p>
                <p className="text-2xl font-bold text-gray-100">
                  {uniqueVehiclesCount}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Formulário de nova rota no topo direito */}
        <div className="space-y-4">
          {formOpen && !finishingRoute && !cancelingRoute && (
            <Card className="p-4 bg-neutral-900 border border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-yellow-400">
                  Nova rota
                </h2>
                <span className="text-[11px] text-gray-500">
                  Preencha os dados e inicie a rota
                </span>
              </div>

              <form onSubmit={handleCriarRota} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Veículo
                    </label>
                    <select
                      className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                    >
                      <option value="">
                        Selecione um veículo disponível...
                      </option>
                      {availableVehiclesForRoute.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.model} ({v.storeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Motorista
                    </label>
                    <select
                      className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                    >
                      <option value="">Selecione um motorista...</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.storeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <Input
                    placeholder="Origem (opcional)"
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value)}
                    className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                  />

                  <Input
                    placeholder="Destino (opcional)"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                  />

                  <Input
                    placeholder="KM inicial (deixe em branco para usar o KM atual do veículo)"
                    value={startKmInput}
                    onChange={(e) => setStartKmInput(e.target.value)}
                    className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500 md:col-span-2"
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium">
                    {errorMsg}
                  </p>
                )}
                {successMsg && (
                  <p className="text-sm text-green-400 font-medium">
                    {successMsg}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm"
                  >
                    {saving ? "Salvando..." : "Iniciar rota"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-red-600 hover:bg-red-500 text-white text-xs"
                    onClick={() => {
                      setFormOpen(false);
                      resetForm();
                    }}
                  >
                    Fechar formulário
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>

      {/* Rotas em andamento + Gráfico de status + Finalizar/Cancelar */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)] gap-4">
        {/* Esquerda: rotas em andamento */}
        <div className="space-y-4">
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <Activity className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-sm font-semibold text-gray-100">
                  Rotas em andamento
                </p>
              </div>
              <span className="text-[11px] text-gray-500">
                {rotasEmAndamento.length} rota(s)
              </span>
            </div>

            {rotasEmAndamento.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhuma rota em andamento no momento.
              </p>
            ) : (
              <div className="space-y-2">
                {rotasEmAndamento.map((r) => {
                  const owner = isOwner(r);

                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          <span className="font-mono">{r.vehiclePlate}</span> ·{" "}
                          {r.vehicleModel}
                          {r.storeId && (
                            <span className="ml-1 text-[11px] text-gray-500">
                              ({r.storeId})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          Motorista:{" "}
                          <span className="text-gray-200">
                            {r.driverName || "-"}
                          </span>
                        </p>

                        {owner && (
                          <p className="text-[11px] text-yellow-300 mt-0.5">
                            Minha rota
                          </p>
                        )}

                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-yellow-400 shrink-0" />
                          {(r.origem || "-") + " → " + (r.destino || "-")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
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
                        <p className="text-[11px] text-gray-400">
                          KM inicial:{" "}
                          <span className="font-mono text-gray-100">
                            {r.startKm} km
                          </span>
                        </p>
                        <div className="flex gap-2">
                          {owner && (
                            <>
                              <Button
                                size="sm"
                                className="bg-green-500 hover:bg-green-400 text-black text-[11px] h-7 px-3"
                                onClick={() => abrirFinalizarRota(r)}
                              >
                                Finalizar
                              </Button>
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-500 text-white text-[11px] h-7 px-3"
                                onClick={() => abrirCancelarRota(r)}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Direita: gráfico + finalizar/cancelar */}
        <div className="space-y-4">
          {/* Gráfico de status dos veículos */}
          <Card className="p-4 bg-neutral-950 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <PieIcon className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-sm font-semibold text-gray-100">
                  Status dos veículos
                </p>
              </div>
              <span className="text-[11px] text-gray-500">
                {vehicles.length} veículo(s) cadastrados
              </span>
            </div>
            {vehicleStatusData.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nenhum veículo cadastrado ou sem status definido.
              </p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vehicleStatusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {vehicleStatusData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            vehicleStatusColors[
                              index % vehicleStatusColors.length
                            ]
                          }
                        />
                      ))}
                    </Pie>
                    <ReTooltip content={<CustomPieTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value: any) => (
                        <span className="text-xs text-gray-300">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Finalizar rota */}
          {finishingRoute && (
            <Card className="p-4 bg-neutral-900 border border-green-500/60">
              <h2 className="text-lg font-semibold text-green-400 mb-2">
                Finalizar rota · {finishingRoute.vehiclePlate} ·{" "}
                {finishingRoute.vehicleModel}
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Motorista:{" "}
                <span className="text-gray-200">
                  {finishingRoute.driverName}
                </span>{" "}
                · KM inicial:{" "}
                <span className="font-mono text-gray-100">
                  {finishingRoute.startKm} km
                </span>
              </p>

              <form onSubmit={handleFinalizarRota} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="KM final"
                    value={endKmInput}
                    onChange={(e) => setEndKmInput(e.target.value)}
                    className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                  />
                  <Input
                    placeholder="Destino (pode ajustar aqui)"
                    value={endDestinoInput}
                    onChange={(e) => setEndDestinoInput(e.target.value)}
                    className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Observações da rota (opcional)
                  </label>
                  <textarea
                    placeholder="Ex: Entrega concluída sem ocorrências, veículo retornou direto para a loja..."
                    value={obsInput}
                    onChange={(e) => setObsInput(e.target.value)}
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[80px]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium">
                    {errorMsg}
                  </p>
                )}
                {successMsg && (
                  <p className="text-sm text-green-400 font-medium">
                    {successMsg}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm"
                  >
                    {saving ? "Finalizando..." : "Confirmar finalização"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-red-600 hover:bg-red-500 text-white text-xs"
                    onClick={() => {
                      setFinishingRoute(null);
                      setEndKmInput("");
                      setEndDestinoInput("");
                      setObsInput("");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Cancelar rota */}
          {cancelingRoute && (
            <Card className="p-4 bg-neutral-900 border border-red-600/70">
              <h2 className="text-lg font-semibold text-red-400 mb-2">
                Cancelar rota · {cancelingRoute.vehiclePlate} ·{" "}
                {cancelingRoute.vehicleModel}
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Motorista:{" "}
                <span className="text-gray-200">
                  {cancelingRoute.driverName}
                </span>{" "}
                · KM inicial:{" "}
                <span className="font-mono text-gray-100">
                  {cancelingRoute.startKm} km
                </span>
              </p>

              <form onSubmit={handleConfirmarCancelamento} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Motivo do cancelamento (opcional, mas recomendado)
                  </label>
                  <textarea
                    placeholder="Ex: rota lançada no veículo errado, cliente cancelou a entrega..."
                    value={cancelReasonInput}
                    onChange={(e) => setCancelReasonInput(e.target.value)}
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[80px]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium">
                    {errorMsg}
                  </p>
                )}
                {successMsg && (
                  <p className="text-sm text-green-400 font-medium">
                    {successMsg}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-red-600 hover:bg-red-500 text-white font-semibold text-sm"
                  >
                    {saving ? "Cancelando..." : "Confirmar cancelamento"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs"
                    onClick={() => {
                      setCancelingRoute(null);
                      setCancelReasonInput("");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                  >
                    Voltar
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>

      {/* Histórico de rotas */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 max-w-md">
            <label className="block text-xs text-gray-400 mb-1">
              Buscar por veículo, motorista, origem, destino, loja ou
              observações
            </label>
            <div className="relative">
              <Input
                placeholder="Ex: ABC1D23, João, Cedral, Destack..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-neutral-900 border-neutral-700 text-gray-100 placeholder:text-gray-500 pr-9 text-sm"
              />
              <Search className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Mês de referência
              </label>
              <Input
                type="month"
                value={historyMonth}
                onChange={(e) => setHistoryMonth(e.target.value)}
                className="bg-neutral-900 border-neutral-700 text-gray-100 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Status
              </label>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500 hidden md:block" />
                <select
                  className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-gray-100"
                  value={historyStatusFilter}
                  onChange={(e) =>
                    setHistoryStatusFilter(
                      e.target.value as "todas" | "finalizada" | "cancelada"
                    )
                  }
                >
                  <option value="todas">Todas</option>
                  <option value="finalizada">Finalizadas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Loja
              </label>
              <select
                className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-gray-100"
                value={historyStoreFilter}
                onChange={(e) => setHistoryStoreFilter(e.target.value)}
              >
                <option value="todas">Todas</option>
                {storeOptions.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Motorista
              </label>
              <select
                className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs text-gray-100"
                value={historyDriverFilter}
                onChange={(e) => setHistoryDriverFilter(e.target.value)}
              >
                <option value="todos">Todos</option>
                {driverOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* NOVO: filtro Minhas rotas */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Responsável
              </label>
              <button
                type="button"
                onClick={() => setShowOnlyMyRoutes((prev) => !prev)}
                className={`rounded-md px-3 py-2 text-xs border ${
                  showOnlyMyRoutes
                    ? "bg-yellow-500 text-black border-yellow-400"
                    : "bg-neutral-900 text-gray-100 border-neutral-700"
                }`}
              >
                {showOnlyMyRoutes ? "Mostrando só minhas rotas" : "Ver todas as rotas"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-2">
          <h2 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-2">
            Histórico de rotas
            <span className="text-[11px] text-gray-500">
              ({filteredHistoryRoutes.length} registro(s) no período filtrado)
            </span>
          </h2>

          {loading ? (
            <p className="text-sm text-gray-400">Carregando rotas...</p>
          ) : filteredHistoryRoutes.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nenhuma rota encontrada com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b border-neutral-800 text-gray-400">
                    <th className="py-2 pr-2">Data</th>
                    <th className="py-2 px-2">Veículo</th>
                    <th className="py-2 px-2 hidden md:table-cell">
                      Motorista
                    </th>
                    <th className="py-2 px-2">Origem → Destino</th>
                    <th className="py-2 px-2 hidden lg:table-cell">
                      KM (início / fim)
                    </th>
                    <th className="py-2 px-2 hidden xl:table-cell">
                      Distância
                    </th>
                    <th className="py-2 px-2 hidden xl:table-cell">
                      Observações
                    </th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pl-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryRoutes.map((r) => {
                    const distancia =
                      r.status === "cancelada"
                        ? null
                        : r.distanceKm != null
                        ? r.distanceKm
                        : r.endKm != null
                        ? r.endKm - r.startKm
                        : null;

                    const isObsEditing = editingObsRouteId === r.id;
                    const userIsOwner = isOwner(r);

                    const obsResumo = (r.observacoes || "").trim();
                    const obsTexto =
                      obsResumo.length > 80
                        ? obsResumo.slice(0, 80) + "..."
                        : obsResumo;

                    return (
                      <Fragment key={r.id}>
                        <tr className="border-b border-neutral-900 hover:bg-neutral-800/60">
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
                            <span className="font-mono">
                              {r.vehiclePlate}
                            </span>{" "}
                            · {r.vehicleModel}
                            {r.storeId && (
                              <span className="ml-1 text-[11px] text-gray-500">
                                ({r.storeId})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-gray-200 hidden md:table-cell">
                            {r.driverName}
                          </td>
                          <td className="py-2 px-2 text-gray-300">
                            {(r.origem || "-") + " → " + (r.destino || "-")}
                            {r.status === "cancelada" && r.cancelReason && (
                              <div className="text-[11px] text-red-300 flex items-center gap-1 mt-0.5">
                                <Info className="w-3 h-3" />
                                Motivo: {r.cancelReason}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-gray-200 hidden lg:table-cell">
                            <span className="font-mono">
                              {r.startKm} km
                              {r.endKm != null ? ` / ${r.endKm} km` : ""}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-gray-200 hidden xl:table-cell">
                            {distancia != null
                              ? `${distancia.toFixed(1)} km`
                              : r.status === "cancelada"
                              ? "-"
                              : "-"}
                          </td>
                          <td className="py-2 px-2 text-gray-300 hidden xl:table-cell">
                            {obsResumo ? obsTexto : "—"}
                          </td>
                          <td className="py-2 px-2">
                            {r.status === "finalizada" && (
                              <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-green-500/20 text-green-300 border border-green-500/40">
                                Finalizada
                              </span>
                            )}
                            {r.status === "cancelada" && (
                              <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                                Cancelada
                              </span>
                            )}
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <div className="flex justify-end gap-2">
                              {(isAdmin || userIsOwner) && (
                                <Button
                                  size="sm"
                                  className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs h-7 px-3"
                                  onClick={() => abrirObsRoute(r)}
                                >
                                  Obs
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                                  onClick={() => handleExcluirRota(r)}
                                >
                                  Excluir
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isObsEditing && (
                          <tr className="border-b border-neutral-900">
                            <td
                              colSpan={8}
                              className="bg-neutral-900 px-3 py-3"
                            >
                              <form
                                onSubmit={handleSalvarObs}
                                className="space-y-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-300 flex items-center gap-1">
                                    <Info className="w-3 h-3 text-yellow-300" />
                                    Observações da rota
                                    {isAdmin && !userIsOwner && (
                                      <span className="text-[10px] text-gray-400">
                                        (visualização somente)
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <textarea
                                  value={obsDraft}
                                  onChange={(e) =>
                                    setObsDraft(e.target.value)
                                  }
                                  readOnly={isAdmin && !userIsOwner}
                                  placeholder={
                                    isAdmin && !userIsOwner
                                      ? "Observações registradas pelo responsável pela rota."
                                      : "Digite ou ajuste as observações da rota..."
                                  }
                                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[80px]"
                                />
                                <div className="flex flex-wrap gap-2 justify-end pt-1">
                                  {!isAdmin && userIsOwner && (
                                    <Button
                                      type="submit"
                                      disabled={saving}
                                      className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs"
                                    >
                                      {saving
                                        ? "Salvando..."
                                        : "Salvar observações"}
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    className="bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs"
                                    onClick={fecharObsRoute}
                                  >
                                    Fechar
                                  </Button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}