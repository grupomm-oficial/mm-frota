"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  query,
  orderBy,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Gauge,
  MapPin,
  PencilLine,
  ReceiptText,
  Search,
  Trash2,
  User2,
  Wrench as WrenchIcon,
} from "lucide-react";

type MaintenanceStatus = "em_andamento" | "concluida";

interface VehicleOption {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  currentKm?: number;
  status?: "disponivel" | "em_rota" | "manutencao";

  // modelo antigo (um responsável)
  responsibleUserId?: string;
  responsibleUserName?: string;

  // modelo novo (varios responsáveis)
  responsibleUserIds?: string[];
}

interface Maintenance {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  storeId: string;
  responsibleUserId: string;
  responsibleUserName: string;
  date: string; // data de entrada
  odometerKm: number;
  cost: number;
  type: string;
  workshopName?: string | null;
  notes?: string | null;
  status: MaintenanceStatus;
  endKm?: number | null;
  endDate?: string | null;
  updatedAt?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
  editReason?: string | null;
}

export default function ManutencoesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [cost, setCost] = useState("");
  const [type, setType] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [notes, setNotes] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editOdometerKm, setEditOdometerKm] = useState("");
  const [editEndKm, setEditEndKm] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editType, setEditType] = useState("");
  const [editWorkshopName, setEditWorkshopName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReason, setEditReason] = useState("");
  const [completingMaintenance, setCompletingMaintenance] = useState<Maintenance | null>(null);
  const [completeEndKmInput, setCompleteEndKmInput] = useState("");
  const [deletingMaintenance, setDeletingMaintenance] = useState<Maintenance | null>(null);

  // Filtro de período (data inicial/final) ? padrão: mês corrente
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("todos");
  const [storeFilter, setStoreFilter] = useState("todas");
  const [responsibleFilter, setResponsibleFilter] = useState("todos");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  // helper: verifica se o usuário pode usar / ver um veículo
  function userCanUseVehicle(vehicle: VehicleOption): boolean {
    if (!user) return false;
    if (user.role === "admin") return true;

    const singleMatch = vehicle.responsibleUserId === user.id;
    const multiMatch = vehicle.responsibleUserIds?.includes(user.id) ?? false;

    return singleMatch || multiMatch;
  }

  function toDateTimeLocalValue(value?: string | null) {
    const source = value ? new Date(value) : new Date();
    if (Number.isNaN(source.getTime())) return "";

    const offset = source.getTimezoneOffset() * 60000;
    return new Date(source.getTime() - offset).toISOString().slice(0, 16);
  }

  // Define período padrão = mês corrente
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    const toInputDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    setStartFilter(toInputDate(first));
    setEndFilter(toInputDate(last));
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        setErrorMsg("");

        // ===== VEÃCULOS ACESSÃVEIS =====
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        const vListAll: VehicleOption[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            currentKm: data.currentKm,
            status: data.status,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            responsibleUserIds: Array.isArray(data.responsibleUserIds)
              ? data.responsibleUserIds
              : undefined,
          };
        });

        let vList = vListAll;
        if (!isAdmin) {
          vList = vListAll.filter((v) => userCanUseVehicle(v));
        }
        setVehicles(vList);

        // ===== MANUTENÃ‡Ã•ES =====
        const maintSnap = await getDocs(
          query(collection(db, "maintenances"), orderBy("date", "desc"))
        );

        let mList: Maintenance[] = maintSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            storeId: data.storeId,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            date: data.date,
            odometerKm: data.odometerKm,
            cost: data.cost,
            type: data.type,
            workshopName: data.workshopName ?? null,
            notes: data.notes ?? null,
            status: data.status ?? "em_andamento",
            endKm: data.endKm ?? null,
            endDate: data.endDate ?? null,
            updatedAt: data.updatedAt ?? null,
            updatedById: data.updatedById ?? null,
            updatedByName: data.updatedByName ?? null,
            editReason: data.editReason ?? null,
          };
        });

        if (!isAdmin) {
          const allowedVehicleIds = new Set(vList.map((v) => v.id));

          mList = mList.filter(
            (m) =>
              m.responsibleUserId === user.id ||
              allowedVehicleIds.has(m.vehicleId)
          );
        }

        setMaintenances(mList);
      } catch (error) {
        console.error("Erro ao carregar manutenções:", error);
        setErrorMsg("Erro ao carregar dados. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, isAdmin]);

  function resetForm() {
    setVehicleId("");
    setDate(toDateTimeLocalValue());
    setOdometerKm("");
    setCost("");
    setType("");
    setWorkshopName("");
    setNotes("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeNewMaintenanceDialog() {
    setFormOpen(false);
    resetForm();
  }

  function openEditMaintenance(maintenance: Maintenance) {
    setFormOpen(false);
    setCompletingMaintenance(null);
    setDeletingMaintenance(null);
    setEditingMaintenance(maintenance);
    setEditDate(toDateTimeLocalValue(maintenance.date));
    setEditOdometerKm(String(maintenance.odometerKm ?? ""));
    setEditEndKm(
      maintenance.endKm != null ? String(maintenance.endKm) : ""
    );
    setEditCost(String(maintenance.cost ?? ""));
    setEditType(maintenance.type ?? "");
    setEditWorkshopName(maintenance.workshopName ?? "");
    setEditNotes(maintenance.notes ?? "");
    setEditReason("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeEditMaintenance() {
    setEditingMaintenance(null);
    setEditDate("");
    setEditOdometerKm("");
    setEditEndKm("");
    setEditCost("");
    setEditType("");
    setEditWorkshopName("");
    setEditNotes("");
    setEditReason("");
    setErrorMsg("");
  }

  function openCompleteMaintenance(maintenance: Maintenance) {
    setFormOpen(false);
    setEditingMaintenance(null);
    setDeletingMaintenance(null);
    setCompletingMaintenance(maintenance);
    setCompleteEndKmInput(String(maintenance.odometerKm ?? ""));
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeCompleteMaintenance() {
    setCompletingMaintenance(null);
    setCompleteEndKmInput("");
    setErrorMsg("");
  }

  function openDeleteMaintenance(maintenance: Maintenance) {
    setFormOpen(false);
    setEditingMaintenance(null);
    setCompletingMaintenance(null);
    setDeletingMaintenance(maintenance);
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeDeleteMaintenance() {
    setDeletingMaintenance(null);
    setErrorMsg("");
  }

  // Sugere KM atual do veículo
  function handleChangeVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((veh) => veh.id === id);
    if (v && v.currentKm != null) {
      setOdometerKm(String(v.currentKm));
    } else {
      setOdometerKm("");
    }
  }

  async function handleCriarManutencao(e: React.FormEvent) {
    e.preventDefault();
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!vehicleId || !odometerKm || !cost || !type) {
        setErrorMsg("Selecione veículo e preencha tipo, km e custo.");
        return;
      }

      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) {
        setErrorMsg("Veículo inválido.");
        return;
      }

      // Permissão: precisa ser admin ou responsável pelo veículo
      if (!userCanUseVehicle(vehicle)) {
        setErrorMsg(
          "Você não tem permissão para registrar manutenção para este veículo."
        );
        return;
      }

      if (vehicle.status === "em_rota") {
        setErrorMsg(
          "Este veiculo esta em rota. Finalize a rota antes de abrir manutencao."
        );
        return;
      }

      if (vehicle.status === "manutencao") {
        setErrorMsg("Este veiculo ja esta em manutencao.");
        return;
      }

      const odom = Number(odometerKm.replace(",", "."));
      const valor = Number(cost.replace(",", "."));

      if (vehicle.currentKm != null && odom < vehicle.currentKm) {
        setErrorMsg(
          `O KM informado nao pode ser menor que ${vehicle.currentKm} km.`
        );
        return;
      }

      if (isNaN(odom) || odom <= 0) {
        setErrorMsg("KM inválido.");
        return;
      }
      if (isNaN(valor) || valor <= 0) {
        setErrorMsg("Custo inválido.");
        return;
      }

      if (!user) {
        setErrorMsg("Sessão expirada. Faça login novamente.");
        router.replace("/login");
        return;
      }

      const nowISO = date || new Date().toISOString();

      const newDoc = doc(collection(db, "maintenances"));
      const batch = writeBatch(db);

      batch.set(newDoc, {
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        vehicleModel: vehicle.model,
        storeId: vehicle.storeId,
        responsibleUserId: user.id,
        responsibleUserName: user.name,
        date: nowISO,
        odometerKm: odom,
        cost: valor,
        type,
        workshopName: workshopName || null,
        notes: notes || null,
        status: "em_andamento" as MaintenanceStatus,
        endKm: null,
        endDate: null,
      });

      // Veículo entra em manutenção
      batch.update(doc(db, "vehicles", vehicle.id), {
        status: "manutencao",
        currentKm: odom,
      });

      await batch.commit();

      // Atualiza estados locais
      setMaintenances((prev) => [
        {
          id: newDoc.id,
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
          vehicleModel: vehicle.model,
          storeId: vehicle.storeId,
          responsibleUserId: user.id,
          responsibleUserName: user.name,
          date: nowISO,
          odometerKm: odom,
          cost: valor,
          type,
          workshopName: workshopName || null,
          notes: notes || null,
          status: "em_andamento",
          endKm: null,
          endDate: null,
        },
        ...prev,
      ]);

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id
            ? { ...v, currentKm: odom, status: "manutencao" }
            : v
        )
      );

      setFormOpen(false);
      resetForm();
      setSuccessMsg("Manutencao registrada com sucesso.");
    } catch (error) {
      console.error("Erro ao registrar manutenção:", error);
      setErrorMsg("Erro ao registrar manutenção. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCompleteMaintenance() {
    if (!completingMaintenance || !user) return;

    try {
      const endKm = Number(completeEndKmInput.replace(",", "."));
      if (Number.isNaN(endKm) || endKm < completingMaintenance.odometerKm) {
        setErrorMsg("KM final invalido. Ele deve ser maior ou igual ao KM de entrada.");
        return;
      }

      setSaving(true);
      setErrorMsg("");
      const nowISO = new Date().toISOString();
      const batch = writeBatch(db);

      batch.update(doc(db, "maintenances", completingMaintenance.id), {
        status: "concluida",
        endKm,
        endDate: nowISO,
      });

      batch.update(doc(db, "vehicles", completingMaintenance.vehicleId), {
        status: "disponivel",
        currentKm: endKm,
      });

      await batch.commit();

      setMaintenances((prev) =>
        prev.map((item) =>
          item.id === completingMaintenance.id
            ? { ...item, status: "concluida", endKm, endDate: nowISO }
            : item
        )
      );

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === completingMaintenance.vehicleId
            ? { ...v, status: "disponivel", currentKm: endKm }
            : v
        )
      );

      closeCompleteMaintenance();
      setSuccessMsg("Manutencao concluida com sucesso.");
    } catch (error) {
      console.error("Erro ao concluir manutenção:", error);
      setErrorMsg("Erro ao concluir manutencao. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteMaintenance() {
    if (!isAdmin || !deletingMaintenance) return;

    try {
      setSaving(true);
      setErrorMsg("");
      const batch = writeBatch(db);
      batch.delete(doc(db, "maintenances", deletingMaintenance.id));

      const hasAnotherOpenMaintenance = maintenances.some(
        (item) =>
          item.id !== deletingMaintenance.id &&
          item.vehicleId === deletingMaintenance.vehicleId &&
          item.status === "em_andamento"
      );

      if (deletingMaintenance.status === "em_andamento" && !hasAnotherOpenMaintenance) {
        batch.update(doc(db, "vehicles", deletingMaintenance.vehicleId), {
          status: "disponivel",
        });

        setVehicles((prev) =>
          prev.map((vehicle) =>
            vehicle.id === deletingMaintenance.vehicleId
              ? { ...vehicle, status: "disponivel" }
              : vehicle
          )
        );
      }

      await batch.commit();
      setMaintenances((prev) =>
        prev.filter((item) => item.id !== deletingMaintenance.id)
      );
      closeDeleteMaintenance();
      setSuccessMsg("Manutencao excluida com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir manutenção:", error);
      setErrorMsg("Erro ao excluir manutencao. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSalvarEdicaoMaintenance(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    if (!editingMaintenance || !user || !isAdmin) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      if (!editOdometerKm || !editCost || !editType) {
        setErrorMsg("Preencha km, tipo e custo para salvar a edicao.");
        return;
      }

      const nextOdometer = Number(editOdometerKm.replace(",", "."));
      const nextCost = Number(editCost.replace(",", "."));
      const nextEndKm = editEndKm ? Number(editEndKm.replace(",", ".")) : null;

      if (Number.isNaN(nextOdometer) || nextOdometer <= 0) {
        setErrorMsg("KM de entrada invalido.");
        return;
      }
      if (Number.isNaN(nextCost) || nextCost <= 0) {
        setErrorMsg("Custo invalido.");
        return;
      }
      if (
        editingMaintenance.status === "concluida" &&
        (nextEndKm == null ||
          Number.isNaN(nextEndKm) ||
          nextEndKm < nextOdometer)
      ) {
        setErrorMsg("KM final invalido para uma manutencao concluida.");
        return;
      }

      const updatedAt = new Date().toISOString();
      const nextDate = editDate || toDateTimeLocalValue(editingMaintenance.date);
      const batch = writeBatch(db);

      batch.update(doc(db, "maintenances", editingMaintenance.id), {
        date: nextDate,
        odometerKm: nextOdometer,
        cost: nextCost,
        type: editType,
        workshopName: editWorkshopName || null,
        notes: editNotes || null,
        endKm: editingMaintenance.status === "concluida" ? nextEndKm : null,
        updatedAt,
        updatedById: user.id,
        updatedByName: user.name,
        editReason: editReason || null,
      });

      const vehicleUpdate: Record<string, unknown> = {};
      const vehicle = vehicles.find((item) => item.id === editingMaintenance.vehicleId);
      if (editingMaintenance.status === "concluida" && nextEndKm != null) {
        if ((vehicle?.currentKm ?? 0) < nextEndKm) {
          vehicleUpdate.currentKm = nextEndKm;
        }
      } else if ((vehicle?.currentKm ?? 0) < nextOdometer) {
        vehicleUpdate.currentKm = nextOdometer;
      }

      if (Object.keys(vehicleUpdate).length > 0) {
        batch.update(doc(db, "vehicles", editingMaintenance.vehicleId), vehicleUpdate);
      }

      await batch.commit();

      setMaintenances((prev) =>
        prev
          .map((item) =>
            item.id === editingMaintenance.id
              ? {
                  ...item,
                  date: nextDate,
                  odometerKm: nextOdometer,
                  cost: nextCost,
                  type: editType,
                  workshopName: editWorkshopName || null,
                  notes: editNotes || null,
                  endKm: editingMaintenance.status === "concluida" ? nextEndKm : null,
                  updatedAt,
                  updatedById: user.id,
                  updatedByName: user.name,
                  editReason: editReason || null,
                }
              : item
          )
          .sort(
            (a, b) =>
              new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
          )
      );

      if (Object.keys(vehicleUpdate).length > 0) {
        setVehicles((prev) =>
          prev.map((item) => {
            if (item.id !== editingMaintenance.vehicleId) return item;
            return { ...item, ...vehicleUpdate };
          })
        );
      }

      closeEditMaintenance();
      setSuccessMsg("Manutencao atualizada com sucesso.");
    } catch (error) {
      console.error("Erro ao editar manutenção:", error);
      setErrorMsg("Erro ao atualizar manutencao. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const vehicleFilterOptions = useMemo(
    () =>
      vehicles
        .map((vehicle) => ({
          id: vehicle.id,
          label: `${vehicle.plate} · ${vehicle.model}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [vehicles]
  );

  const storeFilterOptions = useMemo(() => {
    const stores = new Set<string>();
    maintenances.forEach((maintenance) => {
      if (maintenance.storeId) stores.add(maintenance.storeId);
    });
    return Array.from(stores).sort();
  }, [maintenances]);

  const responsibleFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    maintenances.forEach((maintenance) => {
      if (maintenance.responsibleUserId) {
        map.set(maintenance.responsibleUserId, maintenance.responsibleUserName);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [maintenances]);

  // ====== FILTRO POR PERÃODO E CONTEXTO ======
  const filteredMaintenances = useMemo(() => {
    const parseLocalDate = (value: string) => {
      const [yyyy, mm, dd] = value.split("-").map(Number);
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    };

    const query = searchFilter.trim().toLowerCase();

    return maintenances.filter((m) => {
      if (!m.date) return false;

      const d = new Date(m.date);

      if (startFilter) {
        const start = parseLocalDate(startFilter);
        if (d < start) return false;
      }

      if (endFilter) {
        const end = parseLocalDate(endFilter);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }

      if (vehicleFilter !== "todos" && m.vehicleId !== vehicleFilter) {
        return false;
      }

      if (storeFilter !== "todas" && (m.storeId || "") !== storeFilter) {
        return false;
      }

      if (
        responsibleFilter !== "todos" &&
        (m.responsibleUserId || "") !== responsibleFilter
      ) {
        return false;
      }

      if (query) {
        const haystack = [
          m.vehiclePlate,
          m.vehicleModel,
          m.storeId,
          m.responsibleUserName,
          m.type,
          m.workshopName || "",
          m.notes || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    maintenances,
    startFilter,
    endFilter,
    vehicleFilter,
    storeFilter,
    responsibleFilter,
    searchFilter,
  ]);

  const filteredEmAndamento = filteredMaintenances.filter(
    (m) => m.status === "em_andamento"
  );
  const filteredConcluidas = filteredMaintenances.filter(
    (m) => m.status === "concluida"
  );

  const totalGasto = useMemo(
    () => filteredMaintenances.reduce((acc, m) => acc + (m.cost || 0), 0),
    [filteredMaintenances]
  );

  function handleClearFilter() {
    setStartFilter("");
    setEndFilter("");
    setSearchFilter("");
    setVehicleFilter("todos");
    setStoreFilter("todas");
    setResponsibleFilter("todos");
  }

  function formatFilterDateLabel(dateStr: string) {
    if (!dateStr) return "";
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const d = new Date(yyyy, (mm || 1) - 1, dd || 1);
    return d.toLocaleDateString("pt-BR");
  }

  return (
    <div className="app-page">
      {/* Cabeçalho */}
      <PageHeader
        eyebrow="Disponibilidade da frota"
        title="Manutencoes"
        description="Acompanhe ordens abertas, custos acumulados e disponibilidade dos veiculos com uma leitura mais executiva."
        icon={WrenchIcon}
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              {filteredMaintenances.length} registros
            </span>
            <span className="app-chip border-sky-300/20 bg-sky-400/10 text-sky-100">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              {filteredEmAndamento.length} em andamento
            </span>
          </>
        }
        actions={
          <Button
            onClick={() => {
              closeEditMaintenance();
              closeCompleteMaintenance();
              closeDeleteMaintenance();
              resetForm();
              setFormOpen(true);
            }}
          >
            + Nova manutencao
          </Button>
        }
      />

      <div className="hidden items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Manutenções
          </h1>
          <p className="text-sm text-gray-400">
            Registre manutenções, acompanhe veículos em manutenção e custos por
            veículo / loja.
          </p>
        </div>

        <Button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          + Nova manutenção
        </Button>
      </div>

      {/* Resumo + Filtro */}
      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}
      {successMsg ? <StatusBanner tone="success">{successMsg}</StatusBanner> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registros"
          value={String(filteredMaintenances.length)}
          helper="Manutencoes no periodo selecionado."
          icon={ReceiptText}
        />
        <MetricCard
          label="Em andamento"
          value={String(filteredEmAndamento.length)}
          helper="Ordens ainda abertas."
          icon={AlertTriangle}
          accent="blue"
        />
        <MetricCard
          label="Concluidas"
          value={String(filteredConcluidas.length)}
          helper="Servicos ja encerrados."
          icon={WrenchIcon}
          accent="green"
        />
        <MetricCard
          label="Total"
          value={`R$ ${totalGasto.toFixed(2)}`}
          helper="Custo acumulado no periodo."
          icon={Gauge}
          accent="yellow"
        />
      </div>

      <Card className="app-panel gap-0 overflow-hidden py-0">
        <div className="border-b border-border px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/15 dark:bg-yellow-300/10">
                <Filter className="h-5 w-5 text-yellow-600 dark:text-yellow-200" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Filtros e acompanhamento
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Busque manutencoes por veiculo, loja, responsavel, oficina, tipo e periodo.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="app-chip">
                <span className="h-2 w-2 rounded-full bg-yellow-300" />
                {filteredMaintenances.length} exibidas
              </span>
              <span className="app-chip border-sky-300/20 bg-sky-400/10 text-sky-100">
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                {filteredEmAndamento.length} abertas
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4 md:p-5">
          <div className="grid gap-3 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar por placa, tipo, oficina ou observacao"
                className="pr-9"
              />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            <select
              className="app-select"
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
            >
              <option value="todos">Todos os veiculos</option>
              {vehicleFilterOptions.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>

            <select
              className="app-select"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="todas">Todas as lojas</option>
              {storeFilterOptions.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>

            <select
              className="app-select"
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
            >
              <option value="todos">Todos os responsaveis</option>
              {responsibleFilterOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                De
              </label>
              <Input
                type="date"
                value={startFilter}
                onChange={(e) => setStartFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                Ate
              </label>
              <Input
                type="date"
                value={endFilter}
                onChange={(e) => setEndFilter(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={handleClearFilter}>
                Limpar filtros
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-yellow-300/30 bg-yellow-400/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
              {filteredMaintenances.length} manutencoes no recorte atual
            </span>
            <span className="rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
              {filteredEmAndamento.length} em andamento
            </span>
            <span className="rounded-full border border-green-300/30 bg-green-500/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
              {filteredConcluidas.length} concluidas
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
              Total: R$ {totalGasto.toFixed(2)}
            </span>
            {startFilter ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
                Periodo: {formatFilterDateLabel(startFilter)}
                {endFilter ? ` ate ${formatFilterDateLabel(endFilter)}` : ""}
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      {false && (
      <Card className="app-panel-muted p-4 md:p-5">
        <div className="flex flex-wrap gap-3 text-xs text-gray-300 mb-2">
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Registros no período:{" "}
            <span className="font-semibold text-yellow-400">
              {filteredMaintenances.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Em andamento:{" "}
            <span className="font-semibold text-sky-400">
              {filteredEmAndamento.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Concluídas:{" "}
            <span className="font-semibold text-green-400">
              {filteredConcluidas.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Total em manutenções:{" "}
            <span className="font-semibold text-yellow-300">
              R$ {totalGasto.toFixed(2)}
            </span>
          </span>
        </div>

        {/* Filtro de período */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 mt-1">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">
            Filtro de período:
          </span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-400">De</span>
              <Input
                type="date"
                className="h-8 bg-neutral-950 border-neutral-700 text-gray-100 text-xs"
                value={startFilter}
                onChange={(e) => setStartFilter(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-400">At?</span>
              <Input
                type="date"
                className="h-8 bg-neutral-950 border-neutral-700 text-gray-100 text-xs"
                value={endFilter}
                onChange={(e) => setEndFilter(e.target.value)}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-yellow-500 text-yellow-300 hover:bg-yellow-500 hover:text-black text-[11px] font-semibold"
              onClick={handleClearFilter}
            >
              Limpar filtro
            </Button>
          </div>

          {startFilter && (
            <span className="text-[11px] text-gray-400">
              Período atual:{" "}
              <span className="text-gray-200">
                {formatFilterDateLabel(startFilter)}{" "}
                {endFilter && "at? " + formatFilterDateLabel(endFilter)}
              </span>
            </span>
          )}
        </div>
      </Card>

      )}

      {/* Formulário */}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeNewMaintenanceDialog();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                <WrenchIcon className="h-5 w-5 text-blue-600 dark:text-yellow-200" />
                Nova manutencao
              </DialogTitle>
              <DialogDescription>
                Abra uma ordem de manutencao com o mesmo fluxo direto e organizado das outras abas.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCriarManutencao} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Veiculo
                    </label>
                    <select
                      className="app-select"
                      value={vehicleId}
                      onChange={(e) => handleChangeVehicle(e.target.value)}
                    >
                      <option value="">Selecione um veiculo...</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plate} · {v.model} ({v.storeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Data e hora
                    </label>
                    <Input
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      KM na entrada
                    </label>
                    <Input
                      placeholder="Ex: 45230"
                      value={odometerKm}
                      onChange={(e) => setOdometerKm(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Tipo de manutencao
                    </label>
                    <Input
                      placeholder="Ex: Revisao, freios, troca de oleo"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Custo total (R$)
                    </label>
                    <Input
                      placeholder="Ex: 350,00"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Oficina / local
                    </label>
                    <Input
                      placeholder="Nome da oficina"
                      value={workshopName}
                      onChange={(e) => setWorkshopName(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-3">
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Observacoes
                    </label>
                    <textarea
                      className="app-textarea min-h-[110px]"
                      placeholder="Detalhes da manutencao, pecas trocadas, prazo ou contexto da ordem."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {errorMsg ? (
                  <p className="text-sm font-medium text-red-500 dark:text-red-300">
                    {errorMsg}
                  </p>
                ) : null}
              </div>

              <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
                <Button type="button" variant="destructive" onClick={closeNewMaintenanceDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar manutencao"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!completingMaintenance}
        onOpenChange={(open) => {
          if (!open) closeCompleteMaintenance();
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-300" />
              Concluir manutencao
            </DialogTitle>
            <DialogDescription>
              Finalize a ordem informando o KM de saida para liberar o veiculo.
            </DialogDescription>
          </DialogHeader>

          {completingMaintenance ? (
            <div className="space-y-4">
              <div className="app-panel-muted p-4">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {completingMaintenance.vehiclePlate} · {completingMaintenance.vehicleModel}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Entrada em {completingMaintenance.odometerKm} km · {completingMaintenance.type}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  KM final
                </label>
                <Input
                  value={completeEndKmInput}
                  onChange={(e) => setCompleteEndKmInput(e.target.value)}
                  placeholder="Informe o KM de saida"
                />
              </div>

              {errorMsg ? (
                <p className="text-sm font-medium text-red-500 dark:text-red-300">
                  {errorMsg}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="destructive" onClick={closeCompleteMaintenance}>
                  Cancelar
                </Button>
                <Button type="button" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={confirmCompleteMaintenance} disabled={saving}>
                  {saving ? "Concluindo..." : "Concluir"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingMaintenance}
        onOpenChange={(open) => {
          if (!open) closeDeleteMaintenance();
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Trash2 className="h-5 w-5 text-red-500 dark:text-red-300" />
              Excluir manutencao
            </DialogTitle>
            <DialogDescription>
              Esta acao remove a ordem do historico e pode liberar o veiculo se ela ainda estiver em andamento.
            </DialogDescription>
          </DialogHeader>

          {deletingMaintenance ? (
            <div className="space-y-4">
              <div className="app-panel-muted p-4">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {deletingMaintenance.vehiclePlate} · {deletingMaintenance.vehicleModel}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {deletingMaintenance.type} · R$ {deletingMaintenance.cost.toFixed(2)}
                </p>
              </div>

              {errorMsg ? (
                <p className="text-sm font-medium text-red-500 dark:text-red-300">
                  {errorMsg}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="destructive" onClick={closeDeleteMaintenance}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={confirmDeleteMaintenance}
                  disabled={saving}
                >
                  {saving ? "Excluindo..." : "Excluir"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingMaintenance}
        onOpenChange={(open) => {
          if (!open) closeEditMaintenance();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                <PencilLine className="h-5 w-5 text-blue-600 dark:text-yellow-200" />
                Editar manutencao
              </DialogTitle>
              <DialogDescription>
                Ajuste a ordem sem perder o historico da manutencao.
              </DialogDescription>
            </DialogHeader>

            {editingMaintenance ? (
              <form onSubmit={handleSalvarEdicaoMaintenance} className="flex min-h-0 flex-1 flex-col">
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Veiculo
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {editingMaintenance.vehiclePlate} · {editingMaintenance.vehicleModel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {editingMaintenance.storeId || "Loja nao informada"}
                      </p>
                    </div>

                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Status
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {editingMaintenance.status === "em_andamento" ? "Em andamento" : "Concluida"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Responsavel: {editingMaintenance.responsibleUserName}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Data e hora
                      </label>
                      <Input
                        type="datetime-local"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        KM entrada
                      </label>
                      <Input
                        value={editOdometerKm}
                        onChange={(e) => setEditOdometerKm(e.target.value)}
                        placeholder="KM na entrada"
                      />
                    </div>

                    {editingMaintenance.status === "concluida" ? (
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                          KM final
                        </label>
                        <Input
                          value={editEndKm}
                          onChange={(e) => setEditEndKm(e.target.value)}
                          placeholder="KM na saida"
                        />
                      </div>
                    ) : null}

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Tipo
                      </label>
                      <Input
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                        placeholder="Tipo de manutencao"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Custo total
                      </label>
                      <Input
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Oficina / local
                      </label>
                      <Input
                        value={editWorkshopName}
                        onChange={(e) => setEditWorkshopName(e.target.value)}
                        placeholder="Nome da oficina"
                      />
                    </div>

                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Observacoes
                      </label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Detalhes da manutencao, pecas trocadas ou contexto da ordem."
                        className="app-textarea min-h-[110px]"
                      />
                    </div>

                    <div className="md:col-span-2 xl:col-span-3">
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Motivo da alteracao
                      </label>
                      <textarea
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Opcional: informe o motivo da edicao para auditoria interna."
                        className="app-textarea min-h-[90px]"
                      />
                    </div>
                  </div>

                  {editingMaintenance.updatedAt ? (
                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Ultima edicao
                      </p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {editingMaintenance.updatedByName || "Admin"} em {new Date(editingMaintenance.updatedAt).toLocaleString("pt-BR")}
                      </p>
                      {editingMaintenance.editReason ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Motivo anterior: {editingMaintenance.editReason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {errorMsg ? (
                    <p className="text-sm font-medium text-red-500 dark:text-red-300">
                      {errorMsg}
                    </p>
                  ) : null}
                </div>

                <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
                  <Button type="button" variant="destructive" onClick={closeEditMaintenance}>
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

      {false && formOpen && (
        <Card className="app-panel p-4 md:p-5">
          <h2 className="text-lg font-semibold text-yellow-400 mb-3">
            Registrar nova manutenção
          </h2>

          <form onSubmit={handleCriarManutencao} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Veículo
                </label>
                <select
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                  value={vehicleId}
                  onChange={(e) => handleChangeVehicle(e.target.value)}
                >
                  <option value="">Selecione um veículo...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.model} ({v.storeId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Data (opcional)
                </label>
                <Input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  KM na entrada
                </label>
                <Input
                  placeholder="Ex: 45230"
                  value={odometerKm}
                  onChange={(e) => setOdometerKm(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Tipo de manutenção
                </label>
                <Input
                  placeholder="Ex: Troca de ?leo, revisão, freios..."
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Custo total (R$)
                </label>
                <Input
                  placeholder="Ex: 350,00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Oficina / Local (opcional)
                </label>
                <Input
                  placeholder="Nome da oficina"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-xs text-gray-400 mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100 min-h-[80px] placeholder:text-gray-500"
                  placeholder="Detalhes da manutenção, peças trocadas, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-sm text-red-400 font-medium mt-1">
                {errorMsg}
              </p>
            )}
            {successMsg && (
              <p className="text-sm text-green-400 font-medium mt-1">
                {successMsg}
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
              >
                {saving ? "Salvando..." : "Salvar manutenção"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-neutral-700 text-gray-300 hover:bg-neutral-800 text-sm"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista Em andamento */}
      <Card className="app-panel p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-100">
            Em manutenção
          </h2>
          <p className="text-xs text-gray-400">
            Total no período:{" "}
            <span className="font-semibold text-yellow-400">
              R$ {totalGasto.toFixed(2)}
            </span>
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : filteredEmAndamento.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma manutenção em andamento no período selecionado.
          </p>
        ) : (
          <>
            <div className="mb-4 space-y-3 md:hidden">
              {filteredEmAndamento.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        <span className="font-mono">{m.vehiclePlate}</span> · {m.vehicleModel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-300" />
                          {m.storeId}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                          {m.responsibleUserName}
                        </span>
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-200">
                      R$ {m.cost.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Data</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.date ? new Date(m.date).toLocaleString("pt-BR") : "-"}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">KM entrada</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.odometerKm} km
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Tipo</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.type}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Oficina</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.workshopName ? m.workshopName : "-"}
                      </p>
                    </div>
                  </div>

                  {m.notes ? (
                    <div className="mt-3 rounded-2xl border border-border bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                      {m.notes}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionIconButton
                      action="complete"
                      onClick={() => openCompleteMaintenance(m)}
                    />
                    {isAdmin ? (
                      <>
                        <ActionIconButton
                          action="edit"
                          onClick={() => openEditMaintenance(m)}
                        />
                        <ActionIconButton
                          action="delete"
                          onClick={() => openDeleteMaintenance(m)}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4 hidden overflow-x-auto md:block">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 px-2">Veículo</th>
                  <th className="py-2 px-2">KM entrada</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">Custo</th>
                  <th className="py-2 px-2">Oficina</th>
                  <th className="py-2 px-2">Responsável</th>
                  <th className="py-2 pl-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmAndamento.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 text-gray-200">
                      {m.date
                        ? new Date(m.date).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="py-2 px-2 font-mono text-gray-100">
                      {m.vehiclePlate} · {m.vehicleModel}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {m.odometerKm} km
                    </td>
                    <td className="py-2 px-2 text-gray-200">{m.type}</td>
                    <td className="py-2 px-2 text-yellow-300">
                      R$ {m.cost.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {m.workshopName ? m.workshopName : "-"}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {m.responsibleUserName}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionIconButton
                          action="complete"
                          onClick={() => openCompleteMaintenance(m)}
                        />
                        {isAdmin && (
                          <>
                            <ActionIconButton
                              action="edit"
                              onClick={() => openEditMaintenance(m)}
                            />
                            <ActionIconButton
                              action="delete"
                              onClick={() => openDeleteMaintenance(m)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}

        {/* Lista Concluídas */}
        <h2 className="text-lg font-semibold mb-3 text-gray-100">
          Concluídas
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : filteredConcluidas.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma manutenção concluída no período selecionado.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredConcluidas.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-border bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        <span className="font-mono">{m.vehiclePlate}</span> · {m.vehicleModel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-300" />
                          {m.storeId}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                          {m.responsibleUserName}
                        </span>
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-200">
                      R$ {m.cost.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Data</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.date ? new Date(m.date).toLocaleString("pt-BR") : "-"}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">KM</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.odometerKm} → {m.endKm ?? "-"} km
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Tipo</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.type}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Oficina</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {m.workshopName ? m.workshopName : "-"}
                      </p>
                    </div>
                  </div>

                  {m.notes ? (
                    <div className="mt-3 rounded-2xl border border-border bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                      {m.notes}
                    </div>
                  ) : null}

                  {isAdmin ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionIconButton
                        action="edit"
                        onClick={() => openEditMaintenance(m)}
                      />
                      <ActionIconButton
                        action="delete"
                        onClick={() => openDeleteMaintenance(m)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 px-2">Veículo</th>
                  <th className="py-2 px-2">KM entrada → saída</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">Custo</th>
                  <th className="py-2 px-2">Oficina</th>
                  <th className="py-2 px-2">Responsável</th>
                  {isAdmin && (
                    <th className="py-2 pl-2 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredConcluidas.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 text-gray-200">
                      {m.date
                        ? new Date(m.date).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="py-2 px-2 font-mono text-gray-100">
                      {m.vehiclePlate} · {m.vehicleModel}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {m.odometerKm} → {m.endKm ?? "-"} km
                    </td>
                    <td className="py-2 px-2 text-gray-200">{m.type}</td>
                    <td className="py-2 px-2 text-yellow-300">
                      R$ {m.cost.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {m.workshopName ? m.workshopName : "-"}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {m.responsibleUserName}
                    </td>
                    {isAdmin && (
                      <td className="py-2 pl-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionIconButton
                            action="edit"
                            onClick={() => openEditMaintenance(m)}
                          />
                          <ActionIconButton
                            action="delete"
                            onClick={() => openDeleteMaintenance(m)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}

        {errorMsg && (
          <p className="text-sm text-red-400 font-medium mt-3">
            {errorMsg}
          </p>
        )}
      </Card>
    </div>
  );
}


