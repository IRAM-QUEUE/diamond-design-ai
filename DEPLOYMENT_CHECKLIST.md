# Deployment Checklist

Use this checklist for a production Vercel launch.

## Supabase

- Create or confirm the production Supabase project.
- Add the app URL to Supabase Auth redirect URLs.
- Enable Email OTP / magic link auth.
- Apply all migrations in `supabase/migrations`.
- Confirm these tables exist: `profiles`, `design_sessions`, `design_images`, `usage_events`.
- Confirm the `design-images` bucket exists.
- Confirm `design-images` is private.
- Confirm RLS is enabled on app tables.

## Environment Variables

- Add all variables from `.env.production.example` in Vercel.
- Confirm `NEXT_PUBLIC_DEMO_MODE=false`.
- Confirm server-only keys are not prefixed with `NEXT_PUBLIC_`.
- Confirm `/api/health` reports OpenAI, Replicate, and Supabase as configured.

## Vercel Deployment

- Connect the GitHub repository to Vercel.
- Select the production branch.
- Install command: `npm install`.
- Build command: `npm run build`.
- Output is managed by Next.js.
- Deploy once after environment variables are configured.

## Admin Setup

- Sign in once with the intended admin email.
- Run:

```sql
update public.profiles
set role = 'admin'
where email = 'client@example.com';
```

- Replace `client@example.com` with the real admin email.
- Open `/admin` and confirm dashboard access.

## Launch Tests

- Create a normal test user.
- Confirm signed-out `/api/chat` is blocked.
- Confirm signed-out `/api/design-brief` is blocked.
- Confirm test user can complete chat consultation.
- Confirm image generation creates one private stored image and consumes one credit.
- Confirm image editing creates one private stored image and consumes one credit.
- Confirm uploaded references are stored under private Storage.
- Confirm signed URL refresh works by reloading a saved session.
- Confirm blocked user cannot generate or edit.
- Temporarily lower daily image limit and confirm over-limit generation is blocked before Replicate.
- Finalize a design and confirm the design brief is saved/logged.
- Confirm `/admin` shows success/failure counts, estimated cost, and latency.

## Rollback Plan

- Keep the last successful Vercel deployment available for instant rollback.
- Do not delete Supabase migrations after deployment.
- If a migration causes production trouble, disable affected routes at Vercel or roll back code first.
- For storage access issues, keep service-role admin access available for manual signed URL recovery.
- For provider failures, set `NEXT_PUBLIC_DEMO_MODE=false` and fix provider env vars rather than enabling demo mode in production.
