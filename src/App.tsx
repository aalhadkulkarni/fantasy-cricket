import { SiteHeader } from './components/site-header'
import { MyLeagues } from './pages/my-leagues'

/**
 * The app shell: the site header above whichever page is showing.
 *
 * **Routing arrives in 3.5**, at which point the page below the header comes
 * from a route rather than being hard-coded.
 */
function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <SiteHeader />
      <MyLeagues />
    </div>
  )
}

export default App
