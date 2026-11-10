import crypto from "node:crypto";

// Meta issues two kinds of token. Instagram-login tokens start with "IG" and only
// work on graph.instagram.com; Facebook-issued tokens ("EAA...") use graph.facebook.com.
export function graphBase(token) {
  const host = token?.startsWith("IG") ? "graph.instagram.com" : "graph.facebook.com";
  return `https://${host}/v27.0`;
}

// Meta may deliver the same webhook more than once. This remembers comment IDs
// while the server instance stays warm. It is not perfect (a cold start forgets),
// but Instagram itself allows only one private reply per comment, so the worst
// case is a duplicate public reply.
const seen = new Set();

export function verifySignature(rawBody, header, appSecret) {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Instagram Login sends { field, value } directly on each entry; Facebook Login
// wraps them in entry.changes[]. Accept both.
export function extractComments(payload) {
  const out = [];
  for (const entry of payload?.entry ?? []) {
    const changes = entry.changes ?? [{ field: entry.field, value: entry.value }];
    for (const change of changes) {
      if (change.field !== "comments" || !change.value?.id) continue;
      out.push({ accountId: entry.id, ...change.value });
    }
  }
  return out;
}

// Whole-word, case-insensitive. "Comment GUIDE please" matches "guide";
// "guidelines" does not.
export function matchKeyword(text, keywords) {
  const words = (text ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return Object.keys(keywords).find((k) => words.includes(k.toLowerCase())) ?? null;
}

// keywords.json has "default" rules (every post) and "reels" rules keyed by media ID.
// A reel's own rules win over a default with the same keyword.
export function keywordsFor(config, mediaId) {
  return { ...config.default, ...config.reels?.[mediaId]?.keywords };
}

// Lists recent posts and reels so the user can find each reel's media ID.
export async function listMedia(igUserId, token, fetchImpl = fetch) {
  const fields = "id,caption,permalink,media_product_type,timestamp";
  const res = await fetchImpl(`${graphBase(token)}/${igUserId}/media?fields=${fields}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const { data = [] } = await res.json();
  return data.map((m) => ({
    id: m.id,
    type: m.media_product_type,
    posted: m.timestamp?.slice(0, 10),
    link: m.permalink,
    caption: (m.caption ?? "").split("\n")[0].slice(0, 80),
  }));
}

async function graphPost(url, body, token, fetchImpl) {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

// Returns what it did, for logs and tests. Never throws.
export async function handleComment(comment, { keywords, token, fetchImpl = fetch, log = console }) {
  if (comment.from?.id === comment.accountId) return "ignored:own-comment";
  if (seen.has(comment.id)) return "ignored:duplicate";

  const keyword = matchKeyword(comment.text, keywords);
  if (!keyword) return "ignored:no-keyword";
  seen.add(comment.id);

  const { dm } = keywords[keyword];
  // A list of replies rotates at random, so 200 identical replies don't look like spam.
  const replies = [].concat(keywords[keyword].reply ?? []);
  const reply = replies[Math.floor(Math.random() * replies.length)];
  const result = [];

  try {
    await graphPost(`${graphBase(token)}/${comment.accountId}/messages`,
      { recipient: { comment_id: comment.id }, message: { text: dm } }, token, fetchImpl);
    result.push("dm");
  } catch (err) {
    log.error(`DM failed for comment ${comment.id} (@${comment.from?.username}): ${err.message}`);
  }

  if (reply) {
    try {
      await graphPost(`${graphBase(token)}/${comment.id}/replies`, { message: reply }, token, fetchImpl);
      result.push("reply");
    } catch (err) {
      log.error(`Public reply failed for comment ${comment.id}: ${err.message}`);
    }
  }

  return `handled:${keyword}:${result.join("+") || "failed"}`;
}

export function _resetSeenForTests() {
  seen.clear();
}
