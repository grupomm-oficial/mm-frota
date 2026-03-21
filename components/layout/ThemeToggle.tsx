"use client";

import { MonitorCog, Moon, Sun } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme, toggleTheme } = useTheme();

  if (compact) {
    return (
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={toggleTheme}
        className={className}
        aria-label={theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"}
      >
        {theme === "light" ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {[
        { value: "light", label: "Claro", icon: Sun },
        { value: "dark", label: "Escuro", icon: Moon },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value as "light" | "dark")}
          className={cn(
            "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
            theme === value
              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200"
              : "border-border bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-blue-400/20 dark:hover:bg-blue-500/10"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}

      <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
        <MonitorCog className="h-4 w-4" />
        Aplicado em todo o sistema
      </div>
    </div>
  );
}
