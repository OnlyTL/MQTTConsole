import { useState } from "react"
import { Activity, CloudCog, CloudOff, Cloudy } from "lucide-react"

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocalStorageState } from "@/hooks/use-local-storage-state"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMqttConsole } from "@/hooks/use-mqtt-console"
import { useI18n } from "@/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import { ConnectionPanel } from "./components/connection-panel"
import { MessagePanel } from "./components/message-panel"
import { SyncSettingsDialog } from "./components/sync-settings-dialog"
import { TopicPanel } from "./components/topic-panel"

type MobilePanel = "connections" | "topics" | "messages"

export function MqttConsolePage() {
  const { locale, setLocale, t } = useI18n()
  const isMobile = useIsMobile()
  const [isConnectionPanelCollapsed, setConnectionPanelCollapsed] =
    useLocalStorageState<boolean>("mqtt-console:connection-panel-collapsed", false)
  const [mobilePanel, setMobilePanel] = useLocalStorageState<MobilePanel>(
    "mqtt-console:mobile-panel",
    "messages"
  )
  const [isSyncDialogOpen, setSyncDialogOpen] = useState(false)

  const {
    connections,
    selectedConnection,
    selectedConnectionId,
    topicsForSelectedConnection,
    messagesForSelectedConnection,
    connectionStateMap,
    setSelectedConnectionId,
    connectConnection,
    disconnectConnection,
    addConnection,
    updateConnection,
    deleteConnection,
    addTopic,
    updateTopic,
    deleteTopic,
    toggleTopicEnabled,
    publishMessage,
    clearMessages,
    syncSettings,
    syncState,
    updateSyncSettings,
    syncNow,
    pullFromGithub,
    pushToGithub,
  } = useMqttConsole()

  const selectedConnectionState = selectedConnectionId
    ? connectionStateMap[selectedConnectionId]
    : undefined

  return (
    <div className="relative h-full overflow-hidden bg-[radial-gradient(circle_at_top_left,oklch(0.97_0.04_170)_0%,oklch(0.99_0_0)_30%,oklch(0.96_0.02_210)_100%)] dark:bg-[radial-gradient(circle_at_top_left,oklch(0.28_0.04_170)_0%,oklch(0.2_0_0)_35%,oklch(0.23_0.02_230)_100%)]">
      <div
        className={cn(
          "flex h-full min-h-0 flex-col p-2 md:p-3",
          isMobile && "pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
        )}
      >
        <header className="mb-2 flex items-center justify-between border bg-background/80 px-3 py-2 backdrop-blur">
          <div>
            <h1 className="text-sm font-semibold">{t("app.title")}</h1>
            <p className="text-muted-foreground hidden text-xs md:block">
              {t("app.subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-1.5 md:gap-2">
            <div className="text-muted-foreground hidden items-center gap-1 text-xs md:flex">
              <Activity className="size-3.5" />
              {t("app.connectionsCount", { count: connections.length })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncDialogOpen(true)}
            >
              {syncSettings.enabled ? (
                syncState.phase === "error" ? (
                  <CloudOff />
                ) : (
                  <Cloudy />
                )
              ) : (
                <CloudCog />
              )}
              {t("sync.entry")}
            </Button>
            <Select
              value={locale}
              onValueChange={(value) => setLocale(value as "zh-CN" | "en-US")}
            >
              <SelectTrigger size="sm" className="w-24 sm:w-28">
                <SelectValue placeholder={t("app.language")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">{t("app.language.zhCN")}</SelectItem>
                <SelectItem value="en-US">{t("app.language.enUS")}</SelectItem>
              </SelectContent>
            </Select>
            <AnimatedThemeToggler
              className={cn(
                "cursor-pointer [&>svg]:size-5"
              )}
            />
          </div>
        </header>

        {isMobile ? (
          <Tabs
            value={mobilePanel}
            onValueChange={(value) => setMobilePanel(value as MobilePanel)}
            className="min-h-0 flex-1 gap-0"
          >
            <div className="min-h-0 flex-1 overflow-hidden border bg-background/85 backdrop-blur">
              <TabsContent value="connections" className="mt-0 h-full">
                <ConnectionPanel
                  isCollapsed={false}
                  allowCollapse={false}
                  selectedConnectionId={selectedConnectionId}
                  connections={connections}
                  connectionStateMap={connectionStateMap}
                  onToggleCollapsed={() =>
                    setConnectionPanelCollapsed((prevCollapsed) => !prevCollapsed)
                  }
                  onSelectConnection={setSelectedConnectionId}
                  onAddConnection={addConnection}
                  onUpdateConnection={updateConnection}
                  onDeleteConnection={deleteConnection}
                  onConnectConnection={connectConnection}
                  onDisconnectConnection={disconnectConnection}
                />
              </TabsContent>

              <TabsContent value="topics" className="mt-0 h-full">
                <TopicPanel
                  selectedConnection={selectedConnection}
                  topics={topicsForSelectedConnection}
                  connectionState={selectedConnectionState}
                  onAddTopic={addTopic}
                  onUpdateTopic={updateTopic}
                  onDeleteTopic={deleteTopic}
                  onToggleTopicEnabled={toggleTopicEnabled}
                />
              </TabsContent>

              <TabsContent value="messages" className="mt-0 h-full">
                <MessagePanel
                  selectedConnection={selectedConnection}
                  connectionState={selectedConnectionState}
                  topics={topicsForSelectedConnection}
                  messages={messagesForSelectedConnection}
                  onPublishMessage={publishMessage}
                  onClearMessages={clearMessages}
                />
              </TabsContent>
            </div>

            <div className="border-x border-b bg-background/90 px-2 py-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="connections">
                  {t("connection.panel.title")}
                </TabsTrigger>
                <TabsTrigger value="topics">
                  {t("topic.panel.title")}
                </TabsTrigger>
                <TabsTrigger value="messages">
                  {t("message.panel.title")}
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden border bg-background/85 backdrop-blur lg:flex-row">
            <aside
              className={cn(
                "min-h-0 shrink-0 border-b lg:border-r lg:border-b-0",
                isConnectionPanelCollapsed ? "lg:w-16" : "lg:w-72"
              )}
            >
              <ConnectionPanel
                isCollapsed={isConnectionPanelCollapsed}
                selectedConnectionId={selectedConnectionId}
                connections={connections}
                connectionStateMap={connectionStateMap}
                onToggleCollapsed={() =>
                  setConnectionPanelCollapsed((prevCollapsed) => !prevCollapsed)
                }
                onSelectConnection={setSelectedConnectionId}
                onAddConnection={addConnection}
                onUpdateConnection={updateConnection}
                onDeleteConnection={deleteConnection}
                onConnectConnection={connectConnection}
                onDisconnectConnection={disconnectConnection}
              />
            </aside>

            <aside className="min-h-0 shrink-0 border-b lg:w-72 lg:border-r lg:border-b-0">
              <TopicPanel
                selectedConnection={selectedConnection}
                topics={topicsForSelectedConnection}
                connectionState={selectedConnectionState}
                onAddTopic={addTopic}
                onUpdateTopic={updateTopic}
                onDeleteTopic={deleteTopic}
                onToggleTopicEnabled={toggleTopicEnabled}
              />
            </aside>

            <section className="min-h-0 flex-1">
              <MessagePanel
                selectedConnection={selectedConnection}
                connectionState={selectedConnectionState}
                topics={topicsForSelectedConnection}
                messages={messagesForSelectedConnection}
                onPublishMessage={publishMessage}
                onClearMessages={clearMessages}
              />
            </section>
          </div>
        )}
      </div>

      <SyncSettingsDialog
        open={isSyncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        settings={syncSettings}
        syncState={syncState}
        onSave={updateSyncSettings}
        onSyncNow={syncNow}
        onPull={() => pullFromGithub(true)}
        onPush={() => pushToGithub(true)}
      />
    </div>
  )
}
