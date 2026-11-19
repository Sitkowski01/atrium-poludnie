import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { watchOrphans } from './domain/orphans'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/app.css'

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// polskie sieroty (a, i, o, u, w, z) nie zostają na końcu linii — także w tekstach, które React podmienia
watchOrphans(root)
