import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import {
  parsePlayers,
  parseTeams,
  playersCsv,
} from '@/components/admin/bulk-csv'
import { COUNTRIES } from '@/components/admin/player-form'
import { PageContainer } from '@/components/layout/page-container'
import { PageTab, PageTabsList } from '@/components/page-tabs'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  createTeams,
  getCompetitions,
  getPlayers,
  getTeams,
  importPlayers,
  type ImportResult,
  type PlayerImportRow,
  type TeamImportRow,
} from '@/data-layer'
import {
  INTERNATIONAL_COMPETITIONS,
  LEAGUE_COLUMNS,
  PLAYER_ROLES,
  type Competition,
  type CompetitionId,
  type Player,
  type Team,
} from '@fantasy-cricket/shared'
import { ROUTES } from '@/routes'

/**
 * Bulk upload — `/admin/bulk`. System admins.
 *
 * **Pasted CSV, not files**: one row per entry. Preview runs the import as a
 * dry run, so it judges every row by the service's own rules; Import is
 * offered only when no row has an error, and writes everything in one update
 * or nothing.
 */
export function AdminBulk() {
  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <Link
          to={ROUTES.admin}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:underline"
        >
          ← Admin panel
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Bulk upload
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste comma-separated rows, one per team or player. Upload teams
          first: players are matched to them.
        </p>

        <Tabs defaultValue="teams" className="mt-6">
          <PageTabsList>
            <PageTab value="teams">Teams</PageTab>
            <PageTab value="players">Players</PageTab>
          </PageTabsList>

          <TabsContent value="teams">
            <BulkSection<TeamImportRow>
              format="name,short name,base tournaments"
              notes={[
                'Base tournaments separated by ; and matched by name.',
                'New teams only — a name that already exists is an error.',
              ]}
              example={[
                'Sydney Sixers,SIX,BBL',
                'India,IND,T20 Series;World T20;ODI Series;ODI World Cup;Test Series',
              ]}
              parse={parseTeams}
              run={createTeams}
            />
          </TabsContent>

          <TabsContent value="players">
            <BulkSection<PlayerImportRow>
              format="name,short name,country,role,category,base price,IPL team,BBL team,international team,formats"
              notes={[
                'Role: BAT, BOWL, WK or ALL. Category: marquee, star or general. Short name may be left empty.',
                'IPL and BBL teams are matched within that league. International team and formats (t20/odi/test): t20 is T20 Series and World T20, odi is ODI Series and ODI World Cup, test is Test Series.',
                'Easiest: fetch the players you want to change, edit the rows in place, then preview and import.',
                'A name already in the catalogue is updated: filled values overwrite, empty ones are kept. Only the teams a row names change — re-upload league teams without repeating international teams.',
              ]}
              example={[
                'Virat Kohli,Kohli,India,BAT,marquee,6,RCB,,IND,odi',
                'Jasprit Bumrah,,India,BOWL,marquee,6,MI,,IND,t20/odi/test',
                'Steve Smith,Smith,Australia,BAT,star,4,,SIX,AUS,odi/test',
              ]}
              parse={parsePlayers}
              run={importPlayers}
              tools={(fill) => <FetchPlayers fill={fill} />}
              warn={(row) =>
                row.country !== undefined &&
                row.country !== '' &&
                !(COUNTRIES as readonly string[]).includes(row.country)
                  ? `"${row.country}" is not in the country list — a typo?`
                  : undefined
              }
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </main>
  )
}

type Status =
  | { kind: 'idle' }
  | { kind: 'previewing' }
  | { kind: 'previewed'; result: ImportResult; rows: number }
  | { kind: 'importing'; result: ImportResult; rows: number }
  | { kind: 'imported'; result: ImportResult }
  | { kind: 'failed'; message: string }

/** One kind of upload: format, text area, preview and import. */
function BulkSection<Row>({
  format,
  notes,
  example,
  parse,
  run,
  warn,
  tools,
}: {
  format: string
  notes: readonly string[]
  example: readonly string[]
  parse: (text: string) => Row[]
  run: (rows: readonly Row[], dryRun: boolean) => Promise<ImportResult>
  /** A client-side hint on a row, shown beside the service's verdict. */
  warn?: (row: Row) => string | undefined
  /** Above the text area: whatever can fill it, replacing what is there. */
  tools?: (fill: (text: string) => void) => ReactNode
}) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const fill = (next: string) => {
    setText(next)
    setStatus({ kind: 'idle' })
  }
  const rows = parse(text)

  async function preview() {
    setStatus({ kind: 'previewing' })
    try {
      const result = await run(rows, true)
      setStatus({ kind: 'previewed', result, rows: rows.length })
    } catch (e) {
      setStatus({
        kind: 'failed',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  async function commit(previewed: ImportResult) {
    setStatus({ kind: 'importing', result: previewed, rows: rows.length })
    try {
      const result = await run(rows, false)
      if (result.applied) {
        setStatus({ kind: 'imported', result })
        setText('')
      } else {
        // Something changed between preview and import; show the new verdict.
        setStatus({ kind: 'previewed', result, rows: rows.length })
      }
    } catch (e) {
      setStatus({
        kind: 'failed',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  const shown =
    status.kind === 'previewed' || status.kind === 'importing'
      ? status.result
      : undefined
  const errors = shown?.rows.filter((r) => r.outcome === 'error').length ?? 0
  const writes =
    shown?.rows.filter((r) => r.outcome === 'new' || r.outcome === 'updated')
      .length ?? 0

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-lg border bg-card p-4 text-sm text-card-foreground">
        <p className="font-mono text-xs break-words">{format}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle-foreground">For example:</p>
        <pre className="mt-1 overflow-x-auto font-mono text-xs text-muted-foreground">
          {example.join('\n')}
        </pre>
      </div>

      {tools?.(fill)}

      <label className="grid gap-2 text-sm font-medium">
        Rows
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            // The preview no longer matches what is pasted.
            if (status.kind !== 'idle') setStatus({ kind: 'idle' })
          }}
          rows={10}
          spellCheck={false}
          placeholder={example[0]}
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-xs leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="outline"
          onClick={() => void preview()}
          disabled={rows.length === 0 || status.kind === 'previewing'}
        >
          {status.kind === 'previewing'
            ? 'Checking…'
            : `Preview ${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}
        </Button>
        {shown !== undefined && (
          <Button
            onClick={() => void commit(shown)}
            disabled={errors > 0 || writes === 0 || status.kind === 'importing'}
          >
            {status.kind === 'importing' ? 'Importing…' : `Import ${writes}`}
          </Button>
        )}
      </div>

      {status.kind === 'failed' && (
        <p role="alert" className="text-sm text-destructive">
          {status.message}
        </p>
      )}

      {status.kind === 'imported' && (
        <p className="text-sm font-semibold text-settled">
          Imported {summary(status.result)}.
        </p>
      )}

      {shown !== undefined && (
        <div>
          <p className="text-sm">
            {summary(shown)}
            {errors > 0 && (
              <span className="text-destructive">
                {' '}
                — fix the errors to import.
              </span>
            )}
          </p>
          <ul className="mt-2 divide-y rounded-lg border">
            {shown.rows.map((result) => {
              const hint = warn?.(rows[result.row - 1] as Row)
              return (
                <li key={result.row} className="px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 font-mono text-xs text-subtle-foreground">
                        {result.row}
                      </span>
                      {result.name}
                    </span>
                    <span
                      className={`shrink-0 font-mono text-xs ${
                        result.outcome === 'error'
                          ? 'text-destructive'
                          : result.outcome === 'unchanged'
                            ? 'text-subtle-foreground'
                            : 'text-settled'
                      }`}
                    >
                      {result.outcome}
                    </span>
                  </div>
                  {result.error !== undefined && (
                    <p className="mt-1 text-xs text-destructive">
                      {result.error}
                    </p>
                  )}
                  {result.changes !== undefined && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {result.changes.join(' · ')}
                    </p>
                  )}
                  {hint !== undefined && (
                    <p className="mt-1 text-xs text-subtle-foreground">
                      {hint}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

/** "3 new, 2 updated, 1 unchanged, 1 error". */
function summary(result: ImportResult): string {
  const count = (outcome: string) =>
    result.rows.filter((r) => r.outcome === outcome).length
  const parts = [
    [count('new'), 'new'],
    [count('updated'), 'updated'],
    [count('unchanged'), 'unchanged'],
    [count('error'), count('error') === 1 ? 'error' : 'errors'],
  ] as const
  return (
    parts
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`)
      .join(', ') || 'nothing'
  )
}

/**
 * **Fetch players into the text area, as rows ready to edit.** Each fetch
 * replaces what is there — fetching RCB then MI shows only MI. The players are
 * read fresh each time, so a fetch after an import shows the import.
 */
function FetchPlayers({ fill }: { fill: (text: string) => void }) {
  const [catalogue, setCatalogue] = useState<
    { teams: Team[]; competitions: Competition[] } | undefined
  >(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [teams, competitions] = await Promise.all([
          getTeams(),
          getCompetitions(),
        ])
        if (!cancelled) setCatalogue({ teams, competitions })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error !== undefined) {
    return (
      <p className="text-sm text-destructive">
        Could not load the teams to fetch from: {error}
      </p>
    )
  }
  if (catalogue === undefined) {
    return <p className="text-sm text-muted-foreground">Loading teams…</p>
  }

  const { teams, competitions } = catalogue
  const idsOf = (names: readonly string[]): CompetitionId[] =>
    names.flatMap((name) => {
      const id = competitions.find(
        (c) => c.competitionName === name,
      )?.competitionId
      return id === undefined ? [] : [id]
    })
  const teamsIn = (ids: readonly CompetitionId[]) =>
    teams
      .filter((t) => ids.some((id) => t.competitionIds?.[id] === true))
      .sort((a, b) => a.teamName.localeCompare(b.teamName))

  /** Fresh players, kept by `keep`, grouped by team, then role, then name. */
  async function fetchRows(
    keep: (player: Player) => boolean,
    teamOf: (player: Player) => string,
  ) {
    setBusy(true)
    try {
      const players = (await getPlayers())
        .filter(keep)
        .sort(
          (a, b) =>
            teamOf(a).localeCompare(teamOf(b)) ||
            PLAYER_ROLES.indexOf(a.playerRole) -
              PLAYER_ROLES.indexOf(b.playerRole) ||
            a.playerName.localeCompare(b.playerName),
        )
      fill(playersCsv(players, teams, competitions))
      setError(undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const sections: { key: string; label: string; ids: CompetitionId[] }[] = [
    ...LEAGUE_COLUMNS.map((league) => ({
      key: league,
      label: league,
      ids: idsOf([league]),
    })),
    {
      key: 'international',
      label: 'international',
      ids: idsOf(INTERNATIONAL_COMPETITIONS),
    },
  ]

  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4 text-card-foreground">
      <p className="text-sm font-medium">Fetch players to edit</p>
      {sections.map(({ key, label, ids }) => {
        if (ids.length === 0) {
          return (
            <p key={key} className="text-sm text-subtle-foreground">
              No {label} base tournament yet.
            </p>
          )
        }
        const sectionTeams = teamsIn(ids)
        const teamIdIn = (player: Player) =>
          ids
            .map((id) => player.currentTeams?.[id])
            .find((t) => t !== undefined)
        const shortOf = (player: Player) => {
          const teamId = teamIdIn(player)
          return teams.find((t) => t.teamId === teamId)?.teamShortName ?? ''
        }
        const chosen = picked[key] ?? ''
        return (
          <div key={key} className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void fetchRows((p) => teamIdIn(p) !== undefined, shortOf)
              }
            >
              All {label} players
            </Button>
            <Select
              value={chosen}
              onValueChange={(value) =>
                setPicked((before) => ({ ...before, [key]: value }))
              }
            >
              <SelectTrigger className="h-8 w-48" aria-label={`${label} team`}>
                <SelectValue placeholder={`${label} team`} />
              </SelectTrigger>
              <SelectContent>
                {sectionTeams.map((team) => (
                  <SelectItem key={team.teamId} value={team.teamId}>
                    {team.teamName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || chosen === ''}
              onClick={() =>
                void fetchRows(
                  (p) => ids.some((id) => p.currentTeams?.[id] === chosen),
                  shortOf,
                )
              }
            >
              Fetch team
            </Button>
          </div>
        )
      })}
    </div>
  )
}
