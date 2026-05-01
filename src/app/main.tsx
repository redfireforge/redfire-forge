import '../suppressResizeObserverError'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App'
import WorkflowToastProvider from '../features/workflow/components/WorkflowToastProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkflowToastProvider>
      <App />
    </WorkflowToastProvider>
  </StrictMode>,
)
