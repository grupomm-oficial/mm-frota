"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  type UserCredential,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  Building2,
  KeyRound,
  Search,
  ShieldCheck,
  UserCog,
  UserRoundPlus,
  Users2,
  UserX,
} from "lucide-react";

import { ActionIconButton } from "@/components/ui/action-icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/layout/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageLoadingState } from "@/components/layout/PageLoadingState";
import { StatusBanner } from "@/components/layout/StatusBanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { db, secondaryAuth } from "@/lib/firebase";
import {
  getCanonicalStoreOptions,
  normalizeStoreKey,
} from "@/lib/store-utils";

type UserRole = "admin" | "user";
type RoleFilter = "todos" | UserRole;
type StatusFilter = "todos" | "ativos" | "inativos";

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
  username: string;
  active: boolean;
  mustChangePassword: boolean;
}

interface AccessNotice {
  name: string;
  username: string;
  tempPassword: string;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@";
  let password = "";

  for (let index = 0; index < 10; index += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }

  return password;
}

function sortUsers(list: AppUser[]) {
  return [...list].sort((a, b) => {
    if (a.active !== b.active) {
      return Number(b.active) - Number(a.active);
    }

    if (a.role !== b.role) {
      return a.role === "admin" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function getRoleLabel(role: UserRole) {
  return role === "admin" ? "Administrador" : "Responsavel";
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

export default function UsuariosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [storeId, setStoreId] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [mustChangePassword, setMustChangePassword] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [storeFilter, setStoreFilter] = useState("todas");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [accessNotice, setAccessNotice] = useState<AccessNotice | null>(null);

  useEffect(() => {
    if (!user) return;

    if (user.role !== "admin") {
      router.replace("/rotas");
    }
  }, [router, user]);

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      if (!user || user.role !== "admin") return;

      try {
        setLoading(true);
        setErrorMsg("");

        const snap = await getDocs(collection(db, "users"));

        if (!mounted) return;

        const nextUsers = snap.docs.map((snapshot) => {
          const data = snapshot.data();

          return {
            id: snapshot.id,
            name: typeof data.name === "string" ? data.name : "Usuario MM",
            email: typeof data.email === "string" ? data.email : "",
            role: data.role === "admin" ? "admin" : "user",
            storeId: typeof data.storeId === "string" ? data.storeId : "",
            username: typeof data.username === "string" ? data.username : "",
            active: data.active !== false,
            mustChangePassword: Boolean(data.mustChangePassword),
          } satisfies AppUser;
        });

        setUsersList(sortUsers(nextUsers));
      } catch (error) {
        console.error("Erro ao carregar usuarios:", error);
        setErrorMsg("Nao foi possivel carregar os acessos. Tente novamente.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      mounted = false;
    };
  }, [user]);

  const totalUsers = usersList.length;
  const activeUsers = usersList.filter((item) => item.active).length;
  const adminUsers = usersList.filter((item) => item.role === "admin").length;
  const passwordPendingUsers = usersList.filter(
    (item) => item.mustChangePassword
  ).length;

  const storeOptions = useMemo(
    () => getCanonicalStoreOptions(usersList.map((item) => item.storeId)),
    [usersList]
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return usersList.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.username.toLowerCase().includes(normalizedSearch) ||
        item.email.toLowerCase().includes(normalizedSearch) ||
        item.storeId.toLowerCase().includes(normalizedSearch);

      const matchesRole = roleFilter === "todos" || item.role === roleFilter;
      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativos" && item.active) ||
        (statusFilter === "inativos" && !item.active);
      const matchesStore =
        storeFilter === "todas" ||
        normalizeStoreKey(item.storeId) === storeFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesStore;
    });
  }, [roleFilter, searchTerm, statusFilter, storeFilter, usersList]);

  const isEditMode = Boolean(editingUser);
  const filtersApplied =
    searchTerm.trim() !== "" ||
    roleFilter !== "todos" ||
    statusFilter !== "todos" ||
    storeFilter !== "todas";

  function resetFormFields() {
    setEditingUser(null);
    setName("");
    setEmail("");
    setUsername("");
    setStoreId(user?.storeId ?? "");
    setRole("user");
    setMustChangePassword(true);
    setErrorMsg("");
  }

  function openCreateForm() {
    setSuccessMsg("");
    setErrorMsg("");
    resetFormFields();
    setFormOpen(true);
  }

  function openEditForm(selectedUser: AppUser) {
    setSuccessMsg("");
    setErrorMsg("");
    setEditingUser(selectedUser);
    setName(selectedUser.name);
    setEmail(selectedUser.email);
    setUsername(selectedUser.username);
    setStoreId(selectedUser.storeId);
    setRole(selectedUser.role);
    setMustChangePassword(selectedUser.mustChangePassword);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    resetFormFields();
  }

  function clearFilters() {
    setSearchTerm("");
    setRoleFilter("todos");
    setStatusFilter("todos");
    setStoreFilter("todas");
  }

  async function isUsernameAvailable(
    normalizedUsername: string,
    currentUserId?: string
  ) {
    const usernameSnap = await getDoc(doc(db, "usernames", normalizedUsername));

    if (!usernameSnap.exists()) {
      return true;
    }

    const usernameData = usernameSnap.data();
    return currentUserId
      ? usernameData.userId === currentUserId
      : false;
  }

  async function handleCreateUser() {
    let createdCredential: UserCredential | null = null;

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedStoreId = storeId.trim();
      const normalizedUsername = normalizeUsername(username);

      if (!trimmedName || !trimmedEmail || !trimmedStoreId || !normalizedUsername) {
        setErrorMsg("Preencha nome, email, usuario e loja.");
        return;
      }

      if (!trimmedEmail.includes("@")) {
        setErrorMsg("Informe um email valido.");
        return;
      }

      if (normalizedUsername.length < 3) {
        setErrorMsg("O nome de usuario deve ter pelo menos 3 caracteres.");
        return;
      }

      if (
        usersList.some(
          (item) => item.email.toLowerCase() === trimmedEmail.toLowerCase()
        )
      ) {
        setErrorMsg("Ja existe um acesso cadastrado com este email.");
        return;
      }

      if (
        usersList.some((item) => item.username.toLowerCase() === normalizedUsername)
      ) {
        setErrorMsg("Este nome de usuario ja esta em uso.");
        return;
      }

      const usernameAvailable = await isUsernameAvailable(normalizedUsername);

      if (!usernameAvailable) {
        setErrorMsg("Este nome de usuario ja esta em uso.");
        return;
      }

      const generatedPassword = generateTempPassword();

      createdCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        trimmedEmail,
        generatedPassword
      );

      const userRef = doc(db, "users", createdCredential.user.uid);
      const usernameRef = doc(db, "usernames", normalizedUsername);
      const batch = writeBatch(db);

      batch.set(userRef, {
        name: trimmedName,
        email: trimmedEmail,
        role,
        storeId: trimmedStoreId,
        username: normalizedUsername,
        active: true,
        mustChangePassword: true,
      });
      batch.set(usernameRef, {
        email: trimmedEmail,
        userId: createdCredential.user.uid,
      });

      await batch.commit();

      const createdUser = {
        id: createdCredential.user.uid,
        name: trimmedName,
        email: trimmedEmail,
        role,
        storeId: trimmedStoreId,
        username: normalizedUsername,
        active: true,
        mustChangePassword: true,
      } satisfies AppUser;

      setUsersList((previous) => sortUsers([...previous, createdUser]));
      setAccessNotice({
        name: trimmedName,
        username: normalizedUsername,
        tempPassword: generatedPassword,
      });
      setSuccessMsg("Acesso criado com sucesso.");
      closeForm();
    } catch (error) {
      console.error("Erro ao criar usuario:", error);

      const errorCode = getErrorCode(error);

      if (createdCredential) {
        setErrorMsg(
          "O usuario foi criado na autenticacao, mas houve falha ao concluir o cadastro. Revise este acesso antes de tentar novamente."
        );
      } else if (errorCode === "auth/email-already-in-use") {
        setErrorMsg("Este email ja esta em uso na autenticacao.");
      } else {
        setErrorMsg("Nao foi possivel criar o usuario. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateUser() {
    if (!editingUser || !user) return;

    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      const trimmedName = name.trim();
      const trimmedStoreId = storeId.trim();
      const normalizedUsername = normalizeUsername(username);

      if (!trimmedName || !trimmedStoreId || !normalizedUsername) {
        setErrorMsg("Preencha nome, usuario e loja.");
        return;
      }

      if (normalizedUsername.length < 3) {
        setErrorMsg("O nome de usuario deve ter pelo menos 3 caracteres.");
        return;
      }

      if (
        editingUser.id === user.id &&
        editingUser.role !== role
      ) {
        setErrorMsg(
          "Para evitar perda de acesso, altere o papel da sua propria conta com outro administrador."
        );
        return;
      }

      const usernameChanged =
        editingUser.username.toLowerCase() !== normalizedUsername;

      if (
        usersList.some(
          (item) =>
            item.id !== editingUser.id &&
            item.username.toLowerCase() === normalizedUsername
        )
      ) {
        setErrorMsg("Este nome de usuario ja esta em uso.");
        return;
      }

      if (usernameChanged) {
        const usernameAvailable = await isUsernameAvailable(
          normalizedUsername,
          editingUser.id
        );

        if (!usernameAvailable) {
          setErrorMsg("Este nome de usuario ja esta em uso.");
          return;
        }
      }

      const userRef = doc(db, "users", editingUser.id);
      const batch = writeBatch(db);

      batch.update(userRef, {
        name: trimmedName,
        storeId: trimmedStoreId,
        role,
        username: normalizedUsername,
        mustChangePassword,
      });

      if (usernameChanged) {
        batch.set(doc(db, "usernames", normalizedUsername), {
          email: editingUser.email,
          userId: editingUser.id,
        });
        batch.delete(doc(db, "usernames", editingUser.username));
      }

      await batch.commit();

      setUsersList((previous) =>
        sortUsers(
          previous.map((item) =>
            item.id === editingUser.id
              ? {
                  ...item,
                  name: trimmedName,
                  storeId: trimmedStoreId,
                  role,
                  username: normalizedUsername,
                  mustChangePassword,
                }
              : item
          )
        )
      );

      setSuccessMsg("Acesso atualizado com sucesso.");
      closeForm();
    } catch (error) {
      console.error("Erro ao atualizar usuario:", error);
      setErrorMsg("Nao foi possivel atualizar o acesso. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(selectedUser: AppUser) {
    if (!user) return;

    if (selectedUser.id === user.id) {
      setErrorMsg("Voce nao pode inativar o seu proprio acesso.");
      return;
    }

    try {
      setTogglingUserId(selectedUser.id);
      setErrorMsg("");
      setSuccessMsg("");

      const nextStatus = !selectedUser.active;

      await updateDoc(doc(db, "users", selectedUser.id), {
        active: nextStatus,
      });

      setUsersList((previous) =>
        sortUsers(
          previous.map((item) =>
            item.id === selectedUser.id ? { ...item, active: nextStatus } : item
          )
        )
      );

      setSuccessMsg(
        nextStatus
          ? "Acesso reativado com sucesso."
          : "Acesso inativado com sucesso."
      );
    } catch (error) {
      console.error("Erro ao alterar status do usuario:", error);
      setErrorMsg("Nao foi possivel alterar o status do usuario.");
    } finally {
      setTogglingUserId(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (editingUser) {
      await handleUpdateUser();
      return;
    }

    await handleCreateUser();
  }

  if (!user) {
    return (
      <div className="app-shell px-4 py-6 md:px-6">
        <PageLoadingState
          title="Carregando administracao"
          description="Estamos organizando os acessos para voce continuar com seguranca."
          compact
        />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="app-page">
        <StatusBanner tone="error">
          Acesso restrito. Apenas administradores podem gerenciar usuarios.
        </StatusBanner>
      </div>
    );
  }

  return (
    <div className="app-page">
      <PageHeader
        eyebrow="Governanca de acesso"
        title="Administracao de usuarios"
        description="Acessos, perfis e lojas em uma operacao mais limpa e controlada."
        icon={ShieldCheck}
        badges={
          <>
            <span className="app-chip">
              <Users2 className="h-3.5 w-3.5" />
              {totalUsers} acessos
            </span>
            <span className="app-chip">
              <Building2 className="h-3.5 w-3.5" />
              {storeOptions.length} lojas
            </span>
            <span className="app-chip">
              <KeyRound className="h-3.5 w-3.5" />
              {passwordPendingUsers} troca(s) pendente(s)
            </span>
          </>
        }
        actions={
          <Button onClick={openCreateForm}>
            <UserRoundPlus className="h-4 w-4" />
            Novo acesso
          </Button>
        }
      />

      {accessNotice ? (
        <Card className="app-toolbar-shell gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="app-kicker">Credencial criada</p>
              <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                Senha temporaria pronta para entrega
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                O primeiro acesso continua exigindo troca imediata de senha.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setAccessNotice(null)}
            >
              Fechar aviso
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">
                Usuario
              </p>
              <p className="app-inline-stat-value text-base">
                {accessNotice.name}
              </p>
            </div>

            <div className="app-inline-stat">
              <p className="app-inline-stat-label">
                Login
              </p>
              <p className="app-inline-stat-value font-mono text-base">
                {accessNotice.username}
              </p>
            </div>

            <div className="app-inline-stat">
              <p className="app-inline-stat-label">
                Senha temporaria
              </p>
              <p className="app-inline-stat-value font-mono text-base text-blue-700 dark:text-yellow-200">
                {accessNotice.tempPassword}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {successMsg ? <StatusBanner tone="success">{successMsg}</StatusBanner> : null}
      {!formOpen && errorMsg ? (
        <StatusBanner tone="error">{errorMsg}</StatusBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          label="Acessos ativos"
          value={String(activeUsers)}
          helper="Usuarios aptos para operar."
          icon={Users2}
          accent="green"
          size="hero"
          className="min-h-[176px]"
        />
        <MetricCard
          label="Administradores"
          value={String(adminUsers)}
          helper="Controle total do ambiente."
          icon={ShieldCheck}
          accent="blue"
          size="hero"
          className="min-h-[176px]"
        />
        <MetricCard
          label="Troca de senha"
          value={String(passwordPendingUsers)}
          helper="Primeiro acesso ainda pendente."
          icon={KeyRound}
          accent="yellow"
          className="min-h-[168px]"
        />
        <MetricCard
          label="Contas inativas"
          value={String(totalUsers - activeUsers)}
          helper="Acessos pausados no sistema."
          icon={UserX}
          accent="red"
          className="min-h-[168px]"
        />
      </div>

      <Card className="app-toolbar-shell gap-4">
        <div className="app-toolbar-head">
          <div className="space-y-1.5">
            <p className="app-kicker">Busca e filtros</p>
            <h2 className="app-toolbar-title">Localize acessos com rapidez</h2>
            <p className="app-toolbar-copy">
              Pesquise por nome, usuario, loja ou perfil.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="app-chip">{filteredUsers.length} em tela</span>
            <span className="app-chip">{activeUsers} ativos</span>
            <span className="app-chip">{storeOptions.length} lojas</span>
          </div>
        </div>

        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Buscar acesso
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Busque por nome, usuario, email ou loja"
                className="app-field pl-10"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Perfil
            </label>
            <select
              className="app-select"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            >
              <option value="todos">Todos os perfis</option>
              <option value="admin">Administradores</option>
              <option value="user">Responsaveis</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Status
            </label>
            <select
              className="app-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              <option value="todos">Todos os status</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Loja
            </label>
            <select
              className="app-select"
              value={storeFilter}
              onChange={(event) => setStoreFilter(event.target.value)}
            >
              <option value="todas">Todas as lojas</option>
              {storeOptions.map((storeOption) => (
                <option key={storeOption.key} value={storeOption.key}>
                  {storeOption.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading
              ? "Buscando acessos..."
              : `${filteredUsers.length} acesso(s) exibido(s) nesta visao.`}
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            disabled={!filtersApplied}
          >
            Limpar filtros
          </Button>
        </div>
      </Card>

      <Card className="app-panel p-4 md:p-5">
        <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="app-kicker">Base de acessos</p>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
              Usuarios cadastrados
            </h2>
          </div>

          <span className="app-chip">{filteredUsers.length} registro(s)</span>
        </div>

        {loading ? (
          <div className="pt-4">
            <PageLoadingState
              title="Carregando usuarios"
              description="Estamos organizando os acessos cadastrados para voce continuar sem repetir a acao."
              compact
            />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="app-empty-state mt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nenhum acesso encontrado com os filtros atuais.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 pt-4 md:hidden">
              {filteredUsers.map((item) => (
                <div
                  key={item.id}
                  className="app-list-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                        {item.name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.username}
                      </p>
                    </div>

                    <span
                      className={
                        item.active
                          ? "rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                          : "rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                      }
                    >
                      {item.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Perfil</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {getRoleLabel(item.role)}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Loja</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {item.storeId}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Email</p>
                      <p className="mt-1 break-all font-medium text-slate-900 dark:text-white">
                        {item.email || "-"}
                      </p>
                    </div>
                    <div className="app-panel-muted p-3">
                      <p className="text-slate-500 dark:text-slate-400">Senha</p>
                      <p className="mt-1 font-medium text-slate-900 dark:text-white">
                        {item.mustChangePassword ? "Troca pendente" : "Configurada"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionIconButton
                      action="edit"
                      label={`Editar ${item.name}`}
                      iconOnly
                      onClick={() => openEditForm(item)}
                    />
                    <ActionIconButton
                      action={item.active ? "deactivate" : "activate"}
                      label={
                        item.active
                          ? `Inativar ${item.name}`
                          : `Reativar ${item.name}`
                      }
                      iconOnly
                      loading={togglingUserId === item.id}
                      onClick={() => handleToggleActive(item)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto pt-4 md:block">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Usuario</th>
                    <th>Loja</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Senha</th>
                    <th className="text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.email || "Email nao informado"}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-sm">{item.username}</span>
                      </td>
                      <td>{item.storeId}</td>
                      <td>
                        <span
                          className={
                            item.role === "admin"
                              ? "inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200"
                              : "inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                          }
                        >
                          {getRoleLabel(item.role)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            item.active
                              ? "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
                          }
                        >
                          {item.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            item.mustChangePassword
                              ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
                              : "inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                          }
                        >
                          {item.mustChangePassword ? "Troca pendente" : "Configurada"}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <ActionIconButton
                            action="edit"
                            label={`Editar ${item.name}`}
                            iconOnly
                            onClick={() => openEditForm(item)}
                          />
                          <ActionIconButton
                            action={item.active ? "deactivate" : "activate"}
                            label={
                              item.active
                                ? `Inativar ${item.name}`
                                : `Reativar ${item.name}`
                            }
                            iconOnly
                            loading={togglingUserId === item.id}
                            onClick={() => handleToggleActive(item)}
                          />
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

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
            return;
          }

          setFormOpen(true);
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden border-blue-100 bg-white p-0 dark:border-yellow-400/10 dark:bg-[#08080a]">
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[calc(100vh-2rem)] flex-col"
          >
            <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-slate-950 dark:text-white">
                {isEditMode ? (
                  <UserCog className="h-5 w-5 text-yellow-500" />
                ) : (
                  <UserRoundPlus className="h-5 w-5 text-yellow-500" />
                )}
                {isEditMode ? "Editar acesso" : "Novo acesso"}
              </DialogTitle>
              <DialogDescription>
                {isEditMode
                  ? "Atualize os dados de identificacao, loja e politicas de acesso deste usuario."
                  : "Cadastre um novo usuario com senha temporaria e troca obrigatoria no primeiro acesso."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Nome completo
                  </label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex: Maria Souza"
                    className="app-field"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Email de autenticacao
                  </label>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="usuario@grupomm.com.br"
                    disabled={isEditMode}
                    className={`app-field ${isEditMode ? "opacity-70" : ""}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Usuario para login
                  </label>
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Ex: maria.cedral"
                    className="app-field"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Loja / unidade
                  </label>
                  <Input
                    value={storeId}
                    onChange={(event) => setStoreId(event.target.value)}
                    placeholder="Ex: destack-cedral"
                    className="app-field"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Perfil de acesso
                  </p>
                  <div className="mt-3 space-y-2">
                    <select
                      className="app-select"
                      value={role}
                      onChange={(event) => setRole(event.target.value as UserRole)}
                    >
                      <option value="user">Responsavel por loja</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {role === "admin"
                        ? "Pode gerenciar toda a plataforma, relatorios e administracao."
                        : "Focado na operacao da loja, com acesso aos modulos do dia a dia."}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Politica de senha
                  </p>

                  {isEditMode ? (
                    <label className="mt-3 flex items-start gap-3 rounded-[20px] border border-border bg-white/80 p-3 dark:bg-slate-950/50">
                      <input
                        type="checkbox"
                        checked={mustChangePassword}
                        onChange={(event) =>
                          setMustChangePassword(event.target.checked)
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Exigir troca de senha no proximo acesso deste usuario.
                      </span>
                    </label>
                  ) : (
                    <div className="mt-3 rounded-[20px] border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                      A senha temporaria sera gerada automaticamente e a troca no
                      primeiro acesso sera obrigatoria.
                    </div>
                  )}
                </div>
              </div>

              {isEditMode && editingUser ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Resumo do acesso
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p>
                        Status atual:{" "}
                        <span className="font-semibold">
                          {editingUser.active ? "Ativo" : "Inativo"}
                        </span>
                      </p>
                      <p>
                        Papel atual:{" "}
                        <span className="font-semibold">
                          {getRoleLabel(editingUser.role)}
                        </span>
                      </p>
                      <p>
                        ID interno:{" "}
                        <span className="font-mono text-xs">{editingUser.id}</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Observacoes
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Contas inativas nao conseguem entrar no sistema. Mudancas de
                      perfil para a sua propria conta devem ser feitas com apoio de
                      outro administrador.
                    </p>
                  </div>
                </div>
              ) : null}

              {formOpen && errorMsg ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                  {errorMsg}
                </div>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-border bg-white px-6 py-4 dark:bg-[#08080a]">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? isEditMode
                    ? "Salvando alteracoes..."
                    : "Criando acesso..."
                  : isEditMode
                  ? "Salvar alteracoes"
                  : "Criar acesso"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
