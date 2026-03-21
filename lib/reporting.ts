"use client";

export type ReportRouteStatus =
  | "em_andamento"
  | "finalizada"
  | "cancelada";

export interface ReportResponsibleUser {
  id: string;
  name: string;
}

export interface ReportVehicleRecord {
  id: string;
  plate: string;
  model: string;
  storeId?: string;
  currentKm?: number;
  responsibleUserId?: string;
  responsibleUserName?: string;
  responsibleUserIds?: string[];
  responsibleUsers?: ReportResponsibleUser[];
}

export interface ReportRouteRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverId?: string;
  driverName?: string;
  storeId?: string | null;
  responsibleUserId?: string;
  responsibleUserName?: string | null;
  startKm: number;
  endKm?: number | null;
  distanceKm?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  canceledAt?: string | null;
  status: ReportRouteStatus;
}

export interface ReportRefuelRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel?: string;
  storeId?: string;
  liters: number;
  totalCost: number;
  pricePerLiter?: number | null;
  odometerKm?: number | null;
  date?: string | null;
  stationName?: string | null;
  responsibleUserId?: string;
  responsibleUserName?: string | null;
}

export interface ReportMaintenanceRecord {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel?: string;
  storeId?: string;
  cost: number;
  type?: string;
  status: "em_andamento" | "concluida";
  date?: string | null;
  endDate?: string | null;
  odometerKm?: number | null;
  endKm?: number | null;
  responsibleUserId?: string;
  responsibleUserName?: string | null;
}

export interface OverviewMetrics {
  totalKm: number;
  totalLiters: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalCost: number;
  totalRoutes: number;
  finishedRoutes: number;
  cancelledRoutes: number;
  inProgressRoutes: number;
  routesWithDistance: number;
  refuelsCount: number;
  maintenancesCount: number;
  openMaintenances: number;
  completedMaintenances: number;
  activeVehicles: number;
  vehiclesWithMovement: number;
  idleVehicles: number;
  driversCount: number;
  responsiblesCount: number;
  costPerKm: number;
  kmPerLiter: number;
  avgRouteDistance: number;
  avgFuelTicket: number;
  avgMaintenanceTicket: number;
  completionRate: number;
  cancellationRate: number;
  fuelCostShare: number;
  maintenanceCostShare: number;
}

export interface VehicleAnalyticsRow {
  key: string;
  vehicleId?: string;
  plate: string;
  model: string;
  vehicleLabel: string;
  storeId?: string;
  responsibleNames: string[];
  km: number;
  liters: number;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
  routesCount: number;
  finishedRoutes: number;
  cancelledRoutes: number;
  refuelsCount: number;
  maintenancesCount: number;
  costPerKm: number;
  kmPerLiter: number;
  avgFuelPrice: number;
  avgFuelTicket: number;
  utilizationShare: number;
  hasActivity: boolean;
  lastActivityAt: string | null;
}

export interface ResponsibleAnalyticsRow {
  key: string;
  responsibleId?: string;
  responsibleName: string;
  km: number;
  liters: number;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
  routesCount: number;
  finishedRoutes: number;
  cancelledRoutes: number;
  refuelsCount: number;
  maintenancesCount: number;
  vehiclesCount: number;
  costPerKm: number;
  kmPerLiter: number;
  avgFuelTicket: number;
  avgRouteDistance: number;
  completionRate: number;
}

export interface DriverAnalyticsRow {
  key: string;
  driverId?: string;
  driverName: string;
  km: number;
  routesCount: number;
  finishedRoutes: number;
  cancelledRoutes: number;
  vehiclesCount: number;
  avgRouteDistance: number;
  completionRate: number;
  lastRouteAt: string | null;
}

export interface StoreAnalyticsRow {
  key: string;
  storeId: string;
  km: number;
  liters: number;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
  routesCount: number;
  refuelsCount: number;
  maintenancesCount: number;
  vehiclesCount: number;
  costPerKm: number;
  kmPerLiter: number;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthLabel: string;
  shortLabel: string;
  km: number;
  liters: number;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
  routesCount: number;
  finishedRoutes: number;
  cancelledRoutes: number;
}

export interface AnalyticsInsight {
  title: string;
  label: string;
  value: number;
  unit?: string;
}

export interface ReportAnalytics {
  monthKey: string;
  monthLabel: string;
  shortMonthLabel: string;
  overview: OverviewMetrics;
  filteredRoutes: ReportRouteRecord[];
  filteredRefuels: ReportRefuelRecord[];
  filteredMaintenances: ReportMaintenanceRecord[];
  vehicleRows: VehicleAnalyticsRow[];
  responsibleRows: ResponsibleAnalyticsRow[];
  driverRows: DriverAnalyticsRow[];
  storeRows: StoreAnalyticsRow[];
  costComposition: Array<{ name: string; value: number; fill: string }>;
  topVehicleCostChart: Array<{ name: string; totalCost: number; km: number }>;
  topVehicleKmChart: Array<{ name: string; km: number; fuelCost: number }>;
  responsibleCostChart: Array<{
    name: string;
    totalCost: number;
    fuelCost: number;
    maintenanceCost: number;
  }>;
  driverKmChart: Array<{ name: string; km: number; routesCount: number }>;
  insights: {
    topCostVehicle: AnalyticsInsight | null;
    topDistanceVehicle: AnalyticsInsight | null;
    bestEfficiencyVehicle: AnalyticsInsight | null;
    topResponsible: AnalyticsInsight | null;
    topDriver: AnalyticsInsight | null;
  };
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(value: number, divisor: number): number {
  if (!divisor) return 0;
  return value / divisor;
}

function parseIsoDate(isoDate?: string | null): Date | null {
  if (!isoDate) return null;
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function toMonthLabel(
  monthKey: string,
  locale: string,
  monthFormat: "long" | "short"
) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!year || !month) return monthKey;

  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString(locale, {
    month: monthFormat,
    year: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function updateLatestDate(
  currentValue: string | null,
  candidate?: string | null
) {
  if (!candidate) return currentValue;
  if (!currentValue) return candidate;
  return candidate > currentValue ? candidate : currentValue;
}

function ensureVehicleLabel(plate?: string, model?: string) {
  if (plate && model) return `${plate} · ${model}`;
  return plate || model || "Veículo não identificado";
}

export function getCurrentMonthKey(baseDate = new Date()) {
  return toMonthKey(baseDate);
}

export function getPreviousMonthKey(monthKey: string) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!year || !month) return monthKey;

  const previous = new Date(year, month - 2, 1);
  return toMonthKey(previous);
}

export function getMonthBounds(monthKey: string) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!year || !month) {
    return {
      startDate: "",
      endDate: "",
    };
  }

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const format = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;

  return {
    startDate: format(firstDay),
    endDate: format(lastDay),
  };
}

export function getMonthKeyFromIso(isoDate?: string | null) {
  const parsed = parseIsoDate(isoDate);
  return parsed ? toMonthKey(parsed) : null;
}

export function formatMonthLabel(monthKey: string, locale = "pt-BR") {
  return toMonthLabel(monthKey, locale, "long");
}

export function formatShortMonthLabel(monthKey: string, locale = "pt-BR") {
  return toMonthLabel(monthKey, locale, "short");
}

export function getVehicleResponsibleNames(vehicle?: ReportVehicleRecord) {
  if (!vehicle) return [];

  const names = new Set<string>();

  if (vehicle.responsibleUserName) {
    names.add(vehicle.responsibleUserName);
  }

  vehicle.responsibleUsers?.forEach((responsible) => {
    if (responsible?.name) {
      names.add(responsible.name);
    }
  });

  return Array.from(names);
}

export function getRouteDistanceKm(route: ReportRouteRecord) {
  if (route.status === "cancelada") return 0;

  if (route.distanceKm != null) {
    return Math.max(0, safeNumber(route.distanceKm));
  }

  if (route.endKm != null) {
    return Math.max(0, safeNumber(route.endKm) - safeNumber(route.startKm));
  }

  return 0;
}

export function getRouteReferenceDate(route: ReportRouteRecord) {
  if (route.status === "cancelada") {
    return route.canceledAt ?? route.endAt ?? route.startAt ?? null;
  }

  return route.endAt ?? route.startAt ?? null;
}

export function isDateInMonthKey(
  isoDate: string | null | undefined,
  monthKey: string
) {
  return getMonthKeyFromIso(isoDate) === monthKey;
}

export function buildMonthlyTrendData({
  routes,
  refuels,
  maintenances,
  locale = "pt-BR",
  limit = 12,
}: {
  routes: ReportRouteRecord[];
  refuels: ReportRefuelRecord[];
  maintenances: ReportMaintenanceRecord[];
  locale?: string;
  limit?: number;
}): MonthlyTrendPoint[] {
  const trendMap = new Map<string, MonthlyTrendPoint>();

  function ensureTrendPoint(monthKey: string) {
    if (!trendMap.has(monthKey)) {
      trendMap.set(monthKey, {
        monthKey,
        monthLabel: formatMonthLabel(monthKey, locale),
        shortLabel: formatShortMonthLabel(monthKey, locale),
        km: 0,
        liters: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        totalCost: 0,
        routesCount: 0,
        finishedRoutes: 0,
        cancelledRoutes: 0,
      });
    }

    return trendMap.get(monthKey)!;
  }

  routes.forEach((route) => {
    const monthKey = getMonthKeyFromIso(getRouteReferenceDate(route));
    if (!monthKey) return;

    const point = ensureTrendPoint(monthKey);
    point.routesCount += 1;

    if (route.status === "finalizada") {
      point.finishedRoutes += 1;
    }

    if (route.status === "cancelada") {
      point.cancelledRoutes += 1;
    }

    point.km += getRouteDistanceKm(route);
  });

  refuels.forEach((refuel) => {
    const monthKey = getMonthKeyFromIso(refuel.date);
    if (!monthKey) return;

    const point = ensureTrendPoint(monthKey);
    point.liters += safeNumber(refuel.liters);
    point.fuelCost += safeNumber(refuel.totalCost);
  });

  maintenances.forEach((maintenance) => {
    const monthKey = getMonthKeyFromIso(maintenance.date);
    if (!monthKey) return;

    const point = ensureTrendPoint(monthKey);
    point.maintenanceCost += safeNumber(maintenance.cost);
  });

  const sorted = Array.from(trendMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((point) => ({
      ...point,
      totalCost: point.fuelCost + point.maintenanceCost,
    }));

  return limit > 0 ? sorted.slice(-limit) : sorted;
}

type ResponsibleAccumulator = ResponsibleAnalyticsRow & {
  vehicleSet: Set<string>;
};

type DriverAccumulator = DriverAnalyticsRow & {
  vehicleSet: Set<string>;
  routesWithDistance: number;
};

type StoreAccumulator = StoreAnalyticsRow & {
  vehicleSet: Set<string>;
};

export function buildReportAnalytics({
  monthKey,
  routes,
  refuels,
  maintenances,
  vehicles,
  locale = "pt-BR",
}: {
  monthKey: string;
  routes: ReportRouteRecord[];
  refuels: ReportRefuelRecord[];
  maintenances: ReportMaintenanceRecord[];
  vehicles: ReportVehicleRecord[];
  locale?: string;
}): ReportAnalytics {
  const monthLabel = formatMonthLabel(monthKey, locale);
  const shortMonthLabel = formatShortMonthLabel(monthKey, locale);

  const filteredRoutes = routes.filter((route) =>
    isDateInMonthKey(getRouteReferenceDate(route), monthKey)
  );
  const filteredRefuels = refuels.filter((refuel) =>
    isDateInMonthKey(refuel.date, monthKey)
  );
  const filteredMaintenances = maintenances.filter((maintenance) =>
    isDateInMonthKey(maintenance.date, monthKey)
  );

  const vehicleById = new Map<string, ReportVehicleRecord>();
  vehicles.forEach((vehicle) => {
    vehicleById.set(vehicle.id, vehicle);
  });

  const vehicleMap = new Map<string, VehicleAnalyticsRow>();
  const responsibleMap = new Map<string, ResponsibleAccumulator>();
  const driverMap = new Map<string, DriverAccumulator>();
  const storeMap = new Map<string, StoreAccumulator>();

  function ensureVehicleRow(
    key: string,
    data: {
      vehicleId?: string;
      plate?: string;
      model?: string;
      storeId?: string;
      responsibleNames?: string[];
    }
  ) {
    if (!vehicleMap.has(key)) {
      vehicleMap.set(key, {
        key,
        vehicleId: data.vehicleId,
        plate: data.plate || "-",
        model: data.model || "-",
        vehicleLabel: ensureVehicleLabel(data.plate, data.model),
        storeId: data.storeId,
        responsibleNames: data.responsibleNames || [],
        km: 0,
        liters: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        totalCost: 0,
        routesCount: 0,
        finishedRoutes: 0,
        cancelledRoutes: 0,
        refuelsCount: 0,
        maintenancesCount: 0,
        costPerKm: 0,
        kmPerLiter: 0,
        avgFuelPrice: 0,
        avgFuelTicket: 0,
        utilizationShare: 0,
        hasActivity: false,
        lastActivityAt: null,
      });
    }

    return vehicleMap.get(key)!;
  }

  function ensureResponsibleRow(
    key: string,
    data: { responsibleId?: string; responsibleName?: string | null }
  ) {
    if (!responsibleMap.has(key)) {
      responsibleMap.set(key, {
        key,
        responsibleId: data.responsibleId,
        responsibleName: data.responsibleName || "Não identificado",
        km: 0,
        liters: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        totalCost: 0,
        routesCount: 0,
        finishedRoutes: 0,
        cancelledRoutes: 0,
        refuelsCount: 0,
        maintenancesCount: 0,
        vehiclesCount: 0,
        costPerKm: 0,
        kmPerLiter: 0,
        avgFuelTicket: 0,
        avgRouteDistance: 0,
        completionRate: 0,
        vehicleSet: new Set<string>(),
      });
    }

    return responsibleMap.get(key)!;
  }

  function ensureDriverRow(
    key: string,
    data: { driverId?: string; driverName?: string | null }
  ) {
    if (!driverMap.has(key)) {
      driverMap.set(key, {
        key,
        driverId: data.driverId,
        driverName: data.driverName || "Não informado",
        km: 0,
        routesCount: 0,
        finishedRoutes: 0,
        cancelledRoutes: 0,
        vehiclesCount: 0,
        avgRouteDistance: 0,
        completionRate: 0,
        lastRouteAt: null,
        vehicleSet: new Set<string>(),
        routesWithDistance: 0,
      });
    }

    return driverMap.get(key)!;
  }

  function ensureStoreRow(key: string) {
    if (!storeMap.has(key)) {
      storeMap.set(key, {
        key,
        storeId: key,
        km: 0,
        liters: 0,
        fuelCost: 0,
        maintenanceCost: 0,
        totalCost: 0,
        routesCount: 0,
        refuelsCount: 0,
        maintenancesCount: 0,
        vehiclesCount: 0,
        costPerKm: 0,
        kmPerLiter: 0,
        vehicleSet: new Set<string>(),
      });
    }

    return storeMap.get(key)!;
  }

  vehicles.forEach((vehicle) => {
    ensureVehicleRow(
      vehicle.id || ensureVehicleLabel(vehicle.plate, vehicle.model),
      {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        model: vehicle.model,
        storeId: vehicle.storeId,
        responsibleNames: getVehicleResponsibleNames(vehicle),
      }
    );
  });

  filteredRoutes.forEach((route) => {
    const vehicle =
      vehicleById.get(route.vehicleId) ||
      ({
        id: route.vehicleId,
        plate: route.vehiclePlate,
        model: route.vehicleModel,
        storeId: route.storeId || undefined,
      } satisfies ReportVehicleRecord);

    const vehicleKey =
      vehicle.id || ensureVehicleLabel(vehicle.plate, vehicle.model);
    const vehicleRow = ensureVehicleRow(vehicleKey, {
      vehicleId: vehicle.id,
      plate: route.vehiclePlate || vehicle.plate,
      model: route.vehicleModel || vehicle.model,
      storeId: vehicle.storeId,
      responsibleNames: getVehicleResponsibleNames(vehicle),
    });

    const distance = getRouteDistanceKm(route);
    const routeDate = getRouteReferenceDate(route);
    vehicleRow.routesCount += 1;
    vehicleRow.km += distance;
    vehicleRow.lastActivityAt = updateLatestDate(
      vehicleRow.lastActivityAt,
      routeDate
    );
    vehicleRow.hasActivity = true;

    if (route.status === "finalizada") {
      vehicleRow.finishedRoutes += 1;
    }

    if (route.status === "cancelada") {
      vehicleRow.cancelledRoutes += 1;
    }

    const responsibleKey =
      route.responsibleUserId || route.responsibleUserName || "unknown";
    const responsibleRow = ensureResponsibleRow(responsibleKey, {
      responsibleId: route.responsibleUserId,
      responsibleName:
        route.responsibleUserName ||
        getVehicleResponsibleNames(vehicle)[0] ||
        "Não identificado",
    });
    responsibleRow.routesCount += 1;
    responsibleRow.km += distance;
    responsibleRow.vehicleSet.add(vehicleKey);

    if (route.status === "finalizada") {
      responsibleRow.finishedRoutes += 1;
    }

    if (route.status === "cancelada") {
      responsibleRow.cancelledRoutes += 1;
    }

    const driverKey = route.driverId || route.driverName || "unknown-driver";
    const driverRow = ensureDriverRow(driverKey, {
      driverId: route.driverId,
      driverName: route.driverName,
    });
    driverRow.routesCount += 1;
    driverRow.km += distance;
    driverRow.vehicleSet.add(vehicleKey);
    driverRow.lastRouteAt = updateLatestDate(driverRow.lastRouteAt, routeDate);

    if (distance > 0) {
      driverRow.routesWithDistance += 1;
    }

    if (route.status === "finalizada") {
      driverRow.finishedRoutes += 1;
    }

    if (route.status === "cancelada") {
      driverRow.cancelledRoutes += 1;
    }

    const storeKey = vehicle.storeId || route.storeId || "Sem loja";
    const storeRow = ensureStoreRow(storeKey);
    storeRow.km += distance;
    storeRow.routesCount += 1;
    storeRow.vehicleSet.add(vehicleKey);
  });

  filteredRefuels.forEach((refuel) => {
    const vehicle =
      vehicleById.get(refuel.vehicleId) ||
      ({
        id: refuel.vehicleId,
        plate: refuel.vehiclePlate,
        model: refuel.vehicleModel || "",
        storeId: refuel.storeId,
      } satisfies ReportVehicleRecord);

    const vehicleKey =
      vehicle.id || ensureVehicleLabel(vehicle.plate, vehicle.model);
    const vehicleRow = ensureVehicleRow(vehicleKey, {
      vehicleId: vehicle.id,
      plate: refuel.vehiclePlate || vehicle.plate,
      model: refuel.vehicleModel || vehicle.model,
      storeId: vehicle.storeId,
      responsibleNames: getVehicleResponsibleNames(vehicle),
    });

    vehicleRow.refuelsCount += 1;
    vehicleRow.liters += safeNumber(refuel.liters);
    vehicleRow.fuelCost += safeNumber(refuel.totalCost);
    vehicleRow.lastActivityAt = updateLatestDate(
      vehicleRow.lastActivityAt,
      refuel.date
    );
    vehicleRow.hasActivity = true;

    const responsibleKey =
      refuel.responsibleUserId || refuel.responsibleUserName || "unknown";
    const responsibleRow = ensureResponsibleRow(responsibleKey, {
      responsibleId: refuel.responsibleUserId,
      responsibleName:
        refuel.responsibleUserName ||
        getVehicleResponsibleNames(vehicle)[0] ||
        "Não identificado",
    });
    responsibleRow.refuelsCount += 1;
    responsibleRow.liters += safeNumber(refuel.liters);
    responsibleRow.fuelCost += safeNumber(refuel.totalCost);
    responsibleRow.vehicleSet.add(vehicleKey);

    const storeKey = vehicle.storeId || refuel.storeId || "Sem loja";
    const storeRow = ensureStoreRow(storeKey);
    storeRow.refuelsCount += 1;
    storeRow.liters += safeNumber(refuel.liters);
    storeRow.fuelCost += safeNumber(refuel.totalCost);
    storeRow.vehicleSet.add(vehicleKey);
  });

  filteredMaintenances.forEach((maintenance) => {
    const vehicle =
      vehicleById.get(maintenance.vehicleId) ||
      ({
        id: maintenance.vehicleId,
        plate: maintenance.vehiclePlate,
        model: maintenance.vehicleModel || "",
        storeId: maintenance.storeId,
      } satisfies ReportVehicleRecord);

    const vehicleKey =
      vehicle.id || ensureVehicleLabel(vehicle.plate, vehicle.model);
    const vehicleRow = ensureVehicleRow(vehicleKey, {
      vehicleId: vehicle.id,
      plate: maintenance.vehiclePlate || vehicle.plate,
      model: maintenance.vehicleModel || vehicle.model,
      storeId: vehicle.storeId,
      responsibleNames: getVehicleResponsibleNames(vehicle),
    });

    vehicleRow.maintenancesCount += 1;
    vehicleRow.maintenanceCost += safeNumber(maintenance.cost);
    vehicleRow.lastActivityAt = updateLatestDate(
      vehicleRow.lastActivityAt,
      maintenance.date
    );
    vehicleRow.hasActivity = true;

    const responsibleKey =
      maintenance.responsibleUserId ||
      maintenance.responsibleUserName ||
      "unknown";
    const responsibleRow = ensureResponsibleRow(responsibleKey, {
      responsibleId: maintenance.responsibleUserId,
      responsibleName:
        maintenance.responsibleUserName ||
        getVehicleResponsibleNames(vehicle)[0] ||
        "Não identificado",
    });
    responsibleRow.maintenancesCount += 1;
    responsibleRow.maintenanceCost += safeNumber(maintenance.cost);
    responsibleRow.vehicleSet.add(vehicleKey);

    const storeKey = vehicle.storeId || maintenance.storeId || "Sem loja";
    const storeRow = ensureStoreRow(storeKey);
    storeRow.maintenancesCount += 1;
    storeRow.maintenanceCost += safeNumber(maintenance.cost);
    storeRow.vehicleSet.add(vehicleKey);
  });

  const vehicleRows = Array.from(vehicleMap.values());
  const totalKmVehicles = vehicleRows.reduce((acc, row) => acc + row.km, 0);

  const normalizedVehicleRows = vehicleRows
    .map((vehicleRow) => {
      const totalCost = vehicleRow.fuelCost + vehicleRow.maintenanceCost;

      return {
        ...vehicleRow,
        totalCost,
        costPerKm: safeDivide(totalCost, vehicleRow.km),
        kmPerLiter: safeDivide(vehicleRow.km, vehicleRow.liters),
        avgFuelPrice: safeDivide(vehicleRow.fuelCost, vehicleRow.liters),
        avgFuelTicket: safeDivide(
          vehicleRow.fuelCost,
          vehicleRow.refuelsCount
        ),
        utilizationShare: safeDivide(vehicleRow.km, totalKmVehicles) * 100,
        hasActivity:
          vehicleRow.routesCount > 0 ||
          vehicleRow.refuelsCount > 0 ||
          vehicleRow.maintenancesCount > 0,
      };
    })
    .sort((a, b) => {
      if (b.totalCost !== a.totalCost) return b.totalCost - a.totalCost;
      if (b.km !== a.km) return b.km - a.km;
      return a.vehicleLabel.localeCompare(b.vehicleLabel);
    });

  const normalizedResponsibleRows = Array.from(responsibleMap.values())
    .map(({ vehicleSet, ...responsibleRow }) => {
      const totalCost =
        responsibleRow.fuelCost + responsibleRow.maintenanceCost;

      return {
        ...responsibleRow,
        totalCost,
        vehiclesCount: vehicleSet.size,
        costPerKm: safeDivide(totalCost, responsibleRow.km),
        kmPerLiter: safeDivide(responsibleRow.km, responsibleRow.liters),
        avgFuelTicket: safeDivide(
          responsibleRow.fuelCost,
          responsibleRow.refuelsCount
        ),
        avgRouteDistance: safeDivide(
          responsibleRow.km,
          responsibleRow.routesCount - responsibleRow.cancelledRoutes
        ),
        completionRate: safeDivide(
          responsibleRow.finishedRoutes,
          responsibleRow.routesCount
        ),
      };
    })
    .sort((a, b) => {
      if (b.totalCost !== a.totalCost) return b.totalCost - a.totalCost;
      if (b.km !== a.km) return b.km - a.km;
      return a.responsibleName.localeCompare(b.responsibleName);
    });

  const normalizedDriverRows = Array.from(driverMap.values())
    .map(({ vehicleSet, routesWithDistance, ...driverRow }) => ({
      ...driverRow,
      vehiclesCount: vehicleSet.size,
      avgRouteDistance: safeDivide(driverRow.km, routesWithDistance),
      completionRate: safeDivide(driverRow.finishedRoutes, driverRow.routesCount),
    }))
    .sort((a, b) => {
      if (b.km !== a.km) return b.km - a.km;
      if (b.routesCount !== a.routesCount) return b.routesCount - a.routesCount;
      return a.driverName.localeCompare(b.driverName);
    });

  const normalizedStoreRows = Array.from(storeMap.values())
    .map(({ vehicleSet, ...storeRow }) => {
      const totalCost = storeRow.fuelCost + storeRow.maintenanceCost;

      return {
        ...storeRow,
        totalCost,
        vehiclesCount: vehicleSet.size,
        costPerKm: safeDivide(totalCost, storeRow.km),
        kmPerLiter: safeDivide(storeRow.km, storeRow.liters),
      };
    })
    .sort((a, b) => {
      if (b.totalCost !== a.totalCost) return b.totalCost - a.totalCost;
      if (b.km !== a.km) return b.km - a.km;
      return a.storeId.localeCompare(b.storeId);
    });

  const totalKm = filteredRoutes.reduce(
    (acc, route) => acc + getRouteDistanceKm(route),
    0
  );
  const totalLiters = filteredRefuels.reduce(
    (acc, refuel) => acc + safeNumber(refuel.liters),
    0
  );
  const totalFuelCost = filteredRefuels.reduce(
    (acc, refuel) => acc + safeNumber(refuel.totalCost),
    0
  );
  const totalMaintenanceCost = filteredMaintenances.reduce(
    (acc, maintenance) => acc + safeNumber(maintenance.cost),
    0
  );
  const totalCost = totalFuelCost + totalMaintenanceCost;
  const finishedRoutes = filteredRoutes.filter(
    (route) => route.status === "finalizada"
  ).length;
  const cancelledRoutes = filteredRoutes.filter(
    (route) => route.status === "cancelada"
  ).length;
  const inProgressRoutes = filteredRoutes.filter(
    (route) => route.status === "em_andamento"
  ).length;
  const routesWithDistance = filteredRoutes.filter(
    (route) => getRouteDistanceKm(route) > 0
  ).length;
  const activeVehicles = normalizedVehicleRows.filter(
    (vehicleRow) => vehicleRow.hasActivity
  ).length;
  const vehiclesWithMovement = normalizedVehicleRows.filter(
    (vehicleRow) => vehicleRow.km > 0
  ).length;

  const overview: OverviewMetrics = {
    totalKm,
    totalLiters,
    totalFuelCost,
    totalMaintenanceCost,
    totalCost,
    totalRoutes: filteredRoutes.length,
    finishedRoutes,
    cancelledRoutes,
    inProgressRoutes,
    routesWithDistance,
    refuelsCount: filteredRefuels.length,
    maintenancesCount: filteredMaintenances.length,
    openMaintenances: filteredMaintenances.filter(
      (maintenance) => maintenance.status === "em_andamento"
    ).length,
    completedMaintenances: filteredMaintenances.filter(
      (maintenance) => maintenance.status === "concluida"
    ).length,
    activeVehicles,
    vehiclesWithMovement,
    idleVehicles: Math.max(vehicles.length - activeVehicles, 0),
    driversCount: normalizedDriverRows.length,
    responsiblesCount: normalizedResponsibleRows.length,
    costPerKm: safeDivide(totalCost, totalKm),
    kmPerLiter: safeDivide(totalKm, totalLiters),
    avgRouteDistance: safeDivide(totalKm, routesWithDistance),
    avgFuelTicket: safeDivide(totalFuelCost, filteredRefuels.length),
    avgMaintenanceTicket: safeDivide(
      totalMaintenanceCost,
      filteredMaintenances.length
    ),
    completionRate: safeDivide(finishedRoutes, filteredRoutes.length),
    cancellationRate: safeDivide(cancelledRoutes, filteredRoutes.length),
    fuelCostShare: safeDivide(totalFuelCost, totalCost),
    maintenanceCostShare: safeDivide(totalMaintenanceCost, totalCost),
  };

  const costComposition = [
    { name: "Combustível", value: totalFuelCost, fill: "#f59e0b" },
    { name: "Manutenção", value: totalMaintenanceCost, fill: "#38bdf8" },
  ].filter((item) => item.value > 0);

  const topVehicleCostChart = normalizedVehicleRows
    .filter((vehicleRow) => vehicleRow.hasActivity)
    .slice(0, 8)
    .map((vehicleRow) => ({
      name: vehicleRow.plate,
      totalCost: vehicleRow.totalCost,
      km: vehicleRow.km,
    }));

  const topVehicleKmChart = [...normalizedVehicleRows]
    .filter((vehicleRow) => vehicleRow.km > 0)
    .sort((a, b) => b.km - a.km)
    .slice(0, 8)
    .map((vehicleRow) => ({
      name: vehicleRow.plate,
      km: vehicleRow.km,
      fuelCost: vehicleRow.fuelCost,
    }));

  const responsibleCostChart = normalizedResponsibleRows
    .slice(0, 8)
    .map((responsibleRow) => ({
      name: responsibleRow.responsibleName,
      totalCost: responsibleRow.totalCost,
      fuelCost: responsibleRow.fuelCost,
      maintenanceCost: responsibleRow.maintenanceCost,
    }));

  const driverKmChart = normalizedDriverRows.slice(0, 8).map((driverRow) => ({
    name: driverRow.driverName,
    km: driverRow.km,
    routesCount: driverRow.routesCount,
  }));

  const bestEfficiencyVehicle = [...normalizedVehicleRows]
    .filter((vehicleRow) => vehicleRow.km > 0 && vehicleRow.liters > 0)
    .sort((a, b) => b.kmPerLiter - a.kmPerLiter)[0];

  const topVehicleByCost = [...normalizedVehicleRows]
    .filter((vehicleRow) => vehicleRow.hasActivity)
    .sort((a, b) => b.totalCost - a.totalCost)[0];

  const topVehicleByDistance = [...normalizedVehicleRows]
    .filter((vehicleRow) => vehicleRow.km > 0)
    .sort((a, b) => b.km - a.km)[0];

  const topResponsible = normalizedResponsibleRows[0];
  const topDriver = normalizedDriverRows[0];

  return {
    monthKey,
    monthLabel,
    shortMonthLabel,
    overview,
    filteredRoutes,
    filteredRefuels,
    filteredMaintenances,
    vehicleRows: normalizedVehicleRows,
    responsibleRows: normalizedResponsibleRows,
    driverRows: normalizedDriverRows,
    storeRows: normalizedStoreRows,
    costComposition,
    topVehicleCostChart,
    topVehicleKmChart,
    responsibleCostChart,
    driverKmChart,
    insights: {
      topCostVehicle: topVehicleByCost
        ? {
            title: "Maior custo no mês",
            label: topVehicleByCost.vehicleLabel,
            value: topVehicleByCost.totalCost,
            unit: "currency",
          }
        : null,
      topDistanceVehicle: topVehicleByDistance
        ? {
            title: "Veículo que mais rodou",
            label: topVehicleByDistance.vehicleLabel,
            value: topVehicleByDistance.km,
            unit: "km",
          }
        : null,
      bestEfficiencyVehicle: bestEfficiencyVehicle
        ? {
            title: "Melhor eficiência",
            label: bestEfficiencyVehicle.vehicleLabel,
            value: bestEfficiencyVehicle.kmPerLiter,
            unit: "km_l",
          }
        : null,
      topResponsible: topResponsible
        ? {
            title: "Maior custo por responsável",
            label: topResponsible.responsibleName,
            value: topResponsible.totalCost,
            unit: "currency",
          }
        : null,
      topDriver: topDriver
        ? {
            title: "Motorista com mais km",
            label: topDriver.driverName,
            value: topDriver.km,
            unit: "km",
          }
        : null,
    },
  };
}
