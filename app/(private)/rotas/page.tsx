"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import {
  Route as RouteIcon,
  Activity,
  MapPin,
  Clock,
  Filter,
  Search,
  Info,
  PencilLine,
  PieChart as PieIcon,
  CheckCircle2,
  Gauge,
  History,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";

type RouteStatus = "em_andamento" | "finalizada" | "cancelada";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  currentKm?: number;
  status?: "disponivel" | "em_rota" | "manutencao";

  // modelo antigo
  responsibleUserId?: string;

  // modelo novo: vários responsáveis
  responsibleUserIds?: string[];
}

interface Driver {
  id: string;
  name: string;
  storeId: string;
  responsibleUserId: string;
}

interface MaintenanceLock {
  vehicleId: string;
  status: "em_andamento" | "concluida";
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
  updatedAt?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
  editReason?: string | null;
}

const vehicleStatusColors = ["#facc15", "#3b82f6", "#e5e7eb"];

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

function getDateKeyFromIso(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRouteReferenceIso(route: RouteItem): string {
  return route.finishedAt || route.endAt || route.startAt || route.createdAt || "";
}

function formatRouteDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHoursOpen(startAt?: string | null) {
  if (!startAt) return 0;

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return 0;

  return Math.max(0, (Date.now() - start.getTime()) / (1000 * 60 * 60));
}

function formatDurationHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0h";

  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}min`;
  }

  return `${hours.toFixed(1)}h`;
}

export default function RotasPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [maintenanceLocks, setMaintenanceLocks] = useState<MaintenanceLock[]>([]);
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
  const [deletingRoute, setDeletingRoute] = useState<RouteItem | null>(null);

  // histórico / filtros
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "todas" | "finalizada" | "cancelada"
  >("todas");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStoreFilter, setHistoryStoreFilter] = useState("todas");
  const [historyDriverFilter, setHistoryDriverFilter] = useState("todos");
  const [historyMonth, setHistoryMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [showAllHistoryRoutes, setShowAllHistoryRoutes] = useState(false);

  // filtro para ver só rotas que eu lancei
  const [activeSearch, setActiveSearch] = useState("");
  const [activeStoreFilter, setActiveStoreFilter] = useState("todas");
  const [activeDriverFilter, setActiveDriverFilter] = useState("todos");
  const [activeDurationFilter, setActiveDurationFilter] = useState<
    "todas" | "4h" | "8h"
  >("todas");
  const [showOnlyMyActiveRoutes, setShowOnlyMyActiveRoutes] = useState(false);
  const [showOnlyMyRoutes, setShowOnlyMyRoutes] = useState(false);

  // edição/visualização de obs
  const [editingObsRouteId, setEditingObsRouteId] = useState<string | null>(null);
  const [obsDraft, setObsDraft] = useState("");

  // edição de rota (admin)
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [editDriverId, setEditDriverId] = useState("");
  const [editOrigemInput, setEditOrigemInput] = useState("");
  const [editDestinoInput, setEditDestinoInput] = useState("");
  const [editStartKmInput, setEditStartKmInput] = useState("");
  const [editEndKmInput, setEditEndKmInput] = useState("");
  const [editObsInput, setEditObsInput] = useState("");
  const [editReasonInput, setEditReasonInput] = useState("");

  const isAdmin = user?.role === "admin";
  const userId = user?.id ?? "";

  // ref para área de ação (finalizar/cancelar)
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

        // ===== VEÍCULOS =====
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        let vList: Vehicle[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            currentKm: data.currentKm,
            status: data.status,
            responsibleUserId: data.responsibleUserId,
            responsibleUserIds: Array.isArray(data.responsibleUserIds)
              ? data.responsibleUserIds
              : undefined,
          };
        });

        // usuário comum vê apenas veículos em que é responsável (single ou multi)
        if (!isAdmin) {
          vList = vList.filter((v) => {
            const singleMatch = v.responsibleUserId === user.id;
            const multiMatch = v.responsibleUserIds?.includes(user.id) ?? false;
            return singleMatch || multiMatch;
          });
        }

        // ===== MOTORISTAS =====
        // Agora lista motoristas da MESMA LOJA do usuário
        // (admin e usuário comum enxergam a lista da loja)
        let driversSnap;
        if (isAdmin) {
          driversSnap = await getDocs(collection(db, "drivers"));
        } else if (user.storeId) {
          driversSnap = await getDocs(
            query(
              collection(db, "drivers"),
              where("storeId", "==", user.storeId)
            )
          );
        } else {
          // fallback: se por algum motivo não tiver storeId no usuário,
          // mantém comportamento antigo
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

        // ===== ROTAS =====
        const routesSnap = await getDocs(
          query(collection(db, "routes"), orderBy("startAt", "desc"))
        );

        let rList: RouteItem[] = routesSnap.docs.map((d) => {
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
            createdByName: data.createdByName ?? data.responsibleUserName ?? null,
            finishedAt: data.finishedAt ?? data.endAt ?? null,
            finishedById: data.finishedById ?? null,
            finishedByName: data.finishedByName ?? null,
            canceledAt: data.canceledAt ?? null,
            canceledById: data.canceledById ?? null,
            canceledByName: data.canceledByName ?? null,
            cancelReason: data.cancelReason ?? null,
            updatedAt: data.updatedAt ?? null,
            updatedById: data.updatedById ?? null,
            updatedByName: data.updatedByName ?? null,
            editReason: data.editReason ?? null,
          };
        });

        // usuário comum vê apenas rotas de veículos em que ele é responsável
        if (!isAdmin) {
          const allowedVehicleIds = new Set(vList.map((v) => v.id));
          rList = rList.filter((r) => allowedVehicleIds.has(r.vehicleId));
        }

        const maintenancesSnap = await getDocs(collection(db, "maintenances"));
        let maintenanceList: MaintenanceLock[] = maintenancesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            vehicleId: data.vehicleId,
            status: (data.status ?? "em_andamento") as MaintenanceLock["status"],
          };
        });

        if (!isAdmin) {
          const allowedVehicleIds = new Set(vList.map((v) => v.id));
          maintenanceList = maintenanceList.filter((item) =>
            allowedVehicleIds.has(item.vehicleId)
          );
        }

        setVehicles(vList);
        setDrivers(dList);
        setRoutes(rList);
        setMaintenanceLocks(maintenanceList);
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
  const busyDriverIds = useMemo(() => {
    const ids = new Set<string>();
    rotasEmAndamento.forEach((route) => {
      if (route.driverId) ids.add(route.driverId);
    });
    return ids;
  }, [rotasEmAndamento]);
  const rotasFinalizadas = useMemo(
    () => routes.filter((r) => r.status === "finalizada"),
    [routes]
  );
  const rotasCanceladas = useMemo(
    () => routes.filter((r) => r.status === "cancelada"),
    [routes]
  );
  const rotasLongasEmAndamento = useMemo(
    () => rotasEmAndamento.filter((route) => getHoursOpen(route.startAt) >= 8),
    [rotasEmAndamento]
  );

  const totalRotas = routes.length;
  const taxaCancelamento =
    totalRotas === 0 ? 0 : (rotasCanceladas.length / totalRotas) * 100;

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

  const kmMedioFinalizado = useMemo(() => {
    if (rotasFinalizadas.length === 0) return 0;

    const totalDistance = rotasFinalizadas.reduce((acc, route) => {
      if (route.distanceKm != null) return acc + route.distanceKm;
      if (route.endKm != null) return acc + (route.endKm - route.startKm);
      return acc;
    }, 0);

    return totalDistance / rotasFinalizadas.length;
  }, [rotasFinalizadas]);

  const tempoMedioFinalizacao = useMemo(() => {
    const durations = rotasFinalizadas
      .map((route) => {
        if (!route.startAt || !route.endAt) return null;

        const start = new Date(route.startAt).getTime();
        const end = new Date(route.endAt).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;

        return (end - start) / (1000 * 60 * 60);
      })
      .filter((value): value is number => value != null);

    if (durations.length === 0) return 0;

    return durations.reduce((sum, value) => sum + value, 0) / durations.length;
  }, [rotasFinalizadas]);

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

  const availableVehiclesNow = useMemo(() => {
    return vehicles
      .filter((vehicle) => vehicle.status === "disponivel" || !vehicle.status)
      .sort((a, b) => {
        const storeCompare = (a.storeId || "").localeCompare(b.storeId || "");
        if (storeCompare !== 0) return storeCompare;
        return a.plate.localeCompare(b.plate);
      });
  }, [vehicles]);

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
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [historyRoutes]);

  const activeStoreOptions = useMemo(() => {
    const stores = new Set<string>();
    rotasEmAndamento.forEach((route) => {
      if (route.storeId) stores.add(route.storeId);
    });
    return Array.from(stores).sort();
  }, [rotasEmAndamento]);

  const activeDriverOptions = useMemo(() => {
    const map = new Map<string, string>();
    rotasEmAndamento.forEach((route) => {
      if (route.driverId) map.set(route.driverId, route.driverName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rotasEmAndamento]);

  const isOwner = (route: RouteItem) => route.responsibleUserId === userId;

  const userCanManageRoute = (route: RouteItem) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (route.responsibleUserId === user.id) return true;

    const vehicle = vehicles.find((v) => v.id === route.vehicleId);
    if (!vehicle) return false;

    const singleMatch = vehicle.responsibleUserId === user.id;
    const multiMatch = vehicle.responsibleUserIds?.includes(user.id) ?? false;

    return singleMatch || multiMatch;
  };

  const filteredActiveRoutes = useMemo(() => {
    return rotasEmAndamento.filter((route) => {
      if (showOnlyMyActiveRoutes && route.responsibleUserId !== userId) {
        return false;
      }

      if (activeStoreFilter !== "todas" && (route.storeId || "") !== activeStoreFilter) {
        return false;
      }

      if (activeDriverFilter !== "todos" && route.driverId !== activeDriverFilter) {
        return false;
      }

      if (activeDurationFilter === "4h" && getHoursOpen(route.startAt) < 4) {
        return false;
      }

      if (activeDurationFilter === "8h" && getHoursOpen(route.startAt) < 8) {
        return false;
      }

      if (activeSearch.trim()) {
        const term = activeSearch.toLowerCase();
        const composed = [
          route.vehiclePlate,
          route.vehicleModel,
          route.driverName,
          route.origem || "",
          route.destino || "",
          route.storeId || "",
          route.responsibleUserName || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!composed.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [
    activeDriverFilter,
    activeDurationFilter,
    activeSearch,
    activeStoreFilter,
    rotasEmAndamento,
    showOnlyMyActiveRoutes,
    userId,
  ]);

  const filteredHistoryRoutes = useMemo(() => {
    return historyRoutes
      .filter((r) => {
        if (showOnlyMyRoutes && r.responsibleUserId !== userId) {
          return false;
        }

        if (historyStatusFilter !== "todas" && r.status !== historyStatusFilter) {
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

        if (historyDriverFilter !== "todos" && r.driverId !== historyDriverFilter) {
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
      .sort((a, b) =>
        getRouteReferenceIso(b).localeCompare(getRouteReferenceIso(a))
      );
  }, [
    historyRoutes,
    historyStatusFilter,
    historyMonth,
    historyStoreFilter,
    historyDriverFilter,
    historySearch,
    showOnlyMyRoutes,
    userId,
  ]);

  const todayHistoryRoutes = useMemo(() => {
    const todayKey = getDateKeyFromIso(new Date().toISOString());

    return historyRoutes
      .filter((route) => getDateKeyFromIso(getRouteReferenceIso(route)) === todayKey)
      .sort((a, b) =>
        getRouteReferenceIso(b).localeCompare(getRouteReferenceIso(a))
      );
  }, [historyRoutes]);

  const displayedHistoryRoutes = showAllHistoryRoutes
    ? filteredHistoryRoutes
    : todayHistoryRoutes;

  const availableVehiclesForRoute = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          vehicle.status !== "em_rota" &&
          vehicle.status !== "manutencao" &&
          !maintenanceLocks.some(
            (maintenance) =>
              maintenance.vehicleId === vehicle.id &&
              maintenance.status === "em_andamento"
          )
      ),
    [maintenanceLocks, vehicles]
  );

  const availableDriversForRoute = useMemo(
    () => drivers.filter((driver) => !busyDriverIds.has(driver.id)),
    [busyDriverIds, drivers]
  );

  const availableDriversForEditing = useMemo(() => {
    if (!editingRoute) return drivers;

    const sameStoreDrivers = drivers.filter(
      (driver) => !editingRoute.storeId || driver.storeId === editingRoute.storeId
    );

    return sameStoreDrivers.length > 0 ? sameStoreDrivers : drivers;
  }, [drivers, editingRoute]);

  useEffect(() => {
    if (!selectedDriverId) return;
    if (availableDriversForRoute.some((driver) => driver.id === selectedDriverId)) return;
    setSelectedDriverId("");
  }, [availableDriversForRoute, selectedDriverId]);

  if (!user) return null;

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

      const vehicleInOpenMaintenance = maintenanceLocks.some(
        (maintenance) =>
          maintenance.vehicleId === vehicle.id &&
          maintenance.status === "em_andamento"
      );

      if (
        vehicle.status === "em_rota" ||
        vehicle.status === "manutencao" ||
        vehicleInOpenMaintenance
      ) {
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

      if (busyDriverIds.has(driver.id)) {
        setErrorMsg("Este motorista já está em rota. Escolha outro motorista.");
        return;
      }

      const startKmNumber = startKmInput.trim()
        ? Number(startKmInput.replace(",", "."))
        : vehicle.currentKm ?? 0;

      if (!Number.isFinite(startKmNumber) || startKmNumber < 0) {
        setErrorMsg("Informe um KM inicial valido.");
        return;
      }

      if (vehicle.currentKm != null && startKmNumber < vehicle.currentKm) {
        setErrorMsg(
          `O KM inicial nao pode ser menor que ${vehicle.currentKm} km.`
        );
        return;
      }

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

      const docRef = doc(collection(db, "routes"));
      const batch = writeBatch(db);

      batch.set(docRef, newRouteData);

      batch.update(doc(db, "vehicles", vehicle.id), {
        status: "em_rota",
        currentKm: startKmNumber,
      });

      await batch.commit();

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

      resetForm();
      setFormOpen(false);
      setSuccessMsg("Rota iniciada com sucesso.");
    } catch (error) {
      console.error("Erro ao iniciar rota:", error);
      setErrorMsg("Erro ao iniciar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function abrirFinalizarRota(route: RouteItem) {
    setFormOpen(false);
    fecharEdicaoRota();
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

    if (!userCanManageRoute(finishingRoute)) {
      setErrorMsg(
        "Apenas responsáveis pelo veículo ou quem iniciou a rota podem finalizá-la."
      );
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

      const finishBatch = writeBatch(db);

      finishBatch.update(doc(db, "routes", finishingRoute.id), {
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
        finishBatch.update(doc(db, "vehicles", finishingRoute.vehicleId), {
          currentKm: endKmNumber,
          status: "disponivel",
        });
      }

      await finishBatch.commit();

      if (finishingRoute.vehicleId) {
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
    setFormOpen(false);
    fecharEdicaoRota();
    setCancelingRoute(route);
    setFinishingRoute(null);
    setCancelReasonInput("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleConfirmarCancelamento(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelingRoute || !user) return;

    if (!userCanManageRoute(cancelingRoute)) {
      setErrorMsg(
        "Apenas responsáveis pelo veículo ou quem iniciou a rota podem cancelá-la."
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const nowIso = new Date().toISOString();

      const cancelBatch = writeBatch(db);

      cancelBatch.update(doc(db, "routes", cancelingRoute.id), {
        status: "cancelada" as RouteStatus,
        canceledAt: nowIso,
        canceledById: user.id,
        canceledByName: user.name,
        cancelReason: cancelReasonInput || null,
      });

      if (cancelingRoute.vehicleId) {
        cancelBatch.update(doc(db, "vehicles", cancelingRoute.vehicleId), {
          status: "disponivel",
          currentKm: cancelingRoute.startKm,
        });
      }

      await cancelBatch.commit();

      if (cancelingRoute.vehicleId) {
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

  function abrirExcluirRota(route: RouteItem) {
    if (!isAdmin) return;
    setDeletingRoute(route);
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleExcluirRota() {
    if (!isAdmin || !deletingRoute) return;

    const route = deletingRoute;

    try {
      setSaving(true);
      const deleteBatch = writeBatch(db);
      deleteBatch.delete(doc(db, "routes", route.id));

      if (route.status === "em_andamento" && route.vehicleId) {
        deleteBatch.update(doc(db, "vehicles", route.vehicleId), {
          status: "disponivel",
        });
      }

      await deleteBatch.commit();
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));

      if (route.status === "em_andamento" && route.vehicleId) {
        setVehicles((prev) =>
          prev.map((v) =>
            v.id === route.vehicleId ? { ...v, status: "disponivel" } : v
          )
        );
      }

      setDeletingRoute(null);
      setSuccessMsg("Rota excluida com sucesso!");
    } catch (error) {
      console.error("Erro ao excluir rota:", error);
      setErrorMsg("Erro ao excluir rota. Tente novamente.");
    } finally {
      setSaving(false);
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

    if (!userCanManageRoute(route)) {
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

  function fecharEdicaoRota() {
    setEditingRoute(null);
    setEditDriverId("");
    setEditOrigemInput("");
    setEditDestinoInput("");
    setEditStartKmInput("");
    setEditEndKmInput("");
    setEditObsInput("");
    setEditReasonInput("");
  }

  function abrirEditarRota(route: RouteItem) {
    if (!isAdmin) return;
    if (route.status === "cancelada") return;

    setFormOpen(false);
    setFinishingRoute(null);
    setCancelingRoute(null);
    fecharObsRoute();
    setErrorMsg("");
    setSuccessMsg("");
    setEditingRoute(route);
    setEditDriverId(route.driverId);
    setEditOrigemInput(route.origem ?? "");
    setEditDestinoInput(route.destino ?? "");
    setEditStartKmInput(String(route.startKm ?? ""));
    setEditEndKmInput(route.endKm != null ? String(route.endKm) : "");
    setEditObsInput(route.observacoes ?? "");
    setEditReasonInput("");
  }

  async function handleSalvarEdicaoRota(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRoute || !user || !isAdmin) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const selectedDriver = drivers.find((driver) => driver.id === editDriverId);
      if (!selectedDriver) {
        setErrorMsg("Selecione um motorista valido para a rota.");
        return;
      }

      const startKmNumber = Number(editStartKmInput.replace(",", "."));
      if (!Number.isFinite(startKmNumber) || startKmNumber < 0) {
        setErrorMsg("Informe um KM inicial valido.");
        return;
      }

      let endKmNumber: number | null = editingRoute.endKm ?? null;
      if (editingRoute.status === "finalizada") {
        if (!editEndKmInput.trim()) {
          setErrorMsg("Informe o KM final da rota finalizada.");
          return;
        }

        endKmNumber = Number(editEndKmInput.replace(",", "."));
        if (!Number.isFinite(endKmNumber)) {
          setErrorMsg("Informe um KM final valido.");
          return;
        }

        if (endKmNumber < startKmNumber) {
          setErrorMsg("O KM final nao pode ser menor que o KM inicial.");
          return;
        }

        if (!editReasonInput.trim()) {
          setErrorMsg("Informe o motivo da alteracao desta rota finalizada.");
          return;
        }
      }

      const nextOrigem = editOrigemInput.trim() || null;
      const nextDestino = editDestinoInput.trim() || null;
      const nextObs = editObsInput.trim() || null;
      const nextDistance =
        editingRoute.status === "finalizada" && endKmNumber != null
          ? endKmNumber - startKmNumber
          : editingRoute.distanceKm ?? null;

      const nowIso = new Date().toISOString();
      const routeDocRef = doc(db, "routes", editingRoute.id);
      const batch = writeBatch(db);

      batch.update(routeDocRef, {
        driverId: selectedDriver.id,
        driverName: selectedDriver.name,
        origem: nextOrigem,
        destino: nextDestino,
        startKm: startKmNumber,
        endKm: endKmNumber,
        distanceKm: nextDistance,
        observacoes: nextObs,
        updatedAt: nowIso,
        updatedById: user.id,
        updatedByName: user.name,
        editReason: editReasonInput.trim() || null,
      });

      const routeVehicle = vehicles.find((vehicle) => vehicle.id === editingRoute.vehicleId);
      let shouldSyncVehicleKm = false;
      let nextVehicleKm: number | null = null;

      if (editingRoute.vehicleId && routeVehicle) {
        if (editingRoute.status === "em_andamento") {
          shouldSyncVehicleKm = true;
          nextVehicleKm = startKmNumber;
        } else if (editingRoute.status === "finalizada" && endKmNumber != null) {
          const referenceIso = getRouteReferenceIso(editingRoute);
          const hasNewerRouteForVehicle = routes.some(
            (route) =>
              route.id !== editingRoute.id &&
              route.vehicleId === editingRoute.vehicleId &&
              route.status !== "cancelada" &&
              getRouteReferenceIso(route) > referenceIso
          );

          if (!hasNewerRouteForVehicle) {
            shouldSyncVehicleKm = true;
            nextVehicleKm = endKmNumber;
          }
        }

        if (shouldSyncVehicleKm && nextVehicleKm != null) {
          batch.update(doc(db, "vehicles", editingRoute.vehicleId), {
            currentKm: nextVehicleKm,
          });
        }
      }

      await batch.commit();

      setRoutes((prev) =>
        prev.map((route) =>
          route.id === editingRoute.id
            ? {
                ...route,
                driverId: selectedDriver.id,
                driverName: selectedDriver.name,
                origem: nextOrigem,
                destino: nextDestino,
                startKm: startKmNumber,
                endKm: endKmNumber,
                distanceKm: nextDistance,
                observacoes: nextObs,
                updatedAt: nowIso,
                updatedById: user.id,
                updatedByName: user.name,
                editReason: editReasonInput.trim() || null,
              }
            : route
        )
      );

      if (shouldSyncVehicleKm && nextVehicleKm != null && editingRoute.vehicleId) {
        setVehicles((prev) =>
          prev.map((vehicle) =>
            vehicle.id === editingRoute.vehicleId
              ? { ...vehicle, currentKm: nextVehicleKm }
              : vehicle
          )
        );
      }

      fecharEdicaoRota();
      setSuccessMsg("Rota atualizada com sucesso.");
    } catch (error) {
      console.error("Erro ao editar rota:", error);
      setErrorMsg("Erro ao atualizar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-page">
      {/* Cabeçalho */}
      <PageHeader
        eyebrow="Operacao em campo"
        title="Rotas da frota"
        description="Inicie, acompanhe e finalize rotas em um fluxo mais claro, com historico, status e leitura operacional em tempo real."
        icon={RouteIcon}
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              {totalRotas} rotas no historico
            </span>
            <span className="app-chip border-blue-300/20 bg-blue-400/10 text-blue-100">
              <span className="h-2 w-2 rounded-full bg-blue-300" />
              {rotasEmAndamento.length} em andamento
            </span>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              {rotasLongasEmAndamento.length} longa(s)
            </span>
          </>
        }
        actions={
          <Button
            onClick={() => {
              resetForm();
              setFinishingRoute(null);
              setCancelingRoute(null);
              fecharEdicaoRota();
              setFormOpen(true);
            }}
          >
            + Nova rota
          </Button>
        }
      />

      {/* Resumo + Formulário */}
      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}
      {successMsg ? <StatusBanner tone="success">{successMsg}</StatusBanner> : null}

      <div className="hidden grid grid-cols-1 gap-4">
        {/* Resumo em cards */}
        <div className="hidden space-y-4">
          <Card className="app-panel gap-0 overflow-hidden py-0">
            <div className="border-b border-border px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
                Resumo operacional
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                Indicadores principais da operacao
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Leitura mais executiva para saber volume, ritmo de fechamento e pontos de atencao.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4 md:p-5">
              <div className="app-panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Em andamento
                  </p>
                  <Activity className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
                  {rotasEmAndamento.length}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {filteredActiveRoutes.length} rota(s) visiveis com os filtros ativos.
                </p>
              </div>

              <div className="app-panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Rotas longas
                  </p>
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-300" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
                  {rotasLongasEmAndamento.length}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Abertas ha mais de 8 horas.
                </p>
              </div>

              <div className="app-panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    KM medio
                  </p>
                  <Gauge className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
                  {kmMedioFinalizado.toFixed(1)} km
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Media por rota finalizada no historico atual.
                </p>
              </div>

              <div className="app-panel-muted p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Taxa cancelamento
                  </p>
                  <XCircle className="h-4 w-4 text-red-500 dark:text-red-300" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">
                  {taxaCancelamento.toFixed(1)}%
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {rotasCanceladas.length} cancelada(s) em {totalRotas} rotas.
                </p>
              </div>
            </div>
          </Card>

          <Card className="hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-3">
                <p className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Total de rotas
                </p>
                <p className="text-2xl font-bold text-yellow-400">{totalRotas}</p>
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
            <Card className="app-panel gap-0 overflow-hidden py-0">
              <div className="flex items-center justify-between border-b border-border px-5 py-5">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Nova rota
                </h2>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Preencha os dados e inicie a rota
                </span>
              </div>

              <form onSubmit={handleCriarRota} className="space-y-4 p-4 md:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Veículo
                    </label>
                    <select
                      className="app-select"
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                    >
                      <option value="">Selecione um veículo disponível...</option>
                      {availableVehiclesForRoute.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.model} ({v.storeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Motorista
                    </label>
                    <select
                      className="app-select"
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                    >
                      <option value="">Selecione um motorista...</option>
                  {availableDriversForRoute.map((d) => (
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
                  />

                  <Input
                    placeholder="Destino (opcional)"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                  />

                  <Input
                    placeholder="KM inicial (deixe em branco para usar o KM atual do veículo)"
                    value={startKmInput}
                    onChange={(e) => setStartKmInput(e.target.value)}
                    className="md:col-span-2"
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
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
                  >
                    {saving ? "Salvando..." : "Iniciar rota"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
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

          {!formOpen && !finishingRoute && !cancelingRoute && (
            <Card className="app-panel gap-0 overflow-hidden py-0">
              <div className="border-b border-border px-5 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
                  Acesso rapido
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  Abra o formulario apenas quando precisar registrar uma nova saida
                </h2>
              </div>

              <div className="space-y-4 p-4 md:p-5">
                <div className="app-panel-muted p-4">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Use esta lateral como area de acao principal. O restante da tela fica dedicado ao acompanhamento das rotas ativas e ao historico.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    resetForm();
                    setFinishingRoute(null);
                    setCancelingRoute(null);
                    fecharEdicaoRota();
                    setFormOpen(true);
                  }}
                >
                  Abrir formulario de rota
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Rotas em andamento + Gráfico de status */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)] gap-4">
        {/* Esquerda: rotas em andamento */}
        <div className="space-y-4">
          <Card className="app-panel p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-yellow-500/10 p-2">
                  <Activity className="h-4 w-4 text-yellow-500 dark:text-yellow-300" />
                </div>
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  Rotas em andamento
                </p>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {filteredActiveRoutes.length} rota(s)
              </span>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="relative">
                <Input
                  value={activeSearch}
                  onChange={(e) => setActiveSearch(e.target.value)}
                  placeholder="Buscar por placa, motorista, origem ou loja"
                  className="pr-9"
                />
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  className="app-select"
                  value={activeStoreFilter}
                  onChange={(e) => setActiveStoreFilter(e.target.value)}
                >
                  <option value="todas">Todas as lojas</option>
                  {activeStoreOptions.map((store) => (
                    <option key={store} value={store}>
                      {store}
                    </option>
                  ))}
                </select>

                <select
                  className="app-select"
                  value={activeDriverFilter}
                  onChange={(e) => setActiveDriverFilter(e.target.value)}
                >
                  <option value="todos">Todos os motoristas</option>
                  {activeDriverOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  className="app-select"
                  value={activeDurationFilter}
                  onChange={(e) =>
                    setActiveDurationFilter(e.target.value as "todas" | "4h" | "8h")
                  }
                >
                  <option value="todas">Qualquer duracao</option>
                  <option value="4h">4h ou mais</option>
                  <option value="8h">8h ou mais</option>
                </select>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={showOnlyMyActiveRoutes ? "default" : "outline"}
                className={
                  showOnlyMyActiveRoutes
                    ? "bg-yellow-400 text-black hover:bg-yellow-300 dark:bg-yellow-300 dark:text-black"
                    : ""
                }
                onClick={() => setShowOnlyMyActiveRoutes((prev) => !prev)}
              >
                {showOnlyMyActiveRoutes ? "Mostrando minhas rotas" : "Mostrar so minhas rotas"}
              </Button>

              {(activeSearch ||
                activeStoreFilter !== "todas" ||
                activeDriverFilter !== "todos" ||
                activeDurationFilter !== "todas" ||
                showOnlyMyActiveRoutes) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActiveSearch("");
                    setActiveStoreFilter("todas");
                    setActiveDriverFilter("todos");
                    setActiveDurationFilter("todas");
                    setShowOnlyMyActiveRoutes(false);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            {filteredActiveRoutes.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma rota em andamento encontrada com os filtros atuais.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredActiveRoutes.map((r) => {
                  const owner = isOwner(r);
                  const canManage = userCanManageRoute(r);

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
                            ? new Date(r.startAt).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          KM inicial:{" "}
                          <span className="font-mono text-gray-100">
                            {r.startKm} km
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isAdmin && (
                            <ActionIconButton action="edit" onClick={() => abrirEditarRota(r)} />
                          )}
                          {canManage && (
                            <>
                              <ActionIconButton action="complete" onClick={() => abrirFinalizarRota(r)} />
                              <ActionIconButton action="cancel" onClick={() => abrirCancelarRota(r)} />
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

          <Card className="app-panel gap-0 overflow-hidden py-0">
            <div className="border-b border-border px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/15 dark:bg-yellow-300/10">
                  <History className="h-5 w-5 text-yellow-600 dark:text-yellow-200" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                    Fechamento e historico
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Indicadores de volume e encerramento da operacao.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 md:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    KM rodado
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {totalKmRodado.toFixed(1)} km
                  </p>
                </div>
                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Tempo medio
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {formatDurationHours(tempoMedioFinalizacao)}
                  </p>
                </div>
                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Finalizadas
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {rotasFinalizadas.length}
                  </p>
                </div>
                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Veiculos que rodaram
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                    {uniqueVehiclesCount}
                  </p>
                </div>
              </div>

              {rotasLongasEmAndamento.length > 0 ? (
                <div className="rounded-2xl border border-yellow-300/60 bg-yellow-400/10 p-4 dark:border-yellow-300/20 dark:bg-yellow-300/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-yellow-700 dark:text-yellow-200" />
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      Pontos que pedem atencao
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {rotasLongasEmAndamento.slice(0, 3).map((route) => (
                      <div
                        key={route.id}
                        className="rounded-xl border border-yellow-300/40 bg-white/70 px-3 py-2 text-sm text-slate-700 dark:border-yellow-300/15 dark:bg-black/30 dark:text-slate-200"
                      >
                        <span className="font-mono">{route.vehiclePlate}</span> · {route.driverName} ·{" "}
                        {formatDurationHours(getHoursOpen(route.startAt))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="app-panel-muted rounded-2xl p-4 text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma rota longa no momento. A operacao esta dentro do esperado.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Direita: gráfico de status dos veículos */}
        <div className="space-y-4">
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

          <div className="space-y-4">
          <Card className="app-panel gap-0 overflow-hidden py-0">
            <div className="border-b border-border px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 dark:bg-blue-500/15">
                    <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                      Veiculos disponiveis agora
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Leitura rapida dos veiculos prontos para nova saida.
                    </p>
                  </div>
                </div>

                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                  {availableVehiclesNow.length} livre(s)
                </span>
              </div>
            </div>

            <div className="space-y-4 p-4 md:p-5">
              {availableVehiclesNow.length === 0 ? (
                <div className="app-panel-muted rounded-2xl p-4 text-sm text-slate-500 dark:text-slate-400">
                  Nenhum veiculo disponivel no momento. Todos estao em rota ou em manutencao.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {availableVehiclesNow.slice(0, 5).map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className="rounded-2xl border border-border bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-950 dark:text-white">
                              <span className="font-mono">{vehicle.plate}</span> · {vehicle.model}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-300" />
                                {vehicle.storeId || "Loja nao informada"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Gauge className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                                {vehicle.currentKm != null ? `${vehicle.currentKm} km` : "KM nao informado"}
                              </span>
                            </div>
                          </div>

                          <span className="shrink-0 rounded-full border border-yellow-300/70 bg-yellow-400/15 px-2.5 py-1 text-[11px] font-medium text-yellow-700 dark:border-yellow-300/20 dark:bg-yellow-300/10 dark:text-yellow-200">
                            Pronto para saida
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {availableVehiclesNow.length > 5 ? (
                    <div className="app-panel-muted rounded-2xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      Mostrando 5 de {availableVehiclesNow.length} veiculos disponiveis no momento.
                    </div>
                  ) : null}

                  {false && vehicleStatusData.map((status) => {
                  const percent = status.total
                    ? Math.round((status.value / status.total) * 100)
                    : 0;

                  const accentClass =
                    status.name === "Disponíveis"
                      ? "bg-yellow-400 dark:bg-yellow-300"
                      : status.name === "Em rota"
                      ? "bg-blue-500 dark:bg-blue-300"
                      : "bg-slate-900 dark:bg-white";

                  return (
                    <div key={status.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {status.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {status.value} de {status.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div
                          className={`h-full rounded-full ${accentClass}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {percent}% da frota nesta situacao.
                      </p>
                    </div>
                  );
                  })}
                </>
              )}
            </div>
          </Card>

          </div>
        </div>
      </div>

      {/* ÁREA DESTACADA PARA FINALIZAR / CANCELAR ROTA */}
      {false && (finishingRoute || cancelingRoute) && (
        <div className="space-y-4">
          <Card className="p-4 bg-neutral-950 border border-yellow-500/60 shadow-lg shadow-yellow-500/20">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-yellow-400">
                  Ação crítica de rota
                </p>
                <h2 className="text-xl font-bold text-gray-100">
                  {finishingRoute
                    ? `Finalizar rota do veículo ${finishingRoute?.vehiclePlate ?? "-"}`
                    : cancelingRoute
                    ? `Cancelar rota do veículo ${cancelingRoute?.vehiclePlate ?? "-"}`
                    : "Gerenciar rota"}
                </h2>
                <p className="text-xs text-gray-400 mt-1 max-w-xl">
                  Revise com atenção o KM final, destino e observações antes de
                  confirmar. Após finalizada ou cancelada, a rota vai direto para
                  o histórico e alimenta os relatórios.
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-1 text-xs text-gray-400">
                <span className="px-2 py-1 rounded-full bg-neutral-900 border border-neutral-700">
                  Responsável:{" "}
                  <span className="text-gray-100">{user?.name}</span>
                </span>
                {(finishingRoute || cancelingRoute) && (
                  <span className="px-2 py-1 rounded-full bg-neutral-900 border border-neutral-700">
                    KM inicial:{" "}
                    <span className="font-mono text-gray-100">
                      {(finishingRoute || cancelingRoute)!.startKm} km
                    </span>
                  </span>
                )}
              </div>
            </div>

            {finishingRoute && (
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
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[100px]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
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
                    className="bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs"
                    onClick={() => {
                      setFinishingRoute(null);
                      setEndKmInput("");
                      setEndDestinoInput("");
                      setObsInput("");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                  >
                    Cancelar ação
                  </Button>
                </div>
              </form>
            )}

            {cancelingRoute && (
              <form onSubmit={handleConfirmarCancelamento} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Motivo do cancelamento (opcional, mas recomendado)
                  </label>
                  <textarea
                    placeholder="Ex: rota lançada no veículo errado, cliente cancelou a entrega..."
                    value={cancelReasonInput}
                    onChange={(e) => setCancelReasonInput(e.target.value)}
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[100px]"
                  />
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
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
                    {saving ? "Cancelando..." : "Cancelar"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setCancelingRoute(null);
                      setCancelReasonInput("");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            resetForm();
            setErrorMsg("");
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <RouteIcon className="h-5 w-5 text-blue-600 dark:text-yellow-200" />
              Nova rota
            </DialogTitle>
            <DialogDescription>
              Preencha os dados principais para iniciar uma nova saida da frota.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarRota} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  Veiculo
                </label>
                <select
                  className="app-select"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                >
                  <option value="">Selecione um veiculo disponivel...</option>
                  {availableVehiclesForRoute.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} · {vehicle.model} ({vehicle.storeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  Motorista
                </label>
                <select
                  className="app-select"
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                >
                  <option value="">Selecione um motorista...</option>
                  {availableDriversForRoute.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name} ({driver.storeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  Origem
                </label>
                <Input
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="Origem da rota"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  Destino
                </label>
                <Input
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  placeholder="Destino da rota"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  KM inicial
                </label>
                <Input
                  value={startKmInput}
                  onChange={(e) => setStartKmInput(e.target.value)}
                  placeholder="Deixe em branco para usar o KM atual do veiculo"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                  setErrorMsg("");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-yellow-400 text-black hover:bg-yellow-300 dark:bg-yellow-300 dark:text-black"
              >
                {saving ? "Iniciando..." : "Iniciar rota"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!finishingRoute}
        onOpenChange={(open) => {
          if (!open) {
            setFinishingRoute(null);
            setEndKmInput("");
            setEndDestinoInput("");
            setObsInput("");
            setErrorMsg("");
          }
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <CheckCircle2 className="h-5 w-5 text-yellow-600 dark:text-yellow-200" />
              Finalizar rota
            </DialogTitle>
            <DialogDescription>
              Confira KM final, destino e observacoes antes de encerrar a rota.
            </DialogDescription>
          </DialogHeader>

          {finishingRoute ? (
            <form onSubmit={handleFinalizarRota} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Veiculo
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {finishingRoute.vehiclePlate} · {finishingRoute.vehicleModel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {finishingRoute.storeId || "Loja nao informada"}
                  </p>
                </div>

                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Inicio da rota
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {formatRouteDateTime(finishingRoute.startAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    KM inicial: <span className="font-mono">{finishingRoute.startKm} km</span>
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    KM final
                  </label>
                  <Input
                    value={endKmInput}
                    onChange={(e) => setEndKmInput(e.target.value)}
                    placeholder="Informe o KM final"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    Destino
                  </label>
                  <Input
                    value={endDestinoInput}
                    onChange={(e) => setEndDestinoInput(e.target.value)}
                    placeholder="Destino final da rota"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                    Observacoes
                  </label>
                  <textarea
                    value={obsInput}
                    onChange={(e) => setObsInput(e.target.value)}
                    placeholder="Registre ocorrencias, retorno do veiculo ou detalhes do encerramento."
                    className="app-textarea min-h-[110px]"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setFinishingRoute(null);
                    setEndKmInput("");
                    setEndDestinoInput("");
                    setObsInput("");
                    setErrorMsg("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {saving ? "Finalizando..." : "Concluir"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cancelingRoute}
        onOpenChange={(open) => {
          if (!open) {
            setCancelingRoute(null);
            setCancelReasonInput("");
            setErrorMsg("");
          }
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <XCircle className="h-5 w-5 text-red-500 dark:text-red-300" />
              Cancelar rota
            </DialogTitle>
            <DialogDescription>
              Use o cancelamento apenas quando a rota nao deve entrar como concluida no historico.
            </DialogDescription>
          </DialogHeader>

          {cancelingRoute ? (
            <form onSubmit={handleConfirmarCancelamento} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Veiculo
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {cancelingRoute.vehiclePlate} · {cancelingRoute.vehicleModel}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {cancelingRoute.storeId || "Loja nao informada"}
                  </p>
                </div>

                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Referencia
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                    {formatRouteDateTime(cancelingRoute.startAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    KM inicial: <span className="font-mono">{cancelingRoute.startKm} km</span>
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  Motivo do cancelamento
                </label>
                <textarea
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Explique o motivo para manter o historico mais confiavel."
                  className="app-textarea min-h-[110px]"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setCancelingRoute(null);
                    setCancelReasonInput("");
                    setErrorMsg("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  variant="destructive"
                >
                  {saving ? "Cancelando..." : "Cancelar"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingRoute}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRoute(null);
            setErrorMsg("");
          }
        }}
      >
        <DialogContent className="max-w-lg border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <XCircle className="h-5 w-5 text-red-500 dark:text-red-300" />
              Excluir rota
            </DialogTitle>
            <DialogDescription>
              Esta acao remove a rota do historico. Use apenas quando o registro estiver incorreto.
            </DialogDescription>
          </DialogHeader>

          {deletingRoute ? (
            <div className="space-y-4">
              <div className="app-panel-muted p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Rota selecionada
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                  {deletingRoute.vehiclePlate} · {deletingRoute.vehicleModel}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {deletingRoute.driverName || "Motorista nao informado"} · {formatRouteDateTime(deletingRoute.startAt)}
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="destructive" onClick={() => setDeletingRoute(null)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  onClick={handleExcluirRota}
                >
                  {saving ? "Excluindo..." : "Excluir"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingRoute}
        onOpenChange={(open) => {
          if (!open) fecharEdicaoRota();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                <PencilLine className="h-5 w-5 text-blue-600 dark:text-yellow-200" />
                Editar rota
              </DialogTitle>
              <DialogDescription>
                Ajuste dados da rota para correção operacional sem alterar o fluxo de encerramento.
              </DialogDescription>
            </DialogHeader>

            {editingRoute ? (
              <form onSubmit={handleSalvarEdicaoRota} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Veiculo
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {editingRoute.vehiclePlate} · {editingRoute.vehicleModel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {editingRoute.storeId || "Loja nao informada"}
                      </p>
                    </div>

                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {editingRoute.status === "em_andamento" ? "Em andamento" : "Finalizada"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Inicio: {formatRouteDateTime(editingRoute.startAt)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Motorista
                      </label>
                      <select
                        className="app-select"
                        value={editDriverId}
                        onChange={(e) => setEditDriverId(e.target.value)}
                      >
                        <option value="">Selecione um motorista...</option>
                        {availableDriversForEditing.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name} ({driver.storeId})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        KM inicial
                      </label>
                      <Input
                        value={editStartKmInput}
                        onChange={(e) => setEditStartKmInput(e.target.value)}
                        placeholder="KM inicial"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Origem
                      </label>
                      <Input
                        value={editOrigemInput}
                        onChange={(e) => setEditOrigemInput(e.target.value)}
                        placeholder="Origem da rota"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Destino
                      </label>
                      <Input
                        value={editDestinoInput}
                        onChange={(e) => setEditDestinoInput(e.target.value)}
                        placeholder="Destino da rota"
                      />
                    </div>

                    {editingRoute.status === "finalizada" ? (
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                          KM final
                        </label>
                        <Input
                          value={editEndKmInput}
                          onChange={(e) => setEditEndKmInput(e.target.value)}
                          placeholder="KM final"
                        />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Distancia recalculada automaticamente ao salvar.
                        </p>
                      </div>
                    ) : null}

                    {editingRoute.status === "finalizada" ? (
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                          Motivo da alteracao
                        </label>
                        <textarea
                          value={editReasonInput}
                          onChange={(e) => setEditReasonInput(e.target.value)}
                          placeholder="Explique por que esta rota finalizada esta sendo ajustada."
                          className="app-textarea min-h-[90px]"
                        />
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Este motivo sera salvo junto com a auditoria da edicao.
                        </p>
                      </div>
                    ) : null}

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Observacoes
                      </label>
                      <textarea
                        value={editObsInput}
                        onChange={(e) => setEditObsInput(e.target.value)}
                        placeholder="Registre ajustes, ocorrencias ou detalhes importantes da rota."
                        className="app-textarea min-h-[110px]"
                      />
                    </div>

                    {editingRoute.updatedAt ? (
                      <div className="md:col-span-2 app-panel-muted p-4">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Ultima alteracao
                        </p>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                          {editingRoute.updatedByName || "Admin"} em {formatRouteDateTime(editingRoute.updatedAt)}
                        </p>
                        {editingRoute.editReason ? (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Motivo anterior: {editingRoute.editReason}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
                  <Button type="button" variant="destructive" onClick={fecharEdicaoRota}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Salvando..." : "Salvar alteracoes"}
                  </Button>
                </DialogFooter>
              </form>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Histórico de rotas */}
      <Card className="app-panel gap-0 overflow-hidden py-0">
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/15 dark:bg-yellow-300/10">
              <History className="h-5 w-5 text-yellow-600 dark:text-yellow-200" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Historico de rotas
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Consulte encerramentos, cancelamentos e ajustes administrativos.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">
              {showAllHistoryRoutes ? "Historico de rotas" : "Rotas de hoje"}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {showAllHistoryRoutes
                ? "Veja o historico completo com filtros por mes, status e motorista."
                : "Lista rapida das rotas encerradas ou canceladas hoje."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAllHistoryRoutes((prev) => !prev)}
          >
            {showAllHistoryRoutes ? "Voltar para hoje" : "Ver todas"}
          </Button>
        </div>

        {showAllHistoryRoutes && (
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1 max-w-md">
            <label className="block text-xs text-gray-400 mb-1">
              Buscar por veículo, motorista, origem, destino, loja ou observações
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

            {/* Filtro Minhas rotas */}
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
        )}

        <div className="mt-2">
          <h2 className="text-sm font-semibold text-gray-100 mb-2 flex items-center gap-2">
            {showAllHistoryRoutes ? "Historico filtrado" : "Rotas registradas hoje"}
            <span className="text-[11px] text-gray-500">
              ({displayedHistoryRoutes.length} registro(s))
            </span>
          </h2>

        {loading ? (
            <p className="text-sm text-gray-400">Carregando rotas...</p>
          ) : displayedHistoryRoutes.length === 0 ? (
            <p className="text-sm text-gray-400">
              {showAllHistoryRoutes
                ? "Nenhuma rota encontrada com os filtros atuais."
                : "Nenhuma rota registrada hoje."}
            </p>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {displayedHistoryRoutes.map((r) => {
                const distancia =
                  r.status === "cancelada"
                    ? null
                    : r.distanceKm != null
                    ? r.distanceKm
                    : r.endKm != null
                    ? r.endKm - r.startKm
                    : null;

                const isObsEditing = editingObsRouteId === r.id;
                const canEditObs = userCanManageRoute(r);

                return (
                  <div
                    key={`${r.id}-mobile`}
                    className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-200/50 dark:border-white/10 dark:bg-[#050505]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">
                          <span className="font-mono">{r.vehiclePlate}</span> · {r.vehicleModel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatRouteDateTime(r.startAt)} · {r.driverName}
                        </p>
                      </div>

                      <div>
                        {r.status === "finalizada" ? (
                          <span className="rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-[11px] font-semibold text-green-600 dark:text-green-300">
                            Finalizada
                          </span>
                        ) : (
                          <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-300">
                            Cancelada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p>
                        <span className="font-medium text-slate-950 dark:text-white">Trajeto:</span>{" "}
                        {(r.origem || "-") + " -> " + (r.destino || "-")}
                      </p>
                      <p>
                        <span className="font-medium text-slate-950 dark:text-white">KM:</span>{" "}
                        <span className="font-mono">
                          {r.startKm} km{r.endKm != null ? ` / ${r.endKm} km` : ""}
                        </span>
                      </p>
                      <p>
                        <span className="font-medium text-slate-950 dark:text-white">Distancia:</span>{" "}
                        {distancia != null ? `${distancia.toFixed(1)} km` : "-"}
                      </p>

                      {r.cancelReason ? (
                        <p className="text-red-600 dark:text-red-300">
                          Motivo: {r.cancelReason}
                        </p>
                      ) : null}

                      {r.updatedAt ? (
                        <div className="rounded-xl border border-blue-200/70 bg-blue-50/60 px-3 py-2 text-xs text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                          Editada por {r.updatedByName || "Admin"} em {formatRouteDateTime(r.updatedAt)}
                          {r.editReason ? ` · ${r.editReason}` : ""}
                        </div>
                      ) : null}

                      {r.observacoes ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Obs: {r.observacoes}
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {isAdmin && r.status !== "cancelada" ? (
                        <ActionIconButton action="edit" onClick={() => abrirEditarRota(r)} />
                      ) : null}
                      {!isAdmin && canEditObs ? (
                        <Button
                          size="sm"
                          className="bg-yellow-400 text-black hover:bg-yellow-300 dark:bg-yellow-300 dark:text-black"
                          onClick={() => abrirObsRoute(r)}
                        >
                          Obs
                        </Button>
                      ) : null}
                      {isAdmin ? (
                        <ActionIconButton action="delete" onClick={() => abrirExcluirRota(r)} />
                      ) : null}
                    </div>

                    {isObsEditing ? (
                      <form onSubmit={handleSalvarObs} className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-black/30">
                        <textarea
                          value={obsDraft}
                          onChange={(e) => setObsDraft(e.target.value)}
                          readOnly={!canEditObs}
                          placeholder={
                            canEditObs
                              ? "Digite ou ajuste as observacoes da rota..."
                              : "Observacoes registradas pelo responsavel pela rota."
                          }
                          className="app-textarea min-h-[90px]"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          {canEditObs ? (
                            <Button type="submit" disabled={saving}>
                              {saving ? "Salvando..." : "Salvar observacoes"}
                            </Button>
                          ) : null}
                          <Button type="button" variant="destructive" onClick={fecharObsRoute}>
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b border-neutral-800 text-gray-400">
                    <th className="py-2 pr-2">Data</th>
                    <th className="py-2 px-2">Veículo</th>
                    <th className="py-2 px-2 hidden md:table-cell">Motorista</th>
                    <th className="py-2 px-2">Origem → Destino</th>
                    <th className="py-2 px-2 hidden lg:table-cell">
                      KM (início / fim)
                    </th>
                    <th className="py-2 px-2 hidden xl:table-cell">Distância</th>
                    <th className="py-2 px-2 hidden xl:table-cell">
                      Observações
                    </th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 pl-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedHistoryRoutes.map((r) => {
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
                    const canEditObs = userCanManageRoute(r);

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
                            <span className="font-mono">{r.vehiclePlate}</span>{" "}
                            · {r.vehicleModel}
                            {r.storeId && (
                              <span className="ml-1 text-[11px] text-gray-500">
                                ({r.storeId})
                              </span>
                            )}
                            {r.updatedAt && (
                              <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-200">
                                Editada por {r.updatedByName || "Admin"} em {formatRouteDateTime(r.updatedAt)}
                              </div>
                            )}
                            {r.editReason && (
                              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                Motivo da alteracao: {r.editReason}
                              </div>
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
                            {obsResumo ? obsTexto : "-"}
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
                            <div className="flex flex-wrap justify-end gap-2">
                              {isAdmin && r.status !== "cancelada" && (
                                <ActionIconButton action="edit" onClick={() => abrirEditarRota(r)} />
                              )}
                              {!isAdmin && canEditObs && (
                                <Button
                                  size="sm"
                                  className="bg-yellow-400 hover:bg-yellow-300 text-black text-xs h-7 px-3"
                                  onClick={() => abrirObsRoute(r)}
                                >
                                  Obs
                                </Button>
                              )}
                              {isAdmin && (
                                <ActionIconButton action="delete" onClick={() => abrirExcluirRota(r)} />
                              )}
                            </div>
                          </td>
                        </tr>

                        {isObsEditing && (
                          <tr className="border-b border-neutral-900">
                            <td colSpan={9} className="bg-neutral-900 px-3 py-3">
                              <form
                                onSubmit={handleSalvarObs}
                                className="space-y-2"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-300 flex items-center gap-1">
                                    <Info className="w-3 h-3 text-yellow-300" />
                                    Observações da rota
                                    {isAdmin && !userIsOwner && !canEditObs && (
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
                                  readOnly={!canEditObs}
                                  placeholder={
                                    canEditObs
                                      ? "Digite ou ajuste as observações da rota..."
                                      : "Observações registradas pelo responsável pela rota."
                                  }
                                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 resize-y min-h-[80px]"
                                />
                                <div className="flex flex-wrap gap-2 justify-end pt-1">
                                  {canEditObs && (
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
            </>
          )}
        </div>
        </div>
      </Card>
    </div>
  );
}


