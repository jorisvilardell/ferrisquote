import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, X, Repeat } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Schemas } from "@/api/api.client"

// ─── Panel state (ID-based — data derived from live query) ────────────────────

export type PanelState =
  | { mode: "add-step" }
  | { mode: "step-details"; stepId: string }
  | { mode: "add-field"; stepId: string }
  | { mode: "edit-field"; fieldId: string; stepId: string }

// ─── Field type helpers ───────────────────────────────────────────────────────

type FieldType = Schemas.FieldConfigDto["type"]

function defaultConfig(type: FieldType): Schemas.FieldConfigDto {
  switch (type) {
    case "text":
      return { type: "text", max_length: 255 }
    case "number":
      return { type: "number", min: null, max: null }
    case "date":
      return { type: "date", min: "", max: "" }
    case "boolean":
      return { type: "boolean", default: false }
    case "select":
      return { type: "select", options: [] }
  }
}

function labelToKey(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({
  title,
  description,
  onClose,
  actions,
}: {
  title: string
  description?: string
  onClose: () => void
  actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 px-5 py-4 border-b shrink-0">
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold leading-tight truncate">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
        )}
      </div>
      {actions}
      <Button variant="ghost" size="icon" className="w-7 h-7 shrink-0" onClick={onClose}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}

// ─── Field config sub-form ────────────────────────────────────────────────────

function FieldConfigForm({
  config,
  onChange,
}: {
  config: Schemas.FieldConfigDto
  onChange: (config: Schemas.FieldConfigDto) => void
}) {
  if (config.type === "text") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="max_length">Max length</Label>
        <Input
          id="max_length"
          type="number"
          min={1}
          value={config.max_length}
          onChange={(e) => onChange({ type: "text", max_length: Number(e.target.value) })}
        />
      </div>
    )
  }

  if (config.type === "number") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="num_min">Min</Label>
          <Input
            id="num_min"
            type="number"
            placeholder="No limit"
            value={config.min ?? ""}
            onChange={(e) =>
              onChange({ ...config, min: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="num_max">Max</Label>
          <Input
            id="num_max"
            type="number"
            placeholder="No limit"
            value={config.max ?? ""}
            onChange={(e) =>
              onChange({ ...config, max: e.target.value === "" ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>
    )
  }

  if (config.type === "date") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_min">Min date</Label>
          <Input
            id="date_min"
            type="date"
            value={config.min}
            onChange={(e) => onChange({ ...config, min: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date_max">Max date</Label>
          <Input
            id="date_max"
            type="date"
            value={config.max}
            onChange={(e) => onChange({ ...config, max: e.target.value })}
          />
        </div>
      </div>
    )
  }

  if (config.type === "select") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>Options (one per line)</Label>
        <Textarea
          value={config.options.join("\n")}
          onChange={(e) =>
            onChange({ type: "select", options: e.target.value.split("\n").filter(Boolean) })
          }
          placeholder={"Option A\nOption B\nOption C"}
          rows={4}
        />
      </div>
    )
  }

  return null
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type Props = {
  state: PanelState | null
  step: Schemas.StepResponse | null
  field: Schemas.FieldResponse | null
  onClose: () => void
  onAddStep: (data: { title: string; description: string }) => void
  onUpdateStep: (stepId: string, data: Schemas.UpdateStepMetadataRequest) => void
  onAddField: (stepId: string, data: { label: string; key: string; config: Schemas.FieldConfigDto }) => void
  onEditField: (fieldId: string, stepId: string, data: { label: string; config: Schemas.FieldConfigDto }) => void
  onDeleteField: (fieldId: string, stepId: string) => void
  onOpenAddField: (stepId: string) => void
  onOpenEditField: (fieldId: string, stepId: string) => void
}

export function FlowEditPanel({
  state,
  step,
  field,
  onClose,
  onAddStep,
  onUpdateStep,
  onAddField,
  onEditField,
  onDeleteField,
  onOpenAddField,
  onOpenEditField,
}: Props) {
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        state ? "w-80" : "w-0",
      )}
    >
      <div className="w-80 h-full border-l bg-background flex flex-col overflow-hidden">
        {state?.mode === "add-step" && (
          <AddStepForm onClose={onClose} onSubmit={onAddStep} />
        )}
        {state?.mode === "step-details" && step && (
          <StepDetailsPanel
            step={step}
            onClose={onClose}
            onUpdateStep={onUpdateStep}
            onAddField={onOpenAddField}
            onEditField={onOpenEditField}
            onDeleteField={onDeleteField}
          />
        )}
        {state?.mode === "add-field" && step && (
          <AddFieldForm
            stepId={step.id}
            stepTitle={step.title}
            onClose={onClose}
            onSubmit={onAddField}
          />
        )}
        {state?.mode === "edit-field" && field && state.stepId && (
          <EditFieldForm
            field={field}
            stepId={state.stepId}
            onClose={onClose}
            onSubmit={onEditField}
          />
        )}
      </div>
    </div>
  )
}

// ─── Add Step Form ────────────────────────────────────────────────────────────

function AddStepForm({
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

// ─── Step Details Panel ───────────────────────────────────────────────────────

function StepDetailsPanel({
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
  return (
    <>
      <PanelHeader
        title={step.title}
        description={step.description || undefined}
        onClose={onClose}
      />

      {/* Repeatable configuration */}
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

// ─── Step Repeatable Config ──────────────────────────────────────────────────

function StepRepeatableConfig({
  step,
  onUpdateStep,
}: {
  step: Schemas.StepResponse
  onUpdateStep: (stepId: string, data: Schemas.UpdateStepMetadataRequest) => void
}) {
  const [isRepeatable, setIsRepeatable] = useState(step.is_repeatable)
  const [repeatLabel, setRepeatLabel] = useState(step.repeat_label ?? "")
  const [minRepeats, setMinRepeats] = useState(step.min_repeats)
  const [maxRepeats, setMaxRepeats] = useState<number | "">(step.max_repeats ?? "")
  const [validationError, setValidationError] = useState<string | null>(null)

  // Sync local state when step changes (e.g. after server response)
  useEffect(() => {
    setIsRepeatable(step.is_repeatable)
    setRepeatLabel(step.repeat_label ?? "")
    setMinRepeats(step.min_repeats)
    setMaxRepeats(step.max_repeats ?? "")
    setValidationError(null)
  }, [step.id, step.is_repeatable, step.repeat_label, step.min_repeats, step.max_repeats])

  function validate(min: number, max: number | ""): string | null {
    if (max !== "" && max < min) return "Max repeats must be greater than or equal to min."
    if (min < 0) return "Min repeats cannot be negative."
    return null
  }

  function handleToggle(checked: boolean) {
    setIsRepeatable(checked)
    if (!checked) {
      setValidationError(null)
      onUpdateStep(step.id, {
        is_repeatable: false,
        repeat_label: null,
        min_repeats: 1,
        max_repeats: null,
      })
    }
  }

  function handleSave() {
    const error = validate(minRepeats, maxRepeats)
    if (error) {
      setValidationError(error)
      return
    }
    setValidationError(null)
    onUpdateStep(step.id, {
      is_repeatable: true,
      repeat_label: repeatLabel.trim() || null,
      min_repeats: minRepeats,
      max_repeats: maxRepeats === "" ? null : maxRepeats,
    })
  }

  return (
    <div className="px-5 py-3 border-b space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
          <Label htmlFor="repeatable-toggle" className="text-xs font-medium">
            Allow repetition
          </Label>
        </div>
        <Switch
          id="repeatable-toggle"
          checked={isRepeatable}
          onCheckedChange={handleToggle}
        />
      </div>

      {isRepeatable && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repeat-label" className="text-xs">Button label</Label>
            <Input
              id="repeat-label"
              placeholder='e.g. "Add another room"'
              value={repeatLabel}
              onChange={(e) => setRepeatLabel(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-repeats" className="text-xs">Min repeats</Label>
              <Input
                id="min-repeats"
                type="number"
                min={0}
                value={minRepeats}
                onChange={(e) => setMinRepeats(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-repeats" className="text-xs">Max repeats</Label>
              <Input
                id="max-repeats"
                type="number"
                min={0}
                placeholder="No limit"
                value={maxRepeats}
                onChange={(e) => setMaxRepeats(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>

          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}

          <Button size="sm" className="w-full" onClick={handleSave}>
            Save repetition settings
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Add Field Form ───────────────────────────────────────────────────────────

function AddFieldForm({
  stepId,
  stepTitle,
  onClose,
  onSubmit,
}: {
  stepId: string
  stepTitle: string
  onClose: () => void
  onSubmit: (stepId: string, data: { label: string; key: string; config: Schemas.FieldConfigDto }) => void
}) {
  const [label, setLabel] = useState("")
  const [key, setKey] = useState("")
  const [keyTouched, setKeyTouched] = useState(false)
  const [config, setConfig] = useState<Schemas.FieldConfigDto>(defaultConfig("text"))

  function handleLabelChange(value: string) {
    setLabel(value)
    if (!keyTouched) setKey(labelToKey(value))
  }

  function handleTypeChange(value: FieldType) {
    setConfig(defaultConfig(value))
  }

  return (
    <>
      <PanelHeader title="Add field" description={`To "${stepTitle}"`} onClose={onClose} />
      <div className="flex flex-col gap-4 px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-label">Label *</Label>
          <Input
            id="field-label"
            placeholder="e.g. First name"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-key">Key *</Label>
          <Input
            id="field-key"
            placeholder="e.g. first_name"
            value={key}
            onChange={(e) => {
              setKeyTouched(true)
              setKey(e.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Type</Label>
          <Select value={config.type} onValueChange={(v) => handleTypeChange(v as FieldType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="select">Select</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <FieldConfigForm config={config} onChange={setConfig} />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!label.trim() || !key.trim()}
          onClick={() => {
            onSubmit(stepId, { label: label.trim(), key: key.trim(), config })
            onClose()
          }}
        >
          Add field
        </Button>
      </div>
    </>
  )
}

// ─── Edit Field Form ──────────────────────────────────────────────────────────

function EditFieldForm({
  field,
  stepId,
  onClose,
  onSubmit,
}: {
  field: Schemas.FieldResponse
  stepId: string
  onClose: () => void
  onSubmit: (fieldId: string, stepId: string, data: { label: string; config: Schemas.FieldConfigDto }) => void
}) {
  const [label, setLabel] = useState(field.label)
  const [config, setConfig] = useState<Schemas.FieldConfigDto>(field.config)

  useEffect(() => {
    setLabel(field.label)
    setConfig(field.config)
  }, [field.id])

  return (
    <>
      <PanelHeader
        title="Edit field"
        description={`${field.label} — ${field.config.type}`}
        onClose={onClose}
      />
      <div className="flex flex-col gap-4 px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-field-label">Label *</Label>
          <Input
            id="edit-field-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <FieldConfigForm config={config} onChange={setConfig} />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!label.trim()}
          onClick={() => {
            onSubmit(field.id, stepId, { label: label.trim(), config })
            onClose()
          }}
        >
          Save
        </Button>
      </div>
    </>
  )
}
