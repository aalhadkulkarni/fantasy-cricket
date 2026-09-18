import {
  ChangesSummary,
  type Allowances,
  type SavedTeam,
} from '@/components/leagues/changes-summary'
import { LineupSummary } from '@/components/leagues/lineup-summary'
import { LineupView } from '@/components/leagues/lineup-view'
import type { LineupRules, PlayerPoints } from '@/types'

/**
 * **A team that can no longer change**, laid out like the editing view: the
 * eleven with their points on the left, the XI summary and the transfers it
 * cost on the right.
 *
 * One implementation for your own locked team on My Team and for anyone's in
 * the leaderboard's modal, as `leaderboard.md` asks. Whether a team may be seen
 * at all is decided in the layer, never here.
 */
export function LockedTeam({
  team,
  baseline,
  points,
  rules,
  allowances,
  summaryTitle,
}: {
  team: SavedTeam
  /** The period before's team, which the transfers are measured from. */
  baseline: SavedTeam | undefined
  points: PlayerPoints
  rules: LineupRules
  allowances: Allowances
  summaryTitle?: string
}) {
  return (
    <div className="gap-5 lg:flex">
      <div className="min-w-0 flex-1">
        <LineupView
          lineup={team.lineup}
          captainId={team.captainId}
          viceCaptainId={team.viceCaptainId}
          points={points}
          totalLabel="Total"
        />
      </div>

      <div className="mt-5 lg:mt-0 lg:w-[19rem] lg:shrink-0">
        <LineupSummary
          selected={team.lineup}
          rules={rules}
          captainId={team.captainId}
          viceCaptainId={team.viceCaptainId}
          {...(summaryTitle === undefined ? {} : { title: summaryTitle })}
        />

        <ChangesSummary
          baseline={baseline}
          allowances={allowances}
          lineup={team.lineup}
          captainId={team.captainId}
          viceCaptainId={team.viceCaptainId}
        />
      </div>
    </div>
  )
}
