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
import { useCallback, useEffect, useState, useRef } from "react"
import { useParams } from "react-router"
import { StepNode, type StepNodeData } from "../ui/step-node"
import { FieldNode, type FieldNodeData } from "../ui/field-node"
import { EstimatorNode, type EstimatorNodeData } from "../ui/estimator-node"
import { CanvasToolbar, type DragNodeType } from "../ui/canvas-toolbar"
import { FlowEditPanel, type PanelState } from "../ui/flow-edit-sheet"
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
  useRemoveStep,
  useReorderStep,
  useAddField,
  useUpdateField,
  useRemoveField,
} from "@/api/flows.api"
import { useListEstimators, useCreateEstimator } from "@/api/estimators.api"
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
const ESTIMATOR_NODE_GAP = 24
const ROSE_COLOR = "hsl(330, 80%, 60%)"

const DRAG_DATA_KEY = "application/ferrisquote-node"

function buildGraph(
  flow: Schemas.FlowResponse,
  estimators: Schemas.EstimatorResponse[],
  expandedStepIds: Set<string>,
  linkingField: false | "form" | "quick",
  dropIndicatorIndex: number | null,
  onEditStep: (stepId: string) => void,
  onDeleteStep: (stepId: string) => void,
  onEditField: (fieldId: string, stepId: string) => void,
  onDeleteField: (fieldId: string, stepId: string) => void,
  onEditEstimator: (estimatorId: string) => void,
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
        },
      })
    }

    const stepNode: Node<StepNodeData> = {
      id: step.id,
      type: "stepNode",
      position: { x: 0, y: stepY },
      draggable: true,
      data: {
        index: i + 1,
        title: step.title,
        description: step.description,
        fields: step.fields,
        isExpanded,
        isRepeatable: step.is_repeatable,
        linkTarget: !!linkingField,
        onEdit: () => onEditStep(step.id),
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
      })
    }

    if (isExpanded && step.fields.length > 0) {
      const totalFieldsHeight =
        step.fields.length * (FIELD_NODE_HEIGHT + FIELD_NODE_GAP) - FIELD_NODE_GAP
      const hueStep = step.fields.length > 1 ? 200 / (step.fields.length - 1) : 0

      step.fields.forEach((field, j) => {
        const fieldNodeId = `field-${field.id}`
        const fieldY = stepY + j * (FIELD_NODE_HEIGHT + FIELD_NODE_GAP)
        const color = `hsl(${28 + j * hueStep}, 85%, 55%)`

        const fieldNode: Node<FieldNodeData> = {
          id: fieldNodeId,
          type: "fieldNode",
          position: { x: FIELD_X_OFFSET, y: fieldY },
          data: {
            label: field.label,
            type: field.config.type,
            color,
            onEdit: () => onEditField(field.id, step.id),
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
          style: { strokeWidth: 1.5, stroke: color },
        })
      })

      const extraSpace = Math.max(0, totalFieldsHeight - STEP_NODE_HEIGHT)
      yOffset += extraSpace + STEP_NODE_GAP
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
      },
    })
  }

  // ─── Estimator nodes (right column) ──────────────────────────────────────
  let estimatorY = 0

  for (const est of estimators) {
    const estimatorNodeId = `estimator-${est.id}`
    const varCount = est.variables.length
    const nodeHeight = 44 + Math.max(varCount, 1) * 22

    const estNode: Node<EstimatorNodeData> = {
      id: estimatorNodeId,
      type: "estimatorNode",
      position: { x: ESTIMATOR_X_OFFSET, y: estimatorY },
      data: {
        name: est.name,
        variables: est.variables,
        onEdit: () => onEditEstimator(est.id),
        onDelete: () => onDeleteEstimator(est.id),
      },
    }
    nodes.push(estNode)

    for (const v of est.variables) {
      const refs = extractExprRefs(v.expression)
      for (const ref of refs) {
        const info = fieldKeyMap.get(ref.key)
        if (!info) continue

        // If the step is expanded, connect from the field node; otherwise from the step node
        const sourceId = info.expanded ? info.fieldNodeId : info.stepId
        const sourceHandle = info.expanded ? "right" : "right"
        const isAgg = ref.aggregation !== false

        edges.push({
          id: `e-est-${est.id}-${v.id}-${ref.key}-${ref.aggregation || "direct"}`,
          source: sourceId,
          sourceHandle,
          target: estimatorNodeId,
          type: "smoothstep",
          animated: isAgg,
          style: {
            strokeWidth: isAgg ? 2 : 1.5,
            stroke: ROSE_COLOR,
            opacity: 0.7,
            strokeDasharray: isAgg ? "6 3" : undefined,
          },
          label: isAgg ? ref.aggregation : undefined,
          labelStyle: isAgg ? { fill: ROSE_COLOR, fontSize: 10, fontWeight: 600 } : undefined,
          labelBgStyle: isAgg ? { fill: "var(--background)", fillOpacity: 0.9 } : undefined,
          labelBgPadding: isAgg ? [4, 2] as [number, number] : undefined,
        })
      }
    }

    estimatorY += nodeHeight + ESTIMATOR_NODE_GAP
  }

  return { nodes, edges, stepPositions }
}

type FieldRef = { key: string; aggregation: false }
type AggregationRef = { key: string; aggregation: "SUM" | "AVG" | "COUNT_ITER" }
type ExprRef = FieldRef | AggregationRef

function extractExprRefs(expression: string): ExprRef[] {
  const refs: ExprRef[] = []
  const seen = new Set<string>()

  // Match aggregation functions: SUM(@key), AVG(@key), COUNT_ITER(@key)
  const aggRegex = /(SUM|AVG|COUNT_ITER)\(\s*@([a-z][a-z0-9_]*)\s*\)/g
  let match: RegExpExecArray | null
  while ((match = aggRegex.exec(expression)) !== null) {
    const tag = `${match[1]}:${match[2]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ key: match[2], aggregation: match[1] as AggregationRef["aggregation"] })
    }
  }

  // Match bare @key references (not inside an aggregation function)
  // Remove aggregation calls first to avoid double-matching
  const stripped = expression.replace(/(SUM|AVG|COUNT_ITER)\(\s*@[a-z][a-z0-9_]*\s*\)/g, "")
  const bareRegex = /@([a-z][a-z0-9_]*)/g
  while ((match = bareRegex.exec(stripped)) !== null) {
    const tag = `bare:${match[1]}`
    if (!seen.has(tag)) {
      seen.add(tag)
      refs.push({ key: match[1], aggregation: false })
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
  const { screenToFlowPosition, getNodes } = useReactFlow()

  const { data: flowData, error } = useGetFlow(flowId ?? "")
  const { data: estimatorsData } = useListEstimators(flowId ?? "")

  const flow = flowData?.data ?? null
  const is404 = !!error

  // Local estimator state (fake edits until backend is wired)
  const [localEstimators, setLocalEstimators] = useState<Schemas.EstimatorResponse[] | null>(null)
  const apiEstimators = estimatorsData?.data?.estimators ?? []
  const estimators = localEstimators ?? apiEstimators

  // Sync from API when data arrives
  useEffect(() => {
    if (apiEstimators.length > 0 && localEstimators === null) {
      setLocalEstimators(apiEstimators)
    }
  }, [apiEstimators, localEstimators])

  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const [panelState, setPanelState] = useState<PanelState | null>(null)
  const [deletingStep, setDeletingStep] = useState<Schemas.StepResponse | null>(null)
  // "form" = toolbar click → open add-field form; "quick" = drag miss → quick-create
  const [linkingField, setLinkingField] = useState<false | "form" | "quick">(false)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const stepPositionsRef = useRef<Map<string, number>>(new Map())

  // ─── Derive live step/field from query data ───────────────────────────────
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

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: addStep } = useAddStep(flowId ?? "")
  const { mutate: updateStep } = useUpdateStep(flowId ?? "")
  const { mutate: removeStep } = useRemoveStep(flowId ?? "")
  const { mutate: addField } = useAddField(flowId ?? "")
  const { mutate: updateField } = useUpdateField(flowId ?? "")
  const { mutate: removeField } = useRemoveField(flowId ?? "")
  const { mutate: createEstimator } = useCreateEstimator(flowId ?? "")
  const { mutate: reorderStep } = useReorderStep(flowId ?? "")

  // Collect all field keys for autocompletion
  const availableFieldKeys = flow?.steps.flatMap((s) => s.fields.map((f) => f.key)) ?? []

  // ─── Local estimator mutations (fake) ─────────────────────────────────────
  const handleUpdateEstimatorName = useCallback((estimatorId: string, name: string) => {
    setLocalEstimators((prev) =>
      (prev ?? []).map((e) => (e.id === estimatorId ? { ...e, name } : e)),
    )
  }, [])

  const handleAddVariable = useCallback((estimatorId: string) => {
    const id = crypto.randomUUID()
    const newVar: Schemas.VariableResponse = {
      id,
      name: "new_var",
      expression: "",
      description: "",
    }
    setLocalEstimators((prev) =>
      (prev ?? []).map((e) =>
        e.id === estimatorId ? { ...e, variables: [...e.variables, newVar] } : e,
      ),
    )
  }, [])

  const handleUpdateVariable = useCallback(
    (estimatorId: string, variableId: string, patch: Partial<Schemas.VariableResponse>) => {
      setLocalEstimators((prev) =>
        (prev ?? []).map((e) =>
          e.id === estimatorId
            ? {
                ...e,
                variables: e.variables.map((v) =>
                  v.id === variableId ? { ...v, ...patch } : v,
                ),
              }
            : e,
        ),
      )
    },
    [],
  )

  const handleDeleteVariable = useCallback((estimatorId: string, variableId: string) => {
    setLocalEstimators((prev) =>
      (prev ?? []).map((e) =>
        e.id === estimatorId
          ? { ...e, variables: e.variables.filter((v) => v.id !== variableId) }
          : e,
      ),
    )
  }, [])

  useEffect(() => {
    if (flowId && !is404) setLastFlowId(flowId)
    setExpandedStepIds(new Set())
    setPanelState(null)
    setDeletingStep(null)
    setDeletingField(null)
    setLinkingField(false)
    setLocalEstimators(null)
  }, [flowId, is404, setLastFlowId])

  // Cancel linking on Escape
  useEffect(() => {
    if (!linkingField) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLinkingField(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [linkingField])

  // ─── Panel callbacks ─────────────────────────────────────────────────────────
  const handleEditStep = useCallback((stepId: string) => {
    setPanelState({ mode: "step-details", stepId })
  }, [])

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const step = flow?.steps.find((s) => s.id === stepId) ?? null
      setDeletingStep(step)
    },
    [flow],
  )

  const handleOpenAddField = useCallback((stepId: string) => {
    setPanelState({ mode: "add-field", stepId })
  }, [])

  const handleOpenEditField = useCallback((fieldId: string, stepId: string) => {
    setPanelState({ mode: "edit-field", fieldId, stepId })
  }, [])

  const [deletingField, setDeletingField] = useState<{ id: string; label: string; stepId: string } | null>(null)

  const handleDeleteField = useCallback(
    (fieldId: string, stepId: string) => {
      // Find the field label for the confirmation dialog
      const step = flow?.steps.find((s) => s.id === stepId)
      const field = step?.fields.find((f) => f.id === fieldId)
      setDeletingField({ id: fieldId, label: field?.label ?? "this field", stepId })
    },
    [flow],
  )

  const confirmDeleteField = useCallback(() => {
    if (!deletingField) return
    removeField({ path: { field_id: deletingField.id } })
    // Close panel if it was showing the deleted field
    if (panelState?.mode === "edit-field" && panelState.fieldId === deletingField.id) {
      setPanelState({ mode: "step-details", stepId: deletingField.stepId })
    }
    setDeletingField(null)
  }, [deletingField, removeField, panelState])

  const handleEditEstimator = useCallback((estimatorId: string) => {
    setPanelState({ mode: "estimator-details", estimatorId })
  }, [])

  const handleDeleteEstimator = useCallback(
    (_estimatorId: string) => {
      // TODO: implement delete estimator confirmation dialog (issue #65)
    },
    [],
  )

  // ─── Sheet submit handlers ───────────────────────────────────────────────────
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
    data: { label: string; config: Schemas.FieldConfigDto },
  ) {
    updateField({
      path: { field_id: fieldId },
      body: { label: data.label, config: data.config },
    })
  }

  // ─── Quick-create helpers ─────────────────────────────────────────────────
  const fieldCounter = useRef(0)

  const quickCreateField = useCallback(
    (stepId: string) => {
      fieldCounter.current += 1
      const n = fieldCounter.current
      addField(
        {
          path: { step_id: stepId },
          body: {
            label: `New Field ${n}`,
            key: `new_field_${n}_${Date.now()}`,
            config: { type: "text", max_length: 255 },
          },
        },
        {
          onSuccess: (data) => {
            const fieldId = (data as { data?: { id?: string } })?.data?.id
            if (fieldId) {
              setExpandedStepIds(new Set([stepId]))
              setPanelState({ mode: "edit-field", fieldId, stepId })
            }
          },
        },
      )
    },
    [addField],
  )

  // ─── Drag and drop ──────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_DATA_KEY)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
    }
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData(DRAG_DATA_KEY) as DragNodeType | ""
      if (!type || !flowId) return
      e.preventDefault()

      if (type === "stepNode") {
        addStep(
          {
            path: { flow_id: flowId },
            body: { title: "New Step" },
          },
          {
            onSuccess: (data) => {
              const stepId = (data as { data?: { id?: string } })?.data?.id
              if (stepId) {
                setExpandedStepIds(new Set([stepId]))
                setPanelState({ mode: "step-details", stepId })
              }
            },
          },
        )
      } else if (type === "fieldNode") {
        const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
        const stepUnder = getNodes().find(
          (n) =>
            n.type === "stepNode" &&
            dropPos.x >= n.position.x &&
            dropPos.x <= n.position.x + (n.measured?.width ?? 200) &&
            dropPos.y >= n.position.y &&
            dropPos.y <= n.position.y + (n.measured?.height ?? STEP_NODE_HEIGHT),
        )
        if (stepUnder) {
          quickCreateField(stepUnder.id)
        } else {
          setLinkingField("quick")
        }
      } else if (type === "estimatorNode") {
        // Local fake create
        const newId = crypto.randomUUID()
        const newEst: Schemas.EstimatorResponse = {
          id: newId,
          flow_id: flowId,
          name: "New Estimator",
          variables: [],
        }
        setLocalEstimators((prev) => [...(prev ?? []), newEst])
        setPanelState({ mode: "estimator-details", estimatorId: newId })
      }
    },
    [flowId, screenToFlowPosition, getNodes, addStep, quickCreateField],
  )

  // ─── Node click ─────────────────────────────────────────────────────────────
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
      setPanelState((prev) =>
        prev?.mode === "estimator-details" && prev.estimatorId === estimatorId
          ? null
          : { mode: "estimator-details", estimatorId },
      )
      return
    }

    if (node.type !== "stepNode") return
    setExpandedStepIds((prev) => {
      if (prev.has(node.id)) return new Set()
      return new Set([node.id])
    })
    setPanelState((prev) =>
      prev && "stepId" in prev && prev.stepId === node.id
        ? null
        : { mode: "step-details", stepId: node.id },
    )
  }

  // ─── Step reorder via node drag ───────────────────────────────────────────
  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "stepNode" || !flow) return

      const dragY = node.position.y
      const steps = flow.steps
      const draggedIndex = steps.findIndex((s) => s.id === node.id)

      // Find insertion index based on drag Y vs step center positions
      let insertAt = steps.length
      for (let i = 0; i < steps.length; i++) {
        if (i === draggedIndex) continue
        const posY = stepPositionsRef.current.get(steps[i].id) ?? 0
        const centerY = posY + STEP_NODE_HEIGHT / 2
        if (dragY < centerY) {
          insertAt = i <= draggedIndex ? i : i
          break
        }
      }

      // Don't show indicator if it would result in no move
      if (insertAt === draggedIndex || insertAt === draggedIndex + 1) {
        setDropIndicatorIndex(null)
      } else {
        setDropIndicatorIndex(insertAt)
      }
    },
    [flow],
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "stepNode" || !flow || dropIndicatorIndex === null) {
        setDropIndicatorIndex(null)
        return
      }

      const steps = flow.steps
      const draggedIndex = steps.findIndex((s) => s.id === node.id)
      if (draggedIndex === -1) {
        setDropIndicatorIndex(null)
        return
      }

      // Compute after_id / before_id from the target insertion index
      // The insertion index refers to the position in the *original* array
      // after_id = step just before the target slot, before_id = step just after
      let afterId: string | null = null
      let beforeId: string | null = null

      if (dropIndicatorIndex === 0) {
        beforeId = steps[0].id === node.id ? (steps[1]?.id ?? null) : steps[0].id
      } else if (dropIndicatorIndex >= steps.length) {
        const last = steps[steps.length - 1]
        afterId = last.id === node.id ? (steps[steps.length - 2]?.id ?? null) : last.id
      } else {
        // Insert between [dropIndicatorIndex - 1] and [dropIndicatorIndex]
        const prevStep = steps[dropIndicatorIndex - 1]
        const nextStep = steps[dropIndicatorIndex]
        afterId = prevStep.id === node.id ? (steps[dropIndicatorIndex - 2]?.id ?? null) : prevStep.id
        beforeId = nextStep.id === node.id ? (steps[dropIndicatorIndex + 1]?.id ?? null) : nextStep.id
      }

      setDropIndicatorIndex(null)

      reorderStep({
        path: { step_id: node.id },
        body: { after_id: afterId, before_id: beforeId },
      })
    },
    [flow, dropIndicatorIndex, reorderStep],
  )

  function handlePaneClick() {
    if (linkingField) setLinkingField(false)
  }

  const { nodes, edges, stepPositions } = flow
    ? buildGraph(
        flow,
        estimators,
        expandedStepIds,
        linkingField,
        dropIndicatorIndex,
        handleEditStep,
        handleDeleteStep,
        handleOpenEditField,
        handleDeleteField,
        handleEditEstimator,
        handleDeleteEstimator,
      )
    : { nodes: [], edges: [], stepPositions: new Map<string, number>() }

  // Keep positions ref in sync for drag calculations
  stepPositionsRef.current = stepPositions

  return (
    <>
      <AlertDialog
        open={deletingStep !== null}
        onOpenChange={(open) => !open && setDeletingStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete step?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingStep?.title}" and all its fields will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deletingStep) return
                removeStep({ path: { step_id: deletingStep.id } })
                if (
                  panelState &&
                  "stepId" in panelState &&
                  panelState.stepId === deletingStep.id
                ) {
                  setPanelState(null)
                }
                setDeletingStep(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deletingField !== null}
        onOpenChange={(open) => !open && setDeletingField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete field?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingField?.label}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteField}
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
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onPaneClick={handlePaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              fitView
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
            availableFieldKeys={availableFieldKeys}
            onClose={() => setPanelState(null)}
            onAddStep={handleAddStep}
            onUpdateStep={(stepId, data) =>
              updateStep({ path: { step_id: stepId }, body: data })
            }
            onAddField={handleAddField}
            onEditField={handleEditField}
            onDeleteField={handleDeleteField}
            onOpenAddField={handleOpenAddField}
            onOpenEditField={handleOpenEditField}
            onUpdateEstimatorName={handleUpdateEstimatorName}
            onAddVariable={handleAddVariable}
            onUpdateVariable={handleUpdateVariable}
            onDeleteVariable={handleDeleteVariable}
          />
        </div>
      </div>
    </>
  )
}
