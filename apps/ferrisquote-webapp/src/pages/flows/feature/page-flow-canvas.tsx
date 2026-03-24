import { ReactFlow, Background, Controls } from "@xyflow/react"
import { useParams } from "react-router"
import "@xyflow/react/dist/style.css"

export function PageFlowCanvas() {
  const { flowId } = useParams<{ flowId: string }>()

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="px-6 py-4 border-b shrink-0">
        <h1 className="text-xl font-semibold">{flowId ?? "Flow"}</h1>
      </div>
      <div className="flex-1">
        <ReactFlow nodes={[]} edges={[]} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
