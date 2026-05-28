import { Gauge, MapPin, Truck } from "lucide-react";

interface AnimatedCarLoaderProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

export function AnimatedCarLoader({
  title = "Carregando rota",
  description = "Estamos preparando o proximo destino do sistema.",
  compact = false,
}: AnimatedCarLoaderProps) {
  return (
    <div className={compact ? "car-loader car-loader-compact" : "car-loader"}>
      <div className="car-loader-scene" aria-hidden="true">
        <div className="car-loader-skyline">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="car-loader-road">
          <div className="car-loader-road-line" />
          <div className="car-loader-road-line car-loader-road-line-delay" />
        </div>

        <div className="car-loader-vehicle">
          <div className="car-loader-vehicle-glow" />
          <div className="car-loader-vehicle-body">
            <div className="car-loader-vehicle-top" />
            <div className="car-loader-window car-loader-window-front" />
            <div className="car-loader-window car-loader-window-back" />
            <div className="car-loader-light car-loader-light-front" />
            <div className="car-loader-light car-loader-light-back" />
            <Truck className="car-loader-icon" />
          </div>
          <div className="car-loader-wheel car-loader-wheel-left" />
          <div className="car-loader-wheel car-loader-wheel-right" />
          <div className="car-loader-shadow" />
        </div>
      </div>

      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-yellow-200">
          <Gauge className="h-3.5 w-3.5" />
          <span>Grupo MM</span>
          <MapPin className="h-3.5 w-3.5" />
        </div>
        <p className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          {title}
        </p>
        <p className="mx-auto max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
    </div>
  );
}
