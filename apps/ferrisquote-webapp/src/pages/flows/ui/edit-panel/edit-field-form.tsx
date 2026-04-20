import { useEffect, useState } from "react"
import type { Schemas } from "@/api/api.client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  FieldConfigForm,
  defaultConfig,
  type FieldType,
} from "./field-config-form"
import { PanelHeader } from "./panel-header"

export function EditFieldForm({
  field,
  stepId,
  onClose,
  onSubmit,
}: {
  field: Schemas.FieldResponse
  stepId: string
  onClose: () => void
  onSubmit: (
    fieldId: string,
    stepId: string,
    data: {
      label?: string
      key?: string
      description?: string | null
      config?: Schemas.FieldConfigDto
    },
  ) => void
}) {
  const [label, setLabel] = useState(field.label)
  const [key, setKey] = useState(field.key)
  const [description, setDescription] = useState(field.description)
  const [config, setConfig] = useState<Schemas.FieldConfigDto>(field.config)

  useEffect(() => {
    setLabel(field.label)
    setKey(field.key)
    setDescription(field.description)
    setConfig(field.config)
  }, [field.id])

  function handleTypeChange(value: FieldType) {
    setConfig(defaultConfig(value))
  }

  const keyValid = /^[a-z][a-z0-9_]*$/.test(key)
  const canSave = label.trim().length > 0 && keyValid

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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-field-key">Key *</Label>
          <Input
            id="edit-field-key"
            placeholder="e.g. first_name"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          {!keyValid && key.length > 0 && (
            <p className="text-xs text-destructive">
              Lowercase letters, digits and underscores only; must start with a letter.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-field-desc">Description</Label>
          <Textarea
            id="edit-field-desc"
            placeholder="Optional"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
          {config.type !== field.config.type && (
            <p className="text-xs text-muted-foreground">
              Changing the type resets type-specific settings.
            </p>
          )}
        </div>
        <FieldConfigForm config={config} onChange={setConfig} />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={!canSave}
          onClick={() => {
            // Only include patched fields so the partial-update stays minimal
            const trimmedLabel = label.trim()
            const trimmedDesc = description.trim()
            const patch: {
              label?: string
              key?: string
              description?: string | null
              config?: Schemas.FieldConfigDto
            } = {}
            if (trimmedLabel !== field.label) patch.label = trimmedLabel
            if (key !== field.key) patch.key = key
            if (trimmedDesc !== field.description) patch.description = trimmedDesc || null
            if (JSON.stringify(config) !== JSON.stringify(field.config)) patch.config = config
            if (Object.keys(patch).length > 0) {
              onSubmit(field.id, stepId, patch)
            }
            onClose()
          }}
        >
          Save
        </Button>
      </div>
    </>
  )
}
