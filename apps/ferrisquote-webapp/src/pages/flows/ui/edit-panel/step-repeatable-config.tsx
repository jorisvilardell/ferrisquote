import { useEffect, useState } from "react"
import { Repeat } from "lucide-react"
import type { Schemas } from "@/api/api.client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function StepRepeatableConfig({
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
