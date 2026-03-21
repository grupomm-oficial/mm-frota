import type { ComponentProps } from "react";

import {
  CheckCheck,
  Eye,
  LoaderCircle,
  PencilLine,
  Power,
  PowerOff,
  Trash2,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ActionKind =
  | "view"
  | "edit"
  | "delete"
  | "complete"
  | "activate"
  | "deactivate"
  | "cancel";

interface ActionIconButtonProps
  extends Omit<ComponentProps<typeof Button>, "children" | "size" | "variant"> {
  action: ActionKind;
  loading?: boolean;
  label?: string;
  iconOnly?: boolean;
}

const actionMeta = {
  view: {
    label: "Detalhes",
    Icon: Eye,
    className:
      "border-transparent bg-slate-800 text-white shadow-[0_12px_24px_rgba(15,23,42,0.24)] hover:-translate-y-0.5 hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white",
  },
  edit: {
    label: "Editar",
    Icon: PencilLine,
    className:
      "border-transparent bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] hover:-translate-y-0.5 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400",
  },
  delete: {
    label: "Excluir",
    Icon: Trash2,
    className:
      "border-transparent bg-red-600 text-white shadow-[0_12px_24px_rgba(220,38,38,0.28)] hover:-translate-y-0.5 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400",
  },
  complete: {
    label: "Concluir",
    Icon: CheckCheck,
    className:
      "border-transparent bg-emerald-600 text-white shadow-[0_12px_24px_rgba(5,150,105,0.28)] hover:-translate-y-0.5 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400",
  },
  activate: {
    label: "Ativar",
    Icon: Power,
    className:
      "border-transparent bg-emerald-600 text-white shadow-[0_12px_24px_rgba(5,150,105,0.28)] hover:-translate-y-0.5 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400",
  },
  deactivate: {
    label: "Desativar",
    Icon: PowerOff,
    className:
      "border-transparent bg-red-600 text-white shadow-[0_12px_24px_rgba(220,38,38,0.28)] hover:-translate-y-0.5 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400",
  },
  cancel: {
    label: "Cancelar",
    Icon: XCircle,
    className:
      "border-transparent bg-red-600 text-white shadow-[0_12px_24px_rgba(220,38,38,0.28)] hover:-translate-y-0.5 hover:bg-red-500 dark:bg-red-500 dark:hover:bg-red-400",
  },
} satisfies Record<
  ActionKind,
  {
    label: string;
    Icon: typeof Eye;
    className: string;
  }
>;

export function ActionIconButton({
  action,
  loading = false,
  label,
  iconOnly = false,
  className,
  disabled,
  ...props
}: ActionIconButtonProps) {
  const meta = actionMeta[action];
  const accessibleLabel = label ?? meta.label;
  const Icon = loading ? LoaderCircle : meta.Icon;

  return (
    <Button
      type="button"
      size={iconOnly ? "icon-sm" : "sm"}
      variant="default"
      title={accessibleLabel}
      aria-label={accessibleLabel}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        iconOnly
          ? "shrink-0 rounded-xl"
          : "min-h-9 min-w-[110px] shrink-0 rounded-xl px-3.5 font-semibold",
        meta.className,
        className
      )}
      {...props}
    >
      <Icon className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
      {iconOnly ? (
        <span className="sr-only">{accessibleLabel}</span>
      ) : (
        <span>{accessibleLabel}</span>
      )}
    </Button>
  );
}
