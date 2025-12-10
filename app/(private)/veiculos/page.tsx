"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
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
  Truck,
  Search,
  Filter,
  Building2,
  UserCircle2,
  Wrench,
  Route as RouteIcon,
} from "lucide-react";

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
  // principal (primeiro responsável)
  responsibleUserName: string;
  // novos campos
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

type StatusFilter = VehicleStatus | "todos";

export default function VeiculosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // edição x criação
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // campos formulário
  const [plate, setPlate] = useState("");
  const [model, setModel] = useState("");
  const [storeId, setStoreId] = useState("");
  const [responsibleIds, setResponsibleIds] = useState<string[]>([""]);
  const [currentKm, setCurrentKm] = useState("");

  // filtros / busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [storeFilter, setStoreFilter] = useState<string>("todas");

  const isAdmin = user?.role === "admin";

  // Se não estiver logado, manda pro login
  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  // Carregar usuários e veículos
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setErrorMsg("");

        // Admin vê todos os usuários para atribuir como responsável
        if (user?.role === "admin") {
          const usersSnap = await getDocs(collection(db, "users"));
          const usersList: SimpleUser[] = usersSnap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: data.name,
              storeId: data.storeId,
            };
          });
          setUsers(usersList);
        } else {
          setUsers([]);
        }

        // Carregar veículos
        let vehiclesSnap;
        if (user?.role === "admin") {
          // admin vê todos
          vehiclesSnap = await getDocs(collection(db, "vehicles"));
        } else {
          // user vê só veículos que ele é responsável (novo campo array)
          vehiclesSnap = await getDocs(
            query(
              collection(db, "vehicles"),
              where("responsibleUserIds", "array-contains", user?.id ?? "")
            )
          );
        }

        const vList: Vehicle[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;

          // compatibilidade: se já existirem arrays, usa; se não, converte do campo antigo
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
            Array.isArray(data.responsibleUserIds) &&
            data.responsibleUserIds.length
              ? data.responsibleUserIds
              : responsibleUsersFromDoc.map((u) => u.id);

          const primaryName =
            data.responsibleUserName ||
            (responsibleUsersFromDoc[0]?.name ?? "");

          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            responsibleUserName: primaryName,
            responsibleUserIds: responsibleUserIdsFromDoc,
            responsibleUsers: responsibleUsersFromDoc,
            status: data.status ?? "disponivel",
            currentKm: data.currentKm,
            active: data.active ?? true,
          };
        });

        // ordena por loja + placa
        vList.sort((a, b) => {
          const s = (a.storeId || "").localeCompare(b.storeId || "");
          if (s !== 0) return s;
          return (a.plate || "").localeCompare(b.plate || "");
        });

        setVehicles(vList);
      } catch (error) {
        console.error("Erro ao carregar veículos:", error);
        setErrorMsg("Erro ao carregar veículos. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user]);

  function resetForm() {
    setPlate("");
    setModel("");
    setStoreId(user?.storeId ?? "");
    setResponsibleIds([""]);
    setCurrentKm("");
    setErrorMsg("");
    setSuccessMsg("");
    setEditingVehicle(null);
  }

  function abrirFormNovo() {
    resetForm();
    setFormOpen(true);
  }

  function abrirFormEdicao(v: Vehicle) {
    setEditingVehicle(v);
    setPlate(v.plate);
    setModel(v.model);
    setStoreId(v.storeId);
    setResponsibleIds(
      v.responsibleUserIds && v.responsibleUserIds.length
        ? v.responsibleUserIds
        : [""]
    );
    setCurrentKm(v.currentKm != null ? String(v.currentKm) : "");
    setErrorMsg("");
    setSuccessMsg("");
    setFormOpen(true);
  }

  function handleVerDetalhes(v: Vehicle) {
    router.push(`/veiculos/${v.id}`);
  }

  // helpers para múltiplos responsáveis
  function addResponsibleField() {
    setResponsibleIds((prev) => [...prev, ""]);
  }

  function updateResponsibleField(index: number, value: string) {
    setResponsibleIds((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  }

  function removeResponsibleField(index: number) {
    setResponsibleIds((prev) => prev.filter((_, i) => i !== index));
  }

  function getSelectedUsersFromForm(): SimpleUser[] {
    const uniqueIds = Array.from(
      new Set(responsibleIds.filter((id) => id && id.trim() !== ""))
    );
    const selectedUsers = uniqueIds
      .map((id) => users.find((u) => u.id === id) || null)
      .filter((u): u is SimpleUser => u !== null);

    return selectedUsers;
  }

  async function handleCreateVehicle() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!plate || !model || !storeId) {
        setErrorMsg("Preencha placa, modelo e loja.");
        return;
      }

      const selectedUsers = getSelectedUsersFromForm();
      if (!selectedUsers.length) {
        setErrorMsg("Selecione pelo menos um responsável pelo veículo.");
        return;
      }

      const kmNumber =
        currentKm.trim() === "" ? undefined : Number(currentKm.replace(",", "."));

      const upperPlate = plate.toUpperCase().trim();

      const responsibleUserIds = selectedUsers.map((u) => u.id);
      const responsibleUsersForDoc = selectedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        storeId: u.storeId,
      }));
      const primaryResponsible = selectedUsers[0];

      // Criar doc em "vehicles"
      const docRef = await addDoc(collection(db, "vehicles"), {
        plate: upperPlate,
        model,
        storeId,
        // novos campos
        responsibleUserIds,
        responsibleUsers: responsibleUsersForDoc,
        // campos antigos (compatibilidade)
        responsibleUserId: primaryResponsible.id,
        responsibleUserName: primaryResponsible.name,
        status: "disponivel" as VehicleStatus,
        currentKm: kmNumber,
        active: true,
      });

      // Atualizar lista local
      setVehicles((prev) => [
        ...prev,
        {
          id: docRef.id,
          plate: upperPlate,
          model,
          storeId,
          responsibleUserIds,
          responsibleUsers: responsibleUsersForDoc,
          responsibleUserName: primaryResponsible.name,
          status: "disponivel",
          currentKm: kmNumber,
          active: true,
        },
      ]);

      setSuccessMsg("Veículo cadastrado com sucesso!");
      resetForm();
      setFormOpen(false);
    } catch (error) {
      console.error("Erro ao cadastrar veículo:", error);
      setErrorMsg("Erro ao cadastrar veículo. Tente novamente.");
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

      if (!plate || !model || !storeId) {
        setErrorMsg("Preencha placa, modelo e loja.");
        return;
      }

      const selectedUsers = getSelectedUsersFromForm();
      if (!selectedUsers.length) {
        setErrorMsg("Selecione pelo menos um responsável pelo veículo.");
        return;
      }

      const kmNumber =
        currentKm.trim() === "" ? null : Number(currentKm.replace(",", "."));

      const upperPlate = plate.toUpperCase().trim();

      const responsibleUserIds = selectedUsers.map((u) => u.id);
      const responsibleUsersForDoc = selectedUsers.map((u) => ({
        id: u.id,
        name: u.name,
        storeId: u.storeId,
      }));
      const primaryResponsible = selectedUsers[0];

      await updateDoc(doc(db, "vehicles", editingVehicle.id), {
        plate: upperPlate,
        model,
        storeId,
        responsibleUserIds,
        responsibleUsers: responsibleUsersForDoc,
        responsibleUserId: primaryResponsible.id,
        responsibleUserName: primaryResponsible.name,
        currentKm: kmNumber,
      });

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === editingVehicle.id
            ? {
                ...v,
                plate: upperPlate,
                model,
                storeId,
                responsibleUserIds,
                responsibleUsers: responsibleUsersForDoc,
                responsibleUserName: primaryResponsible.name,
                currentKm: kmNumber ?? undefined,
              }
            : v
        )
      );

      setSuccessMsg("Veículo atualizado com sucesso!");
      setFormOpen(false);
      setEditingVehicle(null);
    } catch (error) {
      console.error("Erro ao atualizar veículo:", error);
      setErrorMsg("Erro ao atualizar veículo. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingVehicle) {
      await handleUpdateVehicle();
    } else {
      await handleCreateVehicle();
    }
  }

  async function handleDeleteVehicle(v: Vehicle) {
    if (!isAdmin) return;
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o veículo ${v.plate} (${v.model})?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "vehicles", v.id));
      setVehicles((prev) => prev.filter((item) => item.id !== v.id));
    } catch (error) {
      console.error("Erro ao excluir veículo:", error);
      setErrorMsg("Erro ao excluir veículo. Tente novamente.");
    }
  }

  // Opções de loja para filtro
  const storeOptions = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.storeId) set.add(v.storeId);
    });
    return Array.from(set).sort();
  }, [vehicles]);

  // Filtro/busca em memória
  const filteredVehicles = useMemo(() => {
    let list = [...vehicles];

    // filtro por status
    if (statusFilter !== "todos") {
      list = list.filter((v) => v.status === statusFilter);
    }

    // filtro por loja
    if (storeFilter !== "todas") {
      list = list.filter((v) => v.storeId === storeFilter);
    }

    // busca por texto
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((v) => {
        const allNames = v.responsibleUsers
          ?.map((u) => u.name)
          .join(" ")
          .toLowerCase();

        return (
          v.plate.toLowerCase().includes(term) ||
          v.model.toLowerCase().includes(term) ||
          (v.storeId || "").toLowerCase().includes(term) ||
          (v.responsibleUserName || "").toLowerCase().includes(term) ||
          (allNames || "").includes(term)
        );
      });
    }

    return list;
  }, [vehicles, searchTerm, statusFilter, storeFilter]);

  // Métricas simples
  const totalVeiculos = vehicles.length;
  const disponiveis = vehicles.filter((v) => v.status === "disponivel").length;
  const emRota = vehicles.filter((v) => v.status === "em_rota").length;
  const emManutencao = vehicles.filter((v) => v.status === "manutencao").length;

  // helpers UI
  const statusChipClasses = (target: StatusFilter) =>
    `px-3 py-1 rounded-full border text-xs cursor-pointer transition ${
      statusFilter === target
        ? "bg-yellow-500 text-black border-yellow-400"
        : "bg-neutral-900 text-gray-200 border-neutral-700 hover:bg-neutral-800"
    }`;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-full bg-yellow-500/10">
              <Truck className="w-5 h-5 text-yellow-400" />
            </div>
            <h1 className="text-2xl font-bold text-yellow-400">
              Veículos do Grupo MM
            </h1>
          </div>
          <p className="text-sm text-gray-400 max-w-xl">
            Cadastre, gerencie e acompanhe os veículos da frota. Os detalhes
            alimentam rotas, abastecimentos e relatórios mensais.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          {/* Busca rápida */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                placeholder="Buscar por placa, modelo, loja ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-72 bg-neutral-900 border-neutral-700 text-gray-100 placeholder:text-gray-500 text-sm pr-9"
              />
              <Search className="w-4 h-4 text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
            {isAdmin && (
              <Button
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm"
                onClick={abrirFormNovo}
              >
                + Novo veículo
              </Button>
            )}
          </div>
          {(searchTerm.trim() ||
            statusFilter !== "todos" ||
            storeFilter !== "todas") && (
            <span className="text-[11px] text-gray-400">
              Mostrando {filteredVehicles.length} de {totalVeiculos} veículo(s).
            </span>
          )}
        </div>
      </div>

      {/* Resumo rápido + filtros de status/loja */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800 space-y-3">
        {/* Chips resumo (clicáveis) */}
        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
          <button
            type="button"
            className={statusChipClasses("todos")}
            onClick={() => setStatusFilter("todos")}
          >
            Total:{" "}
            <span className="font-semibold ml-1 text-yellow-400">
              {totalVeiculos}
            </span>
          </button>

          <button
            type="button"
            className={statusChipClasses("disponivel")}
            onClick={() => setStatusFilter("disponivel")}
          >
            Disponíveis:{" "}
            <span className="font-semibold ml-1 text-green-400">
              {disponiveis}
            </span>
          </button>

          <button
            type="button"
            className={statusChipClasses("em_rota")}
            onClick={() => setStatusFilter("em_rota")}
          >
            Em rota:{" "}
            <span className="font-semibold ml-1 text-sky-400">
              {emRota}
            </span>
          </button>

          <button
            type="button"
            className={statusChipClasses("manutencao")}
            onClick={() => setStatusFilter("manutencao")}
          >
            Em manutenção:{" "}
            <span className="font-semibold ml-1 text-yellow-300">
              {emManutencao}
            </span>
          </button>
        </div>

        {/* Filtro por loja */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-[11px] text-gray-400">
              Filtros rápidos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            <select
              className="rounded-md bg-neutral-900 border border-neutral-700 px-3 py-1.5 text-xs text-gray-100"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="todas">Todas as lojas</option>
              {storeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Formulário (admin) */}
      {isAdmin && formOpen && (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-yellow-400" />
              <h2 className="text-lg font-semibold text-yellow-400">
                {editingVehicle ? "Editar veículo" : "Novo veículo"}
              </h2>
            </div>
            {editingVehicle && (
              <span className="text-[11px] px-2 py-[2px] rounded-full bg-neutral-800 border border-neutral-700 text-gray-300">
                ID: {editingVehicle.id}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Placa (ex: ABC1D23)"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />
              <Input
                placeholder="Modelo (ex: Strada, Fiorino, etc.)"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />
              <Input
                placeholder="Loja / unidade (ex: destack-cedral)"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              <div className="md:col-span-1">
                <label className="block text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <UserCircle2 className="w-3 h-3 text-gray-400" />
                  Responsáveis pelo veículo
                </label>
                <div className="space-y-2">
                  {responsibleIds.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                        value={value}
                        onChange={(e) =>
                          updateResponsibleField(index, e.target.value)
                        }
                      >
                        <option value="">Selecione um usuário...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.storeId})
                          </option>
                        ))}
                      </select>

                      {responsibleIds.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="border-red-500 text-red-300 hover:bg-red-500/10 h-8 w-8 text-xs"
                          onClick={() => removeResponsibleField(index)}
                        >
                          -
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    className="border-neutral-700 text-gray-200 hover:bg-neutral-800 text-xs h-8 px-3"
                    onClick={addResponsibleField}
                  >
                    + Adicionar responsável
                  </Button>
                </div>
              </div>

              <Input
                placeholder="KM atual (opcional)"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
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

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
              >
                {saving
                  ? editingVehicle
                    ? "Salvando alterações..."
                    : "Salvando..."
                  : editingVehicle
                  ? "Salvar alterações"
                  : "Salvar veículo"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-neutral-700 text-gray-200 hover:bg-neutral-800 text-sm"
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

      {/* Lista de veículos */}
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-yellow-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              Veículos cadastrados
            </h2>
          </div>
          {!loading && (
            <span className="text-[11px] text-gray-400">
              {filteredVehicles.length} veículo(s) exibidos
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Carregando veículos...</p>
        ) : filteredVehicles.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum veículo encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Placa</th>
                  <th className="py-2 px-2">Modelo</th>
                  <th className="py-2 px-2">Loja</th>
                  <th className="py-2 px-2">Responsáveis</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">KM atual</th>
                  <th className="py-2 pl-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 font-mono text-gray-100">
                      {v.plate}
                      {!v.active && (
                        <span className="ml-2 text-[10px] px-2 py-[1px] rounded-full bg-neutral-800 text-gray-400 border border-neutral-700">
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-200">{v.model}</td>
                    <td className="py-2 px-2 text-gray-200">{v.storeId}</td>
                    <td className="py-2 px-2 text-gray-200">
                      {v.responsibleUsers && v.responsibleUsers.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {v.responsibleUsers
                              .map((u) => u.name)
                              .join(" • ")}
                          </span>
                          {v.responsibleUsers.length > 1 && (
                            <span className="text-[10px] text-gray-400">
                              {v.responsibleUsers.length} responsáveis
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">
                          Sem responsável
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {v.status === "disponivel" && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-green-500/20 text-green-300 border border-green-500/40">
                          Disponível
                        </span>
                      )}
                      {v.status === "em_rota" && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          Em rota
                        </span>
                      )}
                      {v.status === "manutencao" && (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                          Manutenção
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-gray-200">
                      {v.currentKm != null ? `${v.currentKm} km` : "-"}
                    </td>

                    <td className="py-2 pl-2 text-right">
                      <div className="flex justify-end gap-2">
                        {/* Detalhes – disponível para TODOS os perfis */}
                        <Button
                          size="sm"
                          className="bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border border-yellow-500/40 text-xs h-7 px-3"
                          onClick={() => handleVerDetalhes(v)}
                        >
                          Detalhes
                        </Button>

                        {/* Ações extras apenas para admin */}
                        {isAdmin && (
                          <>
                            <Button
                              size="sm"
                              className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs h-7 px-3"
                              onClick={() => abrirFormEdicao(v)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                              onClick={() => handleDeleteVehicle(v)}
                            >
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
