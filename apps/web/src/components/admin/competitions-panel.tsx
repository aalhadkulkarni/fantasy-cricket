import { useCallback, useEffect, useState } from 'react'

import { COUNTRIES } from '@/components/admin/player-form'
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
import {
  createCompetition,
  getCompetitions,
  getFormats,
  updateCompetition,
} from '@/data-layer'
import type { Competition, Format, FormatRecord } from '@fantasy-cricket/shared'

/** The select value for "no home nation", since a select cannot hold ''. */
const NO_HOME_NATION = '__none__'

/**
 * Base tournaments, on the admin panel — IPL, BBL, ODI World Cup.
 *
 * **The home nation is the reason this exists.** It decides who counts as
 * overseas: a player whose country is not it. It is copied onto each tournament
 * when the tournament is created, so editing it here changes tournaments made
 * afterwards and never one already running — the dialog says so, because
 * nothing else on screen would.
 *
 * The interface says **Base Tournament** where the model says competition, and
 * the word "competition" never appears in anything a user reads.
 */
export function CompetitionsPanel({
  catalogueVersion,
  onChanged,
}: {
  /** Bumped by the page when another panel writes something this one reads. */
  catalogueVersion: number
  /** Called after a write here, so the teams and players panels reload. */
  onChanged: () => void
}) {
  const [competitions, setCompetitions] = useState<Competition[] | undefined>(
    undefined,
  )
  const [formats, setFormats] = useState<FormatRecord[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<Competition | 'new' | undefined>(
    undefined,
  )

  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const [loadedCompetitions, loadedFormats] = await Promise.all([
          getCompetitions(),
          getFormats(),
        ])
        if (cancelled) return
        setCompetitions(
          [...loadedCompetitions].sort((a, b) =>
            a.competitionName.localeCompare(b.competitionName),
          ),
        )
        setFormats(loadedFormats)
        setError(undefined)
      } catch (e) {
        if (cancelled) return
        // An empty array rather than undefined, which would read as loading.
        setCompetitions([])
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken, catalogueVersion])

  const formatName = (formatId: Format) =>
    formats.find((f) => f.formatId === formatId)?.formatName ?? formatId

  return (
    <section className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Base tournaments</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What a tournament is one running of, its format, and who counts as
            overseas in it.
          </p>
        </div>
        {/* Formats come from Set up basic system. Without them there is
            nothing to pick, so there is nothing to create yet either. */}
        <Button
          onClick={() => setEditing('new')}
          disabled={formats.length === 0}
        >
          Create base tournament
        </Button>
      </div>

      <Body
        competitions={competitions}
        error={error}
        formatName={formatName}
        onEdit={setEditing}
      />

      {editing !== undefined && (
        <CompetitionDialog
          competition={editing === 'new' ? undefined : editing}
          formats={formats}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined)
            reload()
            // A new base tournament is a new team and player dropdown below.
            onChanged()
          }}
        />
      )}
    </section>
  )
}

function Body({
  competitions,
  error,
  formatName,
  onEdit,
}: {
  competitions: Competition[] | undefined
  error: string | undefined
  formatName: (formatId: Format) => string
  onEdit: (competition: Competition) => void
}) {
  if (error !== undefined) {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">
          Could not load base tournaments
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (competitions === undefined) {
    return <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
  }

  if (competitions.length === 0) {
    return (
      <p className="mt-5 text-sm text-subtle-foreground">
        No base tournaments yet. Set up basic system seeds the usual ones.
      </p>
    )
  }

  return (
    <ul className="mt-5 divide-y border-t">
      {competitions.map((competition) => (
        <li key={competition.competitionId}>
          <button
            type="button"
            onClick={() => onEdit(competition)}
            className="flex w-full flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-2 py-2.5 text-left hover:bg-accent"
          >
            <span className="text-sm font-semibold">
              {competition.competitionName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatName(competition.formatId)} ·{' '}
              {competition.homeNation === undefined
                ? 'No home nation'
                : `Home: ${competition.homeNation}`}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * One dialog for both create and edit, because the fields are identical and
 * two would drift apart.
 */
function CompetitionDialog({
  competition,
  formats,
  onClose,
  onSaved,
}: {
  competition: Competition | undefined
  formats: FormatRecord[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = competition !== undefined
  const [name, setName] = useState(competition?.competitionName ?? '')
  const [formatId, setFormatId] = useState<Format | ''>(
    competition?.formatId ?? '',
  )
  const [homeNation, setHomeNation] = useState(competition?.homeNation ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const canSave = name.trim() !== '' && formatId !== '' && status !== 'saving'

  // A stored nation dropped from the list must stay selectable, or opening the
  // dialog would silently blank it.
  const nations =
    homeNation === '' ||
    COUNTRIES.includes(homeNation as (typeof COUNTRIES)[number])
      ? COUNTRIES
      : [homeNation, ...COUNTRIES]

  async function save() {
    if (formatId === '') return
    setStatus('saving')
    setMessage(undefined)
    try {
      const config = {
        competitionName: name.trim(),
        formatId,
        // '' clears it on an update, and is simply not stored on a create.
        homeNation,
      }
      if (competition === undefined) await createCompetition(config)
      else await updateCompetition(competition.competitionId, config)
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit base tournament' : 'Create base tournament'}
          </DialogTitle>
          <DialogDescription>
            IPL, BBL, ODI World Cup. Each tournament is one running of one.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="competition-name">Name</Label>
            <Input
              id="competition-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="BBL"
              autoFocus
              maxLength={60}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="competition-format">Format</Label>
            <Select
              value={formatId}
              onValueChange={(value) => setFormatId(value as Format)}
            >
              <SelectTrigger id="competition-format" className="w-full">
                <SelectValue placeholder="Pick a format" />
              </SelectTrigger>
              <SelectContent>
                {formats.map((format) => (
                  <SelectItem key={format.formatId} value={format.formatId}>
                    {format.formatName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="competition-home">Home nation</Label>
            <Select
              value={homeNation === '' ? NO_HOME_NATION : homeNation}
              onValueChange={(value) =>
                setHomeNation(value === NO_HOME_NATION ? '' : value)
              }
            >
              <SelectTrigger id="competition-home" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_HOME_NATION}>None</SelectItem>
                {nations.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-subtle-foreground">
              Players from anywhere else count as overseas. Leave it as None for
              an international competition.
              {isEditing &&
                ' A change applies to tournaments created from now on, not ones that already exist.'}
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
            {status === 'saving' ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
