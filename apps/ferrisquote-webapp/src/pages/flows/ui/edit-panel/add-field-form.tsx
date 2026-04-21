import { useState } from "react"
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
import {
  FieldConfigForm,
  defaultConfig,
  labelToKey,
  type FieldType,
} from "./field-config-form"
import { PanelHeader } from "./panel-header"

export function AddFieldForm({
  stepId,
  stepTitle,
  onClose,
  onSubmit,
}: {
  stepId: string
  stepTitle: string
  onClose: () => void
  onSubmit: (
    stepId: string,
    data: { label: string; key: string; config: Schemas.FieldConfigDto },
  ) => void
}) {
  const { t } = useTranslation()
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
      <PanelHeader
        title={t("field_panel.add_title")}
        description={t("field_panel.add_description_prefix", { step: stepTitle })}
        onClose={onClose}
      />
      <div className="flex flex-col gap-4 px-5 py-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-label">{t("field_panel.label")}</Label>
          <Input
            id="field-label"
            placeholder={t("field_panel.label_placeholder")}
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="field-key">{t("field_panel.key")}</Label>
          <Input
            id="field-key"
            placeholder={t("field_panel.key_placeholder")}
            value={key}
            onChange={(e) => {
              setKeyTouched(true)
              setKey(e.target.value)
            }}
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
        </div>
        <FieldConfigForm config={config} onChange={setConfig} />
      </div>
      <div className="flex gap-2 px-5 py-4 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          className="flex-1"
          disabled={!label.trim() || !key.trim()}
          onClick={() => {
            onSubmit(stepId, { label: label.trim(), key: key.trim(), config })
            onClose()
          }}
        >
          {t("field_panel.add_submit")}
        </Button>
      </div>
    </>
  )
}
