import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ChevronDown, ChevronRight, Copy, Eye, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useI18n } from "@/i18n/i18n-provider"
import type {
  ConnectionRuntimeState,
  MessageFilter,
  MessageRecord,
  MqttConnectionProfile,
  PublishFormValues,
  TopicSubscription,
} from "@/types/mqtt-console"

const PublishMessageSheet = lazy(async () => {
  const module = await import("./publish-message-sheet")
  return { default: module.PublishMessageSheet }
})

const MessageDetailSheet = lazy(async () => {
  const module = await import("./message-detail-sheet")
  return { default: module.MessageDetailSheet }
})

interface MessagePanelProps {
  selectedConnection: MqttConnectionProfile | null
  connectionState?: ConnectionRuntimeState
  topics: TopicSubscription[]
  messages: MessageRecord[]
  onPublishMessage: (connectionId: string, values: PublishFormValues) => Promise<void>
  onClearMessages: (connectionId: string) => void
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
}

function truncatePayload(payload: string, size = 120): string {
  if (payload.length <= size) {
    return payload
  }

  return `${payload.slice(0, size)}...`
}

const ALL_TOPICS_FILTER_VALUE = "__all_topics__"

export function MessagePanel({
  selectedConnection,
  connectionState,
  topics,
  messages,
  onPublishMessage,
  onClearMessages,
}: MessagePanelProps) {
  const { t } = useI18n()

  const [filter, setFilter] = useState<MessageFilter>("all")
  const [topicFilter, setTopicFilter] = useState<string>(ALL_TOPICS_FILTER_VALUE)
  const [payloadFilter, setPayloadFilter] = useState("")
  const [isPublishSheetOpen, setPublishSheetOpen] = useState(false)
  const [detailMessage, setDetailMessage] = useState<MessageRecord | null>(null)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const counts = useMemo(() => {
    let received = 0
    let sent = 0

    for (const message of messages) {
      if (message.direction === "received") {
        received += 1
      } else {
        sent += 1
      }
    }

    return {
      all: messages.length,
      received,
      sent,
    }
  }, [messages])

  const topicOptions = useMemo(() => {
    const topicSet = new Set<string>()
    topics.forEach((topic) => topicSet.add(topic.topic))
    messages.forEach((message) => topicSet.add(message.topic))
    return Array.from(topicSet).sort((a, b) => a.localeCompare(b))
  }, [messages, topics])

  useEffect(() => {
    if (topicFilter === ALL_TOPICS_FILTER_VALUE) {
      return
    }

    if (!topicOptions.includes(topicFilter)) {
      setTopicFilter(ALL_TOPICS_FILTER_VALUE)
    }
  }, [topicFilter, topicOptions])

  const filteredMessages = useMemo(() => {
    const keyword = payloadFilter.trim().toLowerCase()

    return messages.filter((message) => {
      if (filter !== "all" && message.direction !== filter) {
        return false
      }

      if (topicFilter !== ALL_TOPICS_FILTER_VALUE && message.topic !== topicFilter) {
        return false
      }

      if (keyword && !message.payload.toLowerCase().includes(keyword)) {
        return false
      }

      return true
    })
  }, [filter, messages, payloadFilter, topicFilter])

  const rowVirtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => filteredMessages[index]?.id ?? index,
    estimateSize: () => 86,
    overscan: 10,
  })

  const connected = connectionState?.status === "connected"

  const connectionStatusText = useMemo(() => {
    if (!selectedConnection) {
      return t("message.panel.connectionHint")
    }

    return t("message.panel.connectionStatus", {
      name: selectedConnection.name,
      status: connected ? t("common.connected") : t("common.disconnected"),
    })
  }, [connected, selectedConnection, t])

  const handleCopyPayload = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload)
      toast.success(t("toast.payloadCopied"))
    } catch {
      toast.error(t("toast.clipboardFailed"))
    }
  }

  const toggleExpanded = useCallback((messageId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }, [])

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-12 items-center justify-between border-b px-3">
          <h2 className="text-sm font-semibold">{t("message.panel.title")}</h2>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedConnection}
              onClick={() => setPublishSheetOpen(true)}
            >
              <Send />
              {t("message.panel.send")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedConnection || messages.length === 0}
              onClick={() => {
                if (!selectedConnection) {
                  return
                }

                onClearMessages(selectedConnection.id)
                toast.success(t("toast.messagesCleared"))
              }}
            >
              <Trash2 />
              {t("common.clear")}
            </Button>
          </div>
        </div>

        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as MessageFilter)}
          className="min-h-0 flex-1"
        >
          <div className="border-b px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="all">
                  {t("message.filter.all")} ({counts.all})
                </TabsTrigger>
                <TabsTrigger value="received">
                  {t("message.filter.received")} ({counts.received})
                </TabsTrigger>
                <TabsTrigger value="sent">
                  {t("message.filter.sent")} ({counts.sent})
                </TabsTrigger>
              </TabsList>
              <p className="text-muted-foreground text-xs">{connectionStatusText}</p>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[220px_minmax(0,1fr)]">
              <Select value={topicFilter} onValueChange={setTopicFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("message.filter.topic")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TOPICS_FILTER_VALUE}>
                    {t("message.filter.topicAll")}
                  </SelectItem>
                  {topicOptions.map((topicOption) => (
                    <SelectItem key={topicOption} value={topicOption}>
                      {topicOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={payloadFilter}
                onChange={(event) => setPayloadFilter(event.target.value)}
                placeholder={t("message.filter.payloadPlaceholder")}
              />
            </div>
          </div>

          <TabsContent value={filter} className="min-h-0 flex-1">
            {filteredMessages.length === 0 ? (
              <div className="p-3">
                <div className="text-muted-foreground border border-dashed p-3 text-xs">
                  {t("message.panel.noFilterData")}
                </div>
              </div>
            ) : (
              <div ref={scrollRef} className="h-full overflow-auto">
                <div
                  className="relative"
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const message = filteredMessages[virtualRow.index]
                    const isExpanded = Boolean(expandedRows[message.id])

                    return (
                      <div
                        key={message.id}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className="absolute top-0 left-0 w-full px-3"
                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <div className="mb-2 border p-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
                                <Badge
                                  variant={
                                    message.direction === "received"
                                      ? "secondary"
                                      : "default"
                                  }
                                >
                                  {message.direction === "received"
                                    ? t("message.filter.received")
                                    : t("message.filter.sent")}
                                </Badge>
                                <Badge variant="outline">QoS {message.qos}</Badge>
                                <span className="text-muted-foreground shrink-0 text-xs">
                                  {formatDateTime(message.createdAt)}
                                </span>
                                <span className="truncate text-xs font-medium">
                                  {message.topic}
                                </span>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => toggleExpanded(message.id)}
                              >
                                {isExpanded ? <ChevronDown /> : <ChevronRight />}
                                <span className="sr-only">
                                  {isExpanded
                                    ? t("message.panel.collapse")
                                    : t("message.panel.expand")}
                                </span>
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => handleCopyPayload(message.payload)}
                              >
                                <Copy />
                                <span className="sr-only">{t("message.panel.copyPayload")}</span>
                              </Button>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => setDetailMessage(message)}
                              >
                                <Eye />
                                <span className="sr-only">{t("message.panel.viewDetail")}</span>
                              </Button>
                            </div>
                          </div>

                          <p className="text-muted-foreground mt-2 text-xs break-words">
                            {truncatePayload(message.payload)}
                          </p>

                          {isExpanded ? (
                            <pre className="mt-3 border p-2 text-xs whitespace-pre-wrap break-words">
                              {message.payload}
                            </pre>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Suspense fallback={null}>
        <PublishMessageSheet
          open={isPublishSheetOpen}
          selectedConnection={selectedConnection}
          connectionState={connectionState}
          topics={topics}
          onOpenChange={setPublishSheetOpen}
          onPublishMessage={onPublishMessage}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MessageDetailSheet
          open={Boolean(detailMessage)}
          message={detailMessage}
          onOpenChange={(open) => {
            if (!open) {
              setDetailMessage(null)
            }
          }}
        />
      </Suspense>
    </>
  )
}
