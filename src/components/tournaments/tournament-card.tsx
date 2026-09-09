import { Link } from 'react-router'

import { tournamentPath } from '@/routes'
import type { Tournament, TournamentStatus } from '@/types'

/**
 * One tournament, in the list.
 *
 * **Built to the card in `docs/design-reference.html`**, the same shape the
 * league cards use: name, a tag row, label-and-value meta in mono, then a
 * footer carrying a status dot and one caption, divided by a hairline. The
 * structure is most of what makes a card read as a card rather than a filled
 * rectangle.
 *
 * The fields are the four `08-pages/tournaments.md` names — name, start, end,
 * format. **A "start a league" button is cut from the card deliberately**: the
 * detail page has one and so does the header, and a third entry point would
 * compete for space a card does not have.
 *
 * **The whole body is the link**, per rule 5 of the design system: buttons are
 * for secondary actions, and a card with one destination does not need one.
 */
export function TournamentCard({
  tournament,
  formatName,
  status,
}: {
  tournament: Tournament
  /** Resolved through the competition. Absent while the tables are loading. */
  formatName: string | undefined
  status: TournamentStatus
}) {
  const matches = Object.keys(tournament.matches ?? {}).length

  return (
    /*
      `floodlit` is the ambient bloom from above the frame — the wash the login
      page already uses. **Atmosphere, not a state marker**: it carries no beam
      and no border tint, so it does not spend the live marker that `is-live`
      reserves for an auction running or a deadline closing in.
    */
    <Link
      to={tournamentPath(tournament.tournamentId)}
      className="floodlit flex flex-col gap-3.5 rounded-lg border bg-card p-5 text-card-foreground transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-muted-foreground hover:bg-accent"
    >
      <div>
        <h3 className="text-[17px] leading-tight font-bold tracking-[-0.015em]">
          {tournament.tournamentName}
        </h3>

        {formatName !== undefined && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {/*
              Blue, on a blue-tinted fill, matching the bloom washing the card.

              This is a departure from rule 1 of the design system, which
              reserves the accent for live states and names type tags as
              somewhere it must not go. Recorded rather than silently taken.
            */}
            <span className="rounded-[4px] border border-live-text/35 bg-live-text/10 px-[7px] py-[3px] font-mono text-[9.5px] tracking-[0.08em] text-live-text uppercase">
              {formatName}
            </span>
          </div>
        )}
      </div>

      <dl className="grid gap-[5px] font-mono text-[11px] text-subtle-foreground">
        <Row label="Starts" value={day(tournament.startDate)} />
        {/*
          Absent while any match is undated, which is what makes a tournament
          published with only its first match dated read correctly here.
        */}
        <Row label="Ends" value={day(tournament.endDate)} />
      </dl>

      <div className="mt-auto flex items-center justify-between gap-2.5 border-t pt-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            className={`inline-block size-[7px] rounded-full ${
              status === 'active' ? 'bg-settled' : 'bg-subtle-foreground'
            }`}
          />
          {STATUS_LABEL[status]}
        </div>
        <span className="font-mono text-[10.5px] whitespace-nowrap text-subtle-foreground">
          {matches} {matches === 1 ? 'match' : 'matches'}
        </span>
      </div>
    </Link>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="font-normal text-muted-foreground">{value}</dd>
    </div>
  )
}

const STATUS_LABEL: Record<TournamentStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  past: 'Finished',
}

/**
 * **Both dates are match *start* times.** The end is the last match's start
 * rather than when anything finishes, and it is absent until every match has a
 * date.
 */
function day(timestamp: number | undefined): string {
  if (timestamp === undefined) return 'TBD'

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
