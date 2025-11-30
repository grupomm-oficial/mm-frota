"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function NovaSenhaPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [senha1, setSenha1] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      // se não tem usuário logado, manda pro login
      router.replace("/login");
    }
  }, [user, loading, router]);

  async function handleSalvar() {
    try {
      setErro("");
      setOk("");

      if (!senha1 || !senha2) {
        setErro("Preencha os dois campos de senha.");
        return;
      }

      if (senha1 !== senha2) {
        setErro("As senhas não conferem.");
        return;
      }

      if (!auth.currentUser || !user) {
        setErro("Sessão expirada. Faça login novamente.");
        router.replace("/login");
        return;
      }

      // 1. Atualizar senha no Firebase Auth
      await updatePassword(auth.currentUser, senha1);

      // 2. Atualizar flag mustChangePassword no Firestore
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, { mustChangePassword: false });

      setOk("Senha alterada com sucesso!");
      // 3. Redirecionar para o dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);

    } catch (error: any) {
      console.error("Erro ao trocar senha:", error);
      setErro("Não foi possível alterar a senha. Tente novamente.");
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <Card className="w-[380px] p-6 bg-neutral-900 border border-yellow-400 shadow-lg shadow-yellow-600/20">
        <h1 className="text-2xl font-bold text-yellow-400 mb-4 text-center">
          Definir nova senha
        </h1>
        <p className="text-sm text-gray-300 mb-4">
          Esta é sua primeira vez no sistema. Defina uma nova senha segura
          para continuar.
        </p>

        <Input
          type="password"
          placeholder="Nova senha"
          value={senha1}
          onChange={(e) => setSenha1(e.target.value)}
          className="mb-3"
        />

        <Input
          type="password"
          placeholder="Confirmar nova senha"
          value={senha2}
          onChange={(e) => setSenha2(e.target.value)}
          className="mb-4"
        />

        {erro && <p className="text-red-400 text-sm mb-2">{erro}</p>}
        {ok && <p className="text-green-400 text-sm mb-2">{ok}</p>}

        <Button
          onClick={handleSalvar}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
        >
          Salvar nova senha
        </Button>
      </Card>
    </div>
  );
}
