import { HelpCircle } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Small `(?)` icon that shows a two-paragraph tooltip: a short explanation
 * plus a concrete example. Used next to section headers in the estimator
 * editor so non-dev users get context without having to read a manual.
 */
export function HelpHint({
  text,
  example,
  label,
}: {
  text: string
  example?: string
  label?: string
}) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label ?? "Aide"}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground transition-colors align-middle"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs text-xs leading-snug">
          <p>{text}</p>
          {example ? (
            <p className="mt-1.5 text-muted-foreground/90">{example}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
