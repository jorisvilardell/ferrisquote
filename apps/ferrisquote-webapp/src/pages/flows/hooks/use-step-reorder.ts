import { useCallback, useState, type MutableRefObject } from "react"
import type { Node } from "@xyflow/react"
import type { Schemas } from "@/api/api.client"

const STEP_NODE_HEIGHT = 90

type ReorderParams = {
  path: { step_id: string }
  body: { after_id: string | null; before_id: string | null }
}

/**
 * Drag-to-reorder for step nodes. Tracks a `dropIndicatorIndex` that the
 * graph builder uses to render an insertion marker, and on drag stop
 * computes before/after anchor ids and triggers the reorder mutation.
 */
export function useStepReorder(
  flow: Schemas.FlowResponse | null,
  stepPositionsRef: MutableRefObject<Map<string, number>>,
  reorderStep: (params: ReorderParams) => void,
) {
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)

  const onNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "stepNode" || !flow) return

      const dragY = node.position.y
      const steps = flow.steps
      const draggedIndex = steps.findIndex((s) => s.id === node.id)

      let insertAt = steps.length
      for (let i = 0; i < steps.length; i++) {
        if (i === draggedIndex) continue
        const posY = stepPositionsRef.current.get(steps[i].id) ?? 0
        const centerY = posY + STEP_NODE_HEIGHT / 2
        if (dragY < centerY) {
          insertAt = i
          break
        }
      }

      if (insertAt === draggedIndex || insertAt === draggedIndex + 1) {
        setDropIndicatorIndex(null)
      } else {
        setDropIndicatorIndex(insertAt)
      }
    },
    [flow, stepPositionsRef],
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

      let afterId: string | null = null
      let beforeId: string | null = null

      if (dropIndicatorIndex === 0) {
        beforeId = steps[0].id === node.id ? (steps[1]?.id ?? null) : steps[0].id
      } else if (dropIndicatorIndex >= steps.length) {
        const last = steps[steps.length - 1]
        afterId = last.id === node.id ? (steps[steps.length - 2]?.id ?? null) : last.id
      } else {
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

  return { dropIndicatorIndex, setDropIndicatorIndex, onNodeDrag, onNodeDragStop }
}
