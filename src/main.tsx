import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConversationProvider } from '@elevenlabs/react'
import App from './App'
import { AuthProvider } from './AuthContext'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ConversationProvider serverLocation="eu-residency">
        <App />
      </ConversationProvider>
    </AuthProvider>
  </StrictMode>,
)
