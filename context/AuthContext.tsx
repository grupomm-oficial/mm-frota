"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface UserData {
  id: string;
  name: string;
  role: "admin" | "user";
  storeId: string;
  mustChangePassword: boolean;
  active: boolean;
}

interface AuthContextProps {
  user: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) return;

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);

        if (!mounted) return;

        if (!snap.exists()) {
          setUser(null);
          await signOut(auth);
          return;
        }

        const data = snap.data();
        const isActive = data.active !== false;

        if (!isActive) {
          setUser(null);
          await signOut(auth);
          return;
        }

        setUser({
          id: firebaseUser.uid,
          name: typeof data.name === "string" ? data.name : "Usuario MM",
          role: data.role === "admin" ? "admin" : "user",
          storeId: typeof data.storeId === "string" ? data.storeId : "",
          mustChangePassword: Boolean(data.mustChangePassword),
          active: isActive,
        });
      } catch (error) {
        console.error("Erro ao recuperar sessao do usuario:", error);

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
