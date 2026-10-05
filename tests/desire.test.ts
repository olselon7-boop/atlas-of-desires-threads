import assert from "node:assert/strict";
import { test } from "node:test";
import { detectDesire, mergeCorpus, type DesireRecord } from "../lib/desire.ts";
test("Russian and English candidates retain uncertainty", () => {
  for (const text of ["Я мечтаю о доме", "I wish I could go home", "Хочу чтобы мама выздоровела", "I hope someday we have peace"]) {
    const result = detectDesire(text);
    assert.equal(result.candidate, true);
    assert.equal(result.requires_review, true);
  }
  assert.equal(detectDesire("Сегодня понедельник").candidate, false);
  assert.equal(detectDesire("I wanted tea yesterday").candidate, false);
});
test("deduplication preserves manual review and first source text", () => {
  const make = (query: string, review: DesireRecord["review"]): DesireRecord => ({ id: "same", source: { platform: "threads", post_id: "1", original_text: "I dream of home", timestamp: null, permalink: null, queries: [query], collected_at: "2026-10-05" }, media: { type: null, url: null, thumbnail_url: null }, interpretation: detectDesire("I dream of home"), place: { city: null, country: null, source: null }, review });
  const result = mergeCorpus([make("I dream", "keep")], [make("home", "unreviewed"), make("home", "unreviewed")]);
  assert.equal(result.length, 1);
  assert.equal(result[0].review, "keep");
  assert.deepEqual(result[0].source.queries, ["I dream", "home"]);
});
