import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { Trash2, Calculator, AlertTriangle } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Schemas } from "@/api/api.client"
import { NodeDescriptionTooltip } from "./node-description-tooltip"

export type EstimatorNodeData = {
  name: string
  description: string
  inputs: Schemas.InputResponse[]
  outputs: Schemas.OutputResponse[]
  color: string
  /** Number of live diagnostics attached to this estimator. When > 0 the
   *  node shows a red ⚠ badge; click is handled by ReactFlow's node click
   *  handler which opens the edit panel. */
  errorCount?: number
  onDelete: () => void
}

const HEADER_H = 38
const BODY_PY = 8
const ROW_H = 20
const ROW_GAP = 4
const SECTION_GAP = 12
const SECTION_HEADER_H = 14

function inputHandleY(i: number): number {
  return HEADER_H + BODY_PY + SECTION_HEADER_H + i * (ROW_H + ROW_GAP) + ROW_H / 2
}

function outputHandleY(inputCount: number, i: number): number {
  const inputsBlock = inputCount * (ROW_H + ROW_GAP) - (inputCount > 0 ? ROW_GAP : 0)
  const base = HEADER_H + BODY_PY + SECTION_HEADER_H + inputsBlock + SECTION_GAP + SECTION_HEADER_H
  return base + i * (ROW_H + ROW_GAP) + ROW_H / 2
}

function paramTypeLabel(pt: Schemas.EstimatorParameterTypeDto): string {
  if (pt.kind === "product") {
    return pt.label_filter ? `product<${pt.label_filter}>` : "product"
  }
  return pt.kind
}

export function EstimatorNode({ data, selected }: NodeProps<Node<EstimatorNodeData>>) {
  const { t } = useTranslation()
  const c = data.color
  const ringColor = `${c.replace(")", " / 0.2)")}`
  const inputColor = "hsl(158, 64%, 52%)"
  const hasError = (data.errorCount ?? 0) > 0

  const nodeInner = (
    <div
      className="group relative min-w-[220px] max-w-[260px] rounded-md border bg-card text-card-foreground shadow-sm transition-shadow cursor-pointer"
      style={{
        borderColor: hasError
          ? "var(--destructive)"
          : selected
            ? c
            : undefined,
        boxShadow: hasError
          ? "0 0 0 2px color-mix(in srgb, var(--destructive) 25%, transparent)"
          : selected
            ? `0 0 0 3px ${ringColor}`
            : undefined,
      }}
    >
      {/* Fallback handles at header when no inputs/outputs */}
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

      {/* Per-input target handles (left) */}
      {data.inputs.map((i, idx) => (
        <Handle
          key={`target-input-${i.id}`}
          type="target"
          position={Position.Left}
          id={`target-input-${i.id}`}
          className="!border-2 !border-background !w-2 !h-2"
          style={{ backgroundColor: inputColor, top: inputHandleY(idx) }}
        />
      ))}

      {/* Per-output source handles (right) + a target on the output for chaining */}
      {data.outputs.map((o, idx) => {
        const y = outputHandleY(data.inputs.length, idx)
        return (
          <div key={`handles-${o.id}`}>
            <Handle
              type="target"
              position={Position.Left}
              id={`target-${o.id}`}
              className="!border-2 !border-background !w-2 !h-2"
              style={{ backgroundColor: c, top: y }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`source-${o.id}`}
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

      {/* Error badge — always visible when the node has diagnostics so the
          user spots the problem without hovering. */}
      {hasError && (
        <div
          className="absolute -top-2 -left-2 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground shadow z-10"
          title={String(data.errorCount)}
        >
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}

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

      {/* Body: Inputs section (left-anchored) + Outputs section (right-anchored) */}
      <div className="px-3" style={{ paddingTop: BODY_PY, paddingBottom: BODY_PY }}>
        {/* Inputs */}
        <div
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ height: SECTION_HEADER_H, lineHeight: `${SECTION_HEADER_H}px` }}
        >
          {t("node.estimator.inputs")}
        </div>
        {data.inputs.length === 0 ? (
          <div
            className="text-xs text-muted-foreground/50 italic"
            style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
          >
            {t("node.estimator.none")}
          </div>
        ) : (
          data.inputs.map((i, idx) => (
            <div
              key={i.id}
              className="flex items-center gap-1.5"
              style={{ height: ROW_H, marginTop: idx === 0 ? 0 : ROW_GAP }}
            >
              <span
                className="text-xs font-mono font-medium shrink-0"
                style={{ color: inputColor }}
              >
                {i.key}
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                : {paramTypeLabel(i.parameter_type)}
              </span>
            </div>
          ))
        )}

        {/* Outputs */}
        <div
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right"
          style={{
            height: SECTION_HEADER_H,
            lineHeight: `${SECTION_HEADER_H}px`,
            marginTop: SECTION_GAP,
          }}
        >
          {t("node.estimator.outputs")}
        </div>
        {data.outputs.length === 0 ? (
          <div
            className="text-xs text-muted-foreground/50 italic text-right"
            style={{ height: ROW_H, lineHeight: `${ROW_H}px` }}
          >
            {t("node.estimator.none")}
          </div>
        ) : (
          data.outputs.map((o, idx) => (
            <div
              key={o.id}
              className="flex items-center justify-end gap-1.5"
              style={{ height: ROW_H, marginTop: idx === 0 ? 0 : ROW_GAP }}
            >
              <span className="text-[10px] text-muted-foreground truncate">
                = {o.expression}
              </span>
              <span className="text-xs font-mono font-medium shrink-0" style={{ color: c }}>
                {o.key}
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
