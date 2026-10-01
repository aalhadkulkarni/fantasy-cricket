import { useState } from 'react'

import { EditorCard } from '@/components/admin/editor-card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { publishTournament } from '@/data-layer'
import type { MatchId, RoundId, Tournament } from '@fantasy-cricket/shared'

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
  // Unticked by default: an auction is an explicit opt-in, not a baseline.
  const [auction, setAuction] = useState(false)
  /* As the input holds it, "2026-12-20T19:30", in the admin's own time zone. */
  const [auctionStart, setAuctionStart] = useState('')
  /* No preselection: a length is a decision about the league, and "the whole
     round" was the accidental default this replaced. */
  const [lengths, setLengths] = useState<Partial<Record<RoundId, number>>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const dated = Object.values(tournament.matches ?? {}).filter(
    (match) => match.startTimestamp !== undefined,
  ).length
  const players = Object.keys(tournament.participatingPlayers ?? {}).length

  const existing = Object.keys(tournament.leagues ?? {}).length

  const wantsLeague = matchBased || gameWeekBased || auction

  // An auction league is gameweek-based too, so it needs the same lengths.
  const needsLengths = gameWeekBased || auction
  const rounds = roundSpans(tournament)
  const lengthsMissing =
    needsLengths && rounds.some((round) => lengths[round.roundId] === undefined)

  const auctionStartTime =
    auctionStart === '' ? undefined : new Date(auctionStart).getTime()
  const startMissing = auction && auctionStartTime === undefined

  // The gate is enforced in the data layer. Disabling here is convenience, and
  // saying why is the part that matters. Once published there is nothing left
  // to do unless a league is being asked for.
  const canPublish =
    dated > 0 &&
    status !== 'saving' &&
    (!published || wantsLeague) &&
    !lengthsMissing &&
    !startMissing

  async function publish() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await publishTournament(tournament.tournamentId, {
        matchBased,
        gameWeekBased,
        ...(needsLengths ? { gameWeekLengths: lengths } : {}),
        ...(auction && auctionStartTime !== undefined
          ? { auction: { auctionStartTime } }
          : {}),
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

        <label className="flex items-center gap-2.5 text-sm">
          <Checkbox
            checked={auction}
            onCheckedChange={(checked) => setAuction(checked === true)}
          />
          Official auction league
        </label>

        {/*
          Checked in the service too: in the future, and before the first
          match, since squads have to be won before teams can be picked.
        */}
        {auction && (
          <div className="grid gap-2 rounded-md border p-3">
            <Label htmlFor="auction-start">Auction starts</Label>
            <Input
              id="auction-start"
              type="datetime-local"
              value={auctionStart}
              onChange={(e) => setAuctionStart(e.target.value)}
              className="w-full sm:w-64"
            />
            <p className="text-xs text-subtle-foreground">
              Six managers, standard auction rules, and joining closes when the
              auction starts. You run it as the auctioneer. Players without
              auction values go in as General at 2.
            </p>
          </div>
        )}

        {/*
          One choice per round, serving every gameweek league this publish
          opens. Only divisors are offered, since gameweeks are equal length
          within a round; the service refuses anything else regardless.
        */}
        {needsLengths && (
          <div className="mt-1 grid gap-3 rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              Matches per gameweek, for each round. A one-match gameweek has no
              impact sub.
            </p>
            {rounds.map((round) => (
              <div
                key={round.roundId}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <Label htmlFor={`length-${round.roundId}`} className="min-w-0">
                  <span className="truncate">{round.roundName}</span>
                  <span className="font-normal text-subtle-foreground">
                    {round.span} {round.span === 1 ? 'match' : 'matches'}
                  </span>
                </Label>
                <Select
                  value={
                    lengths[round.roundId] === undefined
                      ? ''
                      : String(lengths[round.roundId])
                  }
                  onValueChange={(value) =>
                    setLengths((current) => ({
                      ...current,
                      [round.roundId]: Number(value),
                    }))
                  }
                >
                  <SelectTrigger
                    id={`length-${round.roundId}`}
                    className="w-44"
                  >
                    <SelectValue placeholder="Choose length" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisorsOf(round.span).map((length) => (
                      <SelectItem key={length} value={String(length)}>
                        {length} per gameweek · {round.span / length}{' '}
                        {round.span / length === 1 ? 'gameweek' : 'gameweeks'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/*
          Worth stating rather than discovering. Whoever publishes owns and
          administers these leagues but is not a manager in them — a manager has
          a fantasy team name, and that is chosen on joining.
        */}
        {wantsLeague && (
          <p className="text-xs text-subtle-foreground">
            Public and standard points. The match and gameweek leagues take up
            to 200 managers. You own and administer every league but do not play
            — join like anyone else to pick a team.
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
        {dated > 0 && startMissing && (
          <span className="text-sm text-subtle-foreground">
            Choose when the auction starts.
          </span>
        )}
        {dated > 0 && lengthsMissing && (
          <span className="text-sm text-subtle-foreground">
            Choose a gameweek length for every round.
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

/** Each round in fixture order, with how many matches it spans. */
function roundSpans(
  tournament: Tournament,
): { roundId: RoundId; roundName: string; span: number }[] {
  const matches = tournament.matches ?? {}
  const numberOf = (matchId: MatchId) => matches[matchId]?.matchNumber ?? 0

  return Object.values(tournament.rounds ?? {})
    .map((round) => ({
      roundId: round.roundId,
      roundName: round.roundName,
      first: numberOf(round.firstMatchId),
      span: numberOf(round.lastMatchId) - numberOf(round.firstMatchId) + 1,
    }))
    .sort((a, b) => a.first - b.first)
    .map(({ roundId, roundName, span }) => ({ roundId, roundName, span }))
}

/** 1 to n, every length a round of n matches divides into evenly. */
function divisorsOf(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0)
}
