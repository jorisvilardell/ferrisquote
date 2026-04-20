import { useEffect, useState } from "react"
import type { Node } from "@xyflow/react"

/**
 * Newly-created nodes need the viewport to focus on them once they appear
 * in React Flow's state. We stage a `pendingFocusNodeId`; an effect polls
 * the current nodes on each render and, when the target shows up, centers
 * the viewport on it with the current zoom.
 *
 * `deps` must include anything that re-renders when the node set may have
 * changed (query data).
 */
export function usePendingFocus(
  getNodes: () => Node[],
  setCenter: (x: number, y: number, opts?: { zoom?: number; duration?: number }) => void,
  getZoom: () => number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deps: readonly unknown[] = [],
) {
  const [pendingFocusNodeId, setPendingFocusNodeId] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingFocusNodeId) return
    const node = getNodes().find((n) => n.id === pendingFocusNodeId)
    if (!node) return
    const cx = node.position.x + (node.measured?.width ?? 200) / 2
    const cy = node.position.y + (node.measured?.height ?? 80) / 2
    setCenter(cx, cy, { zoom: getZoom(), duration: 400 })
    setPendingFocusNodeId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocusNodeId, getNodes, setCenter, getZoom, ...deps])

  return { pendingFocusNodeId, setPendingFocusNodeId }
}
