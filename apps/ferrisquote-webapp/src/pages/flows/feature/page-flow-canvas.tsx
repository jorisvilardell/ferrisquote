import { ReactFlow, Background, Controls, type NodeTypes, type Node, type Edge } from "@xyflow/react"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import { StepNode, type StepNodeData } from "../ui/step-node"
import { FieldNode, type FieldNodeData } from "../ui/field-node"
import { CanvasToolbar } from "../ui/canvas-toolbar"
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
  useRemoveStep,
  useAddField,
  useUpdateField,
  useRemoveField,
} from "@/api/flows.api"
import { useFlowStore } from "@/store/flow.store"
import { FlowListDrawer } from "../ui/flow-list-drawer"
import "@xyflow/react/dist/style.css"

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
  fieldNode: FieldNode,
}

const STEP_NODE_HEIGHT = 90
const STEP_NODE_GAP = 60
const FIELD_NODE_HEIGHT = 56
const FIELD_NODE_GAP = 16
const FIELD_X_OFFSET = 280

function buildGraph(
  flow: Schemas.FlowResponse,
  expandedStepIds: Set<string>,
  onEditStep: (stepId: string) => void,
  onDeleteStep: (stepId: string) => void,
  onEditField: (fieldId: string, stepId: string) => void,
  onDeleteField: (fieldId: string, stepId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let yOffset = 0

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]
    const isExpanded = expandedStepIds.has(step.id)
    const stepY = i * (STEP_NODE_HEIGHT + STEP_NODE_GAP) + yOffset

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

  return { nodes, edges }
}

export function PageFlowCanvas() {
  const { flowId } = useParams<{ flowId: string }>()
  const setLastFlowId = useFlowStore((s) => s.setLastFlowId)

  const { data: flowData, error } = useGetFlow(flowId ?? "")

  const flow = flowData?.data ?? null
  const is404 = !!error

  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())
  const [panelState, setPanelState] = useState<PanelState | null>(null)
  const [deletingStep, setDeletingStep] = useState<Schemas.StepResponse | null>(null)

  // ─── Derive live step/field from query data ───────────────────────────────
  const panelStep =
    panelState && "stepId" in panelState
      ? flow?.steps.find((s) => s.id === panelState.stepId) ?? null
      : null

  const panelField =
    panelState?.mode === "edit-field"
      ? panelStep?.fields.find((f) => f.id === panelState.fieldId) ?? null
      : null

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const { mutate: addStep } = useAddStep(flowId ?? "")
  const { mutate: removeStep } = useRemoveStep(flowId ?? "")
  const { mutate: addField } = useAddField(flowId ?? "")
  const { mutate: updateField } = useUpdateField(flowId ?? "")
  const { mutate: removeField } = useRemoveField(flowId ?? "")

  useEffect(() => {
    if (flowId && !is404) setLastFlowId(flowId)
    setExpandedStepIds(new Set())
    setPanelState(null)
    setDeletingStep(null)
  }, [flowId, is404, setLastFlowId])

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

  const handleDeleteField = useCallback(
    (fieldId: string, _stepId: string) => {
      removeField({ path: { field_id: fieldId } })
    },
    [removeField],
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

  // ─── Single click → toggle expand (exclusive) + open/close step panel ────────
  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (node.type !== "stepNode") return
    setExpandedStepIds((prev) => {
      if (prev.has(node.id)) return new Set()
      return new Set([node.id])
    })
    setPanelState((prev) =>
      prev && "stepId" in prev && prev.stepId === node.id ? null : { mode: "step-details", stepId: node.id },
    )
  }

  const { nodes, edges } = flow
    ? buildGraph(flow, expandedStepIds, handleEditStep, handleDeleteStep, handleOpenEditField, handleDeleteField)
    : { nodes: [], edges: [] }

  return (
    <>
    <AlertDialog open={deletingStep !== null} onOpenChange={(open) => !open && setDeletingStep(null)}>
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
              if (panelState && "stepId" in panelState && panelState.stepId === deletingStep.id) {
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
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b shrink-0">
        <FlowListDrawer currentFlowId={flowId} currentFlowName={flow?.name} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
        <ReactFlow
          key={flowId}
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          fitView
          nodesConnectable={false}
          edgesReconnectable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "var(--primary)" },
          }}
        >
          <Background />
          <Controls />
          <CanvasToolbar
            onAddStep={() => setPanelState({ mode: "add-step" })}
            onReorder={() => {}}
          />
        </ReactFlow>
        </div>

        <FlowEditPanel
        state={panelState}
        step={panelStep}
        field={panelField}
        onClose={() => setPanelState(null)}
        onAddStep={handleAddStep}
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
