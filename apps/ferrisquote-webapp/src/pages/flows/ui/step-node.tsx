import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FlowStep } from "../feature/flow.types"

export type StepNodeData = Pick<FlowStep, "title" | "description" | "rank" | "fields">

type StepNodeProps = NodeProps<Node<StepNodeData>>

export function StepNode({ data, selected }: StepNodeProps) {
  return (
    <div
      className={cn(
        "group relative min-w-[200px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow",
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-primary/50 hover:shadow-md"
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
            // TODO: open edit panel
          }}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-destructive hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: delete step
          }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b border-border/60">
        <span className="text-xs font-mono text-muted-foreground">{data.rank}</span>
        <p className="text-sm font-medium leading-tight flex-1 truncate">{data.title}</p>
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
    </div>
  )
}
