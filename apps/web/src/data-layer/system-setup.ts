/**
 * Seeding an environment with the reference data everything else depends on.
 *
 * Run once per environment, from a button on the admin page. **It writes to
 * whichever environment is active**, so pressing it on production seeds
 * production and pressing it locally seeds local.
 *
 * Safe to press twice: the backend reads its own marker first and does nothing
 * if the environment is already set up.
 *
 * TODO: this does not check the caller's role. The route guard on `/admin`
 * hides the button, but that is convenience — the layer is the actual check.
 */

import type {
  SamplePlayersResult,
  SampleTournamentResult,
  SeedDataResult,
  StandardsRefreshResult,
  SystemSetupResult,
  SystemStatus,
} from '@fantasy-cricket/shared'
import { getApi } from './api'

export type {
  SamplePlayersResult,
  SampleTournamentResult,
  SeedDataResult,
  StandardsRefreshResult,
  SystemSetupResult,
  SystemStatus,
}

export function setUpBasicSystem(): Promise<SystemSetupResult> {
  return getApi().setUpBasicSystem()
}

/**
 * Two international T20 squads, so there is something to pick from.
 *
 * **Test data rather than reference data**, so it has no marker and no
 * once-per-environment guard. Names already in the catalogue are skipped, which
 * is what makes pressing it twice safe.
 *
 * It needs the basic system first, since the base tournament it puts them in is
 * seeded by that.
 */
export function createSamplePlayers(): Promise<SamplePlayersResult> {
  return getApi().createSamplePlayers()
}

/**
 * **Wipes this environment and loads the IPL 2026 test data**: the ten
 * franchises, thirteen national teams and 250 players. Refused in production.
 */
export function populateSeedData(): Promise<SeedDataResult> {
  return getApi().populateSeedData()
}

/**
 * **An unpublished IPL 2027 on the 2026 schedule**, with every IPL team and
 * player in it. Publishing is left to the admin. Refused in production.
 */
export function createSampleIplTournament(): Promise<SampleTournamentResult> {
  return getApi().createSampleIplTournament()
}

/**
 * **Rewrites the reference tables and the standards** from the seed data, for
 * an environment seeded before they changed. System owner only; refused once
 * the environment is released.
 */
export function refreshStandards(): Promise<StandardsRefreshResult> {
  return getApi().refreshStandards()
}

/** Which environment this is, and whether its testing tools are switched off. */
export function getSystemStatus(): Promise<SystemStatus> {
  return getApi().getSystemStatus()
}
