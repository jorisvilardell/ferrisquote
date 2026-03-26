import { useNavigate } from "react-router"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { FLOW_URL } from "@/routes/sub-router/flow.router"
import { useListFlows } from "@/api/flows.api"

type Props = {
  currentFlowId?: string
  currentFlowName?: string
}

export function FlowListDrawer({ currentFlowId, currentFlowName }: Props) {
  const navigate = useNavigate()
  const { data } = useListFlows()
  const flows = data?.data.flows ?? []

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" className="gap-1.5 text-xl font-semibold px-2">
          {currentFlowName ?? "Flow"}
          <ChevronRight className="size-4 text-muted-foreground" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Flows</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-1 overflow-y-auto p-4 pt-0">
          {flows.map((flow) => (
            <DrawerTrigger key={flow.id} asChild>
              <button
                onClick={() => navigate(FLOW_URL(flow.id))}
                className={`flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                  flow.id === currentFlowId ? "bg-accent font-medium" : ""
                }`}
              >
                <span className="text-sm">{flow.name}</span>
                {flow.description && (
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {flow.description}
                  </span>
                )}
              </button>
            </DrawerTrigger>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
