/**
 * **Catalogue rules the service and the browser both need**, so a bulk
 * export and a bulk import read a player's teams the same way.
 */

/**
 * **Which base tournaments each international format means**, by name. A
 * player who plays T20Is is in their nation's team in both the T20 ones, and
 * so on. Every national team is in all five, and a player represents the same
 * one in each.
 */
export const FORMAT_COMPETITIONS = {
  t20: ['T20 Series', 'World T20'],
  odi: ['ODI Series', 'ODI World Cup'],
  test: ['Test Series'],
} as const
export type IntlFormat = keyof typeof FORMAT_COMPETITIONS

/** The five international base tournaments, by name. */
export const INTERNATIONAL_COMPETITIONS: readonly string[] =
  Object.values(FORMAT_COMPETITIONS).flat()

/**
 * **The leagues bulk upload has a column for**, by base tournament name, in
 * column order. A player's team in each is matched within that base
 * tournament.
 */
export const LEAGUE_COLUMNS = ['IPL', 'BBL'] as const
