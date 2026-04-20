import type { Schemas } from "@/api/api.client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type FieldType = Schemas.FieldConfigDto["type"]

/** Default config for a given field type. Used when creating a new field or switching type. */
export function defaultConfig(type: FieldType): Schemas.FieldConfigDto {
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

/** Slugify a label into a valid field key (lowercase snake_case). */
export function labelToKey(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

export function FieldConfigForm({
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
