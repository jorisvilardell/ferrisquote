import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import type { FlowField } from "../feature/flow.types"

export type FieldNodeData = Pick<FlowField, "label" | "type">

export function FieldNode({ data }: NodeProps<Node<FieldNodeData>>) {
  return (
    <div className="min-w-[160px] rounded-md border border-border/60 bg-card text-card-foreground shadow-sm px-3 py-2">
      <Handle
        type="target"
        position={Position.Left}
        className="!border-2 !border-background !bg-muted-foreground !w-2.5 !h-2.5"
      />
      <p className="text-sm font-medium leading-tight truncate">{data.label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{data.type}</p>
    </div>
  )
}
