import assert from "node:assert/strict";
import { test } from "node:test";
import { keywordSearch } from "../lib/threads.ts";
test("search forwards opaque cursors to fixed upstream and reads pagination", async () => {
  const original = globalThis.fetch;
  let requested = "";
  globalThis.fetch = async input => {
    requested = String(input);
    return new Response(JSON.stringify({ data: [{ id: "1", text: "test fixture" }], paging: { cursors: { after: "next-cursor" }, next: "https://graph.threads.net/keyword_search?access_token=test" } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await keywordSearch("я мечтаю", "test-token", "opaque=cursor");
    const u = new URL(requested);
    assert.equal(u.origin, "https://graph.threads.net");
    assert.equal(u.searchParams.get("q"), "я мечтаю");
    assert.equal(u.searchParams.get("after"), "opaque=cursor");
    assert.equal(result.paging?.cursors?.after, "next-cursor");
    assert.equal(result.data?.length, 1);
  } finally { globalThis.fetch = original; }
});
test("upstream permission errors do not become empty successful corpora", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Missing keyword permission" } }), { status: 403 });
  try { await assert.rejects(keywordSearch("I dream", "test"), /Missing keyword permission/); }
  finally { globalThis.fetch = original; }
});
test("unexpected successful payload is not treated as zero posts", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 });
  try { await assert.rejects(keywordSearch("dream", "test"), /data is not an array/); }
  finally { globalThis.fetch = original; }
});
