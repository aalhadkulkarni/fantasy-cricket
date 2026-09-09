import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { resolveEnvironment } from './config/environments'
import { setEnvironment } from './data-layer'

// Config decides which deployment this is; the data layer is told, and builds
// its backend service for it. Before the render rather than in a component or
// an effect, so there is no window in which something could mount and reach the
// data layer first. Every read and write depends on this.
setEnvironment(resolveEnvironment())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
