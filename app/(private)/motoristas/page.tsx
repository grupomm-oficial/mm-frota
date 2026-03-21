"use client";

import { useEffect, useMemo, useState } from "react";
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
import { MetricCard } from "@/components/layout/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBanner } from "@/components/layout/StatusBanner";
import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  PencilLine,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserPlus,
  UserRoundCog,
  Users,
} from "lucide-react";

interface SimpleUser {
  id: string;
  name: string;
  storeId: string;
}

interface Driver {
  id: string;
  name: string;
  storeId: string;
  responsibleUserId: string;
  responsibleUserName: string;
  active: boolean;
}

type StatusFilter = "todos" | "ativos" | "inativos";

const selectBaseClassName =
  "h-11 w-full rounded-2xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-yellow-400 focus:bg-white dark:border-white/10 dark:bg-black/20 dark:text-white dark:[color-scheme:dark]";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export default function MotoristasPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyDriverId, setBusyDriverId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // edição x criação
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // campos formulário
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [storeFilter, setStoreFilter] = useState("todas");
  const [responsibleFilter, setResponsibleFilter] = useState("todos");

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

        // Admin pode escolher qualquer usuário como responsável
        if (user.role === "admin") {
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
        }

        // Motoristas:
        // - admin vê todos
        // - usuário comum vê TODOS os motoristas da própria loja (para compartilhar a lista)
        let driversSnap;
        if (user.role === "admin") {
          driversSnap = await getDocs(collection(db, "drivers"));
        } else {
          driversSnap = await getDocs(
            query(
              collection(db, "drivers"),
              where("storeId", "==", user.storeId)
            )
          );
        }

        const driversList: Driver[] = driversSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            storeId: data.storeId,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            active: data.active ?? true,
          };
        });

        setDrivers(driversList);
      } catch (error) {
        console.error("Erro ao carregar motoristas:", error);
        setErrorMsg("Erro ao carregar motoristas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  function resetForm() {
    setName("");
    // usuário comum já começa com a loja dele; admin fica em branco e será definido pelo responsável
    setStoreId(user?.role === "admin" ? "" : user?.storeId ?? "");
    setResponsibleId("");
    setErrorMsg("");
    setEditingDriver(null);
  }

  function closeFormDialog() {
    setFormOpen(false);
    resetForm();
  }

  function abrirFormNovo() {
    resetForm();
    setSuccessMsg("");
    setFormOpen(true);
  }

  function abrirFormEdicao(d: Driver) {
    setEditingDriver(d);
    setName(d.name);
    setStoreId(d.storeId);
    setResponsibleId(d.responsibleUserId);
    setErrorMsg("");
    setSuccessMsg("");
    setFormOpen(true);
  }

  // quando admin seleciona responsável, definimos a loja automaticamente
  function handleChangeResponsible(id: string) {
    setResponsibleId(id);
    if (!isAdmin) return;

    const u = users.find((u) => u.id === id);
    if (u) {
      setStoreId(u.storeId);
    }
  }

  async function handleCriarMotorista() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!name) {
        setErrorMsg("Preencha o nome do motorista.");
        return;
      }

      let responsibleUserId = user!.id;
      let responsibleUserName = user!.name;
      let storeToSave = storeId;

      if (isAdmin) {
        if (!responsibleId) {
          setErrorMsg("Selecione o responsável pelo motorista.");
          return;
        }
        const u = users.find((u) => u.id === responsibleId);
        if (!u) {
          setErrorMsg("Responsável inválido.");
          return;
        }
        responsibleUserId = u.id;
        responsibleUserName = u.name;
        storeToSave = u.storeId; // loja do motorista = loja do responsável
      } else {
        // usuário comum: força loja dele
        storeToSave = user!.storeId;
      }

      if (!storeToSave) {
        setErrorMsg("Não foi possível definir a loja do motorista.");
        return;
      }

      const docRef = await addDoc(collection(db, "drivers"), {
        name,
        storeId: storeToSave,
        responsibleUserId,
        responsibleUserName,
        active: true,
      });

      setDrivers((prev) => [
        ...prev,
        {
          id: docRef.id,
          name,
          storeId: storeToSave,
          responsibleUserId,
          responsibleUserName,
          active: true,
        },
      ]);

      closeFormDialog();
      setSuccessMsg("Motorista cadastrado com sucesso!");
    } catch (error) {
      console.error("Erro ao cadastrar motorista:", error);
      setErrorMsg("Erro ao cadastrar motorista. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAtualizarMotorista() {
    if (!editingDriver) return;

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!name) {
        setErrorMsg("Preencha o nome do motorista.");
        return;
      }

      let responsibleUserId = editingDriver.responsibleUserId;
      let responsibleUserName = editingDriver.responsibleUserName;
      let storeToSave = editingDriver.storeId;

      if (isAdmin) {
        if (!responsibleId) {
          setErrorMsg("Selecione o responsável pelo motorista.");
          return;
        }
        const u = users.find((u) => u.id === responsibleId);
        if (!u) {
          setErrorMsg("Responsável inválido.");
          return;
        }
        responsibleUserId = u.id;
        responsibleUserName = u.name;
        storeToSave = u.storeId;
      } else {
        // usuário comum não muda loja
        storeToSave = editingDriver.storeId || user!.storeId;
      }

      await updateDoc(doc(db, "drivers", editingDriver.id), {
        name,
        storeId: storeToSave,
        responsibleUserId,
        responsibleUserName,
      });

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === editingDriver.id
            ? {
                ...d,
                name,
                storeId: storeToSave,
                responsibleUserId,
                responsibleUserName,
              }
            : d
        )
      );

      closeFormDialog();
      setSuccessMsg("Motorista atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar motorista:", error);
      setErrorMsg("Erro ao atualizar motorista. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingDriver) {
      await handleAtualizarMotorista();
    } else {
      await handleCriarMotorista();
    }
  }

  async function handleDeleteMotorista() {
    if (!isAdmin || !deleteTarget) return;

    try {
      setBusyDriverId(deleteTarget.id);
      setErrorMsg("");
      setSuccessMsg("");

      await deleteDoc(doc(db, "drivers", deleteTarget.id));
      setDrivers((prev) =>
        prev.filter((item) => item.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
      setSuccessMsg("Motorista excluido com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir motorista:", error);
      setErrorMsg("Erro ao excluir motorista. Tente novamente.");
    } finally {
      setBusyDriverId(null);
    }
  }

  async function handleToggleAtivo(d: Driver) {
    try {
      setBusyDriverId(d.id);
      setErrorMsg("");
      setSuccessMsg("");
      const novoStatus = !d.active;
      await updateDoc(doc(db, "drivers", d.id), {
        active: novoStatus,
      });
      setDrivers((prev) =>
        prev.map((item) =>
          item.id === d.id ? { ...item, active: novoStatus } : item
        )
      );
      setSuccessMsg(
        novoStatus
          ? `Motorista ${d.name} ativado com sucesso.`
          : `Motorista ${d.name} desativado com sucesso.`
      );
    } catch (error) {
      console.error("Erro ao atualizar status do motorista:", error);
      setErrorMsg("Erro ao atualizar status. Tente novamente.");
    } finally {
      setBusyDriverId(null);
    }
  }

  // Resumo rápido
  const totalDrivers = drivers.length;
  const ativos = drivers.filter((d) => d.active).length;
  const inativos = drivers.filter((d) => !d.active).length;
  const totalStores = new Set(drivers.map((d) => d.storeId)).size;

  const isEditMode = !!editingDriver;
  const sortedDrivers = useMemo(() => {
    return [...drivers].sort((a, b) => {
      if (a.active !== b.active) {
        return Number(b.active) - Number(a.active);
      }

      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [drivers]);

  const storeOptions = useMemo(() => {
    const values = new Set<string>();

    sortedDrivers.forEach((driver) => {
      if (driver.storeId) values.add(driver.storeId);
    });

    users.forEach((responsibleUser) => {
      if (responsibleUser.storeId) values.add(responsibleUser.storeId);
    });

    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sortedDrivers, users]);

  const responsibleOptions = useMemo(() => {
    if (isAdmin) return users;

    return sortedDrivers.reduce<SimpleUser[]>((acc, driver) => {
      if (
        driver.responsibleUserId &&
        !acc.find((item) => item.id === driver.responsibleUserId)
      ) {
        acc.push({
          id: driver.responsibleUserId,
          name: driver.responsibleUserName,
          storeId: driver.storeId,
        });
      }

      return acc;
    }, []);
  }, [isAdmin, sortedDrivers, users]);

  const filteredDrivers = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return sortedDrivers.filter((driver) => {
      const matchesSearch =
        !normalizedSearch ||
        normalizeText(driver.name).includes(normalizedSearch) ||
        normalizeText(driver.storeId).includes(normalizedSearch) ||
        normalizeText(driver.responsibleUserName).includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativos" && driver.active) ||
        (statusFilter === "inativos" && !driver.active);

      const matchesStore =
        storeFilter === "todas" || driver.storeId === storeFilter;

      const matchesResponsible =
        responsibleFilter === "todos" ||
        driver.responsibleUserId === responsibleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesStore &&
        matchesResponsible
      );
    });
  }, [responsibleFilter, searchTerm, sortedDrivers, statusFilter, storeFilter]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 ||
    statusFilter !== "todos" ||
    storeFilter !== "todas" ||
    responsibleFilter !== "todos";

  const currentScopeLabel =
    filteredDrivers.length === totalDrivers
      ? `${totalDrivers} motorista(s) cadastrados`
      : `${filteredDrivers.length} de ${totalDrivers} motorista(s) visiveis`;

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Equipe de campo"
        title="Motoristas"
        description="Organize a equipe habilitada para rotas com visao clara por loja, responsavel e disponibilidade operacional."
        icon={Users}
        badges={
          <>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-yellow-300" />
              {totalDrivers} motoristas
            </span>
            <span className="app-chip">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {ativos} ativos
            </span>
          </>
        }
        actions={<Button onClick={abrirFormNovo}>+ Novo motorista</Button>}
      />

      {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}
      {successMsg ? (
        <StatusBanner tone="success">{successMsg}</StatusBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total"
          value={String(totalDrivers)}
          helper="Cadastros disponiveis para consulta e operacao."
          icon={Users}
          accent="blue"
        />
        <MetricCard
          label="Ativos"
          value={String(ativos)}
          helper="Motoristas liberados para novas rotas."
          icon={ShieldCheck}
          accent="green"
        />
        <MetricCard
          label="Inativos"
          value={String(inativos)}
          helper="Cadastros preservados para historico e auditoria."
          icon={UserRoundCog}
          accent="red"
        />
        <MetricCard
          label="Lojas"
          value={String(totalStores)}
          helper="Unidades com equipe cadastrada no momento."
          icon={Store}
          accent="yellow"
        />
      </div>

      <Card className="app-panel p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-300">
              Filtros e busca
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              Encontre rapidamente a equipe certa
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {currentScopeLabel}
            </p>
          </div>

          {hasActiveFilters ? (
            <Button
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("todos");
                setStoreFilter("todas");
                setResponsibleFilter("todos");
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3 md:col-span-2 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Buscar
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-yellow-500 dark:text-yellow-300" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busque por nome, loja ou responsavel"
                className="h-11 rounded-2xl border-slate-300 bg-slate-50 pl-10 text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Status
            </label>
            <select
              className={selectBaseClassName}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="todos">Todos</option>
              <option value="ativos">Somente ativos</option>
              <option value="inativos">Somente inativos</option>
            </select>
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.02]">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Loja
            </label>
            <select
              className={selectBaseClassName}
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="todas">Todas as lojas</option>
              {storeOptions.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.02] ${
              isAdmin ? "" : "xl:col-span-2"
            }`}
          >
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Responsavel
            </label>
            <select
              className={selectBaseClassName}
              value={responsibleFilter}
              onChange={(e) => setResponsibleFilter(e.target.value)}
            >
              <option value="todos">Todos os responsaveis</option>
              {responsibleOptions.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="app-panel p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Lista principal
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
              Equipe cadastrada
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Visualize status, loja e responsabilidade operacional em um unico lugar.
            </p>
          </div>

          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            {currentScopeLabel}
          </span>
        </div>

        {loading ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.04]"
              />
            ))}
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-12 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {drivers.length === 0
                ? "Nenhum motorista cadastrado ainda."
                : "Nenhum motorista encontrado com os filtros atuais."}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {drivers.length === 0
                ? "Comece cadastrando a equipe que sera usada nas rotas."
                : "Ajuste os filtros ou limpe a busca para voltar a ver a lista completa."}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {filteredDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-950 dark:text-white">
                        {driver.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Responsavel: {driver.responsibleUserName || "-"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        driver.active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {driver.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                        Loja
                      </p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {driver.storeId || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <p className="uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                        Responsavel
                      </p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                        {driver.responsibleUserName || "-"}
                      </p>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ActionIconButton
                        action={driver.active ? "deactivate" : "activate"}
                        loading={busyDriverId === driver.id}
                        onClick={() => handleToggleAtivo(driver)}
                      />

                      <ActionIconButton
                        action="edit"
                        onClick={() => abrirFormEdicao(driver)}
                      />

                      <ActionIconButton
                        action="delete"
                        onClick={() => setDeleteTarget(driver)}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="min-w-[860px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="py-3 pr-3 font-medium">Motorista</th>
                    <th className="px-3 py-3 font-medium">Loja</th>
                    <th className="px-3 py-3 font-medium">Responsavel</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    {isAdmin ? (
                      <th className="py-3 pl-3 text-right font-medium">Acoes</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((driver) => (
                    <tr
                      key={driver.id}
                      className="border-b border-slate-200/80 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.03]"
                    >
                      <td className="py-3 pr-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {driver.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            ID: {driver.id}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                        {driver.storeId || "-"}
                      </td>
                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                        {driver.responsibleUserName || "-"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            driver.active
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-red-500/15 text-red-300"
                          }`}
                        >
                          {driver.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      {isAdmin ? (
                        <td className="py-3 pl-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <ActionIconButton
                              action={driver.active ? "deactivate" : "activate"}
                              loading={busyDriverId === driver.id}
                              onClick={() => handleToggleAtivo(driver)}
                            />

                            <ActionIconButton
                              action="edit"
                              onClick={() => abrirFormEdicao(driver)}
                            />

                            <ActionIconButton
                              action="delete"
                              onClick={() => setDeleteTarget(driver)}
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            closeFormDialog();
          }
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <form
            className="flex max-h-[calc(100vh-2rem)] flex-col"
            onSubmit={handleSubmit}
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                {isEditMode ? (
                  <PencilLine className="h-5 w-5 text-yellow-500" />
                ) : (
                  <UserPlus className="h-5 w-5 text-yellow-500" />
                )}
                {isEditMode ? "Editar motorista" : "Novo motorista"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Atualize os dados do motorista sem perder o vinculo com a loja e o responsavel."
                  : "Cadastre a equipe que podera ser selecionada nas rotas da operacao."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {errorMsg ? <StatusBanner tone="error">{errorMsg}</StatusBanner> : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Nome do motorista
                  </label>
                  <Input
                    placeholder="Digite o nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-2xl border-slate-200 dark:border-white/10 dark:bg-white/[0.03]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Loja / unidade
                  </label>
                  <Input
                    value={isAdmin ? storeId : user?.storeId ?? storeId}
                    readOnly
                    placeholder="Loja definida pelo responsavel"
                    className="h-11 rounded-2xl border-slate-200 dark:border-white/10 dark:bg-white/[0.03]"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {isAdmin
                      ? "A loja segue a unidade do responsavel selecionado."
                      : "Os motoristas cadastrados aqui ficam disponiveis para a sua unidade."}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Responsavel
                  </label>
                  {isAdmin ? (
                    <select
                      className={selectBaseClassName}
                      value={responsibleId}
                      onChange={(e) => handleChangeResponsible(e.target.value)}
                    >
                      <option value="">Selecione um responsavel</option>
                      {users.map((responsible) => (
                        <option key={responsible.id} value={responsible.id}>
                          {responsible.name} ({responsible.storeId})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      readOnly
                      value={user?.name ?? ""}
                      className="h-11 rounded-2xl border-slate-200 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                  )}
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Responsavel pelo cadastro e pela gestao operacional deste motorista.
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Leitura rapida
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-black/10">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Nome informado
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {name.trim() || "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-black/10">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Loja vinculada
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                      {(isAdmin ? storeId : user?.storeId ?? storeId) || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
              <Button
                type="button"
                variant="destructive"
                className="text-sm"
                onClick={closeFormDialog}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? isEditMode
                    ? "Salvando alteracoes..."
                    : "Salvando..."
                  : isEditMode
                  ? "Salvar alteracoes"
                  : "Salvar motorista"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && busyDriverId !== deleteTarget?.id) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-xl border-blue-100 bg-white dark:border-yellow-400/10 dark:bg-[#08080a]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Excluir motorista
            </DialogTitle>
            <DialogDescription>
              Revise a acao antes de remover este cadastro da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-red-200 bg-red-50/70 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
              <p className="font-medium">
                Voce esta prestes a excluir {deleteTarget?.name || "este motorista"}.
              </p>
              <p className="mt-1 text-sm">
                Confirme somente se este cadastro realmente nao for mais necessario.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Dados do cadastro
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Motorista:</span>{" "}
                  {deleteTarget?.name || "-"}
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Loja:</span>{" "}
                  {deleteTarget?.storeId || "-"}
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">Responsavel:</span>{" "}
                  {deleteTarget?.responsibleUserName || "-"}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteTarget(null)}
              disabled={busyDriverId === deleteTarget?.id}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteMotorista}
              disabled={busyDriverId === deleteTarget?.id}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {busyDriverId === deleteTarget?.id ? "Excluindo..." : "Excluir motorista"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
