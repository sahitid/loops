# Loops

Private group newsletters for friends, families, and your people. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4.

## What works

- Create private groups and invite up to 30 people with a revocable invitation link.
- Email-code sign-in with one-time codes, expiry and attempt limits; cross-device group access. Existing personal access links continue to work.
- Email invitations, recurring response forms, reminders for members who have not submitted, and full newsletter emails with inline photos and links to videos. Each member opts in and can unsubscribe per group.
- Record voice notes (up to 10 minutes), with live browser speech recognition where supported.
- Turn an editable transcript into a newsletter draft with Claude. Review and edit before submitting.
- Bulk-upload up to 30 photos, videos, and audio notes per person per issue, up to 100 MB per file. Uploads go directly to a **private** Vercel Blob store.
- Write freeform updates, answer optional questions, and save private drafts.
- Choose questions from a bank or write your own.
- Publish compiled newsletters, read the archive, and print/save an issue as PDF.
- Weekly, fortnightly, or calendar-month schedules, with a daily Vercel Cron publication check and pause controls.
- Responsive Letterloop-inspired interface and an isolated sample loop at `/demo`.

Email requires a verified Resend sending domain, a Resend API key, and the email environment variables below. Until configured, the interface explicitly shows that email sign-in and delivery are unavailable; groups and personal access links still work. Claude does not transcribe raw audio here: live transcription uses the browser's speech recognition service, which may send audio to its provider. If unsupported, audio recording still works and users can type/paste a transcript. This app currently transcribes English (`en-US`). Media is attached to the newsletter; Claude receives only the text supplied for drafting and does not analyze photos/videos.

## Local development

```sh
npm install
cp .env.example .env.local
npm run dev
```

Without Blob credentials, group records use the ignored `.data/` directory locally. Uploads require a connected private Blob store. Vercel production requires cloud storage and never falls back to ephemeral files.

## Environment

| Variable                 | Purpose                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `BLOB_READ_WRITE_TOKEN`  | Automatically supplied by a private Vercel Blob store connection.                                            |
| `ANTHROPIC_API_KEY`      | Server-only Claude credential.                                                                               |
| `ANTHROPIC_WORKSPACE_ID` | Required when a Claude personal key isn't scoped to one workspace.                                           |
| `ANTHROPIC_MODEL`        | Optional; defaults to `claude-sonnet-5-5`.                                                                   |
| `RESEND_API_KEY`         | Server-only key for the verified Resend sender.                                                              |
| `EMAIL_FROM`             | Verified sender, e.g. `Loops <hello@loops.yourdomain.com>`.                                                  |
| `APP_URL`                | Canonical HTTPS production origin used in email links.                                                       |
| `AUTH_SECRET`            | Random server-only secret of at least 32 characters for sessions, verification codes and scoped email links. |
| `CRON_SECRET`            | Authenticates `/api/cron`; Vercel includes it automatically in scheduled requests.                           |

Keep secrets in ignored `.env.local` and Vercel environment settings. Never use `NEXT_PUBLIC_` for credentials. Never commit real credentials.

The publication check runs once daily at 16:00 UTC. Submitted replies are included; drafts are excluded. Empty due issues advance their delivery date without publishing. Manual publication starts a fresh cycle. Private access links are bearer credentials: save them somewhere safe and do not share them. The browser remembers up to 15 loop memberships. Members who connect a verified email can sign in from any device. Unlinked memberships still require their personal access links. Members cannot view each other's unfinished replies or attachments. Owner invitation links can be rotated.

## Email scheduling

The daily cron queues a new form when a cycle opens, reminders two days before the deadline for members who have not submitted, and the complete newsletter when the issue publishes. Form reminders require the initial form to have been sent at least one day earlier. Members who opt out receive no recurring mail. Empty cycles do not email an empty newsletter, and saved drafts are preserved when no one submitted. Pausing suspends recurring mail and publication.

Publication and email jobs are saved in the same conditional group update. A persisted outbox, short delivery leases and provider idempotency keys prevent overlapping cron runs from duplicating sends. Unknown receipts older than Resend’s 24-hour deduplication window are flagged for attention, not blindly resent. Pending sends retry on a later group action or daily cron. The owner can see queued, accepted and failed counts; provider acceptance is not a guarantee of inbox delivery. The free provider plan has volume limits.

Private newsletter photos use signed, image-specific links that expire after 90 days. Forwarding an email shares access to those images. Videos and audio stay in the authenticated web issue. Unsubscribe links change preferences only on an explicit POST, so link-scanning software cannot unsubscribe members by opening a link.

Production email setup is pending Resend marketplace terms acceptance and sender verification. After accepting the integration’s terms, provision the free `resend/resend-email` resource for the sender domain, verify its DNS records, connect its key to this Vercel project, set `EMAIL_FROM`, and redeploy. `AUTH_SECRET` and `APP_URL` are already set in production.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover draft and credential isolation, submitted-only publication, photo-only submissions, calendar-month dates, recurring forms and reminders, opt-outs, overlapping email claims, retry limits and signed-token validation. `tests/email-integration.mjs` additionally exercises sign-in, code reuse, cross-device membership, newsletter delivery and unsubscribe against a local test server with the explicitly loaded `tests/mock-email-transport.mjs`; it never sends real emails. The mock preload is not part of the deployed application. Blob updates use ETag conditional writes with retries to avoid lost concurrent replies. AI drafting is limited to 12 attempts per member per day. For a larger public service, add abuse protection and billing controls at the platform layer.

## Deployment

The public source repository is [sahitid/loops](https://github.com/sahitid/loops). Deploy to Vercel with the Next.js preset, connect a **private** Blob store, set the environment variables above, and deploy with `vercel --prod`.

The earlier Expo/Next.js/Supabase implementation remains available in Git history. This version uses Vercel Blob and does not migrate any previous Supabase data.
