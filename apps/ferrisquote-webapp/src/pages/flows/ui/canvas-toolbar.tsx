import { Panel, useReactFlow } from "@xyflow/react"
import { Footprints, TextCursorInput, Calculator, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type DragNodeType = "stepNode" | "fieldNode" | "estimatorNode"

function ToolbarItem({
  type,
  icon: Icon,
  label,
  color,
  onClick,
}: {
  type: DragNodeType
  icon: React.ElementType
  label: string
  color?: string
  onClick?: () => void
}) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/ferrisquote-node", type)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          draggable
          onDragStart={onDragStart}
          onClick={onClick}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-dashed border-border bg-card cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all"
        >
          <Icon className="w-4 h-4" style={color ? { color } : undefined} />
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

type Props = {
  onClickStep: () => void
  onClickField: () => void
}

export function CanvasToolbar({ onClickStep, onClickField }: Props) {
  const { fitView } = useReactFlow()

  return (
    <Panel position="bottom-center">
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1.5 rounded-xl border bg-popover px-3 py-2 shadow-lg">
          <ToolbarItem
            type="stepNode"
            icon={Footprints}
            label="Add step"
            onClick={onClickStep}
          />
          <ToolbarItem
            type="fieldNode"
            icon={TextCursorInput}
            label="Add field"
            onClick={onClickField}
          />
          <ToolbarItem
            type="estimatorNode"
            icon={Calculator}
            label="Drag to add estimator"
            color="hsl(330, 80%, 60%)"
          />

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => fitView({ padding: 0.15, duration: 300 })}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit view</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </Panel>
  )
}
