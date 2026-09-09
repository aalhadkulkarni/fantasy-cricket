import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getLeagueByCode, joinLeague } from '@/data-layer'
import type { JoinableLeague } from '@/types'

/** Long enough to be a name, short enough for a leaderboard row. */
const MAX_TEAM_NAME = 40

/**
 * Joining a league. **Two entry points, one dialog.**
 *
 * Given a league, it goes straight to the team name — that is a row on a
 * tournament page, where the league is already chosen. Given none, it starts by
 * asking for a code, which is the site header.
 *
 * **A code is a shortcut, not a bypass.** It finds a league; whether you can
 * walk in is the data layer's decision, and a closed league still refuses. Every
 * refusal here is a message from the layer rather than a rule duplicated in the
 * interface, because anyone can read the database directly with the client SDK.
 *
 * **The team name is per league and cannot be changed afterwards**, which is why
 * it is asked for here rather than when a team is first picked.
 *
 * Open state is owned by the caller so the mobile navigation can close itself
 * before this opens, rather than stacking a dialog inside a sheet.
 */
export function JoinLeagueDialog({
  open,
  onOpenChange,
  league: given,
  onJoined,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Skips the code step. Absent from the header, present from a league row. */
  league?: JoinableLeague
  onJoined?: () => void
}) {
  const [code, setCode] = useState('')
  const [found, setFound] = useState<JoinableLeague | undefined>(undefined)
  const [teamName, setTeamName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const league = given ?? found

  function close() {
    setCode('')
    setFound(undefined)
    setTeamName('')
    setError(undefined)
    onOpenChange(false)
  }

  async function find() {
    setBusy(true)
    setError(undefined)
    try {
      const result = await getLeagueByCode(code)
      if (result === undefined) {
        setError('No league has that code. Check it and try again.')
        return
      }
      setFound(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    if (league === undefined) return
    setBusy(true)
    setError(undefined)
    try {
      await joinLeague(league.leagueId, teamName)
      onJoined?.()
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {league === undefined ? 'Join a League' : league.leagueName}
          </DialogTitle>
          <DialogDescription>
            {league === undefined
              ? 'Enter the code you were given. A closed league will still ask its admin to approve you.'
              : `${league.tournamentName} · ${league.filledSlots} of ${league.maxSlots} managers`}
          </DialogDescription>
        </DialogHeader>

        {league === undefined ? (
          <div className="grid gap-2">
            <Label htmlFor="join-code">League code</Label>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && void find()}
              /*
                Codes are identifiers, and the design system sets every figure
                in Space Mono. No maximum length: codes are eight characters
                now, and the ones minted before that are six.
              */
              className="font-mono tracking-[0.12em] uppercase"
              placeholder="XXXXXXXX"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="team-name">Your team name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void join()}
              placeholder="Thane Thunders"
              maxLength={MAX_TEAM_NAME}
              autoFocus
            />
            <p className="text-xs text-subtle-foreground">
              Per league, so you can use a different one elsewhere. It cannot be
              changed afterwards.
            </p>
          </div>
        )}

        {error !== undefined && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          {league === undefined ? (
            <Button
              onClick={() => void find()}
              disabled={busy || code.trim() === ''}
            >
              {busy ? 'Looking…' : 'Find league'}
            </Button>
          ) : (
            <Button
              onClick={() => void join()}
              disabled={busy || teamName.trim() === ''}
            >
              {busy ? 'Joining…' : 'Join'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
