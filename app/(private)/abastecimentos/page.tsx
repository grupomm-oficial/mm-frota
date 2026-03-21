"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
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
  Filter,
  Fuel,
  Gauge,
  MapPin,
  PencilLine,
  ReceiptText,
  Search,
  Trash2,
  User2,
  Wallet,
} from "lucide-react";

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

interface Fueling {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  storeId: string;
  responsibleUserId: string;
  responsibleUserName: string;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerL: number;
  total: number;
  stationName?: string | null;
  updatedAt?: string | null;
  updatedById?: string | null;
  updatedByName?: string | null;
  editReason?: string | null;
}

export default function AbastecimentosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [fuelings, setFuelings] = useState<Fueling[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState("");
  const [odometerKm, setOdometerKm] = useState("");
  const [totalValue, setTotalValue] = useState(""); // Novo campo
  const [pricePerL, setPricePerL] = useState("");
  const [stationName, setStationName] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Edicao (admin)
  const [editingFueling, setEditingFueling] = useState<Fueling | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editOdometerKm, setEditOdometerKm] = useState("");
  const [editTotalValue, setEditTotalValue] = useState("");
  const [editPricePerL, setEditPricePerL] = useState("");
  const [editStationName, setEditStationName] = useState("");
  const [editReason, setEditReason] = useState("");
  const [deletingFueling, setDeletingFueling] = useState<Fueling | null>(null);

  // Filtros de período (data inicial e final)
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

        // ===== VEÃCULOS =====
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        let vListAll: VehicleOption[] = vehiclesSnap.docs.map((d) => {
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

        // ===== ABASTECIMENTOS =====
        const fuelingsSnap = await getDocs(
          query(collection(db, "fuelings"), orderBy("date", "desc"))
        );

        let fList: Fueling[] = fuelingsSnap.docs.map((d) => {
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
            liters: data.liters,
            pricePerL: data.pricePerL,
            total: data.total,
            stationName: data.stationName ?? null,
            updatedAt: data.updatedAt ?? null,
            updatedById: data.updatedById ?? null,
            updatedByName: data.updatedByName ?? null,
            editReason: data.editReason ?? null,
          };
        });

        if (!isAdmin) {
          const allowedVehicleIds = new Set(vList.map((v) => v.id));

          fList = fList.filter(
            (f) =>
              f.responsibleUserId === user.id ||
              allowedVehicleIds.has(f.vehicleId)
          );
        }

        setFuelings(fList);
      } catch (error) {
        console.error("Erro ao carregar abastecimentos:", error);
        setErrorMsg("Erro ao carregar dados. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, isAdmin]);

  function resetForm() {
    setVehicleId("");
    
    // Data atual formatada para o input datetime-local
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    setDate(localISOTime);

    setOdometerKm("");
    setTotalValue("");
    setPricePerL("");
    setStationName("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  function openEditFueling(fueling: Fueling) {
    setFormOpen(false);
    setDeletingFueling(null);
    setEditingFueling(fueling);
    setEditDate(toDateTimeLocalValue(fueling.date));
    setEditOdometerKm(String(fueling.odometerKm ?? ""));
    setEditTotalValue(String(fueling.total ?? ""));
    setEditPricePerL(String(fueling.pricePerL ?? ""));
    setEditStationName(fueling.stationName ?? "");
    setEditReason("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeEditFueling() {
    setEditingFueling(null);
    setEditDate("");
    setEditOdometerKm("");
    setEditTotalValue("");
    setEditPricePerL("");
    setEditStationName("");
    setEditReason("");
    setErrorMsg("");
  }

  function closeNewFuelingDialog() {
    setFormOpen(false);
    resetForm();
  }

  function openDeleteFueling(fueling: Fueling) {
    setFormOpen(false);
    setEditingFueling(null);
    setDeletingFueling(fueling);
    setErrorMsg("");
    setSuccessMsg("");
  }

  function closeDeleteFueling() {
    setDeletingFueling(null);
    setErrorMsg("");
  }

  // Quando escolhe veículo, se tiver KM atual salvo, já sugere no hodômetro:
  function handleChangeVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((veh) => veh.id === id);
    if (v && v.currentKm != null) {
      setOdometerKm(String(v.currentKm));
    } else {
      setOdometerKm("");
    }
  }

  async function handleSalvarAbastecimento(e: React.FormEvent) {
    e.preventDefault();
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!vehicleId || !odometerKm || !totalValue || !pricePerL) {
        setErrorMsg("Selecione veículo e preencha km, valor total e valor por litro.");
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
          "Você não tem permissão para registrar abastecimento para este veículo."
        );
        return;
      }

      if (vehicle.status === "manutencao") {
        setErrorMsg(
          "Este veiculo esta em manutencao. Conclua a manutencao antes de registrar abastecimento."
        );
        return;
      }

      const odom = Number(odometerKm.replace(",", "."));
      const total = Number(totalValue.replace(",", "."));
      const price = Number(pricePerL.replace(",", "."));

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
      if (isNaN(total) || total <= 0) {
        setErrorMsg("Valor total inválido.");
        return;
      }
      if (isNaN(price) || price <= 0) {
        setErrorMsg("Valor por litro inválido.");
        return;
      }

      // Calcula os litros a partir do total e preço
      const lit = Number((total / price).toFixed(2));

      if (!user) {
        setErrorMsg("Sessão expirada. Faça login novamente.");
        router.replace("/login");
        return;
      }

      const nowISO = date || new Date().toISOString();

      const newDoc = doc(collection(db, "fuelings"));
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
        liters: lit,
        pricePerL: price,
        total,
        stationName: stationName || null,
      });

      // Atualiza KM atual do veículo
      batch.update(doc(db, "vehicles", vehicle.id), {
        currentKm: odom,
      });

      await batch.commit();

      // Atualiza listas locais
      setFuelings((prev) => [
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
          liters: lit,
          pricePerL: price,
          total,
          stationName: stationName || null,
        },
        ...prev,
      ]);

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id ? { ...v, currentKm: odom } : v
        )
      );

      setFormOpen(false);
      resetForm();
      setSuccessMsg("Abastecimento registrado com sucesso.");
    } catch (error) {
      console.error("Erro ao registrar abastecimento:", error);
      setErrorMsg("Erro ao registrar abastecimento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteFueling() {
    if (!isAdmin || !deletingFueling) return;

    try {
      await deleteDoc(doc(db, "fuelings", deletingFueling.id));
      setFuelings((prev) =>
        prev.filter((item) => item.id !== deletingFueling.id)
      );
      closeDeleteFueling();
      setSuccessMsg("Abastecimento excluido com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir abastecimento:", error);
      setErrorMsg("Erro ao excluir abastecimento. Tente novamente.");
    }
  }

  async function handleSalvarEdicaoAbastecimento(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    if (!editingFueling || !user || !isAdmin) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      if (!editOdometerKm || !editTotalValue || !editPricePerL) {
        setErrorMsg("Preencha km, valor total e valor por litro para salvar a edicao.");
        return;
      }

      const vehicle = vehicles.find((item) => item.id === editingFueling.vehicleId);
      if (!vehicle) {
        setErrorMsg("Veiculo vinculado ao abastecimento nao foi encontrado.");
        return;
      }

      const nextDate = editDate || toDateTimeLocalValue();
      const nextOdometer = Number(editOdometerKm.replace(",", "."));
      const nextTotal = Number(editTotalValue.replace(",", "."));
      const nextPrice = Number(editPricePerL.replace(",", "."));

      if (Number.isNaN(nextOdometer) || nextOdometer <= 0) {
        setErrorMsg("KM invalido.");
        return;
      }
      if (Number.isNaN(nextTotal) || nextTotal <= 0) {
        setErrorMsg("Valor total invalido.");
        return;
      }
      if (Number.isNaN(nextPrice) || nextPrice <= 0) {
        setErrorMsg("Valor por litro invalido.");
        return;
      }

      const nextLiters = Number((nextTotal / nextPrice).toFixed(2));
      const updatedAt = new Date().toISOString();

      const batch = writeBatch(db);
      batch.update(doc(db, "fuelings", editingFueling.id), {
        date: nextDate,
        odometerKm: nextOdometer,
        liters: nextLiters,
        pricePerL: nextPrice,
        total: nextTotal,
        stationName: editStationName || null,
        updatedAt,
        updatedById: user.id,
        updatedByName: user.name,
        editReason: editReason || null,
      });

      if ((vehicle.currentKm ?? 0) < nextOdometer) {
        batch.update(doc(db, "vehicles", vehicle.id), {
          currentKm: nextOdometer,
        });
      }

      await batch.commit();

      setFuelings((prev) =>
        prev
          .map((item) =>
            item.id === editingFueling.id
              ? {
                  ...item,
                  date: nextDate,
                  odometerKm: nextOdometer,
                  liters: nextLiters,
                  pricePerL: nextPrice,
                  total: nextTotal,
                  stationName: editStationName || null,
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

      if ((vehicle.currentKm ?? 0) < nextOdometer) {
        setVehicles((prev) =>
          prev.map((item) =>
            item.id === vehicle.id ? { ...item, currentKm: nextOdometer } : item
          )
        );
      }

      closeEditFueling();
      setSuccessMsg("Abastecimento atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar abastecimento:", error);
      setErrorMsg("Erro ao atualizar abastecimento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  // ====== FILTRO POR PERÃODO (datas locais, sem bug de fuso) ======
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
    fuelings.forEach((fueling) => {
      if (fueling.storeId) stores.add(fueling.storeId);
    });
    return Array.from(stores).sort();
  }, [fuelings]);

  const responsibleFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    fuelings.forEach((fueling) => {
      if (fueling.responsibleUserId) {
        map.set(fueling.responsibleUserId, fueling.responsibleUserName);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fuelings]);

  const filteredFuelings = useMemo(() => {
    const parseLocalDate = (value: string) => {
      const [yyyy, mm, dd] = value.split("-").map(Number);
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    };

    const query = searchFilter.trim().toLowerCase();

    return fuelings.filter((f) => {
      if (!f.date) return false;

      const d = new Date(f.date);

      if (startFilter) {
        const start = parseLocalDate(startFilter);
        if (d < start) return false;
      }

      if (endFilter) {
        const end = parseLocalDate(endFilter);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }

      if (vehicleFilter !== "todos" && f.vehicleId !== vehicleFilter) {
        return false;
      }

      if (storeFilter !== "todas" && (f.storeId || "") !== storeFilter) {
        return false;
      }

      if (
        responsibleFilter !== "todos" &&
        (f.responsibleUserId || "") !== responsibleFilter
      ) {
        return false;
      }

      if (query) {
        const haystack = [
          f.vehiclePlate,
          f.vehicleModel,
          f.storeId,
          f.responsibleUserName,
          f.stationName || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    fuelings,
    startFilter,
    endFilter,
    vehicleFilter,
    storeFilter,
    responsibleFilter,
    searchFilter,
  ]);

  // Somatórios e métricas baseados no filtro
  const totalGasto = useMemo(
    () => filteredFuelings.reduce((acc, f) => acc + (f.total || 0), 0),
    [filteredFuelings]
  );
  const totalLitros = useMemo(
    () => filteredFuelings.reduce((acc, f) => acc + (f.liters || 0), 0),
    [filteredFuelings]
  );
  const mediaPreco = totalLitros > 0 ? totalGasto / totalLitros : 0;

  // Preview dos litros no formulário (agora inverteu a lógica)
  const previewLiters = (() => {
    const tot = Number(totalValue.replace(",", "."));
    const price = Number(pricePerL.replace(",", "."));
    if (!tot || !price || isNaN(tot) || isNaN(price)) return null;
    return Number((tot / price).toFixed(2));
  })();

  const editPreviewLiters = (() => {
    const tot = Number(editTotalValue.replace(",", "."));
    const price = Number(editPricePerL.replace(",", "."));
    if (!tot || !price || isNaN(tot) || isNaN(price)) return null;
    return Number((tot / price).toFixed(2));
  })();

  const editingVehicle = useMemo(
    () =>
      editingFueling
        ? vehicles.find((vehicle) => vehicle.id === editingFueling.vehicleId) ?? null
        : null,
    [vehicles, editingFueling]
  );

  function handleClearFilter() {
    setStartFilter("");
    setEndFilter("");
    setSearchFilter("");
    setVehicleFilter("todos");
    setStoreFilter("todas");
    setResponsibleFilter("todos");
  }

  // helper pra exibir período bonito
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
        eyebrow="Operacao e custos"
        title="Abastecimentos"
        description="Registre abastecimentos com leitura rapida de periodo, custo total e comportamento da frota por veiculo."
        icon={Fuel}
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              {filteredFuelings.length} registros
            </span>
            <span className="app-chip border-sky-300/20 bg-sky-400/10 text-sky-100">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              {totalLitros.toFixed(1)} L no periodo
            </span>
          </>
        }
        actions={
          <Button
            onClick={() => {
              closeEditFueling();
              closeDeleteFueling();
              resetForm();
              setFormOpen(true);
            }}
          >
            + Novo abastecimento
          </Button>
        }
      />

      <div className="hidden items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Abastecimentos
          </h1>
          <p className="text-sm text-gray-400">
            Registre abastecimentos e acompanhe os gastos por veículo e por
            responsável.
          </p>
        </div>

        <Button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          + Novo abastecimento
        </Button>
      </div>

      {/* Resumo rápido (já com filtro aplicado) */}
      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}
      {successMsg ? <StatusBanner tone="success">{successMsg}</StatusBanner> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Registros"
          value={String(filteredFuelings.length)}
          helper="Lancamentos no periodo selecionado."
          icon={ReceiptText}
        />
        <MetricCard
          label="Litros"
          value={`${totalLitros.toFixed(1)} L`}
          helper="Volume abastecido no periodo."
          icon={Fuel}
          accent="blue"
        />
        <MetricCard
          label="Total"
          value={`R$ ${totalGasto.toFixed(2)}`}
          helper="Custo total em combustivel."
          icon={Wallet}
        />
        <MetricCard
          label="Media R$/L"
          value={`R$ ${mediaPreco.toFixed(3)}`}
          helper="Preco medio calculado pelo periodo."
          icon={Gauge}
          accent="green"
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
                  Filtros e leitura rapida
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Busque abastecimentos por veiculo, loja, responsavel, posto e periodo.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="app-chip">
                <span className="h-2 w-2 rounded-full bg-yellow-300" />
                {filteredFuelings.length} exibidos
              </span>
              <span className="app-chip border-sky-300/20 bg-sky-400/10 text-sky-100">
                <span className="h-2 w-2 rounded-full bg-sky-300" />
                R$ {totalGasto.toFixed(2)}
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
                placeholder="Buscar por placa, modelo, posto ou responsavel"
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
              {filteredFuelings.length} lancamentos no recorte atual
            </span>
            <span className="rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
              {totalLitros.toFixed(2)} L abastecidos
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-700 dark:text-slate-200">
              Media R$/L: {mediaPreco.toFixed(3)}
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
              {filteredFuelings.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Litros abastecidos:{" "}
            <span className="font-semibold text-sky-400">
              {totalLitros.toFixed(2)} L
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Total em combustível:{" "}
            <span className="font-semibold text-yellow-300">
              R$ {totalGasto.toFixed(2)}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Média R$/L:{" "}
            <span className="font-semibold text-green-400">
              R$ {mediaPreco.toFixed(3)}
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

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeNewFuelingDialog();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                <Fuel className="h-5 w-5 text-blue-600 dark:text-yellow-200" />
                Novo abastecimento
              </DialogTitle>
              <DialogDescription>
                Registre combustivel com o mesmo fluxo rapido e focado que usamos em rotas.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSalvarAbastecimento} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div className="grid gap-3 md:grid-cols-2">
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
                      KM do hodometro
                    </label>
                    <Input
                      placeholder="Ex: 45230"
                      value={odometerKm}
                      onChange={(e) => setOdometerKm(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Valor total (R$)
                    </label>
                    <Input
                      placeholder="Ex: 250,00"
                      value={totalValue}
                      onChange={(e) => setTotalValue(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Valor por litro (R$)
                    </label>
                    <Input
                      placeholder="Ex: 5,29"
                      value={pricePerL}
                      onChange={(e) => setPricePerL(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                      Posto / observacao
                    </label>
                    <Input
                      placeholder="Nome do posto ou observacao"
                      value={stationName}
                      onChange={(e) => setStationName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="app-panel-muted p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Litros calculados
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                    {previewLiters != null ? `${previewLiters?.toFixed(2)} L` : "-"}
                  </p>
                </div>

                {errorMsg ? (
                  <p className="text-sm font-medium text-red-500 dark:text-red-300">
                    {errorMsg}
                  </p>
                ) : null}
              </div>

              <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
                <Button type="button" variant="destructive" onClick={closeNewFuelingDialog}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar abastecimento"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingFueling}
        onOpenChange={(open) => {
          if (!open) closeDeleteFueling();
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Trash2 className="h-5 w-5 text-red-500 dark:text-red-300" />
              Excluir abastecimento
            </DialogTitle>
            <DialogDescription>
              Esta acao remove o lancamento do historico de abastecimentos.
            </DialogDescription>
          </DialogHeader>

          {deletingFueling ? (
            <div className="space-y-4">
              <div className="app-panel-muted p-4">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {deletingFueling.vehiclePlate} · {deletingFueling.vehicleModel}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {deletingFueling.date
                    ? new Date(deletingFueling.date).toLocaleString("pt-BR")
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Total: R$ {deletingFueling.total.toFixed(2)}
                </p>
              </div>

              {errorMsg ? (
                <p className="text-sm font-medium text-red-500 dark:text-red-300">
                  {errorMsg}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="destructive" onClick={closeDeleteFueling}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={confirmDeleteFueling}
                  disabled={saving}
                >
                  {saving ? "Excluindo..." : "Excluir"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Formulário */}
      {false && formOpen && (
        <Card className="app-panel p-4 md:p-5">
          <h2 className="text-lg font-semibold text-yellow-400 mb-3">
            Registrar novo abastecimento
          </h2>

          <form onSubmit={handleSalvarAbastecimento} className="space-y-3">
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
                  Data e Hora
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
                  KM do hodômetro
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
                  Valor Total (R$)
                </label>
                <Input
                  placeholder="Ex: 250,00"
                  value={totalValue}
                  onChange={(e) => setTotalValue(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Valor por litro (R$)
                </label>
                <Input
                  placeholder="Ex: 5,29"
                  value={pricePerL}
                  onChange={(e) => setPricePerL(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Posto / Observacao (opcional)
                </label>
                <Input
                  placeholder="Nome do posto ou observacao"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Preview do cálculo automático */}
            <div className="text-xs text-gray-300 mt-1">
              Quantidade calculada:{" "}
              <span className="font-semibold text-sky-400">
                {previewLiters != null
                  ? `${previewLiters?.toFixed(2)} L`
                  : "-"}
              </span>
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
                {saving ? "Salvando..." : "Salvar abastecimento"}
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

      <Dialog
        open={!!editingFueling}
        onOpenChange={(open) => {
          if (!open) closeEditFueling();
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                <PencilLine className="h-5 w-5 text-blue-600 dark:text-yellow-200" />
                Editar abastecimento
              </DialogTitle>
              <DialogDescription>
                Ajuste o lancamento de combustivel sem perder o historico da operacao.
              </DialogDescription>
            </DialogHeader>

            {editingFueling ? (
              <form
                onSubmit={handleSalvarEdicaoAbastecimento}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Veiculo
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {editingFueling.vehiclePlate} · {editingFueling.vehicleModel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {editingFueling.storeId || "Loja nao informada"}
                      </p>
                    </div>

                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Responsavel
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">
                        {editingFueling.responsibleUserName || "Nao informado"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Lancado em{" "}
                        {editingFueling.date
                          ? new Date(editingFueling.date).toLocaleString("pt-BR")
                          : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
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
                        KM do hodometro
                      </label>
                      <Input
                        value={editOdometerKm}
                        onChange={(e) => setEditOdometerKm(e.target.value)}
                        placeholder="Ex: 45230"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Valor total (R$)
                      </label>
                      <Input
                        value={editTotalValue}
                        onChange={(e) => setEditTotalValue(e.target.value)}
                        placeholder="Ex: 250,00"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Valor por litro (R$)
                      </label>
                      <Input
                        value={editPricePerL}
                        onChange={(e) => setEditPricePerL(e.target.value)}
                        placeholder="Ex: 5,29"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Posto / observacao
                      </label>
                      <Input
                        value={editStationName}
                        onChange={(e) => setEditStationName(e.target.value)}
                        placeholder="Nome do posto ou observacao"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                        Motivo da alteracao
                      </label>
                      <textarea
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        placeholder="Opcional: registre o motivo da edicao para auditoria interna."
                        className="app-textarea min-h-[90px]"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Litros recalculados
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                        {editPreviewLiters != null ? `${editPreviewLiters.toFixed(2)} L` : "-"}
                      </p>
                    </div>

                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        KM atual do veiculo
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">
                        {editingVehicle?.currentKm != null
                          ? `${editingVehicle.currentKm} km`
                          : "Nao informado"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        O sistema so avanca o KM do veiculo se o novo valor for maior que o atual.
                      </p>
                    </div>
                  </div>

                  {editingFueling.updatedAt ? (
                    <div className="app-panel-muted p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Ultima edicao
                      </p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {editingFueling.updatedByName || "Admin"} em{" "}
                        {new Date(editingFueling.updatedAt).toLocaleString("pt-BR")}
                      </p>
                      {editingFueling.editReason ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Motivo anterior: {editingFueling.editReason}
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
                  <Button type="button" variant="destructive" onClick={closeEditFueling}>
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

      {/* Lista */}
      <Card className="app-panel p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-100">
            Lista de abastecimentos
          </h2>
          <p className="text-xs text-gray-400">
            Total exibido no período:{" "}
            <span className="font-semibold text-yellow-400">
              R$ {totalGasto.toFixed(2)}
            </span>
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando...</p>
        ) : filteredFuelings.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum abastecimento encontrado para o período selecionado.
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredFuelings.map((f) => (
                <div
                  key={f.id}
                  className="rounded-2xl border border-border bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        <span className="font-mono">{f.vehiclePlate}</span> · {f.vehicleModel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-300" />
                          {f.storeId}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <User2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-300" />
                          {f.responsibleUserName}
                        </span>
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-200">
                      R$ {f.total.toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Data</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {f.date ? new Date(f.date).toLocaleString("pt-BR") : "-"}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">KM</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {f.odometerKm} km
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Litros</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {f.liters.toFixed(2)} L
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">R$/L</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        R$ {f.pricePerL.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-border bg-white/60 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                    {f.stationName ? f.stationName : "Sem posto/observacao informado"}
                  </div>

                  {isAdmin ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionIconButton
                        action="edit"
                        onClick={() => openEditFueling(f)}
                      />
                      <ActionIconButton
                        action="delete"
                        onClick={() => openDeleteFueling(f)}
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
                  <th className="py-2 px-2">Loja</th>
                  <th className="py-2 px-2">KM</th>
                  <th className="py-2 px-2">Litros</th>
                  <th className="py-2 px-2">R$/L</th>
                  <th className="py-2 px-2">Total</th>
                  <th className="py-2 px-2">Responsável</th>
                  <th className="py-2 px-2">Posto / Obs.</th>
                  {isAdmin && (
                    <th className="py-2 pl-2 text-right">Acoes</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredFuelings.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 text-gray-200">
                      {f.date
                        ? new Date(f.date).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="py-2 px-2 font-mono text-gray-100">
                      {f.vehiclePlate} · {f.vehicleModel}
                    </td>
                    <td className="py-2 px-2 text-gray-200">{f.storeId}</td>
                    <td className="py-2 px-2 text-gray-200">
                      {f.odometerKm} km
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {f.liters.toFixed(2)} L
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      R$ {f.pricePerL.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 font-semibold text-yellow-300">
                      R$ {f.total.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {f.responsibleUserName}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {f.stationName ? f.stationName : "-"}
                    </td>
                    {isAdmin && (
                      <td className="py-2 pl-2 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionIconButton
                            action="edit"
                            onClick={() => openEditFueling(f)}
                          />
                          <ActionIconButton
                            action="delete"
                            onClick={() => openDeleteFueling(f)}
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
      </Card>
    </div>
  );
}


