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


## Anchor-year historical corpus — 2026-11-04

Sampling plan:
- anchor years: 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026
- languages: RU / EN
- lifecycle strata: dreaming / fulfilled_passive / fulfilled_active
- maximum 10 posts per cell
- 54 cells total

Observed results:

| Year | Unique posts | Estimated read cost |
| --- | ---: | ---: |
| 2010 | 48 | $0.240 |
| 2012 | 54 | $0.270 |
| 2014 | 37 | $0.185 |
| 2016 | 49 | $0.245 |
| 2018 | 54 | $0.270 |
| 2020 | 53 | $0.265 |
| 2022 | 57 | $0.285 |
| 2024 | 55 | $0.275 |
| 2026 | 57 | $0.285 |
| **Total** | **464** | **$2.320** |

Important methodological limitation:
X full-archive search is sorted latest inside the requested year. Therefore each anchor-year sample is biased toward the end of that calendar year, often late December. This corpus is appropriate for exploratory cross-sectional comparison, not population-level prevalence estimates.

Observed data-quality issues:
- `I dream` includes sleep dreams, lyrics, quotes, jokes, and metaphors.
- `мечта сбылась` / `my dream came true` can occur in wishes about the future rather than actual fulfillment.
- third-person and quoted/retweeted statements can survive query filters because legacy retweet text is not always represented consistently by the current API filter.
- 2014 RU `"я мечтаю"` returned zero results in this pilot while other Russian strata did return results; treat this as a retrieval anomaly until independently re-tested.
- lifecycle query match is not proof of a valid human aspiration.

Next required enrichment before historical interpretation:
1. aspiration-vs-noise classifier:
   - human aspiration
   - sleep dream
   - quote/lyrics
   - joke/meme
   - third-person
   - ambiguous/other
2. canonical `deep_desire` extraction, separate from `surface_expression`.
3. visual/media analysis for posts with images/video.
4. manual review sample per year/language/state.
5. only after filtering, compare themes across anchor years.


## High-recall retrieval pilot — 2010 vs 2026

Expanded query library:
- 19 Russian formulas
- 14 English formulas
- includes aspiration, childhood/lifelong dream, becoming/living/moving/traveling, passive fulfillment, and active realization phrases
- executed in batches of at most 5 queries to avoid Vercel serverless timeouts

### 2026
Retrieved before cross-batch dedup:
- RU: 153
- EN: 135
- total: 288
- estimated read cost: $1.44
- media-bearing posts across batches: 69
- explicit platform place signals across batches: 2

Heuristic noise labels across batches:
- candidate: 271
- third_person: 6
- other: 10
- quote_or_lyrics: 1

Rule-based state totals across batches:
- dreaming: 73
- fulfilled_passive: 24
- fulfilled_active: 61
- unknown: 130

### 2010
Retrieved before cross-batch dedup:
- RU: 71
- EN: 111
- total: 182
- estimated read cost: $0.91
- media-bearing posts: 0
- explicit platform place signals across batches: 29

Heuristic observation:
2010 is heavily dominated by legacy retweets despite -is:retweet in the modern search query. Old-style RT text survives as ordinary text in historical results, so a textual legacy-retweet filter is required before interpretation.

### Early comparison
The expanded retrieval layer increases coverage dramatically relative to the narrow anchor-year pilot:
- 2026: ~57 anchor-sample posts -> 288 high-recall retrievals before cross-batch dedup
- 2010: ~48 anchor-sample posts -> 182 high-recall retrievals before cross-batch dedup

Do not interpret this as growth in the prevalence of dreaming over time. Retrieval behavior, platform scale, surviving historical data, language conventions, and query coverage all differ.

### Next filter before theme analysis
Persist and classify every retrieved row with:
1. is_human_aspiration
2. aspiration_subject: self / other / collective
3. expression_type: aspiration / sleep_dream / quote_lyrics / joke_meme / advertisement / news / third_person / legacy_retweet / ambiguous
4. canonical_desire
5. deep_desire
6. lifecycle_state
7. agency
8. media and visual role
9. explicit place vs profile location vs mentioned place
10. relation to parent/root conversation

Only rows classified as first-person or clearly attributable human aspirations should enter the art-ready historical corpus.
