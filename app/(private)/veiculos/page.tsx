"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
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
  Building2,
  Filter,
  Gauge,
  PencilLine,
  Route as RouteIcon,
  Search,
  Trash2,
  Truck,
  UserCircle2,
  Wrench,
} from "lucide-react";

type VehicleStatus = "disponivel" | "em_rota" | "manutencao";
type StatusFilter = VehicleStatus | "todos";

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
  responsibleUserName: string;
  responsibleUserIds: string[];
  responsibleUsers: VehicleResponsibleUser[];
  status: VehicleStatus;
  currentKm?: number;
  active: boolean;
}

interface SimpleUser {
  id: string;
  name: string;
  storeId: string;
}

function sortVehicles(list: Vehicle[]) {
  return [...list].sort((a, b) => {
    const storeCompare = (a.storeId || "").localeCompare(b.storeId || "");
    if (storeCompare !== 0) return storeCompare;
    return (a.plate || "").localeCompare(b.plate || "");
  });
}

function formatKm(value?: number) {
  return value != null ? `${value} km` : "-";
}

function getStatusBadgeClasses(status: VehicleStatus) {
  if (status === "disponivel") {
    return "border-emerald-500/35 bg-emerald-500/12 text-emerald-300";
  }

  if (status === "em_rota") {
    return "border-sky-500/35 bg-sky-500/12 text-sky-300";
  }

  return "border-yellow-500/35 bg-yellow-500/12 text-yellow-300";
}

function getStatusLabel(status: VehicleStatus) {
  if (status === "disponivel") return "Disponivel";
  if (status === "em_rota") return "Em rota";
  return "Manutencao";
}

export default function VeiculosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [storeId, setStoreId] = useState("");
  const [responsibleIds, setResponsibleIds] = useState<string[]>([""]);
  const [currentKm, setCurrentKm] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [storeFilter, setStoreFilter] = useState("todas");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [router, user]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        setLoading(true);
        setErrorMsg("");

        if (user.role === "admin") {
          const usersSnap = await getDocs(collection(db, "users"));
          const nextUsers: SimpleUser[] = usersSnap.docs.map((snapshot) => {
            const data = snapshot.data() as any;

            return {
              id: snapshot.id,
              name: data.name,
              storeId: data.storeId,
            };
          });

          setUsers(nextUsers);
        } else {
          setUsers([]);
        }

        const vehiclesSnap =
          user.role === "admin"
            ? await getDocs(collection(db, "vehicles"))
            : await getDocs(
                query(
                  collection(db, "vehicles"),
                  where("responsibleUserIds", "array-contains", user.id ?? "")
                )
              );

        const nextVehicles = vehiclesSnap.docs.map((snapshot) => {
          const data = snapshot.data() as any;

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

          const responsibleUserIdsFromDoc: string[] =
            Array.isArray(data.responsibleUserIds) && data.responsibleUserIds.length
              ? data.responsibleUserIds
              : responsibleUsersFromDoc.map((responsible) => responsible.id);

          return {
            id: snapshot.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            responsibleUserName:
              data.responsibleUserName || responsibleUsersFromDoc[0]?.name || "",
            responsibleUserIds: responsibleUserIdsFromDoc,
            responsibleUsers: responsibleUsersFromDoc,
            status: data.status ?? "disponivel",
            currentKm: data.currentKm,
            active: data.active ?? true,
          } satisfies Vehicle;
        });

        setVehicles(sortVehicles(nextVehicles));
      } catch (error) {
        console.error("Erro ao carregar veiculos:", error);
        setErrorMsg("Erro ao carregar veiculos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  function resetFormFields() {
    setPlate("");
    setModel("");
    setStoreId(user?.storeId ?? "");
    setResponsibleIds([""]);
    setCurrentKm("");
    setEditingVehicle(null);
  }

  function clearFeedback() {
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeVehicleDialog() {
    setFormOpen(false);
    setErrorMsg("");
    resetFormFields();
  }

  function openNewVehicleDialog() {
    clearFeedback();
    resetFormFields();
    setStoreId(user?.storeId ?? "");
    setFormOpen(true);
  }

  function openEditVehicleDialog(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setPlate(vehicle.plate);
    setModel(vehicle.model);
    setStoreId(vehicle.storeId);
    setResponsibleIds(
      vehicle.responsibleUserIds.length ? vehicle.responsibleUserIds : [""]
    );
    setCurrentKm(vehicle.currentKm != null ? String(vehicle.currentKm) : "");
    setErrorMsg("");
    setSuccessMsg("");
    setFormOpen(true);
  }

  function openDeleteVehicleDialog(vehicle: Vehicle) {
    setDeletingVehicle(vehicle);
    setErrorMsg("");
  }

  function closeDeleteVehicleDialog() {
    setDeletingVehicle(null);
  }

  function handleVerDetalhes(vehicle: Vehicle) {
    router.push(`/veiculos/${vehicle.id}`);
  }

  function addResponsibleField() {
    setResponsibleIds((previous) => [...previous, ""]);
  }

  function updateResponsibleField(index: number, value: string) {
    setResponsibleIds((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }

  function removeResponsibleField(index: number) {
    setResponsibleIds((previous) => previous.filter((_, item) => item !== index));
  }

  function getSelectedUsersFromForm() {
    const uniqueIds = Array.from(
      new Set(responsibleIds.filter((id) => id.trim() !== ""))
    );

    return uniqueIds
      .map((id) => users.find((userOption) => userOption.id === id) || null)
      .filter((userOption): userOption is SimpleUser => userOption !== null);
  }

  function parseCurrentKmInput(value: string) {
    if (value.trim() === "") {
      return { hasValue: false, value: undefined as number | undefined };
    }

    const parsed = Number(value.replace(",", "."));

    return {
      hasValue: true,
      value: Number.isFinite(parsed) ? parsed : undefined,
    };
  }

  async function handleCreateVehicle() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!plate.trim() || !model.trim() || !storeId.trim()) {
        setErrorMsg("Preencha placa, modelo e loja.");
        return;
      }

      const normalizedPlate = plate.toUpperCase().trim();
      const hasDuplicatePlate = vehicles.some(
        (vehicle) => vehicle.plate.toUpperCase() === normalizedPlate
      );

      if (hasDuplicatePlate) {
        setErrorMsg("Ja existe um veiculo cadastrado com essa placa.");
        return;
      }

      const selectedUsers = getSelectedUsersFromForm();
      if (!selectedUsers.length) {
        setErrorMsg("Selecione pelo menos um responsavel pelo veiculo.");
        return;
      }

      const parsedKm = parseCurrentKmInput(currentKm);
      if (parsedKm.hasValue && parsedKm.value == null) {
        setErrorMsg("Informe um KM valido.");
        return;
      }

      if ((parsedKm.value ?? 0) < 0) {
        setErrorMsg("O KM nao pode ser negativo.");
        return;
      }

      const responsibleUserIds = selectedUsers.map((item) => item.id);
      const responsibleUsersForDoc = selectedUsers.map((item) => ({
        id: item.id,
        name: item.name,
        storeId: item.storeId,
      }));
      const primaryResponsible = selectedUsers[0];

      const docRef = await addDoc(collection(db, "vehicles"), {
        plate: normalizedPlate,
        model: model.trim(),
        storeId: storeId.trim(),
        responsibleUserIds,
        responsibleUsers: responsibleUsersForDoc,
        responsibleUserId: primaryResponsible.id,
        responsibleUserName: primaryResponsible.name,
        status: "disponivel" as VehicleStatus,
        currentKm: parsedKm.value,
        active: true,
      });

      const createdVehicle: Vehicle = {
        id: docRef.id,
        plate: normalizedPlate,
        model: model.trim(),
        storeId: storeId.trim(),
        responsibleUserIds,
        responsibleUsers: responsibleUsersForDoc,
        responsibleUserName: primaryResponsible.name,
        status: "disponivel",
        currentKm: parsedKm.value,
        active: true,
      };

      setVehicles((previous) => sortVehicles([...previous, createdVehicle]));
      setFormOpen(false);
      resetFormFields();
      setSuccessMsg("Veiculo cadastrado com sucesso.");
    } catch (error) {
      console.error("Erro ao cadastrar veiculo:", error);
      setErrorMsg("Erro ao cadastrar veiculo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateVehicle() {
    if (!editingVehicle) return;

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!plate.trim() || !model.trim() || !storeId.trim()) {
        setErrorMsg("Preencha placa, modelo e loja.");
        return;
      }

      const normalizedPlate = plate.toUpperCase().trim();
      const hasDuplicatePlate = vehicles.some(
        (vehicle) =>
          vehicle.id !== editingVehicle.id &&
          vehicle.plate.toUpperCase() === normalizedPlate
      );

      if (hasDuplicatePlate) {
        setErrorMsg("Ja existe um veiculo cadastrado com essa placa.");
        return;
      }

      const selectedUsers = getSelectedUsersFromForm();
      if (!selectedUsers.length) {
        setErrorMsg("Selecione pelo menos um responsavel pelo veiculo.");
        return;
      }

      const parsedKm = parseCurrentKmInput(currentKm);
      if (parsedKm.hasValue && parsedKm.value == null) {
        setErrorMsg("Informe um KM valido.");
        return;
      }

      if ((parsedKm.value ?? 0) < 0) {
        setErrorMsg("O KM nao pode ser negativo.");
        return;
      }

      if (
        parsedKm.value != null &&
        editingVehicle.currentKm != null &&
        parsedKm.value < editingVehicle.currentKm
      ) {
        setErrorMsg(
          `O KM atual nao pode ser menor que ${editingVehicle.currentKm} km.`
        );
        return;
      }

      const responsibleUserIds = selectedUsers.map((item) => item.id);
      const responsibleUsersForDoc = selectedUsers.map((item) => ({
        id: item.id,
        name: item.name,
        storeId: item.storeId,
      }));
      const primaryResponsible = selectedUsers[0];
      const kmValue = parsedKm.value ?? null;

      await updateDoc(doc(db, "vehicles", editingVehicle.id), {
        plate: normalizedPlate,
        model: model.trim(),
        storeId: storeId.trim(),
        responsibleUserIds,
        responsibleUsers: responsibleUsersForDoc,
        responsibleUserId: primaryResponsible.id,
        responsibleUserName: primaryResponsible.name,
        currentKm: kmValue,
      });

      setVehicles((previous) =>
        sortVehicles(
          previous.map((vehicle) =>
            vehicle.id === editingVehicle.id
              ? {
                  ...vehicle,
                  plate: normalizedPlate,
                  model: model.trim(),
                  storeId: storeId.trim(),
                  responsibleUserIds,
                  responsibleUsers: responsibleUsersForDoc,
                  responsibleUserName: primaryResponsible.name,
                  currentKm: kmValue ?? undefined,
                }
              : vehicle
          )
        )
      );

      setFormOpen(false);
      resetFormFields();
      setSuccessMsg("Veiculo atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar veiculo:", error);
      setErrorMsg("Erro ao atualizar veiculo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (editingVehicle) {
      await handleUpdateVehicle();
      return;
    }

    await handleCreateVehicle();
  }

  async function confirmDeleteVehicle() {
    if (!deletingVehicle) return;

    try {
      setErrorMsg("");
      await deleteDoc(doc(db, "vehicles", deletingVehicle.id));
      setVehicles((previous) =>
        previous.filter((vehicle) => vehicle.id !== deletingVehicle.id)
      );
      setSuccessMsg(`Veiculo ${deletingVehicle.plate} excluido com sucesso.`);
      closeDeleteVehicleDialog();
    } catch (error) {
      console.error("Erro ao excluir veiculo:", error);
      setErrorMsg("Erro ao excluir veiculo. Tente novamente.");
    }
  }

  const storeOptions = useMemo(() => {
    const stores = new Set<string>();
    vehicles.forEach((vehicle) => {
      if (vehicle.storeId) {
        stores.add(vehicle.storeId);
      }
    });
    return Array.from(stores).sort();
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    let nextList = [...vehicles];

    if (statusFilter !== "todos") {
      nextList = nextList.filter((vehicle) => vehicle.status === statusFilter);
    }

    if (storeFilter !== "todas") {
      nextList = nextList.filter((vehicle) => vehicle.storeId === storeFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      nextList = nextList.filter((vehicle) => {
        const responsibleNames = vehicle.responsibleUsers
          .map((responsible) => responsible.name)
          .join(" ")
          .toLowerCase();

        return (
          vehicle.plate.toLowerCase().includes(term) ||
          vehicle.model.toLowerCase().includes(term) ||
          vehicle.storeId.toLowerCase().includes(term) ||
          vehicle.responsibleUserName.toLowerCase().includes(term) ||
          responsibleNames.includes(term)
        );
      });
    }

    return nextList;
  }, [searchTerm, statusFilter, storeFilter, vehicles]);

  const totalVeiculos = vehicles.length;
  const disponiveis = vehicles.filter(
    (vehicle) => vehicle.status === "disponivel"
  ).length;
  const emRota = vehicles.filter((vehicle) => vehicle.status === "em_rota").length;
  const emManutencao = vehicles.filter(
    (vehicle) => vehicle.status === "manutencao"
  ).length;
  const lojasAtivas = storeOptions.length;
  const veiculosComKm = vehicles.filter(
    (vehicle) => vehicle.currentKm != null
  ).length;
  const hasActiveFilters =
    searchTerm.trim() || statusFilter !== "todos" || storeFilter !== "todas";

  const statusChipClasses = (target: StatusFilter) =>
    `rounded-full border px-3 py-2 text-xs font-medium transition ${
      statusFilter === target
        ? "border-yellow-400 bg-yellow-400 text-black shadow-[0_0_0_1px_rgba(250,204,21,0.25)]"
        : "border-slate-200 bg-white text-slate-600 hover:border-yellow-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-yellow-400/35 dark:hover:bg-white/[0.08] dark:hover:text-white"
    }`;

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Gestao da frota"
        title="Veiculos do Grupo MM"
        description="Organize placa, loja, responsaveis e status da frota em uma tela mais clara para escritorio e operacao em campo."
        icon={Truck}
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              {totalVeiculos} veiculos monitorados
            </span>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {disponiveis} disponiveis
            </span>
            <span className="app-chip border-sky-300/20 bg-sky-400/10 text-sky-100">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              {emRota} em rota
            </span>
          </>
        }
        actions={
          isAdmin ? (
            <Button onClick={openNewVehicleDialog}>+ Novo veiculo</Button>
          ) : null
        }
      />

      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}
      {successMsg ? (
        <StatusBanner tone="success">{successMsg}</StatusBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total"
          value={String(totalVeiculos)}
          helper="Veiculos registrados no sistema."
          icon={Truck}
        />
        <MetricCard
          label="Disponiveis"
          value={String(disponiveis)}
          helper="Prontos para nova saida."
          icon={Truck}
          accent="green"
        />
        <MetricCard
          label="Em rota"
          value={String(emRota)}
          helper="Veiculos atualmente em operacao."
          icon={RouteIcon}
          accent="blue"
        />
        <MetricCard
          label="Manutencao"
          value={String(emManutencao)}
          helper="Veiculos temporariamente indisponiveis."
          icon={Wrench}
          accent="yellow"
        />
      </div>

      <Card className="app-panel-muted p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Filtros da frota
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Busque por placa, modelo, loja ou responsavel e combine com
                status para chegar mais rapido ao veiculo certo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                {filteredVehicles.length} veiculo(s) visiveis
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                {lojasAtivas} loja(s)
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                {veiculosComKm} com KM informado
              </span>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("todos");
                    setStoreFilter("todas");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_240px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por placa, modelo, loja ou responsavel..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="app-field pl-10"
              />
            </div>

            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                className="app-select h-11 w-full pl-10"
                value={storeFilter}
                onChange={(event) => setStoreFilter(event.target.value)}
              >
                <option value="todas">Todas as lojas</option>
                {storeOptions.map((store) => (
                  <option key={store} value={store}>
                    {store}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="h-4 w-4" />
              Status
            </div>

            <button
              type="button"
              className={statusChipClasses("todos")}
              onClick={() => setStatusFilter("todos")}
            >
              Todos
            </button>
            <button
              type="button"
              className={statusChipClasses("disponivel")}
              onClick={() => setStatusFilter("disponivel")}
            >
              Disponiveis
            </button>
            <button
              type="button"
              className={statusChipClasses("em_rota")}
              onClick={() => setStatusFilter("em_rota")}
            >
              Em rota
            </button>
            <button
              type="button"
              className={statusChipClasses("manutencao")}
              onClick={() => setStatusFilter("manutencao")}
            >
              Manutencao
            </button>
          </div>
        </div>
      </Card>

      <Card className="app-panel p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-yellow-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Frota cadastrada
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Consulte detalhes, responsaveis e situacao atual de cada veiculo.
            </p>
          </div>

          {!loading ? (
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {filteredVehicles.length} de {totalVeiculos} veiculos
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            Carregando veiculos...
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhum veiculo encontrado com os filtros atuais.
            </p>
            {hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("todos");
                  setStoreFilter("todas");
                }}
              >
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                        {vehicle.plate}
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                        {vehicle.model}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {vehicle.storeId}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClasses(
                        vehicle.status
                      )}`}
                    >
                      {getStatusLabel(vehicle.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                        Responsaveis
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {vehicle.responsibleUsers.length
                          ? vehicle.responsibleUsers
                              .map((responsible) => responsible.name)
                              .join(", ")
                          : "Sem responsavel"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                        KM atual
                      </p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {formatKm(vehicle.currentKm)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionIconButton
                      action="view"
                      onClick={() => handleVerDetalhes(vehicle)}
                    />

                    {isAdmin ? (
                      <>
                        <ActionIconButton
                          action="edit"
                          onClick={() => openEditVehicleDialog(vehicle)}
                        />
                        <ActionIconButton
                          action="delete"
                          onClick={() => openDeleteVehicleDialog(vehicle)}
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[920px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="py-3 pr-3 font-medium">Placa</th>
                    <th className="px-3 py-3 font-medium">Modelo</th>
                    <th className="px-3 py-3 font-medium">Loja</th>
                    <th className="px-3 py-3 font-medium">Responsaveis</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">KM atual</th>
                    <th className="py-3 pl-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className="border-b border-slate-200/80 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-4 pr-3 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            {vehicle.plate}
                          </span>
                          {!vehicle.active ? (
                            <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
                              Inativo
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-3 py-4 align-top text-slate-700 dark:text-slate-200">
                        {vehicle.model}
                      </td>

                      <td className="px-3 py-4 align-top text-slate-700 dark:text-slate-200">
                        {vehicle.storeId}
                      </td>

                      <td className="px-3 py-4 align-top text-slate-700 dark:text-slate-200">
                        {vehicle.responsibleUsers.length ? (
                          <div className="flex flex-col gap-1">
                            <span>
                              {vehicle.responsibleUsers
                                .map((responsible) => responsible.name)
                                .join(" | ")}
                            </span>
                            {vehicle.responsibleUsers.length > 1 ? (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {vehicle.responsibleUsers.length} responsaveis
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="italic text-slate-400 dark:text-slate-500">
                            Sem responsavel
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-4 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusBadgeClasses(
                            vehicle.status
                          )}`}
                        >
                          {getStatusLabel(vehicle.status)}
                        </span>
                      </td>

                      <td className="px-3 py-4 align-top text-slate-700 dark:text-slate-200">
                        {formatKm(vehicle.currentKm)}
                      </td>

                      <td className="py-4 pl-3 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionIconButton
                            action="view"
                            onClick={() => handleVerDetalhes(vehicle)}
                          />

                          {isAdmin ? (
                            <>
                              <ActionIconButton
                                action="edit"
                                onClick={() => openEditVehicleDialog(vehicle)}
                              />
                              <ActionIconButton
                                action="delete"
                                onClick={() => openDeleteVehicleDialog(vehicle)}
                              />
                            </>
                          ) : null}
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

      {isAdmin ? (
        <Dialog
          open={formOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeVehicleDialog();
            }
          }}
        >
          <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
            <form
              onSubmit={handleSubmit}
              className="flex max-h-[calc(100vh-2rem)] flex-col"
            >
              <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
                <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                  {editingVehicle ? (
                    <PencilLine className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Truck className="h-5 w-5 text-yellow-500" />
                  )}
                  {editingVehicle ? "Editar veiculo" : "Novo veiculo"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados principais da frota e mantenha responsaveis,
                  loja e quilometragem atualizados.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Placa
                    </label>
                    <Input
                      placeholder="Ex: ABC1D23"
                      value={plate}
                      onChange={(event) => setPlate(event.target.value)}
                      className="app-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Modelo
                    </label>
                    <Input
                      placeholder="Ex: Strada, Fiorino, Saveiro"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className="app-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Loja
                    </label>
                    <Input
                      placeholder="Ex: destack-cedral"
                      value={storeId}
                      onChange={(event) => setStoreId(event.target.value)}
                      className="app-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      <Gauge className="h-3.5 w-3.5" />
                      KM atual
                    </label>
                    <Input
                      placeholder="Opcional"
                      value={currentKm}
                      onChange={(event) => setCurrentKm(event.target.value)}
                      className="app-field"
                    />
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                      <UserCircle2 className="h-4 w-4 text-yellow-500" />
                      Responsaveis pelo veiculo
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Defina quem pode operar ou acompanhar este veiculo no
                      sistema.
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {responsibleIds.map((value, index) => (
                      <div key={`${value}-${index}`} className="flex gap-2">
                        <select
                          className="app-select h-11 flex-1"
                          value={value}
                          onChange={(event) =>
                            updateResponsibleField(index, event.target.value)
                          }
                        >
                          <option value="">Selecione um usuario...</option>
                          {users.map((userOption) => (
                            <option key={userOption.id} value={userOption.id}>
                              {userOption.name} ({userOption.storeId})
                            </option>
                          ))}
                        </select>

                        {responsibleIds.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 border-red-500/35 text-red-200 hover:bg-red-500/10"
                            onClick={() => removeResponsibleField(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={addResponsibleField}
                    >
                      + Adicionar responsavel
                    </Button>
                  </div>
                </div>

                {editingVehicle ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Registro em edicao
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      ID do veiculo: {editingVehicle.id}
                    </p>
                  </div>
                ) : null}

                {errorMsg ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMsg}
                  </div>
                ) : null}
              </div>

              <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
                <Button type="button" variant="destructive" onClick={closeVehicleDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving
                    ? editingVehicle
                      ? "Salvando alteracoes..."
                      : "Salvando veiculo..."
                    : editingVehicle
                    ? "Salvar alteracoes"
                    : "Salvar veiculo"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog
        open={!!deletingVehicle}
        onOpenChange={(open) => {
          if (!open) {
            closeDeleteVehicleDialog();
          }
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Trash2 className="h-5 w-5 text-red-500" />
              Excluir veiculo
            </DialogTitle>
            <DialogDescription>
              Esta acao remove o veiculo do cadastro principal. Use apenas quando
              tiver certeza de que ele nao deve mais fazer parte da frota.
            </DialogDescription>
          </DialogHeader>

          {deletingVehicle ? (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {deletingVehicle.plate} | {deletingVehicle.model}
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Loja: {deletingVehicle.storeId}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Status atual: {getStatusLabel(deletingVehicle.status)}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="destructive" onClick={closeDeleteVehicleDialog}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteVehicle}
            >
              Excluir veiculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
