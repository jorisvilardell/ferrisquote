import { ReactFlowProvider } from "@xyflow/react"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"
import { useGetFlow } from "@/api/flows.api"
import { useFlowStore } from "@/store/flow.store"
import { FlowListDrawer } from "../ui/flow-list-drawer"
import { FlowCanvas } from "./flow-canvas"
import { FlowEditPanel, type PanelState } from "./flow-edit-panel"
import "@xyflow/react/dist/style.css"

export function PageFlowCanvas() {
  return (
    <ReactFlowProvider>
      <PageFlowCanvasInner />
    </ReactFlowProvider>
  )
}

/**
 * Thin parent: owns only the sidenav panel state. Canvas and edit panel
 * each subscribe to their own queries in separate subtrees, so cache
 * invalidations (e.g. variable expression edit) only rerender the subtree
 * that actually consumes the changed data.
 */
function PageFlowCanvasInner() {
  const { flowId } = useParams<{ flowId: string }>()
  const setLastFlowId = useFlowStore((s) => s.setLastFlowId)

  // Lightweight header-only query — just for the drawer label. Does not
  // trickle down to canvas or panel rerenders.
  const { data: flowData, error } = useGetFlow(flowId ?? "")
  const flowName = flowData?.data?.name
  const is404 = !!error

  const [panelState, setPanelState] = useState<PanelState | null>(null)

  // Reset panel when the flow changes
  useEffect(() => {
    if (flowId && !is404) setLastFlowId(flowId)
    setPanelState(null)
  }, [flowId, is404, setLastFlowId])

  // Stable setter: same reference across renders → memoized children don't
  // invalidate on parent rerenders.
  const stableSetPanelState = useCallback((s: PanelState | null) => {
    setPanelState(s)
  }, [])

  const closePanel = useCallback(() => setPanelState(null), [])

  if (!flowId) return null

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b shrink-0">
        <FlowListDrawer currentFlowId={flowId} currentFlowName={flowName} />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <FlowCanvas
          flowId={flowId}
          panelState={panelState}
          setPanelState={stableSetPanelState}
        />
        <FlowEditPanel
          flowId={flowId}
          state={panelState}
          onClose={closePanel}
          setPanelState={stableSetPanelState}
        />
      </div>
    </div>
  )
}
