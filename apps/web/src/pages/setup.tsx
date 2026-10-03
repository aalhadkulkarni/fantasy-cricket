import { useEffect, useState } from 'react'

import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  createSampleIplTournament,
  getSystemStatus,
  populateSeedData,
  refreshStandards,
  resetEnvironment,
  type ResetEnvironmentResult,
  type SampleTournamentResult,
  type SeedDataResult,
  type StandardsRefreshResult,
  type SystemStatus,
} from '@/data-layer/system-setup'

/**
 * Setup — `/setup`. **System owner only, and linked from nowhere.**
 *
 * The tools for setting an environment up while the system is in development:
 * refresh its standards, wipe it, load the IPL 2026 pool into it, and build a
 * sample tournament. They work on every environment, production included,
 * **until it is released** — `systemReleased`, set by hand in the console —
 * after which the service refuses them, even for the owner.
 */
export function Setup() {
  const [status, setStatus] = useState<SystemStatus | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const loaded = await getSystemStatus()
        if (!cancelled) setStatus(loaded)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Until the status is known, nothing can be pressed.
  const locked = status === undefined || status.released

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Setup</h1>

        {error !== undefined ? (
          <p className="mt-2 text-sm text-destructive">
            Could not read this environment&apos;s status: {error}
          </p>
        ) : status === undefined ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : status.released ? (
          <p className="mt-2 text-sm font-semibold text-destructive">
            {status.environment} is released, so these tools are switched off.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Development tools for{' '}
            <span className="font-mono font-semibold text-foreground">
              {status.environment}
            </span>
            . They stop working once it is released.
          </p>
        )}

        <RefreshStandards disabled={locked} />
        <ResetEnvironment disabled={locked} />
        <PopulateSeedData disabled={locked} />
        <CreateSampleIplTournament disabled={locked} />
      </PageContainer>
    </main>
  )
}

type RefreshState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: StandardsRefreshResult }
  | { status: 'failed'; message: string }

/**
 * **Rewrites the reference tables and the standards** from the seed data —
 * for an environment seeded before they changed, since Set up basic system
 * runs once. Players, teams, tournaments and leagues are left alone.
 */
function RefreshStandards({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<RefreshState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await refreshStandards() })
    } catch (error) {
      setState({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="floodlit mt-8 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-base font-semibold">Refresh standards</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Rewrites the reference tables — roles, formats, auction phases, timeline
        events — and the standards a new league inherits: auction config, lineup
        rules, deadline offset. Every player&apos;s auction values are kept.
      </p>

      <div className="mt-5">
        <Button
          variant="outline"
          onClick={() => void run()}
          disabled={disabled || state.status === 'running'}
        >
          {state.status === 'running' ? 'Refreshing…' : 'Refresh standards'}
        </Button>
      </div>

      {state.status === 'failed' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-destructive">
            Could not refresh them
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {state.message}
          </p>
        </div>
      )}
      {state.status === 'done' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-settled">
            Refreshed {state.result.environment}.
          </p>
          <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
            {state.result.written.map((node) => (
              <li key={node}>{node}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

type ResetState =
  | { status: 'idle' }
  | { status: 'armed' }
  | { status: 'running' }
  | { status: 'done'; result: ResetEnvironmentResult }
  | { status: 'failed'; message: string }

/**
 * **Wipes the environment**: every player, team, tournament and league, and
 * everything hanging off them. Users, base tournaments and the standards stay.
 *
 * Two taps: the first arms it and says what will go, the second runs it.
 */
function ResetEnvironment({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<ResetState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await resetEnvironment() })
    } catch (error) {
      setState({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-base font-semibold">Reset environment</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Deletes the catalogue and everything built on it, leaving users, base
        tournaments and the standards — ready for Populate seed data or a real
        catalogue.
      </p>

      {state.status === 'armed' ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-destructive">
            Deletes every player, team, tournament and league in this
            environment, with all lineups, squads, auctions and points. Users
            and base tournaments stay.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              onClick={() => void run()}
              disabled={disabled}
            >
              Delete everything
            </Button>
            <Button
              variant="outline"
              onClick={() => setState({ status: 'idle' })}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <Button
            variant="outline"
            onClick={() => setState({ status: 'armed' })}
            disabled={disabled || state.status === 'running'}
          >
            {state.status === 'running' ? 'Resetting…' : 'Reset environment'}
          </Button>
        </div>
      )}

      {state.status === 'failed' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-destructive">Could not reset</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {state.message}
          </p>
          <p className="mt-2 text-xs text-subtle-foreground">
            Nothing was changed. The reset is one atomic update.
          </p>
        </div>
      )}
      {state.status === 'done' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-settled">
            Reset {state.result.environment}.
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            users whose leagues were cleared · {state.result.usersCleared}
          </p>
        </div>
      )}
    </div>
  )
}

type SeedState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: SeedDataResult }
  | { status: 'failed'; message: string }

/**
 * **Loads the IPL 2026 pool into an empty environment.** Deletes nothing, so
 * one tap; the service refuses it while any players or teams exist.
 */
function PopulateSeedData({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<SeedState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await populateSeedData() })
    } catch (error) {
      setState({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-base font-semibold">Populate seed data</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Loads the IPL 2026 pool: the ten franchises, thirteen national teams and
        250 players with their auction categories and base prices. Needs an
        empty environment — reset it first.
      </p>

      <div className="mt-5">
        <Button
          variant="outline"
          onClick={() => void run()}
          disabled={disabled || state.status === 'running'}
        >
          {state.status === 'running' ? 'Populating…' : 'Populate seed data'}
        </Button>
      </div>

      {state.status === 'failed' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-destructive">Could not populate</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {state.message}
          </p>
        </div>
      )}
      {state.status === 'done' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-settled">
            Populated {state.result.environment}.
          </p>
          <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
            <li>teams · {state.result.teamsCreated}</li>
            <li>players · {state.result.playersCreated}</li>
          </ul>
          {state.result.missingCompetitions.length > 0 && (
            <p className="mt-2 text-xs text-destructive">
              Base tournaments not found, so no one was put in them:{' '}
              {state.result.missingCompetitions.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

type TournamentState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: SampleTournamentResult }
  | { status: 'failed'; message: string }

/**
 * **An unpublished IPL 2027 on the 2026 schedule**, so testing publish and
 * everything after it starts from a full tournament. The service refuses it
 * for anyone but the system owner, and once released.
 */
function CreateSampleIplTournament({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<TournamentState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await createSampleIplTournament() })
    } catch (error) {
      setState({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-base font-semibold">Create sample IPL 2027</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The 2026 schedule moved to 2027: 70 league fixtures, four playoffs dated
        but TBA vs TBA, every IPL team and player. Left unpublished. Needs
        Populate seed data first.
      </p>

      <div className="mt-5">
        <Button
          variant="outline"
          onClick={() => void run()}
          disabled={disabled || state.status === 'running'}
        >
          {state.status === 'running' ? 'Creating…' : 'Create sample IPL 2027'}
        </Button>
      </div>

      {state.status === 'failed' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-destructive">Could not create it</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {state.message}
          </p>
        </div>
      )}

      {state.status === 'done' && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-settled">
            Created {state.result.tournamentName}, unpublished.
          </p>
          <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
            <li>matches · {state.result.matches}</li>
            <li>teams · {state.result.teams}</li>
            <li>players · {state.result.players}</li>
            <li>rounds · {state.result.rounds.join(', ')}</li>
          </ul>
        </div>
      )}
    </div>
  )
}
