import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// ⚠️ Configuração correta do SEU projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDuROSLADRcBV48gW05PCgefg0tDJtoYdM",
  authDomain: "grupomm-frota-69a09.firebaseapp.com",
  projectId: "grupomm-frota-69a09",
  storageBucket: "grupomm-frota-69a09.appspot.com", // 🔥 corrigido!
  messagingSenderId: "522499273582",
  appId: "1:522499273582:web:17ef5a7a3181b70313877f",
};

// =========================================================
// 🔥 APP PRINCIPAL (onde o admin faz login normalmente)
// =========================================================

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth principal
export const auth = getAuth(app);

// Firestore com long polling (evita problemas de "client offline")
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// =========================================================
// 🔥 SECONDARY APP (para criar usuários SEM deslogar admin)
// =========================================================

let secondaryApp;

try {
  // tenta pegar o app secundário se já existir
  secondaryApp = getApp("secondary");
} catch {
  // senão, cria um novo
  secondaryApp = initializeApp(firebaseConfig, "secondary");
}

export const secondaryAuth = getAuth(secondaryApp);