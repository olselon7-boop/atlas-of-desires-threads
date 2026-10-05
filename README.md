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
