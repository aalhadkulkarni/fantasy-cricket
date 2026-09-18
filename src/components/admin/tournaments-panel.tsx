import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createTournament, getCompetitions, getTournaments } from '@/data-layer'
import { adminTournamentPath } from '@/routes'
import type { Competition, CompetitionId, Tournament } from '@/types'

/**
 * Tournaments, on the admin panel.
 *
 * **This panel only lists and creates.** Everything else about a tournament —
 * its teams, players, fixtures and rounds — happens on its own page, because
 * there is far more of it than a shared panel can hold.
 *
 * **Unpublished tournaments are listed here and nowhere else.** That is the
 * whole of the no-delete policy for a tournament: one created by mistake is
 * simply never published, which leaves it invisible to everyone but this
 * screen.
 */
export function TournamentsPanel({
  catalogueVersion,
  onChanged,
}: {
  /** Bumped by the page when another panel writes something this one reads. */
  catalogueVersion: number
  /** Called after a write here, so the other panels reload too. */
  onChanged: () => void
}) {
  const [tournaments, setTournaments] = useState<Tournament[] | undefined>(
    undefined,
  )
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [creating, setCreating] = useState(false)

  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    // Guards against setting state after unmount, and against a slow first
    // response landing on top of a faster reload.
    let cancelled = false

    void (async () => {
      try {
        const [loaded, loadedCompetitions] = await Promise.all([
          // The admin is the one person who sees drafts.
          getTournaments({ includeUnpublished: true }),
          getCompetitions(),
        ])
        if (cancelled) return
        setTournaments(loaded)
        setCompetitions(loadedCompetitions)
        setError(undefined)
      } catch (e) {
        if (cancelled) return
        // An empty array rather than undefined: undefined reads as "still
        // loading" and would spin forever.
        setTournaments([])
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken, catalogueVersion])

  const canCreate = competitions.length > 0

  return (
    <section className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Tournaments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One running of a base tournament, with its own fixtures and rounds.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!canCreate}>
          Create tournament
        </Button>
      </div>

      {!canCreate && (
        <p className="mt-3 text-sm text-subtle-foreground">
          No base tournaments exist yet. They are seeded by Set up basic system.
        </p>
      )}

      <Body
        tournaments={tournaments}
        error={error}
        competitions={competitions}
      />

      {creating && (
        <CreateDialog
          competitions={competitions}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            reload()
            onChanged()
          }}
        />
      )}
    </section>
  )
}

function Body({
  tournaments,
  error,
  competitions,
}: {
  tournaments: Tournament[] | undefined
  error: string | undefined
  competitions: Competition[]
}) {
  if (error !== undefined) {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">
          Could not load tournaments
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (tournaments === undefined) {
    return <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
  }

  if (tournaments.length === 0) {
    return (
      <p className="mt-5 text-sm text-subtle-foreground">
        No tournaments yet. Create one, then set its teams, players and
        fixtures.
      </p>
    )
  }

  return (
    <ul className="mt-5 divide-y border-t">
      {tournaments.map((tournament) => (
        <li key={tournament.tournamentId}>
          <TournamentRow tournament={tournament} competitions={competitions} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The whole row opens the tournament's page. Stacked rather than columned, the
 * same shape the teams and players panels settled on.
 */
function TournamentRow({
  tournament,
  competitions,
}: {
  tournament: Tournament
  competitions: Competition[]
}) {
  const navigate = useNavigate()

  const competition = competitions.find(
    (c) => c.competitionId === tournament.competitionId,
  )
  const matchCount = Object.keys(tournament.matches ?? {}).length
  const roundCount = Object.keys(tournament.rounds ?? {}).length
  const playerCount = Object.keys(tournament.participatingPlayers ?? {}).length

  return (
    <button
      type="button"
      onClick={() =>
        void navigate(adminTournamentPath(tournament.tournamentId))
      }
      className="block w-full px-2 py-2.5 text-left hover:bg-accent"
    >
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="text-sm font-semibold">
          {tournament.tournamentName}
        </span>
        {/*
          Unpublished is the state worth naming, not published. A draft is
          invisible everywhere else, so this is the only place it shows.
        */}
        {tournament.publishedAt === undefined && (
          <span className="font-mono text-[10px] tracking-wide text-subtle-foreground uppercase">
            Draft
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {competition?.competitionName ?? tournament.competitionId} ·{' '}
        {matchCount} {matchCount === 1 ? 'match' : 'matches'} · {roundCount}{' '}
        {roundCount === 1 ? 'round' : 'rounds'} ·{' '}
        {playerCount === 0 ? 'no players yet' : `${playerCount} players`}
      </span>
    </button>
  )
}

/**
 * Name, base tournament and how many matches — nothing else.
 *
 * **Teams and players come after**, on the tournament's own page, using the
 * same editor that changes them later. `08-pages/system-admin.md` describes
 * creation as one long flow through teams and players; splitting it keeps one
 * editor per thing rather than two, and keeps this dialog inside a phone.
 */
function CreateDialog({
  competitions,
  onClose,
  onCreated,
}: {
  competitions: Competition[]
  onClose: () => void
  onCreated: () => void
}) {
  const navigate = useNavigate()

  const [tournamentName, setTournamentName] = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [matchCount, setMatchCount] = useState('1')
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const count = Number(matchCount)
  const countIsUsable = Number.isInteger(count) && count >= 1 && count <= 200

  const canSave =
    tournamentName.trim() !== '' &&
    competitionId !== '' &&
    countIsUsable &&
    status !== 'saving'

  async function save() {
    setStatus('saving')
    setMessage(undefined)
    try {
      const tournamentId = await createTournament({
        tournamentName: tournamentName.trim(),
        competitionId: competitionId as CompetitionId,
        matchCount: count,
      })
      onCreated()
      // Straight to the thing you now have to fill in.
      await navigate(adminTournamentPath(tournamentId))
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Create tournament</DialogTitle>
          <DialogDescription>
            One running of a base tournament. Teams, players and fixtures are
            set on the next screen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tournament-name">Name</Label>
            <Input
              id="tournament-name"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              placeholder="Australia v South Africa 2026"
              autoFocus
              maxLength={80}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tournament-competition">Base tournament</Label>
            <Select value={competitionId} onValueChange={setCompetitionId}>
              <SelectTrigger id="tournament-competition" className="w-full">
                <SelectValue placeholder="Pick a base tournament" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((competition) => (
                  <SelectItem
                    key={competition.competitionId}
                    value={competition.competitionId}
                  >
                    {competition.competitionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* The format is not asked for. It comes from the base tournament. */}
            <p className="text-xs text-subtle-foreground">
              The format comes from this and is not set separately.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tournament-matches">Number of matches</Label>
            <Input
              id="tournament-matches"
              type="number"
              min={1}
              max={200}
              value={matchCount}
              onChange={(e) => setMatchCount(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-subtle-foreground">
              Created as blank fixtures you fill in later. More can be added at
              any time, even once the tournament is under way.
            </p>
          </div>

          {status === 'failed' && (
            <p className="font-mono text-xs text-destructive">{message}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {status === 'saving' ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
