import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react"
import { memo, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Schemas } from "@/api/api.client"
import {
  useAddField,
  useAddStep,
  useRemoveField,
  useRemoveStep,
  useReorderStep,
  useGetFlow,
} from "@/api/flows.api"
import { useCreateEstimator, useDeleteEstimator, useEstimators } from "@/api/estimators.api"
import { useBindings, useCreateBinding } from "@/api/bindings.api"
import {
  overlayEstimators,
  useEstimatorDraftStore,
} from "@/pages/flows/feature/estimator-draft-store"
import { idsToNames } from "@/pages/flows/lib/expression-refs"
import { useCanvasDragDrop } from "@/pages/flows/hooks/use-canvas-drag-drop"
import { useDeleteDialogs } from "@/pages/flows/hooks/use-delete-dialogs"
import { useLinkingMode } from "@/pages/flows/hooks/use-linking-mode"
import { usePendingFocus } from "@/pages/flows/hooks/use-pending-focus"
import { useStepReorder } from "@/pages/flows/hooks/use-step-reorder"
import { CanvasToolbar } from "../ui/canvas-toolbar"
import { EstimatorNode, type EstimatorNodeData } from "../ui/estimator-node"
import { FieldNode, type FieldNodeData } from "../ui/field-node"
import { StepNode, type StepNodeData } from "../ui/step-node"
import type { PanelState } from "./flow-edit-panel"

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
  fieldNode: FieldNode,
  estimatorNode: EstimatorNode,
}

const STEP_NODE_HEIGHT = 90
const STEP_NODE_GAP = 60
const FIELD_NODE_HEIGHT = 56
const FIELD_NODE_GAP = 16
const FIELD_X_OFFSET = 280
const ESTIMATOR_X_OFFSET = 560
const ESTIMATOR_X_STEP = 320
const ESTIMATOR_NODE_GAP = 24

type FieldRef = { type: "field"; key: string; aggregation: false }
type AggregationRef = { type: "field"; key: string; aggregation: "SUM" | "AVG" | "COUNT_ITER" }
type CrossRef = { type: "cross"; estimatorId: string; variableName: string }
type ExprRef = FieldRef | AggregationRef | CrossRef

function extractExprRefs(expression: string): ExprRef[] {
  const refs: ExprRef[] = []
  const seen = new Set<string>()

  const crossRegex = /@#([A-Za-z0-9-]+)\.([a-z][a-z0-9_]*)/g
  let match: RegExpExecArray | null
  while ((match = crossRegex.exec(expression)) !== null) {
    const tag = `cross:${match[1]}.${match[2]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ type: "cross", estimatorId: match[1], variableName: match[2] })
    }
  }

  const noCross = expression.replace(/@#[A-Za-z0-9-]+\.[a-z][a-z0-9_]*/g, "")

  const aggRegex = /(SUM|AVG|COUNT_ITER)\(\s*@([a-z][a-z0-9_]*)\s*\)/g
  while ((match = aggRegex.exec(noCross)) !== null) {
    const tag = `agg:${match[1]}:${match[2]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ type: "field", key: match[2], aggregation: match[1] as AggregationRef["aggregation"] })
    }
  }

  const stripped = noCross.replace(/(SUM|AVG|COUNT_ITER)\(\s*@[a-z][a-z0-9_]*\s*\)/g, "")
  const bareRegex = /@([a-z][a-z0-9_]*)/g
  while ((match = bareRegex.exec(stripped)) !== null) {
    const tag = `bare:${match[1]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ type: "field", key: match[1], aggregation: false })
    }
  }

  return refs
}

function buildGraph(
  flow: Schemas.FlowResponse,
  estimators: Schemas.EstimatorResponse[],
  rawEstimators: Schemas.EstimatorResponse[],
  bindings: Schemas.BindingResponse[],
  expandedStepIds: Set<string>,
  linkingField: false | "form" | "quick",
  dropIndicatorIndex: number | null,
  selectedNodeId: string | null,
  onDeleteStep: (stepId: string) => void,
  onDeleteField: (fieldId: string, stepId: string) => void,
  onDeleteEstimator: (estimatorId: string) => void,
): { nodes: Node[]; edges: Edge[]; stepPositions: Map<string, number> } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const stepPositions = new Map<string, number>()
  let yOffset = 0

  const fieldKeyMap = new Map<string, { fieldNodeId: string; stepId: string; expanded: boolean }>()

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]
    const isExpanded = expandedStepIds.has(step.id)
    const stepY = i * (STEP_NODE_HEIGHT + STEP_NODE_GAP) + yOffset

    stepPositions.set(step.id, stepY)

    for (const field of step.fields) {
      fieldKeyMap.set(field.key, {
        fieldNodeId: `field-${field.id}`,
        stepId: step.id,
        expanded: isExpanded,
      })
    }

    if (dropIndicatorIndex === i) {
      nodes.push({
        id: "__drop-indicator__",
        type: "default",
        position: { x: 0, y: stepY - STEP_NODE_GAP / 2 - 2 },
        data: {},
        selectable: false,
        draggable: false,
        style: {
          width: 200,
          height: 4,
          borderRadius: 2,
          background: "var(--primary)",
          border: "none",
          padding: 0,
          pointerEvents: "none" as const,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        },
      })
    }

    const stepNode: Node<StepNodeData> = {
      id: step.id,
      type: "stepNode",
      position: { x: 0, y: stepY },
      draggable: true,
      selected: selectedNodeId === step.id,
      style: {
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
      data: {
        index: i + 1,
        title: step.title,
        description: step.description,
        fields: step.fields,
        isRepeatable: step.is_repeatable,
        linkTarget: !!linkingField,
        onDelete: () => onDeleteStep(step.id),
      },
    }
    nodes.push(stepNode)

    if (i < flow.steps.length - 1) {
      edges.push({
        id: `e-${step.id}-${flow.steps[i + 1].id}`,
        source: step.id,
        target: flow.steps[i + 1].id,
        type: "smoothstep",
        animated: true,
        style: { transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" },
      })
    }

    if (step.fields.length > 0) {
      const totalFieldsHeight =
        step.fields.length * (FIELD_NODE_HEIGHT + FIELD_NODE_GAP) - FIELD_NODE_GAP
      const hueStep = step.fields.length > 1 ? 200 / (step.fields.length - 1) : 0

      step.fields.forEach((field, j) => {
        const fieldNodeId = `field-${field.id}`
        const targetY = stepY + j * (FIELD_NODE_HEIGHT + FIELD_NODE_GAP)
        // When collapsed, fields snap back under the step and fade out —
        // keeps them in the DOM so React Flow can animate opacity + position
        // instead of mounting/unmounting.
        const fieldY = isExpanded ? targetY : stepY
        const xOffset = isExpanded ? FIELD_X_OFFSET : 0
        const opacity = isExpanded ? 1 : 0
        const pointerEvents = isExpanded ? ("auto" as const) : ("none" as const)
        const color = `hsl(${28 + j * hueStep}, 85%, 55%)`

        const fieldNode: Node<FieldNodeData> = {
          id: fieldNodeId,
          type: "fieldNode",
          position: { x: xOffset, y: fieldY },
          selected: selectedNodeId === fieldNodeId,
          style: {
            opacity,
            pointerEvents,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          },
          data: {
            label: field.label,
            type: field.config.type,
            description: field.description,
            color,
            index: j,
            onDelete: () => onDeleteField(field.id, step.id),
          },
        }
        nodes.push(fieldNode)

        edges.push({
          id: `e-field-${field.id}`,
          source: step.id,
          sourceHandle: "right",
          target: fieldNodeId,
          type: "smoothstep",
          animated: false,
          style: {
            strokeWidth: 1.5,
            stroke: color,
            opacity,
            // Fade edges in slightly after the node position settles when
            // expanding; snap-out fast when collapsing.
            transition: isExpanded
              ? "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.15s"
              : "opacity 0.1s ease-out 0s",
          },
        })
      })

      if (isExpanded) {
        const extraSpace = Math.max(0, totalFieldsHeight - STEP_NODE_HEIGHT)
        yOffset += extraSpace + STEP_NODE_GAP
      }
    }
  }

  if (dropIndicatorIndex === flow.steps.length && flow.steps.length > 0) {
    const lastStepY =
      (flow.steps.length - 1) * (STEP_NODE_HEIGHT + STEP_NODE_GAP) + yOffset
    nodes.push({
      id: "__drop-indicator__",
      type: "default",
      position: { x: 0, y: lastStepY + STEP_NODE_HEIGHT + STEP_NODE_GAP / 2 - 2 },
      data: {},
      selectable: false,
      draggable: false,
      style: {
        width: 200,
        height: 4,
        borderRadius: 2,
        background: "var(--primary)",
        border: "none",
        padding: 0,
        pointerEvents: "none" as const,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    })
  }

  // ─── Estimator nodes (right columns, laid out by dep depth) ──────────────
  const CROSS_COLOR = "hsl(320, 60%, 55%)"
  const estIdToNodeId = new Map<string, string>()
  const estIdToColor = new Map<string, string>()

  const estCrossDeps = new Map<string, Set<string>>()
  for (const est of estimators) {
    const deps = new Set<string>()
    for (const o of est.outputs) {
      for (const ref of extractExprRefs(o.expression)) {
        if (ref.type === "cross" && ref.estimatorId !== est.id) {
          deps.add(ref.estimatorId)
        }
      }
    }
    estCrossDeps.set(est.id, deps)
  }

  const depthMemo = new Map<string, number>()
  function computeDepth(estId: string, visiting: Set<string>): number {
    if (depthMemo.has(estId)) return depthMemo.get(estId)!
    if (visiting.has(estId)) return 0
    visiting.add(estId)
    let maxDepth = 0
    for (const depId of estCrossDeps.get(estId) ?? []) {
      if (estCrossDeps.has(depId)) {
        maxDepth = Math.max(maxDepth, computeDepth(depId, visiting) + 1)
      }
    }
    visiting.delete(estId)
    depthMemo.set(estId, maxDepth)
    return maxDepth
  }

  const estByDepth = new Map<number, Schemas.EstimatorResponse[]>()
  for (const est of estimators) {
    const d = computeDepth(est.id, new Set())
    if (!estByDepth.has(d)) estByDepth.set(d, [])
    estByDepth.get(d)!.push(est)
  }

  for (let ei = 0; ei < estimators.length; ei++) {
    const est = estimators[ei]
    const estimatorNodeId = `estimator-${est.id}`
    estIdToNodeId.set(est.id, estimatorNodeId)

    const DARK = 55
    const PALE = 82
    const STEP = 4
    const needed = DARK + (estimators.length - 1) * STEP
    const actualRange = needed > PALE ? PALE - DARK : (estimators.length - 1) * STEP
    const lgt = estimators.length > 1
      ? DARK + (ei / (estimators.length - 1)) * actualRange
      : DARK
    const color = `hsl(335, 70%, ${lgt}%)`
    estIdToColor.set(est.id, color)
  }

  const estimatorsIndex = estimators.map((e) => ({ id: e.id, name: e.name }))

  for (const [d, estsAtDepth] of estByDepth) {
    const x = ESTIMATOR_X_OFFSET + d * ESTIMATOR_X_STEP
    let y = 0
    for (const est of estsAtDepth) {
      const inputCount = est.inputs.length
      const outputCount = est.outputs.length
      const nodeHeight =
        54 + Math.max(inputCount, 1) * 24 + 24 + Math.max(outputCount, 1) * 24
      const estimatorNodeId = `estimator-${est.id}`
      const color = estIdToColor.get(est.id) ?? "hsl(335, 70%, 55%)"

      const displayOutputs = est.outputs.map((o) => ({
        ...o,
        expression: idsToNames(o.expression, estimatorsIndex),
      }))

      const estNode: Node<EstimatorNodeData> = {
        id: estimatorNodeId,
        type: "estimatorNode",
        position: { x, y },
        selected: selectedNodeId === estimatorNodeId,
        style: {
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        },
        data: {
          name: est.name,
          description: est.description,
          inputs: est.inputs,
          outputs: displayOutputs,
          color,
          onDelete: () => onDeleteEstimator(est.id),
        },
      }
      nodes.push(estNode)
      y += nodeHeight + ESTIMATOR_NODE_GAP
    }
  }

  // Build per-estimator lookup: output key → output id (for cross-ref edges)
  const estOutputKeyToId = new Map<string, Map<string, string>>()
  for (const est of estimators) {
    const m = new Map<string, string>()
    for (const o of est.outputs) m.set(o.key, o.id)
    estOutputKeyToId.set(est.id, m)
  }

  for (const est of estimators) {
    const estimatorNodeId = `estimator-${est.id}`
    const estColor = estIdToColor.get(est.id) ?? "hsl(330, 75%, 58%)"

    for (const o of est.outputs) {
      const refs = extractExprRefs(o.expression)
      for (const ref of refs) {
        if (ref.type === "cross") {
          const sourceNodeId = estIdToNodeId.get(ref.estimatorId)
          if (sourceNodeId && sourceNodeId !== estimatorNodeId) {
            const sourceOutputId = estOutputKeyToId
              .get(ref.estimatorId)
              ?.get(ref.variableName)
            const sourceHandle = sourceOutputId ? `source-${sourceOutputId}` : "default-source"
            edges.push({
              id: `e-cross-${est.id}-${o.id}-${ref.estimatorId}.${ref.variableName}`,
              source: sourceNodeId,
              sourceHandle,
              target: estimatorNodeId,
              targetHandle: `target-${o.id}`,
              type: "smoothstep",
              animated: true,
              style: {
                strokeWidth: 2,
                stroke: CROSS_COLOR,
                opacity: 0.8,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              },
              label: ref.variableName.replace(/_/g, " "),
              labelStyle: { fill: CROSS_COLOR, fontSize: 10, fontWeight: 600 },
              labelBgStyle: { fill: "var(--background)", fillOpacity: 0.9 },
              labelBgPadding: [4, 2] as [number, number],
            })
          }
        } else {
          const info = fieldKeyMap.get(ref.key)
          if (!info) continue

          const sourceId = info.expanded ? info.fieldNodeId : info.stepId
          const isAgg = ref.aggregation !== false

          edges.push({
            id: `e-est-${est.id}-${o.id}-${ref.key}-${ref.aggregation || "direct"}`,
            source: sourceId,
            sourceHandle: "right",
            target: estimatorNodeId,
            targetHandle: `target-${o.id}`,
            type: "smoothstep",
            animated: isAgg,
            style: {
              strokeWidth: isAgg ? 2 : 1.5,
              stroke: estColor,
              opacity: 0.7,
              strokeDasharray: isAgg ? "6 3" : undefined,
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            },
            label: isAgg ? ref.aggregation : undefined,
            labelStyle: isAgg ? { fill: estColor, fontSize: 10, fontWeight: 600 } : undefined,
            labelBgStyle: isAgg ? { fill: "var(--background)", fillOpacity: 0.9 } : undefined,
            labelBgPadding: isAgg ? ([4, 2] as [number, number]) : undefined,
          })
        }
      }
    }
  }

  // ─── Binding input wiring edges ──────────────────────────────────────────
  // Two kinds of edges depending on the source:
  //   - Field → input: emerald (matches input handle color)
  //   - Binding output → input (chaining): rose (matches output handle color)
  const INPUT_COLOR = "hsl(158, 64%, 52%)"
  const OUTPUT_COLOR = "hsl(330, 80%, 60%)"
  const estById = new Map<string, Schemas.EstimatorResponse>(
    estimators.map((e) => [e.id, e]),
  )
  // Raw (non-overlaid) lookup — bindings persist input/output keys in their
  // server form, so while a user is renaming an input locally the binding
  // mapping still refers to the old key. Resolving the input through the
  // raw estimator by old key gives us the stable id; we then use that id
  // to target the handle on the overlaid node (handle ids are id-based, not
  // key-based, so they don't flicker during renames).
  const rawEstById = new Map<string, Schemas.EstimatorResponse>(
    rawEstimators.map((e) => [e.id, e]),
  )
  const bindingById = new Map<string, Schemas.BindingResponse>(
    bindings.map((b) => [b.id, b]),
  )

  for (const binding of bindings) {
    const est = estById.get(binding.estimator_id)
    const rawEst = rawEstById.get(binding.estimator_id)
    if (!est) continue
    const estimatorNodeId = `estimator-${binding.estimator_id}`
    // utoipa widens inputs_mapping to Record<string, unknown> — cast locally
    const mapping = binding.inputs_mapping as Record<
      string,
      Schemas.InputBindingValueDto
    >

    for (const [inputKey, source] of Object.entries(mapping)) {
      // Prefer raw match (the binding's key is still the server-side one
      // during an in-flight local rename); fall back to the overlaid view
      // so freshly added inputs still wire up.
      const input =
        rawEst?.inputs.find((i) => i.key === inputKey) ??
        est.inputs.find((i) => i.key === inputKey)
      if (!input) continue

      if (source.source === "field") {
        const fieldInfo = flow.steps
          .flatMap((s) => s.fields.map((f) => ({ f, stepId: s.id })))
          .find((x) => x.f.id === source.field_id)
        if (!fieldInfo) continue

        const stepExpanded = expandedStepIds.has(fieldInfo.stepId)
        const sourceId = stepExpanded
          ? `field-${fieldInfo.f.id}`
          : fieldInfo.stepId

        edges.push({
          id: `e-bind-${binding.id}-${input.id}`,
          source: sourceId,
          sourceHandle: "right",
          target: estimatorNodeId,
          targetHandle: `target-input-${input.id}`,
          type: "smoothstep",
          animated: false,
          style: {
            strokeWidth: 2,
            stroke: INPUT_COLOR,
            opacity: 0.85,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: INPUT_COLOR },
          label: inputKey,
          labelStyle: { fill: INPUT_COLOR, fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: "var(--background)", fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
        })
      } else if (source.source === "binding_output") {
        const upstream = bindingById.get(source.binding_id)
        if (!upstream) continue
        const upstreamEst = estById.get(upstream.estimator_id)
        const upstreamRaw = rawEstById.get(upstream.estimator_id)
        if (!upstreamEst) continue
        // Same raw-first fallback as inputs — output keys on the binding
        // reflect server state, so during a local rename the raw estimator
        // owns the stable id we need for the handle.
        const upstreamOutput =
          upstreamRaw?.outputs.find((o) => o.key === source.output_key) ??
          upstreamEst.outputs.find((o) => o.key === source.output_key)
        if (!upstreamOutput) continue

        const upstreamNodeId = `estimator-${upstream.estimator_id}`
        // Self-chain (binding pointing to itself) makes no sense and would
        // fail backend validation — skip to avoid visual noise.
        if (upstreamNodeId === estimatorNodeId) continue

        edges.push({
          id: `e-bind-chain-${binding.id}-${input.id}`,
          source: upstreamNodeId,
          sourceHandle: `source-${upstreamOutput.id}`,
          target: estimatorNodeId,
          targetHandle: `target-input-${input.id}`,
          type: "smoothstep",
          animated: false,
          style: {
            strokeWidth: 2,
            stroke: OUTPUT_COLOR,
            opacity: 0.85,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: OUTPUT_COLOR },
          label: `${source.output_key} → ${inputKey}`,
          labelStyle: { fill: OUTPUT_COLOR, fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: "var(--background)", fillOpacity: 0.9 },
          labelBgPadding: [4, 2] as [number, number],
        })
      }
    }
  }

  return { nodes, edges, stepPositions }
}

type Props = {
  flowId: string
  panelState: PanelState | null
  setPanelState: (s: PanelState | null) => void
}

/**
 * Self-contained canvas. Owns its own queries, mutations and canvas-side
 * UX hooks (linking, drag-drop, reorder, delete confirms, pending focus).
 * Memoized so sidenav/panel state changes that don't affect the canvas
 * don't cause it to rerender.
 */
function FlowCanvasImpl({ flowId, panelState, setPanelState }: Props) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { getNodes, fitView, setCenter, getZoom, screenToFlowPosition } = useReactFlow()

  const { data: flowData } = useGetFlow(flowId)
  const { data: estimatorsData } = useEstimators(flowId)
  const { data: bindingsData } = useBindings(flowId)
  const flow = flowData?.data ?? null
  const rawEstimators = estimatorsData?.data?.estimators ?? []
  const bindings = bindingsData?.data?.bindings ?? []

  // Overlay sidenav drafts so the graph reflects unsaved edits live
  const drafts = useEstimatorDraftStore()
  const estimators = overlayEstimators(rawEstimators, drafts)

  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const stepPositionsRef = useRef<Map<string, number>>(new Map())

  // ─── Canvas mutations ─────────────────────────────────────────────────────
  const { mutate: addStep } = useAddStep(flowId)
  const { mutate: addField } = useAddField(flowId)
  const { mutate: removeStep } = useRemoveStep(flowId)
  const { mutate: removeField } = useRemoveField(flowId)
  const { mutate: createEstimator } = useCreateEstimator(flowId)
  const { mutate: deleteEstimator } = useDeleteEstimator(flowId)
  const { mutate: reorderStep } = useReorderStep(flowId)
  const { mutate: createBinding } = useCreateBinding(flowId)

  // ─── Canvas hooks ─────────────────────────────────────────────────────────
  const { linkingField, setLinkingField } = useLinkingMode(flow, fitView)
  const { setPendingFocusNodeId } = usePendingFocus(
    getNodes,
    setCenter,
    getZoom,
    [flow, estimators],
  )
  const deleteDialogs = useDeleteDialogs({
    flow,
    estimators,
    panelState,
    setPanelState,
    removeStep,
    removeField,
    deleteEstimator,
  })
  const { onDragOver, onDrop, quickCreateField } = useCanvasDragDrop({
    flowId,
    estimators,
    screenToFlowPosition,
    getNodes,
    setPanelState,
    setExpandedStepIds,
    setLinkingField,
    setPendingFocusNodeId,
    addStep,
    addField,
    createEstimator,
    createBinding,
  })
  const { dropIndicatorIndex, onNodeDrag, onNodeDragStop } = useStepReorder(
    flow,
    stepPositionsRef,
    reorderStep,
  )

  // Reset canvas-local state when flow switches
  if (flow === null) {
    // flowId changed and data not loaded — harmless
  }

  // ─── Node click handlers ──────────────────────────────────────────────────
  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (linkingField && node.type === "stepNode") {
      const mode = linkingField
      setLinkingField(false)
      setExpandedStepIds(new Set([node.id]))
      if (mode === "form") {
        setPanelState({ mode: "add-field", stepId: node.id })
      } else {
        quickCreateField(node.id)
      }
      return
    }

    if (node.type === "estimatorNode") {
      const estimatorId = node.id.replace("estimator-", "")
      // Open the unified estimator panel. Silently ensure a binding exists —
      // the panel surfaces wiring + reduce sections only once we have one.
      const existing = bindings.find((b) => b.estimator_id === estimatorId)
      if (!existing) {
        createBinding({
          path: { flow_id: flowId },
          body: {
            estimator_id: estimatorId,
            inputs_mapping: {},
            map_over_step: null,
            outputs_reduce_strategy: {},
          },
        })
      }
      setPanelState({ mode: "estimator-details", estimatorId })
      return
    }

    if (node.type === "fieldNode") {
      const fieldId = node.id.replace("field-", "")
      const stepId = flow?.steps.find((s) => s.fields.some((f) => f.id === fieldId))?.id
      if (stepId) {
        setPanelState({ mode: "edit-field", fieldId, stepId })
      }
      return
    }

    if (node.type !== "stepNode") return
    // Toggle expand when the step is already selected in the panel; otherwise
    // select + expand. Keeps a second click on the same step as "collapse".
    const alreadySelected =
      panelState?.mode === "step-details" && panelState.stepId === node.id
    setExpandedStepIds((prev) => {
      const next = new Set(prev)
      if (alreadySelected && next.has(node.id)) {
        next.delete(node.id)
      } else {
        next.add(node.id)
      }
      return next
    })
    setPanelState({ mode: "step-details", stepId: node.id })
  }

  function handleNodeDoubleClick(_: React.MouseEvent, node: Node) {
    if (node.type === "stepNode") {
      setExpandedStepIds(new Set([node.id]))
      const step = flow?.steps.find((s) => s.id === node.id)
      const fieldIds = step?.fields.map((f) => ({ id: `field-${f.id}` })) ?? []
      requestAnimationFrame(() => {
        fitView({
          nodes: [{ id: node.id }, ...fieldIds],
          padding: 0.2,
          duration: 400,
        })
      })
      return
    }

    if (node.type === "fieldNode" || node.type === "estimatorNode") {
      const cx = node.position.x + (node.measured?.width ?? 200) / 2
      const cy = node.position.y + (node.measured?.height ?? 56) / 2
      setCenter(cx, cy, { zoom: getZoom(), duration: 400 })
    }
  }

  function handlePaneClick() {
    // Linking mode always takes priority — a blank-canvas click cancels it
    // rather than closing the edit panel.
    if (linkingField) {
      setLinkingField(false)
      return
    }
    if (panelState) setPanelState(null)
  }

  const { nodes, edges, stepPositions } = flow
    ? buildGraph(
      flow,
      estimators,
      rawEstimators,
      bindings,
      expandedStepIds,
      linkingField,
      dropIndicatorIndex,
      panelState?.mode === "estimator-details" ? `estimator-${panelState.estimatorId}`
        : panelState?.mode === "step-details" ? panelState.stepId
          : panelState?.mode === "edit-field" ? `field-${panelState.fieldId}`
            : null,
      deleteDialogs.handleDeleteStep,
      deleteDialogs.handleDeleteField,
      deleteDialogs.handleDeleteEstimator,
    )
    : { nodes: [], edges: [], stepPositions: new Map<string, number>() }

  stepPositionsRef.current = stepPositions

  return (
    <>
      <AlertDialog
        open={deleteDialogs.deletingStep !== null}
        onOpenChange={(open) => !open && deleteDialogs.setDeletingStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete step?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDialogs.deletingStep?.title}" and all its fields will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteDialogs.confirmDeleteStep}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogs.deletingField !== null}
        onOpenChange={(open) => !open && deleteDialogs.setDeletingField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDialogs.deletingField?.label}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteDialogs.confirmDeleteField}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteDialogs.deletingEstimator !== null}
        onOpenChange={(open) => !open && deleteDialogs.setDeletingEstimator(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete estimator?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteDialogs.deletingEstimator?.name}" and all its variables will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteDialogs.confirmDeleteEstimator}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Linking mode banner */}
      {linkingField && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-primary/90 text-primary-foreground py-2 text-sm font-medium gap-3">
          <span>Click a step to add a field to it</span>
          <button
            className="underline text-xs opacity-80 hover:opacity-100"
            onClick={() => setLinkingField(false)}
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          key={flowId}
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={handlePaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          fitView
          zoomOnDoubleClick={false}
          nodesConnectable={false}
          edgesReconnectable={false}
          edgesFocusable={false}
          elementsSelectable={true}
          nodesDraggable={false}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "var(--primary)" },
          }}
        >
          <Background />
          <Controls />
          <CanvasToolbar
            onClickStep={() => setPanelState({ mode: "add-step" })}
            onClickField={() => setLinkingField("form")}
          />
        </ReactFlow>
      </div>
    </>
  )
}

export const FlowCanvas = memo(FlowCanvasImpl)
