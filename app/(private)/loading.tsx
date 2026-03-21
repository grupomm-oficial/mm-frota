import { PageLoadingState } from "@/components/layout/PageLoadingState";

export default function PrivateLoading() {
  return (
    <PageLoadingState
      title="Abrindo area interna"
      description="Estamos carregando a proxima tela da operacao para evitar cliques repetidos e deixar a navegacao mais clara."
    />
  );
}
