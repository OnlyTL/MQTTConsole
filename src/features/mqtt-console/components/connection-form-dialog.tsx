import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/i18n/i18n-provider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { ConnectionFormValues } from "@/types/mqtt-console"

interface ConnectionFormDialogProps {
  open: boolean
  mode: "create" | "edit"
  initialValues: ConnectionFormValues
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ConnectionFormValues) => void
}

const URL_PATTERN = /^wss?:\/\//i

function toPositiveNumber(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function ConnectionFormDialog({
  open,
  mode,
  initialValues,
  onOpenChange,
  onSubmit,
}: ConnectionFormDialogProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<ConnectionFormValues>(initialValues)
  const [errorMessage, setErrorMessage] = useState<string>("")

  useEffect(() => {
    if (!open) {
      return
    }

    setFormValues(initialValues)
    setErrorMessage("")
  }, [initialValues, open])

  const title = useMemo(
    () =>
      mode === "create"
        ? t("connection.form.createTitle")
        : t("connection.form.editTitle"),
    [mode, t]
  )

  const description = useMemo(
    () =>
      mode === "create"
        ? t("connection.form.createDescription")
        : t("connection.form.editDescription"),
    [mode, t]
  )

  const updateField = <K extends keyof ConnectionFormValues>(
    key: K,
    value: ConnectionFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = () => {
    const normalizedName = formValues.name.trim()
    const normalizedUrl = formValues.brokerUrl.trim()
    const normalizedClientId = formValues.clientId.trim()

    if (!normalizedName || !normalizedUrl || !normalizedClientId) {
      setErrorMessage(t("connection.form.requiredError"))
      return
    }

    if (!URL_PATTERN.test(normalizedUrl)) {
      setErrorMessage(t("connection.form.urlError"))
      return
    }

    const safeValues: ConnectionFormValues = {
      ...formValues,
      name: normalizedName,
      brokerUrl: normalizedUrl,
      clientId: normalizedClientId,
      username: formValues.username.trim(),
      keepAlive: toPositiveNumber(formValues.keepAlive, 60),
      connectTimeout: toPositiveNumber(formValues.connectTimeout, 30_000),
      reconnectPeriod: toPositiveNumber(formValues.reconnectPeriod, 2_000),
    }

    onSubmit(safeValues)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="connection-name">{t("connection.form.name")}</Label>
            <Input
              id="connection-name"
              placeholder={t("connection.form.namePlaceholder")}
              value={formValues.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="connection-url">{t("connection.form.brokerUrl")}</Label>
            <Input
              id="connection-url"
              placeholder={t("connection.form.brokerUrlPlaceholder")}
              value={formValues.brokerUrl}
              onChange={(event) => updateField("brokerUrl", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="connection-client-id">{t("connection.form.clientId")}</Label>
            <Input
              id="connection-client-id"
              value={formValues.clientId}
              onChange={(event) => updateField("clientId", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="connection-username">{t("connection.form.username")}</Label>
              <Input
                id="connection-username"
                value={formValues.username}
                onChange={(event) => updateField("username", event.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="connection-password">{t("connection.form.password")}</Label>
              <Input
                id="connection-password"
                type="password"
                value={formValues.password}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="connection-keep-alive">{t("connection.form.keepAlive")}</Label>
              <Input
                id="connection-keep-alive"
                type="number"
                min={1}
                value={formValues.keepAlive}
                onChange={(event) =>
                  updateField("keepAlive", Number(event.target.value))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="connection-timeout">{t("connection.form.connectTimeout")}</Label>
              <Input
                id="connection-timeout"
                type="number"
                min={1000}
                step={1000}
                value={formValues.connectTimeout}
                onChange={(event) =>
                  updateField("connectTimeout", Number(event.target.value))
                }
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="connection-reconnect">{t("connection.form.reconnect")}</Label>
              <Input
                id="connection-reconnect"
                type="number"
                min={500}
                step={500}
                value={formValues.reconnectPeriod}
                onChange={(event) =>
                  updateField("reconnectPeriod", Number(event.target.value))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between border px-2.5 py-2">
            <div>
              <p className="text-xs font-medium">{t("connection.form.cleanSession")}</p>
              <p className="text-muted-foreground text-xs">
                {t("connection.form.cleanSessionDescription")}
              </p>
            </div>
            <Switch
              checked={formValues.clean}
              onCheckedChange={(checked) => updateField("clean", checked)}
              aria-label={t("connection.form.toggleClean")}
            />
          </div>

          {errorMessage ? (
            <p className="text-destructive text-xs">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>
            {mode === "create" ? t("common.create") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
