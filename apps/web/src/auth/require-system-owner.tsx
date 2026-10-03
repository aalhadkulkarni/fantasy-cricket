import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { isSystemOwner, useAuth } from '@/auth/auth-context'
import { ROUTES } from '@/routes'

/**
 * Wraps `/setup`. Anyone but the system owner is redirected home — the page
 * does not exist for them, and it is linked from nowhere.
 *
 * **Convenience, not the guard.** Every tool on the page is refused by the
 * service for anyone but the owner, and for everyone once the environment is
 * released.
 *
 * Assumes an account already exists, since `RequireAccount` runs first.
 */
export function RequireSystemOwner({ children }: { children: ReactNode }) {
  const { state } = useAuth()

  if (!isSystemOwner(state)) return <Navigate to={ROUTES.home} replace />

  return <>{children}</>
}
