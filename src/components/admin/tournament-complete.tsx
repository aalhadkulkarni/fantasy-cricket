import { useState } from 'react'

import { EditorCard } from '@/components/admin/editor-card'
import { Button } from '@/components/ui/button'
import { markTournamentComplete, unmarkTournamentComplete } from '@/data-layer'
import type { Tournament } from '@/types'

/**
 * Marking a tournament finished, which moves it to the Past tab.
 *
 * **Never automatic**, because the admin may still be adding matches they
 * forgot or correcting points. **And reversible**, for the same reason: a
 * finish marked too early is put back rather than lived with.
 */
export function TournamentComplete({
  tournament,
  onChanged,
}: {
  tournament: Tournament
  onChanged: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const completedAt = tournament.completedAt

  async function toggle() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await (completedAt === undefined
        ? markTournamentComplete(tournament.tournamentId)
        : unmarkTournamentComplete(tournament.tournamentId))
      setStatus('idle')
      onChanged()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <EditorCard title="Finished">
      <p className="text-sm text-muted-foreground">
        {completedAt === undefined
          ? 'Not finished. Mark it once every match is played and every point and correction is in. It then moves to the Past tab.'
          : `Finished on ${new Date(completedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}. It shows under Past.`}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          variant={completedAt === undefined ? 'default' : 'outline'}
          onClick={() => void toggle()}
          disabled={status === 'saving'}
        >
          {status === 'saving'
            ? 'Saving…'
            : completedAt === undefined
              ? 'Mark as finished'
              : 'Mark as not finished'}
        </Button>
        {status === 'failed' && (
          <span className="font-mono text-xs text-destructive">{message}</span>
        )}
      </div>
    </EditorCard>
  )
}
