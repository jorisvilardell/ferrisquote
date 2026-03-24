import { QUOTES_URL } from "@/routes/router"

export const FLOWS_URL = () => `${QUOTES_URL()}/flows`
export const FLOW_URL = (flowId = ":flowId") => `${FLOWS_URL()}/${flowId}`

export type FlowRouterParams = {
  flowId: string
}
