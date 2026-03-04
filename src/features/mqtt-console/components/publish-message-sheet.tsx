import { useEffect, useMemo, useState } from "react"
import { Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_PUBLISH_FORM_VALUES } from "@/hooks/use-mqtt-console"
import { useI18n } from "@/i18n/i18n-provider"
import type {
  ConnectionRuntimeState,
  MqttConnectionProfile,
  PublishFormValues,
  TopicSubscription,
} from "@/types/mqtt-console"

interface PublishMessageSheetProps {
  open: boolean
  selectedConnection: MqttConnectionProfile | null
  connectionState?: ConnectionRuntimeState
  topics: TopicSubscription[]
  onOpenChange: (open: boolean) => void
  onPublishMessage: (connectionId: string, values: PublishFormValues) => Promise<void>
}

export function PublishMessageSheet({
  open,
  selectedConnection,
  connectionState,
  topics,
  onOpenChange,
  onPublishMessage,
}: PublishMessageSheetProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<PublishFormValues>(
    DEFAULT_PUBLISH_FORM_VALUES
  )
  const [isPublishing, setPublishing] = useState(false)

  const enabledTopicOptions = useMemo(
    () => topics.filter((topic) => topic.enabled),
    [topics]
  )

  const isConnected = connectionState?.status === "connected"

  useEffect(() => {
    if (!open) {
      return
    }

    setFormValues((prev) => {
      if (prev.topic || enabledTopicOptions.length === 0) {
        return prev
      }

      return {
        ...prev,
        topic: enabledTopicOptions[0].topic,
      }
    })
  }, [enabledTopicOptions, open])

  useEffect(() => {
    if (!open) {
      return
    }

    if (!selectedConnection) {
      setFormValues(DEFAULT_PUBLISH_FORM_VALUES)
    }
  }, [open, selectedConnection])

  const handleSubmit = async () => {
    if (!selectedConnection) {
      toast.error(t("toast.selectConnection"))
      return
    }

    setPublishing(true)
    try {
      await onPublishMessage(selectedConnection.id, formValues)
      toast.success(t("toast.publishSuccess"))
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("toast.publishFailed"))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-[460px]">
        <SheetHeader className="border-b">
          <SheetTitle>{t("publish.sheet.title")}</SheetTitle>
          <SheetDescription>
            {selectedConnection
              ? `${selectedConnection.name} · ${
                  isConnected ? t("common.connected") : t("common.disconnected")
                }`
              : t("publish.sheet.noConnection")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium" htmlFor="send-topic">
              {t("publish.sheet.topic")}
            </label>
            {enabledTopicOptions.length > 0 ? (
              <Select
                value={formValues.topic}
                onValueChange={(value) =>
                  setFormValues((prev) => ({ ...prev, topic: value }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("publish.sheet.pickEnabledTopic")} />
                </SelectTrigger>
                <SelectContent>
                  {enabledTopicOptions.map((topic) => (
                    <SelectItem key={topic.id} value={topic.topic}>
                      {topic.topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              id="send-topic"
              placeholder={t("publish.sheet.topicPlaceholder")}
              value={formValues.topic}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, topic: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs font-medium" htmlFor="send-payload">
              {t("publish.sheet.payload")}
            </label>
            <Textarea
              id="send-payload"
              className="min-h-32"
              placeholder={t("publish.sheet.payloadPlaceholder")}
              value={formValues.payload}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, payload: event.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <Select
              value={String(formValues.qos)}
              onValueChange={(value) =>
                setFormValues((prev) => ({ ...prev, qos: Number(value) as 0 | 1 | 2 }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="QoS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">QoS 0</SelectItem>
                <SelectItem value="1">QoS 1</SelectItem>
                <SelectItem value="2">QoS 2</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 border px-2 py-1">
              <span className="text-xs">{t("publish.sheet.retain")}</span>
              <Switch
                checked={formValues.retain}
                onCheckedChange={(checked) =>
                  setFormValues((prev) => ({ ...prev, retain: checked }))
                }
                aria-label={t("publish.sheet.toggleRetain")}
              />
            </div>
          </div>

          <div className="mt-auto flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!selectedConnection || !isConnected || isPublishing}
              onClick={handleSubmit}
            >
              <Send />
              {t("common.send")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
