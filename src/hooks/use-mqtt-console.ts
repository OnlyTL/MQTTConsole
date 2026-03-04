import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import CryptoJS from "crypto-js"
import { gcm } from "@noble/ciphers/aes"
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js"
import { sha256 } from "@noble/hashes/sha2.js"
import type { IClientOptions, IClientPublishOptions, MqttClient } from "mqtt"
import { toast } from "sonner"

import { useLocalStorageState } from "@/hooks/use-local-storage-state"
import { useI18n } from "@/i18n/i18n-provider"
import type {
  ConnectionFormValues,
  ConnectionRuntimeState,
  GithubSyncSettings,
  GithubSyncState,
  MessageRecord,
  MqttConnectionProfile,
  PublishFormValues,
  SyncTombstones,
  TopicFormValues,
  TopicSubscription,
} from "@/types/mqtt-console"

const STORAGE_KEYS = {
  connections: "mqtt-console:connections",
  topics: "mqtt-console:topics",
  messages: "mqtt-console:messages",
  selectedConnectionId: "mqtt-console:selected-connection-id",
  syncSettings: "mqtt-console:sync-settings",
  syncTombstones: "mqtt-console:sync-tombstones",
  syncDeviceId: "mqtt-console:sync-device-id",
} as const

const MAX_MESSAGE_COUNT = 1000
const SYNC_FILE_NAME = "mqtt-console.sync.v1.json"
const GITHUB_API_BASE_URL = "https://api.github.com"
const SYNC_SCHEMA_VERSION = 1
const SYNC_PUSH_DEBOUNCE_MS = 2500
const MIN_PULL_INTERVAL_SECONDS = 30
const DEFAULT_PULL_INTERVAL_SECONDS = 90
const PBKDF2_ITERATIONS = 250_000
const WEB_CRYPTO_UNAVAILABLE_ERROR_CODE = "sync:web-crypto-unavailable"

const EMPTY_TOMBSTONES: SyncTombstones = {
  connections: {},
  topics: {},
  messages: {},
}

const DEFAULT_SYNC_SETTINGS: GithubSyncSettings = {
  enabled: false,
  autoSync: true,
  syncMessages: false,
  token: "",
  gistId: "",
  passphrase: "",
  pullIntervalSeconds: DEFAULT_PULL_INTERVAL_SECONDS,
}

export const DEFAULT_CONNECTION_FORM_VALUES: ConnectionFormValues = {
  name: "Local Broker",
  brokerUrl: "ws://broker.emqx.io:8083/mqtt",
  clientId: `mqtt-console-${Math.random().toString(16).slice(2, 10)}`,
  username: "",
  password: "",
  keepAlive: 60,
  clean: true,
  connectTimeout: 30_000,
  reconnectPeriod: 2_000,
}

export const DEFAULT_TOPIC_FORM_VALUES: TopicFormValues = {
  name: "Demo Topic",
  group: "",
  topic: "demo/topic",
  qos: 0,
  enabled: true,
}

export const DEFAULT_PUBLISH_FORM_VALUES: PublishFormValues = {
  topic: "",
  payload: "",
  qos: 0,
  retain: false,
}

function nowIsoString(): string {
  return new Date().toISOString()
}

function normalizeConnectionValues(values: ConnectionFormValues): ConnectionFormValues {
  return {
    ...values,
    name: values.name.trim(),
    brokerUrl: values.brokerUrl.trim(),
    clientId: values.clientId.trim(),
    username: values.username.trim(),
    password: values.password,
    keepAlive: Number(values.keepAlive),
    connectTimeout: Number(values.connectTimeout),
    reconnectPeriod: Number(values.reconnectPeriod),
  }
}

function normalizeTopicValues(values: TopicFormValues): TopicFormValues {
  return {
    ...values,
    name: values.name.trim(),
    group: values.group.trim(),
    topic: values.topic.trim(),
  }
}

function decodePayload(payload: Uint8Array): string {
  return new TextDecoder().decode(payload)
}

function generateId(): string {
  const cryptoApi =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  // RFC4122 v4 layout
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

interface SyncSnapshot {
  schemaVersion: number
  updatedAt: string
  deviceId: string
  connections: MqttConnectionProfile[]
  topics: TopicSubscription[]
  messages: MessageRecord[]
  tombstones: SyncTombstones
}

interface EncryptedSyncPayload {
  version: 1
  algorithm: "AES-GCM" | "AES-CBC"
  kdf: "PBKDF2-SHA256"
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

interface RemoteSyncDocument {
  schemaVersion: number
  encrypted: boolean
  data: EncryptedSyncPayload
}

interface GithubGistFile {
  filename?: string
  content?: string | null
}

interface GithubGistResponse {
  id: string
  files?: Record<string, GithubGistFile>
}

function parseIsoTime(value: string | undefined): number {
  if (!value) {
    return 0
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function normalizeSyncTombstones(value: unknown): SyncTombstones {
  const source = value as Partial<SyncTombstones> | undefined
  return {
    connections:
      source?.connections && typeof source.connections === "object"
        ? source.connections
        : {},
    topics:
      source?.topics && typeof source.topics === "object"
        ? source.topics
        : {},
    messages:
      source?.messages && typeof source.messages === "object"
        ? source.messages
        : {},
  }
}

function clampPullInterval(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_PULL_INTERVAL_SECONDS
  }

  return Math.max(MIN_PULL_INTERVAL_SECONDS, Math.floor(seconds))
}

function mergeTimestampMap(
  localMap: Record<string, string>,
  remoteMap: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...localMap }

  Object.entries(remoteMap).forEach(([id, deletedAt]) => {
    const localDeletedAt = merged[id]
    if (!localDeletedAt || parseIsoTime(deletedAt) >= parseIsoTime(localDeletedAt)) {
      merged[id] = deletedAt
    }
  })

  return merged
}

function mergeByLatest<T>(
  localItems: T[],
  remoteItems: T[],
  getId: (item: T) => string,
  getUpdatedAt: (item: T) => string
): T[] {
  const merged = new Map<string, T>()

  localItems.forEach((item) => {
    merged.set(getId(item), item)
  })

  remoteItems.forEach((item) => {
    const id = getId(item)
    const existing = merged.get(id)
    if (!existing) {
      merged.set(id, item)
      return
    }

    if (parseIsoTime(getUpdatedAt(item)) >= parseIsoTime(getUpdatedAt(existing))) {
      merged.set(id, item)
    }
  })

  return Array.from(merged.values())
}

function applyTombstones<T>(
  items: T[],
  tombstones: Record<string, string>,
  getId: (item: T) => string,
  getUpdatedAt: (item: T) => string
): T[] {
  return items.filter((item) => {
    const deletedAt = tombstones[getId(item)]
    if (!deletedAt) {
      return true
    }

    return parseIsoTime(getUpdatedAt(item)) > parseIsoTime(deletedAt)
  })
}

function sortMessages(messages: MessageRecord[]): MessageRecord[] {
  return [...messages]
    .sort((a, b) => parseIsoTime(b.createdAt) - parseIsoTime(a.createdAt))
    .slice(0, MAX_MESSAGE_COUNT)
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function getCryptoApi(): Crypto | undefined {
  return typeof globalThis !== "undefined"
    ? (globalThis as { crypto?: Crypto }).crypto
    : undefined
}

function randomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  const cryptoApi = getCryptoApi()

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes)
    return bytes
  }

  for (let index = 0; index < size; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256)
  }

  return bytes
}

function bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const words: number[] = []
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >>> 2] |= bytes[index] << (24 - (index % 4) * 8)
  }

  return CryptoJS.lib.WordArray.create(words, bytes.length)
}

function deriveCryptoJsKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passphrase, bytesToWordArray(salt), {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  })
}

async function deriveAesKeyBytes(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  return pbkdf2Async(
    sha256,
    new TextEncoder().encode(passphrase),
    salt,
    {
      c: iterations,
      dkLen: 32,
      asyncTick: 10,
    }
  )
}

async function encryptSnapshot(
  snapshot: SyncSnapshot,
  passphrase: string
): Promise<EncryptedSyncPayload> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveAesKeyBytes(passphrase, salt, PBKDF2_ITERATIONS)
  const encoded = new TextEncoder().encode(JSON.stringify(snapshot))
  const ciphertext = gcm(key, iv).encrypt(encoded)

  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
  }
}

async function decryptSnapshot(
  encryptedPayload: EncryptedSyncPayload,
  passphrase: string
): Promise<SyncSnapshot> {
  const salt = decodeBase64(encryptedPayload.salt)
  const iv = decodeBase64(encryptedPayload.iv)
  const ciphertext = decodeBase64(encryptedPayload.ciphertext)
  const iterations = encryptedPayload.iterations || PBKDF2_ITERATIONS

  let plainText = ""
  if (encryptedPayload.algorithm === "AES-GCM") {
    const key = await deriveAesKeyBytes(passphrase, salt, iterations)
    const plainBytes = gcm(key, iv).decrypt(ciphertext)
    plainText = new TextDecoder().decode(plainBytes)
  } else if (encryptedPayload.algorithm === "AES-CBC") {
    const key = deriveCryptoJsKey(passphrase, salt, iterations)
    const decrypted = CryptoJS.AES.decrypt(
      {
        ciphertext: bytesToWordArray(ciphertext),
      } as CryptoJS.lib.CipherParams,
      key,
      {
        iv: bytesToWordArray(iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    )
    plainText = CryptoJS.enc.Utf8.stringify(decrypted)
  } else {
    throw new Error("Unsupported encryption algorithm")
  }

  if (!plainText) {
    throw new Error("Unable to decrypt payload")
  }

  const parsed = JSON.parse(plainText) as SyncSnapshot

  return {
    schemaVersion: parsed.schemaVersion ?? SYNC_SCHEMA_VERSION,
    updatedAt: parsed.updatedAt ?? nowIsoString(),
    deviceId: parsed.deviceId ?? "",
    connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    tombstones: normalizeSyncTombstones(parsed.tombstones),
  }
}

async function serializeRemoteSyncDocument(
  snapshot: SyncSnapshot,
  passphrase: string
): Promise<string> {
  const encryptedPayload = await encryptSnapshot(snapshot, passphrase)
  const document: RemoteSyncDocument = {
    schemaVersion: SYNC_SCHEMA_VERSION,
    encrypted: true,
    data: encryptedPayload,
  }

  return JSON.stringify(document, null, 2)
}

async function deserializeRemoteSyncDocument(
  content: string,
  passphrase: string
): Promise<SyncSnapshot> {
  const parsed = JSON.parse(content) as Partial<RemoteSyncDocument> & Partial<SyncSnapshot>

  if (parsed.encrypted && parsed.data) {
    return decryptSnapshot(parsed.data, passphrase)
  }

  // Backward compatibility for older plaintext sync documents.
  return {
    schemaVersion: parsed.schemaVersion ?? SYNC_SCHEMA_VERSION,
    updatedAt: parsed.updatedAt ?? nowIsoString(),
    deviceId: parsed.deviceId ?? "",
    connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    tombstones: normalizeSyncTombstones(parsed.tombstones),
  }
}

async function githubRequest<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as T
}

export function useMqttConsole() {
  const { t } = useI18n()
  const [connections, setConnections] = useLocalStorageState<MqttConnectionProfile[]>(
    STORAGE_KEYS.connections,
    []
  )
  const [topics, setTopics] = useLocalStorageState<TopicSubscription[]>(
    STORAGE_KEYS.topics,
    []
  )
  const [messages, setMessages] = useLocalStorageState<MessageRecord[]>(
    STORAGE_KEYS.messages,
    []
  )
  const [selectedConnectionId, setSelectedConnectionId] =
    useLocalStorageState<string | null>(STORAGE_KEYS.selectedConnectionId, null)
  const [syncSettings, setSyncSettings] = useLocalStorageState<GithubSyncSettings>(
    STORAGE_KEYS.syncSettings,
    DEFAULT_SYNC_SETTINGS
  )
  const [syncTombstones, setSyncTombstones] = useLocalStorageState<SyncTombstones>(
    STORAGE_KEYS.syncTombstones,
    EMPTY_TOMBSTONES
  )
  const [syncDeviceId] = useLocalStorageState<string>(
    STORAGE_KEYS.syncDeviceId,
    () => generateId()
  )

  const [runtimeStates, setRuntimeStates] = useState<
    Record<string, ConnectionRuntimeState>
  >({})
  const [syncState, setSyncState] = useState<GithubSyncState>({ phase: "idle" })

  const connectionsRef = useRef(connections)
  const topicsRef = useRef(topics)
  const messagesRef = useRef(messages)
  const syncTombstonesRef = useRef(syncTombstones)
  const syncSettingsRef = useRef(syncSettings)
  const clientsRef = useRef<Record<string, MqttClient>>({})
  const mqttModuleRef = useRef<typeof import("mqtt") | null>(null)
  const isSyncingRef = useRef(false)
  const skipNextAutoPushRef = useRef(false)
  const hasBootstrappedSyncRef = useRef(false)

  useEffect(() => {
    connectionsRef.current = connections
  }, [connections])

  useEffect(() => {
    topicsRef.current = topics
  }, [topics])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    syncTombstonesRef.current = syncTombstones
  }, [syncTombstones])

  useEffect(() => {
    syncSettingsRef.current = syncSettings
  }, [syncSettings])

  useEffect(() => {
    setSyncSettings((prev) => {
      const normalized: GithubSyncSettings = {
        enabled: Boolean(prev.enabled),
        autoSync: prev.autoSync !== false,
        syncMessages: Boolean(prev.syncMessages),
        token: typeof prev.token === "string" ? prev.token : "",
        gistId: typeof prev.gistId === "string" ? prev.gistId : "",
        passphrase: typeof prev.passphrase === "string" ? prev.passphrase : "",
        pullIntervalSeconds: clampPullInterval(prev.pullIntervalSeconds),
      }

      return JSON.stringify(normalized) === JSON.stringify(prev) ? prev : normalized
    })
  }, [setSyncSettings])

  useEffect(() => {
    setSyncTombstones((prev) => {
      const normalized = normalizeSyncTombstones(prev)
      return JSON.stringify(normalized) === JSON.stringify(prev) ? prev : normalized
    })
  }, [setSyncTombstones])

  useEffect(() => {
    // Backward compatibility for older local data without topic name/group.
    setTopics((prev) => {
      let changed = false
      const next = prev.map((topic) => {
        const patch: Partial<TopicSubscription> = {}

        if (!topic.name || !topic.name.trim()) {
          changed = true
          patch.name = topic.topic
        }

        if (typeof topic.group !== "string") {
          changed = true
          patch.group = ""
        }

        if (Object.keys(patch).length > 0) {
          return { ...topic, ...patch }
        }

        return topic
      })

      return changed ? next : prev
    })
  }, [setTopics])

  useEffect(() => {
    if (!selectedConnectionId && connections.length > 0) {
      setSelectedConnectionId(connections[0].id)
      return
    }

    if (
      selectedConnectionId &&
      !connections.some((connection) => connection.id === selectedConnectionId)
    ) {
      setSelectedConnectionId(connections[0]?.id ?? null)
    }
  }, [connections, selectedConnectionId, setSelectedConnectionId])

  const setConnectionState = useCallback(
    (connectionId: string, state: ConnectionRuntimeState) => {
      setRuntimeStates((prev) => ({ ...prev, [connectionId]: state }))
    },
    []
  )

  const clearTombstones = useCallback(
    (collection: keyof SyncTombstones, ids: string[]) => {
      if (ids.length === 0) {
        return
      }

      setSyncTombstones((prev) => {
        const currentCollection = prev[collection]
        let changed = false
        const nextCollection = { ...currentCollection }

        ids.forEach((id) => {
          if (nextCollection[id]) {
            delete nextCollection[id]
            changed = true
          }
        })

        if (!changed) {
          return prev
        }

        return {
          ...prev,
          [collection]: nextCollection,
        }
      })
    },
    [setSyncTombstones]
  )

  const markDeleted = useCallback(
    (collection: keyof SyncTombstones, ids: string[]) => {
      if (ids.length === 0) {
        return
      }

      const deletedAt = nowIsoString()
      setSyncTombstones((prev) => {
        const nextCollection = { ...prev[collection] }
        ids.forEach((id) => {
          nextCollection[id] = deletedAt
        })

        return {
          ...prev,
          [collection]: nextCollection,
        }
      })
    },
    [setSyncTombstones]
  )

  const buildLocalSyncSnapshot = useCallback(
    (options?: { syncMessages?: boolean }): SyncSnapshot => {
      const includeMessages = options?.syncMessages ?? syncSettingsRef.current.syncMessages

      return {
        schemaVersion: SYNC_SCHEMA_VERSION,
        updatedAt: nowIsoString(),
        deviceId: syncDeviceId,
        connections: connectionsRef.current,
        topics: topicsRef.current,
        messages: includeMessages ? messagesRef.current : [],
        tombstones: {
          connections: syncTombstonesRef.current.connections,
          topics: syncTombstonesRef.current.topics,
          messages: includeMessages ? syncTombstonesRef.current.messages : {},
        },
      }
    },
    [syncDeviceId]
  )

  const applyRemoteSnapshot = useCallback(
    (remoteSnapshot: SyncSnapshot) => {
      const localConnections = connectionsRef.current
      const localTopics = topicsRef.current
      const localMessages = messagesRef.current
      const localTombstones = syncTombstonesRef.current
      const includeMessages = syncSettingsRef.current.syncMessages

      const mergedTombstones: SyncTombstones = {
        connections: mergeTimestampMap(
          localTombstones.connections,
          remoteSnapshot.tombstones.connections
        ),
        topics: mergeTimestampMap(localTombstones.topics, remoteSnapshot.tombstones.topics),
        messages: includeMessages
          ? mergeTimestampMap(localTombstones.messages, remoteSnapshot.tombstones.messages)
          : localTombstones.messages,
      }

      const mergedConnections = applyTombstones(
        mergeByLatest(
          localConnections,
          remoteSnapshot.connections,
          (connection) => connection.id,
          (connection) => connection.updatedAt
        ),
        mergedTombstones.connections,
        (connection) => connection.id,
        (connection) => connection.updatedAt
      )

      const connectionIdSet = new Set(mergedConnections.map((connection) => connection.id))
      const mergedTopics = applyTombstones(
        mergeByLatest(
          localTopics,
          remoteSnapshot.topics,
          (topic) => topic.id,
          (topic) => topic.updatedAt
        ),
        mergedTombstones.topics,
        (topic) => topic.id,
        (topic) => topic.updatedAt
      ).filter((topic) => connectionIdSet.has(topic.connectionId))

      const mergedMessages = includeMessages
        ? sortMessages(
            applyTombstones(
              mergeByLatest(
                localMessages,
                remoteSnapshot.messages,
                (message) => message.id,
                (message) => message.createdAt
              ),
              mergedTombstones.messages,
              (message) => message.id,
              (message) => message.createdAt
            ).filter((message) => connectionIdSet.has(message.connectionId))
          )
        : localMessages

      const changed =
        JSON.stringify(localConnections) !== JSON.stringify(mergedConnections) ||
        JSON.stringify(localTopics) !== JSON.stringify(mergedTopics) ||
        (includeMessages &&
          JSON.stringify(localMessages) !== JSON.stringify(mergedMessages)) ||
        JSON.stringify(localTombstones) !== JSON.stringify(mergedTombstones)

      if (!changed) {
        return false
      }

      skipNextAutoPushRef.current = true
      setConnections(mergedConnections)
      setTopics(mergedTopics)
      if (includeMessages) {
        setMessages(mergedMessages)
      }
      setSyncTombstones(mergedTombstones)
      return true
    },
    [setConnections, setMessages, setSyncTombstones, setTopics]
  )

  const appendMessage = useCallback(
    (message: MessageRecord) => {
      // Keep latest messages at the top and cap storage size for stability.
      setMessages((prev) => [message, ...prev].slice(0, MAX_MESSAGE_COUNT))
      clearTombstones("messages", [message.id])
    },
    [clearTombstones, setMessages]
  )

  const subscribeTopic = useCallback(
    (connectionId: string, topic: TopicSubscription) => {
      const client = clientsRef.current[connectionId]
      if (!client || !client.connected || !topic.enabled) {
        return
      }

      client.subscribe(topic.topic, { qos: topic.qos }, (error) => {
        if (error) {
          toast.error(
            t("mqtt.error.subscribeFailed", { topic: topic.topic, error: error.message })
          )
        }
      })
    },
    [t]
  )

  const unsubscribeTopic = useCallback(
    (connectionId: string, topicName: string) => {
      const client = clientsRef.current[connectionId]
      if (!client || !client.connected) {
        return
      }

      client.unsubscribe(topicName, (error) => {
        if (error) {
          toast.error(
            t("mqtt.error.unsubscribeFailed", { topic: topicName, error: error.message })
          )
        }
      })
    },
    [t]
  )

  const destroyClient = useCallback((connectionId: string) => {
    const client = clientsRef.current[connectionId]
    if (!client) {
      return
    }

    client.removeAllListeners()
    client.end(true)
    delete clientsRef.current[connectionId]
  }, [])

  const getMqttModule = useCallback(async () => {
    if (mqttModuleRef.current) {
      return mqttModuleRef.current
    }

    const module = await import("mqtt")
    mqttModuleRef.current = module
    return module
  }, [])

  const updateSyncSettings = useCallback(
    (nextSettings: GithubSyncSettings) => {
      const normalized: GithubSyncSettings = {
        enabled: Boolean(nextSettings.enabled),
        autoSync: nextSettings.autoSync !== false,
        syncMessages: Boolean(nextSettings.syncMessages),
        token: nextSettings.token.trim(),
        gistId: nextSettings.gistId.trim(),
        passphrase: nextSettings.passphrase,
        pullIntervalSeconds: clampPullInterval(nextSettings.pullIntervalSeconds),
      }
      setSyncSettings(normalized)
    },
    [setSyncSettings]
  )

  const pullFromGithub = useCallback(
    async (showToast = false): Promise<boolean> => {
      const settings = syncSettingsRef.current
      if (!settings.enabled) {
        return false
      }

      if (!settings.token.trim() || !settings.passphrase) {
        const message = t("sync.error.credentialsRequired")
        setSyncState((prev) => ({ ...prev, phase: "error", lastError: message }))
        if (showToast) {
          toast.error(message)
        }
        return false
      }

      if (!settings.gistId.trim()) {
        return true
      }

      if (isSyncingRef.current) {
        return false
      }

      isSyncingRef.current = true
      setSyncState((prev) => ({ ...prev, phase: "pulling", lastError: undefined }))

      try {
        const gist = await githubRequest<GithubGistResponse>(
          `/gists/${settings.gistId.trim()}`,
          settings.token.trim()
        )
        const files = gist.files ?? {}
        const preferredFile = files[SYNC_FILE_NAME]
        const firstFile = Object.values(files)[0]
        const content = preferredFile?.content ?? firstFile?.content

        if (!content) {
          setSyncState({ phase: "idle", lastSyncedAt: nowIsoString() })
          if (showToast) {
            toast.success(t("sync.toast.pullSuccess"))
          }
          return true
        }

        const remoteSnapshot = await deserializeRemoteSyncDocument(
          content,
          settings.passphrase
        )
        applyRemoteSnapshot(remoteSnapshot)

        setSyncState({ phase: "idle", lastSyncedAt: nowIsoString() })
        if (showToast) {
          toast.success(t("sync.toast.pullSuccess"))
        }
        return true
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : ""
        const message =
          rawMessage === WEB_CRYPTO_UNAVAILABLE_ERROR_CODE
            ? t("sync.error.webCryptoUnavailable")
            : rawMessage || t("sync.error.pullFailed")
        setSyncState((prev) => ({ ...prev, phase: "error", lastError: message }))
        if (showToast) {
          toast.error(t("sync.error.pullFailedWithDetail", { message }))
        }
        return false
      } finally {
        isSyncingRef.current = false
      }
    },
    [applyRemoteSnapshot, t]
  )

  const pushToGithub = useCallback(
    async (showToast = false): Promise<boolean> => {
      const settings = syncSettingsRef.current
      if (!settings.enabled) {
        return false
      }

      if (!settings.token.trim() || !settings.passphrase) {
        const message = t("sync.error.credentialsRequired")
        setSyncState((prev) => ({ ...prev, phase: "error", lastError: message }))
        if (showToast) {
          toast.error(message)
        }
        return false
      }

      if (isSyncingRef.current) {
        return false
      }

      isSyncingRef.current = true
      setSyncState((prev) => ({ ...prev, phase: "pushing", lastError: undefined }))

      try {
        const snapshot = buildLocalSyncSnapshot({ syncMessages: settings.syncMessages })
        const content = await serializeRemoteSyncDocument(snapshot, settings.passphrase)
        const token = settings.token.trim()
        let gistId = settings.gistId.trim()

        if (gistId) {
          await githubRequest<GithubGistResponse>(`/gists/${gistId}`, token, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              files: {
                [SYNC_FILE_NAME]: {
                  content,
                },
              },
            }),
          })
        } else {
          const created = await githubRequest<GithubGistResponse>("/gists", token, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              description: "MQTT Console Encrypted Sync Data",
              public: false,
              files: {
                [SYNC_FILE_NAME]: {
                  content,
                },
              },
            }),
          })

          gistId = created.id
          if (gistId) {
            setSyncSettings((prev) => ({ ...prev, gistId }))
          }
        }

        setSyncState({ phase: "idle", lastSyncedAt: nowIsoString() })
        if (showToast) {
          toast.success(t("sync.toast.pushSuccess"))
        }
        return true
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : ""
        const message =
          rawMessage === WEB_CRYPTO_UNAVAILABLE_ERROR_CODE
            ? t("sync.error.webCryptoUnavailable")
            : rawMessage || t("sync.error.pushFailed")
        setSyncState((prev) => ({ ...prev, phase: "error", lastError: message }))
        if (showToast) {
          toast.error(t("sync.error.pushFailedWithDetail", { message }))
        }
        return false
      } finally {
        isSyncingRef.current = false
      }
    },
    [buildLocalSyncSnapshot, setSyncSettings, t]
  )

  const syncNow = useCallback(async (): Promise<boolean> => {
    const settings = syncSettingsRef.current
    if (!settings.enabled) {
      const message = t("sync.error.enableRequired")
      setSyncState((prev) => ({ ...prev, phase: "error", lastError: message }))
      toast.error(message)
      return false
    }

    if (isSyncingRef.current) {
      return false
    }

    setSyncState((prev) => ({ ...prev, phase: "syncing", lastError: undefined }))

    try {
      const pullSuccess = await pullFromGithub(false)
      const pushSuccess = await pushToGithub(false)
      if (!pullSuccess && !pushSuccess) {
        return false
      }

      hasBootstrappedSyncRef.current = true
      setSyncState((prev) => ({
        ...prev,
        phase: "idle",
        lastSyncedAt: nowIsoString(),
      }))
      toast.success(t("sync.toast.syncSuccess"))
      return true
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : ""
      const message =
        rawMessage === WEB_CRYPTO_UNAVAILABLE_ERROR_CODE
          ? t("sync.error.webCryptoUnavailable")
          : rawMessage || t("sync.error.syncFailed")
      setSyncState((prev) => ({ ...prev, phase: "error", lastError: message }))
      toast.error(t("sync.error.syncFailedWithDetail", { message }))
      return false
    }
  }, [pullFromGithub, pushToGithub, t])

  const connectConnection = useCallback(
    async (connectionId: string) => {
      const profile = connections.find((item) => item.id === connectionId)
      if (!profile) {
        toast.error(t("mqtt.error.profileNotFound"))
        return
      }

      destroyClient(connectionId)
      setConnectionState(connectionId, { status: "connecting" })

      const options: IClientOptions = {
        clientId: profile.clientId,
        username: profile.username || undefined,
        password: profile.password || undefined,
        clean: profile.clean,
        keepalive: profile.keepAlive,
        connectTimeout: profile.connectTimeout,
        reconnectPeriod: profile.reconnectPeriod,
      }

      const mqttModule = await getMqttModule()
      const client = mqttModule.default.connect(profile.brokerUrl, options)
      clientsRef.current[connectionId] = client

      client.on("connect", () => {
        setConnectionState(connectionId, {
          status: "connected",
          lastConnectedAt: nowIsoString(),
        })

        const enabledTopics = topicsRef.current.filter(
          (topic) => topic.connectionId === connectionId && topic.enabled
        )
        enabledTopics.forEach((topic) => subscribeTopic(connectionId, topic))
        toast.success(t("mqtt.success.connected", { name: profile.name }))
      })

      client.on("reconnect", () => {
        setConnectionState(connectionId, { status: "connecting" })
      })

      client.on("close", () => {
        setConnectionState(connectionId, { status: "disconnected" })
      })

      client.on("error", (error) => {
        setConnectionState(connectionId, {
          status: "error",
          errorMessage: error.message,
        })
        toast.error(
          t("mqtt.error.connectionError", { name: profile.name, error: error.message })
        )
      })

      client.on("message", (topicName, payload, packet) => {
        appendMessage({
          id: generateId(),
          connectionId,
          topic: topicName,
          payload: decodePayload(payload),
          qos: packet.qos,
          retain: packet.retain,
          direction: "received",
          createdAt: nowIsoString(),
        })
      })
    },
    [
      appendMessage,
      connections,
      destroyClient,
      getMqttModule,
      setConnectionState,
      subscribeTopic,
      t,
    ]
  )

  const disconnectConnection = useCallback(
    (connectionId: string) => {
      const client = clientsRef.current[connectionId]
      if (!client) {
        setConnectionState(connectionId, { status: "disconnected" })
        return
      }

      client.removeAllListeners()
      client.end(true)
      delete clientsRef.current[connectionId]
      setConnectionState(connectionId, { status: "disconnected" })
    },
    [setConnectionState]
  )

  const addConnection = useCallback(
    (values: ConnectionFormValues) => {
      const normalized = normalizeConnectionValues(values)
      const now = nowIsoString()

      const nextProfile: MqttConnectionProfile = {
        id: generateId(),
        ...normalized,
        createdAt: now,
        updatedAt: now,
      }

      setConnections((prev) => [...prev, nextProfile])
      clearTombstones("connections", [nextProfile.id])
      setSelectedConnectionId(nextProfile.id)
      setConnectionState(nextProfile.id, { status: "disconnected" })
      toast.success(t("mqtt.success.connectionAdded"))
    },
    [
      clearTombstones,
      setConnections,
      setConnectionState,
      setSelectedConnectionId,
      t,
    ]
  )

  const updateConnection = useCallback(
    (connectionId: string, values: ConnectionFormValues) => {
      const normalized = normalizeConnectionValues(values)
      disconnectConnection(connectionId)

      setConnections((prev) =>
        prev.map((connection) =>
          connection.id === connectionId
            ? {
                ...connection,
                ...normalized,
                updatedAt: nowIsoString(),
              }
            : connection
        )
      )
      clearTombstones("connections", [connectionId])

      toast.success(t("mqtt.success.connectionUpdated"))
    },
    [clearTombstones, disconnectConnection, setConnections, t]
  )

  const deleteConnection = useCallback(
    (connectionId: string) => {
      disconnectConnection(connectionId)

      const deletedTopicIds = topicsRef.current
        .filter((topic) => topic.connectionId === connectionId)
        .map((topic) => topic.id)
      const deletedMessageIds = messagesRef.current
        .filter((message) => message.connectionId === connectionId)
        .map((message) => message.id)

      setConnections((prev) => prev.filter((connection) => connection.id !== connectionId))
      setTopics((prev) => prev.filter((topic) => topic.connectionId !== connectionId))
      setMessages((prev) =>
        prev.filter((message) => message.connectionId !== connectionId)
      )
      markDeleted("connections", [connectionId])
      markDeleted("topics", deletedTopicIds)
      markDeleted("messages", deletedMessageIds)

      setRuntimeStates((prev) => {
        const { [connectionId]: _, ...rest } = prev
        return rest
      })

      toast.success(t("mqtt.success.connectionDeleted"))
    },
    [disconnectConnection, markDeleted, setConnections, setMessages, setTopics, t]
  )

  const addTopic = useCallback(
    (connectionId: string, values: TopicFormValues) => {
      const normalized = normalizeTopicValues(values)
      const now = nowIsoString()

      const nextTopic: TopicSubscription = {
        id: generateId(),
        connectionId,
        ...normalized,
        createdAt: now,
        updatedAt: now,
      }

      setTopics((prev) => [...prev, nextTopic])
      clearTombstones("topics", [nextTopic.id])
      subscribeTopic(connectionId, nextTopic)
      toast.success(t("mqtt.success.topicAdded"))
    },
    [clearTombstones, setTopics, subscribeTopic, t]
  )

  const updateTopic = useCallback(
    (topicId: string, values: TopicFormValues) => {
      const normalized = normalizeTopicValues(values)

      const currentTopic = topicsRef.current.find((topic) => topic.id === topicId)
      if (!currentTopic) {
        return
      }

      const nextTopic: TopicSubscription = {
        ...currentTopic,
        ...normalized,
        updatedAt: nowIsoString(),
      }

      setTopics((prev) => prev.map((topic) => (topic.id === topicId ? nextTopic : topic)))
      clearTombstones("topics", [topicId])

      if (currentTopic.enabled) {
        unsubscribeTopic(currentTopic.connectionId, currentTopic.topic)
      }
      if (nextTopic.enabled) {
        subscribeTopic(nextTopic.connectionId, nextTopic)
      }

      toast.success(t("mqtt.success.topicUpdated"))
    },
    [clearTombstones, setTopics, subscribeTopic, unsubscribeTopic, t]
  )

  const deleteTopic = useCallback(
    (topicId: string) => {
      const target = topicsRef.current.find((topic) => topic.id === topicId)
      if (!target) {
        return
      }

      if (target.enabled) {
        unsubscribeTopic(target.connectionId, target.topic)
      }

      setTopics((prev) => prev.filter((topic) => topic.id !== topicId))
      markDeleted("topics", [topicId])
      toast.success(t("mqtt.success.topicDeleted"))
    },
    [markDeleted, setTopics, unsubscribeTopic, t]
  )

  const toggleTopicEnabled = useCallback(
    (topicId: string, enabled: boolean) => {
      const currentTopic = topicsRef.current.find((topic) => topic.id === topicId)
      if (!currentTopic) {
        return
      }

      const nextTopic = {
        ...currentTopic,
        enabled,
        updatedAt: nowIsoString(),
      }

      setTopics((prev) => prev.map((topic) => (topic.id === topicId ? nextTopic : topic)))

      if (enabled) {
        subscribeTopic(nextTopic.connectionId, nextTopic)
      } else {
        unsubscribeTopic(nextTopic.connectionId, nextTopic.topic)
      }
    },
    [setTopics, subscribeTopic, unsubscribeTopic]
  )

  const publishMessage = useCallback(
    async (connectionId: string, values: PublishFormValues) => {
      const topic = values.topic.trim()
      if (!topic) {
        throw new Error(t("mqtt.error.topicRequired"))
      }

      const client = clientsRef.current[connectionId]
      if (!client || !client.connected) {
        throw new Error(t("mqtt.error.connectionNotActive"))
      }

      const publishOptions: IClientPublishOptions = {
        qos: values.qos,
        retain: values.retain,
      }

      await new Promise<void>((resolve, reject) => {
        client.publish(topic, values.payload, publishOptions, (error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })

      appendMessage({
        id: generateId(),
        connectionId,
        topic,
        payload: values.payload,
        qos: values.qos,
        retain: values.retain,
        direction: "sent",
        createdAt: nowIsoString(),
      })
    },
    [appendMessage, t]
  )

  const clearMessages = useCallback(
    (connectionId?: string) => {
      if (!connectionId) {
        markDeleted(
          "messages",
          messagesRef.current.map((message) => message.id)
        )
        setMessages([])
        return
      }

      const deletedMessageIds = messagesRef.current
        .filter((message) => message.connectionId === connectionId)
        .map((message) => message.id)
      markDeleted("messages", deletedMessageIds)
      setMessages((prev) =>
        prev.filter((message) => message.connectionId !== connectionId)
      )
    },
    [markDeleted, setMessages]
  )

  useEffect(() => {
    if (!syncSettings.enabled) {
      hasBootstrappedSyncRef.current = false
    }
  }, [syncSettings.enabled])

  useEffect(() => {
    if (!syncSettings.enabled || !syncSettings.autoSync) {
      return
    }

    if (!syncSettings.token.trim() || !syncSettings.passphrase) {
      return
    }

    let cancelled = false

    const runBootstrapPull = async () => {
      if (!hasBootstrappedSyncRef.current) {
        await pullFromGithub(false)
        if (!cancelled) {
          hasBootstrappedSyncRef.current = true
        }
      }
    }

    void runBootstrapPull()

    const interval = window.setInterval(() => {
      void pullFromGithub(false)
    }, clampPullInterval(syncSettings.pullIntervalSeconds) * 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [
    pullFromGithub,
    syncSettings.autoSync,
    syncSettings.enabled,
    syncSettings.passphrase,
    syncSettings.pullIntervalSeconds,
    syncSettings.token,
  ])

  useEffect(() => {
    if (!syncSettings.enabled || !syncSettings.autoSync) {
      return
    }

    if (!syncSettings.token.trim() || !syncSettings.passphrase) {
      return
    }

    if (!hasBootstrappedSyncRef.current) {
      return
    }

    if (skipNextAutoPushRef.current) {
      skipNextAutoPushRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void pushToGithub(false)
    }, SYNC_PUSH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    connections,
    messages,
    pushToGithub,
    syncSettings.autoSync,
    syncSettings.enabled,
    syncSettings.passphrase,
    syncSettings.syncMessages,
    syncSettings.token,
    syncTombstones,
    topics,
  ])

  useEffect(() => {
    return () => {
      // Ensure all sockets are closed when the page unmounts.
      Object.keys(clientsRef.current).forEach((connectionId) => {
        const client = clientsRef.current[connectionId]
        client.removeAllListeners()
        client.end(true)
      })
      clientsRef.current = {}
    }
  }, [])

  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => connection.id === selectedConnectionId) ?? null,
    [connections, selectedConnectionId]
  )

  const topicsForSelectedConnection = useMemo(
    () =>
      selectedConnectionId
        ? topics
            .filter((topic) => topic.connectionId === selectedConnectionId)
            .sort((a, b) => a.topic.localeCompare(b.topic))
        : [],
    [selectedConnectionId, topics]
  )

  const messagesForSelectedConnection = useMemo(
    () =>
      selectedConnectionId
        ? messages.filter((message) => message.connectionId === selectedConnectionId)
        : [],
    [messages, selectedConnectionId]
  )

  const connectionStateMap = useMemo(() => {
    const states: Record<string, ConnectionRuntimeState> = {}

    connections.forEach((connection) => {
      states[connection.id] = runtimeStates[connection.id] ?? {
        status: "disconnected",
      }
    })

    return states
  }, [connections, runtimeStates])

  return {
    connections,
    topics,
    messages,
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
  }
}
