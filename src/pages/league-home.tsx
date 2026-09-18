import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Outlet, useParams } from 'react-router'

import { PageContainer } from '@/components/layout/page-container'
import { getLeagueSummary } from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import { leaguePath } from '@/routes'
import type { LeagueId, LeaguePhase, LeagueSummary } from '@/types'

/**
 * The hub for a single league — `/leagues/:leagueId`.
 *
 * **A full-bleed band, then a sidebar and one card.** The band carries the
 * floodlight: a bloom from above the frame and a beam along its top edge. It is
 * the only place on the page that glows, so everything below stays calm and
 * readable.
 *
 * **Navigation is a sidebar rather than horizontal tabs.** The site header
 * already takes vertical space, and a second bar beneath it gives too much of a
 * phone screen to navigation. On a phone the sidebar becomes one scrolling row
 * of pills instead.
 *
 * **Every league view is reachable from every other**, and the bare route lands
 * on whichever section suits the phase, so someone arrives where the pending
 * action is.
 */
export function LeagueHome() {
  const { leagueId } = useParams<{ leagueId: string }>()

  const [league, setLeague] = useState<LeagueSummary | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  const [reloadToken, setReloadToken] = useState(0)
  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (leagueId === undefined) return
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getLeagueSummary(leagueId as LeagueId)
        if (!cancelled) {
          setLeague(loaded)
          setError(undefined)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [leagueId, reloadToken])

  if (error !== undefined) {
    return (
      <main className="py-10 sm:py-14">
        <PageContainer>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            League not available
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may not exist, or you may not be a member.
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {error}
          </p>
        </PageContainer>
      </main>
    )
  }

  if (league === undefined) {
    return (
      <main className="py-10 sm:py-14">
        <PageContainer>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </PageContainer>
      </main>
    )
  }

  return (
    <main>
      <Band league={league} />

      <PageContainer>
        <div className="gap-10 py-8 sm:flex sm:py-10">
          <Sidebar league={league} />
          <div className="mt-5 min-w-0 flex-1 sm:mt-0">
            {/* Sections read the league from here rather than fetching it again. */}
            <Outlet context={{ league, reload }} />
          </div>
        </div>
      </PageContainer>
    </main>
  )
}

/**
 * Sends the bare league route to the section where the action is.
 *
 * **Rejected: a static details landing.** Nobody wants a display-only page after
 * their first visit, and the band keeps league identity visible anyway.
 */
export function LeagueLanding() {
  const { league } = useLeague()

  return (
    <Navigate to={leaguePath(league.leagueId, LANDING[league.phase])} replace />
  )
}

const LANDING: Record<LeaguePhase, string> = {
  // Auction Center is not built; its leagues cannot exist yet either.
  preAuction: 'details',
  auction: 'details',
  teamSubmission: 'team',
  active: 'team',
  finished: 'leaderboard',
}

/**
 * The lit band across the top.
 *
 * The bloom falls from above the frame and the beam sits on the very top edge,
 * brightest in the middle. **This is the one glowing element on the page**, so
 * nothing below it competes.
 */
function Band({ league }: { league: LeagueSummary }) {
  return (
    <div className="relative overflow-hidden border-b bg-[radial-gradient(120%_140%_at_50%_-40%,rgba(var(--bloom),0.20),transparent_62%)]">
      <div className="absolute inset-x-[12%] top-0 h-0.5 bg-[linear-gradient(90deg,transparent,var(--live),transparent)]" />

      <PageContainer>
        <div className="items-end justify-between gap-8 py-8 sm:flex sm:py-10">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
              {league.leagueName}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-mono text-xs text-subtle-foreground">
                {league.tournamentName}
              </span>
              {league.leagueJoinCode !== '' && (
                <>
                  <span className="text-subtle-foreground">·</span>
                  <JoinCode code={league.leagueJoinCode} />
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4 sm:mt-0 sm:shrink-0">
            <Fact label="Phase">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block size-[7px] rounded-full ${
                    league.phase === 'active'
                      ? 'bg-settled'
                      : 'bg-subtle-foreground'
                  }`}
                />
                {PHASE_LABEL[league.phase]}
              </span>
            </Fact>

            <Fact label="Next deadline">
              {league.nextDeadline === undefined
                ? '—'
                : /*
                     **Day and month, not just a weekday.** A deadline a
                     fortnight out reads as "Thu 7PM", which is every Thursday.
                   */
                  new Date(league.nextDeadline).toLocaleString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
            </Fact>

            {/*
              Absent until the league is active. Working it out needs every
              manager's lineups plus the points node, and before a ball is
              bowled everyone is on zero.
            */}
            <Fact label="Your rank">
              {league.myRank === undefined ? (
                <span className="text-subtle-foreground">—</span>
              ) : (
                String(league.myRank)
              )}
            </Fact>
          </div>
        </div>
      </PageContainer>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-base font-bold whitespace-nowrap">{children}</p>
    </div>
  )
}

/**
 * The quickest way to invite, which is what a new league needs most. Not the
 * only way in — a closed league can be found on its tournament page.
 */
function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <span className="flex items-center gap-2.5">
      <span className="rounded-md border bg-secondary px-2.5 py-1 font-mono text-xs tracking-[0.12em]">
        {code}
      </span>
      <button
        type="button"
        className="font-mono text-xs text-subtle-foreground hover:text-foreground"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => setCopied(true))
        }}
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </span>
  )
}

/**
 * **Only the sections this league actually has.** Auction Center, Squads and
 * Transfers belong to auction leagues; My Team is hidden from a spectator, who
 * has no team; Admin Center is for the owner and admins.
 *
 * A column on a wide screen, one scrolling row of pills on a phone.
 */
function Sidebar({ league }: { league: LeagueSummary }) {
  const spectatorOnly =
    league.myRoles.spectator === true && league.myRoles.manager !== true

  const items = [
    { label: 'League details', section: 'details' },
    ...(spectatorOnly ? [] : [{ label: 'My team', section: 'team' }]),
    { label: 'Leaderboard', section: 'leaderboard' },
    { label: 'Members', section: 'members' },
  ]

  return (
    <nav
      aria-label="League sections"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-52 sm:shrink-0 sm:flex-col sm:gap-1 sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {items.map((item) => (
        <NavLink
          key={item.section}
          to={leaguePath(league.leagueId, item.section)}
          className={({ isActive }) =>
            `rounded-lg px-4 py-3 text-[15px] font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'border border-border/60 text-muted-foreground hover:text-foreground sm:border-transparent sm:hover:bg-accent'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

const PHASE_LABEL: Record<LeaguePhase, string> = {
  preAuction: 'Auction not started',
  auction: 'Auction ongoing',
  teamSubmission: 'Team submission',
  active: 'Active',
  finished: 'Finished',
}
