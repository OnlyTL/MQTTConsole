import { useMemo, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_TOPIC_FORM_VALUES } from "@/hooks/use-mqtt-console"
import { useI18n } from "@/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import type {
  ConnectionRuntimeState,
  MqttConnectionProfile,
  TopicFormValues,
  TopicSubscription,
} from "@/types/mqtt-console"
import { TopicFormDialog } from "./topic-form-dialog"

interface TopicPanelProps {
  selectedConnection: MqttConnectionProfile | null
  topics: TopicSubscription[]
  connectionState?: ConnectionRuntimeState
  onAddTopic: (connectionId: string, values: TopicFormValues) => void
  onUpdateTopic: (topicId: string, values: TopicFormValues) => void
  onDeleteTopic: (topicId: string) => void
  onToggleTopicEnabled: (topicId: string, enabled: boolean) => void
}

const HEADER_CLASS = "flex h-12 items-center justify-between border-b px-3"
const FOOTER_CLASS = "h-12 border-t px-3"
const ITEM_HEIGHT_CLASS = "min-h-[72px]"
const UNGROUPED_GROUP_KEY = "__ungrouped__"

function buildTopicFormValues(topic: TopicSubscription): TopicFormValues {
  return {
    name: topic.name,
    group: topic.group ?? "",
    topic: topic.topic,
    qos: topic.qos,
    enabled: topic.enabled,
  }
}

export function TopicPanel({
  selectedConnection,
  topics,
  connectionState,
  onAddTopic,
  onUpdateTopic,
  onDeleteTopic,
  onToggleTopicEnabled,
}: TopicPanelProps) {
  const { t } = useI18n()
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editingTopic, setEditingTopic] = useState<TopicSubscription | null>(null)

  const isConnected = connectionState?.status === "connected"
  const groupedTopics = useMemo(() => {
    const grouped = new Map<string, TopicSubscription[]>()

    topics.forEach((topic) => {
      const groupKey =
        (typeof topic.group === "string" ? topic.group.trim() : "") || UNGROUPED_GROUP_KEY
      const groupTopics = grouped.get(groupKey)
      if (groupTopics) {
        groupTopics.push(topic)
        return
      }

      grouped.set(groupKey, [topic])
    })

    return Array.from(grouped.entries())
      .map(([key, groupTopics]) => ({
        key,
        label: key === UNGROUPED_GROUP_KEY ? t("topic.panel.ungrouped") : key,
        topics: [...groupTopics].sort((a, b) => a.topic.localeCompare(b.topic)),
      }))
      .sort((a, b) => {
        if (a.key === UNGROUPED_GROUP_KEY && b.key !== UNGROUPED_GROUP_KEY) {
          return 1
        }

        if (a.key !== UNGROUPED_GROUP_KEY && b.key === UNGROUPED_GROUP_KEY) {
          return -1
        }

        return a.label.localeCompare(b.label)
      })
  }, [t, topics])

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className={HEADER_CLASS}>
          <div>
            <h2 className="text-sm font-semibold">{t("topic.panel.title")}</h2>
          </div>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={!selectedConnection}
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            <span className="sr-only">{t("topic.panel.add")}</span>
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-2">
            {topics.length > 0 ? (
              <Accordion
                type="single"
                collapsible
                defaultValue={groupedTopics[0]?.key}
                className="gap-2"
              >
                {groupedTopics.map((group) => (
                  <AccordionItem key={group.key} value={group.key} className="border">
                    <AccordionTrigger className="px-2.5 py-2 hover:no-underline">
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium">{group.label}</p>
                        <Badge variant="outline">{group.topics.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 px-2.5 pb-2.5">
                      {group.topics.map((topic) => (
                        <div key={topic.id} className={cn("border p-2", ITEM_HEIGHT_CLASS)}>
                          <div className="grid h-full min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-2">
                            <HoverCard openDelay={150}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  className="block w-full min-w-0 cursor-default truncate border-0 bg-transparent p-0 text-left text-xs font-medium outline-none"
                                >
                                  {topic.name}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent side="right" align="start" className="w-80">
                                <div className="space-y-1">
                                  <div>
                                    <p className="text-muted-foreground text-xs">{t("topic.form.name")}</p>
                                    <p className="text-xs font-medium break-all">{topic.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs">{t("topic.form.topic")}</p>
                                    <p className="text-xs break-all">{topic.topic}</p>
                                  </div>
                                </div>
                              </HoverCardContent>
                            </HoverCard>

                            <div className="flex min-w-0 items-center justify-between gap-2">
                              <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden">
                                <Badge variant="outline">QoS {topic.qos}</Badge>
                                <Badge variant={topic.enabled ? "secondary" : "outline"}>
                                  {topic.enabled
                                    ? t("topic.panel.enabled")
                                    : t("topic.panel.disabled")}
                                </Badge>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                <Switch
                                  checked={topic.enabled}
                                  onCheckedChange={(checked) =>
                                    onToggleTopicEnabled(topic.id, checked)
                                  }
                                  aria-label={t("topic.panel.toggle", { topic: topic.topic })}
                                />
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => setEditingTopic(topic)}
                                >
                                  <Pencil />
                                  <span className="sr-only">{t("topic.panel.edit")}</span>
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="ghost"
                                  onClick={() => onDeleteTopic(topic.id)}
                                >
                                  <Trash2 />
                                  <span className="sr-only">{t("topic.panel.delete")}</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : null}

            {topics.length === 0 ? (
              <div className="text-muted-foreground border border-dashed p-3 text-xs">
                {selectedConnection
                  ? t("topic.panel.emptyWithConnection")
                  : t("topic.panel.emptyWithoutConnection")}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className={cn(FOOTER_CLASS, "flex items-center")}>
          <p
            className={cn(
              "truncate text-xs",
              isConnected ? "text-primary" : "text-muted-foreground"
            )}
          >
            {selectedConnection
              ? isConnected
                ? t("topic.panel.runtimeConnected")
                : t("topic.panel.runtimeDisconnected")
              : t("topic.panel.runtimeNone")}
          </p>
        </div>
      </div>

      <TopicFormDialog
        mode="create"
        open={isCreateOpen}
        initialValues={DEFAULT_TOPIC_FORM_VALUES}
        onOpenChange={setCreateOpen}
        onSubmit={(values) => {
          if (!selectedConnection) {
            return
          }

          onAddTopic(selectedConnection.id, values)
        }}
      />

      <TopicFormDialog
        mode="edit"
        open={Boolean(editingTopic)}
        initialValues={editingTopic ? buildTopicFormValues(editingTopic) : DEFAULT_TOPIC_FORM_VALUES}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTopic(null)
          }
        }}
        onSubmit={(values) => {
          if (!editingTopic) {
            return
          }

          onUpdateTopic(editingTopic.id, values)
        }}
      />
    </>
  )
}
