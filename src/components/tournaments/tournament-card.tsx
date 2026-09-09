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
 * Not a link yet. B2 gives it somewhere to go, and rule 5 then makes the whole
 * body the link.
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
    <article className="floodlit flex flex-col gap-3.5 rounded-lg border bg-card p-5 text-card-foreground">
      <div>
        <h3 className="text-[17px] leading-tight font-bold tracking-[-0.015em]">
          {tournament.tournamentName}
        </h3>

        {formatName !== undefined && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-[4px] border px-[7px] py-[3px] font-mono text-[9.5px] tracking-[0.08em] text-muted-foreground uppercase">
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
    </article>
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
