"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/layout/StatusBanner";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErro("");

      if (!username || !senha) {
        setErro("Preencha usuario e senha para entrar.");
        return;
      }

      setSubmitting(true);

      const usernameRef = doc(db, "usernames", username.trim());
      const usernameSnap = await getDoc(usernameRef);

      if (!usernameSnap.exists()) {
        setErro("Usuario nao encontrado.");
        return;
      }

      const email = usernameSnap.data().email;
      const cred = await signInWithEmailAndPassword(auth, email, senha);

      const userRef = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setErro("Conta configurada incorretamente. Contate o administrador.");
        return;
      }

      const userData = userSnap.data();

      if (userData.mustChangePassword) {
        router.push("/nova-senha");
        return;
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("ERRO LOGIN:", error);
      setErro("Usuario ou senha incorretos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 dark:bg-black">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.04)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] dark:opacity-20" />

      <Card className="relative z-10 w-full max-w-[460px] overflow-hidden rounded-[36px] border-0 bg-[#1451d8] p-0 shadow-[0_32px_80px_rgba(20,81,216,0.22)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-yellow-300" />
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-yellow-300/20 blur-3xl" />

        <div className="relative px-6 py-8 md:px-8 md:py-10">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
              <div className="relative h-full w-full">
                <Image
                  src="/mm-frota-logo.png"
                  alt="Logo Grupo MM"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">
              Gestao de Frotas
            </h1>
            <p className="mt-2 text-base font-medium text-blue-100">
              Grupo MM
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                Usuario
              </label>
              <Input
                placeholder="Digite seu usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 border-2 border-yellow-300/90 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-yellow-400 focus-visible:ring-yellow-300/30"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
                Senha
              </label>
              <div className="relative">
                <Input
                  placeholder="Digite sua senha"
                  type={showSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="h-12 border-2 border-yellow-300/90 bg-white pr-12 text-slate-900 placeholder:text-slate-400 focus-visible:border-yellow-400 focus-visible:ring-yellow-300/30"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-blue-100 p-2 text-blue-700 transition hover:bg-blue-200"
                  aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showSenha ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {erro ? (
              <StatusBanner
                tone="error"
                className="border-white/20 bg-white/95 text-red-700"
              >
                {erro}
              </StatusBanner>
            ) : null}

            {submitting ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                <LoaderCircle className="h-4 w-4 animate-spin text-yellow-300" />
                <span>Validando acesso e preparando seu painel...</span>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-300 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-yellow-300/80 animate-pulse [animation-delay:180ms]" />
                  <span className="h-2 w-2 rounded-full bg-yellow-300/60 animate-pulse [animation-delay:360ms]" />
                </div>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full border-0 bg-yellow-300 text-slate-950 shadow-[0_16px_30px_rgba(250,204,21,0.22)] hover:bg-yellow-200"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar no sistema"
              )}
            </Button>
          </form>
        </div>
      </Card>
    </main>
  );
}
