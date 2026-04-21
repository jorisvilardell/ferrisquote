import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  diagnosticI18n,
  type Diagnostic,
} from "@/pages/flows/lib/flow-diagnostics"
import { cn } from "@/lib/utils"

/**
 * Floating health indicator for the flow. Always visible so the user has a
 * constant "is my flow working?" signal:
 *   - green ✓ when no diagnostic is reported
 *   - red ⚠ counter otherwise, expandable into a list with jump-to links.
 */
export function DiagnosticsOverlay({
  diagnostics,
  onGoTo,
}: {
  diagnostics: Diagnostic[]
  onGoTo: (d: Diagnostic) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const healthy = diagnostics.length === 0

  return (
    <div className="absolute left-4 top-4 z-20 max-w-sm">
      <div
        className={cn(
          "rounded-md border bg-background/95 shadow-lg backdrop-blur",
          healthy ? "border-emerald-500/40" : "border-destructive/40",
        )}
      >
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium",
            healthy ? "text-emerald-600" : "text-destructive",
          )}
          onClick={() => !healthy && setOpen((p) => !p)}
          disabled={healthy}
        >
          {healthy ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="flex-1">
            {healthy
              ? t("diagnostics.flow_healthy")
              : t("diagnostics.title", { count: diagnostics.length })}
          </span>
          {!healthy &&
            (open ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
            ))}
        </button>
        {!healthy && open && (
          <ul className="max-h-80 overflow-y-auto border-t border-destructive/20">
            {diagnostics.map((d, i) => {
              const { key, vars } = diagnosticI18n(d)
              return (
                <li
                  key={`${d.kind}-${i}`}
                  className={cn(
                    "px-3 py-2 text-xs border-b border-border/40 last:border-b-0",
                    "hover:bg-accent/40 cursor-pointer transition-colors",
                  )}
                  onClick={() => onGoTo(d)}
                >
                  <p className="leading-snug">{t(key, vars)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                    {t("diagnostics.go_to")} →
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
