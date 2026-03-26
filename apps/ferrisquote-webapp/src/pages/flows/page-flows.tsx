import { Navigate, Route, Routes } from "react-router"
import { PageFlowCanvas } from "./feature/page-flow-canvas"
import { useFlowStore } from "@/store/flow.store"
import { useListFlows } from "@/api/flows.api"
import { FLOW_URL } from "@/routes/sub-router/flow.router"

export function PageFlows() {
  const lastFlowId = useFlowStore((s) => s.lastFlowId)
  const { data } = useListFlows()

  const defaultFlowId = lastFlowId ?? data?.data.flows[0]?.id ?? null

  return (
    <Routes>
      <Route
        index
        element={defaultFlowId ? <Navigate to={FLOW_URL(defaultFlowId)} replace /> : null}
      />
      <Route path=":flowId" element={<PageFlowCanvas />} />
    </Routes>
  )
}
