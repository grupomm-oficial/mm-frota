import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getStoreKeySet, normalizeStoreKey } from "@/lib/store-utils";

type UserScope = {
  id: string;
  role?: string | null;
  storeId?: string | null;
};

const FIRESTORE_IN_LIMIT = 30;

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function chunkValues(values: string[]) {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += FIRESTORE_IN_LIMIT) {
    chunks.push(values.slice(index, index + FIRESTORE_IN_LIMIT));
  }

  return chunks;
}

function mergeDocs(
  groups: QueryDocumentSnapshot<DocumentData>[][]
): QueryDocumentSnapshot<DocumentData>[] {
  const map = new Map<string, QueryDocumentSnapshot<DocumentData>>();

  groups.flat().forEach((snapshot) => {
    map.set(snapshot.id, snapshot);
  });

  return Array.from(map.values());
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

async function getOptionalQueryDocs(queryRef: Query<DocumentData>, label: string) {
  try {
    const snapshot = await getDocs(queryRef);
    return snapshot.docs;
  } catch (error) {
    if (getErrorCode(error) === "permission-denied") {
      console.warn(`Consulta opcional bloqueada pelas regras: ${label}`);
      return [];
    }

    throw error;
  }
}

export async function getVehicleDocsForUser(db: Firestore, user: UserScope) {
  if (user.role === "admin") {
    const snapshot = await getDocs(collection(db, "vehicles"));
    return snapshot.docs;
  }

  const [multiResponsibleDocs, singleResponsibleDocs] = await Promise.all([
    getOptionalQueryDocs(
      query(
        collection(db, "vehicles"),
        where("responsibleUserIds", "array-contains", user.id)
      ),
      "vehicles por responsaveis"
    ),
    getOptionalQueryDocs(
      query(collection(db, "vehicles"), where("responsibleUserId", "==", user.id)),
      "vehicles por responsavel principal"
    ),
  ]);

  return mergeDocs([multiResponsibleDocs, singleResponsibleDocs]);
}

export async function getDocsForVehicleIds(
  db: Firestore,
  collectionName: string,
  vehicleIds: Array<string | null | undefined>
) {
  const ids = uniqueNonEmpty(vehicleIds);
  if (!ids.length) return [];

  const snapshots = await Promise.all(
    chunkValues(ids).map((chunk) =>
      getOptionalQueryDocs(
        query(collection(db, collectionName), where("vehicleId", "in", chunk)),
        `${collectionName} por veiculos`
      )
    )
  );

  return mergeDocs(snapshots);
}

export async function getRecordDocsForUserByVehicles(
  db: Firestore,
  collectionName: string,
  user: UserScope,
  vehicleIds: Array<string | null | undefined>
) {
  if (user.role === "admin") {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs;
  }

  return getDocsForVehicleIds(db, collectionName, vehicleIds);
}

export async function getDriverDocsForUserByStores(
  db: Firestore,
  user: UserScope,
  storeIds: Array<string | null | undefined> = []
) {
  if (user.role === "admin") {
    const snapshot = await getDocs(collection(db, "drivers"));
    return snapshot.docs;
  }

  const scopedStoreKeys = getStoreKeySet([user.storeId, ...storeIds]);
  const [driverDocs, responsibleDocs] = await Promise.all([
    getOptionalQueryDocs(collection(db, "drivers"), "drivers por lojas"),
    getOptionalQueryDocs(
      query(collection(db, "drivers"), where("responsibleUserId", "==", user.id)),
      "drivers por responsavel principal"
    ),
  ]);

  const storeDocs = driverDocs.filter((snapshot) => {
    const storeId = snapshot.data().storeId;

    return (
      typeof storeId === "string" &&
      scopedStoreKeys.has(normalizeStoreKey(storeId))
    );
  });

  return mergeDocs([storeDocs, responsibleDocs]);
}
