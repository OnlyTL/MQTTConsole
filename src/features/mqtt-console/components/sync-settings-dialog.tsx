import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/i18n/i18n-provider"
import type { GithubSyncSettings, GithubSyncState } from "@/types/mqtt-console"

interface SyncSettingsDialogProps {
  open: boolean
  settings: GithubSyncSettings
  syncState: GithubSyncState
  onOpenChange: (open: boolean) => void
  onSave: (settings: GithubSyncSettings) => void
  onSyncNow: () => Promise<boolean>
  onPull: () => Promise<boolean>
  onPush: () => Promise<boolean>
}

export function SyncSettingsDialog({
  open,
  settings,
  syncState,
  onOpenChange,
  onSave,
  onSyncNow,
  onPull,
  onPush,
}: SyncSettingsDialogProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<GithubSyncSettings>(settings)

  useEffect(() => {
    if (!open) {
      return
    }

    setFormValues(settings)
  }, [open, settings])

  const isSyncing =
    syncState.phase === "pulling" ||
    syncState.phase === "pushing" ||
    syncState.phase === "syncing"

  const statusText = useMemo(() => {
    if (syncState.phase === "error") {
      return syncState.lastError
        ? t("sync.status.errorWithDetail", { message: syncState.lastError })
        : t("sync.status.error")
    }

    if (syncState.lastSyncedAt) {
      return t("sync.status.lastSynced", {
        time: new Date(syncState.lastSyncedAt).toLocaleString(),
      })
    }

    return t("sync.status.never")
  }, [syncState.lastError, syncState.lastSyncedAt, syncState.phase, t])

  const updateField = <K extends keyof GithubSyncSettings>(
    key: K,
    value: GithubSyncSettings[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{t("sync.dialog.title")}</DialogTitle>
          <DialogDescription>{t("sync.dialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="flex items-center justify-between border px-2.5 py-2">
            <div>
              <p className="text-xs font-medium">{t("sync.form.enabled")}</p>
              <p className="text-muted-foreground text-xs">
                {t("sync.form.enabledDescription")}
              </p>
            </div>
            <Switch
              checked={formValues.enabled}
              onCheckedChange={(checked) => updateField("enabled", checked)}
              aria-label={t("sync.form.enabled")}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sync-token">{t("sync.form.token")}</Label>
            <Input
              id="sync-token"
              type="password"
              placeholder={t("sync.form.tokenPlaceholder")}
              value={formValues.token}
              onChange={(event) => updateField("token", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sync-gist-id">{t("sync.form.gistId")}</Label>
            <Input
              id="sync-gist-id"
              placeholder={t("sync.form.gistIdPlaceholder")}
              value={formValues.gistId}
              onChange={(event) => updateField("gistId", event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sync-passphrase">{t("sync.form.passphrase")}</Label>
            <Input
              id="sync-passphrase"
              type="password"
              placeholder={t("sync.form.passphrasePlaceholder")}
              value={formValues.passphrase}
              onChange={(event) => updateField("passphrase", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between border px-2.5 py-2">
              <div>
                <p className="text-xs font-medium">{t("sync.form.autoSync")}</p>
                <p className="text-muted-foreground text-xs">
                  {t("sync.form.autoSyncDescription")}
                </p>
              </div>
              <Switch
                checked={formValues.autoSync}
                onCheckedChange={(checked) => updateField("autoSync", checked)}
                aria-label={t("sync.form.autoSync")}
              />
            </div>

            <div className="flex items-center justify-between border px-2.5 py-2">
              <div>
                <p className="text-xs font-medium">{t("sync.form.syncMessages")}</p>
                <p className="text-muted-foreground text-xs">
                  {t("sync.form.syncMessagesDescription")}
                </p>
              </div>
              <Switch
                checked={formValues.syncMessages}
                onCheckedChange={(checked) => updateField("syncMessages", checked)}
                aria-label={t("sync.form.syncMessages")}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sync-pull-interval">{t("sync.form.pullInterval")}</Label>
            <Input
              id="sync-pull-interval"
              type="number"
              min={30}
              step={10}
              value={formValues.pullIntervalSeconds}
              onChange={(event) =>
                updateField("pullIntervalSeconds", Number(event.target.value))
              }
            />
          </div>

          <div className="border px-2.5 py-2">
            <p className="text-xs font-medium">{t("sync.status.title")}</p>
            <p className="text-muted-foreground mt-1 text-xs break-all">{statusText}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isSyncing}
                onClick={() => {
                  void onPull()
                }}
              >
                {isSyncing && syncState.phase === "pulling" ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t("sync.action.pull")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isSyncing}
                onClick={() => {
                  void onPush()
                }}
              >
                {isSyncing && syncState.phase === "pushing" ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t("sync.action.push")}
              </Button>
              <Button
                size="sm"
                disabled={isSyncing}
                onClick={() => {
                  void onSyncNow()
                }}
              >
                {isSyncing && syncState.phase === "syncing" ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {t("sync.action.syncNow")}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave(formValues)
              onOpenChange(false)
            }}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
