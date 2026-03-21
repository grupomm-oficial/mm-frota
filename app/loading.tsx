import { PageLoadingState } from "@/components/layout/PageLoadingState";

export default function RootLoading() {
  return (
    <div className="app-shell px-4 py-6 md:px-6">
      <PageLoadingState
        title="Iniciando MM Frota"
        description="Estamos organizando a entrada no sistema para abrir a area correta sem precisar repetir a navegacao."
        compact
      />
    </div>
  );
}
