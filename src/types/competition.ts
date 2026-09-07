/**
 * `competitions/{competitionId}`.
 *
 * The interface calls this a **Base Tournament**: IPL, ODI World Cup, Generic
 * ODI. It is the thing a `Tournament` is one running of, and it is a
 * system-admin concept that never appears in user-facing copy under this name.
 */

import type { CompetitionId } from './ids'
import type { Format } from './reference'

/**
 * DERIVED: nothing. This node is as small as it looks.
 *
 * JOIN: `formatId` → `formats`, for the display name. The format is inherited
 * by every tournament under this competition rather than set on each one.
 *
 * NOT MODELLED HERE: there is no home-country field, which is why the overseas
 * rule is currently hardcoded to India. That is correct for the IPL and wrong
 * for any competition that is not an Indian one. See `05-data-model.md`.
 */
export interface Competition {
  competitionId: CompetitionId
  competitionName: string
  formatId: Format
}
