import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PanelHeader({
  title,
  description,
  onClose,
  actions,
}: {
  title: string
  description?: string
  onClose: () => void
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 px-5 py-4 border-b shrink-0">
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold leading-tight truncate">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        )}
      </div>
      {actions}
      <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={onClose}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}
