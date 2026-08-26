# Diamond Design AI Agent

A premium AI design workspace for diamond jewelry concepting, refinement, and workshop handoff. The MVP supports two demo journeys: creating a new concept from conversation, and uploading an existing reference design for AI-assisted edits.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui-style primitives
- Radix UI
- Framer Motion
- Lucide Icons
- OpenAI GPT for consultant chat and workshop briefs
- Replicate FLUX.2 Pro for image generation
- Replicate FLUX Kontext Pro for image editing
- Replicate Krea 2 Medium for Arabic lettering jewelry generation/edit routing
- Supabase Auth, Postgres, Row Level Security, and Storage

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4
REPLICATE_API_TOKEN=
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ESTIMATED_COST_REPLICATE_FLUX_2_PRO_IMAGE=0.04
ESTIMATED_COST_REPLICATE_FLUX_KONTEXT_PRO_EDIT=0.04
ESTIMATED_COST_REPLICATE_KREA_2_MEDIUM_IMAGE=0.04
ESTIMATED_COST_OPENAI_CHAT=0.01
ESTIMATED_COST_OPENAI_DESIGN_BRIEF=0.02
```

`OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY` are server-side only. Never expose the service role key in browser code. `NEXT_PUBLIC_DEMO_MODE=true` enables clearly labeled placeholder concepts/briefs if provider keys are unavailable. Real API calls require Supabase sign-in and usage-limit checks.

Note: the app defaults to `OPENAI_MODEL=gpt-5.4` as requested. If your OpenAI account does not have access to that model string, set `OPENAI_MODEL` in `.env.local` to an available GPT model before the demo.

## Main Demo Flows

### Flow A: Create From Scratch

1. Landing page -> `Start Designing`
2. Chat with the luxury consultant until the profile is ready
3. Click `Generate Diamond Concept`
4. Select a concept in the canvas
5. Edit with FLUX Kontext Pro
6. Finalize the preferred design
7. Generate the workshop brief
8. Download PDF, download PNG, copy summary/reference, or print

Suggested prompt:

```text
I want a modern engagement ring for my partner, with an oval diamond, white gold, a hidden halo, and a refined thin band.
```

### Flow B: Upload Existing Design

1. Landing page -> `Upload Existing Design`
2. Upload PNG/JPG/JPEG/WEBP reference under 10MB
3. Confirm upload as `V1 - Uploaded Reference`
4. Edit with natural language
5. Review version history
6. Finalize
7. Export/copy/print the handoff brief

Suggested edit:

```text
Change the metal to rose gold and make the band thinner.
```

## API Routes

- `POST /api/chat`
- `POST /api/generate-designs`
- `POST /api/edit-design`
- `POST /api/design-brief`
- `GET /api/usage`
- `POST /api/design-images`
- `GET /api/design-sessions/[id]`
- `GET/PATCH /api/admin`

Routes use centralized environment validation, input parsing, clear error responses, authenticated server-side provider calls, Supabase persistence, and image usage logging.

## Supabase Setup

1. Create a Supabase project.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and your deployment provider.
3. Run all SQL files in `supabase/migrations` with the Supabase CLI or SQL editor.
4. Enable Email OTP / magic link auth in Supabase Auth.
5. Create the `design-images` storage bucket if the migration was not run by a role allowed to manage storage buckets. Migration `004_private_storage.sql` makes this bucket private.

Supabase Auth URL configuration:

- Site URL: `https://diamond-design-ai.vercel.app`
- Redirect URLs:
  - `https://diamond-design-ai.vercel.app/**`
  - `http://localhost:3000/**`

Set `NEXT_PUBLIC_SITE_URL=https://diamond-design-ai.vercel.app` in Vercel so magic link emails use the production URL instead of localhost.

Google sign-in setup:

In Supabase Dashboard -> Authentication -> Providers -> Google:

- Enable Google provider
- Add Google OAuth Client ID
- Add Google OAuth Client Secret

In Google Cloud Console, add this authorized redirect URI:

- `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/auth/v1/callback`

Supabase URL Configuration:

- Site URL: `https://diamond-design-ai.vercel.app`
- Redirect URLs:
  - `https://diamond-design-ai.vercel.app/**`
  - `http://localhost:3000/**`

The migration creates:

- `profiles`
- `design_sessions`
- `design_images`
- `usage_events`
- RLS policies for owner access and admin read/update access
- A private `design-images` bucket for generated, edited, and uploaded image copies

Storage note: generated, edited, and uploaded images are copied into private Supabase Storage. The database keeps `storage_path` as the durable reference and API responses return signed URLs for display.

## Private Image Storage

The `design-images` bucket is private. Signed image URLs are created only server-side and expire after about 1 hour.

Storage paths use:

- Generated/edited images: `users/{user_id}/sessions/{session_id}/images/{image_id}.png`
- Uploaded references: `users/{user_id}/sessions/{session_id}/uploads/{image_id}.png`
- Workshop exports, when stored server-side: `users/{user_id}/sessions/{session_id}/exports/{reference_id}.png`

When a signed URL expires, the workspace calls `GET /api/design-sessions/{id}` to reload session images with fresh signed URLs. Users can only refresh signed URLs for their own sessions; admins may access all sessions through server-side checks.

## Usage Limits

Image credits apply only to Replicate image outputs:

- `image_generation` consumes 1 credit.
- `image_edit` consumes 1 credit.
- `upload`, `chat`, and `design_brief` consume 0 credits.

The server reserves image credits atomically in Postgres before calling Replicate. Reserved and succeeded image events count against limits; failed provider events are marked `failed` and no longer count against future limits. Defaults are 5 daily image credits and 50 monthly image credits. The workspace shows remaining daily and monthly credits near generation/edit controls and disables AI image actions at the limit.

Server-side rate limits:

- `/api/chat`: 30 requests per minute per signed-in user.
- `/api/generate-designs`: 5 requests per minute per signed-in user.
- `/api/edit-design`: 5 requests per minute per signed-in user.
- `/api/design-brief`: 10 requests per minute per signed-in user.

## Admin User

The `/admin` dashboard is available only to users with `profiles.role = 'admin'`.

To make an admin user after they sign in once:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```

Replace `admin@example.com` with the intended admin email after that person signs in once.

Admins can view total users, successful/failed/reserved image generations and edits, estimated usage cost, average latency, top image users, blocked users, and can block/unblock users or change daily/monthly image limits.

## Vercel Deployment

1. Connect the GitHub repository to Vercel.
2. Add every variable from `.env.production.example` in Vercel Project Settings.
3. Set `NEXT_PUBLIC_DEMO_MODE=false` for production.
4. Deploy the Next.js app.
5. Apply Supabase migrations from `supabase/migrations`.
6. Verify `/api/health` reports Supabase, OpenAI, and Replicate as configured.
7. Verify the `design-images` bucket is private.
8. Sign in once with the intended admin email and run the admin SQL above.
9. Run the launch tests in `DEPLOYMENT_CHECKLIST.md`.

Vercel runtime notes:

- Replicate generation/editing routes are synchronous and can take time.
- Route handlers download image outputs server-side before private Storage upload.
- Large uploaded images and base64 payloads increase request memory pressure.
- A future queue/webhook flow is recommended if image latency or timeout rates rise.

## Project Structure

```text
src/
  app/
    api/
    (app)/chat/
  config/
    env.ts
    public-env.ts
  lib/
    api-response.ts
    demo-data.ts
    design-profile.ts
    export-design.ts
  services/
    image/
    llm/
    supabase/
    storage/
  supabase/
    migrations/
  types/
    design.ts
```

## Quality Checks

```bash
npm run lint
npm run build
```

## Production Hardening Verification

Manual checks before launch:

- Signed-out `POST /api/chat` with real OpenAI configured returns `401`.
- Signed-out `POST /api/design-brief` with real OpenAI configured returns `401`.
- Over-limit users receive `429` before Replicate is called.
- `profiles.is_blocked=true` users cannot generate or edit images.
- Successful generation/edit usage events move from `reserved` to `succeeded`.
- Failed provider calls move reserved usage events to `failed`.
- Admin dashboard shows success/failure counts, estimated costs, and latency.

## Deployment Notes

- Add all environment variables in the hosting provider.
- Keep API keys server-side only.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Use `NEXT_PUBLIC_DEMO_MODE=false` in production.
- Ensure the deployment target supports Next.js route handlers and server-side `fetch`.
- Replicate image generation/editing can take time; keep generous function timeouts where supported.

## MVP Limitations

- No checkout or pricing
- No CAD, 3D, or manufacturing files
- No website/store integration
- Uploaded references still use browser-local data URLs for immediate preview, then are converted server-side into private Supabase Storage objects.
- Signed image URLs expire, so stale browser-local sessions may need a server refresh before old images display again.
- Final workshop brief is for visual inspiration and jeweler review only
