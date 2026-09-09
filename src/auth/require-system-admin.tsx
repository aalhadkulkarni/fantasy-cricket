import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { isSystemAdmin, useAuth } from '@/auth/auth-context'
import { ROUTES } from '@/routes'

/**
 * Wraps `/admin`. A non-system-admin is redirected home, per the access table
 * in `docs/04-navigation.md`.
 *
 * **Redirected rather than refused**, deliberately. The admin panel is not
 * something a normal user is denied so much as something that does not exist
 * for them, and a refusal page would tell them there is a room they cannot
 * enter. That differs from a ban, which `04-navigation.md` says to state
 * plainly, because there the person needs to know why.
 *
 * ---
 *
 * **This is convenience, not the guard.** Anyone can type a URL, and anyone can
 * read the database directly with the client SDK. The real check belongs in the
 * data layer, which is the Phase 1 server.
 *
 * That matters more here than on most routes: this page carries the button that
 * seeds an environment. `setUpBasicSystem` should check the caller's role
 * itself, and does not yet.
 *
 * Assumes an account already exists, since `RequireAccount` runs first.
 */
export function RequireSystemAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth()

  if (!isSystemAdmin(state)) return <Navigate to={ROUTES.home} replace />

  return <>{children}</>
}
