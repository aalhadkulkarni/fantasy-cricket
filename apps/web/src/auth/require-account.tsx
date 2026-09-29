import { useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createUser } from '@/data-layer'
import { ROUTES } from '@/routes'

/**
 * Wraps every route that needs an account.
 *
 * Three outcomes, from `docs/04-navigation.md`:
 *
 * 1. **Not signed in** → `/login`, **remembering where they were going**, so
 *    they land there afterwards rather than on home.
 * 2. **Signed in, no record** → the display-name modal, whatever route was
 *    asked for. They are authenticated but have no profile, so every other page
 *    would break.
 * 3. **Signed in with a record** → the route they wanted.
 *
 * **Route guards are convenience, not the guard.** Anyone can type a URL, and
 * anyone can read the database directly with the client SDK. The data layer is
 * the actual check.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const location = useLocation()

  // Nothing is known yet. Redirecting here would bounce a signed-in person to
  // the login page on every single visit.
  if (state.status === 'resolving') return <ResolvingSession />

  if (state.status === 'signedOut') {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  // Authenticated, but our own lookup found no record. Never Firebase's
  // `isNewUser`, which answers a different question and would send someone who
  // abandoned this modal straight into an app that assumes a profile.
  if (state.user === undefined) return <DisplayNameModal />

  return <>{children}</>
}

function ResolvingSession() {
  return (
    <main className="grid min-h-svh place-items-center">
      <p className="font-mono text-xs tracking-wide text-subtle-foreground uppercase">
        Loading…
      </p>
    </main>
  )
}

/**
 * The one thing asked at sign-up.
 *
 * **No prefill from Google**, deliberately. Long-standing accounts often carry
 * a nickname or a joke as the account name and people leave defaults alone, so
 * an embarrassing prefill is worse than an empty field.
 *
 * Not dismissible: there is nowhere to dismiss to. Every other page needs the
 * record this writes.
 */
function DisplayNameModal() {
  const { refreshUser } = useAuth()
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle')

  const trimmed = name.trim()

  async function save() {
    setStatus('saving')
    try {
      await createUser(trimmed)
      await refreshUser()
    } catch {
      setStatus('failed')
    }
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-[420px]"
        // Nowhere to go if dismissed, so the usual exits are closed off.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>What should we call you?</DialogTitle>
          <DialogDescription>
            This is the name other managers see in your leagues. Your team names
            are set per league, so this is not one of those.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trimmed !== '' && status !== 'saving') {
              void save()
            }
          }}
          placeholder="Your name"
          autoFocus
          maxLength={40}
          aria-label="Display name"
        />

        {status === 'failed' && (
          <p className="text-sm text-destructive">
            Could not save that. Try again.
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={() => void save()}
            disabled={trimmed === '' || status === 'saving'}
          >
            {status === 'saving' ? 'Saving…' : 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
