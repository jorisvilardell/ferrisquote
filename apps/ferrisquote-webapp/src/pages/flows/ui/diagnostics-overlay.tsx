import { useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  diagnosticI18n,
  type Diagnostic,
} from "@/pages/flows/lib/flow-diagnostics"
import { cn } from "@/lib/utils"

/**
 * Floating counter + collapsible list of live diagnostics. Sits above the
 * ReactFlow surface at the bottom-right. Hidden entirely when there are
 * no problems so it doesn't clutter a healthy graph.
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

  if (diagnostics.length === 0) return null

  return (
    <div className="absolute right-4 bottom-4 z-20 max-w-sm">
      <div className="rounded-md border border-destructive/40 bg-background/95 shadow-lg backdrop-blur">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-destructive"
          onClick={() => setOpen((p) => !p)}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            {t("diagnostics.title", { count: diagnostics.length })}
          </span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>
        {open && (
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
