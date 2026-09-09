import { useState } from 'react'

import {
  EditorCard,
  EditorFooter,
  type SaveStatus,
} from '@/components/admin/editor-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setRounds } from '@/data-layer'
import type {
  MatchId,
  RoundId,
  Tournament,
  TournamentRoundConfig,
} from '@/types'

interface RoundRow {
  roundId?: RoundId
  roundName: string
  firstMatchNumber: number
  lastMatchNumber: number
}

/**
 * The round structure — group stage, playoffs.
 *
 * **The rounds tile the matches exactly.** Contiguous, no overlaps, and every
 * match in one, because a match outside every round could never fall inside a
 * gameweek and so could never be played. The interface makes that true by
 * construction rather than by validating it: you cannot type a range, only
 * choose where to split.
 *
 * Rounds exist so a knockout tail is expressible. Gameweeks are equal length
 * within a round, so a sixty-match group stage and a four-match playoff cannot
 * be one thing.
 */
export function TournamentRounds({
  tournament,
  onSaved,
}: {
  tournament: Tournament
  onSaved: () => void
}) {
  const matchNumbers = Object.values(tournament.matches ?? {})
    .map((match) => match.matchNumber)
    .sort((a, b) => a - b)

  const lastMatchNumber = matchNumbers[matchNumbers.length - 1] ?? 0

  const [rows, setRows] = useState<RoundRow[]>(() =>
    rowsFromTournament(tournament),
  )
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [splitAt, setSplitAt] = useState('')

  /**
   * Every match a new round could start at: anything after match one that is
   * not already a boundary. Splitting there cuts the round containing it in
   * two, which is the only edit that can keep the tiling intact.
   */
  const splitPoints = matchNumbers.filter(
    (number) =>
      number > 1 && !rows.some((row) => row.firstMatchNumber === number),
  )

  function split(at: number) {
    const index = rows.findIndex(
      (row) => row.firstMatchNumber <= at && at <= row.lastMatchNumber,
    )
    const target = rows[index]
    if (target === undefined) return

    setRows([
      ...rows.slice(0, index),
      { ...target, lastMatchNumber: at - 1 },
      {
        // No id: a round being created. The half keeping the id keeps anything
        // recorded against it.
        roundName: `Round ${index + 2}`,
        firstMatchNumber: at,
        lastMatchNumber: target.lastMatchNumber,
      },
      ...rows.slice(index + 1),
    ])
    setSplitAt('')
    setStatus('idle')
  }

  /** Merging into the one before it, which is the only way to close the gap. */
  function mergeIntoPrevious(index: number) {
    const previous = rows[index - 1]
    const target = rows[index]
    if (previous === undefined || target === undefined) return

    setRows([
      ...rows.slice(0, index - 1),
      { ...previous, lastMatchNumber: target.lastMatchNumber },
      ...rows.slice(index + 1),
    ])
    setStatus('idle')
  }

  function rename(index: number, roundName: string) {
    setRows(rows.map((row, i) => (i === index ? { ...row, roundName } : row)))
    setStatus('idle')
  }

  async function save() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await setRounds(
        tournament.tournamentId,
        rows.map((row): TournamentRoundConfig => ({
          roundId: row.roundId,
          roundName: row.roundName,
          firstMatchNumber: row.firstMatchNumber,
          lastMatchNumber: row.lastMatchNumber,
        })),
      )
      setStatus('saved')
      onSaved()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  if (lastMatchNumber === 0) {
    return (
      <EditorCard title="Rounds">
        <p className="text-sm text-subtle-foreground">
          There are no matches to put in rounds yet.
        </p>
      </EditorCard>
    )
  }

  const named = rows.every((row) => row.roundName.trim() !== '')

  return (
    <EditorCard title="Rounds">
      <p className="text-sm text-muted-foreground">
        A phase of the tournament. Every match is in exactly one, because a
        gameweek is built from a round's matches.
      </p>

      <ul className="mt-5 divide-y border-t border-b">
        {rows.map((row, index) => (
          <li
            key={row.roundId ?? `new-${row.firstMatchNumber}`}
            className="flex flex-wrap items-center gap-3 py-3"
          >
            <Input
              value={row.roundName}
              onChange={(e) => rename(index, e.target.value)}
              aria-label={`Name of round ${index + 1}`}
              className="min-w-40 flex-1"
              maxLength={40}
            />
            <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
              {row.firstMatchNumber === row.lastMatchNumber
                ? `match ${row.firstMatchNumber}`
                : `matches ${row.firstMatchNumber}–${row.lastMatchNumber}`}
            </span>
            {/*
              Only the second round onwards can merge, and only backwards. That
              is what stops a merge from ever leaving a gap.
            */}
            {index > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => mergeIntoPrevious(index)}
              >
                Merge up
              </Button>
            )}
          </li>
        ))}
      </ul>

      {splitPoints.length > 0 && (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label
              htmlFor="split-at"
              className="text-xs font-normal text-muted-foreground"
            >
              Start a new round at
            </Label>
            <Select value={splitAt} onValueChange={setSplitAt}>
              <SelectTrigger id="split-at" className="w-40">
                <SelectValue placeholder="Pick a match" />
              </SelectTrigger>
              <SelectContent>
                {splitPoints.map((number) => (
                  <SelectItem key={number} value={String(number)}>
                    Match {number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            disabled={splitAt === ''}
            onClick={() => split(Number(splitAt))}
          >
            Split
          </Button>
        </div>
      )}

      <EditorFooter
        status={status}
        message={message}
        savedLabel={`${rows.length} ${rows.length === 1 ? 'round' : 'rounds'} saved.`}
        onSave={() => void save()}
        disabled={!named}
      />

      {!named && (
        <p className="mt-2 text-sm text-destructive">
          Every round needs a name.
        </p>
      )}
    </EditorCard>
  )
}

/** **Ordered by `matchNumber`, never by id.** */
function rowsFromTournament(tournament: Tournament): RoundRow[] {
  const matches = tournament.matches ?? {}
  const numberOf = (matchId: MatchId) => matches[matchId]?.matchNumber ?? 0

  return Object.values(tournament.rounds ?? {})
    .map((round) => ({
      roundId: round.roundId,
      roundName: round.roundName,
      firstMatchNumber: numberOf(round.firstMatchId),
      lastMatchNumber: numberOf(round.lastMatchId),
    }))
    .sort((a, b) => a.firstMatchNumber - b.firstMatchNumber)
}
