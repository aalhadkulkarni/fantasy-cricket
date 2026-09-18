import { useEffect, useState } from 'react'

import { PageContainer } from '@/components/layout/page-container'
import { TournamentCard } from '@/components/tournaments/tournament-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getCompetitions, getFormats, getTournaments } from '@/data-layer'
import type {
  Competition,
  Format,
  FormatRecord,
  Tournament,
  TournamentStatus,
} from '@/types'

/** The filter's "no filter" value. Radix will not take an empty item value. */
const ANY_FORMAT = '__any__'

/**
 * Tournaments — `/tournaments`. The discovery surface.
 *
 * The interface says **Tournament** for what the model calls `tournaments`. The
 * level above, `competitions`, is a system-admin concept that never appears
 * under that name in anything a user sees.
 *
 * **Only published tournaments appear.** A draft is invisible here and cannot
 * have a league created against it, which is the whole of the no-delete policy
 * for a tournament.
 *
 * **Upcoming is the default deliberately.** Anyone whose tournament is already
 * running reaches it through My Leagues; this page is where you go to find a
 * league to join or to start one.
 */
export function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[] | undefined>(
    undefined,
  )
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [formats, setFormats] = useState<FormatRecord[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [format, setFormat] = useState<string>(ANY_FORMAT)

  useEffect(() => {
    // Guards against setting state after unmount.
    let cancelled = false

    void (async () => {
      try {
        const [loaded, loadedCompetitions, loadedFormats] = await Promise.all([
          // No `includeUnpublished`. Drafts are the admin's business.
          getTournaments(),
          getCompetitions(),
          getFormats(),
        ])
        if (cancelled) return
        setTournaments(loaded)
        setCompetitions(loadedCompetitions)
        setFormats(loadedFormats)
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
  }, [])

  const formatOf = (tournament: Tournament): Format | undefined =>
    competitions.find((c) => c.competitionId === tournament.competitionId)
      ?.formatId

  const nameOfFormat = (id: Format | undefined) =>
    id === undefined
      ? undefined
      : (formats.find((f) => f.formatId === id)?.formatName ?? id)

  const visible = (tournaments ?? []).filter(
    (tournament) => format === ANY_FORMAT || formatOf(tournament) === format,
  )

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tournaments
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every tournament you can create a league against.
        </p>

        {error !== undefined ? (
          <div className="mt-8 text-sm">
            <p className="font-semibold text-destructive">
              Could not load tournaments
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : tournaments === undefined ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : tournaments.length === 0 ? (
          <p className="mt-8 text-sm text-subtle-foreground">
            No tournaments have been published yet.
          </p>
        ) : (
          <Tabs defaultValue="upcoming" className="mt-8 gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="past">Past</TabsTrigger>
              </TabsList>

              {formats.length > 0 && (
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="w-40" aria-label="Filter by format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_FORMAT}>Any format</SelectItem>
                    {formats.map((record) => (
                      <SelectItem key={record.formatId} value={record.formatId}>
                        {record.formatName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {(['upcoming', 'active', 'past'] as const).map((status) => (
              <TabsContent key={status} value={status}>
                <Cards
                  tournaments={visible.filter(
                    (tournament) => statusOf(tournament) === status,
                  )}
                  status={status}
                  filtered={format !== ANY_FORMAT}
                  nameOf={(tournament) => nameOfFormat(formatOf(tournament))}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </PageContainer>
    </main>
  )
}

function Cards({
  tournaments,
  status,
  filtered,
  nameOf,
}: {
  tournaments: Tournament[]
  status: TournamentStatus
  filtered: boolean
  nameOf: (tournament: Tournament) => string | undefined
}) {
  if (tournaments.length === 0) {
    return (
      <p className="text-sm text-subtle-foreground">
        {filtered
          ? `No ${LABELS[status]} tournaments in that format.`
          : `No ${LABELS[status]} tournaments.`}
      </p>
    )
  }

  return (
    /* The reference grid: as many 300px columns as fit, so it reflows rather
       than stepping at fixed breakpoints. */
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
      {tournaments.map((tournament) => (
        <TournamentCard
          key={tournament.tournamentId}
          tournament={tournament}
          formatName={nameOf(tournament)}
          status={status}
        />
      ))}
    </div>
  )
}

const LABELS: Record<TournamentStatus, string> = {
  upcoming: 'upcoming',
  active: 'active',
  past: 'past',
}

/**
 * **From `startDate` and `completedAt` only.** Nothing here walks the match
 * list — those two fields are maintained on write precisely so that readers do
 * not have to.
 *
 * **Past is a human decision, not a date.** `endDate` is the last match's
 * *start* and a Test runs five days, so deriving Past from it would drop a
 * tournament out of Active while its final was still being played. It stays
 * Active until an admin marks it complete.
 */
function statusOf(tournament: Tournament): TournamentStatus {
  if (tournament.completedAt !== undefined) return 'past'
  if (tournament.startDate === undefined) return 'upcoming'

  return tournament.startDate > Date.now() ? 'upcoming' : 'active'
}
