import { PLAYER_ROLES } from '@fantasy-cricket/shared'

import { overseasCount, type OverseasRule } from './lineup-rules'
import type {
  LineupRules,
  Player,
  PlayerId,
  PlayerRole,
} from '@fantasy-cricket/shared'

const XI = 11

/**
 * The panel beside the XI, updating as selections change.
 *
 * **This is doing real work, not decorating.** With free slots it is the only
 * thing telling a manager whether their team is legal, so a breached limit is
 * called out in red with the limit it breached rather than merely counted.
 *
 * It closes with a sentence saying what is still wrong, because a column of
 * numbers makes someone work out the answer that the panel already knows.
 *
 * **Overseas is shown only where there is a cap** — auction leagues. Overseas
 * means a country other than the tournament's home nation; a regular league
 * has no cap, so a count there would be noise.
 */
export function LineupSummary({
  selected,
  rules,
  captainId,
  viceCaptainId,
  overseas,
}: {
  selected: readonly Player[]
  rules: LineupRules
  captainId: PlayerId | undefined
  viceCaptainId: PlayerId | undefined
  /** Auction leagues only. */
  overseas?: OverseasRule
}) {
  const nameOf = (id: PlayerId | undefined) =>
    selected.find((p) => p.playerId === id)?.playerShortName

  return (
    <aside className="lit rounded-xl border bg-secondary/30 p-5">
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        Summary
      </p>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="text-[15px]">Selected</span>
        <span className="font-mono text-sm">
          {selected.length} of {XI}
        </span>
      </div>

      <dl className="mt-4 grid gap-2.5 border-t pt-4 text-[15px]">
        {PLAYER_ROLES.map((role) => (
          <RoleCount
            key={role}
            role={role}
            count={selected.filter((p) => p.playerRole === role).length}
            rule={rules[role]}
          />
        ))}
        {overseas !== undefined && (
          <OverseasRow
            count={overseasCount(selected, overseas.homeNation)}
            cap={overseas.cap}
          />
        )}
      </dl>

      <dl className="mt-4 grid gap-2.5 border-t pt-4 text-[15px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt>Captain</dt>
          <dd className="font-mono text-sm text-muted-foreground">
            {nameOf(captainId) ?? '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>Vice captain</dt>
          <dd className="font-mono text-sm text-muted-foreground">
            {nameOf(viceCaptainId) ?? '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-subtle-foreground">
        {verdict(selected, rules, captainId, viceCaptainId, overseas)}
      </p>
    </aside>
  )
}

function RoleCount({
  role,
  count,
  rule,
}: {
  role: PlayerRole
  count: number
  rule: LineupRules[PlayerRole]
}) {
  // Absent max means no upper limit, so only a minimum can be breached upward.
  const short = rule !== undefined && count < rule.min
  const over = rule?.max !== undefined && count > rule.max

  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>{LABEL[role]}</dt>
      <dd className="flex items-baseline gap-2.5 font-mono text-sm">
        <span className={short || over ? 'text-destructive' : ''}>{count}</span>
        {short && <span className="text-destructive">min {rule.min}</span>}
        {over && rule.max !== undefined && (
          <span className="text-destructive">max {rule.max}</span>
        )}
      </dd>
    </div>
  )
}

function OverseasRow({ count, cap }: { count: number; cap?: number }) {
  const over = cap !== undefined && count > cap
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>Overseas</dt>
      <dd className="flex items-baseline gap-2.5 font-mono text-sm">
        <span className={over ? 'text-destructive' : ''}>{count}</span>
        {cap !== undefined && (
          <span className={over ? 'text-destructive' : 'text-muted-foreground'}>
            max {cap}
          </span>
        )}
      </dd>
    </div>
  )
}

/** One sentence saying what is still wrong, or that nothing is. */
function verdict(
  selected: readonly Player[],
  rules: LineupRules,
  captainId: PlayerId | undefined,
  viceCaptainId: PlayerId | undefined,
  overseas: OverseasRule | undefined,
): string {
  const short = PLAYER_ROLES.filter((role) => {
    const rule = rules[role]
    return (
      rule !== undefined &&
      selected.filter((p) => p.playerRole === role).length < rule.min
    )
  })

  const missing = XI - selected.length
  const parts: string[] = []

  if (missing > 0) {
    parts.push(missing === 1 ? 'One slot left.' : `${missing} slots left.`)
  }

  for (const role of short) {
    const rule = rules[role]
    if (rule === undefined) continue
    const have = selected.filter((p) => p.playerRole === role).length
    parts.push(
      `You need at least ${rule.min} ${LABEL[role].toLowerCase()}, and you have ${have}.`,
    )
  }

  for (const role of PLAYER_ROLES) {
    const max = rules[role]?.max
    const have = selected.filter((p) => p.playerRole === role).length
    if (max !== undefined && have > max) {
      parts.push(
        `At most ${max} ${LABEL[role].toLowerCase()} are allowed, and you have ${have}.`,
      )
    }
  }

  if (overseas?.cap !== undefined) {
    const have = overseasCount(selected, overseas.homeNation)
    if (have > overseas.cap) {
      parts.push(
        `At most ${overseas.cap} overseas players are allowed, and you have ${have}.`,
      )
    }
  }

  if (captainId === undefined || viceCaptainId === undefined) {
    parts.push('Pick a captain and a vice captain.')
  } else if (captainId === viceCaptainId) {
    parts.push('The captain and vice captain must be different.')
  }

  return parts.length === 0
    ? 'This team is legal and ready to submit.'
    : parts.join(' ')
}

const LABEL: Record<PlayerRole, string> = {
  batsman: 'Batsmen',
  bowler: 'Bowlers',
  wicketKeeper: 'Keepers',
  allRounder: 'All rounders',
}
