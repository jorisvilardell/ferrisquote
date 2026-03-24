import { Navigate, Route, Routes } from "react-router"
import { PageFlowCanvas } from "./feature/page-flow-canvas"
import { useFlowStore } from "@/store/flow.store"
import { mockFlowResponse } from "./feature/flow.mock"
import { FLOW_URL } from "@/routes/sub-router/flow.router"

const DEFAULT_FLOW_ID = mockFlowResponse.data.id

export function PageFlows() {
  const lastFlowId = useFlowStore((s) => s.lastFlowId)

  return (
    <Routes>
      <Route index element={<Navigate to={FLOW_URL(lastFlowId ?? DEFAULT_FLOW_ID)} replace />} />
      <Route path=":flowId" element={<PageFlowCanvas />} />
    </Routes>
  )
}
