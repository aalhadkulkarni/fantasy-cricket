import { useState } from 'react'

import { EditorCard } from '@/components/admin/editor-card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { publishTournament } from '@/data-layer'
import type { Tournament } from '@/types'

/**
 * Publishing, and the official leagues that open with it.
 *
 * **Publishing is what makes a tournament exist for everyone else.** Until then
 * it is invisible and no league can be created against it, which is also the
 * whole of the no-delete policy for a tournament: one made by mistake is simply
 * never published.
 *
 * **The leagues are created in the same write as the publish**, so a tournament
 * is never visible with nothing in it to join.
 */
export function TournamentPublish({
  tournament,
  onPublished,
}: {
  tournament: Tournament
  onPublished: () => void
}) {
  const published = tournament.publishedAt !== undefined

  const [matchBased, setMatchBased] = useState(!published)
  const [gameWeekBased, setGameWeekBased] = useState(!published)
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const dated = Object.values(tournament.matches ?? {}).filter(
    (match) => match.startTimestamp !== undefined,
  ).length
  const players = Object.keys(tournament.participatingPlayers ?? {}).length

  const existing = Object.keys(tournament.leagues ?? {}).length

  const wantsLeague = matchBased || gameWeekBased

  // The gate is enforced in the data layer. Disabling here is convenience, and
  // saying why is the part that matters. Once published there is nothing left
  // to do unless a league is being asked for.
  const canPublish =
    dated > 0 && status !== 'saving' && (!published || wantsLeague)

  async function publish() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await publishTournament(tournament.tournamentId, {
        matchBased,
        gameWeekBased,
      })
      onPublished()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <EditorCard title={published ? 'Published' : 'Publish'}>
      <p className="text-sm text-muted-foreground">
        {published
          ? 'This tournament is visible and leagues can be created against it. Tick a box below to open another official league.'
          : 'Until it is published, only this screen can see this tournament and no league can be created against it.'}
      </p>

      {published && (
        <p className="mt-2 text-sm text-settled">
          Published {new Date(tournament.publishedAt ?? 0).toLocaleString()} ·{' '}
          {existing} {existing === 1 ? 'league' : 'leagues'}
        </p>
      )}

      <fieldset className="mt-5 grid gap-2.5">
        <legend className="text-sm font-medium">Official leagues</legend>

        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox
            checked={matchBased}
            onCheckedChange={(checked) => setMatchBased(checked === true)}
          />
          Official match based league
        </label>

        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox
            checked={gameWeekBased}
            onCheckedChange={(checked) => setGameWeekBased(checked === true)}
          />
          Official game week based league
        </label>

        {/*
          Worth stating rather than discovering. Whoever publishes owns and
          administers these leagues but is not a manager in them — a manager has
          a fantasy team name, and that is chosen on joining.
        */}
        {wantsLeague && (
          <p className="text-xs text-subtle-foreground">
            Public, standard points, no auction, up to 200 managers. You own and
            administer them but do not play them — join like anyone else to pick
            a team. The gameweek league gets one gameweek per round.
          </p>
        )}
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={() => void publish()} disabled={!canPublish}>
          {status === 'saving'
            ? 'Publishing…'
            : published
              ? 'Create leagues'
              : 'Publish tournament'}
        </Button>

        {dated === 0 && (
          <span className="text-sm text-subtle-foreground">
            At least the first match needs a start time.
          </span>
        )}
        {dated > 0 && wantsLeague && players === 0 && (
          <span className="text-sm text-subtle-foreground">
            A league needs players to pick from. Set the teams and players
            first.
          </span>
        )}
        {status === 'failed' && (
          <span className="font-mono text-xs text-destructive">{message}</span>
        )}
      </div>
    </EditorCard>
  )
}
