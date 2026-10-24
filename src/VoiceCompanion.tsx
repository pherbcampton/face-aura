import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Mic, MicOff, Sparkles, Volume2, X } from 'lucide-react'
import { useConversation } from '@elevenlabs/react'
import { useAuth } from './AuthContext'
import type { SkinAnalysis } from './types'

export default function VoiceCompanion({ analysis, intent, onClose }: { analysis: SkinAnalysis; intent: 'conversation' | 'results'; onClose: () => void }) {
  const { session, displayName } = useAuth()
  const conversation = useConversation()
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const startRequestRef = useRef(0)
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined
  const firstName = displayName?.split(' ')[0] || ''
  const primaryConcernName = analysis.concerns.reduce((highest, concern) => concern.score > highest.score ? concern : highest, { name: 'general skin maintenance', score: -1 }).name
  const firstMorningStep = analysis.morningRoutine[0]
  const firstEveningStep = analysis.eveningRoutine[0]
  const spokenSummary = useMemo(() => {
    const greeting = firstName ? `Hi ${firstName}, your Face Aura is ready.` : 'Your Face Aura is ready.'
    return `${greeting} Your likely skin profile is ${analysis.skinType}. ${analysis.summary} Start simply with ${firstMorningStep?.name.toLowerCase() || 'a gentle morning routine'} in the morning and ${firstEveningStep?.name.toLowerCase() || 'a calm evening routine'} at night. Stay consistent, introduce one active at a time, and check in again in ${analysis.nextCheckInDays} days. This is cosmetic guidance, not a diagnosis. Ask me anything you would like to talk through.`
  }, [analysis.nextCheckInDays, analysis.skinType, analysis.summary, firstEveningStep?.name, firstMorningStep?.name, firstName])
  const resultContext = useMemo(() => `The user's latest Face Aura skin snapshot is: ${analysis.summary}. Likely skin type: ${analysis.skinType}. Priority visible concern: ${primaryConcernName}. Morning routine: ${analysis.morningRoutine.map((step) => `${step.order}. ${step.name} — ${step.instruction}`).join(' ')} Evening routine: ${analysis.eveningRoutine.map((step) => `${step.order}. ${step.name} — ${step.instruction}`).join(' ')} Product categories: ${analysis.products.map((product) => `${product.category}: ${product.name}`).join(', ')}. Their next photo check-in is in ${analysis.nextCheckInDays} days. Keep every answer gender-inclusive, cosmetic, cautious, concise, and never diagnose.`, [analysis, primaryConcernName])
  const sendContextualUpdate = conversation.sendContextualUpdate

  useEffect(() => {
    if (conversation.status === 'connected') {
      sendContextualUpdate(resultContext)
    }
  }, [conversation.status, resultContext, sendContextualUpdate])

  useEffect(() => () => { startRequestRef.current += 1 }, [])

  const toggle = async () => {
    setError('')
    if (conversation.status === 'connected') {
      await conversation.endSession()
      return
    }
    const requestId = startRequestRef.current + 1
    startRequestRef.current = requestId
    setStarting(true)
    try {
      const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      permissionStream.getTracks().forEach((track) => track.stop())
      if (startRequestRef.current !== requestId) return
      const headers: Record<string, string> = {}
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const response = await fetch('/api/elevenlabs/signed-url', { headers })
      if (startRequestRef.current !== requestId) return
      const sessionOptions = intent === 'results' ? { overrides: { agent: { firstMessage: spokenSummary } } } : {}
      if (response.ok) {
        const signedUrl = await response.text()
        await conversation.startSession({ signedUrl, ...sessionOptions })
      } else if (agentId) {
        await conversation.startSession({ agentId, ...sessionOptions })
      } else {
        throw new Error('Add your ElevenLabs agent ID to .env to start voice mode.')
      }
      if (startRequestRef.current !== requestId) await conversation.endSession()
    } catch (caught) {
      if (startRequestRef.current !== requestId) return
      const name = caught instanceof DOMException ? caught.name : ''
      setError(name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it for Face Aura, then try again.' : caught instanceof Error ? caught.message : 'Voice mode could not start.')
    } finally {
      if (startRequestRef.current === requestId) setStarting(false)
    }
  }

  const close = async () => {
    startRequestRef.current += 1
    setStarting(false)
    if (conversation.status === 'connected') await conversation.endSession()
    onClose()
  }

  return <div className="voice-widget open"><button className="voice-fab" onClick={() => void close()} aria-label="Close Face Aura voice companion"><X size={21} /></button><div className={intent === 'results' ? 'voice-panel result-readout-panel' : 'voice-panel'}><span className="eyebrow"><Volume2 size={14} /> Powered by ElevenLabs</span><h3>{intent === 'results' ? 'Hear your result, clearly.' : 'Talk it through with Face Aura.'}</h3><p>{intent === 'results' ? 'Your voice guide will explain the headline, your first steps, and when to check in — then stay for questions.' : 'Ask about your routine, ingredients, or what to do next. Microphone audio goes to ElevenLabs only after you start.'}</p>{intent === 'results' && conversation.status === 'disconnected' && <div className="readout-preview"><span><Check size={14} /> Your likely skin profile</span><span><Check size={14} /> Your priority and first routine steps</span><span><Check size={14} /> Your {analysis.nextCheckInDays}-day check-in plan</span></div>}<div className={`voice-orb ${conversation.status}`}>{conversation.status === 'connected' ? <span className="wave"><i /><i /><i /><i /></span> : intent === 'results' ? <Sparkles size={25} /> : <Mic size={25} />}</div><strong className="voice-status" aria-live="polite">{conversation.status === 'connected' ? (conversation.isSpeaking ? 'Face Aura is speaking…' : 'Ask a follow-up when you’re ready') : conversation.status === 'connecting' ? 'Preparing your readout…' : starting ? 'Waiting for microphone permission…' : 'Ready when you are'}</strong>{error && <small className="voice-error">{error}</small>}<button className={conversation.status === 'connected' ? 'end-voice' : 'primary-button full-width'} onClick={() => void toggle()} disabled={starting}>{conversation.status === 'connected' ? <><MicOff size={17} /> End conversation</> : starting ? <><Mic size={17} /> Allow microphone to continue</> : intent === 'results' ? <><Volume2 size={17} /> Play my result & talk</> : <><Mic size={17} /> Start voice chat</>}</button><small className="voice-disclaimer">Starting enables your microphone so you can ask follow-up questions. Face Aura cannot diagnose or replace clinical care.</small></div></div>
}
