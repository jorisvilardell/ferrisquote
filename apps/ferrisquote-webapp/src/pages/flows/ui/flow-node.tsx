import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type FlowNodeData = {
  label: string
  description?: string
}

type FlowNodeProps = NodeProps<Node<FlowNodeData>>

export function FlowNode({ data, selected }: FlowNodeProps) {
  return (
    <div
      className={cn(
        "group relative min-w-[180px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow",
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-primary/50 hover:shadow-md"
      )}
    >
      {/* Target handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!border-2 !border-background !bg-primary !w-3 !h-3"
      />

      {/* Actions — visible on hover */}
      <div className="absolute -top-3 right-2 hidden group-hover:flex items-center gap-1 z-10">
        <button
          className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-primary hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: open edit panel
          }}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-destructive hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: delete node
          }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium leading-tight">{data.label}</p>
        {data.description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
            {data.description}
          </p>
        )}
      </div>

      {/* Source handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-2 !border-background !bg-primary !w-3 !h-3"
      />
    </div>
  )
}
