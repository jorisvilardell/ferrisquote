import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Pencil, Trash2 } from "lucide-react"

export type FieldNodeData = {
  label: string
  type: string
  color: string
  onEdit: () => void
  onDelete: () => void
}

export function FieldNode({ data }: NodeProps<Node<FieldNodeData>>) {
  return (
    <div
      className="group relative min-w-[160px] rounded-md border border-border/60 bg-card text-card-foreground shadow-sm px-3 py-2"
      style={{
        borderLeftColor: data.color,
        borderLeftWidth: 3,
        backgroundImage: `linear-gradient(to right, color-mix(in srgb, ${data.color} 4%, transparent), transparent)`,
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
          className="flex items-center justify-center w-5 h-5 rounded bg-card border border-border shadow-sm hover:border-primary hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            data.onEdit()
          }}
        >
          <Pencil className="w-2.5 h-2.5" />
        </button>
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
    </div>
  )
}
