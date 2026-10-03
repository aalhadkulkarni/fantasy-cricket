import { Route, Routes } from 'react-router'

import { RequireAccount } from './auth/require-account'
import { RequireSystemAdmin } from './auth/require-system-admin'
import { RequireSystemOwner } from './auth/require-system-owner'
import { SiteHeader } from './components/site-header'
import { ActionsCenter } from './pages/actions-center'
import { CreateLeague } from './pages/create-league'
import { Login } from './pages/login'
import { MyLeagues } from './pages/my-leagues'
import { NotFound } from './pages/not-found'
import { PointsSystem } from './pages/points-system'
import { LeagueDetails } from './pages/league/league-details'
import { Leaderboard } from './pages/league/leaderboard'
import { Members } from './pages/league/members'
import { MyTeam } from './pages/league/my-team'
import { Squads } from './pages/league/squads'
import { Auction } from './pages/auction'
import { AuctionCenter } from './pages/league/auction-center'
import { LeagueHome, LeagueLanding, SectionGuard } from './pages/league-home'
import { AdminBulk } from './pages/admin-bulk'
import { Setup } from './pages/setup'
import { SystemAdmin } from './pages/system-admin'
import { TournamentAdmin } from './pages/tournament-admin'
import { TournamentHome } from './pages/tournament-home'
import { TournamentPoints } from './pages/tournament-points'
import { Tournaments } from './pages/tournaments'
import { ROUTES } from './routes'

/**
 * The app shell: the site header above whichever page the URL names.
 *
 * **Every screen is a real route.** No page is reachable only through in-page
 * state. That is what makes the back gesture move between sections rather than
 * throwing someone out, which matters because most usage is a phone browser
 * where back is a swipe people use constantly. It also means refresh keeps you
 * where you were, the actions center can deep-link, and a bug report carries a
 * URL somebody can open.
 *
 * The header sits outside `Routes` so it is not remounted on navigation.
 *
 * **Two guards, and both are convenience.** `RequireAccount` sends a
 * signed-out visitor to the login page, and `RequireSystemAdmin` sends
 * everyone else home from the admin routes. The service is the actual check —
 * anyone can type a URL, or skip the app altogether. The rest of the redirects
 * in `docs/04-navigation.md` — a non-member, a banned user, a spectator on My
 * Team — need league data and are not built.
 */
function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <Routes>
        {/* No header. A signed-out visitor has nothing to navigate to. */}
        <Route path={ROUTES.login} element={<Login />} />

        <Route
          path="*"
          element={
            <RequireAccount>
              <SiteHeader />
              <Routes>
                <Route path={ROUTES.home} element={<MyLeagues />} />
                <Route path={ROUTES.tournaments} element={<Tournaments />} />
                <Route path={ROUTES.tournament} element={<TournamentHome />} />
                <Route
                  path={ROUTES.tournamentPoints}
                  element={
                    <RequireSystemAdmin>
                      <TournamentPoints />
                    </RequireSystemAdmin>
                  }
                />
                <Route path={ROUTES.createLeague} element={<CreateLeague />} />
                <Route path={ROUTES.actions} element={<ActionsCenter />} />
                <Route path={ROUTES.pointsSystem} element={<PointsSystem />} />
                {/*
                  League home wraps its sections, so the summary strip and the
                  sidebar are not remounted when moving between them.
                */}
                <Route path={ROUTES.league} element={<LeagueHome />}>
                  <Route index element={<LeagueLanding />} />
                  <Route path="details" element={<LeagueDetails />} />
                  <Route
                    path="auction-center"
                    element={
                      <SectionGuard section="auction-center">
                        <AuctionCenter />
                      </SectionGuard>
                    }
                  />
                  <Route
                    path="team"
                    element={
                      <SectionGuard section="team">
                        <MyTeam />
                      </SectionGuard>
                    }
                  />
                  <Route
                    path="squads"
                    element={
                      <SectionGuard section="squads">
                        <Squads />
                      </SectionGuard>
                    }
                  />
                  <Route path="leaderboard" element={<Leaderboard />} />
                  <Route path="members" element={<Members />} />
                </Route>

                {/* Outside the league layout: it opens in a tab of its own. */}
                <Route path={ROUTES.auction} element={<Auction />} />

                <Route
                  path={ROUTES.admin}
                  element={
                    <RequireSystemAdmin>
                      <SystemAdmin />
                    </RequireSystemAdmin>
                  }
                />
                <Route
                  path={ROUTES.adminBulk}
                  element={
                    <RequireSystemAdmin>
                      <AdminBulk />
                    </RequireSystemAdmin>
                  }
                />
                <Route
                  path={ROUTES.setup}
                  element={
                    <RequireSystemOwner>
                      <Setup />
                    </RequireSystemOwner>
                  }
                />
                <Route
                  path={ROUTES.adminTournament}
                  element={
                    <RequireSystemAdmin>
                      <TournamentAdmin />
                    </RequireSystemAdmin>
                  }
                />

                {/* A not-found state, never a blank page. */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RequireAccount>
          }
        />
      </Routes>
    </div>
  )
}

export default App
