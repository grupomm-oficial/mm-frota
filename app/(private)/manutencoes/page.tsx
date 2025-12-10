"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type MaintenanceStatus = "em_andamento" | "concluida";

interface VehicleOption {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  currentKm?: number;

  // modelo antigo (um responsável)
  responsibleUserId?: string;
  responsibleUserName?: string;

  // modelo novo (vários responsáveis)
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

  // Filtro de período (data inicial/final) – padrão: mês corrente
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");

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

        // ===== VEÍCULOS ACESSÍVEIS =====
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        const vListAll: VehicleOption[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            currentKm: data.currentKm,
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

        // ===== MANUTENÇÕES =====
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
    setDate("");
    setOdometerKm("");
    setCost("");
    setType("");
    setWorkshopName("");
    setNotes("");
    setErrorMsg("");
    setSuccessMsg("");
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

      const odom = Number(odometerKm.replace(",", "."));
      const valor = Number(cost.replace(",", "."));

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

      const col = collection(db, "maintenances");
      const newDoc = await addDoc(col, {
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
      await updateDoc(doc(db, "vehicles", vehicle.id), {
        status: "manutencao",
        currentKm: odom,
      });

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

      setSuccessMsg("Manutenção registrada com sucesso!");
      resetForm();
    } catch (error) {
      console.error("Erro ao registrar manutenção:", error);
      setErrorMsg("Erro ao registrar manutenção. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConcluirManutencao(m: Maintenance) {
    try {
      if (!user) {
        alert("Sessão expirada. Faça login novamente.");
        router.replace("/login");
        return;
      }

      // Permissão: admin ou responsável/co-responsável do veículo
      if (!isAdmin) {
        const vehicle = vehicles.find((v) => v.id === m.vehicleId);
        if (!vehicle || !userCanUseVehicle(vehicle)) {
          alert(
            "Você não tem permissão para concluir a manutenção deste veículo."
          );
          return;
        }
      }

      const resposta = window.prompt(
        `KM final para concluir a manutenção do veículo ${m.vehiclePlate}:`,
        m.odometerKm.toString()
      );
      if (!resposta) return;

      const endKm = Number(resposta.replace(",", "."));
      if (isNaN(endKm) || endKm < m.odometerKm) {
        alert("KM final inválido (deve ser >= KM de entrada).");
        return;
      }

      const nowISO = new Date().toISOString();

      // Atualiza manutenção
      await updateDoc(doc(db, "maintenances", m.id), {
        status: "concluida",
        endKm,
        endDate: nowISO,
      });

      // Atualiza veículo
      await updateDoc(doc(db, "vehicles", m.vehicleId), {
        status: "disponivel",
        currentKm: endKm,
      });

      // Estados locais
      setMaintenances((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, status: "concluida", endKm, endDate: nowISO }
            : item
        )
      );

      setVehicles((prev) =>
        prev.map((v) =>
          v.id === m.vehicleId
            ? { ...v, status: "disponivel", currentKm: endKm }
            : v
        )
      );
    } catch (error) {
      console.error("Erro ao concluir manutenção:", error);
      alert("Erro ao concluir manutenção. Tente novamente.");
    }
  }

  async function handleDeleteMaintenance(m: Maintenance) {
    if (!isAdmin) return;
    const confirmar = window.confirm(
      `Deseja realmente excluir a manutenção do veículo ${m.vehiclePlate} em ${new Date(
        m.date
      ).toLocaleString("pt-BR")}?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "maintenances", m.id));
      setMaintenances((prev) => prev.filter((item) => item.id !== m.id));
    } catch (error) {
      console.error("Erro ao excluir manutenção:", error);
      setErrorMsg("Erro ao excluir manutenção. Tente novamente.");
    }
  }

  // ====== FILTRO POR PERÍODO (datas locais, sem bug de fuso) ======
  const filteredMaintenances = useMemo(() => {
    if (!startFilter && !endFilter) return maintenances;

    const parseLocalDate = (value: string) => {
      const [yyyy, mm, dd] = value.split("-").map(Number);
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    };

    return maintenances.filter((m) => {
      if (!m.date) return false;

      const d = new Date(m.date); // data de entrada da manutenção

      if (startFilter) {
        const start = parseLocalDate(startFilter);
        if (d < start) return false;
      }

      if (endFilter) {
        const end = parseLocalDate(endFilter);
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }

      return true;
    });
  }, [maintenances, startFilter, endFilter]);

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
  }

  function formatFilterDateLabel(dateStr: string) {
    if (!dateStr) return "";
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const d = new Date(yyyy, (mm || 1) - 1, dd || 1);
    return d.toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
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
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
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
              <span className="text-[11px] text-gray-400">Até</span>
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
                {endFilter && "até " + formatFilterDateLabel(endFilter)}
              </span>
            </span>
          )}
        </div>
      </Card>

      {/* Formulário */}
      {formOpen && (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
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
                  placeholder="Ex: Troca de óleo, revisão, freios..."
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
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
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
          <div className="overflow-x-auto mb-4">
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
                    <td className="py-2 pl-2 text-right space-x-2">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-400 text-black text-xs h-7 px-3"
                        onClick={() => handleConcluirManutencao(m)}
                      >
                        Concluir
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                          onClick={() => handleDeleteMaintenance(m)}
                        >
                          Excluir
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="overflow-x-auto">
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                          onClick={() => handleDeleteMaintenance(m)}
                        >
                          Excluir
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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