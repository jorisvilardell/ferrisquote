import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  type NodeTypes,
  type Node,
  type Edge,
} from "@xyflow/react"
import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router"
import { StepNode, type StepNodeData } from "../ui/step-node"
import { FieldNode, type FieldNodeData } from "../ui/field-node"
import { EstimatorNode, type EstimatorNodeData } from "../ui/estimator-node"
import { CanvasToolbar } from "../ui/canvas-toolbar"
import { FlowEditPanel, type PanelState } from "./flow-edit-panel"
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
  useGetFlow,
  useAddStep,
  useUpdateStep,
  useReorderStep,
  useAddField,
  useUpdateField,
  useRemoveField,
  useRemoveStep,
} from "@/api/flows.api"
import { useEstimators, useCreateEstimator, useDeleteEstimator } from "@/api/estimators.api"
import { idsToNames } from "@/pages/flows/lib/expression-refs"
import { useCanvasDragDrop } from "@/pages/flows/hooks/use-canvas-drag-drop"
import { useDeleteDialogs } from "@/pages/flows/hooks/use-delete-dialogs"
import { useLinkingMode } from "@/pages/flows/hooks/use-linking-mode"
import { usePendingFocus } from "@/pages/flows/hooks/use-pending-focus"
import { useStepReorder } from "@/pages/flows/hooks/use-step-reorder"
import { useFlowStore } from "@/store/flow.store"
import { FlowListDrawer } from "../ui/flow-list-drawer"
import "@xyflow/react/dist/style.css"

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
const ESTIMATOR_X_STEP = 320 // horizontal spacing between estimator columns by depth
const ESTIMATOR_NODE_GAP = 24

function buildGraph(
  flow: Schemas.FlowResponse,
  estimators: Schemas.EstimatorResponse[],
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

  // field key → { fieldNodeId, stepId, expanded }
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

    // Drop indicator before this step
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
        isExpanded,
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
        const fieldY = isExpanded ? targetY : stepY
        const xOffset = isExpanded ? FIELD_X_OFFSET : 0
        const opacity = isExpanded ? 1 : 0
        const pointerEvents = isExpanded ? "all" : "none"
        const color = `hsl(${28 + j * hueStep}, 85%, 55%)`

        const fieldNode: Node<FieldNodeData> = {
          id: fieldNodeId,
          type: "fieldNode",
          position: { x: xOffset, y: fieldY },
          selected: selectedNodeId === fieldNodeId,
          style: {
            opacity,
            pointerEvents: pointerEvents as "all" | "none",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          },
          data: {
            label: field.label,
            type: field.config.type,
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
            transition: isExpanded
              ? "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.5s"
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

  // Drop indicator after the last step
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
  // Color range: rose-violet (hsl 330, 70%, 55%) → rose clair (hsl 340, 80%, 72%)
  const CROSS_COLOR = "hsl(320, 60%, 55%)"
  const estIdToNodeId = new Map<string, string>()
  const estIdToColor = new Map<string, string>()

  // Compute cross-estimator dependency depth so dependent estimators can be
  // placed in a column further right, avoiding edges hidden behind nodes.
  const estCrossDeps = new Map<string, Set<string>>()
  for (const est of estimators) {
    const deps = new Set<string>()
    for (const v of est.variables) {
      for (const ref of extractExprRefs(v.expression)) {
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
    if (visiting.has(estId)) return 0 // cycle fallback
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

  // Group estimators by depth, preserving input order within each depth
  const estByDepth = new Map<number, Schemas.EstimatorResponse[]>()
  for (const est of estimators) {
    const d = computeDepth(est.id, new Set())
    if (!estByDepth.has(d)) estByDepth.set(d, [])
    estByDepth.get(d)!.push(est)
  }

  // First pass: create nodes and register id→nodeId
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

  // Build an estimator index for translating @#<uuid>.var → @Name.var in displayed expressions
  const estimatorsIndex = estimators.map((e) => ({ id: e.id, name: e.name }))

  // Position estimators: one column per depth, stacked vertically within a column
  for (const [d, estsAtDepth] of estByDepth) {
    const x = ESTIMATOR_X_OFFSET + d * ESTIMATOR_X_STEP
    let y = 0
    for (const est of estsAtDepth) {
      const varCount = est.variables.length
      const nodeHeight = 54 + Math.max(varCount, 1) * 24
      const estimatorNodeId = `estimator-${est.id}`
      const color = estIdToColor.get(est.id) ?? "hsl(335, 70%, 55%)"

      // Transform each variable's expression from storage form (@#<uuid>.var) to display form (@Name.var)
      const displayVariables = est.variables.map((v) => ({
        ...v,
        expression: idsToNames(v.expression, estimatorsIndex),
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
          variables: displayVariables,
          color,
          onDelete: () => onDeleteEstimator(est.id),
        },
      }
      nodes.push(estNode)
      y += nodeHeight + ESTIMATOR_NODE_GAP
    }
  }

  // Lookup: estimator id → { variable name → variable id }
  const estVariableNameToId = new Map<string, Map<string, string>>()
  for (const est of estimators) {
    const m = new Map<string, string>()
    for (const v of est.variables) m.set(v.name, v.id)
    estVariableNameToId.set(est.id, m)
  }

  // Second pass: create edges
  for (const est of estimators) {
    const estimatorNodeId = `estimator-${est.id}`
    const estColor = estIdToColor.get(est.id) ?? "hsl(330, 75%, 58%)"

    for (const v of est.variables) {
      const refs = extractExprRefs(v.expression)
      for (const ref of refs) {
        if (ref.type === "cross") {
          const sourceNodeId = estIdToNodeId.get(ref.estimatorId)
          if (sourceNodeId && sourceNodeId !== estimatorNodeId) {
            // Resolve the source variable id inside the source estimator
            const sourceVarId = estVariableNameToId
              .get(ref.estimatorId)
              ?.get(ref.variableName)
            const sourceHandle = sourceVarId ? `source-${sourceVarId}` : "default-source"
            edges.push({
              id: `e-cross-${est.id}-${v.id}-${ref.estimatorId}.${ref.variableName}`,
              source: sourceNodeId,
              sourceHandle,
              target: estimatorNodeId,
              targetHandle: `target-${v.id}`,
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
            id: `e-est-${est.id}-${v.id}-${ref.key}-${ref.aggregation || "direct"}`,
            source: sourceId,
            sourceHandle: "right",
            target: estimatorNodeId,
            targetHandle: `target-${v.id}`,
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
            labelBgPadding: isAgg ? [4, 2] as [number, number] : undefined,
          })
        }
      }
    }
  }

  return { nodes, edges, stepPositions }
}

type FieldRef = { type: "field"; key: string; aggregation: false }
type AggregationRef = { type: "field"; key: string; aggregation: "SUM" | "AVG" | "COUNT_ITER" }
type CrossRef = { type: "cross"; estimatorId: string; variableName: string }
type ExprRef = FieldRef | AggregationRef | CrossRef

function extractExprRefs(expression: string): ExprRef[] {
  const refs: ExprRef[] = []
  const seen = new Set<string>()

  // Match ID-based cross-estimator references: @#<uuid>.var_name
  const crossRegex = /@#([A-Za-z0-9-]+)\.([a-z][a-z0-9_]*)/g
  let match: RegExpExecArray | null
  while ((match = crossRegex.exec(expression)) !== null) {
    const tag = `cross:${match[1]}.${match[2]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ type: "cross", estimatorId: match[1], variableName: match[2] })
    }
  }

  // Remove cross-refs before scanning for other patterns
  const noCross = expression.replace(/@#[A-Za-z0-9-]+\.[a-z][a-z0-9_]*/g, "")

  // Match aggregation functions: SUM(@key), AVG(@key), COUNT_ITER(@key)
  const aggRegex = /(SUM|AVG|COUNT_ITER)\(\s*@([a-z][a-z0-9_]*)\s*\)/g
  while ((match = aggRegex.exec(noCross)) !== null) {
    const tag = `agg:${match[1]}:${match[2]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ type: "field", key: match[2], aggregation: match[1] as AggregationRef["aggregation"] })
    }
  }

  // Match bare @key references
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

export function PageFlowCanvas() {
  return (
    <ReactFlowProvider>
      <PageFlowCanvasInner />
    </ReactFlowProvider>
  )
}

function PageFlowCanvasInner() {
  const { flowId } = useParams<{ flowId: string }>()
  const setLastFlowId = useFlowStore((s) => s.setLastFlowId)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { getNodes, fitView, setCenter, getZoom, screenToFlowPosition } = useReactFlow()

  const { data: flowData, error } = useGetFlow(flowId ?? "")
  const { data: estimatorsData } = useEstimators(flowId ?? "")

  const flow = flowData?.data ?? null
  const estimators = estimatorsData?.data?.estimators ?? []
  const is404 = !!error

  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const [panelState, setPanelState] = useState<PanelState | null>(null)
  const stepPositionsRef = useRef<Map<string, number>>(new Map())

  // ─── Derive live step/field/estimator from query data ─────────────────────
  const panelStep =
    panelState && "stepId" in panelState
      ? flow?.steps.find((s) => s.id === panelState.stepId) ?? null
      : null

  const panelField =
    panelState?.mode === "edit-field"
      ? panelStep?.fields.find((f) => f.id === panelState.fieldId) ?? null
      : null

  const panelEstimator =
    panelState?.mode === "estimator-details"
      ? estimators.find((e) => e.id === panelState.estimatorId) ?? null
      : null

  // ─── Mutations ────────────────────────────────────────────────────────────
  const { mutate: addStep } = useAddStep(flowId ?? "")
  const { mutate: updateStep } = useUpdateStep(flowId ?? "")
  const { mutate: removeStep } = useRemoveStep(flowId ?? "")
  const { mutate: addField } = useAddField(flowId ?? "")
  const { mutate: updateField } = useUpdateField(flowId ?? "")
  const { mutate: removeField } = useRemoveField(flowId ?? "")
  const { mutate: createEstimator } = useCreateEstimator(flowId ?? "")
  const { mutate: deleteEstimator } = useDeleteEstimator(flowId ?? "")
  const { mutate: reorderStep } = useReorderStep(flowId ?? "")

  // Collect all field keys for autocompletion
  const availableFieldKeys = flow?.steps.flatMap((s) => s.fields.map((f) => f.key)) ?? []

  // ─── Feature hooks ────────────────────────────────────────────────────────
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
    flowId: flowId ?? "",
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
  })
  const { dropIndicatorIndex, onNodeDrag, onNodeDragStop } = useStepReorder(
    flow,
    stepPositionsRef,
    reorderStep,
  )

  // ─── Flow switch reset ────────────────────────────────────────────────────
  useEffect(() => {
    if (flowId && !is404) setLastFlowId(flowId)
    setExpandedStepIds(new Set())
    setPanelState(null)
    deleteDialogs.reset()
    setLinkingField(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId, is404, setLastFlowId])

  // ─── Sidenav open/close helpers ───────────────────────────────────────────
  const handleOpenAddField = (stepId: string) =>
    setPanelState({ mode: "add-field", stepId })
  const handleOpenEditField = (fieldId: string, stepId: string) =>
    setPanelState({ mode: "edit-field", fieldId, stepId })

  // ─── Sheet submit handlers ────────────────────────────────────────────────
  function handleAddStep(data: { title: string; description: string }) {
    addStep({
      path: { flow_id: flowId ?? "" },
      body: { title: data.title, description: data.description || null },
    })
  }

  function handleAddField(
    stepId: string,
    data: { label: string; key: string; config: Schemas.FieldConfigDto },
  ) {
    addField({
      path: { step_id: stepId },
      body: { label: data.label, key: data.key, config: data.config },
    })
  }

  function handleEditField(
    fieldId: string,
    _stepId: string,
    data: {
      label?: string
      key?: string
      description?: string | null
      config?: Schemas.FieldConfigDto
    },
  ) {
    updateField({
      path: { field_id: fieldId },
      body: {
        label: data.label,
        key: data.key,
        description: data.description,
        config: data.config,
      },
    })
  }

  // ─── Node click handlers ──────────────────────────────────────────────────
  function handleNodeClick(_: React.MouseEvent, node: Node) {
    // If in field-linking mode, clicking a step resolves it
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
    // Single click: select + expand (keep others open, no toggle-close)
    setExpandedStepIds((prev) => {
      const next = new Set(prev)
      next.add(node.id)
      return next
    })
    setPanelState({ mode: "step-details", stepId: node.id })
  }

  function handleNodeDoubleClick(_: React.MouseEvent, node: Node) {
    if (node.type === "stepNode") {
      // Exclusive expand: collapse all others, keep only this one expanded
      setExpandedStepIds(new Set([node.id]))

      const step = flow?.steps.find((s) => s.id === node.id)
      const fieldIds = step?.fields.map((f) => ({ id: `field-${f.id}` })) ?? []
      // Wait a frame so the newly-rendered field nodes are registered
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
    if (linkingField) setLinkingField(false)
  }

  // ─── Graph build ──────────────────────────────────────────────────────────
  const { nodes, edges, stepPositions } = flow
    ? buildGraph(
      flow,
      estimators,
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

  // Keep positions ref in sync for drag calculations
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

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 border-b shrink-0">
          <FlowListDrawer currentFlowId={flowId} currentFlowName={flow?.name} />
        </div>
        <div className="flex flex-1 overflow-hidden">
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

          <FlowEditPanel
            state={panelState}
            step={panelStep}
            field={panelField}
            estimator={panelEstimator}
            flowId={flowId ?? ""}
            availableFieldKeys={availableFieldKeys}
            otherEstimators={estimators
              .filter((e) => e.id !== panelEstimator?.id)
              .map((e) => ({ id: e.id, name: e.name, variables: e.variables.map((v) => v.name) }))
            }
            estimatorsIndex={estimators.map((e) => ({ id: e.id, name: e.name }))}
            onClose={() => setPanelState(null)}
            onAddStep={handleAddStep}
            onUpdateStep={(stepId, data) =>
              updateStep({ path: { step_id: stepId }, body: data })
            }
            onAddField={handleAddField}
            onEditField={handleEditField}
            onDeleteField={deleteDialogs.handleDeleteField}
            onOpenAddField={handleOpenAddField}
            onOpenEditField={handleOpenEditField}
          />
        </div>
      </div>
    </>
  )
}
