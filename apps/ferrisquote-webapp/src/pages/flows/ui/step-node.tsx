import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Trash2, Repeat } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Schemas } from "@/api/api.client"

export type StepNodeData = {
  index: number
  title: string
  description: string
  fields: Schemas.FieldResponse[]
  isExpanded?: boolean
  isRepeatable?: boolean
  linkTarget?: boolean
  onDelete: () => void
}

type StepNodeProps = NodeProps<Node<StepNodeData>>

const STEP_COLOR = "hsl(28, 85%, 55%)"

export function StepNode({ data, dragging, selected }: StepNodeProps) {
  return (
    <div
      className={cn(
        "group relative min-w-[200px] rounded-md border bg-card text-card-foreground shadow-sm transition-all cursor-pointer",
        dragging
          ? "shadow-lg opacity-80 scale-[1.02] animate-pulse cursor-grabbing"
          : data.linkTarget
            ? "border-primary ring-2 ring-primary/40 shadow-md animate-pulse"
            : selected
              ? "shadow-md"
              : data.isExpanded
                ? "border-primary ring-2 ring-primary/20 shadow-md"
                : "border-border hover:border-primary/50 hover:shadow-md",
      )}
      style={
        dragging ? { borderColor: STEP_COLOR, boxShadow: `0 0 0 3px hsl(28 85% 55% / 0.25)` }
        : selected ? { borderColor: STEP_COLOR, boxShadow: `0 0 0 3px hsl(28 85% 55% / 0.2)` }
        : undefined
      }
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!border-2 !border-background !bg-primary !w-3 !h-3"
      />

      {/* Hover actions */}
      <div className="absolute -top-3 right-2 hidden group-hover:flex items-center gap-1 z-10">
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
        {data.isRepeatable && (
          <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0" title="Repeatable step">
            <Repeat className="w-3 h-3" />
          </span>
        )}
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
