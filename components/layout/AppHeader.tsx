"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-neutral-950/80 backdrop-blur">
      <div>
        <h2 className="text-sm font-semibold text-yellow-400">
          Painel de Gestão de Frota
        </h2>
        {user && (
          <p className="text-xs text-gray-400">
            Logado como <span className="font-semibold">{user.name}</span> ·{" "}
            <span className="uppercase">{user.role}</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <span className="text-xs text-gray-400">
            Loja: <span className="font-semibold">{user.storeId}</span>
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-black text-xs"
          onClick={handleLogout}
        >
          Sair
        </Button>
      </div>
    </header>
  );
}