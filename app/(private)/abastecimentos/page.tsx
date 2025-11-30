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
  where,
  orderBy,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface VehicleOption {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  responsibleUserId: string;
  responsibleUserName: string;
  currentKm?: number;
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
  const [liters, setLiters] = useState("");
  const [pricePerL, setPricePerL] = useState("");
  const [stationName, setStationName] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filtros de período (data inicial e final)
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

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

        // Carregar veículos que o usuário pode usar
        let vehiclesSnap;
        if (isAdmin) {
          vehiclesSnap = await getDocs(collection(db, "vehicles"));
        } else {
          vehiclesSnap = await getDocs(
            query(
              collection(db, "vehicles"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const vList: VehicleOption[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName,
            currentKm: data.currentKm,
          };
        });
        setVehicles(vList);

        // Carregar abastecimentos
        let fuelingsSnap;
        if (isAdmin) {
          fuelingsSnap = await getDocs(
            query(collection(db, "fuelings"), orderBy("date", "desc"))
          );
        } else {
          // user comum: pega só registros dele (sem orderBy pra evitar problema de índice)
          fuelingsSnap = await getDocs(
            query(
              collection(db, "fuelings"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

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
          };
        });

        // Para user comum, ordena manualmente pela data desc
        if (!isAdmin) {
          fList = fList.sort((a, b) =>
            (b.date || "").localeCompare(a.date || "")
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
    setDate("");
    setOdometerKm("");
    setLiters("");
    setPricePerL("");
    setStationName("");
    setErrorMsg("");
    setSuccessMsg("");
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

      if (!vehicleId || !odometerKm || !liters || !pricePerL) {
        setErrorMsg("Selecione veículo e preencha km, litros e valor por litro.");
        return;
      }

      const vehicle = vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) {
        setErrorMsg("Veículo inválido.");
        return;
      }

      const odom = Number(odometerKm.replace(",", "."));
      const lit = Number(liters.replace(",", "."));
      const price = Number(pricePerL.replace(",", "."));

      if (isNaN(odom) || odom <= 0) {
        setErrorMsg("KM inválido.");
        return;
      }
      if (isNaN(lit) || lit <= 0) {
        setErrorMsg("Litros inválidos.");
        return;
      }
      if (isNaN(price) || price <= 0) {
        setErrorMsg("Valor por litro inválido.");
        return;
      }

      const total = Number((lit * price).toFixed(2));

      if (!user) {
        setErrorMsg("Sessão expirada. Faça login novamente.");
        router.replace("/login");
        return;
      }

      const nowISO = date || new Date().toISOString();

      const col = collection(db, "fuelings");
      const newDoc = await addDoc(col, {
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
      await updateDoc(doc(db, "vehicles", vehicle.id), {
        currentKm: odom,
      });

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

      setSuccessMsg("Abastecimento registrado com sucesso!");
      resetForm();
    } catch (error) {
      console.error("Erro ao registrar abastecimento:", error);
      setErrorMsg("Erro ao registrar abastecimento. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFueling(f: Fueling) {
    if (!isAdmin) return;
    const confirmar = window.confirm(
      `Deseja realmente excluir o abastecimento do veículo ${f.vehiclePlate} em ${new Date(
        f.date
      ).toLocaleString("pt-BR")}?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "fuelings", f.id));
      setFuelings((prev) => prev.filter((item) => item.id !== f.id));
    } catch (error) {
      console.error("Erro ao excluir abastecimento:", error);
      setErrorMsg("Erro ao excluir abastecimento. Tente novamente.");
    }
  }

  // ====== FILTRO POR PERÍODO (datas locais, sem bug de fuso) ======
  const filteredFuelings = useMemo(() => {
    if (!startFilter && !endFilter) return fuelings;

    const parseLocalDate = (value: string) => {
      const [yyyy, mm, dd] = value.split("-").map(Number);
      return new Date(yyyy, (mm || 1) - 1, dd || 1);
    };

    return fuelings.filter((f) => {
      if (!f.date) return false;

      const d = new Date(f.date); // data real do abastecimento

      if (startFilter) {
        const start = parseLocalDate(startFilter);
        // start já está em 00:00 do dia
        if (d < start) return false;
      }

      if (endFilter) {
        const end = parseLocalDate(endFilter);
        // inclui o dia inteiro
        end.setHours(23, 59, 59, 999);
        if (d > end) return false;
      }

      return true;
    });
  }, [fuelings, startFilter, endFilter]);

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

  // Preview do total no formulário
  const previewTotal = (() => {
    const lit = Number(liters.replace(",", "."));
    const price = Number(pricePerL.replace(",", "."));
    if (!lit || !price || isNaN(lit) || isNaN(price)) return null;
    return Number((lit * price).toFixed(2));
  })();

  function handleClearFilter() {
    setStartFilter("");
    setEndFilter("");
  }

  // helper pra exibir período bonito
  function formatFilterDateLabel(dateStr: string) {
    if (!dateStr) return "";
    const [yyyy, mm, dd] = dateStr.split("-").map(Number);
    const d = new Date(yyyy, (mm || 1) - 1, dd || 1); // data local
    return d.toLocaleDateString("pt-BR");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
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
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
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
                  Litros abastecidos
                </label>
                <Input
                  placeholder="Ex: 45,7"
                  value={liters}
                  onChange={(e) => setLiters(e.target.value)}
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
                  Posto / Observação (opcional)
                </label>
                <Input
                  placeholder="Nome do posto ou observação"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Preview do total do abastecimento */}
            <div className="text-xs text-gray-300 mt-1">
              Total deste abastecimento:{" "}
              <span className="font-semibold text-yellow-300">
                {previewTotal != null
                  ? `R$ ${previewTotal.toFixed(2)}`
                  : "—"}
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

      {/* Lista */}
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
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
          <div className="overflow-x-auto">
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
                    <th className="py-2 pl-2 text-right">Ações</th>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                          onClick={() => handleDeleteFueling(f)}
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
      </Card>
    </div>
  );
}