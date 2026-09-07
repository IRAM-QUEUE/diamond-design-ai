# Shop handoff in Gmail

The admin saves the receiving email in **Admin Usage Dashboard → Shop order email**.
Customers choose **Send to shop**, confirm their details, connect their matching Gmail account, and prepare the draft. Gmail opens with subject **New Order**, the admin's recipient address, and exactly two attachments: the printable Arabic handover PDF and the selected image's preserved original (PNG). The customer clicks **Send** in Gmail. The application never calls a send-email endpoint.

## Google setup

Reuse the Google OAuth web client already used by this project's Google sign-in (public client ID configured in `src/config/public-env.ts`).

1. In that Google Cloud project, enable the **Gmail API**.
2. On the OAuth web client, add the deployed app origin to **Authorized JavaScript origins**: `https://diamond-design-ai.vercel.app`. Add `http://localhost:3000` for local testing. This popup token flow does not require a new redirect URI.
3. Configure the OAuth consent screen for `openid`, `email`, and `https://www.googleapis.com/auth/gmail.compose`. Google describes the latter as draft management and sending permission; this app only creates and locates drafts. In Testing mode, add the intended Gmail accounts as test users. Complete Google's required verification before general public use of the restricted Gmail scope.
4. For a different Google project, set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to its OAuth web client ID and rebuild the app. No SMTP service, Resend key, or client secret is used for this flow.

The Google Cloud/API/origin/consent configuration must be completed by someone with access to that project. Finding the existing public client ID alone does not establish that Gmail API access is enabled.

## Database

Apply `supabase/migrations/005_shop_order_email.sql` to any new environment. It adds admin-managed recipient settings, private draft tracking, and a private `shop-order-files` PDF bucket. Tables allow server service-role access only, with RLS enabled. PDF uploads use an expiring, non-overwriting token issued for the authenticated customer's draft. The browser never receives a service-role key.

The migration was applied to the existing project database during implementation. Set the real shop recipient in the dashboard; no sample recipient is installed.

## Behavior and recovery

- Gmail permission is requested only for the handoff flow. The short-lived token stays in component memory and is checked against the signed-in user's verified Google email on the server. It is not stored in draft rows.
- Repeated clicks for the same image reuse its draft. A database claim prevents concurrent draft creation. A Gmail timeout triggers a lookup by the draft's unique Message-ID; ambiguous attempts never automatically create another draft.
- The app cannot mark an order as sent: the customer sends it outside the app. A previously sent/deleted draft is not recreated automatically.
- Generated images use the private `sources` copy. Missing originals stop draft creation instead of silently attaching a watermarked display copy. Uploaded references use the original upload; any watermark already embedded in the upload remains part of that source.
- PDFs upload directly to private storage to avoid the hosting platform's request-body limit. PDF size is limited to 15 MiB; total attachments to 25 MiB.
- The draft opens for the matching Gmail account. Gmail's web interface may require selecting the prepared **New Order** from Drafts if it does not honor the direct compose link.

## Validation

Run `node scripts/test-shop-order.cjs`, `npx tsc --noEmit --incremental false`, and `npm run lint`.

Tests use synthetic data and mocked Google/storage responses. They cover MIME attachments and Arabic body text, source-image ownership, mismatched Gmail accounts, admin authorization, missing Gmail API setup, concurrent clicks, draft reuse, and recovery after ambiguous creation. A real Gmail consent/draft smoke test still requires Google project setup and a consenting test user.

References: [Gmail draft creation](https://developers.google.com/workspace/gmail/api/guides/drafts), [Google browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).
