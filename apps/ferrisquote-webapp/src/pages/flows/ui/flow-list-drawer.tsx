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
import type { Flow } from "../feature/flow.types"

type Props = {
  flows: Flow[]
  currentFlowId?: string
  currentFlowName?: string
}

export function FlowListDrawer({ flows, currentFlowId, currentFlowName }: Props) {
  const navigate = useNavigate()

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" className="gap-1.5 text-xl font-semibold px-2">
          {currentFlowName ?? "Flow"}
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
                className={`flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent ${flow.id === currentFlowId ? "bg-accent font-medium" : ""
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
