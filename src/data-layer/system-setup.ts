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

import { getApi, type SamplePlayersResult, type SystemSetupResult } from './api'

export type { SamplePlayersResult, SystemSetupResult }

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
