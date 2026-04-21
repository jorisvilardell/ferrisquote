import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import en from "@/locales/en/translation.json"
import fr from "@/locales/fr/translation.json"

export const SUPPORTED_LANGS = ["fr", "en"] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

/**
 * i18n singleton. French is the project default; English is the secondary
 * fallback. `LanguageDetector` pulls the previously selected language from
 * `localStorage` (key: `i18nextLng`) so user choice persists across sessions,
 * then falls back to the browser's `navigator.language`.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    interpolation: {
      // React already escapes output — no need for i18next to double-escape.
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  })

export default i18n
