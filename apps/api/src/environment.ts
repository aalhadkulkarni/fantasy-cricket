/**
 * Which deployment this service is running as.
 *
 * **The environment comes from the deployment, never from the request.** The
 * browser picks which API it talks to; it does not get to pick which database
 * root that API writes to. If it did, a local build could write to production
 * by sending a different string.
 *
 * Mirrors `ENVIRONMENTS` in the web app, and is the server's half of the same
 * decision: four roots inside one database, so the environment is a path
 * prefix rather than a different connection.
 */

export const ENVIRONMENTS = ['local', 'test', 'preprod', 'prod'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value)
}

/**
 * **An unset or unknown value throws, and the service refuses to start.**
 *
 * The alternative is a default, which is how a deployment ends up writing to
 * the wrong root quietly and permanently. Failing to boot is recoverable; a
 * season of real data under `local` is not.
 */
export function resolveEnvironment(): Environment {
  const value = process.env.APP_ENVIRONMENT

  if (value === undefined || value === '') {
    throw new Error(
      'config: APP_ENVIRONMENT is not set. It must be one of: ' +
        ENVIRONMENTS.join(', '),
    )
  }

  if (!isEnvironment(value)) {
    throw new Error(
      `config: APP_ENVIRONMENT "${value}" is not an environment. ` +
        `Expected one of: ${ENVIRONMENTS.join(', ')}`,
    )
  }

  return value
}

/** Which origins the browser may call this service from. */
export function allowedOrigins(environment: Environment): string[] {
  if (environment === 'prod') {
    return [
      'https://fantasy-cricket-league-c0346.web.app',
      'https://fantasy-cricket-league-c0346.firebaseapp.com',
    ]
  }

  // Vite's dev server, on the two addresses it answers to.
  return ['http://localhost:5173', 'http://127.0.0.1:5173']
}
