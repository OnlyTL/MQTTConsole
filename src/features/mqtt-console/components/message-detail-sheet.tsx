import { useEffect, useMemo, useState } from "react"
import JsonView from "@uiw/react-json-view"
import { darkTheme } from "@uiw/react-json-view/dark"
import { lightTheme } from "@uiw/react-json-view/light"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTheme } from "@/components/theme-provider"
import { useI18n } from "@/i18n/i18n-provider"
import type { MessagePayloadView, MessageRecord } from "@/types/mqtt-console"

interface MessageDetailSheetProps {
  open: boolean
  message: MessageRecord | null
  onOpenChange: (open: boolean) => void
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

export function MessageDetailSheet({
  open,
  message,
  onOpenChange,
}: MessageDetailSheetProps) {
  const { theme } = useTheme()
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<MessagePayloadView>("text")

  const isDarkMode = useMemo(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
    }

    return theme === "dark"
  }, [theme])

  const parsedPayload = useMemo(() => {
    if (!message) {
      return null
    }

    try {
      const parsed = JSON.parse(message.payload) as object
      return parsed
    } catch {
      return null
    }
  }, [message])

  useEffect(() => {
    if (!message) {
      return
    }

    setViewMode(parsedPayload ? "json" : "text")
  }, [message, parsedPayload])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:w-[min(980px,95vw)] data-[side=right]:sm:max-w-[min(980px,95vw)]"
      >
        <SheetHeader className="border-b">
          <SheetTitle>{t("detail.sheet.title")}</SheetTitle>
          <SheetDescription>
            {t("detail.sheet.description")}
          </SheetDescription>
        </SheetHeader>

        {message ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border p-2">
                <p className="text-muted-foreground">{t("detail.sheet.topic")}</p>
                <p className="font-medium break-all">{message.topic}</p>
              </div>
              <div className="border p-2">
                <p className="text-muted-foreground">{t("detail.sheet.direction")}</p>
                <Badge
                  variant={message.direction === "received" ? "secondary" : "default"}
                  className="mt-1"
                >
                  {message.direction === "received"
                    ? t("message.filter.received")
                    : t("message.filter.sent")}
                </Badge>
              </div>
              <div className="border p-2">
                <p className="text-muted-foreground">{t("detail.sheet.qos")}</p>
                <p className="font-medium">{message.qos}</p>
              </div>
              <div className="border p-2">
                <p className="text-muted-foreground">{t("detail.sheet.retain")}</p>
                <p className="font-medium">
                  {message.retain ? t("common.yes") : t("common.no")}
                </p>
              </div>
              <div className="col-span-2 border p-2">
                <p className="text-muted-foreground">{t("detail.sheet.createdAt")}</p>
                <p className="font-medium">{formatDateTime(message.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{t("detail.sheet.payload")}</p>
              <Select
                value={viewMode}
                onValueChange={(value) => setViewMode(value as MessagePayloadView)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{t("detail.sheet.text")}</SelectItem>
                  <SelectItem value="json">{t("detail.sheet.json")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-h-0 flex-1 overflow-auto border p-3">
              {viewMode === "json" ? (
                parsedPayload ? (
                  <JsonView
                    value={parsedPayload}
                    collapsed={false}
                    displayDataTypes={false}
                    enableClipboard
                    style={isDarkMode ? darkTheme : lightTheme}
                  />
                ) : (
                  <Alert variant="destructive">
                    <AlertTitle>{t("detail.sheet.invalidJsonTitle")}</AlertTitle>
                    <AlertDescription>
                      {t("detail.sheet.invalidJsonDescription")}
                    </AlertDescription>
                  </Alert>
                )
              ) : (
                <pre className="text-xs whitespace-pre-wrap break-words">{message.payload}</pre>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
