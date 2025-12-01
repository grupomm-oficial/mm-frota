"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  async function handleLogin() {
    try {
      setErro("");

      if (!username || !senha) {
        setErro("Preencha usuário e senha");
        return;
      }

      const usernameRef = doc(db, "usernames", username);
      const usernameSnap = await getDoc(usernameRef);

      if (!usernameSnap.exists()) {
        setErro("Usuário não encontrado");
        return;
      }

      const email = usernameSnap.data().email;
      const cred = await signInWithEmailAndPassword(auth, email, senha);

      const userRef = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setErro("Conta configurada incorretamente. Contate o Admin.");
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
      setErro("Usuário ou senha incorretos");
    }
  }

  return (
    <div
      className="
        flex items-center justify-center h-screen 
        bg-gradient-to-br from-black via-neutral-900 to-yellow-700/20
      "
    >
      <Card className="w-[350px] p-6 bg-neutral-900/95 border border-yellow-400 shadow-lg shadow-yellow-500/20 backdrop-blur-md">

        {/* LOGO */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-24 h-24 mb-2 drop-shadow-[0_0_10px_rgba(255,215,0,0.4)]">
            <Image
              src="/mm-frota-logo.png"
              alt="Logo MM Frota"
              fill
              className="object-contain"
            />
          </div>

          <p className="text-xs text-gray-300 text-center tracking-wide -mt-1">
            Sistema de Gestão de Frota · Grupo MM
          </p>
        </div>

        {/* Usuário */}
        <Input
          placeholder="Usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="
            mb-3 bg-neutral-950 border border-neutral-700
            text-gray-100 placeholder:text-gray-500
            focus:border-yellow-500 focus:ring-yellow-500
          "
        />

        {/* Campo de senha com olhinho */}
        <div className="relative mb-4">
          <Input
            placeholder="Senha"
            type={showSenha ? "text" : "password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="
              bg-neutral-950 border border-neutral-700 w-full
              text-gray-100 placeholder:text-gray-500
              focus:border-yellow-500 focus:ring-yellow-500
              pr-10
            "
          />

          {/* Botão de ver senha */}
          <button
            type="button"
            onClick={() => setShowSenha(!showSenha)}
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              text-black bg-yellow-400 p-[3px] rounded-full
              hover:bg-yellow-300 transition
            "
          >
            {showSenha ? (
              <EyeOff size={16} className="text-black" />
            ) : (
              <Eye size={16} className="text-black" />
            )}
          </button>
        </div>

        {erro && (
          <p className="text-red-400 mb-3 text-sm font-medium text-center">
            {erro}
          </p>
        )}

        <Button
          onClick={handleLogin}
          className="
            w-full bg-yellow-500 hover:bg-yellow-400 
            text-black font-bold py-2
          "
        >
          Entrar
        </Button>
      </Card>
    </div>
  );
}