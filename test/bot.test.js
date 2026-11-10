import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySignature, extractComments, matchKeyword, handleComment, keywordsFor, listMedia, _resetSeenForTests } from "../lib/bot.js";
import { GET, POST } from "../api/webhook.js";
import { GET as reelsGET } from "../api/reels.js";

test("keywordsFor: reel rules apply only to that reel and override defaults", () => {
  const config = {
    default: { guide: { dm: "default guide" } },
    reels: { R1: { label: "agents reel", keywords: { guide: { dm: "R1 guide" }, agent: { dm: "R1 agent" } } } },
  };
  assert.equal(keywordsFor(config, "R1").guide.dm, "R1 guide");
  assert.equal(keywordsFor(config, "R1").agent.dm, "R1 agent");
  assert.equal(keywordsFor(config, "R2").guide.dm, "default guide");
  assert.equal(keywordsFor(config, "R2").agent, undefined);
  assert.deepEqual(keywordsFor({ default: {}, reels: {} }, undefined), {});
});

test("listMedia trims captions to first line and maps fields", async () => {
  const fetchImpl = async (url) => {
    assert.ok(url.includes("/IGID/media?fields="));
    return { ok: true, json: async () => ({ data: [{ id: "M1", caption: "Hook line\nmore", permalink: "https://ig/reel/x", media_product_type: "REELS", timestamp: "2026-11-01T10:00:00+0000" }] }) };
  };
  assert.deepEqual(await listMedia("IGID", "EAAx", fetchImpl), [
    { id: "M1", type: "REELS", posted: "2026-11-01", link: "https://ig/reel/x", caption: "Hook line" },
  ]);
});

test("reels page refuses without the right key", async () => {
  process.env.VERIFY_TOKEN = "vt";
  assert.equal((await reelsGET(new Request("https://x/api/reels"))).status, 403);
  assert.equal((await reelsGET(new Request("https://x/api/reels?key=nope"))).status, 403);
});

const keywords = { guide: { dm: "Here: https://x.co", reply: "Check DMs" } };
const quietLog = { error: () => {} };

function fakeFetch({ fail = [] } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization });
    const failing = fail.some((part) => url.includes(part));
    return { ok: !failing, status: failing ? 400 : 200, text: async () => "err", json: async () => ({}) };
  };
  return { impl, calls };
}

const comment = (over = {}) => ({ accountId: "ME", id: "c1", text: "GUIDE please", from: { id: "u1", username: "fan" }, ...over });

beforeEach(() => _resetSeenForTests());

test("signature: valid passes, tampered or missing fails", () => {
  const sig = "sha256=" + crypto.createHmac("sha256", "s3cret").update("body").digest("hex");
  assert.equal(verifySignature("body", sig, "s3cret"), true);
  assert.equal(verifySignature("body2", sig, "s3cret"), false);
  assert.equal(verifySignature("body", null, "s3cret"), false);
  assert.equal(verifySignature("body", "sha256=abc", "s3cret"), false);
  assert.equal(verifySignature("body", sig, undefined), false);
});

test("extractComments handles both payload shapes and skips other fields", () => {
  const flat = { entry: [{ id: "ME", field: "comments", value: { id: "c1", text: "hi" } }] };
  const wrapped = { entry: [{ id: "ME", changes: [{ field: "comments", value: { id: "c2" } }, { field: "mentions", value: { id: "m" } }] }] };
  assert.deepEqual(extractComments(flat), [{ accountId: "ME", id: "c1", text: "hi" }]);
  assert.deepEqual(extractComments(wrapped), [{ accountId: "ME", id: "c2" }]);
  assert.deepEqual(extractComments({}), []);
});

test("matchKeyword: whole word, any case, ignores partial words", () => {
  assert.equal(matchKeyword("GUIDE!!", keywords), "guide");
  assert.equal(matchKeyword("send the guide pls", keywords), "guide");
  assert.equal(matchKeyword("guidelines?", keywords), null);
  assert.equal(matchKeyword("", keywords), null);
  assert.equal(matchKeyword(undefined, keywords), null);
});

test("keyword comment sends DM and public reply with correct payloads", async () => {
  const { impl, calls } = fakeFetch();
  const out = await handleComment(comment(), { keywords, token: "T", fetchImpl: impl, log: quietLog });
  assert.equal(out, "handled:guide:dm+reply");
  assert.equal(calls[0].url, "https://graph.facebook.com/v27.0/ME/messages");
  assert.deepEqual(calls[0].body, { recipient: { comment_id: "c1" }, message: { text: "Here: https://x.co" } });
  assert.equal(calls[0].auth, "Bearer T");
  assert.equal(calls[1].url, "https://graph.facebook.com/v27.0/c1/replies");
  assert.deepEqual(calls[1].body, { message: "Check DMs" });
});

test("Instagram-login tokens (IG...) go to graph.instagram.com", async () => {
  const { impl, calls } = fakeFetch();
  await handleComment(comment(), { keywords, token: "IGAAxyz", fetchImpl: impl, log: quietLog });
  assert.equal(calls[0].url, "https://graph.instagram.com/v27.0/ME/messages");
  assert.equal(calls[1].url, "https://graph.instagram.com/v27.0/c1/replies");
});

test("non-keyword comment makes no API calls", async () => {
  const { impl, calls } = fakeFetch();
  const out = await handleComment(comment({ text: "love this" }), { keywords, token: "T", fetchImpl: impl });
  assert.equal(out, "ignored:no-keyword");
  assert.equal(calls.length, 0);
});

test("own comment is ignored (prevents replying to itself forever)", async () => {
  const { impl, calls } = fakeFetch();
  const out = await handleComment(comment({ from: { id: "ME" }, text: "guide" }), { keywords, token: "T", fetchImpl: impl });
  assert.equal(out, "ignored:own-comment");
  assert.equal(calls.length, 0);
});

test("duplicate delivery of the same comment only acts once", async () => {
  const { impl, calls } = fakeFetch();
  await handleComment(comment(), { keywords, token: "T", fetchImpl: impl, log: quietLog });
  const out = await handleComment(comment(), { keywords, token: "T", fetchImpl: impl, log: quietLog });
  assert.equal(out, "ignored:duplicate");
  assert.equal(calls.length, 2);
});

test("failed DM still attempts public reply and does not throw", async () => {
  const { impl, calls } = fakeFetch({ fail: ["/messages"] });
  const out = await handleComment(comment(), { keywords, token: "T", fetchImpl: impl, log: quietLog });
  assert.equal(out, "handled:guide:reply");
  assert.equal(calls.length, 2);
});

test("webhook GET echoes challenge only with right verify token", async () => {
  process.env.VERIFY_TOKEN = "vt";
  const ok = GET(new Request("https://x/api/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=42"));
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "42");
  const bad = GET(new Request("https://x/api/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"));
  assert.equal(bad.status, 403);
});

test("webhook POST rejects bad signature, accepts good one", async () => {
  process.env.APP_SECRET = "s3cret";
  const body = JSON.stringify({ entry: [{ id: "ME", field: "comments", value: { id: "c9", text: "hello", from: { id: "u" } } }] });
  const bad = await POST(new Request("https://x", { method: "POST", body, headers: { "x-hub-signature-256": "sha256=00" } }));
  assert.equal(bad.status, 403);
  const sig = "sha256=" + crypto.createHmac("sha256", "s3cret").update(body).digest("hex");
  const good = await POST(new Request("https://x", { method: "POST", body, headers: { "x-hub-signature-256": sig } }));
  assert.equal(good.status, 200);
});

test("reply can be a list; one of them is posted", async () => {
  const { impl, calls } = fakeFetch();
  const kw = { guide: { dm: "d", reply: ["A", "B"] } };
  await handleComment(comment(), { keywords: kw, token: "T", fetchImpl: impl, log: quietLog });
  assert.ok(["A", "B"].includes(calls[1].body.message));
});
