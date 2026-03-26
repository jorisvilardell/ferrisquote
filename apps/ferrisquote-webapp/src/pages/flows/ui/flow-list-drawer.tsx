import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FLOW_URL, FLOWS_URL } from "@/routes/sub-router/flow.router"
import { useListFlows, useCreateFlow, useUpdateFlow, useDeleteFlow } from "@/api/flows.api"
import type { Schemas } from "@/api/api.client"

type Props = {
  currentFlowId?: string
  currentFlowName?: string
}

export function FlowListDrawer({ currentFlowId, currentFlowName }: Props) {
  const navigate = useNavigate()
  const { data } = useListFlows()
  const flows = data?.data.flows ?? []

  const [addingFlow, setAddingFlow] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Schemas.FlowSummaryResponse | null>(null)
  const [deletingFlow, setDeletingFlow] = useState<Schemas.FlowSummaryResponse | null>(null)

  return (
    <>
      <Drawer direction="right">
        <DrawerTrigger asChild>
          <Button variant="ghost" className="gap-1.5 text-xl font-semibold px-2">
            {currentFlowName ?? "Flow"}
            <ChevronRight className="size-4 text-muted-foreground" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <DrawerTitle>Flows</DrawerTitle>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => setAddingFlow(true)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {flows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <Button variant="outline" className="gap-2" onClick={() => setAddingFlow(true)}>
                <Plus className="w-4 h-4" />
                Add flow
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1 overflow-y-auto p-4">
              {flows.map((flow) => (
                <div key={flow.id} className="group relative">
                  <DrawerTrigger asChild>
                    <button
                      onClick={() => navigate(FLOW_URL(flow.id))}
                      className={`w-full flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                        flow.id === currentFlowId ? "bg-accent font-medium" : ""
                      }`}
                    >
                      <span className="text-sm">{flow.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {flow.description || "No description"}
                      </span>
                    </button>
                  </DrawerTrigger>

                  {/* Action buttons — outside DrawerTrigger so they don't close the drawer */}
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                    <button
                      className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-primary hover:text-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingFlow(flow)
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      className="flex items-center justify-center w-6 h-6 rounded bg-card border border-border shadow-sm hover:border-destructive hover:text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingFlow(flow)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      <AddFlowDialog
        open={addingFlow}
        onClose={() => setAddingFlow(false)}
        onCreated={(flowId) => navigate(FLOW_URL(flowId))}
      />

      <EditFlowDialog flow={editingFlow} onClose={() => setEditingFlow(null)} />

      <DeleteFlowDialog
        flow={deletingFlow}
        isCurrentFlow={deletingFlow?.id === currentFlowId}
        onClose={() => setDeletingFlow(null)}
        onDeleted={() => {
          if (deletingFlow?.id === currentFlowId) navigate(FLOWS_URL())
        }}
      />
    </>
  )
}

// ─── Add Flow Dialog ──────────────────────────────────────────────────────────

function AddFlowDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (flowId: string) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const { mutate: createFlow, isPending } = useCreateFlow()

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose()
      setName("")
      setDescription("")
    }
  }

  function handleCreate() {
    createFlow(
      { body: { name: name.trim(), description: description.trim() || null } },
      {
        onSuccess: (flow) => {
          onCreated(flow.id)
          onClose()
          setName("")
          setDescription("")
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New flow</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-flow-name">Name *</Label>
            <Input
              id="new-flow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Onboarding"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-flow-desc">Description</Label>
            <Textarea
              id="new-flow-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this flow…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || isPending} onClick={handleCreate}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Flow Dialog ─────────────────────────────────────────────────────────

function EditFlowDialog({
  flow,
  onClose,
}: {
  flow: Schemas.FlowSummaryResponse | null
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const { mutate: updateFlow, isPending } = useUpdateFlow(flow?.id ?? "")

  useEffect(() => {
    if (flow) {
      setName(flow.name)
      setDescription(flow.description ?? "")
    }
  }, [flow?.id])

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose()
      setName("")
      setDescription("")
    }
  }

  function handleSave() {
    if (!flow) return
    updateFlow(
      { path: { flow_id: flow.id }, body: { name: name.trim(), description: description.trim() || null } },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open={flow !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit flow</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-name">Name *</Label>
            <Input
              id="flow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Onboarding"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flow-desc">Description</Label>
            <Textarea
              id="flow-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this flow…"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || isPending} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Flow Dialog ───────────────────────────────────────────────────────

function DeleteFlowDialog({
  flow,
  isCurrentFlow,
  onClose,
  onDeleted,
}: {
  flow: Schemas.FlowSummaryResponse | null
  isCurrentFlow: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const { mutate: deleteFlow } = useDeleteFlow()

  return (
    <AlertDialog open={flow !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete flow?</AlertDialogTitle>
          <AlertDialogDescription>
            "{flow?.name}" and all its steps will be permanently deleted.
            {isCurrentFlow && " You will be redirected to the flows list."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (!flow) return
              deleteFlow({ path: { flow_id: flow.id } }, { onSuccess: onDeleted })
              onClose()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
