export type FirestoreRecord = Record<string, unknown>;

export function toFirestoreRecord(value: unknown): FirestoreRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as FirestoreRecord;
  }

  return {};
}

export function getStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function getOptionalStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function getNumberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getOptionalNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getStringArrayValue(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalizedItems = value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );

  return normalizedItems.length > 0 ? normalizedItems : undefined;
}
