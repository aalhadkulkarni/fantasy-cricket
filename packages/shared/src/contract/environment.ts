/**
 * Which deployment something is running as.
 *
 * **Shared because both sides need the same four names.** The browser resolves
 * it from its hostname and uses it to pick which API to call; the service
 * takes it from its own deployment configuration and uses it as the database
 * root. Neither derives it from the other, and the client never sends it.
 *
 * `docs/05-data-model.md` specifies four, with identical structure beneath
 * each: they are four roots inside one database, not four projects.
 */

export const ENVIRONMENTS = ['local', 'test', 'preprod', 'prod'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

export function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value)
}
