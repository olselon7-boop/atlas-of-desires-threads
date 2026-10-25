# Visual understanding, dream objects and Atlas v0.1

Branch: `codex/visual-dream-trajectories`, based on main `ac97d37`.

## Data flow

`/research` remains the original live Bluesky/Threads collector. Its `atlas-research-corpus-v2` localStorage corpus feeds `/research/images`, `/research/trajectories` and `/atlas`. New pages accept an exported `{records: DesireRecord[]}` JSON corpus (up to 5000 records / 10 MB). Imports are validated, source text is kept intact in research, interpretations are recomputed with the current preliminary rules, and no records are invented. Changing browser, host or preview origin requires exporting/importing the corpus. Original collector endpoints and Threads OAuth remain unchanged.

`AtlasDataSource` separates rendering from persistence. `CorpusDataSource` transforms validated records into a narrow public DTO. `/api/atlas/data` optionally reads `data/art_ready/research-corpus.json` as a controlled server snapshot; when absent it returns an empty corpus, never synthetic placeholders. Research files are gitignored. A future database adapter can implement `getDesires()` and `getTrajectories()` without changing the scene. The browser adapter additionally applies locally saved manual decisions.

The research GET endpoints honestly report `storage: browser-local`; they do not claim a shared database or expose raw server snapshots. The review POST validates/acknowledges a decision with `persisted: false`; the UI saves it in versioned localStorage. Local review is not shared or a server-side authorization mechanism.

## Image analysis

Server variables:

- `OPENAI_API_KEY`: required for live multimodal analysis; never `NEXT_PUBLIC_*`.
- `OPENAI_VISION_MODEL`: optional override; default `gpt-5.4-mini`.
- `RESEARCH_ANALYSIS_TOKEN`: a separate researcher access code required when enabling paid calls. It is entered only for the current page session, not saved in localStorage. Do not enter the OpenAI key in this field.

`POST /api/research/images/analyze` accepts `{records}` and checks the researcher bearer credential before any paid call. Without an OpenAI key it returns `not_configured` per eligible image without breaking the rest of the app. A configured key without a research code leaves analysis locked (503); a wrong code returns 401. No key, upstream payload, private token or raw provider exception is returned.

The explicit Analyze button sends at most 50 records, defaults to 10, filters to actual image media and skips completed analyses. A pilot of 50–100 images requires one or two explicit batches. There is no analysis on navigation/page load. Requests run at concurrency 3 with a 14-second per-image deadline, maximum route duration 300 seconds, a bounded 500-entry result cache and in-flight deduplication. Completed analysis is also persisted with the local corpus and exported to JSON. The server cache is warm-instance only; a DB/cache adapter is needed for durable cross-instance caching. Browser quota failures are reported.

The server uses OpenAI Responses API with text + image inputs, `store: false`, low-detail image input and a strict JSON schema. Runtime validation rejects missing fields, extra fields, bad enums and confidence outside [0,1]. Refusals, timeouts, incomplete output, invalid JSON and provider errors become `failed` without invented analysis. Only HTTPS image URLs on known Bluesky/Meta media CDNs are accepted. External link previews are not assumed to be images. The current DesireRecord stores only the collector's first image.

Model prompt distinguishes motifs, objects, scene, mood, visual role and text/image alignment, allows new canonical snake_case labels, and prohibits identification of people and inferred geography. A visual fulfillment signal is a hypothesis, not proof.

Official references: [Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [model](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Same Dream v1

The rule-based object extractor handles the seed domains separately from lifecycle; ambiguous multi-object text stays unresolved. Aligned, sufficiently confident visual analysis can supply a previously unknown canonical label. Conflicting text/visual labels lower confidence and prevent automatic confirmation. This remains a conservative prototype, not a trained semantic classifier.

The linker groups candidate posts by the same nonempty pseudonymous author key **and platform** with two known, increasing timestamps. It checks first-person expression, lifecycle compatibility, canonical object, explicit textual entities, analyzed visual objects/scenes and elapsed time. Direct contradictions return `different_dream`; same author + states with no shared object returns `insufficient_evidence`. Shared broad topics with conflicting explicit destinations do not confirm. Some quoted/reported speech is rejected heuristically; irony, quotation and multiple distinct dreams within the same category still require manual review.

A `confirmed_candidate` remains a hypothesis with `requires_manual_review: true`. Only such a candidate with an observed dreaming/stalled/struggling post before a fulfilled post gets `time_to_fulfillment`. This is an interval between observations, not the true origin date of a dream. Two already-fulfilled posts never receive a dream-start/fulfillment duration, including after manual confirmation. Manual rejection/uncertainty clears the duration and excludes a pair from public TIME. A manual same-dream decision takes precedence for membership; automatic evidence is preserved for audit, and duration still obeys the conservative gate.

Review processing is bounded to the last 60 dated candidate posts per author and at most 1000 pairs. Selection can be filtered by RU/EN and manual review status. The rule vocabulary and simple first-person/entity checks have documented recall limitations; lack of a candidate is not evidence that a dream never existed.

## Artwork and privacy

`/atlas` lazily loads Three.js, renders at most 5000 real objects, and labels the real record count. It never replicates records to pretend there are thousands. Deterministic irregular positions combine object, state, language, date and platform; slow breathing respects reduced-motion preferences. Pointer/touch rotation, scroll zoom and point hover/selection lead from organism to constellation to individual text. Keyboard +/- and arrows plus a named desire selector provide alternatives. WebGL failure leaves a readable fallback.

TIME is experimental and uses **only manually confirmed pairs**. It draws curved time tension, stalled loops, transformed branches and fulfilled crystalline endpoints; it does not use a timeline chart. This first adapter represents two-observation trajectories, not reconstructed unobserved intermediate states. Persistence is null until measured and particle sizes do not invent it.

The public DTO excludes author_key, username, DID, post ID, permalink, raw source object and location fields. It redacts explicit mentions, contact patterns and source URLs in text; free-text indirect identification remains a limitation requiring curatorial review before exhibition. Original research text is unchanged. Artwork image textures require analyzed status, confidence >= .7, `contains_people === false`, `contains_readable_text === false` and a known media CDN. All other media becomes a light fragment; raw image URLs are absent from the public response. Up to 80 eligible texture fragments are loaded for GPU/network bounds. Any visible people or uncertain presence are withheld from artwork. Research UI can inspect source images. No image geography is inferred.

## Validation / remaining live-environment work

Run `npm test`, `npm run typecheck`, `npm run build`. Regression tests cover the original Threads fetch/paging/error behavior, lifecycle, object extraction, Russian morphology/duration, required lips/book false positive, two post-fulfillment sea observations, manual override, public DTO and people-image withholding, strict visual schema, batch limits, key absence and mocked provider boundary/cache/failure behavior.

Local browser QA uses a genuine corpus fetched through the unchanged production Bluesky collector on 2026-10-25. It stays under ignored `data/private_raw/`, and is not committed to the PR. Both RU/EN candidate pairs and real image records are available. These observations are not asserted as verified dream trajectories. No real pair is falsely marked same-dream to make TIME look populated.

A live OpenAI pilot is not validated without a configured key/researcher access code. Do not treat mocked provider tests or `not_configured` as a successful 50–100-image model evaluation. Preview browser QA and the live paid pilot are separate gates; do not merge before reviewing the preview.
