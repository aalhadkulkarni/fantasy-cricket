import { useState } from 'react'

import { PlayersPanel } from '@/components/admin/players-panel'
import { TeamsPanel } from '@/components/admin/teams-panel'
import { TournamentsPanel } from '@/components/admin/tournaments-panel'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import {
  setUpBasicSystem,
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
