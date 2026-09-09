import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { AuthContext, type AuthState } from '@/auth/auth-context'
import { getCurrentUser, onAuthChanged } from '@/data-layer'
import type { UserId } from '@/types'

/**
 * Holds the auth session for the whole app, so the router can decide what to
 * render without every page re-reading it.
 *
 * See `auth-context.ts` for what the three states mean and why there are three.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'resolving' })

  /**
   * Reads our own record for whoever is signed in.
   *
   * **This lookup is what decides whether to show the display-name modal**,
   * never Firebase's `isNewUser`. That flag reports whether Firebase Auth just
   * created the account, which is a different question — someone who abandoned
   * the modal and returned is `isNewUser: false` and still has no record.
   */
  const loadUser = useCallback(async (userId: UserId) => {
    try {
      setState({ status: 'signedIn', userId, user: await getCurrentUser() })
    } catch {
      // A failed read must not strand the app in `resolving` forever. Treated
      // as no record, which routes to the modal, where a retry is possible.
      setState({ status: 'signedIn', userId, user: undefined })
    }
  }, [])

  useEffect(() => {
    return onAuthChanged((userId) => {
      if (userId === undefined) {
        setState({ status: 'signedOut' })
        return
      }
      void loadUser(userId)
    })
  }, [loadUser])

  const refreshUser = useCallback(async () => {
    if (state.status === 'signedIn') await loadUser(state.userId)
  }, [state, loadUser])

  return (
    <AuthContext.Provider value={{ state, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
