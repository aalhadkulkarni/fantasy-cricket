import { useEffect, useState } from 'react'

import type { SavedTeam } from '@/components/leagues/changes-summary'
import { LockedTeam } from '@/components/leagues/locked-team'
import { PeriodNav } from '@/components/leagues/period-nav'
import { gameWeekPoints, toSaved } from '@/components/leagues/team-data'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getLineupRules,
  getTeamForGameWeek,
  getTeamForMatch,
} from '@/data-layer'
import type {
  GameWeekId,
  LeagueSummary,
  LineupRules,
  MatchId,
  PlayerPoints,
  UserId,
} from '@/types'

/** A locked match or gameweek the modal can show, in schedule order. */
export interface LockedPeriod {
  id: string
  /** "Match 3" or "Game week 2", for the navigation. */
  label: string
  /** The fixture line under the title. */
  subline: string
  matchIds: readonly MatchId[]
  /** A gameweek's cap on changes going into it. Absent means unlimited. */
  changeCap?: number
}

/**
 * **Another manager's team, from the leaderboard.** The same view as My Team's
 * locked one — the shared `LockedTeam` — with no edit affordances.
 *
 * **Only locked periods are offered**, and the layer returns nothing for any
 * other even if asked, so this cannot show a team before its deadline. The
 * modal never decides visibility itself.
 */
export function ManagerTeamDialog({
  league,
  managerId,
  managerName,
  teamName,
  periods,
  initialId,
  onClose,
}: {
  league: LeagueSummary
  managerId: UserId
  managerName: string
  teamName: string | undefined
  periods: readonly LockedPeriod[]
  initialId: string
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState(initialId)
  const [rules, setRules] = useState<LineupRules | undefined>(undefined)

  const [team, setTeam] = useState<SavedTeam | undefined>(undefined)
  const [baseline, setBaseline] = useState<SavedTeam | undefined>(undefined)
  const [points, setPoints] = useState<PlayerPoints>({})
  // Which period the team above was loaded for. Until it matches, the team is
  // unknown rather than absent.
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  const index = periods.findIndex((p) => p.id === selectedId)
  const period = periods[index]
  const previous = index > 0 ? periods[index - 1] : undefined

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await getLineupRules(league.leagueId)
        if (!cancelled) setRules(loaded)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [league.leagueId])

  useEffect(() => {
    if (period === undefined) return
    let cancelled = false

    const teamFor = (id: string) =>
      league.isGameWeeksEnabled
        ? getTeamForGameWeek(league.leagueId, managerId, id as GameWeekId)
        : getTeamForMatch(league.leagueId, managerId, id as MatchId)

    void (async () => {
      try {
        const [theirs, before, scored] = await Promise.all([
          teamFor(period.id),
          previous === undefined ? undefined : teamFor(previous.id),
          gameWeekPoints(league.leagueId, period.matchIds),
        ])
        if (cancelled) return

        setTeam(toSaved(theirs))
        setBaseline(toSaved(before))
        setPoints(scored)
        setError(undefined)
        setLoadedFor(period.id)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [league.leagueId, league.isGameWeeksEnabled, managerId, period, previous])

  const allowances = league.isGameWeeksEnabled
    ? { teamChanges: period?.changeCap }
    : league.changeAllowances

  const reachable = new Set(periods.map((p) => p.id))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{teamName ?? managerName}</DialogTitle>
          <DialogDescription className="font-mono">
            {teamName === undefined ? '' : `${managerName} · `}
            {period?.subline}
          </DialogDescription>
        </DialogHeader>

        {periods.length > 1 && (
          <PeriodNav
            periods={periods}
            selectedId={selectedId}
            reachable={reachable}
            onSelect={setSelectedId}
          />
        )}

        <div className="mt-2">
          {error !== undefined ? (
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                Could not load this team
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {error}
              </p>
            </div>
          ) : loadedFor !== selectedId || rules === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : team === undefined ? (
            <p className="text-sm text-subtle-foreground">
              No team for this one.
            </p>
          ) : (
            <LockedTeam
              team={team}
              baseline={baseline}
              points={points}
              rules={rules}
              allowances={allowances}
              isGameWeek={league.isGameWeeksEnabled}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
