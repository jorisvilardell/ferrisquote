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
  onEditStep: (stepId: string) => void,
  onDeleteStep: (stepId: string) => void,
  onEditField: (fieldId: string, stepId: string) => void,
  onDeleteField: (fieldId: string, stepId: string) => void,
  onEditEstimator: (estimatorId: string) => void,
  onDeleteEstimator: (estimatorId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let yOffset = 0

  const fieldKeyToNodeId = new Map<string, string>()

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]
    const isExpanded = expandedStepIds.has(step.id)
    const stepY = i * (STEP_NODE_HEIGHT + STEP_NODE_GAP) + yOffset

    for (const field of step.fields) {
      fieldKeyToNodeId.set(field.key, `field-${field.id}`)
    }

    const stepNode: Node<StepNodeData> = {
      id: step.id,
      type: "stepNode",
      position: { x: 0, y: stepY },
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
      const refs = extractFieldRefs(v.expression)
      for (const ref of refs) {
        const sourceNodeId = fieldKeyToNodeId.get(ref)
        if (sourceNodeId) {
          edges.push({
            id: `e-est-${est.id}-${v.id}-${ref}`,
            source: sourceNodeId,
            target: estimatorNodeId,
            type: "smoothstep",
            animated: false,
            style: { strokeWidth: 1.5, stroke: ROSE_COLOR, opacity: 0.6 },
          })
        }
      }
    }

    estimatorY += nodeHeight + ESTIMATOR_NODE_GAP
  }

  return { nodes, edges }
}

function extractFieldRefs(expression: string): string[] {
  const refs: string[] = []
  const regex = /@([a-z][a-z0-9_]*)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(expression)) !== null) {
    refs.push(match[1])
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
  const estimators = estimatorsData?.data?.estimators ?? []
  const is404 = !!error

  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const [panelState, setPanelState] = useState<PanelState | null>(null)
  const [deletingStep, setDeletingStep] = useState<Schemas.StepResponse | null>(null)
  // "form" = toolbar click → open add-field form; "quick" = drag miss → quick-create
  const [linkingField, setLinkingField] = useState<false | "form" | "quick">(false)

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

  useEffect(() => {
    if (flowId && !is404) setLastFlowId(flowId)
    setExpandedStepIds(new Set())
    setPanelState(null)
    setDeletingStep(null)
    setDeletingField(null)
    setLinkingField(false)
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
        createEstimator(
          {
            path: { flow_id: flowId },
            body: { name: "New Estimator" },
          },
          {
            onSuccess: (data) => {
              const estId = (data as { data?: { id?: string } })?.data?.id
              if (estId) {
                setPanelState({ mode: "estimator-details", estimatorId: estId })
              }
            },
          },
        )
      }
    },
    [flowId, screenToFlowPosition, getNodes, addStep, createEstimator, quickCreateField],
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

  function handlePaneClick() {
    if (linkingField) setLinkingField(false)
  }

  const { nodes, edges } = flow
    ? buildGraph(
        flow,
        estimators,
        expandedStepIds,
        linkingField,
        handleEditStep,
        handleDeleteStep,
        handleOpenEditField,
        handleDeleteField,
        handleEditEstimator,
        handleDeleteEstimator,
      )
    : { nodes: [], edges: [] }

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
              onPaneClick={handlePaneClick}
              onDragOver={onDragOver}
              onDrop={onDrop}
              fitView
              nodesConnectable={false}
              edgesReconnectable={false}
              edgesFocusable={false}
              elementsSelectable={true}
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
          />
        </div>
      </div>
    </>
  )
}
