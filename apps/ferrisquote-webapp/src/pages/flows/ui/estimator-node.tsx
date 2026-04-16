import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Trash2, Calculator } from "lucide-react"
import type { Schemas } from "@/api/api.client"

export type EstimatorNodeData = {
  name: string
  variables: Schemas.VariableResponse[]
  color: string
  onDelete: () => void
}

export function EstimatorNode({ data, selected }: NodeProps<Node<EstimatorNodeData>>) {
  const c = data.color
  const ringColor = `${c.replace(")", " / 0.2)")}` // e.g. hsl(330, 80%, 60% / 0.2)

  return (
    <div
      className="group relative min-w-[200px] max-w-[240px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow cursor-pointer"
      style={{
        borderColor: selected ? c : undefined,
        boxShadow: selected ? `0 0 0 3px ${ringColor}` : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!border-2 !border-background !w-2.5 !h-2.5"
        style={{ backgroundColor: c }}
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
      <div
        className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 border-b"
        style={{ borderBottomColor: `color-mix(in srgb, ${c} 20%, transparent)` }}
      >
        <span
          className="flex items-center justify-center w-5 h-5 rounded-full shrink-0"
          style={{ backgroundColor: c, color: "white" }}
        >
          <Calculator className="w-3 h-3" />
        </span>
        <p className="text-sm font-semibold leading-tight flex-1 truncate">
          {data.name}
        </p>
      </div>

      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!border-2 !border-background !w-2.5 !h-2.5"
        style={{ backgroundColor: c }}
      />

      {/* Variables list */}
      <div className="px-3 py-2 space-y-1">
        {data.variables.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">No variables</p>
        ) : (
          data.variables.map((v) => (
            <div key={v.id} className="flex items-baseline gap-1.5">
              <span
                className="text-xs font-mono font-medium shrink-0"
                style={{ color: c }}
              >
                {v.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                = {v.expression}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
