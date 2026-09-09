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
 * structure beneath each.
 */

/**
 * The array doubles as the runtime validator, the same arrangement the
 * reference tables use in `src/types/reference.ts`.
 */
export const ENVIRONMENTS = ['local', 'test', 'preprod', 'prod'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

/**
 * What is known so far.
 *
 * **The other three wait on hosting being configured** — see G9. Adding them
 * here and clearing `FORCED_ENVIRONMENT` below is the entire switch-over.
 */
const HOSTNAME_ENVIRONMENTS: Readonly<Record<string, Environment>> = {
  localhost: 'local',
  '127.0.0.1': 'local',
  // test:    <hostname> → 'test'
  // preprod: <hostname> → 'preprod'
  // prod:    <hostname> → 'prod'
}

/**
 * While this is set, resolution returns it and the hostname is never consulted.
 *
 * **Set it to `undefined` once the three hostnames above are filled in.** That
 * one line is the whole change; nothing else in this file moves.
 */
const FORCED_ENVIRONMENT: Environment | undefined = 'local'

/**
 * **An unknown hostname throws. It does not fall back to `local`.**
 *
 * A fallback is exactly how a deployment ends up talking to the wrong backend
 * quietly and permanently — test writes landing in prod, or a season of real
 * data written under `local`. Nothing detects that afterwards and there is no
 * clean way to unpick it. Refusing to start is recoverable; that is not.
 */
export function resolveEnvironment(): Environment {
  if (FORCED_ENVIRONMENT !== undefined) return FORCED_ENVIRONMENT

  const hostname = globalThis.location?.hostname
  if (hostname === undefined) {
    throw new Error(
      'config: cannot resolve the environment — there is no hostname to read',
    )
  }

  const environment = HOSTNAME_ENVIRONMENTS[hostname]
  if (environment === undefined) {
    throw new Error(
      `config: hostname "${hostname}" is not mapped to an environment. ` +
        `Add it to HOSTNAME_ENVIRONMENTS in src/config/environments.ts.`,
    )
  }

  return environment
}
