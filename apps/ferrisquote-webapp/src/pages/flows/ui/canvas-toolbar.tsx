import { Panel, useReactFlow } from "@xyflow/react"
import { GripVertical, Maximize2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Props = {
  onAddStep: () => void
  onReorder: () => void
}

export function CanvasToolbar({ onAddStep, onReorder }: Props) {
  const { fitView } = useReactFlow()
  return (
    <Panel position="bottom-center">
      <TooltipProvider delayDuration={400}>
        <div className="flex items-center gap-1 rounded-xl border bg-popover px-2 py-1.5 shadow-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onAddStep}>
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add step</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={onReorder}>
                <GripVertical />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reorder steps</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => fitView({ padding: 0.15, duration: 300 })}>
                <Maximize2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit view</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </Panel>
  )
}
