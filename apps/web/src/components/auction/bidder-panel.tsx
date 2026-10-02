import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { submitBid, submitNoBid } from '@/data-layer'
import { PLAYER_ROLES, type PlayerId } from '@fantasy-cricket/shared'

import {
  composition,
  draftPool,
  indexPool,
  managerRows,
  momentOf,
} from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { ROLE_PLURAL, price } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **A manager's controls, and everything they need to decide.**
 *
 * Bid at the asking price, or pass. **Passing is irreversible for the round**,
 * so once passed the panel says so rather than offering a bid that would be
 * refused. Every other reason a bid cannot be made is said out loud too:
 * already leading, squad full, budget too low.
 *
 * **The auction does not stop an illegal squad**, so this shows the rules and
 * the squad's makeup beside the button and lets the manager decide.
 *
 * **Bid and pass are live.** A bid goes to the manager's own field; the
 * auctioneer's browser decides whether it is accepted, and a bid at a price
 * that has already moved is silently ignored — so "sent" is said until the
 * round moves. The draft pick comes in a later phase.
 */
export function BidderPanel() {
  const data = useAuctionStatic()
  const viewerId = useAuction((s) => s.viewer.userId)
  const state = useAuction((s) => s.state)
  const round = useAuction((s) => s.round)
  const noBids = useAuction((s) => s.noBids)
  const statuses = useAuction((s) => s.players)
  const managerStatuses = useAuction((s) => s.managers)

  const [note, setNote] = useState<string | undefined>(undefined)
  const tried = (what: string) => () =>
    setNote(`${what} comes in a later phase.`)

  const [sending, setSending] = useState<'bid' | 'pass' | undefined>()
  /** The asking price a bid was sent at, until the round moves past it. */
  const [sentAt, setSentAt] = useState<number | undefined>()
  const [failure, setFailure] = useState<string | undefined>()

  function send(kind: 'bid' | 'pass', run: () => Promise<void>, at?: number) {
    setSending(kind)
    setFailure(undefined)
    void run()
      .then(() => {
        if (at !== undefined) setSentAt(at)
      })
      .catch((e: unknown) =>
        setFailure(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setSending(undefined))
  }

  const pool = useMemo(() => indexPool(data.pool), [data.pool])
  const me = useMemo(
    () =>
      managerRows(data.members, managerStatuses, data.settings, pool).find(
        (m) => m.userId === viewerId,
      ),
    [data.members, managerStatuses, data.settings, pool, viewerId],
  )
  const makeup = useMemo(
    () => composition(me?.squad ?? [], data.settings.homeNation),
    [me, data.settings.homeNation],
  )

  if (me === undefined) return null

  const moment = momentOf(state, round)
  const { settings, rules } = data
  // The player up. Present whenever a round is, which is when it is read.
  const current = state?.currentPlayerId as PlayerId
  const squadFull = me.squad.length >= settings.maxSquadSize

  // Why a bid cannot be made now, if it cannot. First reason wins.
  const blocked: string | undefined =
    moment !== 'bidding' || round === undefined
      ? undefined
      : round.currentLeadingManager === me.userId
        ? "You're the highest bidder"
        : noBids[me.userId] === true
          ? 'You passed on this player'
          : squadFull
            ? `Squad full (${settings.maxSquadSize})`
            : me.budget < round.minNextBid
              ? 'Not enough budget'
              : undefined

  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">{me.teamName}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {price(me.budget)} left
        </span>
      </div>

      <div className="mt-4">
        {moment === 'bidding' && round !== undefined ? (
          <div>
            <div className="flex flex-wrap gap-2.5">
              <Button
                size="lg"
                onClick={() => {
                  const asking = round.minNextBid
                  send(
                    'bid',
                    () => submitBid(data.league.leagueId, current, asking),
                    asking,
                  )
                }}
                disabled={blocked !== undefined || sending !== undefined}
              >
                {sending === 'bid'
                  ? 'Sending…'
                  : `Bid ${price(round.minNextBid)}`}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() =>
                  send('pass', () => submitNoBid(data.league.leagueId, current))
                }
                disabled={
                  sending !== undefined ||
                  noBids[me.userId] === true ||
                  round.currentLeadingManager === me.userId
                }
              >
                Pass
              </Button>
            </div>
            {blocked !== undefined ? (
              <p className="mt-2 text-sm text-muted-foreground">{blocked}</p>
            ) : sentAt === round.minNextBid ? (
              // Sent, and the price has not moved: the auctioneer has not
              // reached it yet. Once it moves, someone's bid was accepted.
              <p className="mt-2 text-sm text-muted-foreground">
                Bid of {price(sentAt)} sent — waiting for the auctioneer.
              </p>
            ) : null}
            {failure !== undefined && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {failure}
              </p>
            )}
          </div>
        ) : moment === 'draft' ? (
          <DraftPick
            homeNation={settings.homeNation}
            myTurn={state?.currentDraftManagerId === me.userId}
            waitingFor={
              data.members.find(
                (m) => m.userId === state?.currentDraftManagerId,
              )?.fantasyTeamName
            }
            choices={draftPool(data.pool, statuses).map(
              ({ entry, wasUnsold }) => ({
                id: entry.player.playerId,
                country: entry.player.country,
                label: `${entry.player.playerName} · ${price(entry.playerBasePrice)}${
                  wasUnsold ? ' · was unsold' : ''
                }`,
              }),
            )}
            onPick={tried('Picking')}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {moment === 'paused'
              ? 'Bidding is paused.'
              : moment === 'timeUp'
                ? "Time's up. Waiting for the auctioneer."
                : moment === 'ended'
                  ? 'The auction is over.'
                  : moment === 'notStarted'
                    ? 'The auction has not started yet.'
                    : 'Bidding opens when the auctioneer starts it.'}
          </p>
        )}
      </div>

      {/*
        Always visible, compact: what the manager needs to decide. The XI rules
        are beside the count so "can I still field a legal eleven" is one glance.
      */}
      <dl className="mt-5 grid gap-1.5 border-t pt-4 text-sm">
        <Line
          label="Squad"
          value={`${me.squad.length} of ${settings.minSquadSize}–${settings.maxSquadSize}`}
        />
        {PLAYER_ROLES.map((role) => {
          const rule = rules[role]
          return (
            <Line
              key={role}
              label={ROLE_PLURAL[role]}
              value={`${makeup.byRole[role]}${
                rule === undefined
                  ? ''
                  : ` · XI needs ${rule.max === undefined ? `${rule.min}+` : `${rule.min}–${rule.max}`}`
              }`}
            />
          )
        })}
        {settings.homeNation !== undefined && (
          <Line
            label="Overseas"
            value={`${makeup.overseas}${
              settings.maxOverseasPlayersAllowedInXI === undefined
                ? ''
                : ` · at most ${settings.maxOverseasPlayersAllowedInXI} in an XI`
            }`}
          />
        )}
      </dl>

      {note !== undefined && (
        <p className="mt-3 text-xs text-subtle-foreground">{note}</p>
      )}
    </section>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-xs">{value}</dd>
    </div>
  )
}

/** On your turn, a player from the draft pool; otherwise, whose turn it is. */
function DraftPick({
  homeNation,
  myTurn,
  waitingFor,
  choices,
  onPick,
}: {
  myTurn: boolean
  waitingFor: string | undefined
  choices: { id: string; country: string; label: string }[]
  homeNation: string | undefined
  onPick: () => void
}) {
  const [chosen, setChosen] = useState('')

  if (!myTurn) {
    return (
      <p className="text-sm text-muted-foreground">
        {waitingFor === undefined
          ? 'Waiting for the draft to start.'
          : `Waiting for ${waitingFor} to pick.`}
      </p>
    )
  }

  if (choices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nobody is left to pick.</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <Select value={chosen} onValueChange={setChosen}>
        <SelectTrigger className="w-full sm:w-72" aria-label="Your pick">
          <SelectValue placeholder="Choose a player" />
        </SelectTrigger>
        <SelectContent>
          {choices.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <OverseasMark
                player={{ country: c.country }}
                homeNation={homeNation}
                keepSpace
              />
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={onPick} disabled={chosen === ''}>
        Pick this player
      </Button>
    </div>
  )
}
