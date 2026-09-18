import { useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  getLeagueDetails,
  markLeagueFinished,
  unmarkLeagueFinished,
} from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import type { LeagueDetails as Details } from '@/types'

/**
 * League Details — `/leagues/:leagueId/details`.
 *
 * **Read-only for now.** The configuration a league was created with, in one
 * place. Editing, with a lock per field, comes with the Admin Center.
 *
 * **Marking the league finished lives here until then**, for the owner and
 * admins. It is manual because only a person knows whether every point and
 * correction is in, and reversible because a finish marked too early should be
 * put back rather than lived with.
 */
export function LeagueDetails() {
  const { league, reload } = useLeague()

  const [details, setDetails] = useState<Details | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getLeagueDetails(league.leagueId)
        if (cancelled) return
        setDetails(loaded)
        setError(undefined)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [league.leagueId, reloadToken])

  const isAdmin =
    league.myRoles.leagueOwner === true || league.myRoles.leagueAdmin === true

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
        League Details
      </h2>

      {error !== undefined ? (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-destructive">
            Could not load the league details
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {error}
          </p>
        </div>
      ) : details === undefined ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Box title="League">
            <Row label="Name" value={details.leagueName} />
            <Row label="Tournament" value={details.tournamentName} />
            <Row label="Owner" value={details.ownerName} />
            <Row
              label="Type"
              value={details.isAuctionEnabled ? 'Auction' : 'Regular'}
            />
            <Row
              label="Entry"
              value={
                details.leagueEntry === 'Open'
                  ? 'Public — anyone can join'
                  : 'Closed — by request'
              }
            />
            <Row
              label="Managers"
              value={`${details.managers} of ${details.maxSlots}`}
            />
          </Box>

          <Box title="Teams">
            <Row
              label="Picked per"
              value={details.isGameWeeksEnabled ? 'Game week' : 'Match'}
            />
            <Row label="Deadline" value={offset(details.deadlineOffset)} />
            <Row
              label="Scoring"
              value={details.isCustomScoringSystem ? 'Custom' : 'Standard'}
            />
            <Row label="Captain" value="2× points" />
            <Row label="Vice captain" value="1.5× points" />
            {details.scoringRulesText !== undefined && (
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">
                {details.scoringRulesText}
              </p>
            )}
          </Box>

          {details.isGameWeeksEnabled ? (
            <Box title="Rounds">
              {details.rounds.length === 0 ? (
                <p className="text-sm text-subtle-foreground">
                  No rounds configured.
                </p>
              ) : (
                details.rounds.map((round, index) => (
                  <div
                    key={index}
                    className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0"
                  >
                    <p className="font-medium">
                      {round.roundName === ''
                        ? `Round ${index + 1}`
                        : round.roundName}
                    </p>
                    <Row label="Game weeks" value={String(round.gameWeeks)} />
                    <Row
                      label="Changes going in"
                      value={cap(round.beforeRoundCap)}
                    />
                    <Row
                      label="Changes between game weeks"
                      value={cap(round.betweenGameWeeksCap)}
                    />
                    <Row
                      label="Impact sub"
                      value={
                        round.isImpactSubAllowed ? 'Allowed' : 'Not allowed'
                      }
                    />
                  </div>
                ))
              )}
            </Box>
          ) : (
            <Box title="Changes">
              <Row
                label="Transfers"
                value={cap(details.changeAllowances.teamChanges)}
              />
              <Row
                label="Captain changes"
                value={cap(details.changeAllowances.captainChanges)}
              />
              <Row
                label="Vice captain changes"
                value={cap(details.changeAllowances.viceCaptainChanges)}
              />
            </Box>
          )}

          {isAdmin && (
            <Finish
              details={details}
              onChanged={() => {
                setReloadToken((n) => n + 1)
                // The phase badge and landing section follow `finishedAt`.
                reload()
              }}
            />
          )}
        </div>
      )}
    </section>
  )
}

/**
 * **Gated on the last match having started**, which the layer enforces too.
 * Nothing records when a match ends, so its start is the nearest check.
 */
function Finish({
  details,
  onChanged,
}: {
  details: Details
  onChanged: () => void
}) {
  // Pinned once; render must not read the clock.
  const [now] = useState(() => Date.now())
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')
  const [message, setMessage] = useState<string | undefined>(undefined)

  const finished = details.finishedAt !== undefined
  const lastStarted =
    details.lastMatchStartsAt !== undefined && details.lastMatchStartsAt <= now

  async function toggle() {
    setStatus('saving')
    setMessage(undefined)
    try {
      await (finished
        ? unmarkLeagueFinished(details.leagueId)
        : markLeagueFinished(details.leagueId))
      setStatus('idle')
      onChanged()
    } catch (e) {
      setStatus('failed')
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Box title="Finish">
      <p className="text-sm text-muted-foreground">
        {finished
          ? `Finished on ${new Date(details.finishedAt ?? 0).toLocaleDateString(
              undefined,
              { day: 'numeric', month: 'short', year: 'numeric' },
            )}.`
          : lastStarted
            ? 'Mark the league finished once every point and correction is in.'
            : 'Available once the last match has started.'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          variant={finished ? 'outline' : 'default'}
          onClick={() => void toggle()}
          disabled={status === 'saving' || (!finished && !lastStarted)}
        >
          {status === 'saving'
            ? 'Saving…'
            : finished
              ? 'Mark as not finished'
              : 'Mark league finished'}
        </Button>
        {status === 'failed' && (
          <span className="font-mono text-xs text-destructive">{message}</span>
        )}
      </div>
    </Box>
  )
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lit rounded-xl border bg-secondary/30 p-5">
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        {title}
      </p>
      <div className="mt-4 grid gap-2.5 text-[15px]">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="min-w-0 text-right font-mono text-sm text-muted-foreground">
        {value}
      </span>
    </div>
  )
}

/** Absent is how the model spells no limit. */
function cap(value: number | undefined): string {
  return value === undefined ? 'Unlimited' : String(value)
}

/** The offset is milliseconds before each match's scheduled start. */
function offset(ms: number): string {
  if (ms <= 0) return 'At the first ball'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min before start`
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h before start`
}
