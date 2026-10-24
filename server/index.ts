import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import cors from 'cors'
import express from 'express'
import type { Request, Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { SkinAnalysis } from '../src/types.js'

const app = express()
const port = Number(process.env.PORT || 8787)
const ollamaUrl = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '')
const model = process.env.GEMMA_MODEL || 'gemma4:e4b'
const ollamaApiKey = process.env.OLLAMA_API_KEY
const allowDemo = process.env.ALLOW_DEMO_ANALYSIS !== 'false'
const requireAuth = process.env.REQUIRE_AUTH === 'true'
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const serverSupabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null

app.use(cors({ origin: true }))
app.use(express.json({ limit: '15mb' }))

async function allowApiRequest(req: Request, res: Response) {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) {
    if (!requireAuth) return true
    res.status(401).json({ error: 'Sign in with Google to use this feature.' })
    return false
  }
  if (!serverSupabase) {
    if (!requireAuth) return true
    res.status(503).json({ error: 'Authentication is not configured on the server.' })
    return false
  }
  const { error } = await serverSupabase.auth.getUser(token)
  if (error) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    return false
  }
  return true
}

const schema = {
  type: 'object',
  required: ['summary', 'skinType', 'skinTypeNote', 'confidence', 'concerns', 'morningRoutine', 'eveningRoutine', 'products', 'nextCheckInDays', 'safetyNote'],
  properties: {
    summary: { type: 'string' },
    skinType: { type: 'string' },
    skinTypeNote: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    concerns: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'object', required: ['name', 'level', 'score', 'observation'], properties: { name: { type: 'string' }, level: { enum: ['low', 'moderate', 'high'] }, score: { type: 'number', minimum: 0, maximum: 100 }, observation: { type: 'string' } } } },
    morningRoutine: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'object', required: ['order', 'name', 'instruction', 'ingredient'], properties: { order: { type: 'number' }, name: { type: 'string' }, instruction: { type: 'string' }, ingredient: { type: 'string' } } } },
    eveningRoutine: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'object', required: ['order', 'name', 'instruction', 'ingredient'], properties: { order: { type: 'number' }, name: { type: 'string' }, instruction: { type: 'string' }, ingredient: { type: 'string' } } } },
    products: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'object', required: ['category', 'name', 'reason', 'priceBand'], properties: { category: { type: 'string' }, name: { type: 'string' }, reason: { type: 'string' }, priceBand: { enum: ['£', '££', '£££'] } } } },
    nextCheckInDays: { type: 'number', minimum: 7, maximum: 30 },
    safetyNote: { type: 'string' },
  },
}

const fallbackAnalysis = (): SkinAnalysis => ({
  summary: 'Your skin appears balanced overall, with a little dehydration around the cheeks and some visible congestion through the T-zone.',
  skinType: 'Combination · dehydration-prone',
  skinTypeNote: 'Oil is more visible through the forehead and nose, while the cheeks look like they would benefit from barrier support.',
  confidence: 82,
  concerns: [
    { name: 'Hydration', level: 'moderate', score: 68, observation: 'Fine surface texture suggests your skin may be short on water.' },
    { name: 'Congestion', level: 'moderate', score: 42, observation: 'A few visible pores and small blemishes appear around the T-zone.' },
    { name: 'Uneven tone', level: 'low', score: 24, observation: 'A small amount of visible post-blemish discolouration appears present.' },
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
    { category: 'Moisturiser', name: 'Ceramide cloud cream', reason: 'Supports the barrier without a heavy finish.', priceBand: '££' },
  ],
  nextCheckInDays: 14,
  safetyNote: 'Cosmetic wellness guidance only. A photo cannot diagnose a skin condition; speak with a qualified clinician about pain, rapid changes, persistent irritation, or anything that concerns you.',
  inference: 'demo',
  createdAt: new Date().toISOString(),
})

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  model,
  provider: ollamaUrl.includes('ollama.com') ? 'ollama-cloud' : 'ollama-local',
  modelConfigured: !ollamaUrl.includes('ollama.com') || Boolean(ollamaApiKey),
  demoFallback: allowDemo,
  elevenLabsConfigured: Boolean(process.env.ELEVENLABS_AGENT_ID),
  cloudConfigured: Boolean(serverSupabase),
  authRequired: requireAuth,
}))

app.post('/api/analyze', async (req, res) => {
  if (!(await allowApiRequest(req, res))) return
  const { imageDataUrl, goals = [] } = req.body as { imageDataUrl?: string; goals?: string[] }
  if (!imageDataUrl || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(imageDataUrl)) return res.status(400).json({ error: 'Please provide a JPG, PNG, or WebP face image.' })
  const image = imageDataUrl.split(',')[1]
  if (!image || image.length > 14_000_000) return res.status(413).json({ error: 'That image is too large. Please use an image under 10 MB.' })

  const systemPrompt = `You are Face Aura, a careful, gender-inclusive cosmetic skincare assistant. Review the supplied face image for non-medical, visually observable skincare patterns only. Never identify the person, infer age, ethnicity, gender, health status, attractiveness, or other protected traits. Never diagnose acne, rosacea, melanoma, infection, allergy, or another condition. Use phrases such as "appears", "may", and "visible signal". If image quality is limited, lower confidence. Make routines conservative: no more than one exfoliating active, introduce actives slowly, avoid brand claims, always include daytime SPF, and recommend a qualified clinician for pain, bleeding, rapidly changing marks, persistent irritation, or concern. Return only JSON matching the supplied schema.`
  const userPrompt = `Analyze this face image for a skincare routine. The user's stated cosmetic goals are: ${goals.join(', ') || 'general skin maintenance'}. Keep the summary under 45 words, observations under 22 words each, and instructions under 18 words each.`

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (ollamaApiKey) headers.Authorization = `Bearer ${ollamaApiKey}`
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, stream: false, format: schema, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt, images: [image] }], options: { temperature: 0.2 } }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!response.ok) throw new Error(`Gemma endpoint returned ${response.status}`)
    const body = await response.json() as { message?: { content?: string } }
    const content = body.message?.content
    if (!content) throw new Error('Gemma returned an empty response')
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, '')) as Omit<SkinAnalysis, 'inference' | 'createdAt'>
    return res.json({ ...parsed, inference: 'gemma4', createdAt: new Date().toISOString() })
  } catch (error) {
    console.error('Gemma analysis failed:', error instanceof Error ? error.message : error)
    if (!allowDemo) return res.status(503).json({ error: 'Gemma 4 is unavailable. Check the configured Ollama endpoint, model, and server-side API key.' })
    return res.json(fallbackAnalysis())
  }
})

app.get('/api/elevenlabs/signed-url', async (req, res) => {
  if (!(await allowApiRequest(req, res))) return
  const key = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!key || !agentId) return res.status(404).send('ElevenLabs is not configured')
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { headers: { 'xi-api-key': key } })
    if (!response.ok) throw new Error(`ElevenLabs returned ${response.status}`)
    const body = await response.json() as { signed_url?: string }
    if (!body.signed_url) throw new Error('No signed URL returned')
    res.type('text/plain').send(body.signed_url)
  } catch (error) {
    console.error('ElevenLabs URL failed:', error instanceof Error ? error.message : error)
    res.status(502).send('Could not start a private voice session')
  }
})

const dist = join(process.cwd(), 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*splat}', (_req, res) => res.sendFile(join(dist, 'index.html')))
}

app.listen(port, () => console.log(`Face Aura API listening on http://localhost:${port}`))
