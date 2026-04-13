import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Schemas } from "@/api/api.client"

export type StepNodeData = {
  index: number
  title: string
  description: string
  fields: Schemas.FieldResponse[]
  isExpanded?: boolean
  onEdit: () => void
  onDelete: () => void
}

type StepNodeProps = NodeProps<Node<StepNodeData>>

export function StepNode({ data }: StepNodeProps) {
  return (
    <div
      className={cn(
        "group relative min-w-[200px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow cursor-pointer",
        data.isExpanded
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-primary/50 hover:shadow-md",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!border-2 !border-background !bg-primary !w-3 !h-3"
      />

      {/* Hover actions */}
      <div className="absolute -top-3 right-2 hidden group-hover:flex items-center gap-1 z-10">
        <button
          className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-primary hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            data.onEdit()
          }}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-destructive hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            data.onDelete()
          }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-border/60">
        <span className="text-xs font-mono text-muted-foreground">{data.index}</span>
        <p className="text-base font-semibold leading-tight flex-1 truncate">{data.title}</p>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {data.description ? (
          <p className="text-xs text-muted-foreground leading-tight">{data.description}</p>
        ) : (
          <p className="text-xs text-muted-foreground/50 italic">No description</p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          {data.fields.length} field{data.fields.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!border-2 !border-background !bg-primary !w-3 !h-3"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!border-2 !border-background !bg-muted-foreground !w-2.5 !h-2.5"
      />
    </div>
  )
}
