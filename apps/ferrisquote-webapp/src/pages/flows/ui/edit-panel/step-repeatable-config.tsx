import { Repeat } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export type RepeatableDraft = {
  isRepeatable: boolean
  repeatLabel: string
  minRepeats: number
  maxRepeats: number | ""
}

/** Returns a translation key for the validation error, or null if valid. */
export function validateRepeatable(d: RepeatableDraft): string | null {
  if (!d.isRepeatable) return null
  if (d.maxRepeats !== "" && d.maxRepeats < d.minRepeats)
    return "repeatable.error_max_lt_min"
  if (d.minRepeats < 0) return "repeatable.error_min_negative"
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
  const { t } = useTranslation()
  return (
    <div className="px-5 py-3 border-b space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
          <Label htmlFor="repeatable-toggle" className="text-xs font-medium">
            {t("repeatable.allow")}
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
            <Label htmlFor="repeat-label" className="text-xs">{t("repeatable.button_label")}</Label>
            <Input
              id="repeat-label"
              placeholder={t("repeatable.button_label_placeholder")}
              value={draft.repeatLabel}
              onChange={(e) => onChange({ ...draft, repeatLabel: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="min-repeats" className="text-xs">{t("repeatable.min")}</Label>
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
              <Label htmlFor="max-repeats" className="text-xs">{t("repeatable.max")}</Label>
              <Input
                id="max-repeats"
                type="number"
                min={0}
                placeholder={t("repeatable.max_placeholder")}
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
            // validateRepeatable returns translation keys (see above).
            <p className="text-xs text-destructive">{t(validationError)}</p>
          )}
        </div>
      )}
    </div>
  )
}
