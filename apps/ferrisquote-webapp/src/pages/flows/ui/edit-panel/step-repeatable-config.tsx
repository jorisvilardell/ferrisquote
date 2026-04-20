import { Repeat } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type RepeatableDraft = {
  isRepeatable: boolean
  repeatLabel: string
  minRepeats: number
  maxRepeats: number | ""
}

export function validateRepeatable(d: RepeatableDraft): string | null {
  if (!d.isRepeatable) return null
  if (d.maxRepeats !== "" && d.maxRepeats < d.minRepeats)
    return "Max repeats must be greater than or equal to min."
  if (d.minRepeats < 0) return "Min repeats cannot be negative."
  return null
}

/**
 * Pure controlled repeatable-config UI. All state lives in the parent so the
 * parent's Save button commits the whole step edit in one mutation.
 */
export function StepRepeatableConfig({
  draft,
  onChange,
  validationError,
}: {
  draft: RepeatableDraft
  onChange: (next: RepeatableDraft) => void
  validationError?: string | null
}) {
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
          checked={draft.isRepeatable}
          onCheckedChange={(checked) => onChange({ ...draft, isRepeatable: checked })}
        />
      </div>

      {draft.isRepeatable && (
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="repeat-label" className="text-xs">Button label</Label>
            <Input
              id="repeat-label"
              placeholder='e.g. "Add another room"'
              value={draft.repeatLabel}
              onChange={(e) => onChange({ ...draft, repeatLabel: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-repeats" className="text-xs">Min repeats</Label>
              <Input
                id="min-repeats"
                type="number"
                min={0}
                value={draft.minRepeats}
                onChange={(e) =>
                  onChange({ ...draft, minRepeats: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="max-repeats" className="text-xs">Max repeats</Label>
              <Input
                id="max-repeats"
                type="number"
                min={0}
                placeholder="No limit"
                value={draft.maxRepeats}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    maxRepeats: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </div>
      )}
    </div>
  )
}
