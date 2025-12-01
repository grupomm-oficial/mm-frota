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

type VehicleStatus = "disponivel" | "em_rota" | "manutencao";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  responsibleUserId: string;
  responsibleUserName: string;
  status: VehicleStatus;
  currentKm?: number;
  active: boolean;
}

interface SimpleUser {
  id: string;
  name: string;
  storeId: string;
}

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
  const [responsibleId, setResponsibleId] = useState("");
  const [currentKm, setCurrentKm] = useState("");

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

        // Admin vê todos os usuários (ativos ou não) para atribuir como responsável
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
          // user vê só veículos que ele é responsável
          vehiclesSnap = await getDocs(
            query(
              collection(db, "vehicles"),
              where("responsibleUserId", "==", user?.id ?? "")
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
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            status: data.status ?? "disponivel",
            currentKm: data.currentKm,
            active: data.active ?? true,
          };
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
    setResponsibleId("");
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
    setResponsibleId(v.responsibleUserId);
    setCurrentKm(v.currentKm != null ? String(v.currentKm) : "");
    setErrorMsg("");
    setSuccessMsg("");
    setFormOpen(true);
  }

  function handleVerDetalhes(v: Vehicle) {
    router.push(`/veiculos/${v.id}`);
  }

  async function handleCreateVehicle() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!plate || !model || !storeId || !responsibleId) {
        setErrorMsg("Preencha placa, modelo, loja e responsável.");
        return;
      }

      const responsibleUser = users.find((u) => u.id === responsibleId);
      if (!responsibleUser) {
        setErrorMsg("Responsável inválido.");
        return;
      }

      const kmNumber =
        currentKm.trim() === "" ? undefined : Number(currentKm.replace(",", "."));

      // Criar doc em "vehicles"
      const docRef = await addDoc(collection(db, "vehicles"), {
        plate: plate.toUpperCase(),
        model,
        storeId,
        responsibleUserId: responsibleUser.id,
        responsibleUserName: responsibleUser.name,
        status: "disponivel" as VehicleStatus,
        currentKm: kmNumber,
        active: true,
      });

      // Atualizar lista local
      setVehicles((prev) => [
        ...prev,
        {
          id: docRef.id,
          plate: plate.toUpperCase(),
          model,
          storeId,
          responsibleUserId: responsibleUser.id,
          responsibleUserName: responsibleUser.name,
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

      if (!plate || !model || !storeId || !responsibleId) {
        setErrorMsg("Preencha placa, modelo, loja e responsável.");
        return;
      }

      const responsibleUser = users.find((u) => u.id === responsibleId);
      if (!responsibleUser) {
        setErrorMsg("Responsável inválido.");
        return;
      }

      const kmNumber =
        currentKm.trim() === "" ? null : Number(currentKm.replace(",", "."));

      await updateDoc(doc(db, "vehicles", editingVehicle.id), {
        plate: plate.toUpperCase(),
        model,
        storeId,
        responsibleUserId: responsibleUser.id,
        responsibleUserName: responsibleUser.name,
        currentKm: kmNumber,
      });

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === editingVehicle.id
            ? {
                ...v,
                plate: plate.toUpperCase(),
                model,
                storeId,
                responsibleUserId: responsibleUser.id,
                responsibleUserName: responsibleUser.name,
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

  // Métricas simples para ajudar o usuário
  const totalVeiculos = vehicles.length;
  const disponiveis = vehicles.filter((v) => v.status === "disponivel").length;
  const emRota = vehicles.filter((v) => v.status === "em_rota").length;
  const emManutencao = vehicles.filter(
    (v) => v.status === "manutencao"
  ).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Veículos do Grupo MM
          </h1>
          <p className="text-sm text-gray-400">
            Cadastre e gerencie os veículos da frota. O motorista é escolhido
            na hora de iniciar a rota.
          </p>
        </div>

        {isAdmin && (
          <Button
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
            onClick={abrirFormNovo}
          >
            + Novo veículo
          </Button>
        )}
      </div>

      {/* Resumo rápido */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Total:{" "}
            <span className="font-semibold text-yellow-400">
              {totalVeiculos}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Disponíveis:{" "}
            <span className="font-semibold text-green-400">
              {disponiveis}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Em rota:{" "}
            <span className="font-semibold text-sky-400">{emRota}</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Em manutenção:{" "}
            <span className="font-semibold text-yellow-300">
              {emManutencao}
            </span>
          </span>
        </div>
      </Card>

      {/* Formulário (admin) */}
      {isAdmin && formOpen && (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-yellow-400">
              {editingVehicle ? "Editar veículo" : "Novo veículo"}
            </h2>
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

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Responsável pelo veículo
                </label>
                <select
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                  value={responsibleId}
                  onChange={(e) => setResponsibleId(e.target.value)}
                >
                  <option value="">Selecione um usuário...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.storeId})
                    </option>
                  ))}
                </select>
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
        <h2 className="text-lg font-semibold text-gray-100 mb-3">
          Veículos cadastrados
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando veículos...</p>
        ) : vehicles.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhum veículo cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Placa</th>
                  <th className="py-2 px-2">Modelo</th>
                  <th className="py-2 px-2">Loja</th>
                  <th className="py-2 px-2">Responsável</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">KM atual</th>
                  {isAdmin && (
                    <th className="py-2 pl-2 text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-neutral-900 hover:bg-neutral-800/60"
                  >
                    <td className="py-2 pr-2 font-mono text-gray-100">
                      {v.plate}
                    </td>
                    <td className="py-2 px-2 text-gray-200">{v.model}</td>
                    <td className="py-2 px-2 text-gray-200">{v.storeId}</td>
                    <td className="py-2 px-2 text-gray-200">
                      {v.responsibleUserName}
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

                    {isAdmin && (
                      <td className="py-2 pl-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-neutral-800 hover:bg-neutral-700 text-yellow-300 border border-yellow-500/40 text-xs h-7 px-3"
                            onClick={() => handleVerDetalhes(v)}
                          >
                            Detalhes
                          </Button>
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