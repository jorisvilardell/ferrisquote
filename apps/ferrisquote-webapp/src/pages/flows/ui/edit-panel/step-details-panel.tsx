import { useEffect, useState } from "react"
import { Pencil, Plus, Trash2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import {
  StepRepeatableConfig,
  validateRepeatable,
  type RepeatableDraft,
} from "./step-repeatable-config"

const STEP_COLOR = "hsl(28, 85%, 55%)"

function repeatableFromStep(step: Schemas.StepResponse): RepeatableDraft {
  return {
    isRepeatable: step.is_repeatable,
    repeatLabel: step.repeat_label ?? "",
    minRepeats: step.min_repeats,
    maxRepeats: step.max_repeats ?? "",
  }
}

function sameRepeatable(a: RepeatableDraft, b: RepeatableDraft): boolean {
  return (
    a.isRepeatable === b.isRepeatable &&
    a.repeatLabel === b.repeatLabel &&
    a.minRepeats === b.minRepeats &&
    a.maxRepeats === b.maxRepeats
  )
}

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
  const { t } = useTranslation()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(step.title)
  const [descDraft, setDescDraft] = useState(step.description)
  const [repeatDraft, setRepeatDraft] = useState<RepeatableDraft>(
    repeatableFromStep(step),
  )

  useEffect(() => {
    setTitleDraft(step.title)
    setDescDraft(step.description)
    setRepeatDraft(repeatableFromStep(step))
    setEditingTitle(false)
  }, [
    step.id,
    step.title,
    step.description,
    step.is_repeatable,
    step.repeat_label,
    step.min_repeats,
    step.max_repeats,
  ])

  const trimmedTitle = titleDraft.trim()
  const titleDirty = trimmedTitle !== step.title
  const descDirty = descDraft !== step.description
  const repeatDirty = !sameRepeatable(repeatDraft, repeatableFromStep(step))
  const isDirty = titleDirty || descDirty || repeatDirty

  const repeatError = validateRepeatable(repeatDraft)
  const titleValid = trimmedTitle.length > 0
  const canSave = isDirty && titleValid && !repeatError

  function handleSave() {
    if (!canSave) return
    const body: Schemas.UpdateStepMetadataRequest = {}
    if (titleDirty) body.title = trimmedTitle
    if (descDirty) body.description = descDraft
    if (repeatDirty) {
      body.is_repeatable = repeatDraft.isRepeatable
      if (repeatDraft.isRepeatable) {
        body.repeat_label = repeatDraft.repeatLabel.trim() || null
        body.min_repeats = repeatDraft.minRepeats
        body.max_repeats = repeatDraft.maxRepeats === "" ? null : repeatDraft.maxRepeats
      } else {
        body.repeat_label = null
        body.min_repeats = 1
        body.max_repeats = null
      }
    }
    onUpdateStep(step.id, body)
  }

  function handleCancel() {
    setTitleDraft(step.title)
    setDescDraft(step.description)
    setRepeatDraft(repeatableFromStep(step))
    setEditingTitle(false)
  }

  return (
    <>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2 border-b shrink-0">
        {editingTitle ? (
          <Input
            autoFocus
            className="flex-1 !text-base font-semibold h-7 rounded-sm border border-border/60 bg-transparent px-2 py-0 shadow-none focus-visible:border-border focus-visible:ring-0"
            style={{ color: STEP_COLOR }}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false)
            }}
          />
        ) : (
          <button
            className="flex-1 text-left text-base font-semibold truncate hover:opacity-80 transition-opacity cursor-text"
            style={{ color: STEP_COLOR }}
            onClick={() => setEditingTitle(true)}
          >
            {titleDraft || step.title}
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
          {t("step_panel.description_label")}
        </Label>
        <Textarea
          id="step-desc"
          rows={2}
          placeholder={t("step_panel.description_optional")}
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
        />
      </div>

      <StepRepeatableConfig
        draft={repeatDraft}
        onChange={setRepeatDraft}
        validationError={repeatError}
      />

      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("step_panel.fields_section")}
        </span>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => onAddField(step.id)}>
          <Plus className="w-3 h-3" />
          {t("step_panel.add_field_button")}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {step.fields.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center px-5">
            <p className="text-sm text-muted-foreground">{t("step_panel.no_fields")}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onAddField(step.id)}>
              <Plus className="w-3.5 h-3.5" />
              {t("step_panel.add_field_button")}
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
                  {t(`node.field.types.${field.config.type}`, { defaultValue: field.config.type })}
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
                        <AlertDialogTitle>{t("step_panel.delete_field_title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("step_panel.delete_field_confirm", { label: field.label })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => onDeleteField(field.id, step.id)}
                        >
                          {t("common.delete")}
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

      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button
          variant="outline"
          className="flex-1"
          disabled={!isDirty}
          onClick={handleCancel}
        >
          {t("common.cancel")}
        </Button>
        <Button
          className="flex-1"
          disabled={!canSave}
          onClick={handleSave}
        >
          {t("common.save")}
        </Button>
      </div>
    </>
  )
}
