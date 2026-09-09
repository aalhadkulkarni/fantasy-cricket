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

import { getApi, type SystemSetupResult } from './api'

export type { SystemSetupResult }

export function setUpBasicSystem(): Promise<SystemSetupResult> {
  return getApi().setUpBasicSystem()
}
