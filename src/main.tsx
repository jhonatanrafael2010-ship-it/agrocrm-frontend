import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ⚠️ Removido o StrictMode — ele causa re-render duplo no modo dev
createRoot(document.getElementById('root')!).render(<App />)
