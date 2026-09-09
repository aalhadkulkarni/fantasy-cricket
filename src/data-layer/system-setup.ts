/**
 * Seeding an environment with the reference data everything else depends on.
 *
 * Run once per environment, from a button on the admin page. **It writes to
 * whichever root is active**, so pressing it on production seeds `prod/` and
 * pressing it locally seeds `local/`. Nothing here has to arrange that — every
 * path is built through `paths`, which cannot produce one outside the active
 * root.
 *
 * ---
 *
 * **TODO: this reaches `getFirebaseService()` directly**, which is not how the
 * app should work. Product operations go through `ApiService` so the backend
 * can be swapped. This is a setup routine rather than a product operation, and
 * `ApiService` carries no operations yet, so it is the acknowledged temporary
 * shape. It moves when the interface grows.
 *
 * **TODO: no auth guard.** Anyone reaching `/admin` can run it. Accepted for
 * now — there are no users, and the guard below makes a second run a no-op.
 * The button goes behind the system-admin role once auth exists.
 */

import type { CompetitionId, SystemSetup } from '@/types'

import { getFirebaseService } from './firebase/firebase-service'
import { paths } from './firebase/paths'
import {
  AUCTION_PHASE_RECORDS,
  FORMAT_RECORDS,
  PLAYER_CATEGORY_RECORDS,
  PLAYER_ROLE_RECORDS,
  SEED_COMPETITIONS,
  STANDARD_AUCTION_CONFIG,
  STANDARD_FANTASY_LINEUP_RULES,
  STANDARD_TEAM_CHANGES_DEADLINE_OFFSET,
  TIMELINE_EVENT_RECORDS,
  USER_ROLES,
} from './seed-data'

/** What happened, so the caller can say something more useful than "done". */
export interface SystemSetupResult {
  status: 'seeded' | 'alreadyDone'
  /** Which root was written to, or would have been. */
  environment: string
  /** Node name to entry count. Empty when nothing was written. */
  written: Record<string, number>
  /** When the environment was originally seeded. */
  completedAt: number
}

/**
 * Seeds the reference tables and the standards, once.
 *
 * **Reads `systemSetup` first and does nothing if it is already there.** The
 * marker is written inside the same atomic update as everything else, so either
 * the whole seed landed and the marker exists, or neither happened.
 *
 * That guard matters most for competitions. They are keyed by push key rather
 * than by name, so a second run would create six *more* rather than overwriting
 * six, and nothing afterwards would say which set was real. Every other table
 * is keyed by name and would merely be rewritten identically.
 */
export async function setUpBasicSystem(): Promise<SystemSetupResult> {
  const service = getFirebaseService()

  const existing = await service.read<SystemSetup>(paths.systemSetup())
  if (existing !== undefined) {
    return {
      status: 'alreadyDone',
      environment: service.root,
      written: {},
      completedAt: existing.completedAt,
    }
  }

  /*
    Push keys are generated locally with no network call, which is what lets the
    competitions be part of a single atomic update — their ids have to exist
    before the update object can be assembled.
  */
  const competitions = SEED_COMPETITIONS.map((competition) => {
    const competitionId = service.generateKey() as CompetitionId
    return { competitionId, ...competition }
  })

  const completedAt = Date.now()

  const changes: Record<string, unknown> = {
    [paths.userRoles()]: USER_ROLES,
    [paths.formats()]: FORMAT_RECORDS,
    [paths.playerRoles()]: PLAYER_ROLE_RECORDS,
    [paths.playerCategories()]: PLAYER_CATEGORY_RECORDS,
    [paths.liveAuctionPhases()]: AUCTION_PHASE_RECORDS,
    [paths.timelineEvents()]: TIMELINE_EVENT_RECORDS,

    [paths.competitions()]: Object.fromEntries(
      competitions.map((c) => [c.competitionId, c]),
    ),

    [paths.standardAuctionConfig()]: STANDARD_AUCTION_CONFIG,
    [paths.standardFantasyLineupRules()]: STANDARD_FANTASY_LINEUP_RULES,
    [paths.standardFantasyLeagueTeamChangesDeadlineOffset()]:
      STANDARD_TEAM_CHANGES_DEADLINE_OFFSET,

    // Last, but written in the same call, so it can never mark an incomplete seed.
    [paths.systemSetup()]: { completedAt } satisfies SystemSetup,
  }

  await service.update(changes)

  return {
    status: 'seeded',
    environment: service.root,
    completedAt,
    written: {
      userRoles: Object.keys(USER_ROLES).length,
      formats: Object.keys(FORMAT_RECORDS).length,
      playerRoles: Object.keys(PLAYER_ROLE_RECORDS).length,
      playerCategories: Object.keys(PLAYER_CATEGORY_RECORDS).length,
      liveAuctionPhases: Object.keys(AUCTION_PHASE_RECORDS).length,
      timelineEvents: Object.keys(TIMELINE_EVENT_RECORDS).length,
      competitions: competitions.length,
    },
  }
}
