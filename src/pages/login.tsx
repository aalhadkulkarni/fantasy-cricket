import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/button'
import { signInWithGoogle } from '@/data-layer'
import { ROUTES } from '@/routes'

/**
 * Login — `/login`. **Reachable by everyone**, and the only route a signed-out
 * visitor can reach.
 *
 * **A landing page, not just a sign-in prompt.** It is the first screen anyone
 * sees, including someone evaluating the project rather than joining a league,
 * so it says what the product is before asking for anything.
 *
 * **No site header.** Every item in it needs a session, so a signed-out visitor
 * would get a bar offering nothing but a logo. This page carries the brand.
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
    // `floodlit` is the ambient wash from above the frame. Atmosphere, not a
    // state marker — see the note on the class in index.css.
    <div className="floodlit flex min-h-svh flex-col">
      <main className="relative z-[1] flex flex-1 flex-col items-center justify-center px-6 py-16 text-center sm:px-7">
        <p className="text-[15px] font-extrabold tracking-[-0.02em]">
          Fantasy <span className="text-live-text">League</span>
        </p>

        <h1 className="mt-8 max-w-[15ch] text-[clamp(2.125rem,5.5vw,3.25rem)] leading-[1.04] font-extrabold tracking-[-0.035em]">
          Run a cricket auction with your friends.
        </h1>

        <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-muted-foreground">
          Private fantasy leagues for real tournaments. Bid live for the players
          you want, then pick your eleven each gameweek and score off the real
          matches.
        </p>

        <Button
          onClick={() => void signIn()}
          disabled={attempt === 'opening'}
          className="mt-9 h-auto gap-3 rounded-sm px-6 py-3.5 text-[15px] font-semibold"
        >
          <GoogleMark />
          {attempt === 'opening'
            ? 'Waiting for Google…'
            : 'Continue with Google'}
        </Button>

        <SignInProblem attempt={attempt} />

        <p className="mt-5 font-mono text-[11px] text-subtle-foreground">
          Google sign-in only · no password to remember
        </p>
      </main>

      <section className="relative z-[1] border-t px-6 py-10 sm:px-7">
        <div className="mx-auto grid max-w-[1000px] gap-7 sm:grid-cols-2 lg:grid-cols-3">
          <Point index="01" kicker="The auction" title="Bid live, together">
            Six to eight managers bid in real time while an auctioneer runs the
            room. Everyone sees every bid as it lands.
          </Point>
          <Point index="02" kicker="Your squad" title="Pick from what you won">
            You field an eleven from the squad you bought, name a captain, and
            trade with other managers when the window opens.
          </Point>
          <Point index="03" kicker="The season" title="Score off real matches">
            Points follow real performances. Swap players between gameweeks and
            use your impact substitute when it counts.
          </Point>
        </div>
      </section>

      <footer className="relative z-[1] flex flex-wrap justify-center gap-4 border-t px-6 py-4 font-mono text-[11px] text-subtle-foreground sm:justify-between sm:px-7">
        <span>Fantasy League</span>
        <span>Built for IPL, World Cups and everything between</span>
      </footer>
    </div>
  )
}

function Point({
  index,
  kicker,
  title,
  children,
}: {
  index: string
  kicker: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        {index} / {kicker}
      </p>
      <p className="mt-2.5 text-base font-bold tracking-[-0.01em]">{title}</p>
      <p className="mt-2 text-[13.5px] leading-[1.65] text-muted-foreground">
        {children}
      </p>
    </div>
  )
}

/**
 * Google's own mark, which their sign-in branding requires rather than a
 * generic icon or a letter.
 */
function GoogleMark() {
  return (
    <svg
      className="size-[19px] shrink-0"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
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
      <p className="mt-4 max-w-[46ch] text-sm text-destructive">
        Your browser blocked the sign-in window. Allow pop-ups for this site and
        try again.
      </p>
    )
  }

  if (attempt === 'failed') {
    return (
      <p className="mt-4 max-w-[46ch] text-sm text-destructive">
        Something went wrong signing in. Try again.
      </p>
    )
  }

  return null
}
