import { useTranslation } from "react-i18next"
import { Languages } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SUPPORTED_LANGS } from "@/i18n"

/**
 * Language picker. Writes to `i18n.changeLanguage`, which triggers
 * `react-i18next` to re-render subscribed components and persists the
 * choice via the LanguageDetector's `localStorage` cache.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  // `i18n.resolvedLanguage` may include a region (e.g. `fr-FR`); collapse to
  // the base tag so it matches our SelectItem values.
  const current = (i18n.resolvedLanguage ?? i18n.language ?? "fr").slice(0, 2)

  return (
    <div className="flex items-center gap-2">
      <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={current}
        onValueChange={(v) => void i18n.changeLanguage(v)}
      >
        <SelectTrigger className="h-7 text-xs w-full" aria-label={t("nav.language")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGS.map((code) => (
            <SelectItem key={code} value={code}>
              {code === "fr" ? "Français" : "English"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
