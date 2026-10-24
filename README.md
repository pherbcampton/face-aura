# Face Aura

Face Aura is a private, gender-inclusive skincare companion built for Hacktoberfest 2026. It turns a clear face photo into an explainable cosmetic skin snapshot, a short AM/PM routine, ingredient-led product guidance, progress tracking, salon appointment requests, and an optional natural voice conversation.

- **Live demo:** [monkfish-app-dt6vy.ondigitalocean.app](https://monkfish-app-dt6vy.ondigitalocean.app/)
- **Source:** [github.com/pherbcampton/face-aura](https://github.com/pherbcampton/face-aura)

Recommendations respond to visible cosmetic signals and user-selected goals—not gender identity, presentation, age, ethnicity, or attractiveness.

> Face Aura is a cosmetic wellness application, not a medical device. It does not diagnose skin conditions and should not replace advice from a qualified clinician.

## How Face Aura works

1. **Sign in or explore privately.** Google sign-in creates a Supabase session for cross-device syncing. Guests can still explore, with their data kept in that browser.
2. **Capture or upload a photo.** The responsive scanner supports a device camera and image upload, with lighting and framing guidance.
3. **Prepare the image in the browser.** Face Aura corrects orientation, resizes the photo and converts it to an efficient JPEG before sending it for analysis.
4. **Run the protected AI analysis.** The Express API validates the user session in production, then sends the image and selected goals to the configured Gemma 4 vision model through Ollama Cloud or a local Ollama server.
5. **Return an explainable wellness result.** Gemma provides a likely cosmetic skin profile, visible concerns, confidence, a concise AM/PM routine, ingredient-led suggestions and conservative safety guidance. The server validates and normalises the structured response before the UI displays it.
6. **Listen and ask follow-up questions.** ElevenLabs reads a short personal summary and opens a natural voice conversation. The face photo is never sent to ElevenLabs.
7. **Build consistency.** Routine ticks are saved per calendar day. Signed-in users sync them to an owner-only Supabase row; signed-out users receive an immediate device-local fallback. AM and PM progress survives refreshes and later sessions.
8. **Track progress.** Users can save cosmetic check-ins for blemish visibility, dark-spot visibility and hydration, then review the trend chart over time.
9. **Request expert support.** The current salon experience stores a preferred example time only. It does not claim real-time availability, reserve a slot or take payment.

```text
Camera / upload
      ↓
React image preparation
      ↓
Authenticated Express API
      ↓
Gemma 4 via Ollama ──→ structured skin snapshot and routine
      ↓                              ↓
ElevenLabs conversation       Supabase private sync
```

## Architecture

- **React + TypeScript + Vite** for the responsive application.
- **Gemma 4 through Ollama** for open-weight multimodal image analysis, locally during development or through Ollama Cloud in production.
- **ElevenLabs ElevenAgents** for natural, low-latency voice conversation. ElevenLabs receives a short text summary, never the face image.
- **Supabase Auth and Postgres** for Google sign-in and private per-user results, progress and appointment requests.
- **Row Level Security** on every personal-data table so authenticated users can access only their own records.

Face images are passed to the configured Gemma endpoint for the current request and are not written to the Face Aura database. Only the structured text result is saved for signed-in users.

## Features

- Google OAuth login and account profile
- Personal result and progress sync across devices
- Per-day AM/PM routine completion that survives reloads and syncs across signed-in sessions
- Photo capture guidance, type validation and a 10 MB limit
- Structured Gemma 4 result with confidence and conservative safety language
- Personal AM/PM routine and ingredient-led product suggestions
- A guided post-analysis journey: voice summary, routine, reminders and next check-in
- Progress check-ins and an interactive trend chart
- Device-saved routine and photo check-in reminders; browser notifications work while Face Aura is open
- Saved salon time preferences with explicit non-live availability labelling
- ElevenLabs voice readout and follow-up conversation using a server-generated signed URL
- Local fallback mode so judges can explore the interface without model credentials

## What is stored

| Data | Signed-in user | Guest | Notes |
| --- | --- | --- | --- |
| Structured skin analysis | Supabase | Browser storage | The original face image is not stored by Face Aura |
| Daily AM/PM routine ticks | Supabase + device safety cache | Browser storage | One owner-only record per user and calendar day |
| Progress check-ins | Supabase | Browser storage | Cosmetic self-tracking values only |
| Appointment preferences | Supabase | Not saved | A request record, not a confirmed booking |
| Reminder preferences | Browser storage | Browser storage | Browser notifications work only while the app is open |

Every public-schema table containing personal data has Row Level Security enabled. Policies compare `auth.uid()` with the row owner, and the browser receives only the Supabase publishable key—never a secret or service-role key.

## What is needed for a fully live release

1. A **Supabase project** with the included migration applied.
2. A **Google Cloud OAuth web client**, enabled in Supabase Auth.
3. A running **Ollama + Gemma 4** service locally, or an **Ollama Cloud API key** for deployment.
4. An **ElevenLabs** account, agent ID and API key.
5. A real **salon inventory/booking partner** or direct salon integration. The current UI saves appointment requests but does not claim a confirmed salon booking.
6. A **Web Push, email or mobile notification service** for reminders when Face Aura is closed. The current browser reminders run only while the app is open.
7. An HTTPS deployment and final domain, followed by updating OAuth redirect allowlists.
8. Before handling real users: explicit consent and deletion controls, a retention policy, DPIA/privacy review, clinician review, accessibility testing, abuse/rate limiting, and jurisdiction-specific legal/medical-device review.

## Run locally

Requirements: Node.js 22, npm, [Ollama](https://ollama.com/) for local inference, and the Supabase CLI for database setup.

```bash
ollama pull gemma4:e4b
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. The private API runs at `http://localhost:8787`.

To require live Gemma inference, set `ALLOW_DEMO_ANALYSIS=false`. Once Google sign-in is working, set `REQUIRE_AUTH=true` in production so analysis and voice endpoints reject anonymous requests.

## Deploy to DigitalOcean App Platform with hosted Gemma 4

Face Aura deploys as one Node.js Web Service: DigitalOcean builds the Vite client, then the Express server serves both `dist` and the private API. Uploaded photos are resized and converted to an efficient JPEG in the browser before analysis.

1. Create an Ollama Cloud key at [ollama.com/settings/keys](https://ollama.com/settings/keys). Do not paste the key into a `VITE_` variable or commit it.
2. Push this project to a GitHub, GitLab, or Bitbucket repository.
3. In DigitalOcean, choose **Create → App Platform**, select the repository and the `main` branch, and keep the detected resource type as **Web Service**.
4. Use these component settings:

```text
Build command: npm run build
Run command:   npm start
HTTP port:     8080
Health check:  /api/health
```

App Platform injects `PORT=8080`; the server already reads it. Node 22 is pinned in `package.json`, and `tsx` is a production dependency because App Platform removes development dependencies before starting the service.

5. Add these environment variables. Mark API keys as **Encrypted** and use the scopes shown:

```dotenv
# RUN_TIME · Encrypted
OLLAMA_API_KEY=your_server_only_ollama_key
ELEVENLABS_API_KEY=your_server_only_elevenlabs_key

# RUN_TIME
OLLAMA_URL=https://ollama.com
GEMMA_MODEL=gemma4:cloud
ALLOW_DEMO_ANALYSIS=false
REQUIRE_AUTH=true
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
ELEVENLABS_AGENT_ID=your_agent_id

# RUN_AND_BUILD_TIME
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_ELEVENLABS_AGENT_ID=your_agent_id
```

`VITE_` variables must be available while the frontend is built, which is why their DigitalOcean scope is `RUN_AND_BUILD_TIME`. The server-only API keys must be `RUN_TIME` and Encrypted.

6. Review the selected instance and its monthly price, then create the app. Enable Autodeploy if every push to `main` should trigger a new release.
7. Open `https://YOUR-DIGITALOCEAN-DOMAIN/api/health`. A live release should report `provider: ollama-cloud`, `modelConfigured: true`, `elevenLabsConfigured: true`, and `authRequired: true`.
8. In Supabase → Authentication → URL Configuration, set the **Site URL** to the final DigitalOcean URL and add it to **Redirect URLs**. The Google authorised redirect URI remains the Supabase callback URL shown below.
9. Test Google sign-in, camera capture, live Gemma analysis, the ElevenLabs readout, and saving a progress entry on the HTTPS deployment.

For a judge-friendly fallback deployment only, `ALLOW_DEMO_ANALYSIS=true` keeps the interface explorable if inference is unavailable. Do not use that setting when claiming a live AI result.

## Configure Supabase and Google login

1. Create a Supabase project.
2. Link this folder and apply the checked-in migration:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create owner-only tables for profiles, analyses, progress entries, daily routine completion and appointment preferences. Run `supabase db push` again whenever a new migration is pulled from the repository.

3. Copy the project URL and publishable key into both client and server variables in `.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

4. In Google Cloud Console, create a Web application OAuth client. Add this Supabase callback URL as an authorised redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

5. In Supabase Dashboard → Authentication → Sign In / Providers → Google, enable Google and add the client ID and client secret.
6. In Supabase URL Configuration, use the deployed Face Aura URL as the Site URL and allow `http://localhost:5173` for local development.

Never put a Google client secret, Supabase secret/service-role key, or ElevenLabs API key in a `VITE_` variable.

## Configure ElevenLabs

1. Create an ElevenLabs ElevenAgents agent with a careful skincare-wellness prompt that never diagnoses.
2. Put the agent ID in `ELEVENLABS_AGENT_ID` and the secret key in `ELEVENLABS_API_KEY`.
3. In the agent’s Security settings, enable the **First message** conversation override. Face Aura uses it to read each user’s personal result before opening the conversation.
4. A public agent can instead use `VITE_ELEVENLABS_AGENT_ID`; the signed server route is preferred.

## Safety and privacy

- The model prompt prohibits identity, gender, age, ethnicity, attractiveness, health-status and protected-trait inference.
- Results use observational language and do not name diseases.
- Pain, bleeding, rapidly changing marks, persistent irritation or user concern are directed to qualified care.
- Product suggestions are category/ingredient based and have no affiliate ranking.
- The database migration enables owner-only RLS policies for every personal table.
- No service-role credential is used in the browser.

## Hacktoberfest 2026 checklist

- Open-source/open-weight AI is central to the working product: Gemma 4 performs the multimodal cosmetic skin review.
- The project is released under the [MIT licence](./LICENSE).
- Model and hosted-service dependencies are documented.
- The interface labels whether a result came from Gemma 4 or the illustrative fallback.
- No Agent Skill is being submitted, so Agent Skills open-standard packaging is not applicable.
- The source is published in a **public GitHub repository**, and both the repository and live DigitalOcean demo are linked at the top of this README.

## Project structure

```text
src/                  React application, auth and personal-data client
server/               Gemma and ElevenLabs server routes
supabase/migrations/  Versioned schema and RLS policies
public/               Original application assets
```

## Verify

```bash
npm run typecheck
npm run build
npm start
```

Gemma is an open-weight model family from Google DeepMind. ElevenLabs provides the optional hosted conversational voice layer. Supabase provides authentication and data storage. The hero portrait was generated specifically for this project and is included as a project asset.
