import { useState } from 'react'
import { Link } from 'react-router'

import { JoinLeagueDialog } from '@/components/join-league-dialog'
import { PageContainer } from '@/components/layout/page-container'
import { ROUTES } from '@/routes'

/**
 * Actions Center — `/actions`.
 *
 * **Entirely derived.** Nothing is stored, nothing is written, and there is no
 * read state. An item stays until the underlying thing resolves, which is why
 * this exists instead of notifications — a dismissed notification for a pending
 * transfer is a lost transfer.
 *
 * **None of the derived items is built yet**, so for now this is a short guide
 * to where to go instead. The items it will list are in
 * `docs/08-pages/actions-center.md`.
 */
export function ActionsCenter() {
  const [joining, setJoining] = useState(false)

  const link =
    'font-medium text-live-text underline-offset-4 hover:underline focus-visible:underline'

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Actions Center
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything currently waiting on you.
        </p>

        <section className="floodlit mt-8 max-w-2xl rounded-xl border bg-card p-6 text-card-foreground sm:p-8">
          <h2 className="text-base font-semibold">
            Nothing needs you right now
          </h2>

          <ul className="mt-4 grid gap-3 text-[15px] leading-relaxed text-muted-foreground">
            <li>
              New here? Read how points are scored in the{' '}
              <Link to={ROUTES.pointsSystem} className={link}>
                Points System
              </Link>
              .
            </li>
            <li>
              Have a code from a friend?{' '}
              <button
                type="button"
                className={`${link} cursor-pointer`}
                onClick={() => setJoining(true)}
              >
                Join a league
              </button>
              , or find a public one on{' '}
              <Link to={ROUTES.tournaments} className={link}>
                Tournaments
              </Link>
              .
            </li>
            <li>
              Pick or check your team from{' '}
              <Link to={ROUTES.home} className={link}>
                My Leagues
              </Link>
              .
            </li>
          </ul>
        </section>

        <JoinLeagueDialog open={joining} onOpenChange={setJoining} />
      </PageContainer>
    </main>
  )
}
