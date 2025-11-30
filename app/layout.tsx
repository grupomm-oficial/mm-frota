import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "MM Frota",
  description: "Sistema de Gestão de Frota do Grupo MM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className="bg-black text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}