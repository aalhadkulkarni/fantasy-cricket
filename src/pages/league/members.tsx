import { useEffect, useState } from 'react'

import { useAuth } from '@/auth/auth-context'
import { getMembers } from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import type { LeagueMemberSummary } from '@/types'

/**
 * Members — `/leagues/:leagueId/members`.
 *
 * Who is in the league, with their team names and an admin badge. It earns its
 * place beside the leaderboard because that one is *ranked* rather than a
 * roster, so **no points and no rank here**.
 *
 * Banned members are left out by the layer. Owner first, then admins, then
 * everyone by name.
 */
export function Members() {
  const { league } = useLeague()
  const { state } = useAuth()
  const me = state.status === 'signedIn' ? state.userId : undefined

  const [members, setMembers] = useState<LeagueMemberSummary[] | undefined>(
    undefined,
  )
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await getMembers(league.leagueId)
        if (cancelled) return
        setMembers(loaded)
        setError(undefined)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [league.leagueId])

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Members</h2>

      <div className="mt-6">
        {error !== undefined ? (
          <div className="text-sm">
            <p className="font-semibold text-destructive">
              Could not load the members
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {error}
            </p>
          </div>
        ) : members === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-subtle-foreground">
            Nobody has joined yet.
          </p>
        ) : (
          <ul className="lit divide-y rounded-xl border bg-secondary/30 px-5">
            {members.map((member) => (
              <li
                key={member.userId}
                aria-current={member.userId === me ? 'true' : undefined}
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5 ${
                  // Tinted and barred like the leaderboard, bleeding to the
                  // list's edges so it reads as a highlighted row.
                  member.userId === me
                    ? '-mx-5 bg-live/12 px-5 shadow-[inset_3px_0_0_var(--live)]'
                    : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">
                    {member.userName}
                    {member.userId === me && (
                      <span className="ml-2 font-mono text-[10px] tracking-[0.08em] text-subtle-foreground uppercase">
                        You
                      </span>
                    )}
                  </p>
                  {member.fantasyTeamName !== undefined && (
                    <p className="truncate text-sm text-muted-foreground">
                      {member.fantasyTeamName}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {badges(member).map((badge) => (
                    <span
                      key={badge}
                      className="rounded-[4px] border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.08em] text-subtle-foreground uppercase"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/**
 * **Every role they hold, not only the highest.** Roles are additive, so an
 * owner who also plays is both, and showing just "Owner" would hide that they
 * have a team. The one thing left out is "Admin" beside "Owner", since owning a
 * league already means administering it.
 */
function badges(member: LeagueMemberSummary): string[] {
  const roles = member.leagueRoles
  return [
    ...(roles.leagueOwner === true ? ['Owner'] : []),
    ...(roles.leagueAdmin === true && roles.leagueOwner !== true
      ? ['Admin']
      : []),
    ...(roles.manager === true ? ['Manager'] : []),
    ...(roles.spectator === true ? ['Spectator'] : []),
  ]
}
