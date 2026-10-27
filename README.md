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

Email can use a Gmail account with a Google app password, or a verified Resend sending domain and API key. Gmail does not require buying or configuring a domain. Until a sender is configured, the interface explicitly shows that email sign-in and delivery are unavailable; groups and personal access links still work. Claude does not transcribe raw audio here: live transcription uses the browser's speech recognition service, which may send audio to its provider. If unsupported, audio recording still works and users can type/paste a transcript. This app currently transcribes English (`en-US`). Media is attached to the newsletter; Claude receives only the text supplied for drafting and does not analyze photos/videos.

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
| `EMAIL_PROVIDER`         | `gmail` or `resend` (default).                                                                              |
| `GMAIL_USER`             | Sending Google account's email address, used when the provider is `gmail`.                                    |
| `GMAIL_FROM_ADDRESS`     | Optional Gmail Send mail as address, including a plus-address; also used for replies. Defaults to `GMAIL_USER`. |
| `GMAIL_APP_PASSWORD`     | Server-only Google app password for that account, used when the provider is `gmail`.                         |
| `RESEND_API_KEY`         | Server-only key for the verified Resend sender; used only by `resend`.                                        |
| `EMAIL_FROM`             | Verified Resend sender, e.g. `Loops <hello@loops.yourdomain.com>`; Gmail uses `Loops <GMAIL_USER>`.             |
| `APP_URL`                | Canonical HTTPS production origin used in email links.                                                       |
| `AUTH_SECRET`            | Random server-only secret of at least 32 characters for sessions, verification codes and scoped email links. |
| `CRON_SECRET`            | Authenticates `/api/cron`; Vercel includes it automatically in scheduled requests.                           |

Keep secrets in ignored `.env.local` and Vercel environment settings. Never use `NEXT_PUBLIC_` for credentials. Never commit real credentials.

For Gmail, create or choose the sending account, enable [Google 2-Step Verification and app passwords](https://support.google.com/accounts/answer/185833), then save `EMAIL_PROVIDER=gmail`, `GMAIL_USER`, and `GMAIL_APP_PASSWORD` in the Vercel project's Production environment settings and redeploy. Enter the app password directly in Vercel as a sensitive variable; do not use the account's regular password. Some managed or protected Google accounts do not allow app passwords. Login codes, invitations, forms, reminders, and newsletters all use the selected sender. Gmail's [sending limits](https://support.google.com/mail/answer/22839) apply to the whole account, including its other mail.

To send from a plus-address, keep `GMAIL_USER` set to the base account and set `GMAIL_FROM_ADDRESS` to the plus-address. Add that address under Gmail's [Send mail as settings](https://support.google.com/mail/answer/22370) so Google preserves the From address. Replies go to the plus-address, which can be sorted with a Gmail label and filter.

The publication check runs once daily at 16:00 UTC. Submitted replies are included; drafts are excluded. Empty due issues advance their delivery date without publishing. Manual publication starts a fresh cycle. Private access links are bearer credentials: save them somewhere safe and do not share them. The browser remembers up to 15 loop memberships. Members who connect a verified email can sign in from any device. Unlinked memberships still require their personal access links. Members cannot view each other's unfinished replies or attachments. Owner invitation links can be rotated.

## Email scheduling

The daily cron queues a new form when a cycle opens, reminders two days before the deadline for members who have not submitted, and the complete newsletter when the issue publishes. Form reminders require the initial form to have been sent at least one day earlier. Members who opt out receive no recurring mail. Empty cycles do not email an empty newsletter, and saved drafts are preserved when no one submitted. Pausing suspends recurring mail and publication.

Publication and email jobs are saved in the same conditional group update. A persisted outbox and short delivery leases prevent overlapping cron runs from sending the same job. Resend additionally supports idempotency keys; unknown receipts older than its 24-hour deduplication window are flagged for attention. Gmail SMTP does not guarantee deduplication: an uncertain send or expired sending lease is marked failed for review instead of automatically repeating it. Definite temporary rejections can retry on a later group action or daily cron. Previously attempted jobs are never automatically retried through a different provider. The owner can see queued, accepted and failed counts; provider acceptance is not a guarantee of inbox delivery. Provider volume limits apply.

Private newsletter photos use signed, image-specific links that expire after 90 days. Forwarding an email shares access to those images. Videos and audio stay in the authenticated web issue. Unsubscribe links change preferences only on an explicit POST, so link-scanning software cannot unsubscribe members by opening a link.

For Resend instead, connect its free Vercel integration, verify the sending domain's DNS records, set `EMAIL_PROVIDER=resend` and `EMAIL_FROM`, and redeploy. Gmail does not use the Resend integration or require DNS verification. `AUTH_SECRET` and `APP_URL` are needed with either provider.

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
