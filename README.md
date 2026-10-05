# Atlas of Desires — Threads API

Standalone integration service for Meta Threads, separate from the earlier atlas-zhelanii application.

## Purpose

Threads API → public-post search → normalization → later semantic analysis and clustering → museum visualization.

## Deployment

Production URL: https://atlas-of-desires-threads.vercel.app

Vercel project: atlas-of-desires-threads. The main branch is the production source.

## Environment variables

- THREADS_APP_ID: Threads application ID from Meta.
- THREADS_APP_SECRET: Threads application secret; set as a server-only encrypted variable in Vercel.
- THREADS_REDIRECT_URI: https://atlas-of-desires-threads.vercel.app/api/threads/callback
- NEXT_PUBLIC_BASE_URL: https://atlas-of-desires-threads.vercel.app
- THREADS_ACCESS_TOKEN: optional server-side fallback token. OAuth normally stores the token in a secure HttpOnly cookie.

Never commit credentials. Redeploy after changing Vercel environment variables.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/threads/status | Configuration status without secret values |
| GET | /api/threads/auth | Start Threads OAuth |
| GET | /api/threads/callback | Validate OAuth state and exchange the code |
| GET | /api/threads/search?q=wish | Search after authorization |
| POST | /api/threads/deauthorize | Verify a Meta signed_request and clear the response cookie |
| POST | /api/threads/delete | Verify a Meta signed_request and return a confirmation URL |
| GET | /data-deletion | Data deletion confirmation page |

Configure the OAuth callback and the deauthorization/data deletion callback URLs in the Meta Threads application using the production domain above.

The current integration does not persist collected posts or tokens in a database. Full OAuth and keyword search verification requires valid Meta credentials, an authorized Threads user, and the appropriate application permissions.

## Meta callback URLs

- OAuth redirect: https://atlas-of-desires-threads.vercel.app/api/threads/callback
- Deauthorization: https://atlas-of-desires-threads.vercel.app/api/threads/deauthorize
- Data deletion callback: https://atlas-of-desires-threads.vercel.app/api/threads/delete

Start user authorization at https://atlas-of-desires-threads.vercel.app/api/threads/auth after configuring the OAuth redirect in Meta. In development mode, use an account with the appropriate app role.

## Research collector

Open `/research` in the same browser used for Threads authorization. Successful OAuth returns here automatically.

1. Choose a Russian or English desire formula and collect one results page.
2. Fetch further pages with the opaque cursor; duplicate post IDs merge without resetting manual review.
3. Read original posts and mark them as keep/exclude. Rules only suggest a candidate and modality; they do not establish intent or semantic clusters.
4. Export JSON after each session. The versioned corpus is stored in this browser only, with original text, timestamps, source references, search provenance, optional media URLs, separate rule interpretation and review. Usernames/profile metadata are not stored in the corpus, but text and links can identify people. Treat the export as research material, not an anonymized exhibition dataset.

The `/api/threads/corpus?q=...&after=...` route requires a Threads token and never exposes upstream pagination URLs or tokens. Geography remains unknown. Media URLs can expire; media bytes and carousel children are not archived. The first target is 1,000–3,000 unique posts, to be reviewed before artwork morphology is finalized.

No shared database, scheduled collection, AI semantic classification, image analysis or embeddings have been provisioned yet. The research page does not create synthetic wishes.

Validation: `npm test`, `npm run typecheck`, `npm run build`.
