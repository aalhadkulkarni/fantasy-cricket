/**
 * What the player dialog holds while it is open, and the conversions either
 * side of it.
 *
 * Separate from the component only because ESLint's
 * `react-refresh/only-export-components` will not have a component file export
 * anything else. Same reason the auth context is split from its provider.
 */

import type {
  CompetitionId,
  Player,
  PlayerCategory,
  PlayerRole,
  TeamId,
} from '@fantasy-cricket/shared'

export interface PlayerFields {
  playerName: string
  playerShortName: string
  country: string
  playerRole: PlayerRole
  /** Empty until picked. Required for a new player. */
  playerCategory: PlayerCategory | ''
  /** As typed, so a half-typed "2." is not rewritten under the cursor. */
  playerBasePrice: string
  /** No entry for a competition means the player does not play in it. */
  teams: Partial<Record<CompetitionId, TeamId>>
}

export function emptyFields(): PlayerFields {
  return {
    playerName: '',
    playerShortName: '',
    country: '',
    playerRole: 'batsman',
    playerCategory: '',
    playerBasePrice: '',
    teams: {},
  }
}

export function fieldsFromPlayer(player: Player): PlayerFields {
  return {
    playerName: player.playerName,
    playerShortName: player.playerShortName,
    country: player.country,
    playerRole: player.playerRole,
    playerCategory: player.playerCategory ?? '',
    playerBasePrice:
      player.playerBasePrice === undefined
        ? ''
        : String(player.playerBasePrice),
    teams: { ...(player.currentTeams ?? {}) },
  }
}

/** Display names for the three categories. The ids are the model's. */
export const CATEGORY_NAMES: Readonly<Record<PlayerCategory, string>> = {
  marquee: 'Marquee',
  star: 'Star',
  general: 'General',
}

/**
 * The typed base price as a number, or nothing if it is not one the service
 * would accept: above zero and on the 0.5 grid every bid moves along.
 */
export function parseBasePrice(typed: string): number | undefined {
  if (typed.trim() === '') return undefined
  const price = Number(typed)
  if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(price * 2)) {
    return undefined
  }
  return price
}

/**
 * The countries a player can be picked from, and a base tournament's home
 * nation.
 *
 * **Plain strings, and a UI list rather than a reference table.** The model
 * keeps `country` as free text because the only thing it drives is the overseas
 * rule — a player's country against a tournament's home nation — and that only
 * needs the two strings to match. Storing this as a sixth reference table would
 * imply a precision the model does not have.
 *
 * Every full member plus the associates that have played a World Cup. India
 * leads because most of the catalogue is Indian. Adding one is editing this
 * line; anything already stored that is not here stays selected on the player
 * it belongs to.
 */
export const COUNTRIES = [
  'India',
  'Australia',
  'England',
  'New Zealand',
  'South Africa',
  'Pakistan',
  'West Indies',
  'Sri Lanka',
  'Bangladesh',
  'Afghanistan',
  'Zimbabwe',
  'Ireland',
  'Netherlands',
  'Scotland',
  'Nepal',
  'UAE',
  'USA',
  'Namibia',
] as const

/**
 * The list, plus whatever this player already has if it is not on it. A country
 * dropped from the list would otherwise silently blank the country of every
 * player stored with it.
 */
export function countryOptions(current: string): readonly string[] {
  if (current === '') return COUNTRIES
  if (COUNTRIES.includes(current as (typeof COUNTRIES)[number]))
    return COUNTRIES

  return [current, ...COUNTRIES]
}

/**
 * The short name a blank field falls back to on save. Right often enough —
 * Bumrah, Kohli, Cummins — to save real typing.
 */
export function lastWord(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length === 0 ? '' : (words[words.length - 1] ?? '')
}
