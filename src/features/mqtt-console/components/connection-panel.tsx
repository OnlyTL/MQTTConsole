import { useMemo, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plug,
  Plus,
  Power,
  Server,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DEFAULT_CONNECTION_FORM_VALUES } from "@/hooks/use-mqtt-console"
import { useI18n } from "@/i18n/i18n-provider"
import { cn } from "@/lib/utils"
import type {
  ConnectionFormValues,
  ConnectionRuntimeState,
  MqttConnectionProfile,
} from "@/types/mqtt-console"
import { ConnectionFormDialog } from "./connection-form-dialog"

interface ConnectionPanelProps {
  isCollapsed: boolean
  allowCollapse?: boolean
  selectedConnectionId: string | null
  connections: MqttConnectionProfile[]
  connectionStateMap: Record<string, ConnectionRuntimeState>
  onToggleCollapsed: () => void
  onSelectConnection: (connectionId: string) => void
  onAddConnection: (values: ConnectionFormValues) => void
  onUpdateConnection: (connectionId: string, values: ConnectionFormValues) => void
  onDeleteConnection: (connectionId: string) => void
  onConnectConnection: (connectionId: string) => void
  onDisconnectConnection: (connectionId: string) => void
}

const HEADER_CLASS = "flex h-12 items-center justify-between border-b px-3"
const FOOTER_CLASS = "h-12 border-t px-3"
const ITEM_HEIGHT_CLASS = "min-h-[78px]"

function buildEditValues(connection: MqttConnectionProfile): ConnectionFormValues {
  return {
    name: connection.name,
    brokerUrl: connection.brokerUrl,
    clientId: connection.clientId,
    username: connection.username,
    password: connection.password,
    keepAlive: connection.keepAlive,
    clean: connection.clean,
    connectTimeout: connection.connectTimeout,
    reconnectPeriod: connection.reconnectPeriod,
  }
}

export function ConnectionPanel({
  isCollapsed,
  allowCollapse = true,
  selectedConnectionId,
  connections,
  connectionStateMap,
  onToggleCollapsed,
  onSelectConnection,
  onAddConnection,
  onUpdateConnection,
  onDeleteConnection,
  onConnectConnection,
  onDisconnectConnection,
}: ConnectionPanelProps) {
  const { t } = useI18n()
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editingConnection, setEditingConnection] =
    useState<MqttConnectionProfile | null>(null)

  const selectedConnection = useMemo(
    () =>
      selectedConnectionId
        ? connections.find((connection) => connection.id === selectedConnectionId) ?? null
        : null,
    [connections, selectedConnectionId]
  )

  const statusLabelMap: Record<ConnectionRuntimeState["status"], string> = {
    connected: t("common.connected"),
    connecting: t("common.connecting"),
    disconnected: t("common.disconnected"),
    error: t("common.error"),
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div
          className={cn(
            HEADER_CLASS,
            isCollapsed ? "justify-center px-2" : undefined
          )}
        >
          {isCollapsed ? null : (
            <h2 className="text-sm font-semibold">{t("connection.panel.title")}</h2>
          )}

          <div className={cn("flex items-center gap-1", isCollapsed ? "w-full justify-center" : undefined)}>
            {isCollapsed ? null : (
              <Button size="icon-sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus />
                <span className="sr-only">{t("connection.panel.add")}</span>
              </Button>
            )}

            {allowCollapse ? (
              <Button size="icon-sm" variant="ghost" onClick={onToggleCollapsed}>
                {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
                <span className="sr-only">{t("connection.panel.toggle")}</span>
              </Button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-2">
            {connections.map((connection) => {
              const state = connectionStateMap[connection.id] ?? { status: "disconnected" }
              const isActive = selectedConnectionId === connection.id
              const isConnected = state.status === "connected"
              const statusColorClass =
                state.status === "connected"
                  ? "text-primary"
                  : state.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"

              const content = (
                <div
                  key={connection.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConnection(connection.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onSelectConnection(connection.id)
                    }
                  }}
                  className={cn(
                    "group w-full cursor-pointer border p-2.5 text-left transition-colors focus-visible:ring-1 focus-visible:ring-ring",
                    isCollapsed && "flex items-center justify-center p-0 size-10",
                    !isCollapsed && ITEM_HEIGHT_CLASS,
                    isActive ? "border-primary bg-primary/5" : "hover:bg-muted"
                  )}
                >
                  {isCollapsed ? (
                    <Server className={cn("size-4", statusColorClass)} />
                  ) : (
                    <div className="flex h-full min-w-0 flex-col justify-between gap-2 overflow-hidden">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{connection.name}</p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {connection.brokerUrl}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-[11px]", statusColorClass)}>
                          {statusLabelMap[state.status]}
                        </p>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-xs"
                            variant={isConnected ? "secondary" : "default"}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (isConnected) {
                                onDisconnectConnection(connection.id)
                              } else {
                                onConnectConnection(connection.id)
                              }
                            }}
                          >
                            {isConnected ? <Power /> : <Plug />}
                            <span className="sr-only">{t("connection.panel.toggleState")}</span>
                          </Button>

                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditingConnection(connection)
                            }}
                          >
                            <Pencil />
                            <span className="sr-only">{t("connection.panel.edit")}</span>
                          </Button>

                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDeleteConnection(connection.id)
                            }}
                          >
                            <Trash2 />
                            <span className="sr-only">{t("connection.panel.delete")}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )

              if (!isCollapsed) {
                return content
              }

              return (
                <Tooltip key={connection.id}>
                  <TooltipTrigger asChild>{content}</TooltipTrigger>
                  <TooltipContent side="right">{connection.name}</TooltipContent>
                </Tooltip>
              )
            })}

            {connections.length === 0 ? (
              <div className="text-muted-foreground border border-dashed p-3 text-xs">
                {t("connection.panel.empty")}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className={cn(FOOTER_CLASS, "flex items-center")}>
          {selectedConnection ? (
            <p className="text-muted-foreground truncate text-xs">
              {isCollapsed
                ? selectedConnection.name
                : t("connection.panel.selected", { name: selectedConnection.name })}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">{t("connection.panel.none")}</p>
          )}
        </div>
      </div>

      <ConnectionFormDialog
        mode="create"
        open={isCreateOpen}
        initialValues={DEFAULT_CONNECTION_FORM_VALUES}
        onOpenChange={setCreateOpen}
        onSubmit={onAddConnection}
      />

      <ConnectionFormDialog
        mode="edit"
        open={Boolean(editingConnection)}
        initialValues={editingConnection ? buildEditValues(editingConnection) : DEFAULT_CONNECTION_FORM_VALUES}
        onOpenChange={(open) => {
          if (!open) {
            setEditingConnection(null)
          }
        }}
        onSubmit={(values) => {
          if (!editingConnection) {
            return
          }

          onUpdateConnection(editingConnection.id, values)
        }}
      />
    </>
  )
}
