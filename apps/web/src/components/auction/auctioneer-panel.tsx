import { useMemo, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { resolveEnvironment } from '@/config/environments'
import {
  markBatchUnsold,
  markPlayerUnsold,
  nextBatch as moveToNextBatch,
  nextDraftManager,
  putUpPlayer,
  putUpRandomPlayer,
  resetAuction,
  sellPlayer,
  sellPlayerManually,
  skipDraftTurn,
  startAuction,
  startBidding,
} from '@/data-layer'
import type { AuctionBatch, PlayerId, UserId } from '@fantasy-cricket/shared'

import {
  indexPool,
  managerRows,
  momentOf,
  playerLists,
} from './auction-derived'
import { useAuction, useAuctionStatic } from './auction-store'
import { batchName, price, sameBatch } from './labels'
import { OverseasMark } from './overseas-mark'

/**
 * **The auctioneer's controls**, shown to whoever holds the role right now —
 * so a handover changes what renders, not where anyone navigates.
 *
 * **Each control follows the moment.** Start before the auction exists; the
 * next batch and a player between rounds; sell, unsold, pause and extra time
 * while bidding; the draft's controls in the draft; rewind only inside
 * recovery. Batches step through the league's sequence **in order only**.
 *
 * **Live from Phase E**: start, the next batch, putting a player up, opening
 * bidding, selling and unsold, the draft, and the testing-only reset. Pause,
 * extra time, recovery and ending come in a later phase and say so when
 * clicked.
 *
 * Bids are not accepted here by hand: the bid processor running in this same
 * browser does that, one at a time. Its refusals from the service show below.
 */
export function AuctioneerPanel() {
  const data = useAuctionStatic()
  const state = useAuction((s) => s.state)
  const round = useAuction((s) => s.round)
  const statuses = useAuction((s) => s.players)
  const managerStatuses = useAuction((s) => s.managers)
  const draftPick = useAuction((s) => s.draftPick)

  const leagueId = data.league.leagueId
  const processorError = useAuction((s) => s.processorError)

  const [note, setNote] = useState<string | undefined>(undefined)
  const tried = (what: string) => () =>
    setNote(`${what} comes in a later phase.`)

  /*
    One action at a time from this panel: the button pressed shows it is
    working, every control waits, and a refusal from the service is shown
    rather than swallowed.
  */
  const [busy, setBusy] = useState<string | undefined>(undefined)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const act = (label: string, run: () => Promise<void>) => () => {
    setBusy(label)
    setFailure(undefined)
    setNote(undefined)
    void run()
      .catch((e: unknown) =>
        setFailure(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setBusy(undefined))
  }
  const working = busy !== undefined
  const [resetArmed, setResetArmed] = useState(false)

  const pool = useMemo(() => indexPool(data.pool), [data.pool])
  const lists = useMemo(
    () => playerLists(data.pool, statuses),
    [data.pool, statuses],
  )
  const managers = useMemo(
    () => managerRows(data.members, managerStatuses, data.settings, pool),
    [data.members, managerStatuses, data.settings, pool],
  )

  const moment = momentOf(state, round)
  const sequence = data.settings.batchSequence ?? []
  const currentIndex =
    state?.currentBatch === undefined
      ? -1
      : sequence.findIndex((b) =>
          sameBatch(b, state.currentBatch as AuctionBatch),
        )
  const nextBatch = sequence[currentIndex + 1]

  // The current bidding batch's players still to go up.
  const batch = state?.currentBatch
  const inBatch =
    batch === undefined || batch.kind === 'draft'
      ? []
      : lists.remaining.filter(
          (entry) =>
            entry.playerCategory === batch.playerCategory &&
            entry.player.playerRole === batch.playerRole,
        )

  const leaderName =
    round?.currentLeadingManager === undefined
      ? undefined
      : (managers.find((m) => m.userId === round.currentLeadingManager)
          ?.teamName ?? 'the leader')

  const drafterName =
    managers.find((m) => m.userId === state?.currentDraftManagerId)?.teamName ??
    'the manager'
  // A turn is settled once its pick has gone through or it was skipped. Only
  // then may Next move on.
  const turnStarted = state?.currentDraftManagerId !== undefined
  const turnSettled =
    draftPick !== undefined &&
    (draftPick.skipped === true || draftPick.accepted === true)

  const live = moment !== 'notStarted' && moment !== 'ended'
  const canReset = resolveEnvironment() !== 'prod'

  return (
    <section className="rounded-xl border border-primary/40 bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">Auctioneer</h3>
        {batch !== undefined && (
          <span className="font-mono text-xs text-muted-foreground">
            {batchName(batch)}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        {moment === 'notStarted' && (
          <Actions>
            <Button
              onClick={act('start', () => startAuction(leagueId))}
              disabled={working}
            >
              {busy === 'start' ? 'Starting…' : 'Start auction'}
            </Button>
          </Actions>
        )}

        {(moment === 'betweenPlayers' ||
          moment === 'sold' ||
          moment === 'unsold') && (
          <>
            {batch !== undefined && batch.kind === 'auction' && (
              <PickPlayer
                disabled={working}
                onSelect={(playerId) =>
                  act('put up', () => putUpPlayer(leagueId, playerId))()
                }
                onRandom={act('random', () => putUpRandomPlayer(leagueId))}
                homeNation={data.settings.homeNation}
                players={inBatch.map((entry) => ({
                  id: entry.player.playerId,
                  country: entry.player.country,
                  label: `${entry.player.playerName} · ${price(entry.playerBasePrice)}`,
                }))}
              />
            )}
            <Actions>
              {nextBatch === undefined ? (
                <p className="text-sm text-muted-foreground">
                  {sequence.length === 0
                    ? 'This league has no batch order.'
                    : 'Every batch in the order has been reached.'}
                </p>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={act('batch', () => moveToNextBatch(leagueId))}
                    disabled={working || inBatch.length > 0}
                  >
                    Next batch: {batchName(nextBatch)}
                  </Button>
                  {/* Every player in a batch goes up before the next one. */}
                  {inBatch.length > 0 && (
                    <p className="self-center text-xs text-subtle-foreground">
                      {inBatch.length}{' '}
                      {inBatch.length === 1 ? 'player' : 'players'} left in this
                      batch
                    </p>
                  )}
                </>
              )}
            </Actions>
          </>
        )}

        {moment === 'selected' && (
          <Actions>
            <Button
              onClick={act('bidding', () => startBidding(leagueId))}
              disabled={working}
            >
              {busy === 'bidding' ? 'Opening…' : 'Start bidding'}
            </Button>
          </Actions>
        )}

        {(moment === 'bidding' || moment === 'timeUp') && (
          <>
            <Actions>
              <Button
                onClick={act('sell', () => sellPlayer(leagueId))}
                disabled={working || round?.currentLeadingBid === undefined}
              >
                {round?.currentLeadingBid === undefined
                  ? 'Sell (no bids yet)'
                  : `Sell to ${leaderName} for ${price(round.currentLeadingBid)}`}
              </Button>
              <Button
                variant="outline"
                onClick={act('unsold', () => markPlayerUnsold(leagueId))}
                disabled={working}
              >
                Mark unsold
              </Button>
              {moment === 'bidding' && (
                <>
                  <Button variant="outline" onClick={tried('Pausing')}>
                    Pause
                  </Button>
                  <Button variant="outline" onClick={tried('Adding time')}>
                    +10 s
                  </Button>
                </>
              )}
            </Actions>
            <ManualSell
              managers={managers.map((m) => ({
                id: m.userId,
                label: m.teamName,
              }))}
              disabled={working}
              onSell={(managerId, amount) =>
                act('manual', () =>
                  sellPlayerManually(leagueId, managerId, amount),
                )()
              }
            />
          </>
        )}

        {moment === 'paused' && (
          <Actions>
            <Button onClick={tried('Resuming')}>Resume</Button>
          </Actions>
        )}

        {/*
          Picks are accepted by the processor in this browser as they arrive,
          so there is no Accept button. Next waits until the turn is settled —
          a pick gone through, or a skip — and Skip is its own button, shown
          only while the manager is still deciding, so a double click on Next
          can never skip anyone.
        */}
        {moment === 'draft' && (
          <>
            {turnStarted && (
              <p className="text-sm text-muted-foreground">
                {draftPick === undefined
                  ? `Waiting for ${drafterName} to pick.`
                  : draftPick.skipped === true
                    ? `${drafterName}'s turn was skipped.`
                    : `${drafterName} picked ${
                        pool.get(draftPick.playerId)?.player.playerName ??
                        'a player'
                      }${draftPick.accepted === true ? '.' : ' — going through…'}`}
              </p>
            )}
            <Actions>
              <Button
                onClick={act('draft', () => nextDraftManager(leagueId))}
                disabled={working || (turnStarted && !turnSettled)}
              >
                {busy === 'draft'
                  ? 'Moving on…'
                  : turnStarted
                    ? 'Next in draft order'
                    : 'Start draft'}
              </Button>
              {turnStarted && draftPick === undefined && (
                <Button
                  variant="outline"
                  onClick={act('skip', () => skipDraftTurn(leagueId))}
                  disabled={working}
                >
                  {busy === 'skip' ? 'Skipping…' : `Skip ${drafterName}'s turn`}
                </Button>
              )}
            </Actions>
          </>
        )}

        {moment === 'recovering' && (
          <Actions>
            <Button onClick={tried('Rewinding')}>Rewind last round</Button>
            <Button variant="outline" onClick={tried('Ending recovery')}>
              End recovery
            </Button>
          </Actions>
        )}

        {moment === 'ended' && (
          <p className="text-sm text-muted-foreground">
            The auction is over. Nothing left to run.
          </p>
        )}

        {/*
          Rare and consequential, so folded away from the controls used every
          round. Recovery is entered deliberately, so a rewind can never fire
          mid-round by accident.
        */}
        {live && moment !== 'recovering' && (
          <details className="rounded-md border px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              More
            </summary>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Button variant="outline" onClick={tried('Start recovery')}>
                Start recovery
              </Button>
              <Button variant="outline" onClick={tried('Ending the auction')}>
                End auction
              </Button>
            </div>
          </details>
        )}

        {/*
          Testing only, and in any phase once the auction exists — including
          recovery and after it has ended, which is when a fresh start is most
          wanted. Two taps, since it deletes the whole auction.
        */}
        {canReset && moment !== 'notStarted' && (
          <details className="rounded-md border border-destructive/40 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-muted-foreground">
              Testing
            </summary>
            <div className="mt-3 grid gap-2.5">
              {/* Runs the batches through to the draft without bidding. */}
              {batch?.kind === 'auction' &&
                (moment === 'betweenPlayers' ||
                  moment === 'selected' ||
                  moment === 'sold' ||
                  moment === 'unsold') && (
                  <div>
                    <Button
                      variant="outline"
                      onClick={act('batch unsold', () =>
                        markBatchUnsold(leagueId),
                      )}
                      disabled={working || inBatch.length === 0}
                    >
                      {busy === 'batch unsold'
                        ? 'Marking…'
                        : `Mark everyone in this batch unsold (${inBatch.length})`}
                    </Button>
                  </div>
                )}
              {resetArmed ? (
                <>
                  <p className="text-sm text-destructive">
                    Deletes this auction, every squad it filled and any lineups
                    built on them. Managers and the draft order stay.
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <Button
                      variant="destructive"
                      onClick={act('reset', async () => {
                        setResetArmed(false)
                        await resetAuction(leagueId)
                      })}
                      disabled={working}
                    >
                      {busy === 'reset' ? 'Resetting…' : 'Reset now'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setResetArmed(false)}
                      disabled={working}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div>
                  <Button
                    variant="destructive"
                    onClick={() => setResetArmed(true)}
                    disabled={working}
                  >
                    Reset auction
                  </Button>
                </div>
              )}
            </div>
          </details>
        )}

        {note !== undefined && (
          <p className="text-xs text-subtle-foreground">{note}</p>
        )}
        {failure !== undefined && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        {processorError !== undefined && (
          <p className="text-xs text-muted-foreground">
            Last bid not accepted: {processorError}
          </p>
        )}
      </div>
    </section>
  )
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2.5">{children}</div>
}

/** A player from the current batch, chosen or drawn at random. */
function PickPlayer({
  players,
  homeNation,
  disabled,
  onSelect,
  onRandom,
}: {
  players: { id: PlayerId; country: string; label: string }[]
  homeNation: string | undefined
  disabled: boolean
  onSelect: (playerId: PlayerId) => void
  onRandom: () => void
}) {
  const [chosen, setChosen] = useState<string>('')

  if (players.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nobody left in this batch. Move to the next one.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <Select value={chosen} onValueChange={setChosen}>
        <SelectTrigger className="w-full sm:w-64" aria-label="Next player">
          <SelectValue placeholder={`Choose from ${players.length} left`} />
        </SelectTrigger>
        <SelectContent>
          {players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <OverseasMark
                player={{ country: p.country }}
                homeNation={homeNation}
                keepSpace
              />
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={() => onSelect(chosen as PlayerId)}
        disabled={disabled || chosen === ''}
      >
        Put up
      </Button>
      <Button variant="outline" onClick={onRandom} disabled={disabled}>
        Random
      </Button>
    </div>
  )
}

/**
 * **A last resort**, for when something has broken and the auction must not
 * stall: sell to a chosen manager at a chosen price. Folded away so it is
 * never mistaken for the normal sell.
 */
function ManualSell({
  managers,
  disabled,
  onSell,
}: {
  managers: { id: UserId; label: string }[]
  disabled: boolean
  onSell: (managerId: UserId, amount: number) => void
}) {
  const [manager, setManager] = useState<string>('')
  const [amount, setAmount] = useState('')

  return (
    <details className="rounded-md border px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-muted-foreground">
        Fallback: sell manually
      </summary>
      <p className="mt-2 text-xs text-subtle-foreground">
        Only if something has gone wrong. The bidding so far is kept, and this
        sale is added as the final bid.
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <Select value={manager} onValueChange={setManager}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Sell to">
            <SelectValue placeholder="Sell to…" />
          </SelectTrigger>
          <SelectContent>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          inputMode="decimal"
          min={0.5}
          step={0.5}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Price"
          className="w-28"
          aria-label="Price"
        />
        <Button
          variant="outline"
          onClick={() => onSell(manager as UserId, Number(amount))}
          disabled={disabled || manager === '' || amount === ''}
        >
          Sell
        </Button>
      </div>
    </details>
  )
}
