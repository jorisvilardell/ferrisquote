import { useState } from "react"
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
