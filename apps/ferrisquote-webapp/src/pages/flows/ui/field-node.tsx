import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Trash2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type FieldNodeData = {
  label: string
  type: string
  description: string
  color: string
  index: number
  onDelete: () => void
}

export function FieldNode({ data, selected }: NodeProps<Node<FieldNodeData>>) {
  const nodeInner = (
    <div
      className="group relative min-w-[160px] rounded-md border border-border/60 bg-card text-card-foreground shadow-sm px-3 py-2 cursor-pointer transition-shadow animate-[field-enter_0.25s_ease-out_both]"
      style={{
        borderLeftColor: data.color,
        borderLeftWidth: 3,
        borderColor: selected ? data.color : undefined,
        boxShadow: selected ? `0 0 0 2px color-mix(in srgb, ${data.color} 25%, transparent)` : undefined,
        animationDelay: `${data.index * 40}ms`,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!border-2 !border-background !bg-muted-foreground !w-2.5 !h-2.5"
      />

      {/* Hover actions */}
      <div className="absolute -top-3 right-1 hidden group-hover:flex items-center gap-1 z-10">
        <button
          className="flex items-center justify-center w-5 h-5 rounded bg-card border border-border shadow-sm hover:border-destructive hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            data.onDelete()
          }}
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      </div>

      <p className="text-sm font-medium leading-tight truncate">{data.label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{data.type}</p>

      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!border-2 !border-background !bg-muted-foreground !w-2 !h-2"
      />
    </div>
  )

  if (!data.description) return nodeInner

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>{nodeInner}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{data.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
