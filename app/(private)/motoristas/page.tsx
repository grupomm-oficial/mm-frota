"use client";

import { useEffect, useState } from "react";
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

export default function MotoristasPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // edição x criação
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // campos formulário
  const [name, setName] = useState("");
  const [storeId, setStoreId] = useState("");
  const [responsibleId, setResponsibleId] = useState("");

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

        // Motoristas: admin vê todos, user vê só os que é responsável
        let driversSnap;
        if (user.role === "admin") {
          driversSnap = await getDocs(collection(db, "drivers"));
        } else {
          driversSnap = await getDocs(
            query(
              collection(db, "drivers"),
              where("responsibleUserId", "==", user.id)
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
    setStoreId(user?.storeId ?? "");
    setResponsibleId("");
    setErrorMsg("");
    setSuccessMsg("");
    setEditingDriver(null);
  }

  function abrirFormNovo() {
    resetForm();
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

  async function handleCriarMotorista() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!name || !storeId) {
        setErrorMsg("Preencha nome e loja.");
        return;
      }

      let responsibleUserId = user!.id;
      let responsibleUserName = user!.name;

      // Admin pode escolher outro responsável
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
      }

      const docRef = await addDoc(collection(db, "drivers"), {
        name,
        storeId,
        responsibleUserId,
        responsibleUserName,
        active: true,
      });

      setDrivers((prev) => [
        ...prev,
        {
          id: docRef.id,
          name,
          storeId,
          responsibleUserId,
          responsibleUserName,
          active: true,
        },
      ]);

      setSuccessMsg("Motorista cadastrado com sucesso!");
      resetForm();
      setFormOpen(false);
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

      if (!name || !storeId) {
        setErrorMsg("Preencha nome e loja.");
        return;
      }

      let responsibleUserId = editingDriver.responsibleUserId;
      let responsibleUserName = editingDriver.responsibleUserName;

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
      }

      await updateDoc(doc(db, "drivers", editingDriver.id), {
        name,
        storeId,
        responsibleUserId,
        responsibleUserName,
      });

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === editingDriver.id
            ? {
                ...d,
                name,
                storeId,
                responsibleUserId,
                responsibleUserName,
              }
            : d
        )
      );

      setSuccessMsg("Motorista atualizado com sucesso!");
      setFormOpen(false);
      setEditingDriver(null);
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

  async function handleDeleteMotorista(d: Driver) {
    if (!isAdmin) return;
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o motorista ${d.name}?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "drivers", d.id));
      setDrivers((prev) => prev.filter((item) => item.id !== d.id));
    } catch (error) {
      console.error("Erro ao excluir motorista:", error);
      setErrorMsg("Erro ao excluir motorista. Tente novamente.");
    }
  }

  async function handleToggleAtivo(d: Driver) {
    try {
      const novoStatus = !d.active;
      await updateDoc(doc(db, "drivers", d.id), {
        active: novoStatus,
      });
      setDrivers((prev) =>
        prev.map((item) =>
          item.id === d.id ? { ...item, active: novoStatus } : item
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status do motorista:", error);
      setErrorMsg("Erro ao atualizar status. Tente novamente.");
    }
  }

  // Resumo rápido
  const totalDrivers = drivers.length;
  const ativos = drivers.filter((d) => d.active).length;
  const inativos = drivers.filter((d) => !d.active).length;

  const isEditMode = !!editingDriver;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Motoristas da Frota
          </h1>
          <p className="text-sm text-gray-400">
            Cadastre motoristas e associe a um responsável. Na rota, você
            escolhe o motorista da lista em vez de digitar o nome.
          </p>
        </div>

        <Button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          onClick={abrirFormNovo}
        >
          + Novo motorista
        </Button>
      </div>

      {/* Resumo rápido */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Total:{" "}
            <span className="font-semibold text-yellow-400">
              {totalDrivers}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Ativos:{" "}
            <span className="font-semibold text-green-400">
              {ativos}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Inativos:{" "}
            <span className="font-semibold text-red-300">
              {inativos}
            </span>
          </span>
        </div>
      </Card>

      {/* Formulário */}
      {formOpen && (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-yellow-400">
              {isEditMode ? "Editar motorista" : "Novo motorista"}
            </h2>
            {isEditMode && editingDriver && (
              <span className="text-[11px] px-2 py-[2px] rounded-full bg-neutral-800 border border-neutral-700 text-gray-300">
                ID: {editingDriver.id}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nome do motorista"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />
              <Input
                placeholder="Loja / unidade (ex: destack-cedral)"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              {isAdmin && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Responsável pelo motorista
                  </label>
                  <select
                    className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                    value={responsibleId}
                    onChange={(e) => setResponsibleId(e.target.value)}
                  >
                    <option value="">Selecione um responsável...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.storeId})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                  ? isEditMode
                    ? "Salvando alterações..."
                    : "Salvando..."
                  : isEditMode
                  ? "Salvar alterações"
                  : "Salvar motorista"}
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

      {/* Lista de motoristas */}
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
        <h2 className="text-lg font-semibold text-gray-100 mb-3">
          Motoristas cadastrados
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando motoristas...</p>
        ) : drivers.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum motorista cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Nome</th>
                  <th className="py-2 px-2">Loja</th>
                  <th className="py-2 px-2">Responsável</th>
                  <th className="py-2 px-2">Status</th>
                  {isAdmin && (
                    <th className="py-2 pl-2 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 text-gray-100">{d.name}</td>
                    <td className="py-2 px-2 text-gray-200">{d.storeId}</td>
                    <td className="py-2 px-2 text-gray-200">
                      {d.responsibleUserName}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                          d.active
                            ? "bg-green-500/20 text-green-300 border border-green-500/40"
                            : "bg-red-500/20 text-red-300 border border-red-500/40"
                        }`}
                      >
                        {d.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="py-2 pl-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`border text-xs h-7 px-2 ${
                              d.active
                                ? "border-red-500 text-red-300 hover:bg-red-500/10"
                                : "border-green-500 text-green-300 hover:bg-green-500/10"
                            }`}
                            onClick={() => handleToggleAtivo(d)}
                          >
                            {d.active ? "Desativar" : "Ativar"}
                          </Button>

                          <Button
                            size="sm"
                            className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs h-7 px-3"
                            onClick={() => abrirFormEdicao(d)}
                          >
                            Editar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                            onClick={() => handleDeleteMotorista(d)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </td>
                    )}
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