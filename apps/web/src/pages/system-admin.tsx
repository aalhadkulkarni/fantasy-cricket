import { useState } from 'react'

import { CompetitionsPanel } from '@/components/admin/competitions-panel'
import { PlayersPanel } from '@/components/admin/players-panel'
import { TeamsPanel } from '@/components/admin/teams-panel'
import { TournamentsPanel } from '@/components/admin/tournaments-panel'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { resolveEnvironment } from '@/config/environments'
import {
  createSampleIplTournament,
  createSamplePlayers,
  populateSeedData,
  setUpBasicSystem,
  type SamplePlayersResult,
  type SampleTournamentResult,
  type SeedDataResult,
  type SystemSetupResult,
} from '@/data-layer/system-setup'

/**
 * System admin — `/admin`.
 *
 * **System admins only**, and the route is guarded in the data layer rather
 * than only by hiding the link. Anyone can type a URL.
 *
 * TODO: there is no auth yet, so this is reachable by anyone. The setup button
 * below being safe to press twice is what makes that tolerable for now.
 */
export function SystemAdmin() {
  /*
    The panels share a catalogue, so a write in one can invalidate what another
    is showing: a team created above is a dropdown option below. Bumping this
    reloads every panel, which is cheap at this size and cannot go stale the way
    passing individual lists between them would.
  */
  const [catalogueVersion, setCatalogueVersion] = useState(0)
  const catalogueChanged = () => setCatalogueVersion((n) => n + 1)

  return (
    <main className="py-10 sm:py-14">
      <PageContainer>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Admin panel
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Cricket reference data, tournaments and scoring.
        </p>

        <SetUpBasicSystem onSetUp={catalogueChanged} />

        <CreateSamplePlayers onCreated={catalogueChanged} />

        {resolveEnvironment() !== 'prod' && (
          <>
            <PopulateSeedData onPopulated={catalogueChanged} />
            <CreateSampleIplTournament onCreated={catalogueChanged} />
          </>
        )}

        <CompetitionsPanel
          catalogueVersion={catalogueVersion}
          onChanged={catalogueChanged}
        />

        <TeamsPanel
          catalogueVersion={catalogueVersion}
          onChanged={catalogueChanged}
        />

        <PlayersPanel
          catalogueVersion={catalogueVersion}
          onChanged={catalogueChanged}
        />

        <TournamentsPanel
          catalogueVersion={catalogueVersion}
          onChanged={catalogueChanged}
        />

        <div className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
          <p className="font-mono text-xs tracking-wide text-subtle-foreground uppercase">
            Still to come
          </p>
          <p className="mt-3 text-sm">
            Publishing a tournament, leagues, standard points, and adding
            another system admin. See docs/08-pages/system-admin.md.
          </p>
        </div>
      </PageContainer>
    </main>
  )
}

type State =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: SystemSetupResult }
  | { status: 'failed'; code: string; message: string }

/**
 * Seeds the reference tables into whichever environment this is running in.
 *
 * **Writes to the active root**, so on production this seeds `prod/` and
 * locally it seeds `local/`. Seeding production means merging to `release` and
 * pressing it there.
 *
 * Safe to press twice: the routine reads its own marker first and does nothing
 * if the environment is already set up.
 */
function SetUpBasicSystem({ onSetUp }: { onSetUp: () => void }) {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await setUpBasicSystem() })
      // It writes the competitions and the reference tables, which every panel
      // below reads.
      onSetUp()
    } catch (error) {
      setState({
        status: 'failed',
        // Wrapped by the layer, so never a raw Firebase error.
        code: (error as { code?: string }).code ?? 'unknown',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="floodlit mt-8 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-base font-semibold">Set up basic system</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Writes the reference tables and the standards a new league inherits.
        Runs once per environment.
      </p>

      <div className="mt-5">
        <Button
          onClick={() => void run()}
          disabled={state.status === 'running'}
        >
          {state.status === 'running' ? 'Setting up…' : 'Set up basic system'}
        </Button>
      </div>

      <Outcome state={state} />
    </div>
  )
}

function Outcome({ state }: { state: State }) {
  if (state.status === 'idle' || state.status === 'running') return null

  if (state.status === 'failed') {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">
          Setup failed — {state.code}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {state.message}
        </p>
        <p className="mt-2 text-xs text-subtle-foreground">
          Nothing was written. The whole seed is one atomic update.
        </p>
      </div>
    )
  }

  const { result } = state
  const when = new Date(result.completedAt).toLocaleString()

  if (result.status === 'alreadyDone') {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold">Already set up, so nothing was written.</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {result.environment} · seeded {when}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-5 text-sm">
      <p className="font-semibold text-settled">Seeded {result.environment}</p>
      <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
        {Object.entries(result.written).map(([node, count]) => (
          <li key={node}>
            {node} · {count}
          </li>
        ))}
        <li>standards · 3</li>
      </ul>
    </div>
  )
}

type SampleState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: SamplePlayersResult }
  | { status: 'failed'; message: string }

/**
 * Two international T20 squads, so there is something to pick from.
 *
 * **Test data, not reference data.** Nothing depends on these existing, and a
 * real environment enters its own catalogue through the players panel. This is
 * here so testing does not start with half an hour of typing.
 *
 * Safe to press twice: a name already in the catalogue is skipped rather than
 * duplicated, so a second press adds only what the first one missed.
 */
function CreateSamplePlayers({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<SampleState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await createSamplePlayers() })
      onCreated()
    } catch (error) {
      setState({
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <div className="floodlit mt-4 rounded-lg border bg-card p-5 text-card-foreground sm:p-6">
      <h2 className="text-base font-semibold">Create sample players</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        India and Australia, twenty-three players between them, all in the T20
        Series. Creates the two teams if they do not exist.
      </p>

      <div className="mt-5">
        <Button
          variant="outline"
          onClick={() => void run()}
          disabled={state.status === 'running'}
        >
          {state.status === 'running' ? 'Creating…' : 'Create sample players'}
        </Button>
      </div>

      <SampleOutcome state={state} />
    </div>
  )
}

function SampleOutcome({ state }: { state: SampleState }) {
  if (state.status === 'idle' || state.status === 'running') return null

  if (state.status === 'failed') {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">Could not create them</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {state.message}
        </p>
      </div>
    )
  }

  const { result } = state

  return (
    <div className="mt-5 text-sm">
      <p className="font-semibold text-settled">
        {result.created === 0
          ? 'Nothing to add — they are all here already.'
          : `Created ${result.created} ${result.created === 1 ? 'player' : 'players'} in ${result.competitionName}.`}
      </p>

      <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
        {result.teamsCreated.length > 0 && (
          <li>teams created · {result.teamsCreated.join(', ')}</li>
        )}
        {result.skipped.length > 0 && (
          <li>already present · {result.skipped.length}</li>
        )}
      </ul>
    </div>
  )
}

type SeedState =
  | { status: 'idle' }
  | { status: 'armed' }
  | { status: 'running' }
  | { status: 'done'; result: SeedDataResult }
  | { status: 'failed'; message: string }

/**
 * **Wipes the environment and loads the IPL 2026 test data.** Not shown in
 * production, and the service refuses it there regardless.
 *
 * Two taps: the first arms it and says what will go, the second runs it.
 */
function PopulateSeedData({ onPopulated }: { onPopulated: () => void }) {
  const [state, setState] = useState<SeedState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await populateSeedData() })
      onPopulated()
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
        Resets this environment to the IPL 2026 pool: the ten franchises,
        thirteen national teams and 250 players with their auction categories
        and base prices.
      </p>

      {state.status === 'armed' ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-destructive">
            Deletes every player, team, tournament and league in this
            environment, with all lineups, squads, auctions and points. Users
            and base tournaments stay.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => void run()}>
              Delete everything and populate
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
            disabled={state.status === 'running'}
          >
            {state.status === 'running' ? 'Populating…' : 'Populate seed data'}
          </Button>
        </div>
      )}

      <SeedOutcome state={state} />
    </div>
  )
}

function SeedOutcome({ state }: { state: SeedState }) {
  if (state.status === 'failed') {
    return (
      <div className="mt-5 text-sm">
        <p className="font-semibold text-destructive">Could not populate</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {state.message}
        </p>
        <p className="mt-2 text-xs text-subtle-foreground">
          Nothing was changed. The reset is one atomic update.
        </p>
      </div>
    )
  }
  if (state.status !== 'done') return null

  const { result } = state

  return (
    <div className="mt-5 text-sm">
      <p className="font-semibold text-settled">
        Reset {result.environment} and populated it.
      </p>
      <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted-foreground">
        <li>teams · {result.teamsCreated}</li>
        <li>players · {result.playersCreated}</li>
        <li>users whose leagues were cleared · {result.usersCleared}</li>
      </ul>
      {result.missingCompetitions.length > 0 && (
        <p className="mt-2 text-xs text-destructive">
          Base tournaments not found, so no one was put in them:{' '}
          {result.missingCompetitions.join(', ')}
        </p>
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
 * everything after it starts from a full tournament. Not shown in production,
 * and the service refuses it there regardless.
 */
function CreateSampleIplTournament({ onCreated }: { onCreated: () => void }) {
  const [state, setState] = useState<TournamentState>({ status: 'idle' })

  async function run() {
    setState({ status: 'running' })
    try {
      setState({ status: 'done', result: await createSampleIplTournament() })
      onCreated()
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
          disabled={state.status === 'running'}
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
