import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { signInWithGoogle } from '@/data-layer'
import { ROUTES } from '@/routes'

/**
 * Login — `/login`. **Reachable by everyone**, and the only route a signed-out
 * visitor can reach.
 *
 * **No site header.** Every item in it needs a session, so a signed-out visitor
 * would get a bar offering nothing but a logo, which is worse than no bar. This
 * page carries the brand itself instead.
 *
 * **It is also the first screen anyone ever sees**, including someone
 * evaluating the project rather than signing in, so it says what the product is
 * rather than only asking for credentials.
 *
 * Sign out lives in the site header, not here.
 */
export function Login() {
  const { state } = useAuth()
  const location = useLocation()
  const [attempt, setAttempt] = useState<
    'idle' | 'opening' | 'blocked' | 'failed'
  >('idle')

  // Nothing is known until the session resolves. Rendering the sign-in prompt
  // here would flash it at someone who is already signed in.
  if (state.status === 'resolving') return <ResolvingSession />

  if (state.status === 'signedIn') {
    // Back to wherever they were headed before being sent here, or home.
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? ROUTES.home} replace />
  }

  async function signIn() {
    setAttempt('opening')
    try {
      const outcome = await signInWithGoogle()
      // Only one of the three non-success outcomes is a failure. Closing the
      // popup means they changed their mind; a superseded popup is noise.
      setAttempt(outcome === 'blocked' ? 'blocked' : 'idle')
    } catch {
      setAttempt('failed')
    }
  }

  return (
    <main className="grid min-h-svh place-items-center py-12">
      <PageContainer className="max-w-110">
        <p className="text-xl font-extrabold tracking-[-0.02em]">
          Fantasy <span className="text-live-text">League</span>
        </p>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Run a cricket league with your friends.
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Pick a team from real cricketers, and score points from what they
          actually do out in the middle.
        </p>

        <ul className="mt-8 space-y-4">
          <Point title="Private leagues">
            Create one and share a code. Nobody joins without it.
          </Point>
          <Point title="Live auctions">
            Bid against the other managers in real time for the squad you will
            pick from all season.
          </Point>
          <Point title="Real match scoring">
            Points come from actual performances, so a correction anywhere fixes
            every table at once.
          </Point>
        </ul>

        <div className="mt-9">
          <Button
            onClick={() => void signIn()}
            disabled={attempt === 'opening'}
            className="w-full"
          >
            {attempt === 'opening'
              ? 'Waiting for Google…'
              : 'Continue with Google'}
          </Button>

          <SignInProblem attempt={attempt} />

          <p className="mt-4 text-xs text-subtle-foreground">
            Signing in with Google is the only way in. We store your name and
            email, and nothing else.
          </p>
        </div>
      </PageContainer>
    </main>
  )
}

function Point({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      {/*
        A plain dot rather than an icon. Rule 1 reserves `--live` for things
        that are actually happening, and three blue markers on the first screen
        anyone sees would spend that meaning before the app has used it once.
      */}
      <span
        aria-hidden
        className="mt-2 size-1.5 shrink-0 rounded-full bg-subtle-foreground"
      />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}

/**
 * The first paint on every visit, while the session is restored.
 *
 * Deliberately plain rather than a spinner. It is usually on screen for a few
 * hundred milliseconds, and something that animates draws the eye to a wait
 * that is about to end.
 */
function ResolvingSession() {
  return (
    <main className="grid min-h-svh place-items-center">
      <p className="font-mono text-xs tracking-wide text-subtle-foreground uppercase">
        Signing you in…
      </p>
    </main>
  )
}

function SignInProblem({ attempt }: { attempt: string }) {
  if (attempt === 'blocked') {
    return (
      <p className="mt-4 text-sm text-destructive">
        Your browser blocked the sign-in window. Allow pop-ups for this site and
        try again.
      </p>
    )
  }

  if (attempt === 'failed') {
    return (
      <p className="mt-4 text-sm text-destructive">
        Something went wrong signing in. Try again.
      </p>
    )
  }

  return null
}
