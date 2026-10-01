/**
 * `competitions/{competitionId}`.
 *
 * The interface calls this a **Base Tournament**: IPL, ODI World Cup, Generic
 * ODI. It is the thing a `Tournament` is one running of, and it is a
 * system-admin concept that never appears in user-facing copy under this name.
 */

import type { CompetitionId } from './ids.ts'
import type { Format } from './reference.ts'

/**
 * DERIVED: nothing. This node is as small as it looks.
 *
 * JOIN: `formatId` → `formats`, for the display name. The format is inherited
 * by every tournament under this competition rather than set on each one.
 */
/**
 * **The home nation when none is set** — on a base tournament, or on a
 * tournament created before the field existed. India, because nearly every
 * league this product runs is an Indian one. Applied where the home nation is
 * read, never written into the data, so setting one later still wins.
 */
export const DEFAULT_HOME_NATION = 'India'

export interface Competition {
  competitionId: CompetitionId
  competitionName: string
  formatId: Format

  /**
   * **Who is not overseas here** — IPL → India, BBL → Australia. A player whose
   * country is anything else counts as overseas in this competition's
   * tournaments.
   *
   * **Absent means India** (`DEFAULT_HOME_NATION`), wherever it is read.
   *
   * **Copied onto each tournament at creation**, not read from here, so editing
   * it never changes who is overseas under a tournament already running.
   */
  homeNation?: string
}
