# X / Twitter research track

Branch: `research/x-historical-source`

## Why X matters for Atlas of Desires

X is potentially the project's strongest historical social source because the official API supports full-archive public Post search back to 2006. That makes it useful for the question:

> Do human dreams change, or does only the language/platform change?

This branch is intentionally isolated from the live Bluesky/Threads research path.

## Official API model checked 2026-11-04

- Recent search: last 7 days.
- Full-archive search: public archive back to 2006.
- Search supports query operators and language filtering.
- Responses can request post text, creation time, author, conversation id, entities, attachments, geo, referenced posts.
- Expansions can include user/profile, media, place, and referenced post objects.
- X API is pay-per-use.
- Current docs list Post reads at $0.005 per returned Post.
- Pay-per-use plans are capped at 3 million Post reads per monthly billing cycle; larger volume requires Enterprise.
- Current rates can change and should be checked in the Developer Console before large collection.

## Environment

Set only in Vercel / local env, never commit:

```
X_BEARER_TOKEN=...
```

## Smoke endpoints

```
GET /api/x/status
GET /api/x/search?q=%22я%20мечтаю%22%20lang%3Aru%20-is%3Aretweet&mode=recent
GET /api/x/search?q=%22my%20dream%20came%20true%22%20lang%3Aen%20-is%3Aretweet&mode=recent
```

For full archive:

```
GET /api/x/search?q=%22я%20мечтаю%22%20lang%3Aru%20-is%3Aretweet&mode=all
```

The smoke endpoint is deliberately capped at 10 results per request.

## Initial query families

Russian:
- "я мечтаю"
- "все еще мечтаю"
- "до сих пор мечтаю"
- "мечта сбылась"
- "мечта исполнилась"
- "исполнил мечту"
- "осуществил мечту"
- "реализовал мечту"

English:
- "I dream"
- "still dreaming"
- "my dream came true"
- "I made my dream come true"
- "I achieved my dream"

## Research use cases

### Historical language of desire

Compare how people phrase the same deep desire across:
- 2006–2010
- 2011–2015
- 2016–2020
- 2021–2026

Keep surface expression separate from deep desire.

### Dream lifecycle

Potentially search multiple historical expressions from the same public account, but do NOT assume same author = same dream.

Link only after:
- first-person expression;
- compatible time sequence;
- same dream object;
- semantic similarity;
- visual/media evidence if present;
- manual review.

### Platform comparison

X should be treated as a distinct culture/platform corpus, not pooled blindly with Bluesky or Threads.

Statements should be phrased as:
"Within public X posts matching our query..."
not:
"People dream more about..."

## Privacy

Research-only raw data may contain usernames and profile fields because they are needed for longitudinal linking.

Public art-ready output must:
- omit username and raw user id;
- use pseudonymous stable author keys internally;
- not display exact personal locations;
- keep source facts separate from AI inference;
- review recognizable people/images before exhibition use.

## Cost-control rules

1. Never run full archive automatically on page load.
2. Default smoke request: 10 posts.
3. Require explicit server-side action for historical batch collection.
4. Track estimated read cost before running a batch.
5. Deduplicate within the project even though X also applies billing deduplication rules.
6. Use the X Usage endpoint and Developer Console before scaling.
7. Start historical validation with a small budget (for example, hundreds rather than tens of thousands of posts).

## Next validation step

After `X_BEARER_TOKEN` is configured:

1. call `/api/x/status`;
2. recent RU smoke test;
3. recent EN smoke test;
4. one very small full-archive RU test;
5. inspect returned fields/media/profile/place/replies support;
6. only then design a persistent X collector and historical sampling strategy.
