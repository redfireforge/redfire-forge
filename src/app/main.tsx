import '../suppressResizeObserverError'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App'
import WorkflowToastProvider from '../features/workflow/components/WorkflowToastProvider'
import { isTauri } from '../shared/utils/platform'
import { setKafkaClientTransport } from '../shared/kafka/kafkaClient'
import { kafkaNativeTauriTransport } from '../shared/kafka/kafkaNativeTauriTransport'

// Wire the native Tauri Kafka transport at module level — before createRoot —
// so the correct transport is active from the very first Kafka call.
// Doing this at module level (not inside a useEffect) avoids:
//   a) a brief window where the first Kafka call might use the server-proxy
//   b) double-registration under React StrictMode which runs effects twice in dev
if (isTauri()) {
  setKafkaClientTransport(kafkaNativeTauriTransport);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkflowToastProvider>
      <App />
    </WorkflowToastProvider>
  </StrictMode>,
)
