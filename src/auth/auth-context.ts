import { createContext, useContext } from 'react'

import type { User, UserId } from '@/types'

/**
 * Who is signed in, and whether they have a record yet.
 *
 * **Three states, not two**, and the third is the one that gets forgotten:
 *
 * - `resolving` — the session has not come back yet. Restoring it is
 *   asynchronous, so this is where every visit starts. **Treating it as signed
 *   out makes the app flash the login page before redirecting**, which is the
 *   most visible bug this whole thing exists to avoid.
 * - `signedOut` — nobody is signed in.
 * - `signedIn` — authenticated. `user` is `undefined` when they have no record
 *   yet, which is the mid-creation state: they signed in, abandoned the
 *   display-name modal, and came back.
 *
 * ---
 *
 * **React context is the right tool here, and this does not settle the
 * state-management question.** `CLAUDE.md` warns that plain context re-renders
 * every consumer on any change, which is a real problem for a screen updating
 * several times a second. This changes about twice a session. The live auction
 * is the case that will need a real answer.
 */
export type AuthState =
  | { status: 'resolving' }
  | { status: 'signedOut' }
  | {
      status: 'signedIn'
      userId: UserId
      /** From the auth session, so it is available before any record exists. */
      photoUrl: string | undefined
      user: User | undefined
    }

export interface AuthContextValue {
  state: AuthState
  /** Called after the display-name modal writes a record, to pick it up. */
  refreshUser: () => Promise<void>
}

/**
 * Separated from the provider because ESLint's fast-refresh rule requires a
 * file to export either components or non-components, not both.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
)

/**
 * Whether this person may reach the admin panel.
 *
 * **Either system role qualifies.** `SYSTEM_ROLES` carries `systemOwner` and
 * `systemAdmin`, and an owner who cannot open the panel makes no sense.
 * `03-roles.md` lists only "System admin" in its six-role table, but the schema
 * carries both and is the more specific document.
 *
 * Defined once so the nav item and the route guard cannot drift apart and start
 * disagreeing about who is allowed in.
 */
export function isSystemAdmin(state: AuthState): boolean {
  if (state.status !== 'signedIn' || state.user === undefined) return false
  const roles = state.user.systemUserRoles
  return roles?.systemAdmin === true || roles?.systemOwner === true
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === undefined) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
