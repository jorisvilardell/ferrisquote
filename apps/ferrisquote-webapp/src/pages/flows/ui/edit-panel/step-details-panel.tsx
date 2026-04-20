import { useEffect, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import type { Schemas } from "@/api/api.client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StepRepeatableConfig } from "./step-repeatable-config"

const STEP_COLOR = "hsl(28, 85%, 55%)"

export function StepDetailsPanel({
  step,
  onClose,
  onUpdateStep,
  onAddField,
  onEditField,
  onDeleteField,
}: {
  step: Schemas.StepResponse
  onClose: () => void
  onUpdateStep: (stepId: string, data: Schemas.UpdateStepMetadataRequest) => void
  onAddField: (stepId: string) => void
  onEditField: (fieldId: string, stepId: string) => void
  onDeleteField: (fieldId: string, stepId: string) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(step.title)
  const [description, setDescription] = useState(step.description)

  useEffect(() => {
    setTitle(step.title)
    setEditingTitle(false)
  }, [step.id, step.title])

  useEffect(() => {
    setDescription(step.description)
  }, [step.id, step.description])

  const commitDescription = () => {
    if (description === step.description) return
    onUpdateStep(step.id, { description })
  }

  return (
    <>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b shrink-0">
        {editingTitle ? (
          <Input
            autoFocus
            className="flex-1 !text-base font-semibold h-7 rounded-sm border border-border/60 bg-transparent px-2 py-0 shadow-none focus-visible:border-border focus-visible:ring-0"
            style={{ color: STEP_COLOR }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== step.title) {
                onUpdateStep(step.id, { title: title.trim() })
              }
              setEditingTitle(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (title.trim() && title.trim() !== step.title) {
                  onUpdateStep(step.id, { title: title.trim() })
                }
                setEditingTitle(false)
              }
              if (e.key === "Escape") {
                setTitle(step.title)
                setEditingTitle(false)
              }
            }}
          />
        ) : (
          <button
            className="flex-1 text-left text-base font-semibold truncate hover:opacity-80 transition-opacity cursor-text"
            style={{ color: STEP_COLOR }}
            onClick={() => setEditingTitle(true)}
          >
            {step.title}
          </button>
        )}
        {!editingTitle && (
          <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="px-5 py-3 border-b space-y-1.5">
        <Label htmlFor="step-desc" className="text-xs font-medium">
          Description
        </Label>
        <Textarea
          id="step-desc"
          rows={2}
          placeholder="Optional — describe this step"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
        />
      </div>

      <StepRepeatableConfig step={step} onUpdateStep={onUpdateStep} />

      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Fields
        </span>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => onAddField(step.id)}>
          <Plus className="w-3 h-3" />
          Add field
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {step.fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
            <p className="text-sm text-muted-foreground">No fields yet.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAddField(step.id)}>
              <Plus className="w-3.5 h-3.5" />
              Add field
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y">
            {step.fields.map((field) => (
              <li key={field.id} className="flex items-center gap-2 px-5 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{field.label}</p>
                  <p className="text-xs text-muted-foreground">{field.key}</p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {field.config.type}
                </Badge>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6"
                    onClick={() => onEditField(field.id, step.id)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete field?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{field.label}" will be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDeleteField(field.id, step.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
