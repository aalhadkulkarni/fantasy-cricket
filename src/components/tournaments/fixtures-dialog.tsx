import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Team, Tournament } from '@/types'

/**
 * The full schedule.
 *
 * **A modal, as `08-pages/tournaments.md` specifies**, alongside the Teams and
 * Players views that will sit beside it. A tournament page is about the leagues
 * you can join; the fixtures are reference, wanted occasionally and in full.
 *
 * **Ordered by `matchNumber`, never by id.** Ids are push keys and sort by
 * creation time, which is not the fixture order.
 */
export function FixturesDialog({
  tournament,
  teams,
  onClose,
}: {
  tournament: Tournament
  teams: Team[]
  onClose: () => void
}) {
  const matches = Object.values(tournament.matches ?? {}).sort(
    (a, b) => a.matchNumber - b.matchNumber,
  )

  const nameOf = (teamId: string | undefined) =>
    teamId === undefined
      ? 'TBD'
      : (teams.find((team) => team.teamId === teamId)?.teamShortName ?? 'TBD')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Fixtures</DialogTitle>
          <DialogDescription>
            {tournament.tournamentName} · {matches.length}{' '}
            {matches.length === 1 ? 'match' : 'matches'}
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            No matches have been added yet.
          </p>
        ) : (
          <ol className="divide-y border-t border-b">
            {matches.map((match) => (
              <li
                key={match.matchId}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] text-subtle-foreground">
                    {String(match.matchNumber).padStart(2, '0')}
                  </span>
                  <span className="text-sm font-semibold">
                    {nameOf(match.team1Id)} v {nameOf(match.team2Id)}
                  </span>
                </span>

                <span className="font-mono text-[10.5px] text-subtle-foreground">
                  {when(match.startTimestamp)}
                  {match.venue !== undefined && ` · ${match.venue}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * **A start time, in the reader's own timezone.** Absent until announced, which
 * is the normal state for a fixture that has not been scheduled yet.
 */
function when(timestamp: number | undefined): string {
  if (timestamp === undefined) return 'Date TBD'

  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}
