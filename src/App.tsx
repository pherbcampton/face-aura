import { ChangeEvent, FormEvent, lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Droplets,
  HeartPulse,
  Headphones,
  Leaf,
  LineChart,
  LoaderCircle,
  LogIn,
  LogOut,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircleMore,
  Moon,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import type { ProgressEntry, SkinAnalysis } from './types'
import { useAuth } from './AuthContext'
import { loadLatestAnalysis, loadProgress, saveAnalysis as saveCloudAnalysis, saveBooking, saveProgress } from './data'

type Page = 'home' | 'scan' | 'results' | 'routine' | 'progress' | 'experts'
type VoiceIntent = 'conversation' | 'results'

type ReminderPreferences = {
  morningEnabled: boolean
  morningTime: string
  eveningEnabled: boolean
  eveningTime: string
  checkInDate: string
  notificationsEnabled: boolean
}

const ANALYSIS_STORAGE_KEY = 'face-aura:v1:analysis'
const PROGRESS_STORAGE_KEY = 'face-aura:v1:progress'
const REMINDER_STORAGE_KEY = 'face-aura:v1:reminders'
const REMINDER_SENT_KEY = 'face-aura:v1:reminder-sent'
const LazyVoiceCompanion = lazy(() => import('./VoiceCompanion'))

const navItems: { page: Page; label: string }[] = [
  { page: 'home', label: 'Today' },
  { page: 'routine', label: 'Routine' },
  { page: 'progress', label: 'Progress' },
  { page: 'experts', label: 'Experts' },
]

const demoAnalysis: SkinAnalysis = {
  summary: 'Your skin appears balanced overall, with a little dehydration around the cheeks and some visible congestion through the T-zone.',
  skinType: 'Combination · dehydration-prone',
  skinTypeNote: 'Oil is more visible through the forehead and nose, while the cheeks look like they would benefit from barrier support.',
  confidence: 84,
  concerns: [
    { name: 'Hydration', level: 'moderate', score: 68, observation: 'Fine surface texture suggests your skin may be short on water.' },
    { name: 'Congestion', level: 'moderate', score: 42, observation: 'A few visible pores and small blemishes appear around the T-zone.' },
    { name: 'Uneven tone', level: 'low', score: 24, observation: 'A small amount of post-blemish discolouration is visible.' },
  ],
  morningRoutine: [
    { order: 1, name: 'Gentle cleanse', instruction: 'Use lukewarm water and a low-foam cleanser.', ingredient: 'Glycerin' },
    { order: 2, name: 'Hydrate', instruction: 'Press 2–3 drops into slightly damp skin.', ingredient: 'Hyaluronic acid' },
    { order: 3, name: 'Protect', instruction: 'Apply two finger-lengths to face and neck.', ingredient: 'Broad-spectrum SPF 50' },
  ],
  eveningRoutine: [
    { order: 1, name: 'Cleanse', instruction: 'Remove SPF and makeup without scrubbing.', ingredient: 'Squalane cleanser' },
    { order: 2, name: 'Treat', instruction: 'Use on the T-zone 2 nights a week to begin.', ingredient: '2% salicylic acid' },
    { order: 3, name: 'Repair', instruction: 'Seal in hydration with a barrier-supporting cream.', ingredient: 'Ceramides' },
  ],
  products: [
    { category: 'Cleanser', name: 'Low-foam gel cleanser', reason: 'Cleans without stripping drier areas.', priceBand: '£' },
    { category: 'Treatment', name: '2% BHA liquid', reason: 'A targeted option for occasional T-zone congestion.', priceBand: '££' },
    { category: 'Moisturiser', name: 'Ceramide cloud cream', reason: 'Supports the skin barrier without a heavy finish.', priceBand: '££' },
  ],
  nextCheckInDays: 14,
  safetyNote: 'Cosmetic wellness guidance only. A photo cannot diagnose a skin condition; speak with a qualified clinician about pain, rapid changes, persistent irritation, or anything that concerns you.',
  inference: 'demo',
  createdAt: new Date().toISOString(),
}

const salons = [
  { id: 1, name: 'Kindred Skin Studio', treatment: 'Barrier Reset Facial', rating: 4.9, reviews: 128, distance: '0.6 mi', time: 'Example time · 4:30 PM', price: 72, tone: 'sage' },
  { id: 2, name: 'Studio Élan', treatment: 'Clarity & Calm Facial', rating: 4.8, reviews: 94, distance: '1.2 mi', time: 'Example time · 11:00 AM', price: 85, tone: 'peach' },
  { id: 3, name: 'The Skin Library', treatment: 'LED Hydration Session', rating: 4.9, reviews: 211, distance: '1.8 mi', time: 'Example time · 2:15 PM', price: 64, tone: 'lavender' },
]

const seedProgress: ProgressEntry[] = [
  { id: '1', date: '02 Oct', blemishes: 58, darkSpots: 51, hydration: 48 },
  { id: '2', date: '09 Oct', blemishes: 52, darkSpots: 48, hydration: 55 },
  { id: '3', date: '16 Oct', blemishes: 44, darkSpots: 45, hydration: 61 },
  { id: '4', date: 'Today', blemishes: 38, darkSpots: 41, hydration: 68 },
]

function readGuestAnalysis() {
  const saved = localStorage.getItem(ANALYSIS_STORAGE_KEY) || localStorage.getItem('face-aura-analysis') || localStorage.getItem('aura-analysis')
  try { return saved ? JSON.parse(saved) as SkinAnalysis : null } catch { return null }
}

function readGuestProgress() {
  const saved = localStorage.getItem(PROGRESS_STORAGE_KEY) || localStorage.getItem('face-aura-progress') || localStorage.getItem('aura-progress')
  try { return saved ? JSON.parse(saved) as ProgressEntry[] : seedProgress } catch { return seedProgress }
}

function formatDateInput(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function defaultReminders(nextCheckInDays = 14): ReminderPreferences {
  const checkIn = new Date()
  checkIn.setDate(checkIn.getDate() + nextCheckInDays)
  return { morningEnabled: true, morningTime: '08:00', eveningEnabled: true, eveningTime: '21:00', checkInDate: formatDateInput(checkIn), notificationsEnabled: false }
}

function readReminders(nextCheckInDays = 14): ReminderPreferences {
  try {
    const saved = localStorage.getItem(REMINDER_STORAGE_KEY)
    return saved ? { ...defaultReminders(nextCheckInDays), ...JSON.parse(saved) as ReminderPreferences } : defaultReminders(nextCheckInDays)
  } catch {
    return defaultReminders(nextCheckInDays)
  }
}

async function prepareAnalysisImage(blob: Blob) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const attempts = [
    { maxSide: 1600, quality: 0.86 },
    { maxSide: 1400, quality: 0.8 },
    { maxSide: 1200, quality: 0.74 },
    { maxSide: 1000, quality: 0.7 },
  ]
  let result = ''
  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the photo. Please try another image.')
    context.fillStyle = '#f8f5ef'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    result = canvas.toDataURL('image/jpeg', attempt.quality)
    if (result.length <= 3_500_000) break
  }
  bitmap.close()
  return result
}

function App() {
  const { user } = useAuth()
  const [page, setPage] = useState<Page>('home')
  const [analysis, setAnalysis] = useState<SkinAnalysis>(() => readGuestAnalysis() ?? demoAnalysis)
  const [hasPersonalScan, setHasPersonalScan] = useState(() => Boolean(readGuestAnalysis()))
  const [syncMessage, setSyncMessage] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceIntent, setVoiceIntent] = useState<VoiceIntent>('conversation')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  useEffect(() => {
    if (!user) {
      const guestAnalysis = readGuestAnalysis()
      setAnalysis(guestAnalysis ?? demoAnalysis)
      setHasPersonalScan(Boolean(guestAnalysis))
      setSyncMessage('')
      return
    }
    let active = true
    loadLatestAnalysis(user.id)
      .then((cloudAnalysis) => {
        if (!active) return
        setAnalysis(cloudAnalysis ?? demoAnalysis)
        setHasPersonalScan(Boolean(cloudAnalysis))
      })
      .catch(() => active && setSyncMessage('Your local result is available, but cloud sync is temporarily unavailable.'))
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    const checkReminders = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const reminders = readReminders()
      if (!reminders.notificationsEnabled) return
      const now = new Date()
      const today = formatDateInput(now)
      const time = now.toTimeString().slice(0, 5)
      let sent: Record<string, string> = {}
      try { sent = JSON.parse(localStorage.getItem(REMINDER_SENT_KEY) || '{}') as Record<string, string> } catch { sent = {} }
      const notify = (key: string, title: string, body: string) => {
        if (sent[key] === today) return
        try {
          new Notification(title, { body, icon: '/face-aura-mark.svg' })
          sent[key] = today
          localStorage.setItem(REMINDER_SENT_KEY, JSON.stringify(sent))
        } catch { /* The saved in-app plan still remains available. */ }
      }
      if (reminders.morningEnabled && reminders.morningTime === time) notify('morning', 'Your morning Face Aura ritual', 'Cleanse gently, hydrate, and finish with SPF.')
      if (reminders.eveningEnabled && reminders.eveningTime === time) notify('evening', 'Time to reset and repair', 'A few calm minutes for your evening skincare routine.')
      if (reminders.checkInDate === today && time >= '09:00') notify('checkin', 'Your skin check-in is due', 'Take a photo in similar light to compare your progress.')
    }
    checkReminders()
    const timer = window.setInterval(checkReminders, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const saveAnalysis = (next: SkinAnalysis, goals: string[]) => {
    setAnalysis(next)
    setHasPersonalScan(true)
    setPage('results')
    setVoiceOpen(false)
    if (user) {
      setSyncMessage('Saving your result securely…')
      void saveCloudAnalysis(user.id, next, goals)
        .then(() => setSyncMessage('Saved to your private Face Aura account.'))
        .catch(() => setSyncMessage('Saved on this device; cloud sync will need another try.'))
    } else {
      localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(next))
      setSyncMessage('Saved on this device. Sign in to sync it privately across devices.')
    }
  }

  return (
    <div className="app-shell">
      <Header page={page} setPage={setPage} mobileNav={mobileNav} setMobileNav={setMobileNav} />
      <main>
        {page === 'home' && <Home setPage={setPage} analysis={analysis} hasPersonalScan={hasPersonalScan} />}
        {page === 'scan' && <Scan onComplete={saveAnalysis} onBack={() => setPage('home')} />}
        {page === 'results' && <Results analysis={analysis} setPage={setPage} syncMessage={syncMessage} onOpenVoice={() => { setVoiceIntent('results'); setVoiceOpen(true) }} />}
        {page === 'routine' && <Routine analysis={analysis} />}
        {page === 'progress' && <Progress />}
        {page === 'experts' && <Experts />}
      </main>
      <VoiceLauncher analysis={analysis} open={voiceOpen} intent={voiceIntent} onOpen={() => { setVoiceIntent('conversation'); setVoiceOpen(true) }} onClose={() => setVoiceOpen(false)} />
      <Footer />
    </div>
  )
}

function FaceAuraLogo({ large = false }: { large?: boolean }) {
  return <span className={large ? 'brand-symbol large' : 'brand-symbol'} aria-hidden="true"><svg viewBox="0 0 48 48" role="img"><path className="aura-ring" d="M9.8 31.1C6.9 22.4 11.2 13 19.7 9.6c7.3-2.9 15.6-.1 19.5 6.7" /><path className="face-line" d="M28.8 12.2c-5.5 1.4-9.4 6.3-9.4 12.1 0 5.4 3.2 10.1 7.9 12.3m4.3-23.8c4.1 2.3 6.5 6.7 6.2 11.3-.3 4.5-2.5 8.3-5.9 10.4M29 16.8c-2.3 1.5-3.6 4.1-3.5 6.8l3.2 2.5-2.6 2.1c1.1 2.2 3.3 3.6 5.8 3.7" /><path className="aura-spark" d="M12.8 12.5c.3 1.8 1.2 2.7 2.9 3.1-1.7.4-2.6 1.4-2.9 3.1-.3-1.7-1.2-2.7-2.9-3.1 1.7-.4 2.6-1.3 2.9-3.1Z" /><circle className="aura-dot" cx="10.6" cy="34.4" r="1.35" /></svg></span>
}

function Header({ page, setPage, mobileNav, setMobileNav }: { page: Page; setPage: (page: Page) => void; mobileNav: boolean; setMobileNav: (v: boolean) => void }) {
  const { user, loading, configured, displayName, avatarUrl, signInWithGoogle, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  const beginGoogleSignIn = async () => {
    setAuthError('')
    try { await signInWithGoogle() } catch (error) { setAuthError(error instanceof Error ? error.message : 'Google sign-in could not start.') }
  }

  return (
    <>
    <header className="site-header">
      <button className="brand" onClick={() => setPage('home')} aria-label="Face Aura home">
        <FaceAuraLogo />
        <span className="brand-wordmark"><span>Face</span><em>Aura</em></span>
      </button>
      <nav className={mobileNav ? 'main-nav open' : 'main-nav'} aria-label="Primary navigation">
        {navItems.map((item) => (
          <button key={item.page} className={page === item.page ? 'nav-link active' : 'nav-link'} onClick={() => { setPage(item.page); setMobileNav(false) }}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <span className="model-chip"><span className="status-dot" /> Gemma 4 local</span>
        {loading ? <LoaderCircle className="spin auth-loader" size={19} /> : user ? <div className="profile-menu-wrap">
          <button className="avatar-button" onClick={() => setProfileOpen(!profileOpen)} aria-label="Open profile">{avatarUrl ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials}</button>
          {profileOpen && <div className="profile-menu">
            <strong>{displayName}</strong>
            <small>{user.email}</small>
            <span><ShieldCheck size={14} /> Private cloud sync on</span>
            <button onClick={() => { void signOut(); setProfileOpen(false) }}><LogOut size={16} /> Sign out</button>
          </div>}
        </div> : <button className="sign-in-button" onClick={() => setAuthOpen(true)}><LogIn size={16} /> Sign in</button>}
        <button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle menu"><Menu size={20} /></button>
      </div>
    </header>
    {authOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}><div className="modal-card auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close sign in"><X size={18} /></button>
      <span className="auth-brand"><FaceAuraLogo large /></span>
      <span className="eyebrow">Your personal skin space</span>
      <h2 id="auth-dialog-title">Continue with Google</h2>
      <p>Sync your skin snapshots, progress and appointment requests privately across your devices.</p>
      <div className="auth-benefits"><span><LockKeyhole size={16} /> Your account only</span><span><LineChart size={16} /> Personal progress history</span><span><CalendarDays size={16} /> Saved booking requests</span></div>
      {configured ? <button className="google-button" onClick={beginGoogleSignIn}><span className="google-mark">G</span> Continue with Google</button> : <div className="setup-note"><CircleAlert size={17} /><div><strong>Google sign-in needs its live backend.</strong><p>Add the Supabase URL and publishable key to <code>.env</code>, then enable Google in Supabase Auth.</p></div></div>}
      {authError && <div className="error-message"><CircleAlert size={17} /> {authError}</div>}
      <small className="auth-footnote">By continuing, you agree to use Face Aura for cosmetic wellness guidance only.</small>
    </div></div>}
    </>
  )
}

function Home({ setPage, analysis, hasPersonalScan }: { setPage: (page: Page) => void; analysis: SkinAnalysis; hasPersonalScan: boolean }) {
  const { user, displayName } = useAuth()
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><Leaf size={14} /> {user ? `${displayName.split(' ')[0]}’s personal skin space` : 'Open-weight intelligence, made personal'}</span>
          <h1>Know your skin.<br /><em>Care for it better.</em></h1>
          <p>A private skincare companion that turns one clear photo into a gentle, practical routine — and stays with you as your skin changes.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setPage('scan')}>Start my skin check <ArrowRight size={18} /></button>
            <button className="text-button" onClick={() => setPage('results')}>{hasPersonalScan ? 'View my latest result' : 'Explore a sample result'} <ChevronRight size={17} /></button>
          </div>
          <div className="trust-row">
            <span><LockKeyhole size={15} /> Photos stay private</span>
            <span><ShieldCheck size={15} /> No diagnosis claims</span>
            <span><Sparkles size={15} /> Gemma 4 vision</span>
          </div>
        </div>
        <div className="hero-visual">
          <img src="/aura-hero.png" alt="Two adults of different genders with natural skin texture in soft light" />
          <div className="scan-orbit orbit-one" />
          <div className="scan-orbit orbit-two" />
          <div className="floating-card skin-card">
            <span className="mini-label">Skin profile</span>
            <strong>{analysis.skinType.split('·')[0]}</strong>
            <div className="meter"><span style={{ width: `${analysis.confidence}%` }} /></div>
            <small>{analysis.confidence}% visual confidence</small>
          </div>
          <div className="floating-card privacy-card"><LockKeyhole size={17} /><span><strong>Private by design</strong><small>Secure Gemma inference</small></span></div>
        </div>
      </section>

      <section className="how-it-works section-wrap">
        <div className="section-heading split-heading">
          <div><span className="eyebrow">A calmer way to understand your skin</span><h2>From photo to plan in three thoughtful steps.</h2></div>
          <p>No mystery scores. Face Aura explains what it observes, how certain it is, and what small steps may help.</p>
        </div>
        <div className="step-grid">
          {[
            [Camera, '01', 'Take a clear photo', 'Simple lighting guidance helps you capture a useful, makeup-free image.'],
            [Sparkles, '02', 'Gemma reads the details', 'An open-weight multimodal model looks for cosmetic patterns such as dryness, visible pores, and uneven tone.'],
            [HeartPulse, '03', 'Build your ritual', 'Get a focused AM/PM routine, ingredient guidance, progress check-ins, and optional expert support.'],
          ].map(([Icon, no, title, copy]) => {
            const StepIcon = Icon as typeof Camera
            return <article className="step-card" key={String(no)}><span className="step-number">{String(no)}</span><span className="step-icon"><StepIcon size={23} /></span><h3>{String(title)}</h3><p>{String(copy)}</p></article>
          })}
        </div>
      </section>

      <section className="daily-card section-wrap">
        <div className="daily-intro"><span className="eyebrow">Your daily rhythm</span><h2>Small rituals.<br />Visible consistency.</h2><p>Check off your routine, notice patterns, and adjust only when your skin has had time to respond.</p><button className="secondary-button" onClick={() => setPage('routine')}>Open today’s routine <ArrowRight size={17} /></button></div>
        <div className="routine-preview">
          <div className="routine-preview-head"><span><Sun size={20} /> Morning · 4 min</span><span className="complete-pill">2 of 3 complete</span></div>
          {analysis.morningRoutine.map((step, index) => <div className="preview-step" key={step.name}><span className={index < 2 ? 'check checked' : 'check'}>{index < 2 && <Check size={15} />}</span><div><strong>{step.name}</strong><small>{step.ingredient}</small></div><span className="step-time">{index === 2 ? '1 min' : '30 sec'}</span></div>)}
        </div>
      </section>

      <section className="open-source-strip">
          <div><span className="opensource-mark">&lt;/&gt;</span><div><strong>Built in the open, because your skin data deserves transparency.</strong><p>Gemma 4 can run locally or through Ollama Cloud. You can inspect, swap, and improve every part of the intelligence layer.</p></div></div>
        <a href="https://ai.google.dev/gemma/docs/core" target="_blank" rel="noreferrer">Why open AI matters <ArrowRight size={16} /></a>
      </section>
    </>
  )
}

function Scan({ onComplete, onBack }: { onComplete: (analysis: SkinAnalysis, goals: string[]) => void; onBack: () => void }) {
  const { session, user } = useAuth()
  const [image, setImage] = useState<string>('')
  const [cameraState, setCameraState] = useState<'closed' | 'requesting' | 'live'>('closed')
  const [goals, setGoals] = useState<string[]>(['Hydration'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraRequestRef = useRef(0)

  const stopCamera = () => {
    cameraRequestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('closed')
  }

  useEffect(() => () => {
    cameraRequestRef.current += 1
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    if (cameraState !== 'live' || !videoRef.current || !streamRef.current) return
    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play().catch(() => setError('The camera opened, but the preview could not start. Please try again.'))
  }, [cameraState])

  const startCamera = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Live camera is not supported here. Use a modern browser over HTTPS, or choose a photo instead.')
      return
    }
    const requestId = cameraRequestRef.current + 1
    cameraRequestRef.current = requestId
    setCameraState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = stream
      setImage('')
      setCameraState('live')
    } catch (caught) {
      if (cameraRequestRef.current !== requestId) return
      setCameraState('closed')
      const name = caught instanceof DOMException ? caught.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') setError('Camera access was blocked. Allow camera access for Face Aura in your browser, then try again—or choose a photo.')
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') setError('No camera was found on this device. You can still choose a photo.')
      else if (name === 'NotReadableError' || name === 'TrackStartError') setError('Your camera may be in use by another app. Close it there and try again.')
      else setError('The camera could not start. Please try again or choose a photo.')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) {
      setError('The camera is still warming up. Hold steady and try once more.')
      return
    }
    const targetRatio = 4 / 5
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight
    let sourceX = 0
    let sourceY = 0
    if (sourceWidth / sourceHeight > targetRatio) {
      sourceWidth = sourceHeight * targetRatio
      sourceX = (video.videoWidth - sourceWidth) / 2
    } else {
      sourceHeight = sourceWidth / targetRatio
      sourceY = (video.videoHeight - sourceHeight) / 2
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.min(1200, Math.round(sourceWidth))
    canvas.height = Math.round(canvas.width / targetRatio)
    const context = canvas.getContext('2d')
    if (!context) {
      setError('The photo could not be captured. Please try again.')
      return
    }
    context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    setImage(canvas.toDataURL('image/jpeg', 0.9))
    setError('')
    stopCamera()
  }

  const openFilePicker = () => {
    stopCamera()
    inputRef.current?.click()
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Please choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Please choose an image smaller than 10 MB.'); return }
    event.target.value = ''
    try {
      setImage(await prepareAnalysisImage(file))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The photo could not be prepared. Please try again.')
    }
  }

  const useDemo = async () => {
    stopCamera()
    const blob = await fetch('/aura-hero.png').then((res) => res.blob())
    setImage(await prepareAnalysisImage(blob))
  }

  const analyze = async () => {
    if (!image) { setError('Add a clear photo before starting your skin check.'); return }
    setLoading(true); setError('')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
      const response = await fetch('/api/analyze', { method: 'POST', headers, body: JSON.stringify({ imageDataUrl: image, goals }) })
      const body = await response.json() as SkinAnalysis & { error?: string }
      if (!response.ok) throw new Error(body.error || 'The analysis could not be completed.')
      onComplete(body, goals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <section className="scan-page page-wrap">
      <button className="back-button" onClick={onBack}><ChevronLeft size={18} /> Back</button>
      <div className="scan-heading"><span className="eyebrow">Private skin check</span><h1>Let’s take a closer look.</h1><p>Use a recent photo in soft daylight. Your image is sent only to your configured Gemma endpoint and is never written to Face Aura’s server.</p></div>
      <div className="scan-layout">
        <div className={cameraState === 'live' ? 'photo-uploader camera-active' : 'photo-uploader'}>
          {cameraState === 'requesting' ? <div className="camera-requesting" aria-live="polite"><LoaderCircle className="spin" size={30} /><h2>Opening your camera…</h2><p>Your browser may ask for permission. Face Aura only uses the preview while this screen is open.</p><button className="secondary-button" onClick={stopCamera}>Cancel</button></div>
            : cameraState === 'live' ? <><video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label="Live front camera preview" /><div className="face-guide"><span /><span /><span /><span /></div><div className="camera-topbar"><span className="camera-live-pill"><i /> Camera live</span><button className="camera-close" onClick={stopCamera} aria-label="Close camera"><X size={18} /></button></div><p className="camera-hint">Centre your face inside the guide and use soft, even light.</p><div className="camera-controls"><button className="capture-button" onClick={capturePhoto} aria-label="Take photo"><Camera size={27} /></button></div></>
              : image ? <><img className="preview-image" src={image} alt="Selected face preview" /><div className="face-guide"><span /><span /><span /><span /></div><div className="photo-controls"><button onClick={() => void startCamera()}><Camera size={16} /> Retake</button><button onClick={openFilePicker}><Upload size={16} /> Choose another</button></div></>
                : <div className="upload-empty"><span className="upload-icon"><Camera size={32} /></span><h2>Add a clear face photo</h2><p>Face the camera straight on, remove glasses, and avoid harsh shadows.</p><div className="upload-actions"><button className="primary-button" onClick={() => void startCamera()}><Camera size={17} /> Open camera</button><button className="secondary-button" onClick={openFilePicker}><Upload size={17} /> Choose photo</button><button className="text-button demo-photo-button" onClick={useDemo}>Use demo portrait</button></div><small className="camera-privacy">The live preview stays in your browser. Nothing is sent until you choose Analyze my skin.</small></div>}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} hidden />
        </div>
        <aside className="scan-sidebar">
          <div className="tip-card"><h3>For the clearest read</h3>{['Stand near a window', 'Keep your full face in frame', 'Use a makeup-free photo', 'Relax your expression'].map((tip) => <span key={tip}><Check size={15} /> {tip}</span>)}</div>
          <div className="goals-card"><h3>What would you like to focus on?</h3><div className="goal-chips">{['Hydration', 'Acne & blemishes', 'Dark spots', 'Texture', 'Sensitivity'].map((goal) => <button key={goal} className={goals.includes(goal) ? 'goal-chip active' : 'goal-chip'} onClick={() => setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal])}>{goal}</button>)}</div></div>
          <div className="privacy-note"><LockKeyhole size={19} /><div><strong>Your face is not our dataset.</strong><p>Images are processed for this request only. {user ? 'Only the text result is saved to your private account.' : 'The result stays on this device unless you sign in.'}</p></div></div>
          {error && <div className="error-message"><CircleAlert size={17} /> {error}</div>}
          <button className="primary-button analyze-button" onClick={analyze} disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Gemma is looking carefully…</> : <>Analyze my skin <Sparkles size={17} /></>}</button>
          <small className="medical-microcopy">Face Aura offers cosmetic wellness guidance, not medical diagnosis.</small>
        </aside>
      </div>
    </section>
  )
}

function Results({ analysis, setPage, syncMessage, onOpenVoice }: { analysis: SkinAnalysis; setPage: (page: Page) => void; syncMessage: string; onOpenVoice: () => void }) {
  const [showReminders, setShowReminders] = useState(false)
  const nextCheckIn = new Date(analysis.createdAt)
  nextCheckIn.setDate(nextCheckIn.getDate() + analysis.nextCheckInDays)
  const primaryConcernName = analysis.concerns.reduce((highest, concern) => concern.score > highest.score ? concern : highest, { name: 'your skin', score: -1 }).name
  return (
    <section className="results-page page-wrap">
      <div className="result-ready-banner">
        <span className="result-ready-icon"><Sparkles size={25} /></span>
        <div><span className="eyebrow">Analysis complete</span><h2>Your personal Face Aura is ready.</h2><p>Hear the headline first, then explore the detail at your own pace.</p></div>
        <button className="result-listen-button" onClick={onOpenVoice}><Headphones size={19} /><span><strong>Hear my result</strong><small>ElevenLabs voice + follow-up chat</small></span><ArrowRight size={18} /></button>
      </div>
      <div className="results-topline"><div><span className="eyebrow">Your skin snapshot</span><h1>Here’s what Face Aura noticed.</h1><p>{new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Visual wellness analysis</p>{syncMessage && <span className="sync-message"><ShieldCheck size={14} /> {syncMessage}</span>}</div><span className={analysis.inference === 'gemma4' ? 'inference-badge live' : 'inference-badge'}><span className="status-dot" /> {analysis.inference === 'gemma4' ? 'Analyzed by Gemma 4' : 'Illustrative demo result'}</span></div>
      <div className="summary-grid">
        <article className="skin-profile-card"><div className="profile-ring"><span>{analysis.confidence}%</span><small>confidence</small></div><div><span className="mini-label">Likely skin profile</span><h2>{analysis.skinType}</h2><p>{analysis.skinTypeNote}</p></div></article>
        <article className="summary-card"><MessageCircleMore size={22} /><div><span className="mini-label">In plain English</span><p>{analysis.summary}</p></div></article>
      </div>
      <div className="section-heading compact"><span className="eyebrow">Priority areas</span><h2>A focused view, without the overwhelm.</h2></div>
      <div className="concern-grid">{analysis.concerns.map((concern) => <article className="concern-card" key={concern.name}><div className="concern-head"><span>{concern.name}</span><span className={`level ${concern.level}`}>{concern.level}</span></div><div className="score-row"><strong>{concern.score}</strong><span>/ 100 visible signal</span></div><div className="meter"><span style={{ width: `${concern.score}%` }} /></div><p>{concern.observation}</p></article>)}</div>
      <div className="recommendation-callout"><span className="callout-icon"><Droplets size={24} /></span><div><span className="eyebrow">Face Aura’s starting point</span><h2>Keep the first {analysis.nextCheckInDays} days simple.</h2><p>Start with your short routine, give {primaryConcernName.toLowerCase()} time to settle, and introduce only one active at a time so you can see what helps.</p></div><button className="primary-button" onClick={() => setPage('routine')}>See my routine <ArrowRight size={17} /></button></div>
      <div className="section-heading compact journey-heading"><span className="eyebrow">What happens next</span><h2>Your plan, from today to your next check-in.</h2></div>
      <div className="next-step-grid">
        <article className="next-step-card featured"><span className="step-kicker">01 · Listen</span><Headphones size={25} /><h3>Hear the useful part.</h3><p>Face Aura reads a concise summary, your first routine steps, and when to check in again. Then ask anything.</p><button onClick={onOpenVoice}>Start my voice readout <ArrowRight size={16} /></button></article>
        <article className="next-step-card"><span className="step-kicker">02 · Begin</span><Sun size={25} /><h3>Follow your routine.</h3><p>Use the morning and evening steps in order. Tap each one as you complete it.</p><button onClick={() => setPage('routine')}>Open my routine <ArrowRight size={16} /></button></article>
        <article className="next-step-card"><span className="step-kicker">03 · Remember</span><BellRing size={25} /><h3>Set a gentle rhythm.</h3><p>Choose your preferred AM and PM times, plus your next photo check-in date.</p><button onClick={() => setShowReminders(true)}>Set my reminders <ArrowRight size={16} /></button></article>
        <article className="next-step-card"><span className="step-kicker">04 · Review</span><CalendarCheck size={25} /><h3>Check in on {nextCheckIn.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.</h3><p>Use similar lighting so your progress view compares like with like.</p><button onClick={() => setPage('progress')}>View progress plan <ArrowRight size={16} /></button></article>
      </div>
      <div className="expert-next-callout"><div><span className="eyebrow">Optional expert support</span><h2>Want a professional facial?</h2><p>Browse a preview directory and save a preferred time. No salon is contacted and no appointment is confirmed until a live booking partner is connected.</p></div><button className="secondary-button" onClick={() => setPage('experts')}>Explore expert options <ArrowRight size={17} /></button></div>
      <div className="safety-banner"><ShieldCheck size={21} /><p><strong>A useful observation, not a diagnosis.</strong> {analysis.safetyNote}</p></div>
      {showReminders && <ReminderPlanner analysis={analysis} onClose={() => setShowReminders(false)} />}
    </section>
  )
}

function ReminderPlanner({ analysis, onClose }: { analysis: SkinAnalysis; onClose: () => void }) {
  const [preferences, setPreferences] = useState<ReminderPreferences>(() => readReminders(analysis.nextCheckInDays))
  const [message, setMessage] = useState('')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    let notificationsEnabled = false
    if (preferences.notificationsEnabled && 'Notification' in window) {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      notificationsEnabled = permission === 'granted'
    }
    const next = { ...preferences, notificationsEnabled }
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(next))
    setPreferences(next)
    setMessage(notificationsEnabled ? 'Your plan is saved. Browser reminders are on while Face Aura is open.' : 'Your plan is saved. Browser notifications are off, so use these times as your in-app guide.')
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="modal-card reminder-modal" role="dialog" aria-modal="true" aria-labelledby="reminder-dialog-title" onSubmit={save} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close reminder setup" onClick={onClose}><X size={18} /></button><span className="eyebrow"><BellRing size={14} /> Your rhythm</span><h2 id="reminder-dialog-title">When should Face Aura nudge you?</h2><p className="reminder-intro">Save a realistic routine rather than a perfect one. You can change these times whenever life changes.</p><div className="reminder-fields"><label className="reminder-row"><span><input type="checkbox" checked={preferences.morningEnabled} onChange={(event) => setPreferences((current) => ({ ...current, morningEnabled: event.target.checked }))} /><strong>Morning routine</strong><small>Cleanse, hydrate, protect</small></span><input aria-label="Morning reminder time" type="time" value={preferences.morningTime} disabled={!preferences.morningEnabled} onChange={(event) => setPreferences((current) => ({ ...current, morningTime: event.target.value }))} /></label><label className="reminder-row"><span><input type="checkbox" checked={preferences.eveningEnabled} onChange={(event) => setPreferences((current) => ({ ...current, eveningEnabled: event.target.checked }))} /><strong>Evening routine</strong><small>Cleanse, treat, repair</small></span><input aria-label="Evening reminder time" type="time" value={preferences.eveningTime} disabled={!preferences.eveningEnabled} onChange={(event) => setPreferences((current) => ({ ...current, eveningTime: event.target.value }))} /></label><label className="reminder-row checkin-row"><span><CalendarCheck size={18} /><strong>Next photo check-in</strong><small>Compare under similar lighting</small></span><input aria-label="Next photo check-in date" type="date" min={formatDateInput(new Date())} value={preferences.checkInDate} onChange={(event) => setPreferences((current) => ({ ...current, checkInDate: event.target.value }))} /></label></div><label className="notification-choice"><input type="checkbox" checked={preferences.notificationsEnabled} onChange={(event) => setPreferences((current) => ({ ...current, notificationsEnabled: event.target.checked }))} /><span><strong>Notify me in this browser</strong><small>Works while Face Aura is open. Background push and email reminders are not connected yet.</small></span></label>{message && <div className="reminder-saved" role="status"><Check size={17} /> {message}</div>}<button className="primary-button full-width" type="submit">Save my reminder plan <Check size={17} /></button></form></div>
}

function Routine({ analysis }: { analysis: SkinAnalysis }) {
  const [mode, setMode] = useState<'morning' | 'evening'>('morning')
  const [checked, setChecked] = useState<number[]>([])
  const steps = mode === 'morning' ? analysis.morningRoutine : analysis.eveningRoutine
  return (
    <section className="routine-page page-wrap">
      <div className="page-heading-row"><div><span className="eyebrow">Your skin ritual</span><h1>Consistency, not complexity.</h1><p>A concise routine built around your latest skin snapshot.</p></div><div className="streak-card"><Sparkles size={21} /><div><strong>6 day streak</strong><span>You’re building a rhythm</span></div></div></div>
      <div className="routine-tabs"><button className={mode === 'morning' ? 'active' : ''} onClick={() => { setMode('morning'); setChecked([]) }}><Sun size={18} /> Morning</button><button className={mode === 'evening' ? 'active' : ''} onClick={() => { setMode('evening'); setChecked([]) }}><Moon size={18} /> Evening</button></div>
      <div className="routine-layout">
        <div className="routine-list"><div className="routine-list-head"><div><span>{mode === 'morning' ? 'Start bright' : 'Reset & repair'}</span><h2>{mode === 'morning' ? 'Protect your barrier for the day.' : 'Give your skin a calm landing.'}</h2></div><span className="time-pill"><Clock3 size={15} /> About 4 min</span></div>{steps.map((step, index) => { const done = checked.includes(index); return <button className={done ? 'routine-step done' : 'routine-step'} key={step.name} onClick={() => setChecked((prev) => done ? prev.filter((n) => n !== index) : [...prev, index])}><span className="step-order">{done ? <Check size={18} /> : step.order}</span><div><span className="mini-label">{step.ingredient}</span><h3>{step.name}</h3><p>{step.instruction}</p></div><ChevronRight size={18} /></button>})}<div className="routine-progress"><span><strong>{checked.length}</strong> of {steps.length} complete</span><div className="meter"><span style={{ width: `${(checked.length / steps.length) * 100}%` }} /></div></div></div>
        <aside className="product-panel"><span className="eyebrow">Ingredient-led picks</span><h2>What to look for</h2><p>Suggestions are category-based so you can choose a brand that fits your budget and values.</p>{analysis.products.map((product) => <article className="product-row" key={product.name}><span className="product-icon"><Droplets size={18} /></span><div><span>{product.category} · {product.priceBand}</span><strong>{product.name}</strong><p>{product.reason}</p></div></article>)}<div className="affiliate-note"><CircleAlert size={16} /> No sponsored ranking or affiliate links.</div></aside>
      </div>
    </section>
  )
}

function Progress() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<ProgressEntry[]>(readGuestProgress)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [form, setForm] = useState({ blemishes: 38, darkSpots: 41, hydration: 68 })
  const [saving, setSaving] = useState(false)
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    if (!user) {
      setEntries(readGuestProgress())
      setSyncError('')
      return
    }
    let active = true
    loadProgress(user.id)
      .then((cloudEntries) => { if (active) setEntries(cloudEntries) })
      .catch(() => active && setSyncError('Cloud history is unavailable; showing the copy on this device.'))
    return () => { active = false }
  }, [user?.id])

  const addEntry = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSyncError('')
    try {
      const entry = user
        ? await saveProgress(user.id, form)
        : { id: crypto.randomUUID(), date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), ...form }
      const next = [...entries, entry]
      setEntries(next)
      if (!user) localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next))
      setShowCheckIn(false)
    } catch {
      setSyncError('That check-in could not be saved. Please try again.')
    } finally { setSaving(false) }
  }
  const firstEntry = entries[0]
  const latestEntry = entries.at(-1)
  const percentChange = (current: number, initial: number) => Math.round(((current - initial) / Math.max(initial, 1)) * 100)
  const formatChange = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`
  const blemishChange = firstEntry && latestEntry ? percentChange(latestEntry.blemishes, firstEntry.blemishes) : 0
  const darkSpotChange = firstEntry && latestEntry ? percentChange(latestEntry.darkSpots, firstEntry.darkSpots) : 0
  const hydrationChange = firstEntry && latestEntry ? percentChange(latestEntry.hydration, firstEntry.hydration) : 0
  const nextCheckIn = new Date()
  nextCheckIn.setDate(nextCheckIn.getDate() + 14)
  return (
    <section className="progress-page page-wrap">
      <div className="page-heading-row"><div><span className="eyebrow">Your progress</span><h1>Notice change, gently.</h1><p>Trends matter more than a single day. Check in under similar lighting every two weeks.</p>{user && <span className="sync-message"><ShieldCheck size={14} /> Private cloud sync is on</span>}{syncError && <span className="sync-message sync-error"><CircleAlert size={14} /> {syncError}</span>}</div><button className="primary-button" onClick={() => setShowCheckIn(true)}><Camera size={17} /> Add check-in</button></div>
      {entries.length === 0 ? <article className="progress-empty"><span className="insight-icon"><LineChart size={22} /></span><h2>Your timeline starts here.</h2><p>Add a first check-in now, then return under similar lighting in about two weeks to see a more meaningful trend.</p><button className="secondary-button" onClick={() => setShowCheckIn(true)}>Add my first check-in <ArrowRight size={16} /></button></article> : <>
      <div className="progress-stats"><article><span>Visible blemishes</span><strong>{formatChange(blemishChange)}</strong><small>cosmetic signal since day one</small></article><article><span>Dark spot visibility</span><strong>{formatChange(darkSpotChange)}</strong><small>change since your first check-in</small></article><article><span>Hydration</span><strong>{formatChange(hydrationChange)}</strong><small>change since your first check-in</small></article></div>
      <article className="chart-card"><div className="chart-head"><div><span className="eyebrow">Four-week trend</span><h2>Your consistency is showing.</h2></div><div className="chart-legend"><span><i className="blemishes" />Blemishes</span><span><i className="dark-spots" />Dark spots</span><span><i className="hydration" />Hydration</span></div></div><ProgressChart entries={entries.slice(-6)} /></article>
      <div className="progress-grid"><article className="insight-card"><span className="insight-icon"><Sparkles size={22} /></span><span className="eyebrow">Pattern spotted</span><h2>{hydrationChange > 0 ? 'Your hydration signal is trending up.' : hydrationChange < 0 ? 'Your hydration signal has dipped.' : 'Your hydration signal is holding steady.'}</h2><p>Keep the routine consistent and compare check-ins under similar lighting. Trends are more useful than any single score.</p></article><article className="next-check-card"><CalendarDays size={24} /><div><span className="eyebrow">Next photo check-in</span><h2>{nextCheckIn.toLocaleDateString('en-GB', { day: '2-digit', month: 'long' })}</h2><p>Fourteen days gives your routine time to show a more meaningful signal.</p></div><button className="secondary-button" onClick={() => setShowCheckIn(true)}>Check in early</button></article></div>
      </>}
      {showCheckIn && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCheckIn(false)}><form className="modal-card" role="dialog" aria-modal="true" aria-labelledby="checkin-dialog-title" onSubmit={addEntry} onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" type="button" aria-label="Close check-in" onClick={() => setShowCheckIn(false)}><X size={18} /></button><span className="eyebrow">Two-minute reflection</span><h2 id="checkin-dialog-title">What are you noticing today?</h2>{(['blemishes', 'darkSpots', 'hydration'] as const).map((key) => <label className="range-field" key={key}><span><strong>{{ blemishes: 'Visible blemishes', darkSpots: 'Dark spot visibility', hydration: 'Hydration' }[key]}</strong><output>{form[key]}</output></span><input aria-label={{ blemishes: 'Visible blemishes', darkSpots: 'Dark spot visibility', hydration: 'Hydration' }[key]} type="range" min="0" max="100" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}<button className="primary-button full-width" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17} /> Saving…</> : <>Save check-in <Check size={17} /></>}</button></form></div>}
    </section>
  )
}

function ProgressChart({ entries }: { entries: ProgressEntry[] }) {
  const width = 720, height = 250, pad = 28
  const points = (key: 'blemishes' | 'darkSpots' | 'hydration') => entries.map((entry, i) => `${pad + (i * (width - pad * 2)) / Math.max(entries.length - 1, 1)},${height - pad - (entry[key] / 100) * (height - pad * 2)}`).join(' ')
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Blemish, dark spot, and hydration progress line chart">{[25, 50, 75].map((v) => <line key={v} x1={pad} y1={height - pad - v / 100 * (height - pad * 2)} x2={width - pad} y2={height - pad - v / 100 * (height - pad * 2)} className="grid-line" />)}<polyline points={points('blemishes')} className="chart-line blemishes-line" /><polyline points={points('darkSpots')} className="chart-line dark-spots-line" /><polyline points={points('hydration')} className="chart-line hydration-line" />{entries.map((entry, i) => <text key={entry.id} x={pad + i * (width - pad * 2) / Math.max(entries.length - 1, 1)} y={height - 4} textAnchor="middle">{entry.date}</text>)}</svg></div>
}

function Experts() {
  const { user, configured, signInWithGoogle } = useAuth()
  const [selected, setSelected] = useState<(typeof salons)[number] | null>(null)
  const [booked, setBooked] = useState(false)
  const [bookedTime, setBookedTime] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const requestBooking = async (time: string) => {
    if (!selected) return
    if (!user) {
      setBookingError(configured ? 'Sign in with Google to save this appointment request.' : 'Google sign-in must be configured before appointment requests can be saved.')
      return
    }
    setBooking(true)
    setBookingError('')
    try {
      const startsAt = new Date()
      startsAt.setDate(startsAt.getDate() + Math.max(0, selected.id - 1))
      const [, hourText, minuteText, meridiem] = time.match(/(\d+):(\d+)\s(AM|PM)/) || []
      let hour = Number(hourText)
      if (meridiem === 'PM' && hour < 12) hour += 12
      if (meridiem === 'AM' && hour === 12) hour = 0
      startsAt.setHours(hour, Number(minuteText), 0, 0)
      await saveBooking(user.id, { salonId: String(selected.id), salonName: selected.name, treatment: selected.treatment, startsAt: startsAt.toISOString(), priceGbp: selected.price })
      setBookedTime(time)
      setBooked(true)
    } catch {
      setBookingError('That request could not be saved. Please try another time.')
    } finally { setBooking(false) }
  }

  return (
    <section className="experts-page page-wrap">
      <div className="page-heading-row"><div><span className="eyebrow">Human care, when you want it</span><h1>Explore professional support.</h1><p>Preview cosmetic facial options matched to your goals. For medical concerns, Face Aura always recommends a qualified clinician.</p></div><div className="location-pill"><MapPin size={17} /> London preview <ChevronRight size={15} /></div></div>
      <div className="booking-status-banner"><span className="booking-status-icon"><Clock3 size={22} /></span><div><span className="eyebrow">Booking status · preview only</span><h2>Availability is not real-time yet.</h2><p>You can save a preferred salon and time to your account, but Face Aura does not currently contact the salon, reserve a slot, or take payment. A booking-provider or direct salon API is required for instant confirmation.</p></div></div>
      <div className="salon-grid">{salons.map((salon) => <article className="salon-card" key={salon.id}><div className={`salon-visual ${salon.tone}`}><span className="salon-monogram">{salon.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><span className="verified"><BadgeCheck size={15} /> Example listing</span></div><div className="salon-body"><div className="salon-title"><div><h2>{salon.name}</h2><span><Star size={14} fill="currentColor" /> {salon.rating} ({salon.reviews})</span></div><strong>£{salon.price}</strong></div><p>{salon.treatment}</p><div className="salon-meta"><span><MapPin size={14} /> {salon.distance}</span><span><Clock3 size={14} /> {salon.time}</span></div><button className="secondary-button full-width" onClick={() => { setSelected(salon); setBooked(false); setBookingError('') }}>Save a preferred time <ArrowRight size={16} /></button></div></article>)}</div>
      <div className="clinician-callout"><span className="callout-icon"><HeartPulse size={23} /></span><div><h2>Not sure whether a facial is right?</h2><p>If a mark is changing, painful, bleeding, or worrying you, skip the salon and speak to a GP or dermatologist.</p></div><a href="https://www.nhs.uk/conditions/moles/" target="_blank" rel="noreferrer">Read NHS guidance <ArrowRight size={16} /></a></div>
      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}><div className="modal-card booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" aria-label="Close appointment request" onClick={() => setSelected(null)}><X size={18} /></button>{booked ? <div className="booking-success"><span><Check size={26} /></span><h2 id="booking-dialog-title">Preference saved — not booked.</h2><p>{selected.name} · {bookedTime}</p><small>This is stored in your Face Aura account only. The salon has not been contacted and this slot is not reserved.</small><button className="primary-button" onClick={() => setSelected(null)}>Done</button></div> : <><span className="eyebrow">Sample times · no live availability</span><h2 id="booking-dialog-title">{selected.treatment}</h2><p className="booking-place">{selected.name} · £{selected.price}</p><div className="time-grid">{['10:00 AM', '11:30 AM', '2:15 PM', '4:30 PM'].map((time) => <button key={time} disabled={booking} onClick={() => void requestBooking(time)}>{booking ? 'Saving…' : time}</button>)}</div>{bookingError && <div className="error-message booking-error"><CircleAlert size={17} /> <span>{bookingError}{!user && configured && <button className="inline-auth" onClick={() => void signInWithGoogle()}>Continue with Google</button>}</span></div>}<small className="prototype-note">Saving a preference does not contact the salon, hold a slot, or charge you.</small></>}</div></div>}
    </section>
  )
}

function VoiceLauncher({ analysis, open, intent, onOpen, onClose }: { analysis: SkinAnalysis; open: boolean; intent: VoiceIntent; onOpen: () => void; onClose: () => void }) {
  if (!open) return <div className="voice-widget"><button className="voice-fab" onClick={onOpen} aria-label="Open Face Aura voice companion"><MessageCircleMore size={21} /><span className="voice-pulse" /></button></div>
  return <Suspense fallback={<div className="voice-widget open"><div className="voice-panel voice-loading"><LoaderCircle className="spin" size={22} /> Preparing voice companion…</div></div>}><LazyVoiceCompanion analysis={analysis} intent={intent} onClose={onClose} /></Suspense>
}

function Footer() {
  return <footer><div className="brand footer-brand"><FaceAuraLogo /><span className="brand-wordmark"><span>Face</span><em>Aura</em></span></div><p>Open-weight skincare intelligence for every face.</p><div><span>Open source · MIT</span><a href="https://ai.google.dev/gemma/docs/core/model_card_4" target="_blank" rel="noreferrer">Model card</a><span>Not medical advice</span></div></footer>
}

export default App
