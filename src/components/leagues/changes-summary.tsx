import type { Player, PlayerId } from '@/types'

/** A team as stored for one period, with what was left after it. */
export interface SavedTeam {
  lineup: readonly Player[]
  captainId: PlayerId
  viceCaptainId: PlayerId
  /** Absent means unlimited, which is how the model spells no allowance. */
  changesRemaining?: number
  captainChangesRemaining?: number
  viceCaptainChangesRemaining?: number
}

/** What a manager may change across the league. Absent means unlimited. */
export interface Allowances {
  teamChanges?: number
  captainChanges?: number
  viceCaptainChanges?: number
}

/**
 * What a change costs, below the eleven it is measured against.
 *
 * **The baseline is the PREVIOUS period's team, never this one's own.** A match
 * is not locked until its deadline, so until then it can be rearranged as often
 * as you like, and what is measured is how it differs from the one before. Swap
 * Hardik for Virat and then Virat for Rohit, and it is still one change.
 *
 * **The first period has no baseline**, and neither does a manager's first ever
 * team. Nothing is spent in either case, and it reads as no changes rather than
 * as a hidden rule.
 *
 * **One change is one player out and one player in**, so swapping three spends
 * three. Captain and vice-captain changes are counted separately, against their
 * own allowances, and neither is a team change.
 *
 * `lineup` is the draft in the editing view and the saved team in a locked one,
 * so the same box reads as "what this will cost" before the deadline and "what
 * was spent" after it.
 */
export function ChangesSummary({
  baseline,
  allowances,
  lineup,
  captainId,
  viceCaptainId,
  isGameWeek,
}: {
  baseline: SavedTeam | undefined
  allowances: Allowances
  lineup: readonly Player[]
  /** Undefined while the draft has not chosen one, which counts as unchanged. */
  captainId: PlayerId | undefined
  viceCaptainId: PlayerId | undefined
  /** Only changes the wording: "this match" or "this game week". */
  isGameWeek: boolean
}) {
  const nextIds = lineup.map((p) => p.playerId)

  const out =
    baseline === undefined
      ? []
      : baseline.lineup.filter((p) => !nextIds.includes(p.playerId))

  const inbound =
    baseline === undefined
      ? []
      : lineup.filter(
          (p) => !baseline.lineup.some((b) => b.playerId === p.playerId),
        )

  const captainChanged =
    baseline !== undefined &&
    captainId !== undefined &&
    captainId !== baseline.captainId

  const viceCaptainChanged =
    baseline !== undefined &&
    viceCaptainId !== undefined &&
    viceCaptainId !== baseline.viceCaptainId

  const nameOf = (id: PlayerId | undefined) =>
    [...(baseline?.lineup ?? []), ...lineup].find((p) => p.playerId === id)
      ?.playerShortName ?? '—'

  /*
    **What was available before this period**, which is the baseline's remaining
    count or, where there is none, the league's allowance. The layer derives it
    the same way, so re-saving can never drift from what is shown here.
  */
  const teamBefore = baseline?.changesRemaining ?? allowances.teamChanges
  const captainBefore =
    baseline?.captainChangesRemaining ?? allowances.captainChanges
  const viceCaptainBefore =
    baseline?.viceCaptainChangesRemaining ?? allowances.viceCaptainChanges

  const period = isGameWeek ? 'game week' : 'match'

  return (
    <aside className="lit mt-4 rounded-xl border bg-secondary/30 p-5">
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        Transfers ({out.length} used this {period})
      </p>

      <dl className="mt-4 grid gap-2.5 text-[15px]">
        <Row
          label="Players out"
          value={out.map((p) => p.playerShortName).join(', ')}
        />
        <Row
          label="Players in"
          value={inbound.map((p) => p.playerShortName).join(', ')}
        />
        <Remaining
          label="Transfers remaining"
          spent={out.length}
          before={teamBefore}
        />
      </dl>

      <dl className="mt-4 grid gap-2.5 border-t pt-4 text-[15px]">
        {captainChanged && baseline !== undefined ? (
          <>
            <Row label="Captain out" value={nameOf(baseline.captainId)} />
            <Row label="Captain in" value={nameOf(captainId)} />
          </>
        ) : (
          <Row label="Captain" value="unchanged" />
        )}
        <Remaining
          label="Captain changes remaining"
          spent={captainChanged ? 1 : 0}
          before={captainBefore}
        />
      </dl>

      <dl className="mt-4 grid gap-2.5 border-t pt-4 text-[15px]">
        {viceCaptainChanged && baseline !== undefined ? (
          <>
            <Row
              label="Vice captain out"
              value={nameOf(baseline.viceCaptainId)}
            />
            <Row label="Vice captain in" value={nameOf(viceCaptainId)} />
          </>
        ) : (
          <Row label="Vice captain" value="unchanged" />
        )}
        <Remaining
          label="Vice captain changes remaining"
          spent={viceCaptainChanged ? 1 : 0}
          before={viceCaptainBefore}
        />
      </dl>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-sm text-muted-foreground">
        {value === '' ? 'none' : value}
      </dd>
    </div>
  )
}

/**
 * **What is left after this period's changes**: the allowance there was before
 * it, minus what it uses. Both are measured from the previous period rather
 * than a running total, so it reads the same before and after saving and a
 * second save cannot disturb it.
 *
 * Red once it would overspend, which the layer refuses to save.
 */
function Remaining({
  label,
  spent,
  before,
}: {
  label: string
  spent: number
  before: number | undefined
}) {
  const over = before !== undefined && spent > before

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{label}</dt>
      <dd
        className={`font-mono text-sm ${over ? 'text-destructive' : 'text-muted-foreground'}`}
      >
        {before === undefined ? 'Unlimited' : String(before - spent)}
      </dd>
    </div>
  )
}
