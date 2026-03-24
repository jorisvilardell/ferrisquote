import { ReactFlow, Background, Controls, type NodeTypes, type Node, type Edge } from "@xyflow/react"
import { useEffect } from "react"
import { useParams } from "react-router"
import "@xyflow/react/dist/style.css"
import { StepNode, type StepNodeData } from "../ui/step-node"
import { mockFlowResponse } from "./flow.mock"
import type { FlowStep } from "./flow.types"
import { useFlowStore } from "@/store/flow.store"

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
}

const NODE_HEIGHT = 90
const NODE_GAP = 60

function stepsToNodes(steps: FlowStep[]): Node<StepNodeData>[] {
  return steps.map((step, i) => ({
    id: step.id,
    type: "stepNode",
    position: { x: 0, y: i * (NODE_HEIGHT + NODE_GAP) },
    data: {
      index: i + 1,
      title: step.title,
      description: step.description,
      fields: step.fields,
    },
  }))
}

function stepsToEdges(steps: FlowStep[]): Edge[] {
  return steps.slice(0, -1).map((step, i) => ({
    id: `e-${step.id}-${steps[i + 1].id}`,
    source: step.id,
    target: steps[i + 1].id,
    type: "smoothstep",
    animated: true,
  }))
}

export function PageFlowCanvas() {
  const { flowId } = useParams<{ flowId: string }>()
  const setLastFlowId = useFlowStore((s) => s.setLastFlowId)
  const flow = mockFlowResponse.data
  const nodes = stepsToNodes(flow.steps)
  const edges = stepsToEdges(flow.steps)

  useEffect(() => {
    if (flowId) setLastFlowId(flowId)
  }, [flowId, setLastFlowId])

  return (
    <div className="flex flex-col h-full -m-6">
      <div className="px-6 py-4 border-b shrink-0">
        <h1 className="text-xl font-semibold">{flow.name ?? flowId ?? "Flow"}</h1>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodeTypes={nodeTypes}
          nodes={nodes}
          edges={edges}
          fitView
          nodesConnectable={false}
          edgesReconnectable={false}
          edgesFocusable={false}
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "var(--primary)" },
          }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
