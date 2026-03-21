import { PageLoadingState } from "@/components/layout/PageLoadingState";

export default function AuthLoading() {
  return (
    <PageLoadingState
      title="Preparando acesso"
      description="Estamos abrindo a autenticacao para voce entrar no sistema com seguranca."
      compact
    />
  );
}
