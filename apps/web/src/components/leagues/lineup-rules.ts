import { PLAYER_ROLES } from '@fantasy-cricket/shared'
import type { LineupRules, Player, PlayerRole } from '@fantasy-cricket/shared'

/**
 * **The overseas cap, where a league has one** — auction leagues only. A
 * player is overseas when their country is not the tournament's home nation.
 * An absent cap is no limit.
 */
export interface OverseasRule {
  homeNation: string
  cap?: number
}

export function overseasCount(
  selected: readonly Player[],
  homeNation: string,
): number {
  return selected.filter((p) => p.country !== homeNation).length
}

/**
 * **Whether an eleven breaks a composition rule**: a role under its minimum or
 * over its maximum, or more overseas than the cap. The same rule the service
 * refuses a save by, so My Team can refuse it first and say why.
 */
export function breaksRules(
  selected: readonly Player[],
  rules: LineupRules,
  overseas: OverseasRule | undefined,
): boolean {
  const roleBroken = PLAYER_ROLES.some((role: PlayerRole) => {
    const rule = rules[role]
    if (rule === undefined) return false
    const count = selected.filter((p) => p.playerRole === role).length
    return count < rule.min || (rule.max !== undefined && count > rule.max)
  })
  const overseasBroken =
    overseas?.cap !== undefined &&
    overseasCount(selected, overseas.homeNation) > overseas.cap
  return roleBroken || overseasBroken
}
