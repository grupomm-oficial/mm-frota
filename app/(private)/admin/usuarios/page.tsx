"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, secondaryAuth } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  UserCredential,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: "admin" | "user";
  storeId: string;
  username?: string;
  active?: boolean;
  mustChangePassword?: boolean;
}

export default function UsuariosPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Controle do formulário (criação / edição)
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // "null" = criando novo; diferente de null = editando
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // campos do formulário
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [storeId, setStoreId] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [tempPassword, setTempPassword] = useState("");

  // Apenas admin pode acessar
  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Carregar usuários
  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "users"));
        const list: AppUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            email: data.email,
            role: data.role,
            storeId: data.storeId,
            username: data.username,
            active: data.active ?? true,
            mustChangePassword: data.mustChangePassword,
          };
        });
        setUsersList(list);
      } catch (err) {
        console.error("Erro ao carregar usuários:", err);
        setErrorMsg("Erro ao carregar usuários. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    if (user && user.role === "admin") {
      loadUsers();
    }
  }, [user]);

  function gerarSenhaTemporaria() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < 8; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }

  function resetForm() {
    setNome("");
    setEmail("");
    setUsername("");
    setStoreId("");
    setRole("user");
    setTempPassword("");
    setErrorMsg("");
    setSuccessMsg("");
    setEditingUser(null);
  }

  async function handleCriarUsuario() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!nome || !email || !username || !storeId) {
        setErrorMsg("Preencha todos os campos.");
        return;
      }

      if (!email.includes("@")) {
        setErrorMsg("Digite um email válido.");
        return;
      }

      // gerar senha temporária
      const generatedPass = gerarSenhaTemporaria();
      setTempPassword(generatedPass);

      // 1) Criar usuário no Auth usando o secondaryAuth
      let cred: UserCredential;
      try {
        cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          generatedPass
        );
      } catch (error: any) {
        console.error("Erro ao criar usuário no Auth:", error);
        if (error.code === "auth/email-already-in-use") {
          setErrorMsg("Este email já está em uso no Auth.");
        } else {
          setErrorMsg(
            "Erro ao criar usuário no Auth. Verifique o email ou tente novamente."
          );
        }
        return;
      }

      const uid = cred.user.uid;

      // 2) Criar doc em "users"
      await setDoc(doc(db, "users", uid), {
        name: nome,
        email,
        role,
        storeId,
        username,
        active: true,
        mustChangePassword: true,
      });

      // 3) Criar doc em "usernames"
      await setDoc(doc(db, "usernames", username), {
        email,
        userId: uid,
      });

      // Atualizar lista local
      setUsersList((prev) => [
        ...prev,
        {
          id: uid,
          name: nome,
          email,
          role,
          storeId,
          username,
          active: true,
          mustChangePassword: true,
        },
      ]);

      setSuccessMsg(
        `Usuário criado com sucesso! Senha temporária: ${generatedPass}`
      );
      // Mantém o form aberto para você copiar a senha
    } catch (error: any) {
      console.error("Erro geral ao criar usuário:", error);
      setErrorMsg("Erro ao criar usuário. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAtualizarUsuario() {
    if (!editingUser) return;

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!nome || !username || !storeId) {
        setErrorMsg("Preencha nome, username e loja.");
        return;
      }

      // 1) Atualizar documento do usuário
      await updateDoc(doc(db, "users", editingUser.id), {
        name: nome,
        storeId,
        role,
        username,
      });

      // 2) Se o username mudou, atualizar coleção "usernames"
      if (editingUser.username && editingUser.username !== username) {
        // cria novo doc com mesmo email
        await setDoc(doc(db, "usernames", username), {
          email: editingUser.email,
          userId: editingUser.id,
        });

        // remove o antigo username
        await deleteDoc(doc(db, "usernames", editingUser.username));
      }

      // Atualiza lista local
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                name: nome,
                storeId,
                role,
                username,
              }
            : u
        )
      );

      setSuccessMsg("Usuário atualizado com sucesso!");
      setFormOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      setErrorMsg("Erro ao atualizar usuário. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingUser) {
      await handleAtualizarUsuario();
    } else {
      await handleCriarUsuario();
    }
  }

  async function handleToggleAtivo(u: AppUser) {
    try {
      const novoStatus = !u.active;
      await updateDoc(doc(db, "users", u.id), {
        active: novoStatus,
      });
      setUsersList((prev) =>
        prev.map((item) =>
          item.id === u.id ? { ...item, active: novoStatus } : item
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      setErrorMsg("Erro ao atualizar status do usuário.");
    }
  }

  function abrirFormNovo() {
    resetForm();
    setFormOpen(true);
  }

  function abrirFormEdicao(u: AppUser) {
    setEditingUser(u);
    setNome(u.name);
    setEmail(u.email ?? "");
    setUsername(u.username ?? "");
    setStoreId(u.storeId);
    setRole(u.role);
    setTempPassword("");
    setErrorMsg("");
    setSuccessMsg("");
    setFormOpen(true);
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="p-6">
        <p className="text-red-400">
          Acesso restrito. Apenas administradores podem gerenciar usuários.
        </p>
      </div>
    );
  }

  const isEditMode = !!editingUser;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Gestão de Usuários
          </h1>
          <p className="text-sm text-gray-400">
            Administre os responsáveis pelos veículos, rotas e gastos do Grupo MM.
          </p>
        </div>

        <Button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          onClick={abrirFormNovo}
        >
          + Novo usuário
        </Button>
      </div>

      {/* Formulário (criação / edição) */}
      {formOpen && (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-yellow-400">
              {isEditMode ? "Editar usuário" : "Novo usuário"}
            </h2>
            {isEditMode && (
              <span className="text-[11px] px-2 py-[2px] rounded-full bg-neutral-800 border border-neutral-700 text-gray-300">
                ID: {editingUser?.id}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              <Input
                placeholder="Email (Auth)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isEditMode} // não mexe no email do Auth por aqui
                className={`bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500 ${
                  isEditMode ? "opacity-60 cursor-not-allowed" : ""
                }`}
              />

              <Input
                placeholder="Username (para login)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              <Input
                placeholder="Loja / unidade (ex: destack-cedral)"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Papel
                </label>
                <select
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "admin" | "user")
                  }
                >
                  <option value="user">User (Responsável de veículo)</option>
                  <option value="admin">Admin (Controle total)</option>
                </select>
              </div>
            </div>

            {!isEditMode && (
              <p className="text-xs text-gray-400">
                Ao salvar, será gerada uma{" "}
                <span className="text-yellow-300 font-semibold">
                  senha temporária
                </span>{" "}
                para o usuário acessar pela primeira vez.
              </p>
            )}

            {errorMsg && (
              <p className="text-sm text-red-400 font-medium">{errorMsg}</p>
            )}
            {successMsg && (
              <p className="text-sm text-green-400 font-medium">
                {successMsg}
              </p>
            )}
            {tempPassword && !isEditMode && (
              <p className="text-xs text-yellow-300">
                Senha temporária gerada:{" "}
                <span className="font-mono font-bold">
                  {tempPassword}
                </span>{" "}
                (anote e entregue ao usuário).
              </p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
              >
                {saving
                  ? isEditMode
                    ? "Salvando alterações..."
                    : "Salvando..."
                  : isEditMode
                  ? "Salvar alterações"
                  : "Salvar usuário"}
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

      {/* Lista de usuários */}
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
        <h2 className="text-lg font-semibold text-gray-100 mb-3">
          Usuários cadastrados
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando usuários...</p>
        ) : usersList.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum usuário cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Nome</th>
                  <th className="py-2 px-2">Username</th>
                  <th className="py-2 px-2">Email</th>
                  <th className="py-2 px-2">Loja</th>
                  <th className="py-2 px-2">Papel</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Senha</th>
                  <th className="py-2 pl-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 text-gray-100">{u.name}</td>
                    <td className="py-2 px-2 text-gray-200">
                      {u.username ?? "-"}
                    </td>
                    <td className="py-2 px-2 text-gray-300">
                      {u.email ?? "-"}
                    </td>
                    <td className="py-2 px-2 text-gray-200">{u.storeId}</td>
                    <td className="py-2 px-2 uppercase text-xs text-gray-300">
                      {u.role}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                          u.active
                            ? "bg-green-500/20 text-green-300 border border-green-500/40"
                            : "bg-red-500/20 text-red-300 border border-red-500/40"
                        }`}
                      >
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {u.mustChangePassword ? (
                        <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-300 border border-yellow-500/40">
                          Deve trocar a senha
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-[11px] text-gray-400 bg-neutral-800 border border-neutral-700">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`border text-xs h-7 px-2 ${
                            u.active
                              ? "border-red-500 text-red-300 hover:bg-red-500/10"
                              : "border-green-500 text-green-300 hover:bg-green-500/10"
                          }`}
                          onClick={() => handleToggleAtivo(u)}
                        >
                          {u.active ? "Desativar" : "Ativar"}
                        </Button>

                        <Button
                          size="sm"
                          className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs h-7 px-3"
                          onClick={() => abrirFormEdicao(u)}
                        >
                          Editar
                        </Button>
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