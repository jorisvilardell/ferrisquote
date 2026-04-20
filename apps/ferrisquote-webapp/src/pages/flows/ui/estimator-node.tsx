import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Trash2, Calculator } from "lucide-react"
import type { Schemas } from "@/api/api.client"
import { NodeDescriptionTooltip } from "./node-description-tooltip"

export type EstimatorNodeData = {
  name: string
  description: string
  variables: Schemas.VariableResponse[]
  color: string
  onDelete: () => void
}

// Layout constants used both for handle positioning and node sizing.
const HEADER_H = 38 // px — header (icon + title + border)
const BODY_PY = 8 // px — vertical padding inside variables list
const ROW_H = 20 // px — each variable row
const ROW_GAP = 4 // px — space-y-1 gap between rows

/** Y position (in px from node top) of the center of variable at index `i`. */
function variableHandleY(i: number): number {
  return HEADER_H + BODY_PY + i * (ROW_H + ROW_GAP) + ROW_H / 2
}

export function EstimatorNode({ data, selected }: NodeProps<Node<EstimatorNodeData>>) {
  const c = data.color
  const ringColor = `${c.replace(")", " / 0.2)")}` // e.g. hsl(330, 80%, 60% / 0.2)

  const nodeInner = (
    <div
      className="group relative min-w-[200px] max-w-[240px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow cursor-pointer"
      style={{
        borderColor: selected ? c : undefined,
        boxShadow: selected ? `0 0 0 3px ${ringColor}` : undefined,
      }}
    >
      {/* Fallback handles at the header level (used when no variables exist) */}
      <Handle
        type="target"
        position={Position.Left}
        id="default"
        className="!border-2 !border-background !w-2.5 !h-2.5"
        style={{ backgroundColor: c, top: HEADER_H / 2 }}
      />
      <Handle
        id="default-source"
        type="source"
        position={Position.Right}
        className="!border-2 !border-background !w-2.5 !h-2.5"
        style={{ backgroundColor: c, top: HEADER_H / 2 }}
      />

      {/* Per-variable handles: one pair (target left + source right) per variable */}
      {data.variables.map((v, i) => {
        const y = variableHandleY(i)
        return (
          <div key={`handles-${v.id}`}>
            <Handle
              type="target"
              position={Position.Left}
              id={`target-${v.id}`}
              className="!border-2 !border-background !w-2 !h-2"
              style={{ backgroundColor: c, top: y }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`source-${v.id}`}
              className="!border-2 !border-background !w-2 !h-2"
              style={{ backgroundColor: c, top: y }}
            />
          </div>
        )
      })}

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
          {data.name.replace(/_/g, " ")}
        </p>
      </div>

      {/* Variables list — each row uses the same height as our handle offsets */}
      <div className="px-3" style={{ paddingTop: BODY_PY, paddingBottom: BODY_PY }}>
        {data.variables.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">No variables</p>
        ) : (
          data.variables.map((v, i) => (
            <div
              key={v.id}
              className="flex items-center gap-1.5"
              style={{ height: ROW_H, marginTop: i === 0 ? 0 : ROW_GAP }}
            >
              <span
                className="text-xs font-mono font-medium shrink-0"
                style={{ color: c }}
              >
                {v.name.replace(/_/g, " ")}
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

  return (
    <NodeDescriptionTooltip description={data.description}>
      {nodeInner}
    </NodeDescriptionTooltip>
  )
}
