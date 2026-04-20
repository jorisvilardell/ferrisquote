import { useCallback, useRef } from "react"
import type { Node, XYPosition } from "@xyflow/react"
import { toast } from "sonner"
import type { Schemas } from "@/api/api.client"
import type { DragNodeType } from "@/pages/flows/ui/canvas-toolbar"
import type { PanelState } from "@/pages/flows/ui/edit-panel/panel-state"
import type { LinkingMode } from "./use-linking-mode"

const DRAG_DATA_KEY = "application/ferrisquote-node"
const STEP_NODE_HEIGHT_FALLBACK = 90

type AddStepMutation = (
  params: { path: { flow_id: string }; body: { title: string } },
  options?: {
    onSuccess?: (data: unknown) => void
    onError?: (err: Error) => void
  },
) => void

type AddFieldMutation = (
  params: {
    path: { step_id: string }
    body: { label: string; key: string; config: Schemas.FieldConfigDto }
  },
  options?: {
    onSuccess?: (data: unknown) => void
    onError?: (err: Error) => void
  },
) => void

type CreateEstimatorMutation = (
  params: { path: { flow_id: string }; body: { name: string } },
  options?: {
    onSuccess?: (data: unknown) => void
    onError?: (err: Error) => void
  },
) => void

/**
 * Canvas-level drag-and-drop + quick-create flow. Exposes:
 * - `onDragOver` / `onDrop` handlers for the ReactFlow surface
 * - `quickCreateField(stepId)` for linking-mode click resolution
 *
 * New nodes are staged for focus via `setPendingFocusNodeId` and the
 * sidenav panel is opened via `setPanelState`.
 */
export function useCanvasDragDrop(args: {
  flowId: string
  estimators: Schemas.EstimatorResponse[]
  screenToFlowPosition: (p: XYPosition) => XYPosition
  getNodes: () => Node[]
  setPanelState: (s: PanelState | null) => void
  setExpandedStepIds: (ids: Set<string>) => void
  setLinkingField: (m: LinkingMode) => void
  setPendingFocusNodeId: (id: string | null) => void
  addStep: AddStepMutation
  addField: AddFieldMutation
  createEstimator: CreateEstimatorMutation
}) {
  const {
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
  } = args

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
              setPendingFocusNodeId(`field-${fieldId}`)
            }
          },
        },
      )
    },
    [addField, setExpandedStepIds, setPanelState, setPendingFocusNodeId],
  )

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
          { path: { flow_id: flowId }, body: { title: "New Step" } },
          {
            onSuccess: (data) => {
              const stepId = (data as { data?: { id?: string } })?.data?.id
              if (stepId) {
                setExpandedStepIds(new Set([stepId]))
                setPanelState({ mode: "step-details", stepId })
                setPendingFocusNodeId(stepId)
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
            dropPos.y <= n.position.y + (n.measured?.height ?? STEP_NODE_HEIGHT_FALLBACK),
        )
        if (stepUnder) {
          quickCreateField(stepUnder.id)
        } else {
          setLinkingField("quick")
        }
      } else if (type === "estimatorNode") {
        // Pick a default name that doesn't collide with existing estimators
        const existingNames = new Set(estimators.map((es) => es.name))
        let defaultName = "New_Estimator"
        if (existingNames.has(defaultName)) {
          let n = 2
          while (existingNames.has(`New_Estimator_${n}`)) n++
          defaultName = `New_Estimator_${n}`
        }
        createEstimator(
          { path: { flow_id: flowId }, body: { name: defaultName } },
          {
            onSuccess: (data) => {
              const estId = (data as { data?: { id?: string } })?.data?.id
              if (estId) {
                setPanelState({ mode: "estimator-details", estimatorId: estId })
                setPendingFocusNodeId(`estimator-${estId}`)
              }
            },
            onError: (err) => toast.error(`Failed to create estimator: ${err.message}`),
          },
        )
      }
    },
    [
      flowId,
      screenToFlowPosition,
      getNodes,
      addStep,
      createEstimator,
      estimators,
      quickCreateField,
      setExpandedStepIds,
      setPanelState,
      setPendingFocusNodeId,
      setLinkingField,
    ],
  )

  return { onDragOver, onDrop, quickCreateField }
}
