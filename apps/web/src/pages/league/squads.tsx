import { useEffect, useState } from 'react'

import { SquadList, SquadMakeup } from '@/components/leagues/squad-list'
import { Button } from '@/components/ui/button'
import { getSquads } from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import type {
  ManagerSquadView,
  PlayerRole,
  SquadsView,
} from '@fantasy-cricket/shared'

/**
 * Squads — `/leagues/:leagueId/squads`. Auction leagues, once the auction has
 * ended.
 *
 * **One page, not two**: your squad first and open, with the XI you have saved
 * highlighted; every other manager collapsed beneath it, expanding to theirs
 * with their **locked** XI only. A spectator sees everyone collapsed.
 *
 * **Squads are public; selections are not.** Who owns whom is shown to
 * everyone. Which eleven they are fielding is shown only once it has locked.
 */
export function Squads() {
  const { league } = useLeague()

  const [view, setView] = useState<SquadsView | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await getSquads(league.leagueId)
        if (cancelled) return
        setView(loaded)
        setError(undefined)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [league.leagueId, attempt])

  const minimums = Object.fromEntries(
    Object.entries(view?.lineupRules ?? {}).map(([role, rule]) => [
      role,
      rule?.min ?? 0,
    ]),
  ) as Partial<Record<PlayerRole, number>>

  const mine = view?.managers.find((m) => m.userId === view.mine)
  const others = view?.managers.filter((m) => m.userId !== view.mine) ?? []

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Squads</h2>

      <div className="mt-6">
        {error !== undefined ? (
          <div className="text-sm">
            <p className="font-semibold text-destructive">
              Could not load the squads
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setError(undefined)
                setAttempt((n) => n + 1)
              }}
            >
              Retry
            </Button>
          </div>
        ) : view === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : view.managers.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            Nobody is managing a team in this league.
          </p>
        ) : (
          <div className="grid gap-6">
            {mine !== undefined && (
              <div>
                <Heading squad={mine} label="Your squad" />
                <div className="mt-2">
                  <SquadMakeup
                    entries={mine.players}
                    homeNation={view.homeNation}
                    minimums={minimums}
                  />
                </div>
                <div className="mt-3 rounded-xl border">
                  <SquadList
                    entries={mine.players}
                    xi={mine.xi}
                    homeNation={view.homeNation}
                  />
                </div>
                <XiNote squad={mine} own />
              </div>
            )}

            {others.length > 0 && (
              <div>
                {mine !== undefined && (
                  <h3 className="mb-2 font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
                    Everyone else
                  </h3>
                )}
                <ul className="grid gap-2">
                  {others.map((squad) => (
                    <li key={squad.userId}>
                      <details className="group rounded-xl border">
                        <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-4 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {squad.teamName}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {squad.userName}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">
                            {squad.players.length} players
                          </span>
                        </summary>
                        <div className="border-t px-2 pt-3 pb-1">
                          <div className="px-2">
                            <SquadMakeup
                              entries={squad.players}
                              homeNation={view.homeNation}
                              minimums={minimums}
                            />
                          </div>
                          <div className="mt-2">
                            <SquadList
                              entries={squad.players}
                              xi={squad.xi}
                              homeNation={view.homeNation}
                            />
                          </div>
                          <div className="px-2 pb-2">
                            <XiNote squad={squad} own={false} />
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Heading({ squad, label }: { squad: ManagerSquadView; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="font-semibold">
        {label}
        <span className="ml-2 font-normal text-muted-foreground">
          {squad.teamName}
        </span>
      </h3>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {squad.players.length} players
      </span>
    </div>
  )
}

/** What the tinted rows are, or why there are none. */
function XiNote({ squad, own }: { squad: ManagerSquadView; own: boolean }) {
  return (
    <p className="mt-2 text-xs text-subtle-foreground">
      {squad.xi !== undefined
        ? `Highlighted: ${own ? 'your XI for' : 'their locked XI,'} ${squad.xi.periodName}.`
        : own
          ? 'You have not saved an XI for the current period yet.'
          : 'No locked XI to show yet.'}
    </p>
  )
}
