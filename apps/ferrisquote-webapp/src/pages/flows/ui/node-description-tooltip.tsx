import type { ReactElement } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Shared hover-tooltip used by canvas nodes to display their description.
 * Change the `text-*` class here to resize globally.
 */
const DESCRIPTION_TEXT_CLASS = "text-sm leading-snug"

export function NodeDescriptionTooltip({
  description,
  children,
}: {
  description: string | undefined | null
  children: ReactElement
}) {
  if (!description) return children

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className={DESCRIPTION_TEXT_CLASS}>{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
