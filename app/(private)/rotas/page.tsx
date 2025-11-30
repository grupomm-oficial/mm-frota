"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type RouteStatus = "em_andamento" | "finalizada";

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  storeId: string;
  currentKm?: number;
  status?: "disponivel" | "em_rota" | "manutencao";
  responsibleUserId: string;
}

interface Driver {
  id: string;
  name: string;
  storeId: string;
  responsibleUserId: string;
}

interface RouteItem {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  storeId?: string | null;
  driverId: string;
  driverName: string;
  origem?: string | null;
  destino?: string | null;
  startKm: number;
  endKm?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  distanceKm?: number | null;
  status: RouteStatus;
  responsibleUserId: string;
  responsibleUserName?: string | null;
}

export default function RotasPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Campos do formulário de nova rota
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [startKmInput, setStartKmInput] = useState("");

  // Finalizar rota
  const [finishingRoute, setFinishingRoute] = useState<RouteItem | null>(null);
  const [endKmInput, setEndKmInput] = useState("");

  const isAdmin = user?.role === "admin";

  // Redireciona se não estiver logado
  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
  }, [user, router]);

  // Carregar veículos, motoristas e rotas
  useEffect(() => {
    async function loadData() {
      if (!user) return;

      try {
        setLoading(true);
        setErrorMsg("");

        // ===== Veículos =====
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

        const vList: Vehicle[] = vehiclesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            plate: data.plate,
            model: data.model,
            storeId: data.storeId,
            currentKm: data.currentKm,
            status: data.status,
            responsibleUserId: data.responsibleUserId,
          };
        });
        setVehicles(vList);

        // ===== Motoristas =====
        let driversSnap;
        if (isAdmin) {
          driversSnap = await getDocs(collection(db, "drivers"));
        } else {
          driversSnap = await getDocs(
            query(
              collection(db, "drivers"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const dList: Driver[] = driversSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name,
            storeId: data.storeId,
            responsibleUserId: data.responsibleUserId,
          };
        });
        setDrivers(dList);

        // ===== Rotas =====
        let routesSnap;
        if (isAdmin) {
          routesSnap = await getDocs(
            query(collection(db, "routes"), orderBy("startAt", "desc"))
          );
        } else {
          // user comum: busca só rotas dele (sem orderBy para evitar problema de índice)
          routesSnap = await getDocs(
            query(
              collection(db, "routes"),
              where("responsibleUserId", "==", user.id)
            )
          );
        }

        const rList: RouteItem[] = routesSnap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            vehicleId: data.vehicleId,
            vehiclePlate: data.vehiclePlate,
            vehicleModel: data.vehicleModel,
            storeId: data.storeId ?? data.vehicleStoreId ?? null,
            driverId: data.driverId,
            driverName: data.driverName,
            origem: data.origem ?? null,
            destino: data.destino ?? null,
            startKm: data.startKm,
            endKm: data.endKm ?? null,
            startAt: data.startAt ?? null,
            endAt: data.endAt ?? null,
            distanceKm: data.distanceKm ?? null,
            status: (data.status ?? "em_andamento") as RouteStatus,
            responsibleUserId: data.responsibleUserId,
            responsibleUserName: data.responsibleUserName ?? null,
          };
        });

        // para user comum, ordena na mão pela data
        const sorted = isAdmin
          ? rList
          : rList.sort((a, b) =>
              (b.startAt || "").localeCompare(a.startAt || "")
            );

        setRoutes(sorted);
      } catch (error) {
        console.error("Erro ao carregar rotas:", error);
        setErrorMsg("Erro ao carregar dados de rotas. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, isAdmin]);

  function resetForm() {
    setSelectedVehicleId("");
    setSelectedDriverId("");
    setOrigem("");
    setDestino("");
    setStartKmInput("");
    setErrorMsg("");
    setSuccessMsg("");
  }

  // Quando escolhe veículo, preenche KM inicial com currentKm
  useEffect(() => {
    if (!selectedVehicleId) return;
    const v = vehicles.find((v) => v.id === selectedVehicleId);
    if (v && v.currentKm != null) {
      setStartKmInput(String(v.currentKm));
    }
  }, [selectedVehicleId, vehicles]);

  async function handleCriarRota(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!selectedVehicleId || !selectedDriverId) {
        setErrorMsg("Selecione veículo e motorista.");
        return;
      }

      const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
      if (!vehicle) {
        setErrorMsg("Veículo inválido.");
        return;
      }

      if (vehicle.status === "em_rota") {
        setErrorMsg("Esse veículo já está em rota. Finalize a rota atual antes.");
        return;
      }

      const driver = drivers.find((d) => d.id === selectedDriverId);
      if (!driver) {
        setErrorMsg("Motorista inválido.");
        return;
      }

      const startKmNumber = startKmInput.trim()
        ? Number(startKmInput.replace(",", "."))
        : vehicle.currentKm ?? 0;

      const nowIso = new Date().toISOString();

      // dados que irão para o Firestore (sem id)
      const newRouteData = {
        vehicleId: vehicle.id,
        vehiclePlate: vehicle.plate,
        vehicleModel: vehicle.model,
        storeId: vehicle.storeId,
        driverId: driver.id,
        driverName: driver.name,
        origem: origem || null,
        destino: destino || null,
        startKm: startKmNumber,
        startAt: nowIso,
        status: "em_andamento" as RouteStatus,
        responsibleUserId: user.id,
        responsibleUserName: user.name,
        endKm: null as number | null,
        endAt: null as string | null,
        distanceKm: null as number | null,
      };

      const docRef = await addDoc(collection(db, "routes"), newRouteData);

      // Atualiza veículo para "em_rota" e KM atual
      await updateDoc(doc(db, "vehicles", vehicle.id), {
        status: "em_rota",
        currentKm: startKmNumber,
      });

      // objeto para o estado (inclui id)
      const routeForState: RouteItem = {
        id: docRef.id,
        ...newRouteData,
      };

      setRoutes((prev) => [routeForState, ...prev]);

      // Atualiza estado local do veículo
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === vehicle.id
            ? { ...v, status: "em_rota", currentKm: startKmNumber }
            : v
        )
      );

      setSuccessMsg("Rota iniciada com sucesso!");
      resetForm();
      setFormOpen(false);
    } catch (error) {
      console.error("Erro ao iniciar rota:", error);
      setErrorMsg("Erro ao iniciar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function abrirFinalizarRota(route: RouteItem) {
    setFinishingRoute(route);
    setEndKmInput(route.endKm != null ? String(route.endKm) : "");
    setErrorMsg("");
    setSuccessMsg("");
  }

  async function handleFinalizarRota(e: React.FormEvent) {
    e.preventDefault();
    if (!finishingRoute) return;

    try {
      setErrorMsg("");
      setSuccessMsg("");
      setSaving(true);

      if (!endKmInput.trim()) {
        setErrorMsg("Informe o KM final.");
        return;
      }

      const endKmNumber = Number(endKmInput.replace(",", "."));
      if (Number.isNaN(endKmNumber)) {
        setErrorMsg("KM final inválido.");
        return;
      }

      if (endKmNumber < finishingRoute.startKm) {
        setErrorMsg("KM final não pode ser menor que o KM inicial.");
        return;
      }

      const distance = endKmNumber - finishingRoute.startKm;
      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, "routes", finishingRoute.id), {
        endKm: endKmNumber,
        endAt: nowIso,
        distanceKm: distance,
        status: "finalizada",
      });

      // Atualiza veículo correspondente
      if (finishingRoute.vehicleId) {
        await updateDoc(doc(db, "vehicles", finishingRoute.vehicleId), {
          currentKm: endKmNumber,
          status: "disponivel",
        });

        setVehicles((prev) =>
          prev.map((v) =>
            v.id === finishingRoute.vehicleId
              ? { ...v, currentKm: endKmNumber, status: "disponivel" }
              : v
          )
        );
      }

      setRoutes((prev) =>
        prev.map((r) =>
          r.id === finishingRoute.id
            ? {
                ...r,
                endKm: endKmNumber,
                endAt: nowIso,
                distanceKm: distance,
                status: "finalizada",
              }
            : r
        )
      );

      setSuccessMsg("Rota finalizada com sucesso!");
      setFinishingRoute(null);
      setEndKmInput("");
    } catch (error) {
      console.error("Erro ao finalizar rota:", error);
      setErrorMsg("Erro ao finalizar rota. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExcluirRota(route: RouteItem) {
    if (!isAdmin) return;
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir a rota do veículo ${route.vehiclePlate}?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, "routes", route.id));
      setRoutes((prev) => prev.filter((r) => r.id !== route.id));
    } catch (error) {
      console.error("Erro ao excluir rota:", error);
      setErrorMsg("Erro ao excluir rota. Tente novamente.");
    }
  }

  // ===== Resumos =====
  const totalRotas = routes.length;
  const rotasEmAndamento = routes.filter((r) => r.status === "em_andamento");
  const rotasFinalizadas = routes.filter((r) => r.status === "finalizada");

  const totalKmRodado = useMemo(() => {
    return routes.reduce((acc, r) => {
      if (r.distanceKm != null) return acc + r.distanceKm;
      if (r.endKm != null) return acc + (r.endKm - r.startKm);
      return acc;
    }, 0);
  }, [routes]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-yellow-400">
            Rotas da Frota
          </h1>
          <p className="text-sm text-gray-400">
            Inicie e finalize rotas dos veículos. Os KMs atualizam o cadastro
            do veículo automaticamente.
          </p>
        </div>

        <Button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          + Nova rota
        </Button>
      </div>

      {/* Resumo rápido */}
      <Card className="p-4 bg-neutral-950 border border-neutral-800">
        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Total de rotas:{" "}
            <span className="font-semibold text-yellow-400">
              {totalRotas}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Em andamento:{" "}
            <span className="font-semibold text-sky-400">
              {rotasEmAndamento.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            Finalizadas:{" "}
            <span className="font-semibold text-green-400">
              {rotasFinalizadas.length}
            </span>
          </span>
          <span className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            KM rodado (somado):{" "}
            <span className="font-semibold text-yellow-300">
              {totalKmRodado.toFixed(1)} km
            </span>
          </span>
        </div>
      </Card>

      {/* Form Nova Rota */}
      {formOpen && (
        <Card className="p-4 bg-neutral-900 border border-neutral-800">
          <h2 className="text-lg font-semibold text-yellow-400 mb-3">
            Nova rota
          </h2>

          <form onSubmit={handleCriarRota} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Veículo
                </label>
                <select
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
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
                  Motorista
                </label>
                <select
                  className="w-full rounded-md bg-neutral-950 border border-neutral-700 px-3 py-2 text-sm text-gray-100"
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                >
                  <option value="">Selecione um motorista...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.storeId})
                    </option>
                  ))}
                </select>
              </div>

              <Input
                placeholder="Origem (opcional)"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              <Input
                placeholder="Destino (opcional)"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />

              <Input
                placeholder="KM inicial (deixa em branco para usar o KM atual do veículo)"
                value={startKmInput}
                onChange={(e) => setStartKmInput(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500 md:col-span-2"
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
                {saving ? "Salvando..." : "Iniciar rota"}
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

      {/* Bloco de finalizar rota */}
      {finishingRoute && (
        <Card className="p-4 bg-neutral-900 border border-yellow-500/60">
          <h2 className="text-lg font-semibold text-yellow-400 mb-2">
            Finalizar rota · {finishingRoute.vehiclePlate} ·{" "}
            {finishingRoute.vehicleModel}
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Motorista:{" "}
            <span className="text-gray-200">
              {finishingRoute.driverName}
            </span>{" "}
            · KM inicial:{" "}
            <span className="font-mono text-gray-100">
              {finishingRoute.startKm} km
            </span>
          </p>

          <form onSubmit={handleFinalizarRota} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="KM final"
                value={endKmInput}
                onChange={(e) => setEndKmInput(e.target.value)}
                className="bg-neutral-950 border-neutral-700 text-gray-100 placeholder:text-gray-500"
              />
              <Input
                placeholder="Destino (opcional)"
                value={finishingRoute.destino ?? ""}
                disabled
                className="bg-neutral-950 border-neutral-800 text-gray-400"
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
                className="bg-green-500 hover:bg-green-400 text-black font-semibold"
              >
                {saving ? "Finalizando..." : "Confirmar finalização"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-neutral-700 text-gray-200 hover:bg-neutral-800 text-sm"
                onClick={() => {
                  setFinishingRoute(null);
                  setEndKmInput("");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabela de rotas */}
      <Card className="p-4 bg-neutral-900 border border-neutral-800">
        <h2 className="text-lg font-semibold text-gray-100 mb-3">
          Rotas registradas
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando rotas...</p>
        ) : routes.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma rota registrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b border-neutral-800 text-gray-400">
                  <th className="py-2 pr-2">Veículo</th>
                  <th className="py-2 px-2">Motorista</th>
                  <th className="py-2 px-2">Origem → Destino</th>
                  <th className="py-2 px-2">Início</th>
                  <th className="py-2 px-2">KM (início / fim)</th>
                  <th className="py-2 px-2">Distância</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 pl-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const distancia =
                    r.distanceKm != null
                      ? r.distanceKm
                      : r.endKm != null
                      ? r.endKm - r.startKm
                      : null;

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-neutral-900 hover:bg-neutral-800/60"
                    >
                      <td className="py-2 pr-2 text-gray-100">
                        <span className="font-mono">{r.vehiclePlate}</span>{" "}
                        · {r.vehicleModel}
                      </td>
                      <td className="py-2 px-2 text-gray-200">
                        {r.driverName}
                      </td>
                      <td className="py-2 px-2 text-gray-300">
                        {(r.origem || "-") + " → " + (r.destino || "-")}
                      </td>
                      <td className="py-2 px-2 text-gray-300">
                        {r.startAt
                          ? new Date(r.startAt).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="py-2 px-2 text-gray-200">
                        <span className="font-mono">
                          {r.startKm} km
                          {r.endKm != null ? ` / ${r.endKm} km` : ""}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-200">
                        {distancia != null ? `${distancia.toFixed(1)} km` : "-"}
                      </td>
                      <td className="py-2 px-2">
                        {r.status === "em_andamento" ? (
                          <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            Em andamento
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-green-500/20 text-green-300 border border-green-500/40">
                            Finalizada
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === "em_andamento" && (
                            <Button
                              size="sm"
                              className="bg-green-500 hover:bg-green-400 text-black text-xs h-7 px-3"
                              onClick={() => abrirFinalizarRota(r)}
                            >
                              Finalizar
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500 text-red-300 hover:bg-red-500/10 text-xs h-7 px-3"
                              onClick={() => handleExcluirRota(r)}
                            >
                              Excluir
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}