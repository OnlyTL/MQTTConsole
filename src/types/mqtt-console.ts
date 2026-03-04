export type MqttQoS = 0 | 1 | 2

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

export type MessageDirection = "received" | "sent"

export type MessageFilter = "all" | MessageDirection

export type MessagePayloadView = "text" | "json"

export interface MqttConnectionProfile {
  id: string
  name: string
  brokerUrl: string
  clientId: string
  username: string
  password: string
  keepAlive: number
  clean: boolean
  connectTimeout: number
  reconnectPeriod: number
  createdAt: string
  updatedAt: string
}

export interface TopicSubscription {
  id: string
  connectionId: string
  name: string
  group: string
  topic: string
  qos: MqttQoS
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface MessageRecord {
  id: string
  connectionId: string
  topic: string
  payload: string
  qos: MqttQoS
  retain: boolean
  direction: MessageDirection
  createdAt: string
}

export interface ConnectionRuntimeState {
  status: ConnectionStatus
  errorMessage?: string
  lastConnectedAt?: string
}

export interface ConnectionFormValues {
  name: string
  brokerUrl: string
  clientId: string
  username: string
  password: string
  keepAlive: number
  clean: boolean
  connectTimeout: number
  reconnectPeriod: number
}

export interface TopicFormValues {
  name: string
  group: string
  topic: string
  qos: MqttQoS
  enabled: boolean
}

export interface PublishFormValues {
  topic: string
  payload: string
  qos: MqttQoS
  retain: boolean
}

export interface SyncTombstones {
  connections: Record<string, string>
  topics: Record<string, string>
  messages: Record<string, string>
}

export interface GithubSyncSettings {
  enabled: boolean
  autoSync: boolean
  syncMessages: boolean
  token: string
  gistId: string
  passphrase: string
  pullIntervalSeconds: number
}

export type GithubSyncPhase = "idle" | "pulling" | "pushing" | "syncing" | "error"

export interface GithubSyncState {
  phase: GithubSyncPhase
  lastSyncedAt?: string
  lastError?: string
}
