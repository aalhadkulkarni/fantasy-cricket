import { MyLeagues } from './pages/my-leagues'

/**
 * Renders home directly for now. **Routing arrives in 3.5**, at which point this
 * becomes the router and every page under `src/pages/` gets a real route.
 */
function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <MyLeagues />
    </div>
  )
}

export default App
