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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { TopicFormValues } from "@/types/mqtt-console"

interface TopicFormDialogProps {
  open: boolean
  mode: "create" | "edit"
  initialValues: TopicFormValues
  onOpenChange: (open: boolean) => void
  onSubmit: (values: TopicFormValues) => void
}

export function TopicFormDialog({
  open,
  mode,
  initialValues,
  onOpenChange,
  onSubmit,
}: TopicFormDialogProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<TopicFormValues>(initialValues)
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
        ? t("topic.form.createTitle")
        : t("topic.form.editTitle"),
    [mode, t]
  )

  const description = useMemo(
    () =>
      mode === "create"
        ? t("topic.form.createDescription")
        : t("topic.form.editDescription"),
    [mode, t]
  )

  const handleSubmit = () => {
    const normalizedName = formValues.name.trim()
    const normalizedGroup = formValues.group.trim()
    const normalizedTopic = formValues.topic.trim()
    if (!normalizedName || !normalizedTopic) {
      setErrorMessage(t("topic.form.requiredError"))
      return
    }

    const nextValues: TopicFormValues = {
      ...formValues,
      name: normalizedName,
      group: normalizedGroup,
      topic: normalizedTopic,
    }

    onSubmit(nextValues)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="topic-display-name">{t("topic.form.name")}</Label>
            <Input
              id="topic-display-name"
              placeholder={t("topic.form.namePlaceholder")}
              value={formValues.name}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="topic-name">{t("topic.form.topic")}</Label>
            <Input
              id="topic-name"
              placeholder={t("topic.form.topicPlaceholder")}
              value={formValues.topic}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, topic: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="topic-group">{t("topic.form.group")}</Label>
            <Input
              id="topic-group"
              placeholder={t("topic.form.groupPlaceholder")}
              value={formValues.group}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, group: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t("topic.form.qos")}</Label>
            <Select
              value={String(formValues.qos)}
              onValueChange={(value) =>
                setFormValues((prev) => ({ ...prev, qos: Number(value) as 0 | 1 | 2 }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("topic.form.qosPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t("topic.form.qos0")}</SelectItem>
                <SelectItem value="1">{t("topic.form.qos1")}</SelectItem>
                <SelectItem value="2">{t("topic.form.qos2")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between border px-2.5 py-2">
            <div>
              <p className="text-xs font-medium">{t("topic.form.enabled")}</p>
              <p className="text-muted-foreground text-xs">
                {t("topic.form.enabledDescription")}
              </p>
            </div>
            <Switch
              checked={formValues.enabled}
              onCheckedChange={(checked) =>
                setFormValues((prev) => ({ ...prev, enabled: checked }))
              }
              aria-label={t("topic.form.toggleEnabled")}
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
