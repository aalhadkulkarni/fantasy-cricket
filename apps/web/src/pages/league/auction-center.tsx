import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { PlayerName } from '@/components/leagues/player-name'
import { RoleTag } from '@/components/leagues/role-tag'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getAuctionPlayerPool,
  getAuctionSettings,
  getDraftOrder,
  getLineupRules,
  getMembers,
} from '@/data-layer'
import { useLeague } from '@/hooks/use-league'
import { auctionPath, leaguePath } from '@/routes'
import {
  PLAYER_CATEGORIES,
  PLAYER_ROLES,
  type AuctionBatch,
  type AuctionPoolPlayer,
  type AuctionSettings,
  type DraftOrderEntry,
  type LeagueMemberSummary,
  type LineupRules,
  type PlayerCategory,
  type PlayerRole,
} from '@fantasy-cricket/shared'

/**
 * Auction Center — `/leagues/:leagueId/auction-center`. Auction leagues only.
 *
 * **The auction as an event, and what a manager prepares from**: when it is,
 * the rules that shape bidding, the order players go up in, who is running it,
 * where everyone sits in the draft, and the pool itself.
 *
 * **It changes nothing.** Its one action is Go to auction, which is navigation.
 * The configuration lives in League Details; this shows what a bidder needs.
 *
 * **Two loads, not one.** The settings come from the league and arrive
 * quickly; the pool is every player with their values and is the slow part.
 * Each section fails on its own with a retry, so one bad read never blanks the
 * page.
 */
export function AuctionCenter() {
  const { league } = useLeague()
  // Pinned once; render must not read the clock.
  const [now] = useState(() => Date.now())

  const [overview, setOverview] = useState<Overview | undefined>(undefined)
  const [overviewError, setOverviewError] = useState<string | undefined>()
  const [overviewToken, setOverviewToken] = useState(0)

  const [pool, setPool] = useState<AuctionPoolPlayer[] | undefined>(undefined)
  const [poolError, setPoolError] = useState<string | undefined>()
  const [poolToken, setPoolToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [settings, draftOrder, members, rules] = await Promise.all([
          getAuctionSettings(league.leagueId),
          getDraftOrder(league.leagueId),
          getMembers(league.leagueId),
          getLineupRules(league.leagueId),
        ])
        if (cancelled) return
        setOverview({ settings, draftOrder, members, rules })
        setOverviewError(undefined)
      } catch (e) {
        if (!cancelled) {
          setOverviewError(e instanceof Error ? e.message : String(e))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [league.leagueId, overviewToken])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await getAuctionPlayerPool(league.leagueId)
        if (cancelled) return
        setPool(loaded)
        setPoolError(undefined)
      } catch (e) {
        if (!cancelled) setPoolError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [league.leagueId, poolToken])

  return (
    <section className="floodlit rounded-xl border bg-card p-5 text-card-foreground sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Auction center
          </h2>
          <p className="mt-2 font-mono text-sm font-medium text-muted-foreground">
            {overview === undefined
              ? overviewError === undefined
                ? 'Loading…'
                : 'Start time unavailable'
              : startLine(overview.settings.auctionStartTime, now)}
          </p>
        </div>

        {/*
          For everyone, in every phase. A new tab, so the auction cannot be
          lost by clicking something else here. Someone with no role in it
          arrives with no controls, which is harmless.
        */}
        <Button asChild>
          <a
            href={auctionPath(league.leagueId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Go to auction
          </a>
        </Button>
      </div>

      {overviewError !== undefined ? (
        <Failed
          what="the auction settings"
          error={overviewError}
          onRetry={() => setOverviewToken((n) => n + 1)}
        />
      ) : overview === undefined ? null : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Rules
            settings={overview.settings}
            rules={overview.rules}
            leagueId={league.leagueId}
          />
          <BatchSequence sequence={overview.settings.batchSequence} />
          <People
            auctioneerName={overview.settings.auctioneer.userName}
            members={overview.members}
          />
          <DraftOrder entries={overview.draftOrder} />
        </div>
      )}

      {/*
        **Below the settings, and only once they have settled.** The pool may
        well arrive first, and drawing it then would leave it to be shoved down
        the page when the boxes above it land. Holding it back means nothing
        ever appears above something already on screen; the header's single
        "Loading…" covers the wait.
      */}
      {(overview !== undefined || overviewError !== undefined) && (
        <Pool
          pool={pool}
          error={poolError}
          onRetry={() => setPoolToken((n) => n + 1)}
        />
      )}
    </section>
  )
}

interface Overview {
  settings: AuctionSettings
  draftOrder: DraftOrderEntry[]
  members: LeagueMemberSummary[]
  rules: LineupRules
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * **Abbreviated, and read-only.** Enough to plan a bidding strategy without
 * leaving the page; the full configuration is League Details.
 */
function Rules({
  settings,
  rules,
  leagueId,
}: {
  settings: AuctionSettings
  rules: LineupRules
  leagueId: string
}) {
  return (
    <Box title="Rules">
      <Row label="Budget" value={String(settings.totalBudget)} />
      <Row
        label="Squad size"
        value={`${settings.minSquadSize}–${settings.maxSquadSize}`}
      />
      <Row
        label="Overseas in an XI"
        value={
          settings.maxOverseasPlayersAllowedInXI === undefined
            ? 'No limit'
            : `At most ${settings.maxOverseasPlayersAllowedInXI}`
        }
      />
      <Row label="Bid step" value={String(settings.bidIncrement)} />
      <Row label="Round timer" value={`${settings.roundSeconds} s per bid`} />

      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        Each XI needs
      </p>
      {PLAYER_ROLES.map((role) => {
        const rule = rules[role]
        if (rule === undefined) return null
        return (
          <Row
            key={role}
            label={ROLE_PLURAL[role]}
            value={
              rule.max === undefined
                ? `At least ${rule.min}`
                : `${rule.min}–${rule.max}`
            }
          />
        )
      })}

      <Link
        to={leaguePath(leagueId, 'details')}
        className="mt-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Full league details
      </Link>
    </Box>
  )
}

/** The order players go up in, ending in the draft. */
function BatchSequence({
  sequence,
}: {
  sequence: readonly AuctionBatch[] | undefined
}) {
  return (
    <Box title="Batch order">
      {sequence === undefined || sequence.length === 0 ? (
        <p className="text-sm text-subtle-foreground">
          No batch order is set for this league.
        </p>
      ) : (
        <ol className="grid gap-1.5">
          {sequence.map((batch, index) => (
            <li key={index} className="flex items-baseline gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-xs text-subtle-foreground">
                {index + 1}
              </span>
              <span>{batchName(batch)}</span>
            </li>
          ))}
        </ol>
      )}
      {sequence?.some((batch) => batch.kind === 'draft') === true && (
        <p className="mt-1 text-xs text-subtle-foreground">
          The draft takes turns rather than bids, at base price: General players
          and everyone unsold before it.
        </p>
      )}
    </Box>
  )
}

/** Who is running it, and the field a manager is bidding against. */
function People({
  auctioneerName,
  members,
}: {
  auctioneerName: string
  members: readonly LeagueMemberSummary[]
}) {
  const managers = members.filter((m) => m.leagueRoles.manager === true)

  return (
    <Box title="Who's in it">
      <Row label="Auctioneer" value={auctioneerName} />

      <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        Bidding
      </p>
      {managers.length === 0 ? (
        <p className="text-sm text-subtle-foreground">
          Nobody has joined to bid yet.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {managers.map((manager) => (
            <li
              key={manager.userId}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="min-w-0 truncate">
                {manager.fantasyTeamName ?? manager.userName}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {manager.userName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Box>
  )
}

/**
 * **Settled before any money is spent**, because a manager's strategy depends
 * on where they sit. Positions are claimed as managers join; one nobody holds
 * yet is TBA.
 */
function DraftOrder({ entries }: { entries: readonly DraftOrderEntry[] }) {
  return (
    <Box title="Draft order">
      {entries.length === 0 ? (
        <p className="text-sm text-subtle-foreground">No draft positions.</p>
      ) : (
        <ol className="grid gap-1.5">
          {entries.map((entry) => (
            <li key={entry.position} className="flex items-baseline gap-3">
              <span className="w-5 shrink-0 text-right font-mono text-xs text-subtle-foreground">
                {entry.position}
              </span>
              {entry.managerId === undefined ? (
                <span className="text-subtle-foreground">TBA</span>
              ) : (
                <span className="min-w-0 truncate">
                  {entry.fantasyTeamName ?? entry.managerName}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-1 text-xs text-subtle-foreground">
        Picks go 1 to {entries.length}, then {entries.length} back to 1, and
        repeat.
      </p>
    </Box>
  )
}

const ALL = '__all__'

/**
 * **One line per player**, never a wide table: name and team, role, then
 * category and base price. A table of four columns is the one thing on this
 * page that would scroll sideways on a phone.
 *
 * Filterable by category and role, since that is how the auction is batched.
 */
function Pool({
  pool,
  error,
  onRetry,
}: {
  pool: AuctionPoolPlayer[] | undefined
  error: string | undefined
  onRetry: () => void
}) {
  const [category, setCategory] = useState<PlayerCategory | typeof ALL>(ALL)
  const [role, setRole] = useState<PlayerRole | typeof ALL>(ALL)

  const shown = (pool ?? []).filter(
    (entry) =>
      (category === ALL || entry.playerCategory === category) &&
      (role === ALL || entry.player.playerRole === role),
  )

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-lg font-semibold">Player pool</h3>

        {pool !== undefined && pool.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Select
              value={category}
              onValueChange={(value) =>
                setCategory(value as PlayerCategory | typeof ALL)
              }
            >
              <SelectTrigger className="w-36" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {PLAYER_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_NAME[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={role}
              onValueChange={(value) =>
                setRole(value as PlayerRole | typeof ALL)
              }
            >
              <SelectTrigger className="w-36" aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All roles</SelectItem>
                {PLAYER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_PLURAL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {error !== undefined ? (
        <Failed what="the player pool" error={error} onRetry={onRetry} />
      ) : pool === undefined ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Loading the player pool…
        </p>
      ) : pool.length === 0 ? (
        /*
          Reachable: nothing gates publishing on participants, so say so rather
          than render an empty list.
        */
        <p className="mt-4 text-sm text-subtle-foreground">
          This auction has no players in its pool. The tournament&apos;s players
          are set by a system admin.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-subtle-foreground">
            {shown.length} of {pool.length} players
          </p>
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-subtle-foreground">
              No players match these filters.
            </p>
          ) : (
            <ul className="mt-3 divide-y border-t border-b">
              {shown.map((entry) => (
                <li
                  key={entry.player.playerId}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PlayerName
                      player={entry.player}
                      className="text-[15px] font-medium"
                    />
                    <RoleTag role={entry.player.playerRole} />
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2.5">
                    <span className="font-mono text-[11px] text-subtle-foreground">
                      {CATEGORY_NAME[entry.playerCategory]}
                    </span>
                    <span className="w-8 text-right text-[15px] font-semibold">
                      {entry.playerBasePrice}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** A failed read, said in place with a retry, without replacing the page. */
function Failed({
  what,
  error,
  onRetry,
}: {
  what: string
  error: string
  onRetry: () => void
}) {
  return (
    <div className="mt-5 text-sm">
      <p className="font-semibold text-destructive">Could not load {what}</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{error}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="lit rounded-xl border bg-secondary/30 p-5">
      <p className="font-mono text-[10px] tracking-[0.14em] text-subtle-foreground uppercase">
        {title}
      </p>
      <div className="mt-4 grid gap-2.5 text-[15px]">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="min-w-0 text-right font-mono text-sm text-muted-foreground">
        {value}
      </span>
    </div>
  )
}

const CATEGORY_NAME: Record<PlayerCategory, string> = {
  marquee: 'Marquee',
  star: 'Star',
  general: 'General',
}

const ROLE_PLURAL: Record<PlayerRole, string> = {
  batsman: 'Batsmen',
  bowler: 'Bowlers',
  wicketKeeper: 'Wicket keepers',
  allRounder: 'All-rounders',
}

function batchName(batch: AuctionBatch): string {
  return batch.kind === 'draft'
    ? 'Draft'
    : `${CATEGORY_NAME[batch.playerCategory]} ${ROLE_PLURAL[
        batch.playerRole
      ].toLowerCase()}`
}

/**
 * "Starts Sat, 20 Dec, 7:30 pm · in 3 days". **Relative to when the page
 * loaded**, not ticking: a countdown here is decoration, and the live one
 * belongs to the auction page.
 */
function startLine(startsAt: number, now: number): string {
  const when = new Date(startsAt).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `Starts ${when} · ${relative(startsAt - now)}`
}

function relative(ms: number): string {
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const minutes = Math.round(ms / 60_000)
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}
