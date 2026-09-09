/**
 * `systemSetup`.
 *
 * A marker saying the reference tables have been seeded into this environment.
 *
 * **Read before seeding, and written in the same atomic update as the seed**, so
 * either the whole thing landed and this exists, or neither did. That is what
 * makes the setup button safe to press twice.
 *
 * It matters most for `competitions`, which are keyed by push key rather than
 * by name. A second run without this guard would create six *more* competitions
 * rather than overwriting six, and nothing would say which set was real.
 *
 * A timestamp rather than a boolean, at the same cost, because "when was this
 * environment set up" is a question worth being able to answer.
 */
export interface SystemSetup {
  completedAt: number
}
