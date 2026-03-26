import { ReactFlow, Background, Controls, type NodeTypes, type Node, type Edge } from "@xyflow/react"
import { useEffect, useState } from "react"
import { useParams } from "react-router"
import { StepNode, type StepNodeData } from "../ui/step-node"
import { FieldNode, type FieldNodeData } from "../ui/field-node"
import { CanvasToolbar } from "../ui/canvas-toolbar"
import type { Flow } from "./flow.types"
import type { Schemas } from "@/api/api.client"
import { useGetFlow } from "@/api/flows.api"
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

function mapApiFlow(apiFlow: Schemas.FlowResponse): Flow {
  return {
    id: apiFlow.id,
    name: apiFlow.name,
    description: apiFlow.description,
    steps: apiFlow.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      rank: step.rank,
      fields: step.fields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.config.type,
      })),
    })),
  }
}

function buildGraph(
  flow: Flow,
  expandedStepIds: Set<string>,
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
          data: { label: field.label, type: field.type, color },
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

  const flow: Flow | null = flowData?.data ? mapApiFlow(flowData.data) : null
  const is404 = !!error

  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (flowId && !is404) setLastFlowId(flowId)
    setExpandedStepIds(new Set())
  }, [flowId, is404, setLastFlowId])

  const { nodes, edges } = flow
    ? buildGraph(flow, expandedStepIds)
    : { nodes: [], edges: [] }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    if (node.type !== "stepNode") return
    setExpandedStepIds((prev) => {
      const next = new Set(prev)
      next.has(node.id) ? next.delete(node.id) : next.add(node.id)
      return next
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-6 py-4 border-b shrink-0">
        <FlowListDrawer currentFlowId={flowId} currentFlowName={flow?.name} />
      </div>
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
          <CanvasToolbar onAddStep={() => {}} onReorder={() => {}} />
        </ReactFlow>
      </div>
    </div>
  )
}
