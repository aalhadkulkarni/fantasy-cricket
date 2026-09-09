import { Route, Routes } from 'react-router'

import { RequireAccount } from './auth/require-account'
import { SiteHeader } from './components/site-header'
import { ActionsCenter } from './pages/actions-center'
import { CreateLeague } from './pages/create-league'
import { Login } from './pages/login'
import { MyLeagues } from './pages/my-leagues'
import { NotFound } from './pages/not-found'
import { SystemAdmin } from './pages/system-admin'
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
 * **No route guards yet.** `docs/04-navigation.md` specifies redirects for a
 * signed-out visitor, a non-member, a banned user, a spectator on My Team and a
 * non-admin on the admin panel. All of those need auth and league data. When
 * they arrive, note that guards are convenience — the data layer is the actual
 * check, because anyone can type a URL.
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
                <Route path={ROUTES.createLeague} element={<CreateLeague />} />
                <Route path={ROUTES.actions} element={<ActionsCenter />} />
                <Route path={ROUTES.admin} element={<SystemAdmin />} />

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
