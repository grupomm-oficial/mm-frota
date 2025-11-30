"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function TesteFirestorePage() {
  const [status, setStatus] = useState("Testando conexão com Firestore...");

  useEffect(() => {
    async function testar() {
      try {
        const ref = doc(db, "testes", "ping");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setStatus("Consegui ler o documento 'testes/ping'!");
        } else {
          setStatus(
            "Conectou no Firestore, mas o doc 'testes/ping' não existe (isso é OK)."
          );
        }
      } catch (error: any) {
        console.error("Erro ao testar Firestore:", error);
        setStatus("Erro ao consultar Firestore: " + error.message);
      }
    }

    testar();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-black text-yellow-400">
      <p>{status}</p>
    </div>
  );
}