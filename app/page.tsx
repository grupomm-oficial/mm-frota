"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { PageLoadingState } from "@/components/layout/PageLoadingState";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="app-shell px-4 py-6 md:px-6">
      <PageLoadingState
        title="Redirecionando voce"
        description="Estamos identificando seu acesso para abrir a area correta do MM Frota."
        compact
      />
    </div>
  );
}
