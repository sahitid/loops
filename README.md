# Loops

Private group newsletters for friends, families, and your people. Built with Next.js 16, React 19, TypeScript, and Tailwind CSS 4.

## What works

- Create private groups and invite up to 30 people with a revocable invitation link.
- Passwordless personal access links and secure HTTP-only browser sessions.
- Record voice notes (up to 10 minutes), with live browser speech recognition where supported.
- Turn an editable transcript into a newsletter draft with Claude. Review and edit before submitting.
- Bulk-upload up to 30 photos, videos, and audio notes per person per issue, up to 100 MB per file. Uploads go directly to a **private** Vercel Blob store.
- Write freeform updates, answer optional questions, and save private drafts.
- Choose questions from a bank or write your own.
- Publish compiled newsletters, read the archive, and print/save an issue as PDF.
- Weekly, fortnightly, or 30-day schedules, with a daily Vercel Cron publication check and pause controls.
- Responsive Letterloop-inspired interface and an isolated sample loop at `/demo`.

Issues publish on the web. Email sending and automated email reminders are not implemented. Claude does not transcribe raw audio here: live transcription uses the browser's speech recognition service, which may send audio to its provider. If unsupported, audio recording still works and users can type/paste a transcript. This app currently transcribes English (`en-US`). Media is attached to the newsletter; Claude receives only the text supplied for drafting and does not analyze photos/videos.

## Local development

```sh
npm install
cp .env.example .env.local
npm run dev
```

Without Blob credentials, group records use the ignored `.data/` directory locally. Uploads require a connected private Blob store. Vercel production requires cloud storage and never falls back to ephemeral files.

## Environment

| Variable                 | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN`  | Automatically supplied by a private Vercel Blob store connection.                  |
| `ANTHROPIC_API_KEY`      | Server-only Claude credential.                                                     |
| `ANTHROPIC_WORKSPACE_ID` | Required when a Claude personal key isn't scoped to one workspace.                 |
| `ANTHROPIC_MODEL`        | Optional; defaults to `claude-sonnet-5-5`.                                         |
| `CRON_SECRET`            | Authenticates `/api/cron`; Vercel includes it automatically in scheduled requests. |

Keep secrets in ignored `.env.local` and Vercel environment settings. Never use `NEXT_PUBLIC_` for credentials. Never commit real credentials.

The publication check runs once daily at 16:00 UTC. Submitted replies are included; drafts are excluded. Empty due issues advance their delivery date without publishing. Manual publication starts a fresh cycle. Private access links are bearer credentials: save them somewhere safe and do not share them. The browser remembers up to 15 loop memberships. There is no email-based recovery yet; owners should preserve their personal links. Members cannot view each other's unfinished replies or attachments. Owner invitation links can be rotated.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

Tests cover draft and credential isolation, submitted-only publication, photo-only submissions, and empty-cycle handling. Blob updates use ETag conditional writes with retries to avoid lost concurrent replies. AI drafting is limited to 12 attempts per member per day. For a larger public service, add abuse protection and billing controls at the platform layer.

## Deployment

The public source repository is [sahitid/loops](https://github.com/sahitid/loops). Deploy to Vercel with the Next.js preset, connect a **private** Blob store, set the environment variables above, and deploy with `vercel --prod`.

The earlier Expo/Next.js/Supabase implementation remains available in Git history. This version uses Vercel Blob and does not migrate any previous Supabase data.
