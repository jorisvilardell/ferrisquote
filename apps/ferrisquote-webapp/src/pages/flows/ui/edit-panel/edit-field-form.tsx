import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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
        title={t("field_panel.edit_title")}
        description={`${field.label} — ${t(`node.field.types.${field.config.type}`, { defaultValue: field.config.type })}`}
        onClose={onClose}
      />
      <div className="flex flex-col gap-4 px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-field-label">{t("field_panel.label")}</Label>
          <Input
            id="edit-field-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-field-key">{t("field_panel.key")}</Label>
          <Input
            id="edit-field-key"
            placeholder={t("field_panel.key_placeholder")}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          {!keyValid && key.length > 0 && (
            <p className="text-xs text-destructive">{t("field_panel.key_invalid")}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-field-desc">{t("field_panel.description_label")}</Label>
          <Textarea
            id="edit-field-desc"
            placeholder={t("field_panel.description_placeholder")}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("field_panel.type_label")}</Label>
          <Select value={config.type} onValueChange={(v) => handleTypeChange(v as FieldType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">{t("node.field.types.text")}</SelectItem>
              <SelectItem value="number">{t("node.field.types.number")}</SelectItem>
              <SelectItem value="date">{t("node.field.types.date")}</SelectItem>
              <SelectItem value="boolean">{t("node.field.types.boolean")}</SelectItem>
              <SelectItem value="select">{t("node.field.types.select")}</SelectItem>
            </SelectContent>
          </Select>
          {config.type !== field.config.type && (
            <p className="text-xs text-muted-foreground">
              {t("field_panel.type_changed_warning")}
            </p>
          )}
        </div>
        <FieldConfigForm config={config} onChange={setConfig} />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {t("common.cancel")}
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
          {t("common.save")}
        </Button>
      </div>
    </>
  )
}
