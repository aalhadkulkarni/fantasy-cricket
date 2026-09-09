/**
 * Which deployment this session is running as.
 *
 * **This is application configuration, not a data-layer concern.** The
 * environment is resolved from the hostname the browser is sitting on, which is
 * a fact about the client rather than about any backend. The data layer is
 * simply the first thing that needs it, and it is told rather than deciding.
 *
 * Everything else that turns out to be environment-sensitive — Firebase project
 * settings, auth, analytics, error reporting, feature flags — reads it from
 * here too, rather than reaching into a boundary it has nothing to do with.
 *
 * `docs/05-data-model.md` specifies four of them, with identical database
 * structure beneath each. **They are four roots inside one database**, not four
 * projects, so the environment becomes a path prefix rather than a different
 * connection. The Firebase service is what performs that translation.
 */

/**
 * All four, because the model defines all four.
 *
 * The array doubles as the runtime validator, the same arrangement the
 * reference tables use in `src/types/reference.ts`.
 */
export const ENVIRONMENTS = ['local', 'test', 'preprod', 'prod'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * **Only `local` and `prod` are reachable today.**
 *
 * `test` and `preprod` remain in the union because the model defines them and
 * the database has room for them, but nothing resolves to either. Standing them
 * up would mean separate hosting, service accounts and workflows, which is real
 * work for little immediate benefit at this size.
 *
 * Adding one later is one line here. Nothing else in the codebase changes,
 * because every path already goes through the active root.
 *
 * Firebase provisions both `.web.app` and `.firebaseapp.com` for a hosting
 * site, and both currently serve, so both are mapped. Missing one would mean
 * the app refusing to start on an address that works.
 */
const HOSTNAME_ENVIRONMENTS: Readonly<Record<string, Environment>> = {
  localhost: 'local',
  '127.0.0.1': 'local',

  'fantasy-cricket-league-c0346.web.app': 'prod',
  'fantasy-cricket-league-c0346.firebaseapp.com': 'prod',

  // test:    <hostname> → 'test'
  // preprod: <hostname> → 'preprod'
}

/**
 * A pull request preview channel, which Firebase names
 * `<project>--<channel>-<hash>.web.app`.
 *
 * Those hostnames are generated per pull request, so no fixed table can list
 * them. The double hyphen is the marker, and the production host has none.
 */
const PREVIEW_CHANNEL_HOSTNAME = /--/

/**
 * **Previews resolve to `local`, deliberately.**
 *
 * A preview is somebody checking their own branch, which is the same activity
 * as running the dev server, so it belongs in the same root. What matters is
 * that it is *not* `prod`: a half-finished branch must never be able to touch
 * real data.
 *
 * `test` is where these will eventually belong, once there is a test
 * environment to belong to.
 */
function environmentForHostname(hostname: string): Environment | undefined {
  const mapped = HOSTNAME_ENVIRONMENTS[hostname]
  if (mapped !== undefined) return mapped

  if (PREVIEW_CHANNEL_HOSTNAME.test(hostname)) return 'local'

  return undefined
}

/**
 * **An unknown hostname throws. It does not fall back to anything.**
 *
 * A fallback is exactly how a deployment ends up talking to the wrong backend
 * quietly and permanently — test writes landing in prod, or a season of real
 * data written under `local`. Nothing detects that afterwards and there is no
 * clean way to unpick it. Refusing to start is recoverable; that is not.
 */
export function resolveEnvironment(): Environment {
  const hostname = globalThis.location?.hostname
  if (hostname === undefined) {
    throw new Error(
      'config: cannot resolve the environment — there is no hostname to read',
    )
  }

  const environment = environmentForHostname(hostname)
  if (environment === undefined) {
    throw new Error(
      `config: hostname "${hostname}" is not mapped to an environment. ` +
        `Add it to HOSTNAME_ENVIRONMENTS in src/config/environments.ts.`,
    )
  }

  return environment
}
