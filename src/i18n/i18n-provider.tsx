import { createContext, useContext, useMemo, useState } from "react"
import type { ReactNode } from "react"

import { MESSAGES, type Locale, type TranslationKey } from "@/i18n/messages"

type TranslationParams = Record<string, string | number>

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: TranslationParams) => string
}

const STORAGE_KEY = "mqtt-console:locale"

const I18nContext = createContext<I18nContextValue | null>(null)

function getDefaultLocale(): Locale {
  if (typeof window === "undefined") {
    return "zh-CN"
  }

  const persisted = window.localStorage.getItem(STORAGE_KEY)
  if (persisted === "zh-CN" || persisted === "en-US") {
    return persisted
  }

  return navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US"
}

function formatMessage(template: string, params?: TranslationParams): string {
  if (!params) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token]
    return value === undefined ? `{${token}}` : String(value)
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDefaultLocale)

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (nextLocale: Locale) => {
      window.localStorage.setItem(STORAGE_KEY, nextLocale)
      setLocaleState(nextLocale)
    }

    const t = (key: TranslationKey, params?: TranslationParams): string => {
      const source = MESSAGES[locale][key] ?? MESSAGES["en-US"][key] ?? key
      return formatMessage(source, params)
    }

    return {
      locale,
      setLocale,
      t,
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }

  return context
}
