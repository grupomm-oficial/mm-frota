"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { Eye, EyeOff, KeyRound } from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/layout/StatusBanner";

export default function NovaSenhaPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [senha1, setSenha1] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [showSenha1, setShowSenha1] = useState(false);
  const [showSenha2, setShowSenha2] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
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
        setErro("As senhas nao conferem.");
        return;
      }

      if (!auth.currentUser || !user) {
        setErro("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        return;
      }

      await updatePassword(auth.currentUser, senha1);
      await updateDoc(doc(db, "users", user.id), { mustChangePassword: false });

      setOk("Senha alterada com sucesso.");

      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (error) {
      console.error("Erro ao trocar senha:", error);
      setErro("Nao foi possivel alterar a senha. Tente novamente.");
    }
  }

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="app-panel w-full max-w-md p-6 md:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
            <KeyRound className="h-5 w-5" />
          </div>

          <div>
            <p className="app-kicker">Primeiro acesso</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
              Definir nova senha
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Crie uma senha segura para continuar usando o sistema.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Input
              type={showSenha1 ? "text" : "password"}
              placeholder="Nova senha"
              value={senha1}
              onChange={(e) => setSenha1(e.target.value)}
              className="app-field pr-11"
            />
            <button
              type="button"
              onClick={() => setShowSenha1((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-white p-1.5 text-slate-500 transition hover:text-blue-700 dark:bg-slate-950/50 dark:text-slate-300"
              aria-label={showSenha1 ? "Ocultar senha" : "Mostrar senha"}
            >
              {showSenha1 ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="relative">
            <Input
              type={showSenha2 ? "text" : "password"}
              placeholder="Confirmar nova senha"
              value={senha2}
              onChange={(e) => setSenha2(e.target.value)}
              className="app-field pr-11"
            />
            <button
              type="button"
              onClick={() => setShowSenha2((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-border bg-white p-1.5 text-slate-500 transition hover:text-blue-700 dark:bg-slate-950/50 dark:text-slate-300"
              aria-label={showSenha2 ? "Ocultar senha" : "Mostrar senha"}
            >
              {showSenha2 ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {erro ? <StatusBanner tone="error">{erro}</StatusBanner> : null}
          {ok ? <StatusBanner tone="success">{ok}</StatusBanner> : null}

          <Button onClick={handleSalvar} className="w-full">
            Salvar nova senha
          </Button>
        </div>
      </Card>
    </main>
  );
}
