import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

/**
 * The shell the three tournament editors share, so the page reads as one screen
 * rather than three panels transplanted from elsewhere.
 */
export function EditorCard({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export type SaveStatus = 'idle' | 'saving' | 'failed' | 'saved'

/**
 * One Save per card, because each card is one atomic write. Saving the whole
 * fixture list at once is what lets the tournament's dates be recomputed from a
 * complete picture instead of match by match.
 */
export function EditorFooter({
  status,
  message,
  savedLabel,
  onSave,
  disabled,
}: {
  status: SaveStatus
  message: string | undefined
  savedLabel: string
  onSave: () => void
  disabled?: boolean
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button
        onClick={onSave}
        disabled={disabled === true || status === 'saving'}
      >
        {status === 'saving' ? 'Saving…' : 'Save'}
      </Button>
      {status === 'saved' && (
        <span className="text-sm text-settled">{savedLabel}</span>
      )}
      {status === 'failed' && (
        <span className="font-mono text-xs text-destructive">{message}</span>
      )}
    </div>
  )
}
