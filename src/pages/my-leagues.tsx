import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { JoinLeagueDialog } from '@/components/join-league-dialog'
import { PageContainer } from '@/components/layout/page-container'
import { MyLeagueCard } from '@/components/leagues/my-league-card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getActiveLeagues,
  getArchivedLeagues,
  getPendingLeagues,
} from '@/data-layer'
import { ROUTES } from '@/routes'
import type { ArchivedLeagueCard, LeagueCard } from '@/types'

/**
 * My Leagues — `/`, and **this is home**.
 *
 * Both the brand and the My Leagues header item point here. Home is this rather
 * than Tournaments because Tournaments is a discovery surface used a handful of
 * times ever, while this is where someone returns daily during a season.
 *
 * **Active merges joined and spectated**, with a tag on the ones you only
 * watch. Separating them would mean checking two places to answer "what am I
 * involved in", and a spectator's card differs only in which actions it offers.
 *
 * **Rejected requests are not a tab** — a rejected league is one you are *not*
 * in, and putting it beside your leagues flattens a real difference. It belongs
 * behind a button on Pending, along with the rest of the request pipeline, none
 * of which is built.
 */
export function MyLeagues() {
  const [active, setActive] = useState<LeagueCard[] | undefined>(undefined)
  const [pending, setPending] = useState<LeagueCard[]>([])
  const [archived, setArchived] = useState<ArchivedLeagueCard[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [joining, setJoining] = useState(false)

  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    // Guards against setting state after unmount.
    let cancelled = false

    void (async () => {
      try {
        /*
          Archived is fetched here rather than when its tab opens, against the
          document's lazy-load boundary. It reads one node that is empty and
          stays empty until a league can be finished; deferring it would be
          machinery guarding nothing. Worth revisiting when it can grow.
        */
        const [a, p, r] = await Promise.all([
          getActiveLeagues(),
          getPendingLeagues(),
          getArchivedLeagues(),
        ])
        if (cancelled) return
        setActive(a)
        setPending(p)
        setArchived(r)
        setError(undefined)
      } catch (e) {
        if (cancelled) return
        setActive([])
        setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  // Land on Active. If it is empty but something is pending, land there
  // instead, because that is the question someone in that position has.
  const landing =
    active !== undefined && active.length === 0 && pending.length > 0
      ? 'pending'
      : 'active'

  const nothingYet =
    active !== undefined && active.length === 0 && pending.length === 0

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            My Leagues
          </h1>
          {active !== undefined && active.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {active.length} active
              {pending.length > 0 && ` · ${pending.length} pending`}
            </p>
          )}
        </div>

        {error !== undefined ? (
          <div className="mt-8 text-sm">
            <p className="font-semibold text-destructive">
              Could not load your leagues
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : active === undefined ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        ) : nothingYet ? (
          <Empty onJoin={() => setJoining(true)} />
        ) : (
          <Tabs defaultValue={landing} className="mt-8 gap-6">
            <TabsList>
              <TabsTrigger value="active">Active {active.length}</TabsTrigger>
              <TabsTrigger value="pending">
                Pending {pending.length}
              </TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <Cards leagues={active} empty="Nothing running yet." />
            </TabsContent>
            <TabsContent value="pending">
              <Cards
                leagues={pending}
                empty="No outstanding requests. Public leagues let you in straight away, so only closed ones ever wait here."
              />
            </TabsContent>
            <TabsContent value="archived">
              <Cards
                leagues={archived}
                empty="Nothing here yet. A league moves across a day after it is marked finished."
              />
            </TabsContent>
          </Tabs>
        )}

        <JoinLeagueDialog
          open={joining}
          onOpenChange={setJoining}
          onJoined={() => setReloadToken((n) => n + 1)}
        />
      </PageContainer>
    </main>
  )
}

function Cards({
  leagues,
  empty,
}: {
  leagues: readonly (LeagueCard | ArchivedLeagueCard)[]
  empty: string
}) {
  if (leagues.length === 0) {
    return <p className="text-sm text-subtle-foreground">{empty}</p>
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
      {leagues.map((league) => (
        <MyLeagueCard key={league.leagueId} league={league} />
      ))}
    </div>
  )
}

/**
 * **This screen matters more than its size suggests.** A brand-new user lands
 * here, and so does anyone seeing the project for the first time.
 *
 * The eventual target offers three paths — join by code, browse tournaments,
 * create a league. A guided tour was rejected: substantial to build, and most
 * people click straight through one.
 */
function Empty({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="floodlit mt-8 rounded-lg border bg-card p-8 text-card-foreground sm:p-10">
      <h2 className="text-base font-semibold">You have no leagues</h2>
      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
        A league is where you play. Join one with a code, find one on a
        tournament, or start your own.
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onJoin}>Join a league</Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.tournaments}>Browse tournaments</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to={ROUTES.createLeague}>Create a league</Link>
        </Button>
      </div>
    </div>
  )
}
