export type StoreOption = {
  key: string;
  label: string;
};

export function normalizeStoreKey(value?: string | null) {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function storesMatch(
  first?: string | null,
  second?: string | null
) {
  const firstKey = normalizeStoreKey(first);
  const secondKey = normalizeStoreKey(second);

  return Boolean(firstKey && secondKey && firstKey === secondKey);
}

export function getCanonicalStoreOptions(
  values: Array<string | null | undefined>
): StoreOption[] {
  const storesByKey = new Map<string, string>();

  values.forEach((value) => {
    const label = (value ?? "").trim();
    const key = normalizeStoreKey(label);

    if (!key || storesByKey.has(key)) return;

    storesByKey.set(key, label);
  });

  return Array.from(storesByKey.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export function getStoreKeySet(values: Array<string | null | undefined>) {
  return new Set(
    values.map((value) => normalizeStoreKey(value)).filter(Boolean)
  );
}
