import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PanelHeader } from "./panel-header"

export function AddStepForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (data: { title: string; description: string }) => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  return (
    <>
      <PanelHeader title="Add step" description="Add a new step to this flow." onClose={onClose} />
      <div className="flex flex-col gap-4 px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="step-title">Title *</Label>
          <Input
            id="step-title"
            placeholder="e.g. Personal information"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="step-desc">Description</Label>
          <Textarea
            id="step-desc"
            placeholder="Describe this step…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!title.trim()}
          onClick={() => {
            onSubmit({ title: title.trim(), description: description.trim() })
            onClose()
          }}
        >
          Add step
        </Button>
      </div>
    </>
  )
}
